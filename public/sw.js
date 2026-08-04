self.onerror = function (e) {
  console.error(e);
}
self.addEventListener('push', (event) => {

  const notificationData = event.data.json();
  console.log('收到推送', notificationData);
  const title = notificationData.title;
  // 弹消息框
  event.waitUntil(self.registration.showNotification(title, notificationData));
});
self.addEventListener('notificationclick', (event) => {
  console.log('点击消息框');
  const notification = event.notification;
  notification.close();
  event.waitUntil(
    clients.openWindow(notification.data.url)
  );
});

// 跨源 <img> 是 no-cors 请求，SW 只能对它返回 opaque 响应；
// 返回 basic/default 会被 Chrome 以 ERR_BLOCKED_BY_RESPONSE.NotSameOrigin 拦截。
// 因此 fallback 图片必须以 mode:'no-cors' 拉取并缓存为 opaque 响应。
// opaque 响应对 <img> 仍可渲染（浏览器内核解码，JS 读不到 body）。
const FALLBACK_URL = '/user.png';
const fallbackRequest = () => new Request(FALLBACK_URL, { mode: 'no-cors' });

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open('vercel-fallback-v1');
      const resp = await fetch(fallbackRequest(), { cache: 'reload' });
      // cache.add 会对 status=0 的 opaque 响应 reject，必须用 cache.put；
      // 且 put 存 opaque 时要求 request.mode === 'no-cors'，故用 fallbackRequest()。
      await cache.put(fallbackRequest(), resp);
    } catch (e) {
      console.error('预缓存兜底图片失败', e);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  // 清理旧版本缓存（如之前手写实现遗留的 'cache'），并立即接管客户端
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => !key.startsWith('vercel-'))
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

// https://www.jsdelivr.com/
const version = '7.1.0';
const cdn = `https://cdn.jsdelivr.net/npm/`;
const swjs = `${cdn}workbox-sw@${version}/build/workbox-sw.js`;
self.importScripts(swjs);
const dev = false;
workbox.setConfig({
  debug: dev,
  modulePathCb(e) {
    return `${cdn}${e}@${version}/build/${e}.${dev ? 'dev' : 'prod'}.js`;
  }
});
workbox.core.setCacheNameDetails({
  prefix: 'vercel',
  suffix: 'v1'
});
const otherjs = ['workbox-routing', 'workbox-strategies', 'workbox-cacheable-response'];
otherjs.forEach(function (e) {
  const url = `${cdn}${e}@${version}/build/${e}.${dev ? 'dev' : 'prod'}.js`;
  self.importScripts(url);
})

const { registerRoute } = workbox.routing;
const { CacheFirst } = workbox.strategies;
const { CacheableResponsePlugin } = workbox.cacheableResponse;

const imageExtRegex = /\.(?:ico|svg|png|jpe?g|webp|gif|avif)$/i;

// 缓存未命中且网络拉取失败时，图片 fallback 到兜底图片；非图片资源照常抛错，
// 避免用一张图片顶替 JS/CSS/字体从而破坏页面。
// 必须返回 opaque 响应：跨源 <img> 是 no-cors 请求，SW 返回 basic 响应会被
// Chrome 以 ERR_BLOCKED_BY_RESPONSE.NotSameOrigin 拦截。
const imageFallbackPlugin = {
  async handlerDidError({ request }) {
    if (!imageExtRegex.test(request.url)) {
      throw new Error('No response found; non-image asset has no fallback.');
    }
    const cache = await caches.open('vercel-fallback-v1');
    const req = fallbackRequest();
    return (await cache.match(req))
      || fetch(req, { cache: 'reload' });
  },
};

// 跨源静态资源（CSS / JS / 图片 / 字体）走 CacheFirst。
// proxy 注入了 <base href="外部origin">，iframe 内相对资源会解析到外部源，
// 这些请求仍由被 SW 控制的 iframe 发起，因此能被拦截并缓存。
// 跨源 no-cors 响应为 opaque（status 0），CacheableResponsePlugin 显式允许 [0, 200]。
const staticAssets = new CacheFirst({
  cacheName: 'static-assets',
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    imageFallbackPlugin,
  ],
});

registerRoute(
  ({ url }) => /\.(?:js|css|ico|svg|png|jpe?g|webp|gif|avif|woff2?|ttf|eot|otf)$/i.test(url.href),
  staticAssets
);

// iframe 模板（同源）也缓存
registerRoute(
  ({ url }) => /iframe\.html$/i.test(url.pathname),
  staticAssets
);
