// === YCsys Antia-Ads: Ultimate Version (Modular) ===

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
    // Додай наступний домен тут:
    // 'new-ads-domain.com',
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
        // Спрямовуємо на безпечний data-uri
        return rawOpen.call(this, method, 'data:text/xml;charset=utf-8,' + encodeURIComponent(emptyVast));
    }
    return rawOpen.apply(this, arguments);
};

// --- Авто-пропуск відео-реклами ---
const skipAdVideo = () => {
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
        // Ознаки реклами: спеціальні класи плеєра або коротка тривалість
        const isAdContainerVisible = document.querySelector('.pjs-vast-ad-info, .video-ad-label, [id*="vast"], [class*="vast-ad"]');

        if (isAdContainerVisible || (v.duration > 0 && v.duration < 60)) {
            v.muted = true;
            v.playbackRate = 16.0;
            if (isFinite(v.duration) && v.currentTime < v.duration) {
                // Перемотуємо майже в самий кінець
                v.currentTime = v.duration - 0.1;
            }
        }
    });
};

// Запуск перевірки плеєра кожні 500мс
setInterval(skipAdVideo, 500);

// --- Косметичні CSS фільтри ---
const injectStyles = () => {
    if (!document.head) return;
    const style = document.createElement('style');
    style.innerHTML = `
        .pjs-vast-ad-container, 
        [id*="vast"], 
        [class*="vast"],
        .video-ad-label,
        #rezka-sidebar-ads { 
            display: none !important; 
            pointer-events: none !important; 
            opacity: 0 !important;
        }
    `;
    document.head.appendChild(style);
};

// Запуск стилів
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStyles);
} else {
    injectStyles();
}

console.log('YCsys Antia-Ads: Модульна версія активна. Захист активовано.');