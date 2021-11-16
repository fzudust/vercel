import axios from 'axios';

const onImgError = (e, obj) => {
  const img = e.target;
  if (img.src === obj.icon) {
    const url = new URL(obj.icon);
    const src = url.protocol + "//" + url.host.slice(url.host.indexOf('.') + 1) + '/favicon.ico';
    img.src = src;
  } else {
    img.src = '/rss.png';
  }
}

function getIcon(url) {
  let icon;
  try {
    const u = new URL(url);
    icon = u.origin + '/favicon.ico';
  } catch (e) {
    console.error(e);
    icon = '';
  }
  return icon;
}
function uniqueArr(arr, key) {
  const newArr = [];
  const hash = {};
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const itemKey = item[key];
    if (!hash[itemKey]) {
      newArr.push(item);
      hash[itemKey] = true;
    }
  }
  return newArr;
}
function mergeRss(now, old) {
  const allItems = now.items.concat(old.items)
  const result = []
  const set = new Set();
  const startTime = Date.now();
  for (let item of allItems) {
    if (!set.has(item.id)) {
      result.push(item)
      set.add(item.id)
    }
  }
  console.log('mergeTime:', Date.now() - startTime);
  now.items = result;
  return
  /* const diff = [];
  const oldFirst = old.items[0];
  const ids = old.items.map(item => item.id);
  if (!oldFirst) return;
  for (let i = 0; i < now.items.length; i++) {
    const item = now.items[i];
    if (item.id !== oldFirst.id) {
      if (!ids.includes(item.id)) {
        diff.push(item);
      }
    } else {
      now.items = diff.concat(old.items);
      return
    }
  }
  now.items = diff.concat(old.items); */
  /* for (let i = 0; i < old.items.length; i++) {
    const item = old.items[i];
    if (now.items.findIndex(i => i.id === item.id || i.link === item.link) < 0) {
      now.items.push(item);
    }
    // if (now.items.length >= 200) return
  } */
}
function filterList(arr) {
  const list = [];
  for (let i = 0; i < arr.items.length; i++) {
    const obj = arr.items[i];
    if (!list.map(o => o.link).includes(obj.link)) {
      list.push(obj);
    }
  }
  arr.items = list;
  return arr;
}
const charFilter = (html) => {
  return html.replace(/&lt;|&gt;|&amp;|<!\[CDATA\[|\]\]>|<script>|<\/script>|<style>|<\/style>|<link/ig, match => {
    const map = {
      '&lt;': '<',
      '&gt;': '>',
      '&amp;': '&',
      '<script>': '&lt;script&gt;',
      '</script>': '&lt;/script&gt;',
      '<style>': '&lt;style&gt;',
      '</style>': '&lt;/style&gt;',
      '<link': '&lt;link',
    };
    return map[match] || '';
  });
}
function getItemsFrommRss(docList) {
  return Array.from(docList).map(item => {
    try {
      const obj = {
        title: charFilter(item.querySelector('title').innerHTML),
        link: charFilter(item.querySelector('link').innerHTML),
        description: charFilter(item.querySelector('description').innerHTML),
        id: item.querySelector('guid') ? item.querySelector('guid').innerHTML : item.querySelector('link').innerHTML,
        updateTime: charFilter(item.querySelector('pubDate') ? item.querySelector('pubDate').innerHTML : ''),
      }
      return obj
    } catch (e) {
      console.error(e, item);
      return {
        title: '',
        link: '',
        description: '',
        id: '',
        updateTime: '',
      }
    }
  }).filter(item => !!item.id)
}

function getItemsFromFeed(docList) {
  return Array.from(docList).map(item => {
    try {
      const obj = {
        title: charFilter(item.querySelector('title').innerHTML),
        link: item.querySelector('link').getAttribute('href'),
        description: item.querySelector('content').innerHTML,
        id: item.querySelector('id').innerHTML,
        updateTime: charFilter(item.querySelector('updated').innerHTML),
      }
      return obj;
    } catch (e) {
      console.error(e, item);
      return {
        title: '',
        link: '',
        description: '',
        id: '',
        updateTime: '',
      }
    }
  }).filter(item => !!item.id)
}
const getRss = async (url) => {
  if (url === '') {
    alert('请输入地址');
    return;
  }
  try {
    const res = await axios.get('/api/proxy?url=' + url);
    const domParser = new DOMParser();
    const doc = domParser.parseFromString(res.data, 'text/xml');
    const rss = {
      updateTime: Date.now(),
      url,
      title: charFilter(doc.querySelector('title').innerHTML),
      items: [],
      icon: '',
      query: '',
    };
    if (doc.firstElementChild.tagName === 'rss') {
      rss.items = getItemsFrommRss(doc.querySelectorAll('item'));
    } else {
      rss.items = getItemsFromFeed(doc.querySelectorAll('entry'));
    }
    rss.items = uniqueArr(rss.items, 'id');
    return rss;
  } catch (error) {
    console.error(error);
    return null;
  }
}
export {
  getRss,
  mergeRss,
  charFilter,
  uniqueArr,
  onImgError,
  getIcon,
  filterList,
}
