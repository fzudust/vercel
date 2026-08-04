/**
 * /api/xhttp 路由端到端测试
 *
 * 覆盖 VLESS + XHTTP (stream-one) 代理的核心场景，与实现验证时的测试一一对应：
 *   1. GET 请求被拒绝（仅接受 POST）
 *   2. 无效请求体（无法解析出 VLESS 协议头）返回 400
 *   3. 错误 UUID 认证被拒绝返回 400
 *   4. 合法 VLESS 请求成功代理：收到 [version,0] 响应头 + 目标站点真实响应
 *
 * 运行方式：
 *   pnpm test            # 推荐方式
 *   node --test test/    # 直接用 node 内置 test runner
 *
 * 测试会自动启动一个本地 Next.js dev server（默认 3939 端口），结束自动清理。
 * 依赖：仅 Node 内置模块 + 项目 dev server，无需额外测试框架。
 */

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { buildVlessRequest, buildHttpRequestPayload } = require('./helpers/vless');

// 与 pages/api/xhttp.ts 中未配置 UUID 时的默认值保持一致
const UUID = 'd342d11e-d424-4583-b36e-524ab1f0afa4';
const HOST = '127.0.0.1';
const PORT = Number(process.env.XHTTP_TEST_PORT) || 3939;
const BASE = `http://${HOST}:${PORT}`;

let devServer = null;

/** 启动 Next.js dev server 并等待就绪 */
function startDevServer() {
  return new Promise((resolve, reject) => {
    devServer = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const onErr = (err) => reject(new Error(`dev server spawn failed: ${err.message}`));
    devServer.once('error', onErr);

    // 轮询根路径直到就绪
    const start = Date.now();
    const probe = () => {
      const r = http.get(`${BASE}/`, (res) => {
        res.destroy();
        if (res.statusCode) {
          devServer.removeListener('error', onErr);
          resolve();
        } else {
          retry();
        }
      });
      r.on('error', retry);
      r.setTimeout(2000, () => { r.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - start > 60000) {
        reject(new Error('dev server did not become ready in 60s'));
        return;
      }
      setTimeout(probe, 500);
    };
    retry();
  });
}

/** 停止 dev server */
function stopDevServer() {
  if (!devServer) return Promise.resolve();
  return new Promise((resolve) => {
    devServer.once('exit', resolve);
    devServer.kill('SIGTERM');
    setTimeout(() => {
      try { devServer.kill('SIGKILL'); } catch (_) { /* noop */ }
      resolve();
    }, 5000);
  });
}

/** 发送一个 POST 请求，返回 { statusCode, headers, body } */
function postXhttp(body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${BASE}/api/xhttp`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': body.length,
          Connection: 'close',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }),
        );
      },
    );
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(new Error('request timeout')); });
    req.write(body);
    req.end();
  });
}

test('xhttp 代理：端到端测试', { concurrency: false }, async (t) => {
  // 共用一个 dev server：整个套件启动一次
  await t.test('启动 dev server', async () => {
    await startDevServer();
    // 预热 /api/xhttp 路由（首次编译）
    await new Promise((r) => http.get(`${BASE}/api/xhttp`, () => r()).on('error', r));
  });

  await t.test('GET /api/xhttp 应返回 405', async () => {
    const res = await new Promise((resolve, reject) => {
      const r = http.get(`${BASE}/api/xhttp`, (resp) => {
        const chunks = [];
        resp.on('data', (c) => chunks.push(c));
        resp.on('end', () =>
          resolve({ statusCode: resp.statusCode, body: Buffer.concat(chunks).toString('utf8') }),
        );
      });
      r.on('error', reject);
      r.setTimeout(10000, () => { r.destroy(new Error('timeout')); });
    });
    assert.strictEqual(res.statusCode, 405);
  });

  await t.test('POST 无效请求体（无法解析 VLESS 头）应返回 400', async () => {
    const res = await postXhttp(Buffer.from('garbage', 'ascii'));
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.body.toString('utf8'), /Invalid request/);
  });

  await t.test('POST 错误 UUID 应被认证拒绝返回 400', async () => {
    const wrongUuid = 'aaaaaaaa-bbbb-4bbb-8ccc-dddddddddddd';
    const body = buildVlessRequest({
      uuid: wrongUuid,
      host: 'example.com',
      port: 80,
      payload: buildHttpRequestPayload('example.com'),
    });
    const res = await postXhttp(body);
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.body.toString('utf8'), /Invalid request/);
  });

  await t.test('合法 VLESS 请求应成功代理到目标站点', async () => {
    const body = buildVlessRequest({
      uuid: UUID,
      host: 'example.com',
      port: 80,
      payload: buildHttpRequestPayload('example.com'),
    });
    const res = await postXhttp(body);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-type'], 'application/octet-stream');

    // 响应体前两字节为 VLESS 响应头 [version, 0]
    assert.strictEqual(res.body[0], 0, 'VLESS 响应头 version 应为 0');
    assert.strictEqual(res.body[1], 0, 'VLESS 响应头 addon length 应为 0');

    // 之后应是 example.com 的真实 HTTP 响应
    const payload = res.body.slice(2).toString('utf8');
    assert.match(payload, /HTTP\/1\.1/, '应包含目标站点 HTTP 响应行');
    assert.match(payload, /Example Domain/, '应包含 example.com 页面内容');
  });

  // 套件结束清理
  await t.test('停止 dev server', async () => {
    await stopDevServer();
  });
});
