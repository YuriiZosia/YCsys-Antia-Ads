// === YCsys Antia-Ads: Content Wrapper (PRO Version) ===

chrome.runtime.sendMessage({ method: "getStatus" }, (response) => {
    // Якщо сталася помилка зв'язку або статус false - виходимо і нічого не блокуємо
    if (chrome.runtime.lastError || !response || response.status === false) {
        console.log("YCsys: Antia-Ads на паузі.");
        return;
    }
    initAntiaAds();
});

function initAntiaAds() {
    console.log('YCsys Antia-Ads: Захист активовано. Рівень: PRO.');

    /**
     * СПИСОК БЛОКУВАННЯ
     * Додавай сюди нові домени або ключові слова "в стовпчик"
     */
    const AD_KEYWORDS = [
        'vast',
        'servetraff',
        'plrjs',
        'franecki',
        'pjstat',
        'nogravity',
        'pre-roll',
        'vpaid',
        'bashirian',
        'getter',   // Покриє .cfd та .fun
        'srv224',
        'schulist', // Брендування та фонова реклама
        'iframeHS'  // Динамічні фрейми
    ];

    const emptyVast = `<?xml version="1.0" encoding="UTF-8"?><VAST version="2.0"></VAST>`;

    /**
     * Перевірка, чи URL містить хоча б одне слово зі списку блокування
     */
    const isAdUrl = (url) => {
        if (typeof url !== 'string') return false;
        return AD_KEYWORDS.some(keyword => url.toLowerCase().includes(keyword.toLowerCase()));
    };

    // --- Перехоплення Fetch ---
    const { fetch: originalFetch } = window;
    window.fetch = async (...args) => {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;

        if (isAdUrl(url)) {
            console.log('YCsys: [Fetch] Підмінено на порожній VAST:', url);
            return new Response(emptyVast, {
                status: 200,
                headers: { 'Content-Type': 'text/xml' }
            });
        }
        return originalFetch(...args);
    };

    // --- Перехоплення XMLHttpRequest ---
    const rawOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        if (isAdUrl(url)) {
            console.log('YCsys: [XHR] Блоковано рекламу:', url);
            return rawOpen.call(this, method, 'data:text/xml;charset=utf-8,' + encodeURIComponent(emptyVast));
        }
        return rawOpen.apply(this, arguments);
    };

    // --- Авто-пропуск відео-реклами ---
    const skipAdVideo = () => {
        const videos = document.querySelectorAll('video');
        videos.forEach(v => {
            const isAdContainerVisible = document.querySelector('.pjs-vast-ad-info, .video-ad-label, [id*="vast"], [class*="vast-ad"]');

            if (isAdContainerVisible || (v.duration > 0 && v.duration < 60)) {
                v.muted = true;
                v.playbackRate = 16.0;
                if (isFinite(v.duration) && v.currentTime < v.duration) {
                    v.currentTime = v.duration - 0.1;
                }
            }
        });
    };
    setInterval(skipAdVideo, 500);

    // --- Розумний сканер динамічних банерів (MutationObserver) ---
    const cleanDynamicAds = () => {
        // 1. Пошук по посиланнях, фреймах та блоках з фоном
        const targets = document.querySelectorAll('a, iframe, ins, embed, div[style*="background-image"]');
        targets.forEach(el => {
            const source = el.href || el.src || (el.style && el.style.backgroundImage) || "";
            if (isAdUrl(source)) {
                const container = el.closest('div') || el;
                container.remove();
            }
        });

        // 2. Специфічна зачистка контейнерів брендування
        const brandingContainers = document.querySelectorAll('[id*="branding"], [class*="branding"], [id*="banner"]');
        brandingContainers.forEach(container => {
            if (container.innerHTML.includes('schulist') || container.innerHTML.includes('getter')) {
                container.remove();
            }
        });

        // 3. Виправлення зсуву сторінки (якщо реклама відсунула контент вниз)
        if (document.body && (document.body.style.marginTop || document.body.style.paddingTop)) {
            document.body.style.marginTop = '0px';
            document.body.style.paddingTop = '0px';
        }
    };

    // --- Косметичні CSS фільтри (Версія MAX Protection) ---
    const injectStyles = () => {
        const target = document.head || document.documentElement || document.body;
        if (!target) {
            requestAnimationFrame(injectStyles);
            return;
        }

        // Захист від дублювання
        if (document.getElementById('yc-antia-styles')) return;

        const style = document.createElement('style');
        style.id = 'yc-antia-styles';
        style.innerHTML = `
            /* Статичні блоки */
            .pjs-vast-ad-container, [id*="vast"], [class*="vast"], .video-ad-label,
            #rezka-sidebar-ads, .b-ads_ua, [stats-invp], .ads-partners,
            
            /* Динамічні плаваючі вікна (казино) */
            div[style*="z-index: 2147483647"], 
            div[style*="position: fixed"][style*="bottom: 0"],
            
            /* Фрейми паразитів */
            iframe[src*="getter"], iframe[src*="srv224"], iframe[src*="schulist"], iframe[id*="google_ads"],
            
            /* Пусті залишки */
            ins.adsbygoogle, .ad-box, .ad-container { 
                display: none !important; 
                pointer-events: none !important; 
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                visibility: hidden !important;
            }

            /* Видалення фонового брендування */
            body[style*="background-image"], body[style*="background: url"] {
                background-image: none !important;
                background: none !important;
                background-color: #000 !important;
            }
        `;
        target.appendChild(style);
    };

    // --- Ініціалізація та спостереження за DOM ---
    const initDOMProtection = () => {
        injectStyles();
        cleanDynamicAds();

        // Запускаємо сканер, який слідкує за новими елементами
        const observer = new MutationObserver(() => {
            cleanDynamicAds();
        });
        
        if (document.body || document.documentElement) {
            observer.observe(document.body || document.documentElement, {
                childList: true,
                subtree: true
            });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDOMProtection);
        // Спроба вставити стилі якомога раніше
        const earlyObserver = new MutationObserver((mutations, obs) => {
            if (document.head || document.documentElement) {
                injectStyles();
                obs.disconnect();
            }
        });
        earlyObserver.observe(document.documentElement, { childList: true });
    } else {
        initDOMProtection();
    }
}