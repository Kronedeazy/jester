const translationCache = new Map();
const MAX_CACHE_SIZE = 250;

const browserLang = () => ((chrome.i18n && chrome.i18n.getUILanguage()) || "en").toLowerCase().startsWith("de") ? "de" : "en";
const MENU_TITLE = { de: "Markierung vorlesen / übersetzen", en: "Read / translate selection" };

const DEFAULT_SETTINGS = {
  mode: "reader",
  key_boost: "v",
  key_back: "ArrowLeft",
  key_fwd: "ArrowRight",
  rate: 1.35,
  ttsInTranslator: true,
  select_box: true,
  enable_wheel: true,
  wheel_step: 5,
  ff_rate: 3,
  ff_rate_fast: 8,
  toast_seconds: 0.8,
  enable_audio: true,
  audio_stages: [3, 6, 9]
};

// Einstellungen von Funktionen, die es nicht mehr gibt
const OLD_KEYS = [
  "enable_skipper", "skip_seconds", "wheel_step_back", "wheel_mode", "wheel_action", "undo_seconds",
  "enable_stretch", "enable_speed", "speed_target", "speed_hud", "audio_tame", "audio_fix",
  "audio_mode", "audio_db", "audio_voice", "plotread", "plotread_rate", "plotread_sens",
  "plotread_zone", "plotread_voice", "plotread_rewind", "mig_sens_hoch"
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove(OLD_KEYS);

  chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS).concat(["boost_v2", "lang"]), (res) => {
    const updates = {};
    if (res.lang !== "de" && res.lang !== "en") updates.lang = browserLang();
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      if (res[k] === undefined) updates[k] = v;
    }
    // Einmalig: Boost auf die feineren Stufen 3 / 6 / 9 dB umstellen
    if (!res.boost_v2) {
      updates.audio_stages = [3, 6, 9];
      updates.boost_v2 = true;
    }
    chrome.storage.local.set(updates, () => updateBadge(res.mode || DEFAULT_SETTINGS.mode, updates.lang || res.lang));
  });

  chrome.storage.local.get(["lang"], (r) => createMenu(r.lang || browserLang()));
});

function createMenu(lang) {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "process-selection",
      title: MENU_TITLE[lang] || MENU_TITLE.en,
      contexts: ["selection"]
    });
  });
}

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(["mode", "lang"], (res) => updateBadge(res.mode || "reader", res.lang));
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.mode || changes.lang) {
    chrome.storage.local.get(["mode", "lang"], (r) => updateBadge(r.mode || "reader", r.lang));
  }
  if (changes.lang) createMenu(changes.lang.newValue);
});

// Kleines Abzeichen am Symbol: aktueller Lese-Modus (V/R = vorlesen, DE/EN = uebersetzen).
// Laeuft in einem Tab der Lautstaerke-Boost, steht dort stattdessen "+6" usw.
function updateBadge(mode, lang) {
  const de = (lang || browserLang()) === "de";
  const map = {
    reader: { text: de ? "V" : "R", color: "#10b981" },
    translator: { text: de ? "DE" : "EN", color: "#f4a7b9" },
    translator_audio: { text: de ? "DE" : "EN", color: "#a78bfa" },
    off: { text: "", color: "#e11d48" }
  };
  const cfg = map[mode] || map.off;
  chrome.action.setBadgeText({ text: cfg.text });
  chrome.action.setBadgeBackgroundColor({ color: cfg.color });
}

function setTabBoostBadge(tabId, db) {
  if (db > 0) {
    chrome.action.setBadgeText({ tabId, text: "+" + Math.round(db) });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#e11d48" });
  } else {
    // null = zurueck zur normalen Anzeige (Lese-Modus)
    chrome.action.setBadgeText({ tabId, text: null });
    chrome.action.setBadgeBackgroundColor({ tabId, color: null });
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "cycle-mode") {
    chrome.storage.local.get(["mode"], (res) => {
      const order = ["reader", "translator", "translator_audio", "off"];
      const next = order[(order.indexOf(res.mode || "reader") + 1) % order.length];
      chrome.storage.local.set({ mode: next });
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "process-selection" && tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: "triggerSelection" }, { frameId: info.frameId || 0 }, () => void chrome.runtime.lastError);
  }
});

// Kurze Texte per GET, lange per POST (sonst wird die Adresse zu lang)
async function fetchTranslation(text, target) {
  const tl = target === "en" ? "en" : "de";
  const base = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" + tl + "&dt=t";
  const r = text.length < 1500
    ? await fetch(base + "&q=" + encodeURIComponent(text))
    : await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: "q=" + encodeURIComponent(text)
      });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const data = await r.json();
  return {
    translatedText: data[0].map((item) => item[0]).join(""),
    sourceLang: typeof data[2] === "string" ? data[2] : ""
  };
}

// Texterkennung laeuft in einem unsichtbaren Zusatz-Dokument (dort duerfen Worker + WebAssembly laufen)
async function ensureOcrDocument() {
  if (chrome.runtime.getContexts) {
    const ctx = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
    if (ctx.length) return;
  }
  try {
    await chrome.offscreen.createDocument({ url: "ocr.html", reasons: ["WORKERS", "AUDIO_PLAYBACK"], justification: "Text recognition in the selected screen area and playing the Microsoft voice" });
  } catch (e) {
    if (!String(e && e.message).toLowerCase().includes("single offscreen")) throw e;
  }
}

async function runOcr(request, sender) {
  const windowId = sender.tab ? sender.tab.windowId : undefined;
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
  await ensureOcrDocument();
  const res = await chrome.runtime.sendMessage({ target: "ocr", dataUrl, rect: request.rect, dpr: request.dpr });
  return res || { error: "no result" };
}

// === Microsoft-Stimme (Azure) ===
// Beide Stimmen sind "Multilingual": sie lesen auch die jeweils andere Sprache sauber
const AZURE_VOICES = { de: "de-DE-SeraphinaMultilingualNeural", en: "en-US-AvaMultilingualNeural" };
let ttsTab = null; // Tab, in dem gerade die Microsoft-Stimme liest

async function hasOffscreen() {
  if (!chrome.runtime.getContexts) return true;
  const ctx = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  return ctx.length > 0;
}

async function azureSpeak(request, sender) {
  const cfg = await chrome.storage.local.get(["azure_key", "azure_region", "lang"]);
  if (!cfg.azure_key) return { ok: false, error: "kein Schluessel" };
  const uiLang = cfg.lang || (chrome.i18n.getUILanguage().toLowerCase().startsWith("de") ? "de" : "en");
  await ensureOcrDocument();
  ttsTab = sender.tab ? sender.tab.id : null;
  return chrome.runtime.sendMessage({
    target: "tts", cmd: "speak", id: request.id, chunks: request.chunks, rate: Number(request.rate) || 1,
    key: cfg.azure_key, region: cfg.azure_region || "germanywestcentral", voice: AZURE_VOICES[uiLang] || AZURE_VOICES.en,
    tabId: ttsTab, frameId: sender.frameId || 0
  });
}

async function azureSend(msg) {
  if (!(await hasOffscreen())) return;
  chrome.runtime.sendMessage(Object.assign({ target: "tts" }, msg), () => void chrome.runtime.lastError);
}

// Zeichen pro Monat mitzaehlen (das kostenlose Kontingent sind 500.000 im Monat)
async function countAzureChars(n) {
  const month = new Date().toISOString().slice(0, 7);
  const { azure_usage } = await chrome.storage.local.get("azure_usage");
  const u = azure_usage && azure_usage.month === month ? azure_usage : { month, chars: 0 };
  u.chars += n;
  await chrome.storage.local.set({ azure_usage: u });
}

// Tab zu oder neue Seite: Microsoft-Stimme verstummt
chrome.tabs.onRemoved.addListener((tabId) => { if (tabId === ttsTab) { azureSend({ cmd: "stop", tabId }); ttsTab = null; } });
chrome.tabs.onUpdated.addListener((tabId, info) => { if (tabId === ttsTab && info.status === "loading") { azureSend({ cmd: "stop", tabId }); ttsTab = null; } });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && (request.target === "ocr" || request.target === "tts")) return false; // ist fuer das Offscreen-Dokument
  if (request.action === "azureSpeak") {
    azureSpeak(request, sender).then((r) => sendResponse(r || { ok: false }), (e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
    return true;
  }
  if (request.action === "azureWarm") {
    (async () => {
      const cfg = await chrome.storage.local.get(["azure_key", "azure_region"]);
      if (!cfg.azure_key) return;
      await ensureOcrDocument();
      azureSend({ cmd: "warm", region: cfg.azure_region || "germanywestcentral" });
    })().catch(() => {});
    return false;
  }
  if (request.action === "azureStop") {
    azureSend({ cmd: "stop", id: request.id });
    return false;
  }
  if (request.action === "azureRate") {
    azureSend({ cmd: "rate", id: request.id, rate: request.rate });
    return false;
  }
  if (request.action === "ttsEvent") {
    if (request.type === "chunk" && request.chars) countAzureChars(request.chars);
    if (request.type === "done" || request.type === "fail") ttsTab = null;
    if (request.tabId !== null && request.tabId !== undefined) {
      chrome.tabs.sendMessage(request.tabId, request, { frameId: request.frameId || 0 }, () => void chrome.runtime.lastError);
    }
    return false;
  }
  if (request.action === "ocr") {
    runOcr(request, sender).then(sendResponse, (e) => sendResponse({ error: String((e && e.message) || e) }));
    return true;
  }
  if (request.action === "audioBadge") {
    if (sender.tab && sender.tab.id !== undefined) setTabBoostBadge(sender.tab.id, Number(request.db) || 0);
    return false;
  }
  if (request.action !== "translate") return false;
  const text = (request.text || "").trim();
  if (!text) {
    sendResponse({ error: "Empty text" });
    return false;
  }
  const target = request.target === "en" ? "en" : "de";
  const cacheKey = target + "|" + text;
  if (translationCache.has(cacheKey)) {
    sendResponse(Object.assign({ cached: true }, translationCache.get(cacheKey)));
    return false;
  }
  fetchTranslation(text, target)
    .then((result) => {
      if (translationCache.size >= MAX_CACHE_SIZE) translationCache.delete(translationCache.keys().next().value);
      translationCache.set(cacheKey, result);
      sendResponse(result);
    })
    .catch((err) => sendResponse({ error: err.message }));
  return true;
});
