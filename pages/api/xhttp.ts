import type { NextApiRequest, NextApiResponse } from 'next';
import net from 'net';

/**
 * VLESS + XHTTP (stream-one) 代理
 *
 * 参考 edgetunnel/_worker.js 的 XHTTP 实现，移植到 Vercel Node.js runtime。
 *
 * XHTTP stream-one 传输：客户端用一次 HTTP POST 上行，服务端用一次 HTTP 响应下行，
 * 二者都是流式字节流。本路由在其中承载 VLESS 协议：
 *   - 上行：请求体 = [VLESS 协议头][原始 TCP 负载]...
 *   - 下行：响应体 = [VLESS 响应头 [version, 0]][原始 TCP 负载]...
 *
 * 必须使用 Node.js runtime：需要 net.connect() 建立到任意 host:port 的原始 TCP 连接，
 * Edge runtime 不提供 TCP socket API。
 *
 * 通过环境变量 UUID 设置 VLESS 认证 UUID（与客户端配置一致）。
 */

export const config = {
  runtime: 'nodejs',
  // 关闭内置 body parser：XHTTP 上行是原始 VLESS 字节流，必须以流形式读取而非被解析为对象
  api: {
    bodyParser: false,
  },
};

// 认证 UUID：与客户端配置一致；未设置时使用默认值（仅用于本地调试，生产环境务必配置 UUID）
const USER_ID = (process.env.UUID || 'd342d11e-d424-4583-b36e-524ab1f0afa4').toLowerCase();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USER_UUID = UUID_REGEX.test(USER_ID) ? USER_ID : 'd342d11e-d424-4583-b36e-524ab1f0afa4';

const textDecoder = new TextDecoder();
const uuidBytesCache = new Map<string, Uint8Array>();

/** 将 UUID 字符串解析为 16 字节数组（带缓存） */
function getUuidBytes(uuid: string): Uint8Array | null {
  const cached = uuidBytesCache.get(uuid);
  if (cached) return cached;
  const clean = uuid.replace(/-/g, '');
  if (clean.length !== 32) return null;
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    const high = hexNibble(clean.charCodeAt(i * 2));
    const low = hexNibble(clean.charCodeAt(i * 2 + 1));
    if (high < 0 || low < 0) return null;
    bytes[i] = (high << 4) | low;
  }
  if (uuidBytesCache.size >= 32) uuidBytesCache.clear();
  uuidBytesCache.set(uuid, bytes);
  return bytes;
}

function hexNibble(code: number): number {
  if (code >= 48 && code <= 57) return code - 48;
  code |= 32;
  if (code >= 97 && code <= 102) return code - 87;
  return -1;
}

/** 比对 data[offset, offset+16) 是否等于给定 UUID 的字节序列 */
function uuidMatch(data: Uint8Array, offset: number, uuid: string): boolean {
  const expected = getUuidBytes(uuid);
  if (!expected || data.byteLength < offset + 16) return false;
  for (let i = 0; i < 16; i++) {
    if (data[offset + i] !== expected[i]) return false;
  }
  return true;
}

interface ParsedVless {
  version: number;
  hostname: string;
  port: number;
  isUDP: boolean;
  rawData: Uint8Array; // 协议头之后的原始负载
}

/**
 * 解析 VLESS 协议头：
 *   [1 version][16 uuid][1 addonLen N][N addon][1 cmd][2 port][1 addrType][地址][负载...]
 * addrType: 1=IPv4(4), 2=域名(1 长度 + N), 3=IPv6(16)
 * cmd: 1=TCP, 2=UDP
 */
function parseVlessHeader(data: Uint8Array): ParsedVless | null {
  const length = data.byteLength;
  if (length < 24) return null;
  const version = data[0];
  if (!uuidMatch(data, 1, USER_UUID)) return null;

  const optLen = data[17];
  const cmdIndex = 18 + optLen;
  if (length < cmdIndex + 4) return null;

  const cmd = data[cmdIndex];
  let isUDP = false;
  if (cmd === 1) isUDP = false;
  else if (cmd === 2) isUDP = true;
  else return null;

  const portIdx = cmdIndex + 1;
  const port = (data[portIdx] << 8) | data[portIdx + 1];
  const addressType = data[portIdx + 2];
  let addrValIdx = portIdx + 3;
  let addrLen = 0;
  let hostname = '';

  switch (addressType) {
    case 1: // IPv4
      addrLen = 4;
      if (length < addrValIdx + addrLen) return null;
      hostname = `${data[addrValIdx]}.${data[addrValIdx + 1]}.${data[addrValIdx + 2]}.${data[addrValIdx + 3]}`;
      break;
    case 2: // 域名
      if (length < addrValIdx + 1) return null;
      addrLen = data[addrValIdx];
      addrValIdx += 1;
      if (length < addrValIdx + addrLen) return null;
      hostname = textDecoder.decode(data.subarray(addrValIdx, addrValIdx + addrLen));
      break;
    case 3: // IPv6
      addrLen = 16;
      if (length < addrValIdx + addrLen) return null;
      const ipv6: string[] = [];
      for (let i = 0; i < 8; i++) {
        const base = addrValIdx + i * 2;
        ipv6.push(((data[base] << 8) | data[base + 1]).toString(16));
      }
      hostname = ipv6.join(':');
      break;
    default:
      return null;
  }
  if (!hostname) return null;

  const rawIndex = addrValIdx + addrLen;
  return { version, hostname, port, isUDP, rawData: data.subarray(rawIndex) };
}

/** 将各类数据归一为 Uint8Array */
function toUint8Array(data: ArrayBuffer | ArrayBufferView | Uint8Array | Buffer): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return new Uint8Array(0);
}

/**
 * 从请求体（可读流）中按需读取，直到能完整解析出 VLESS 协议头。
 * 返回解析结果与剩余未消费的缓冲；流中后续数据由调用者继续读取。
 */
async function readVlessHeader(req: NextApiRequest): Promise<{ parsed: ParsedVless; leftover: Uint8Array } | null> {
  return new Promise((resolve, reject) => {
    let chunks: Buffer[] = [];
    let totalLen = 0;
    let settled = false;

    const cleanup = () => {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
    };
    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      totalLen += chunk.length;
      // 尝试用当前累计数据解析；协议头长度可变，数据不足时继续等待
      const merged = toUint8Array(Buffer.concat(chunks, totalLen));
      const parsed = parseVlessHeader(merged);
      if (parsed) {
        settled = true;
        cleanup();
        // 暂停读取，剩余的已读数据需要交给后续上行转发
        req.pause();
        resolve({ parsed, leftover: parsed.rawData });
        return;
      }
      // 协议头过长，判定为非法
      if (totalLen > 1024) {
        settled = true;
        cleanup();
        resolve(null);
      }
    };
    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      // 流结束但协议头仍未解析完整
      const merged = toUint8Array(Buffer.concat(chunks, totalLen));
      const parsed = parseVlessHeader(merged);
      resolve(parsed ? { parsed, leftover: parsed.rawData } : null);
    };
    const onError = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 仅接受 POST（XHTTP 上行）
  if (req.method !== 'POST') {
    res.status(405).setHeader('Allow', 'POST').end('Method Not Allowed');
    return;
  }

  let remote: net.Socket | null = null;
  let closed = false;

  const tearDown = () => {
    if (closed) return;
    closed = true;
    if (remote) {
      try { remote.destroy(); } catch (_) { /* noop */ }
      remote = null;
    }
    if (!res.writableEnded) {
      try { res.end(); } catch (_) { /* noop */ }
    }
  };

  try {
    // 1. 读取并解析 VLESS 协议头
    const headerResult = await readVlessHeader(req);
    if (!headerResult) {
      res.status(400).end('Invalid request');
      return;
    }
    const { parsed, leftover } = headerResult;

    // 本实现仅支持 TCP（cmd=1）；UDP（cmd=2）在 serverless 环境下无原生 UDP 转发能力
    if (parsed.isUDP) {
      res.status(400).end('UDP is not supported');
      return;
    }

    // 2. 写出流式响应头（下行即开始）
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Accel-Buffering', 'no');
    // 立即写出响应头，让下行流尽早建立
    res.flushHeaders?.();

    // 3. 建立到目标的 TCP 连接
    const isIPv6 = parsed.hostname.includes(':');
    remote = net.connect({
      host: parsed.hostname,
      port: parsed.port,
      family: isIPv6 ? 6 : 0,
    });

    await new Promise<void>((resolve, reject) => {
      if (!remote) return reject(new Error('socket unavailable'));
      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        remote!.removeListener('connect', onConnect);
        remote!.removeListener('error', onError);
      };
      remote!.once('connect', onConnect);
      remote!.once('error', onError);
    });

    // 4. 先写入协议头之后的首包负载
    if (leftover.byteLength > 0) {
      await new Promise<void>((resolve, reject) => {
        if (!remote) return reject(new Error('socket unavailable'));
        remote.write(Buffer.from(leftover.buffer, leftover.byteOffset, leftover.byteLength), (err) => {
          if (err) reject(err); else resolve();
        });
      });
    }

    // 5. 上行：请求体剩余数据 -> TCP socket
    const resumeUpstream = () => {
      req.on('data', (chunk: Buffer) => {
        if (!remote || remote.destroyed || closed) return;
        const ok = remote.write(chunk);
        if (!ok) {
          req.pause();
          remote.once('drain', () => req.resume());
        }
      });
      req.on('end', () => {
        // 客户端上行结束：半关闭远端写入，等待下行读完
        if (remote && !remote.destroyed) {
          try { remote.end(); } catch (_) { /* noop */ }
        }
      });
      req.on('error', () => tearDown());
      req.resume();
    };

    // 6. 下行：TCP socket -> HTTP 响应（首包前拼接 VLESS 响应头 [version, 0]）
    let respHeaderSent = false;
    const vlessRespHeader = Buffer.from([parsed.version, 0]);

    if (!remote) throw new Error('socket unavailable');
    remote.on('data', (chunk: Buffer) => {
      if (closed || res.writableEnded) return;
      try {
        if (!respHeaderSent) {
          respHeaderSent = true;
          // 拼接 VLESS 响应头 + 当前下行数据
          res.write(Buffer.concat([vlessRespHeader, chunk]));
        } else {
          res.write(chunk);
        }
      } catch (_) {
        tearDown();
      }
    });
    remote.on('end', () => {
      if (closed || res.writableEnded) return;
      // 若远端从未发数据，仍需补发 VLESS 响应头
      if (!respHeaderSent) {
        try { res.write(vlessRespHeader); } catch (_) { /* noop */ }
      }
      try { res.end(); } catch (_) { /* noop */ }
      closed = true;
    });
    remote.on('error', () => tearDown());
    remote.on('close', () => {
      if (!closed) {
        if (!res.writableEnded) {
          try { res.end(); } catch (_) { /* noop */ }
        }
        closed = true;
      }
    });

    // 7. 客户端断开时关闭远端
    res.on('close', () => tearDown());

    // 启动上行转发
    resumeUpstream();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // 连接失败时：若响应头未发送则返回错误码，否则直接结束流
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'text/plain');
      try { res.end(`Bad Gateway: ${message}`); } catch (_) { /* noop */ }
    } else if (!res.writableEnded) {
      try { res.end(); } catch (_) { /* noop */ }
    }
    tearDown();
  }
}

export default handler;
