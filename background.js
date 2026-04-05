// === YCsys Antia-Ads: Background Controller (Stable) ===

// Функція для оновлення вигляду меню
function updateMenu(isEnabled) {
  const newTitle = isEnabled ? "Вимкнути Antia-Ads (Пауза)" : "Увімкнути Antia-Ads";
  chrome.contextMenus.update("toggle-antia", { title: newTitle });
}

// Ініціалізація при встановленні
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ isEnabled: true }); // По дефолту увімкнено
  chrome.contextMenus.create({
    id: "toggle-antia",
    title: "Вимкнути Antia-Ads (Пауза)",
    contexts: ["action"]
  });
});

// Обробка натискання
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "toggle-antia") {
    chrome.storage.local.get("isEnabled", (data) => {
      const newState = !data.isEnabled;
      
      chrome.storage.local.set({ isEnabled: newState }, () => {
        updateMenu(newState);
        // Перезавантажуємо сторінку
        chrome.tabs.reload(tab.id);
      });
    });
  }
});

// Відповідь для content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.method === "getStatus") {
    chrome.storage.local.get("isEnabled", (data) => {
      sendResponse({ status: data.isEnabled !== false }); // true якщо не встановлено false
    });
    return true; // Важливо для асинхронної відповіді
  }
});