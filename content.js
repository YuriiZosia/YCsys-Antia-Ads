// YCsys Antia-Ads 1.4.0: ISOLATED content script
// Тут залишаємо chrome.runtime та роботу з DOM. Мережеві хуки винесені в page-network.js.

(() => {
  "use strict";

  const BRIDGE_SOURCE = "YCsysAntiaAdsBridge";
  const INITIALIZED_FLAG = "__YCsysAntiaAdsInitialized";

  if (window[INITIALIZED_FLAG]) return;
  window[INITIALIZED_FLAG] = true;

  function setMainNetworkEnabled(enabled) {
    // Подія переходить у MAIN-world до page-network.js.
    window.postMessage(
      {
        source: BRIDGE_SOURCE,
        type: "SET_ENABLED",
        enabled: enabled === true
      },
      "*"
    );
  }

  chrome.runtime.sendMessage({ method: "getStatus" }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("[YCsys Antia-Ads] Не вдалося отримати стан:", chrome.runtime.lastError.message);
      setMainNetworkEnabled(false);
      return;
    }

    if (!response || response.status !== true) {
      setMainNetworkEnabled(false);
      console.log("[YCsys Antia-Ads] Розширення на паузі.");
      return;
    }

    setMainNetworkEnabled(true);
    initAntiaAds();
  });

  function initAntiaAds() {
    console.log("[YCsys Antia-Ads] Захист активовано: DNR + MAIN-world network + DOM.");

    const CONFIG = {
      adSelectors: [
        ".pjs-vast-ad-info",
        ".video-ad-label",
        ".pjs-ad-skip-button",
        '[id*="vast"]',
        '[class*="vast-ad"]',
        '[class*="vast-"]',
        '[class*="ima-ad"]',
        ".ima-container",
        ".ima-ad-container",
        '[class*="ad-"]',
        '[id*="ad-"]',
        ".ad",
        ".ads",
        ".ad-container",
        ".ad-player",
        ".video-ad",
        ".ad-video",
        ".ad-unit",
        ".commercial",
        ".ad-label",
        ".ads-label",
        ".advertisement",
        ".ad-banner",
        ".videoAd",
        '[class*="skip-button"]',
        '[class*="skip-ad"]',
        '[class*="ad-skip"]',
        ".skip-ad",
        ".ad-skip",
        ".adSkip",
        ".skipButton",
        '[aria-label*="Skip"]',
        '[title*="Skip ad"]',
        ".jw-ad",
        ".jwplayer .ad",
        ".vjs-ad",
        ".vjs-ad-container",
        ".hls-ad",
        ".preroll",
        ".midroll",
        ".postroll",
        "[data-ad]",
        "[data-ad-type]",
        "[data-advert]",
        ".sponsored-video",
        ".overlay-ad",
        ".video-ads",
        ".ad-overlay"
      ].join(", ")
    };

    let videoTimerId = null;
    let observer = null;
    let lastMovieTime = 0;
    let bufferingTicks = 0;

    function skipAdVideo() {
      const videos = document.querySelectorAll("video");
      const adSelectors =
        '.pjs-vast-ad-info, .video-ad-label, [id*="vast"], [class*="vast-ad"], .pjs-ad-skip-button';
      const isAdContainerVisible = !!document.querySelector(adSelectors);

      videos.forEach((video) => {
        const duration = video.duration;
        const isMovie = Number.isFinite(duration) && duration > 300;

        if (isMovie) {
          if (video.playbackRate > 2.0) {
            video.playbackRate = 1.0;
            video.muted = false;
          }

          if (!video.paused) {
            const timeDiff = video.currentTime - lastMovieTime;

            if (timeDiff >= 0 && timeDiff < 0.2) {
              bufferingTicks++;
            } else {
              bufferingTicks = 0;
            }

            if (bufferingTicks > 6) {
              console.debug("[YCsys Antia-Ads] Виявлено зависання плеєра, пробую мікро-зсув.");
              try {
                video.currentTime += 0.5;
                const skipButton = document.querySelector(
                  '.pjs-ad-skip-button, [class*="skip-button"]'
                );
                if (skipButton) skipButton.click();
              } catch (error) {
                console.debug("[YCsys Antia-Ads] Не вдалося перемістити відео:", error);
              }
              bufferingTicks = 0;
            }
          } else {
            bufferingTicks = 0;
          }

          lastMovieTime = video.currentTime;
          return;
        }

        const isShortAd =
          Number.isFinite(duration) && duration > 0 && duration < 60;

        if (isAdContainerVisible || isShortAd) {
          video.muted = true;
          video.playbackRate = 16.0;

          if (Number.isFinite(duration) && video.currentTime < duration - 0.5) {
            try {
              video.currentTime = duration - 0.3;
            } catch {
              // Плеєр може забороняти переміщення часу.
            }
          }

          const skipButton = document.querySelector(
            '.pjs-ad-skip-button, [class*="skip-button"]'
          );
          if (skipButton) skipButton.click();
        } else if (video.playbackRate > 2.0) {
          video.playbackRate = 1.0;
          video.muted = false;
        }
      });
    }

    function cleanDynamicAds() {
      document
        .querySelectorAll('a, iframe, ins, embed, div[style*="background-image"]')
        .forEach((element) => {
          const source =
            element.href ||
            element.src ||
            element.getAttribute("data-src") ||
            "";

          // Перевіряємо тільки URL з відомими рекламними маркерами.
          if (typeof source === "string" && source) {
            try {
              const parsed = new URL(source, location.href);
              const host = parsed.hostname.toLowerCase();
              const blocked = [
                "franecki.net",
                "servetraff.com",
                "pjstat.com",
                "plrjs.org",
                "nogravity.click",
                "bashirian.biz",
                "reichelcormier.bid",
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
              ].some((domain) => host === domain || host.endsWith(`.${domain}`));

              if (blocked) {
                const container =
                  element.closest(".ad, .ads, .ad-container, [class*='ad-banner']") || element;
                container.remove();
              }
            } catch {
              // Не чіпаємо елементи з некоректними або нестандартними URL.
            }
          }
        });

      document
        .querySelectorAll('[id*="branding"], [class*="branding"], [id*="banner"]')
        .forEach((element) => {
          const html = element.innerHTML || "";
          if (html.includes("schulist") || html.includes("getter")) {
            element.remove();
          }
        });

      if (document.body) {
        document.body.style.marginTop = "0";
        document.body.style.paddingTop = "0";
      }
    }

    function injectStyles() {
      if (document.getElementById("yc-antia-styles")) return;

      const style = document.createElement("style");
      style.id = "yc-antia-styles";
      style.textContent = `
        .pjs-vast-ad-container, [id*="vast"], [class*="vast"], .video-ad-label,
        #rezka-sidebar-ads, .b-ads_ua, [stats-invp], .ads-partners,
        div[style*="z-index: 2147483647"],
        div[style*="position: fixed"][style*="bottom: 0"],
        iframe[src*="getter"], iframe[src*="srv224"], iframe[src*="schulist"],
        ins.adsbygoogle, .ad-box, .ad-container, .ad-overlay {
          display: none !important;
          height: 0 !important;
          width: 0 !important;
          visibility: hidden !important;
        }
        body[style*="background-image"], body[style*="background: url"] {
          background: #000 !important;
        }
      `;

      (document.head || document.documentElement).appendChild(style);
    }

    function initDOMProtection() {
      injectStyles();
      cleanDynamicAds();

      // Один цикл перевірки замість двох паралельних таймерів.
      if (videoTimerId === null) {
        videoTimerId = window.setInterval(skipAdVideo, 500);
      }

      if (!observer && document.documentElement) {
        let cleanupScheduled = false;
        observer = new MutationObserver(() => {
          if (cleanupScheduled) return;
          cleanupScheduled = true;

          window.setTimeout(() => {
            cleanupScheduled = false;
            cleanDynamicAds();
          }, 150);
        });

        observer.observe(document.documentElement, {
          childList: true,
          subtree: true
        });
      }

      console.log("[YCsys Antia-Ads] DOM-захист активовано.");
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initDOMProtection, { once: true });
    } else {
      initDOMProtection();
    }
  }
})();
