// YCsys Antia-Ads 1.4.0: Background Controller
// Керує паузою, контекстним меню та статичним DNR-набором правил.

const RULESET_ID = "ruleset_1";
const MENU_ID = "toggle-antia";

function logError(context) {
  if (chrome.runtime.lastError) {
    console.warn(`[YCsys Antia-Ads] ${context}:`, chrome.runtime.lastError.message);
    return true;
  }
  return false;
}

function updateMenu(isEnabled) {
  chrome.contextMenus.update(
    MENU_ID,
    {
      title: isEnabled
        ? "Вимкнути Antia-Ads (Пауза)"
        : "Увімкнути Antia-Ads"
    },
    () => logError("Не вдалося оновити контекстне меню")
  );
}

function setRulesetEnabled(isEnabled, callback = () => {}) {
  chrome.declarativeNetRequest.getEnabledRulesets((enabledRulesets) => {
    if (logError("Не вдалося прочитати активні правила DNR")) {
      callback(false);
      return;
    }

    const currentlyEnabled = enabledRulesets.includes(RULESET_ID);
    if (currentlyEnabled === isEnabled) {
      callback(true);
      return;
    }

    const options = isEnabled
      ? { enableRulesetIds: [RULESET_ID] }
      : { disableRulesetIds: [RULESET_ID] };

    chrome.declarativeNetRequest.updateEnabledRulesets(options, () => {
      if (logError("Не вдалося перемкнути правила DNR")) {
        callback(false);
        return;
      }
      callback(true);
    });
  });
}

function syncEnabledState() {
  chrome.storage.local.get({ isEnabled: true }, (data) => {
    if (logError("Не вдалося прочитати налаштування")) return;

    const isEnabled = data.isEnabled !== false;
    setRulesetEnabled(isEnabled, (success) => {
      if (success) updateMenu(isEnabled);
    });
  });
}

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    if (logError("Не вдалося очистити контекстне меню")) return;

    chrome.contextMenus.create(
      {
        id: MENU_ID,
        title: "Вимкнути Antia-Ads (Пауза)",
        contexts: ["action"]
      },
      () => {
        if (logError("Не вдалося створити контекстне меню")) return;
        syncEnabledState();
      }
    );
  });
}

chrome.runtime.onInstalled.addListener(() => {
  // Не перезаписуємо вибір користувача під час оновлення розширення.
  chrome.storage.local.get("isEnabled", (data) => {
    if (logError("Не вдалося перевірити стан розширення")) return;

    if (typeof data.isEnabled !== "boolean") {
      chrome.storage.local.set({ isEnabled: true }, () => {
        logError("Не вдалося зберегти початковий стан");
        createContextMenu();
      });
    } else {
      createContextMenu();
    }
  });
});

chrome.runtime.onStartup.addListener(syncEnabledState);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  chrome.storage.local.get({ isEnabled: true }, (data) => {
    if (logError("Не вдалося прочитати стан перед перемиканням")) return;

    const newState = data.isEnabled === false;

    chrome.storage.local.set({ isEnabled: newState }, () => {
      if (logError("Не вдалося зберегти стан розширення")) return;

      setRulesetEnabled(newState, (success) => {
        if (!success) return;

        updateMenu(newState);

        // Перезавантажуємо тільки вкладку, з якої викликали меню.
        if (tab && Number.isInteger(tab.id)) {
          chrome.tabs.reload(tab.id, () => {
            logError("Не вдалося перезавантажити вкладку");
          });
        }
      });
    });
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.method !== "getStatus") return false;

  chrome.storage.local.get({ isEnabled: true }, (data) => {
    if (logError("Не вдалося отримати стан для content.js")) {
      sendResponse({ status: false });
      return;
    }

    sendResponse({ status: data.isEnabled !== false });
  });

  return true;
});

// Діагностика доступна під час запуску розпакованого розширення.
// Вона не змінює запити, а лише показує правила, які реально спрацювали.
if (chrome.declarativeNetRequest?.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    console.debug("[YCsys Antia-Ads] DNR match", {
      ruleId: info.rule.ruleId,
      url: info.request.url,
      type: info.request.type,
      initiator: info.request.initiator
    });
  });
}
