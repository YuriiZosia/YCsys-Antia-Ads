// === YCsys Antia-Ads: Content Wrapper (PRO+ Version 2026) ===

chrome.runtime.sendMessage({ method: "getStatus" }, (response) => {
    if (chrome.runtime.lastError || !response || response.status === false) {
        console.log("YCsys: Antia-Ads на паузі.");
        return;
    }
    initAntiaAds();
});

function initAntiaAds() {
    if (window.YCsysAntiaAdsInitialized) return;
    window.YCsysAntiaAdsInitialized = true;

    console.log('🚀 YCsys Antia-Ads: Захист активовано. Рівень: PRO+');

    /** ===================== НАЛАШТУВАННЯ ===================== */
    const CONFIG = {
        // Мережеве блокування (VAST/VPAID)
        AD_KEYWORDS: [
            'vast', 'servetraff', 'plrjs', 'franecki', 'pjstat', 'nogravity',
            'pre-roll', 'vpaid', 'bashirian', 'getter', 'srv224', 'schulist', 'iframeHS',

            // 2026 актуальні мережі
            'doubleclick', 'googlesyndication', 'googleads', 'google-ima', 'ima',
            'adnxs', 'pubmatic', 'openx', 'rubiconproject', 'rubicon', 'criteo',
            'smartadserver', 'adform', 'yieldmo', 'spotx', 'tremor', 'vidible',
            'brightcove', 'prebid', 'bidder', 'propellerads', 'popads', 'videoadex',
            'adserver', 'adtech', 'adsystem', 'ad-delivery', 'admanager', 'adswizz',
            'mgid', 'revcontent', 'taboola', 'outbrain', 'sponsored', 'preroll',
            'vast-ad', 'vpaid-ad', 'ad-vast', 'ad-vpaid', 'adsterra', 'hilltopads',
            'exoclick', 'trafficfactory', 'juicyads'
        ],

        emptyVast: `<?xml version="1.0" encoding="UTF-8"?><VAST version="2.0"></VAST>`,

        // Селектори для відео-реклами
        adSelectors: [
            '.pjs-vast-ad-info', '.video-ad-label', '.pjs-ad-skip-button',
            '[id*="vast"]', '[class*="vast-ad"]', '[class*="vast-"]', '[class*="ima-ad"]',
            '.ima-container', '.ima-ad-container',
            '[class*="ad-"]', '[id*="ad-"]', '.ad', '.ads', '.ad-container',
            '.ad-player', '.video-ad', '.ad-video', '.ad-unit', '.commercial',
            '.ad-label', '.ads-label', '.advertisement', '.ad-banner', '.videoAd',
            '[class*="skip-button"]', '[class*="skip-ad"]', '[class*="ad-skip"]',
            '.skip-ad', '.ad-skip', '.adSkip', '.skipButton',
            '[aria-label*="Skip"]', '[title*="Skip ad"]',
            '.jw-ad', '.jwplayer .ad', '.vjs-ad', '.vjs-ad-container',
            '.hls-ad', '.brightcove-ad', '.preroll', '.midroll', '.postroll',
            '[data-ad]', '[data-ad-type]', '[data-advert]', '.sponsored-video',
            '.overlay-ad', '.video-ads', '.ad-overlay'
        ].join(', ')
    };

    /** ===================== МЕРЕЖЕВЕ БЛОКУВАННЯ ===================== */
    const isAdUrl = (url) => {
        if (typeof url !== 'string' || url.length < 5) return false;
        const lower = url.toLowerCase();
        return CONFIG.AD_KEYWORDS.some(k => lower.includes(k.toLowerCase()));
    };

    // Fetch
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        let url = args[0];
        if (url instanceof Request) url = url.url;
        if (typeof url === 'string' && isAdUrl(url)) {
            console.log('YCsys [Fetch] ✅ Підмінено VAST:', url);
            return new Response(CONFIG.emptyVast, {
                status: 200,
                headers: { 'Content-Type': 'text/xml' }
            });
        }
        return originalFetch(...args);
    };

    // XMLHttpRequest
    const rawOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        if (typeof url === 'string' && isAdUrl(url)) {
            console.log('YCsys [XHR] ✅ Блоковано:', url);
            return rawOpen.call(this, method, 'data:text/xml;charset=utf-8,' + encodeURIComponent(CONFIG.emptyVast));
        }
        return rawOpen.apply(this, arguments);
    };

    /** ===================== АВТО-ПРОПУСК ВІДЕО ===================== */
    let skipInterval;
    // Змінні для модуля "Дефібрилятор" (додай їх перед функцією skipAdVideo)
    let lastMovieTime = 0;
    let bufferingTicks = 0;

    // --- Авто-пропуск відео-реклами (Версія v1.3.3 із Дефібрилятором) ---
    const skipAdVideo = () => {
        const videos = document.querySelectorAll('video');
        const adSelectors = '.pjs-vast-ad-info, .video-ad-label, [id*="vast"], [class*="vast-ad"], .pjs-ad-skip-button';
        const isAdContainerVisible = !!document.querySelector(adSelectors);

        videos.forEach(v => {
            const duration = v.duration;
            
            // 🛡️ ЗАПОБІЖНИК YCsys: Якщо відео > 5 хв (300с), це точно фільм/серія
            const isMovie = isFinite(duration) && duration > 300;

            if (isMovie) {
                if (v.playbackRate > 2.0) {
                    v.playbackRate = 1.0;
                    v.muted = false;
                }

                // ⚡ YCsys Defibrillator (Захист від нескінченної загрузки мід-ролів)
                if (!v.paused) {
                    const timeDiff = v.currentTime - lastMovieTime;
                    
                    // Якщо за 500мс відео просунулося менше ніж на 0.1с — воно "заїкається" або висить
                    if (timeDiff >= 0 && timeDiff < 0.2) {
                        bufferingTicks++;
                    } else {
                        bufferingTicks = 0; // Відновлюємо лічильник, якщо відео йде нормально
                    }

                    // Якщо плеєр "завис" на 3 секунди (6 тіків по 500мс)
                    if (bufferingTicks > 6) {
                        console.log('YCsys [Defibrillator]: Виявлено зависання плеєра (мід-рол баг). Робимо мікро-зсув...');
                        
                        // Імітуємо клік по повзунку (як ти робив вручну)
                        v.currentTime += 0.5; 
                        
                        // Пробуємо натиснути кнопку пропуску, раптом вона прихована під CSS
                        const skipBtn = document.querySelector('.pjs-ad-skip-button, [class*="skip-button"]');
                        if (skipBtn) skipBtn.click();
                        
                        bufferingTicks = 0; // Скидаємо лічильник, щоб не стрибало постійно
                    }
                } else {
                    bufferingTicks = 0; // Скидаємо, якщо ти сам поставив на паузу (йде заварювати чай)
                }
                lastMovieTime = v.currentTime;
                // -------------------------------------------------------------

                return; // ПРИПИНЯЄМО будь-які дії для цього відео
            }

            // Умова для звичайної короткої відео-реклами
            const isShortAd = isFinite(duration) && duration > 0 && duration < 60;

            if (isAdContainerVisible || isShortAd) {
                v.muted = true;
                v.playbackRate = 16.0;
                
                if (isFinite(duration) && v.currentTime < duration - 0.5) {
                    v.currentTime = duration - 0.3;
                }
                
                const skipButton = document.querySelector('.pjs-ad-skip-button, [class*="skip-button"]');
                if (skipButton) skipButton.click();
            } else {
                if (v.playbackRate > 2.0) {
                    v.playbackRate = 1.0;
                    v.muted = false;
                }
            }
        });
    };

    // Запуск перевірки плеєра кожні 500мс
    setInterval(skipAdVideo, 500);

    // Запуск з requestAnimationFrame (економніше)
    const startVideoSkipper = () => {
        skipAdVideo();
        skipInterval = setTimeout(startVideoSkipper, 420); // ~2.4 рази на секунду — оптимально
    };

    /** ===================== ДИНАМІЧНЕ ЧИЩЕННЯ ===================== */
    const cleanDynamicAds = () => {
        document.querySelectorAll('a, iframe, ins, embed, div[style*="background-image"]').forEach(el => {
            const src = el.href || el.src || el.getAttribute('data-src') || '';
            if (isAdUrl(src)) {
                const container = el.closest('div') || el;
                container.style.display = 'none';
                container.remove();
            }
        });

        // Брендинг
        document.querySelectorAll('[id*="branding"], [class*="branding"], [id*="banner"]').forEach(el => {
            if (el.innerHTML && (el.innerHTML.includes('schulist') || el.innerHTML.includes('getter'))) {
                el.remove();
            }
        });

        // Виправлення зсуву
        if (document.body) {
            document.body.style.marginTop = '0';
            document.body.style.paddingTop = '0';
        }
    };

    /** ===================== CSS ===================== */
    const injectStyles = () => {
        if (document.getElementById('yc-antia-styles')) return;

        const style = document.createElement('style');
        style.id = 'yc-antia-styles';
        style.innerHTML = `
            .pjs-vast-ad-container, [id*="vast"], [class*="vast"], .video-ad-label,
            #rezka-sidebar-ads, .b-ads_ua, [stats-invp], .ads-partners,
            div[style*="z-index: 2147483647"], div[style*="position: fixed"][style*="bottom: 0"],
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
    };

    /** ===================== ІНІЦІАЛІЗАЦІЯ ===================== */
    const initDOMProtection = () => {
        injectStyles();
        cleanDynamicAds();
        startVideoSkipper();

        // MutationObserver
        const observer = new MutationObserver(cleanDynamicAds);
        observer.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true
        });

        console.log('YCsys: Повний захист активовано (мережа + відео + DOM)');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDOMProtection);
    } else {
        initDOMProtection();
    }
}