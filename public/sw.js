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

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
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
const { CacheableResponsePlugin } = workbox.cacheable_response;

// 跨源静态资源（CSS / JS / 图片 / 字体）走 CacheFirst。
// proxy 注入了 <base href="外部origin">，iframe 内相对资源会解析到外部源，
// 这些请求仍由被 SW 控制的 iframe 发起，因此能被拦截并缓存。
// 跨源 no-cors 响应为 opaque（status 0），CacheableResponsePlugin 显式允许 [0, 200]。
const staticAssets = new CacheFirst({
  cacheName: 'static-assets',
  plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
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
