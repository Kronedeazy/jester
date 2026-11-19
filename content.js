(() => {
  // ===================== Einstellungen =====================
  let currentMode = "reader";   // reader | translator | translator_audio | off
  let speechRate = 1.35;
  let ttsInTranslator = true;
  let selectBox = true;         // true = Text per linker + rechter Taste (roter Rahmen), false = normal mit links markieren

  let enableWheel = true;
  let wheelStep = 5;            // Sekunden pro Rad-Raste / Pfeiltaste
  let ffRate = 3;               // Vorspul-Tempo: nur scrollen
  let ffRateFast = 8;           // Vorspul-Tempo: rechte Taste halten + scrollen
  let toastSeconds = 0.8;

  // Sprache (Menue, Hinweise, Uebersetzungsziel): "de" oder "en", Standard = Sprache von Chrome
  let lang = (navigator.language || "en").toLowerCase().startsWith("de") ? "de" : "en";
  // Tasten (im Menue unter "D" aenderbar)
  let keyBoost = "v";
  let keyBack = "ArrowLeft";
  let keyFwd = "ArrowRight";

  let enableAudio = true;
  let audioStages = [3, 6, 9];  // dB je Stufe
  let audioStage = 0;           // 0 = aus, 1-3 = Stufe (pro Tab)

  // ===================== Zustand =====================
  let activeOverlay = null;
  let speechQueue = [];
  let isSpeaking = false;
  let lastSelText = "";
  let lastSelTime = 0;
  let suppressContextMenuUntil = 0;
  let activeBadge = null;
  let badgeTimer = null;
  let forcedVideo = null;       // Video unter der Maus (Mausrad ohne Vollbild)
  let rightHeld = false;        // rechte Taste auf dem Video gedrueckt
  let rightWheeled = false;     // waehrenddessen gescrollt -> kein Rechtsklick-Menue

  // Rechtsklick auf Markierung (nur im Modus "normal markieren"): kurz = abwaehlen, halten = Menue
  const RIGHT_HOLD_MS = 300;
  let rightDownTime = 0;
  let rightHoldTimer = null;

  let audioCtx = null;
  const hookedMedia = new Map();

  const stepFor = (forward) => (forward ? wheelStep : -wheelStep);

  const TXT = {
    de: {
      protected: "Lautstärke: hier geschützt – nicht möglich",
      volOff: "🔈 Lautstärke: Original",
      level: "Stufe",
      transFail: "Übersetzung fehlgeschlagen",
      noText: "Kein Text im Rahmen",
      releaseMenu: "Loslassen = Menü",
      copyTitle: "Klicken zum Kopieren der Übersetzung"
    },
    en: {
      protected: "Volume: protected here – not possible",
      volOff: "🔈 Volume: original",
      level: "Level",
      transFail: "Translation failed",
      noText: "No text in frame",
      releaseMenu: "Release = menu",
      copyTitle: "Click to copy the translation"
    }
  };
  const t = (k) => (TXT[lang] || TXT.en)[k];
  const targetVoice = () => (lang === "de" ? "de-DE" : "en-US");
  // Taste vergleichen: Buchstaben ohne Gross/Klein, sonst genauer Name (z. B. ArrowLeft)
  const keyIs = (e, bound) => {
    if (!bound) return false;
    const k = e.key || "";
    return bound.length === 1 ? k.toLowerCase() === bound.toLowerCase() : k === bound;
  };

  // ===================== Speicher laden + live mitgehen =====================
  chrome.storage.local.get(null, (res) => {
    if (res.mode) currentMode = res.mode;
    if (res.lang === "de" || res.lang === "en") lang = res.lang;
    if (res.key_boost) keyBoost = res.key_boost;
    if (res.key_back) keyBack = res.key_back;
    if (res.key_fwd) keyFwd = res.key_fwd;
    if (res.rate !== undefined) speechRate = Number(res.rate);
    if (res.ttsInTranslator !== undefined) ttsInTranslator = res.ttsInTranslator;
    if (res.select_box !== undefined) selectBox = res.select_box;
    if (res.enable_wheel !== undefined) enableWheel = res.enable_wheel;
    if (res.wheel_step !== undefined) wheelStep = Number(res.wheel_step) || 5;
    if (res.ff_rate !== undefined) ffRate = Number(res.ff_rate);
    if (res.ff_rate_fast !== undefined) ffRateFast = Number(res.ff_rate_fast);
    if (res.toast_seconds !== undefined) toastSeconds = Number(res.toast_seconds);
    if (res.enable_audio !== undefined) enableAudio = res.enable_audio;
    if (Array.isArray(res.audio_stages)) audioStages = res.audio_stages.map(Number);
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.mode) {
      currentMode = changes.mode.newValue;
      if (currentMode === "off") stopAllSpeechAndOverlay();
    }
    if (changes.lang && changes.lang.newValue) lang = changes.lang.newValue;
    if (changes.key_boost) keyBoost = changes.key_boost.newValue || "v";
    if (changes.key_back) keyBack = changes.key_back.newValue || "ArrowLeft";
    if (changes.key_fwd) keyFwd = changes.key_fwd.newValue || "ArrowRight";
    if (changes.rate) speechRate = Number(changes.rate.newValue);
    if (changes.ttsInTranslator) ttsInTranslator = changes.ttsInTranslator.newValue;
    if (changes.select_box) selectBox = changes.select_box.newValue;
    if (changes.enable_wheel) enableWheel = changes.enable_wheel.newValue;
    if (changes.wheel_step) wheelStep = Number(changes.wheel_step.newValue) || 5;
    if (changes.ff_rate) ffRate = Number(changes.ff_rate.newValue) || 3;
    if (changes.ff_rate_fast) ffRateFast = Number(changes.ff_rate_fast.newValue) || 8;
    if (changes.toast_seconds) toastSeconds = Number(changes.toast_seconds.newValue);
    if (changes.enable_audio) {
      enableAudio = changes.enable_audio.newValue;
      if (!enableAudio && audioStage !== 0) {
        audioStage = 0;
        applyAudioToAll();
      }
    }
    if (changes.audio_stages && Array.isArray(changes.audio_stages.newValue)) {
      audioStages = changes.audio_stages.newValue.map(Number);
      applyAudioToAll();
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "triggerSelection") handleSelection(true);
  });

  // ===================== Hilfsfunktionen =====================
  function isInputActive(el) {
    if (!el) return false;
    const tag = (el.tagName || "").toUpperCase();
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      el.isContentEditable ||
      Boolean(el.closest && el.closest("input, textarea, [contenteditable='true']"))
    );
  }

  function isFullscreenActive() {
    if (document.fullscreenElement || document.webkitFullscreenElement || window.fullScreen) return true;
    try {
      if (window.top && window.top.document && (window.top.document.fullscreenElement || window.top.document.webkitFullscreenElement)) {
        return true;
      }
    } catch (_) {}
    if (!window.screen.width || !window.innerWidth) return false; // Fenster unsichtbar/zusammengeklappt
    if (Math.abs(window.innerWidth - window.screen.width) <= 5 && Math.abs(window.innerHeight - window.screen.height) <= 5) {
      return true;
    }
    const docW = document.documentElement ? document.documentElement.clientWidth : 0;
    const docH = document.documentElement ? document.documentElement.clientHeight : 0;
    return docW > 0 && docH > 0 && Math.abs(docW - window.screen.width) <= 5 && Math.abs(docH - window.screen.height) <= 5;
  }

  function getActiveVideo() {
    if (forcedVideo && forcedVideo.isConnected) return forcedVideo;
    let videos = Array.from(document.querySelectorAll("video"));
    if (videos.length === 0) return null;
    // Im Vollbild zuerst das Video im Vollbild-Bereich nehmen (nicht Vorschau-Videos daneben)
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs) {
      const inFs = videos.filter((v) => fs === v || fs.contains(v));
      if (inFs.length > 0) videos = inFs;
    }
    return (
      videos.find((v) => !v.paused && v.readyState >= 2 && v.duration > 0) ||
      videos.find((v) => v.readyState >= 1) ||
      videos[0]
    );
  }

  // Sichtbares Video genau unter der Maus (auch wenn eine Player-Leiste darueber liegt)
  function videoUnderPointer(x, y) {
    for (const v of document.querySelectorAll("video")) {
      const r = v.getBoundingClientRect();
      if (r.width < 80 || r.height < 60) continue;
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      const cs = getComputedStyle(v);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      return v;
    }
    return null;
  }

  // Kleiner Hinweis oben rechts
  function showToast(text, borderColor, minMs = 0) {
    try {
      const video = getActiveVideo();
      const container = document.fullscreenElement || document.webkitFullscreenElement || (video && video.parentElement) || document.body;
      if (!container) return;
      if (!activeBadge || !container.contains(activeBadge)) {
        if (activeBadge) activeBadge.remove();
        activeBadge = document.createElement("div");
        Object.assign(activeBadge.style, {
          position: "fixed",
          top: "24px",
          right: "24px",
          padding: "8px 16px",
          backgroundColor: "rgba(5, 5, 5, 0.88)",
          color: "#ffffff",
          border: "1.5px solid " + (borderColor || "#f4a7b9"),
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          fontSize: "15px",
          fontWeight: "700",
          borderRadius: "999px",
          zIndex: "2147483647",
          pointerEvents: "none",
          transition: "opacity 0.2s ease",
          boxShadow: "0 4px 16px rgba(0,0,0,0.6)"
        });
        container.appendChild(activeBadge);
      }
      activeBadge.textContent = text;
      activeBadge.style.borderColor = borderColor || "#f4a7b9";
      activeBadge.style.opacity = "1";
      if (badgeTimer) clearTimeout(badgeTimer);
      const durationMs = Math.max(200, minMs, (toastSeconds || 0.8) * 1000);
      badgeTimer = setTimeout(() => {
        if (activeBadge) activeBadge.style.opacity = "0";
      }, durationMs);
    } catch (_) {}
  }

  function broadcastCommand(payload) {
    document.querySelectorAll("iframe").forEach((f) => {
      try {
        if (f.contentWindow) f.contentWindow.postMessage(payload, "*");
      } catch (_) {}
    });
    try {
      if (window.top && window.top !== window) window.top.postMessage(payload, "*");
    } catch (_) {}
  }

  // ===================== Lautstaerke-Boost (Taste V) =====================
  // Signalweg je Video/Audio:
  //   Quelle -> Original ----------------------------------------------> Lautsprecher (Stufe 0)
  //   Quelle -> Laute Stellen zaehmen -> Boost -> Schutz-Limiter -------> Lautsprecher (Stufe 1-3)

  // Kopiergeschuetzte (Netflix, Prime, Disney+) oder fremd gehostete Medien ohne Freigabe
  // wuerden durch die Umleitung stumm. Solche fassen wir nicht an.
  function isAudioProtected(media) {
    try {
      if (media.mediaKeys) return true;
      const src = media.currentSrc || media.src || "";
      if (/^https?:/i.test(src) && new URL(src).origin !== location.origin && !media.crossOrigin) return true;
    } catch (_) {}
    return false;
  }

  function getActiveMedia() {
    return getActiveVideo() || Array.from(document.querySelectorAll("audio")).find((a) => !a.paused) || document.querySelector("audio");
  }

  function stageDb(stage) {
    const v = Number(audioStages[stage - 1]);
    return Number.isFinite(v) ? Math.max(1, Math.min(24, v)) : [3, 6, 9][stage - 1];
  }

  function ensureAudioGraph(media) {
    if (hookedMedia.has(media)) return hookedMedia.get(media);
    if (isAudioProtected(media)) return null;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!audioCtx) audioCtx = new AudioContextClass({ latencyHint: "playback" });
      // Ist die Tonausgabe (noch) nicht freigegeben, NICHT umleiten - sonst waere das Video stumm.
      if (audioCtx.state !== "running") {
        audioCtx.resume().then(() => {
          if (audioCtx.state === "running" && audioStage > 0) applyAudioToAll();
        }).catch(() => {});
        return null;
      }

      const source = audioCtx.createMediaElementSource(media);
      const dry = audioCtx.createGain();
      dry.gain.value = 1;

      // Laute Stellen zaehmen: alles ueber -24 dB wird 4:1 gebremst, leise Stimmen bekommen den vollen Boost
      const tamer = audioCtx.createDynamicsCompressor();
      tamer.threshold.value = -24;
      tamer.knee.value = 10;
      tamer.ratio.value = 4;
      tamer.attack.value = 0.01;
      tamer.release.value = 0.3;

      const boost = audioCtx.createGain();

      const limiter = audioCtx.createDynamicsCompressor(); // Schutz gegen Kratzen/Verzerren
      limiter.threshold.value = -2;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.12;

      const wet = audioCtx.createGain();
      wet.gain.value = 0;

      source.connect(dry);
      dry.connect(audioCtx.destination);
      source.connect(tamer);
      tamer.connect(boost);
      boost.connect(limiter);
      limiter.connect(wet);
      wet.connect(audioCtx.destination);

      const node = { dry, wet, boost };
      hookedMedia.set(media, node);
      return node;
    } catch (_) {
      return null;
    }
  }

  // Der Browser-Kompressor hebt automatisch an ("Make-up-Gain", ca. 0,6 x Absenkung bei 0 dB).
  // Das rechnen wir heraus, damit "+6 dB" auch ungefaehr +6 dB fuer leise Stellen bedeutet.
  const MAKEUP_DB = 0.6 * -(-24 - -24 / 4);

  function applyAudioTo(media) {
    const node = audioStage > 0 ? ensureAudioGraph(media) : hookedMedia.get(media);
    if (!node || !audioCtx) return false;
    const t = audioCtx.currentTime;
    if (audioStage === 0) {
      node.dry.gain.setTargetAtTime(1, t, 0.03);
      node.wet.gain.setTargetAtTime(0, t, 0.03);
      return true;
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    node.boost.gain.setTargetAtTime(Math.pow(10, (stageDb(audioStage) - MAKEUP_DB) / 20), t, 0.05);
    node.dry.gain.setTargetAtTime(0, t, 0.03);
    node.wet.gain.setTargetAtTime(1, t, 0.03);
    return true;
  }

  // dB-Wert der aktuellen Stufe am Add-on-Symbol anzeigen (0 = Anzeige weg)
  function reportBoostBadge() {
    try {
      chrome.runtime.sendMessage({ action: "audioBadge", db: audioStage > 0 ? stageDb(audioStage) : 0 }, () => void chrome.runtime.lastError);
    } catch (_) {}
  }

  function applyAudioToAll() {
    // Nur Frames melden, in denen der Boost laeuft/lief (sonst loescht ein leerer Frame die Anzeige)
    if (audioStage > 0 || hookedMedia.size > 0) reportBoostBadge();
    let ok = false;
    document.querySelectorAll("video, audio").forEach((m) => {
      if (applyAudioTo(m)) ok = true;
    });
    return ok;
  }

  // Neu geladene Seite startet ohne Boost: alte Anzeige am Symbol entfernen
  if (window === window.top) reportBoostBadge();

  // Neues Video / naechste Folge im selben Tab: aktuelle Stufe mitnehmen
  document.addEventListener("play", (e) => {
    const m = e.target;
    if (!(m instanceof HTMLMediaElement)) return;
    if (enableAudio && audioStage > 0) applyAudioTo(m);
  }, true);

  function cycleAudioStage(forceOff) {
    const m = getActiveMedia();
    const next = forceOff ? 0 : (audioStage + 1) % 4;
    if (next > 0 && m && !hookedMedia.has(m) && isAudioProtected(m)) {
      showToast(t("protected"), "#e11d48");
      return;
    }
    audioStage = next;
    applyAudioToAll();
    if (audioStage === 0) showToast(t("volOff"), "#a78bfa");
    else showToast("🔊 " + t("level") + " " + audioStage + "/3 · +" + stageDb(audioStage) + " dB", "#f4a7b9");
  }

  // ===================== Mausrad & Pfeiltasten =====================
  // Mehrmals kurz hintereinander: die Anzeige zaehlt zusammen (+5s, +10s ...; vor und zurueck wird verrechnet)
  const SEEK_STACK_MS = 1200;
  let seekStackSum = 0;
  let seekStackAt = 0;

  // Springen (Pfeiltasten und Rad runter)
  function seekVideoByDelta(deltaSeconds) {
    const now = Date.now();
    const video = getActiveVideo();
    if (!video) return false;
    stopFastForward();

    window.postMessage({ source: "JESTER_CONTENT", cmd: "SEEK_DELTA", ms: deltaSeconds * 1000 }, "*");
    let targetSec = Math.max(0, video.currentTime + deltaSeconds);
    if (Number.isFinite(video.duration) && video.duration > 0) {
      targetSec = Math.min(targetSec, Math.max(0, video.duration - 0.25));
    }
    video.currentTime = targetSec;

    if (now - seekStackAt > SEEK_STACK_MS) seekStackSum = 0;
    seekStackSum = Math.round((seekStackSum + deltaSeconds) * 10) / 10;
    seekStackAt = now;
    const total = seekStackSum;
    const label = (total > 0 ? "+" : total < 0 ? "−" : "±") + Math.abs(total) + "s";
    showToast(label, total >= 0 ? "#10b981" : "#a78bfa", SEEK_STACK_MS);
    return true;
  }

  // Vorspulen (Rad hoch): gleiche Strecke wie ein Sprung, aber kurz schneller abspielen.
  // Beispiel: 5 s bei 5x = 1 s lang schnell.
  let ffActive = false;
  let ffPrevRate = 1;
  let ffVideo = null;
  let ffTarget = 0;
  let ffTimer = null;
  let ffCurRate = 3;
  const fmtNum = (r) => (Math.round(r * 100) / 100).toString();

  function ffTick() {
    const v = ffVideo;
    if (!ffActive || !v || !v.isConnected || v.ended || v.paused || v.currentTime >= ffTarget - 0.05) {
      stopFastForward();
      return;
    }
    if (Math.abs(v.playbackRate - ffCurRate) > 0.01) { try { v.playbackRate = ffCurRate; } catch (_) {} }
  }

  function stopFastForward() {
    if (!ffActive) return false;
    ffActive = false;
    clearInterval(ffTimer);
    ffTimer = null;
    try { if (ffVideo) ffVideo.playbackRate = ffPrevRate; } catch (_) {}
    ffVideo = null;
    seekStackAt = Date.now(); // ein Zurueck kurz danach wird in der Anzeige verrechnet
    return true;
  }

  function fastForwardByDelta(deltaSeconds, fast) {
    const video = getActiveVideo();
    if (!video) return false;
    const rate = fast ? ffRateFast : ffRate;
    // Pausiert (oder Tempo zu klein): normal springen
    if (video.paused || rate <= 1) return seekVideoByDelta(deltaSeconds);
    const now = Date.now();
    const wasActive = ffActive && ffVideo === video;
    if (!wasActive) {
      if (ffActive) stopFastForward();
      ffPrevRate = video.playbackRate || 1;
      ffVideo = video;
      ffActive = true;
      ffTarget = video.currentTime;
      ffTimer = setInterval(ffTick, 40);
    }
    ffTarget += deltaSeconds;
    if (Number.isFinite(video.duration) && video.duration > 0) {
      ffTarget = Math.min(ffTarget, Math.max(0, video.duration - 0.25));
    }
    ffCurRate = rate;
    try { video.playbackRate = rate; } catch (_) {}
    if (!wasActive && now - seekStackAt > SEEK_STACK_MS) seekStackSum = 0;
    seekStackSum = Math.round((seekStackSum + deltaSeconds) * 10) / 10;
    seekStackAt = now;
    const restMs = Math.max(0, (ffTarget - video.currentTime) / rate * 1000);
    showToast("⏩ +" + seekStackSum + "s · " + fmtNum(rate) + "x", fast ? "#f59e0b" : "#10b981", restMs + 400);
    return true;
  }

  // Mausrad: hoch = vorspulen, runter = zurueckspringen (rueckwaerts abspielen geht nicht)
  function wheelMove(deltaSeconds, fast) {
    if (deltaSeconds > 0) return fastForwardByDelta(deltaSeconds, fast);
    return seekVideoByDelta(deltaSeconds);
  }

  // Befehle aus eingebetteten Playern (iframes) / an sie
  window.addEventListener("message", (event) => {
    const d = event.data;
    if (!d || !d.jesterCmd) return;
    if (d.jesterCmd === "WHEEL_SEEK" && enableWheel) seekVideoByDelta(Number(d.delta) || 0);
    else if (d.jesterCmd === "WHEEL_FF" && enableWheel) wheelMove(Number(d.delta) || 0, Boolean(d.fast));
    else if (d.jesterCmd === "TOGGLE_AUDIO" && enableAudio) {
      if (getActiveMedia()) cycleAudioStage(Boolean(d.off));
    }
  });

  // ===================== Vorlesen & Uebersetzen =====================
  const DICT_DE = new Set([
    "der","die","das","und","den","von","mit","sich","auf","für","nicht","ist","dem","als","auch","es","werden","aus","er","hat","dass","sie","nach","wird","bei","einer","sind","noch","wie","einem","über","einen","zum","war","haben","nur","oder","aber","vor","zur","bis","mehr","durch","man","sein","wurde","sei","prozent","kann","gegen","vom","können","schon","wenn","wir","ihr","ihre","dann","unter","soll","ich","du","euch","diese","dieser","dieses","ein","eine","eines","keine","kein","immer","wieder","zwischen","ohne"
  ]);
  const DICT_EN = new Set([
    "the","be","of","and","that","have","it","for","not","with","he","as","you","do","at","this","but","his","by","from","they","we","say","her","she","or","will","my","one","all","would","there","their","what","up","out","if","about","who","get","which","go","me","when","make","can","like","time","just","him","know","take","people","into","year","your","good","some","could","them","see","other","than","then","now","look","only","come","its","over","think","also","where","after","should","because","each","those","these"
  ]);
  const DICT_PL = new Set([
    "nie","na","do","jak","ale","po","co","tak","za","od","czy","przy","tylko","dla","ten","jest","już","jego","jej","ich","będzie","lub","przez","aby","oraz","który","która","które","bardzo","bez","jeszcze","może","kiedy","gdzie","teraz","wszystko","więc","między","tutaj","kto","nikt","nic","tego","tych","tym"
  ]);

  const REGEX_CYRILLIC = /[Ѐ-ӿ]/;
  const REGEX_JAPANESE = /[぀-ヿ一-龯]/;
  const REGEX_PL_CHARS = /[ĄąĆćĘęŁłŃńÓóŚśŹźŻż]/;
  const REGEX_DE_CHARS = /[ÄäÖöÜüß]/;

  function detectWordLang(word) {
    if (/\d/.test(word)) return null;
    const clean = word.toLowerCase().replace(/[^\p{L}]/gu, "");
    if (!clean) return null;
    if (REGEX_JAPANESE.test(clean)) return "ja-JP";
    if (REGEX_CYRILLIC.test(clean)) return "ru-RU";
    if (clean.length < 2) return null;
    if (REGEX_PL_CHARS.test(clean)) return "pl-PL";
    if (REGEX_DE_CHARS.test(clean)) return "de-DE";
    if (DICT_DE.has(clean)) return "de-DE";
    if (DICT_EN.has(clean)) return "en-US";
    if (DICT_PL.has(clean)) return "pl-PL";
    return null;
  }

  function detectDominantLang(text) {
    const counts = { "de-DE": 0, "en-US": 0, "pl-PL": 0, "ru-RU": 0, "ja-JP": 0 };
    if (REGEX_DE_CHARS.test(text)) counts["de-DE"] += 2;
    if (REGEX_PL_CHARS.test(text)) counts["pl-PL"] += 2;
    for (const w of text.split(/\s+/)) {
      const l = detectWordLang(w);
      if (l) counts[l]++;
    }
    let bestLang = "de-DE";
    let max = 0;
    for (const [lang, c] of Object.entries(counts)) {
      if (c > max) {
        max = c;
        bestLang = lang;
      }
    }
    if (max === 0) {
      const docLang = (document.documentElement.lang || "").toLowerCase();
      if (docLang.startsWith("de")) return "de-DE";
      if (docLang.startsWith("pl")) return "pl-PL";
      if (docLang.startsWith("ru")) return "ru-RU";
      if (docLang.startsWith("ja")) return "ja-JP";
      if (docLang.startsWith("en")) return "en-US";
    }
    return bestLang;
  }

  function isDifferentAlphabet(langA, langB) {
    const nonLatin = new Set(["ja-JP", "ru-RU"]);
    return nonLatin.has(langA) !== nonLatin.has(langB) || (nonLatin.has(langA) && langA !== langB);
  }

  // Laengenlimit pro Vorlese-Stueck: lokale Windows-Stimmen lesen lange Stuecke,
  // Google-Online-Stimmen brechen nach ca. 15 s ab. Geteilt wird nur an Satz-/Satzzeichengrenzen.
  function maxChunkLength(lang) {
    const v = getBestVoice(lang);
    return v && v.localService === false ? 230 : 1800;
  }

  function splitLong(piece, limit, splitter) {
    const parts = piece.match(splitter) || [piece];
    const out = [];
    let buf = "";
    for (const p of parts) {
      const s = p.trim();
      if (!s) continue;
      if (buf && (buf + " " + s).length > limit) {
        out.push(buf);
        buf = s;
      } else {
        buf = buf ? buf + " " + s : s;
      }
    }
    if (buf) out.push(buf);
    return out;
  }

  // Absatz -> (zu lang?) Saetze -> (Satz zu lang?) Komma/Semikolon -> (immer noch?) Woerter
  function segmentText(text, limit) {
    const result = [];
    const paragraphs = text.split(/\n\s*\n|\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
    for (const para of paragraphs) {
      if (para.length <= limit) { result.push(para); continue; }
      for (const sentGroup of splitLong(para, limit, /[^.!?…]+(?:[.!?…]+["'“”»)]*|$)/g)) {
        if (sentGroup.length <= limit) { result.push(sentGroup); continue; }
        for (const clauseGroup of splitLong(sentGroup, limit, /[^,;:–—]+(?:[,;:–—]+|$)/g)) {
          if (clauseGroup.length <= limit) { result.push(clauseGroup); continue; }
          result.push(...splitLong(clauseGroup, limit, /\S+/g));
        }
      }
    }
    return result;
  }

  function chunkTextByLangAndLength(text, forcedLang = null) {
    const baseLang = forcedLang || detectDominantLang(text);
    const limit = maxChunkLength(baseLang);
    const chunks = [];
    for (const segment of segmentText(text, limit)) {
      let currentLang = baseLang;
      let currentBuffer = [];
      for (const word of segment.split(/\s+/)) {
        const wLang = forcedLang ? forcedLang : detectWordLang(word);
        // Nur bei anderem Alphabet (z. B. Japanisch, Russisch) die Stimme wechseln
        if (wLang && wLang !== currentLang && isDifferentAlphabet(wLang, currentLang)) {
          if (currentBuffer.length > 0) chunks.push({ text: currentBuffer.join(" "), lang: currentLang });
          currentBuffer = [];
          currentLang = wLang;
        }
        currentBuffer.push(word);
      }
      if (currentBuffer.length > 0) chunks.push({ text: currentBuffer.join(" "), lang: currentLang });
    }
    return chunks;
  }

  function getBestVoice(langCode) {
    const voices = window.speechSynthesis.getVoices();
    const prefix = langCode.split("-")[0].toLowerCase();
    const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
    if (matching.length === 0) return null;
    return (
      matching.find((v) => v.name.includes("Natural") || v.name.includes("Online")) ||
      matching.find((v) => v.name.includes("Google")) ||
      matching.find((v) => v.default) ||
      matching[0]
    );
  }

  function speakText(text, forcedLang = null) {
    window.speechSynthesis.cancel();
    speechQueue = chunkTextByLangAndLength(text, forcedLang);
    isSpeaking = true;
    playNextChunk();
  }

  function playNextChunk() {
    if (!isSpeaking || speechQueue.length === 0) {
      isSpeaking = false;
      return;
    }
    const chunk = speechQueue.shift();
    const utterance = new SpeechSynthesisUtterance(chunk.text);
    utterance.lang = chunk.lang;
    utterance.rate = speechRate;
    const bestVoice = getBestVoice(chunk.lang);
    if (bestVoice) utterance.voice = bestVoice;
    utterance.onend = () => { if (isSpeaking) playNextChunk(); };
    utterance.onerror = () => { if (isSpeaking) playNextChunk(); };
    window.speechSynthesis.speak(utterance);
  }

  function removeOverlay() {
    if (activeOverlay) {
      activeOverlay.remove();
      activeOverlay = null;
    }
  }

  function stopAllSpeechAndOverlay() {
    isSpeaking = false;
    speechQueue = [];
    window.speechSynthesis.cancel();
    removeOverlay();
  }

  function showTextOverlay(range, translatedText) {
    removeOverlay();
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const parentEl = range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    const comp = parentEl ? window.getComputedStyle(parentEl) : null;

    const overlay = document.createElement("div");
    overlay.textContent = translatedText;
    Object.assign(overlay.style, {
      position: "absolute",
      left: (rect.left + window.scrollX) + "px",
      top: (rect.top + window.scrollY) + "px",
      minWidth: rect.width + "px",
      maxWidth: Math.max(rect.width, 340) + "px",
      minHeight: rect.height + "px",
      backgroundColor: "#050505",
      color: "#FFFFFF",
      border: "1.5px solid #f4a7b9",
      textShadow: "none",
      fontFamily: comp ? comp.fontFamily : "sans-serif",
      fontSize: comp ? comp.fontSize : "14px",
      fontWeight: comp ? comp.fontWeight : "normal",
      lineHeight: comp ? comp.lineHeight : "1.45",
      padding: "4px 10px",
      borderRadius: "12px",
      boxSizing: "border-box",
      zIndex: "2147483647",
      cursor: "pointer",
      userSelect: "none",
      boxShadow: "0 4px 14px rgba(0,0,0,0.65)"
    });
    overlay.title = t("copyTitle");
    overlay.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(translatedText).then(() => {
        overlay.style.borderColor = "#10b981";
        setTimeout(() => removeOverlay(), 300);
      });
    });
    document.body.appendChild(overlay);
    activeOverlay = overlay;
  }

  // Normale (blaue) Markierung verarbeiten. fromMenu = ueber das Rechtsklick-Menue ausgeloest.
  function handleSelection(fromMenu = false) {
    if (boxBlockMouseup && !fromMenu) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (!text || text.length < 2) return;
    processPickedText(text, sel.getRangeAt(0));
  }

  function processPickedText(text, range) {
    // Dreifachklick & Co. loesen mehrere mouseup aus: denselben Text nicht doppelt starten
    const now = Date.now();
    if (text === lastSelText && now - lastSelTime < 700) return;
    lastSelText = text;
    lastSelTime = now;

    if (currentMode === "reader") {
      speakText(text, null);
      return;
    }
    if (currentMode !== "translator" && currentMode !== "translator_audio") return;

    const withOverlay = currentMode === "translator";
    requestTranslation(text, (response) => {
      if (!response || response.error) {
        showToast(t("transFail"), "#e11d48");
        return;
      }
      // Schon in der Zielsprache? Dann das Original vorlesen statt einer "Uebersetzung"
      if ((response.sourceLang || "").toLowerCase().startsWith(lang)) {
        if (!withOverlay || ttsInTranslator) speakText(text, targetVoice());
        return;
      }
      if (withOverlay) {
        showTextOverlay(range, response.translatedText);
        if (ttsInTranslator) speakText(response.translatedText, targetVoice());
      } else {
        speakText(response.translatedText, targetVoice());
      }
    });
  }

  // Der Hintergrund-Teil von Chrome schlaeft manchmal ein: dann einmal kurz neu versuchen
  function requestTranslation(text, cb, retry = true) {
    try {
      chrome.runtime.sendMessage({ action: "translate", text, target: lang }, (response) => {
        if (chrome.runtime.lastError) {
          if (retry) setTimeout(() => requestTranslation(text, cb, false), 250);
          else cb(null);
          return;
        }
        cb(response);
      });
    } catch (_) {
      cb(null); // Add-on wurde neu geladen, Seite noch alt -> Seite neu laden
    }
  }

  // ===================== Roter Rahmen (linke + rechte Taste halten und ziehen) =====================
  // Nimmt nur den Text, der wirklich im Rahmen liegt (statt die halbe Seite zu markieren).
  let boxActive = false;
  let boxStartX = 0;
  let boxStartY = 0;
  let boxEl = null;
  let boxBlockMouseup = false;
  let boxUserSelectOld = "";
  const BOX_HL = "jester-box";

  function clearBoxHighlight() {
    try { if (window.CSS && CSS.highlights) CSS.highlights.delete(BOX_HL); } catch (_) {}
  }

  function ensureBoxStyle() {
    if (document.getElementById("jester-box-style")) return;
    const st = document.createElement("style");
    st.id = "jester-box-style";
    st.textContent = "::highlight(" + BOX_HL + "){background-color:rgba(225,29,72,0.38);color:inherit;}";
    (document.head || document.documentElement).appendChild(st);
  }

  function startBox(x, y) {
    boxActive = true;
    boxBlockMouseup = true;
    boxStartX = x;
    boxStartY = y;
    rightHeld = false; // kein schnelles Vorspulen
    clearBoxHighlight();
    try { const s = window.getSelection(); if (s) s.removeAllRanges(); } catch (_) {}
    boxUserSelectOld = document.documentElement.style.userSelect;
    document.documentElement.style.userSelect = "none"; // keine blaue Markierung waehrend des Ziehens
    boxEl = document.createElement("div");
    Object.assign(boxEl.style, {
      position: "fixed", left: x + "px", top: y + "px", width: "0px", height: "0px",
      border: "2px solid #e11d48", background: "rgba(225,29,72,0.10)", borderRadius: "4px",
      zIndex: "2147483647", pointerEvents: "none", boxSizing: "border-box"
    });
    (document.body || document.documentElement).appendChild(boxEl);
  }

  function boxRect(x, y) {
    return { left: Math.min(boxStartX, x), top: Math.min(boxStartY, y), right: Math.max(boxStartX, x), bottom: Math.max(boxStartY, y) };
  }

  function moveBox(x, y) {
    if (!boxEl) return;
    const r = boxRect(x, y);
    Object.assign(boxEl.style, { left: r.left + "px", top: r.top + "px", width: (r.right - r.left) + "px", height: (r.bottom - r.top) + "px" });
  }

  // Alle Woerter, deren Mitte im Rahmen liegt
  function collectBoxWords(r) {
    const words = [];
    if (!document.body) return words;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p || p.closest("script,style,noscript,textarea,input,select")) return NodeFilter.FILTER_REJECT;
        if (boxEl && boxEl.contains(n)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const range = document.createRange();
    let n;
    while ((n = walker.nextNode())) {
      range.selectNodeContents(n);
      const nr = range.getBoundingClientRect();
      if (nr.width === 0 || nr.right < r.left || nr.left > r.right || nr.bottom < r.top || nr.top > r.bottom) continue;
      const re = /\S+/g;
      let m;
      while ((m = re.exec(n.nodeValue))) {
        const wr = document.createRange();
        wr.setStart(n, m.index);
        wr.setEnd(n, m.index + m[0].length);
        const b = wr.getBoundingClientRect();
        if (b.width === 0) continue;
        const cx = (b.left + b.right) / 2;
        const cy = (b.top + b.bottom) / 2;
        if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
          words.push({ range: wr, text: m[0], top: b.top, bottom: b.bottom, node: n });
        }
      }
    }
    return words;
  }

  function endBox(x, y) {
    if (!boxActive) return;
    boxActive = false;
    document.documentElement.style.userSelect = boxUserSelectOld;
    suppressContextMenuUntil = Date.now() + 800;
    const r = boxRect(x, y);
    if (boxEl) { boxEl.remove(); boxEl = null; }
    if (r.right - r.left < 6 || r.bottom - r.top < 6) return;
    const words = collectBoxWords(r);
    if (words.length === 0) { showToast(t("noText"), "#e11d48"); return; }
    // Text zusammensetzen: neue Zeile, wenn das Wort deutlich tiefer steht
    let text = "";
    let prev = null;
    for (const w of words) {
      if (prev) text += (w.top > prev.bottom - 2 && w.node !== prev.node) ? "\n" : " ";
      text += w.text;
      prev = w;
    }
    text = text.replace(/ +/g, " ").trim();
    // Rot markieren (eigene Markierung, die blaue bleibt aus)
    try {
      if (window.CSS && CSS.highlights && window.Highlight) {
        ensureBoxStyle();
        CSS.highlights.set(BOX_HL, new Highlight(...words.map((w) => w.range)));
      }
    } catch (_) {}
    const span = document.createRange();
    span.setStart(words[0].range.startContainer, words[0].range.startOffset);
    const last = words[words.length - 1].range;
    span.setEnd(last.endContainer, last.endOffset);
    lastSelText = "";
    processPickedText(text, span);
  }

  window.addEventListener("mousedown", (e) => {
    // Zweite Taste dazu gedrueckt (links + rechts) = Rahmen starten
    if (selectBox && currentMode !== "off" && (e.buttons & 3) === 3 && (e.button === 0 || e.button === 2) &&
        !boxActive && !isInputActive(e.target)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      startBox(e.clientX, e.clientY);
      return;
    }
    // Normaler Klick: rote Markierung vom letzten Mal weg
    if (e.button === 0 && !boxActive) clearBoxHighlight();
  }, true);

  window.addEventListener("mousemove", (e) => {
    if (!boxActive) return;
    if ((e.buttons & 3) === 0) { endBox(e.clientX, e.clientY); return; } // Loslassen verpasst
    e.preventDefault();
    e.stopImmediatePropagation();
    moveBox(e.clientX, e.clientY);
  }, true);

  window.addEventListener("mouseup", (e) => {
    if (boxActive) {
      e.preventDefault();
      e.stopImmediatePropagation();
      endBox(e.clientX, e.clientY);
    }
    // erst wenn beide Tasten los sind, wieder normal arbeiten
    if (boxBlockMouseup && (e.buttons & 3) === 0) setTimeout(() => { boxBlockMouseup = false; }, 60);
    if (boxBlockMouseup) e.stopImmediatePropagation();
  }, true);

  window.addEventListener("click", (e) => {
    if (boxBlockMouseup) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // ===================== Weitere Maus- und Tasten-Ereignisse =====================
  window.addEventListener("mousedown", (e) => {
    // Rechte Taste auf dem Video: beim Scrollen = schnelles Tempo
    if (e.button === 2 && enableWheel && (isFullscreenActive() || videoUnderPointer(e.clientX, e.clientY))) {
      rightHeld = true;
      rightWheeled = false;
    }

    // Modus "normal markieren": Rechtsklick auf Markierung kurz = Markierung weg, halten = normales Menue
    if (e.button === 2 && !selectBox) {
      clearTimeout(rightHoldTimer);
      rightDownTime = 0;
      const sel = window.getSelection();
      if (currentMode !== "off" && sel && !sel.isCollapsed && sel.toString().trim() &&
          !isInputActive(e.target) && !isInputActive(document.activeElement)) {
        rightDownTime = Date.now();
        rightHoldTimer = setTimeout(() => showToast(t("releaseMenu"), "#10b981"), RIGHT_HOLD_MS);
      }
    }

    // Klick stoppt das Vorlesen (Klick auf die Uebersetzung kopiert sie)
    if (activeOverlay && !activeOverlay.contains(e.target)) {
      stopAllSpeechAndOverlay();
    } else if (!activeOverlay) {
      isSpeaking = false;
      speechQueue = [];
      window.speechSynthesis.cancel();
    }
  }, true);

  window.addEventListener("mouseup", (e) => {
    if (e.button !== 2 || !rightHeld) return;
    rightHeld = false;
    if (rightWheeled) {
      suppressContextMenuUntil = Date.now() + 800; // nach "halten + scrollen" kein Rechtsklick-Menue
      e.preventDefault();
      e.stopPropagation();
    }
    rightWheeled = false;
  }, true);

  window.addEventListener("contextmenu", (e) => {
    if (boxBlockMouseup || Date.now() < suppressContextMenuUntil) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Unter Windows kommt das Menue erst beim Loslassen: so lange wurde gehalten
    if (rightDownTime) {
      const held = Date.now() - rightDownTime;
      rightDownTime = 0;
      clearTimeout(rightHoldTimer);
      if (held < RIGHT_HOLD_MS) {
        e.preventDefault();
        e.stopPropagation();
        const sel = window.getSelection();
        if (sel) sel.removeAllRanges();
        lastSelText = "";
      }
    }
  }, true);

  window.addEventListener("wheel", (e) => {
    if (!enableWheel || e.deltaY === 0 || e.ctrlKey) return;
    // Im Vollbild ueberall, sonst nur wenn die Maus auf dem Video ist
    const fullscreen = isFullscreenActive();
    const under = fullscreen ? null : videoUnderPointer(e.clientX, e.clientY);
    if (!fullscreen && !under) return;
    const deltaSeconds = stepFor(e.deltaY < 0);
    const fast = rightHeld || (e.buttons & 2) === 2;
    if (fast) rightWheeled = true;
    let ok = false;
    forcedVideo = under;
    try { ok = wheelMove(deltaSeconds, fast); } finally { forcedVideo = null; }
    if (ok) {
      e.preventDefault();
      e.stopPropagation();
    } else if (fullscreen) {
      broadcastCommand({ jesterCmd: "WHEEL_FF", delta: deltaSeconds, fast });
    }
  }, { passive: false, capture: true });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      clearBoxHighlight();
      stopAllSpeechAndOverlay();
      return;
    }
    if (isInputActive(e.target) || isInputActive(document.activeElement)) return;
    // Spul-Tasten (Standard Pfeile) im Vollbild: springen immer, auch wenn vorher etwas anderes angeklickt wurde
    if (enableWheel && isFullscreenActive() && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey &&
        (keyIs(e, keyBack) || keyIs(e, keyFwd))) {
      const delta = stepFor(keyIs(e, keyFwd));
      if (seekVideoByDelta(delta)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      } else if (document.querySelector("iframe")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        broadcastCommand({ jesterCmd: "WHEEL_SEEK", delta });
      }
      return;
    }

    // Lautstaerke-Boost (Standard V = naechste Stufe, Shift+V = sofort aus)
    if (enableAudio && !e.ctrlKey && !e.altKey && !e.metaKey && keyIs(e, keyBoost)) {
      if (getActiveMedia()) {
        e.preventDefault();
        e.stopPropagation();
        cycleAudioStage(e.shiftKey);
      } else {
        broadcastCommand({ jesterCmd: "TOGGLE_AUDIO", off: e.shiftKey });
      }
    }
  }, true);

  window.addEventListener("blur", () => { rightHeld = false; });

  // Modus "normal markieren": blaue Markierung mit links loest Vorlesen/Uebersetzen aus
  document.addEventListener("mouseup", (e) => {
    if (selectBox || currentMode === "off" || e.button !== 0 || e.ctrlKey || e.altKey || isInputActive(e.target)) return;
    setTimeout(() => handleSelection(), 15);
  });

  window.speechSynthesis.getVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
})();
