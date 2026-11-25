// YCsys Antia-Ads 1.4.0: MAIN-world network hook
// Цей файл працює в середовищі сторінки, тому бачить її window.fetch та XMLHttpRequest.
// chrome.runtime тут навмисно НЕ використовується.

(() => {
  "use strict";

  const INSTALL_FLAG = "__YCsysAntiaAdsNetworkHookInstalled";
  const MESSAGE_SOURCE = "YCsysAntiaAdsBridge";

  if (window[INSTALL_FLAG]) return;
  window[INSTALL_FLAG] = true;

  const EMPTY_VAST =
    '<?xml version="1.0" encoding="UTF-8"?><VAST version="3.0"></VAST>';

  // Точні домени, які були у початковому rules.json.
  const BLOCKED_HOST_SUFFIXES = [
    "franecki.net",
    "servetraff.com",
    "pjstat.com",
    "plrjs.org",
    "nogravity.click",
    "bashirian.biz",
    "reichelcormier.bid",
    "proppellerads.ru",
    "adfox.ru",
    "offergate.pro",
    "admixer.net",
    "luckyads.tech",
    "salesdoubler.com.ua",
    "recreativ.com.ua",
    "vast.videocdn.tv",
    "adwadvert.com.ua",
    "trafficdok.com",
    "actionpay.ru",
    "leadgidads.ru",
    "srv224.com",
    "schulist.link",
    "popads.net",
    "mgid.com",
    "doubleclick.net",
    "googlesyndication.com",
    "googleadservices.com"
  ];

  // Мережі, які у початковому списку задавалися через довільну TLD-маску.
  const BLOCKED_DOMAIN_LABELS = [
    "adsterra",
    "hilltopads",
    "exoclick",
    "trafficfactory",
    "juicyads",
    "trafficstars",
    "clickadilla",
    "admaven",
    "rollerads",
    "plugrush",
    "revcontent",
    "taboola",
    "outbrain",
    "videoadex",
    "ad-delivery",
    "propellerads",
    "prebid"
  ];

  const VAST_URL_RE = /(?:^|[/?&=._-])(?:vast|vpaid|pre[-_]?roll|mid[-_]?roll|post[-_]?roll)(?:$|[/?&=._-])/i;
  let isEnabled = false;

  function getUrl(input) {
    try {
      if (input instanceof Request) return input.url;
      if (input instanceof URL) return input.href;
      return new URL(String(input), window.location.href).href;
    } catch {
      return "";
    }
  }

  function isBlockedUrl(input) {
    const urlString = getUrl(input);
    if (!urlString) return false;

    let parsed;
    try {
      parsed = new URL(urlString);
    } catch {
      return false;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

    const host = parsed.hostname.toLowerCase();
    const fixedDomainMatch = BLOCKED_HOST_SUFFIXES.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );

    // Збіг за окремою міткою хоста, а не за довільним фрагментом URL.
    const labelMatch = host.split(".").some((label) =>
      BLOCKED_DOMAIN_LABELS.includes(label)
    );

    const pathMatch = VAST_URL_RE.test(`${parsed.pathname}${parsed.search}`);
    return fixedDomainMatch || labelMatch || pathMatch;
  }

  function isVastUrl(input) {
    const urlString = getUrl(input);
    if (!urlString) return false;
    try {
      const parsed = new URL(urlString);
      return VAST_URL_RE.test(`${parsed.pathname}${parsed.search}`);
    } catch {
      return false;
    }
  }

  // Перехоплення fetch у MAIN world.
  const nativeFetch = window.fetch;
  if (typeof nativeFetch === "function") {
    window.fetch = function (...args) {
      if (isEnabled && args.length > 0 && isBlockedUrl(args[0])) {
        const isVast = isVastUrl(args[0]);
        console.debug("[YCsys Antia-Ads] fetch intercepted:", getUrl(args[0]));

        if (isVast) {
          return Promise.resolve(
            new Response(EMPTY_VAST, {
              status: 200,
              headers: { "Content-Type": "application/xml; charset=utf-8" }
            })
          );
        }

        return Promise.resolve(new Response(null, { status: 204 }));
      }

      return nativeFetch.apply(this, args);
    };
  }

  // Для XHR повертаємо синтетичну порожню відповідь, не відправляючи запит у мережу.
  if (window.XMLHttpRequest) {
    const xhrPrototype = XMLHttpRequest.prototype;
    const nativeOpen = xhrPrototype.open;
    const nativeSend = xhrPrototype.send;
    const xhrRequests = new WeakMap();

    xhrPrototype.open = function (method, url, async = true, ...rest) {
      const urlString = getUrl(url);
      xhrRequests.set(this, {
        url: urlString,
        async: async !== false
      });
      return nativeOpen.call(this, method, url, async, ...rest);
    };

    xhrPrototype.send = function (body) {
      const request = xhrRequests.get(this);
      if (!isEnabled || !request || !isBlockedUrl(request.url)) {
        return nativeSend.call(this, body);
      }

      const xhr = this;
      const isVast = isVastUrl(request.url);
      const responseText = isVast ? EMPTY_VAST : "";
      const contentType = isVast ? "application/xml; charset=utf-8" : "text/plain; charset=utf-8";
      const responseStatus = isVast ? 200 : 204;
      let readyState = 1;
      let parsedXml = null;

      if (isVast) {
        try {
          parsedXml = new DOMParser().parseFromString(EMPTY_VAST, "application/xml");
        } catch {
          parsedXml = null;
        }
      }

      function defineGetter(name, getter) {
        try {
          Object.defineProperty(xhr, name, {
            configurable: true,
            get: getter
          });
        } catch {
          // Якщо браузер не дозволяє перекрити конкретний атрибут, решта відповіді все одно відпрацює.
        }
      }

      defineGetter("readyState", () => readyState);
      defineGetter("status", () => (readyState === 4 ? responseStatus : 0));
      defineGetter("statusText", () => (readyState === 4 ? (isVast ? "OK" : "No Content") : ""));
      defineGetter("responseURL", () => request.url);
      defineGetter("responseText", () => responseText);
      defineGetter("responseXML", () => parsedXml);
      defineGetter("response", () => {
        switch (xhr.responseType) {
          case "json":
            return null;
          case "document":
            return parsedXml;
          case "arraybuffer":
            return new ArrayBuffer(0);
          case "blob":
            return new Blob([], { type: contentType });
          default:
            return responseText;
        }
      });

      try {
        Object.defineProperty(xhr, "getResponseHeader", {
          configurable: true,
          value: (name) => {
            if (readyState !== 4 || typeof name !== "string") return null;
            return name.toLowerCase() === "content-type" ? contentType : null;
          }
        });
        Object.defineProperty(xhr, "getAllResponseHeaders", {
          configurable: true,
          value: () =>
            readyState === 4
              ? `content-type: ${contentType}\r\ncontent-length: ${responseText.length}\r\n`
              : ""
        });
      } catch {
        // Не критично для більшості VAST-запитів.
      }

      function dispatch(type) {
        try {
          xhr.dispatchEvent(
            new ProgressEvent(type, {
              lengthComputable: true,
              loaded: responseText.length,
              total: responseText.length
            })
          );
        } catch {
          xhr.dispatchEvent(new Event(type));
        }
      }

      function completeRequest() {
        dispatch("loadstart");
        readyState = 2;
        dispatch("readystatechange");
        readyState = 3;
        dispatch("readystatechange");
        readyState = 4;
        dispatch("readystatechange");
        dispatch("load");
        dispatch("loadend");
        console.debug("[YCsys Antia-Ads] XHR intercepted:", request.url);
      }

      if (request.async) {
        window.setTimeout(completeRequest, 0);
        return undefined;
      }

      completeRequest();
      return undefined;
    };
  }

  // MAIN-world не має доступу до chrome.runtime. Стан отримує від content.js.
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    const data = event.data;
    if (
      !data ||
      data.source !== MESSAGE_SOURCE ||
      data.type !== "SET_ENABLED"
    ) {
      return;
    }

    isEnabled = data.enabled === true;
  });
})();
