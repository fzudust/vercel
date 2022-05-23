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

// https://www.jsdelivr.com/
const version = '6.5.3';
const cdn = `https://cdn.jsdelivr.net/npm/`;
const swjs = `${cdn}workbox-sw@${version}/build/workbox-sw.js`;
self.importScripts(swjs);
const dev = false;
workbox.setConfig({
  debug: dev,
  modulePathCb(e) {
    console.log('workbox-module:', e);
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

const filter = (url, arr) => {
  const filter = arr.filter(regexp => url.href.match(regexp));
  return filter.length > 0
}

const { registerRoute, Route } = workbox.routing;
const { CacheFirst } = workbox.strategies;
const { CacheableResponsePlugin } = workbox.cacheableResponse;

const cacheRoute = new Route(({ url }) => {
  return filter(url, [
    /.+(?:\.js|\.css)$/ig,
    /.+(?:\.ico|\.svg|\.woff|\.png|\.jpg|\.jpeg|\.webp)$/ig,
    /.+iframe\.html/ig,
  ])
}, new CacheFirst({
  cacheName: 'cache',
  plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
}));

registerRoute(cacheRoute);
