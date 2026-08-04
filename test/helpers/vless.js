/**
 * VLESS 协议头构造工具 —— 供 xhttp 代理测试使用
 *
 * VLESS 协议头格式：
 *   [1 version][16 uuid][1 addonLen N][N addon][1 cmd][2 port][1 addrType][地址][payload...]
 *   addrType: 1=IPv4(4), 2=域名(1 长度 + N), 3=IPv6(16)
 *   cmd: 1=TCP, 2=UDP
 */

/** 将 UUID 字符串转为 16 字节 Buffer */
export function uuidToBytes(uuid) {
  const clean = uuid.replace(/-/g, '');
  if (clean.length !== 32) throw new Error(`invalid uuid: ${uuid}`);
  const bytes = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * 构造一个 VLESS 请求体（协议头 + payload）
 * @param {object} opts
 * @param {string} opts.uuid       认证 UUID
 * @param {string} opts.host       目标主机（域名 / IPv4 / IPv6）
 * @param {number} opts.port       目标端口
 * @param {Buffer} [opts.payload]  协议头之后的原始 TCP 负载
 * @param {number} [opts.version]  VLESS 版本，默认 0
 * @param {number} [opts.cmd]      命令：1=TCP（默认）, 2=UDP
 * @param {boolean} [opts.ipv6]    host 为 IPv6 时需置 true（强制 addrType=3）
 * @returns {Buffer}
 */
export function buildVlessRequest({ uuid, host, port, payload, version = 0, cmd = 1, ipv6 = false }) {
  const uuidBytes = uuidToBytes(uuid);
  const portBuf = Buffer.alloc(2);
  portBuf.writeUInt16BE(port, 0);

  let addrType;
  let addrBuf;
  if (ipv6) {
    addrType = 3;
    // 将 IPv6 字符串展开为 16 字节
    const groups = host.split(':');
    if (groups.length !== 8) throw new Error(`simple ipv6 builder expects 8 groups: ${host}`);
    addrBuf = Buffer.alloc(16);
    for (let i = 0; i < 8; i++) {
      addrBuf.writeUInt16BE(parseInt(groups[i], 16), i * 2);
    }
  } else if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    addrType = 1;
    addrBuf = Buffer.alloc(4);
    host.split('.').forEach((o, i) => { addrBuf[i] = Number(o); });
  } else {
    addrType = 2; // 域名
    const domainBuf = Buffer.from(host, 'ascii');
    addrBuf = Buffer.concat([Buffer.from([domainBuf.length]), domainBuf]);
  }

  const header = Buffer.concat([
    Buffer.from([version]),
    uuidBytes,
    Buffer.from([0]), // addonLen = 0
    Buffer.from([cmd]),
    portBuf,
    Buffer.from([addrType]),
    addrBuf,
  ]);

  return payload && payload.length ? Buffer.concat([header, payload]) : header;
}

/** 构造一条 HTTP/1.1 请求文本作为 VLESS 负载（用于测试 TCP 转发） */
export function buildHttpRequestPayload(host, { path = '/', close = true } = {}) {
  const lines = [
    `GET ${path} HTTP/1.1`,
    `Host: ${host}`,
    `User-Agent: xhttp-test/1.0`,
  ];
  if (close) lines.push('Connection: close');
  return Buffer.from(lines.join('\r\n') + '\r\n\r\n', 'ascii');
}
