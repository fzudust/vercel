const loaded = {};

export default function loadjs(url, options = {}, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (!options.reload && loaded[url]) {
    return loaded[url];
  }

  const loadP = new Promise((resolve, reject) => {
    options = options || {};

    var head = document.getElementsByTagName('head')[0] || document.documentElement,
      script = document.createElement('script'),
      done = false;
    script.src = url;
    if (options.charset) {
      script.charset = options.charset;
    }
    if ("async" in options) {
      script.async = options["async"] || "";
    }
    script.onload = script.onreadystatechange = function () {
      if (!done && (!this.readyState || this.readyState == "loaded" || this.readyState == "complete")) {
        done = true;

        resolve();
        script.onerror = script.onload = script.onreadystatechange = null;
        head.removeChild(script);
      }
    };
    script.onerror = function () {
      done = true;

      delete loaded[url];

      reject();
      script.onerror = script.onload = script.onreadystatechange = null;
      head.removeChild(script);
    };
    head.insertBefore(script, head.firstChild);
  });

  callback && loadP.then(callback);

  loaded[url] = loadP;

  return loadP;
}
