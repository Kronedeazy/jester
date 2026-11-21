document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const store = (obj, cb) => chrome.storage.local.set(obj, cb);
  const pick = (v, def) => (v !== undefined ? v : def);

  // ===================== Texte Deutsch / Englisch =====================
  const STR = {
    de: {
      tagline: "Lautstärke • Vorlesen • Video-Spulen",
      langTitle: "Sprache: Deutsch / English",
      demoTitle: "Demo-Modus: erklärt alles, Tasten ändern",
      demoIntro: "<b>Demo-Modus</b>: Unter jedem Bereich steht jetzt, was er macht und wie du ihn bedienst. Ganz oben kannst du die <b>Tasten ändern</b>. Nochmal auf <b>D</b> klicken blendet alles wieder aus.",
      keysTitle: "Tasten",
      keysReset: "Standard",
      keyBoost: "Lautstärke-Boost (mit Shift = aus)",
      keyBack: "Zurückspringen (Vollbild)",
      keyFwd: "Vorspringen (Vollbild)",
      keyMode: "Vorlese-Modus wechseln",
      keyModeChange: "in Chrome ändern",
      keyFrame: "Roter Rahmen",
      keyFrameVal: "Links + Rechts ziehen",
      keyTurbo: "Turbo-Vorspulen",
      keyTurboVal: "Rechte Taste + Mausrad",
      keysHint: "Auf eine Taste klicken, dann die neue Taste drücken. Esc = abbrechen.",
      keyListening: "Taste drücken…",
      keyTaken: "Diese Taste ist schon belegt.",
      keyBad: "Diese Taste geht nicht – bitte eine andere.",
      boostTitle: "Lautstärke-Boost (Taste {K})",
      level: "STUFE",
      explainBoost: "Macht Videos und Musik lauter als die normale 100&nbsp;%-Grenze. <b>{K}</b> schaltet weiter: Aus &rarr; Stufe 1 &rarr; 2 &rarr; 3 &rarr; Aus. <b>Shift+{K}</b> = sofort aus. Gilt nur für den aktuellen Tab, das Symbol oben zeigt dann z.&nbsp;B. <b>+6</b>.<br>Laute Stellen (Explosionen, Intros) werden automatisch gezähmt, leise Stimmen bekommen den vollen Boost. Ein Schutz verhindert Kratzen.<br>Faustregel: <b>+6&nbsp;dB</b> &asymp; deutlich lauter, <b>+10&nbsp;dB</b> &asymp; doppelt so laut. Bei Netflix &amp; Co. (Kopierschutz) geht der Boost nicht.",
      readTitle: "Vorlesen & Übersetzen",
      modeReader: "Original vorlesen",
      modeOverlay: "DE + Overlay",
      modeAudio: "DE ohne Overlay",
      modeOff: "Aus",
      rate: "Vorlesetempo",
      ttsOverlay: "Im Overlay-Modus zusätzlich vorlesen",
      selectBox: "Markieren mit linker + rechter Taste",
      selectOn: "<b>Markieren mit linker + rechter Taste (an)</b>: Beide Maustasten halten und ziehen &rarr; roter Rahmen. Nur der Text darin wird vorgelesen bzw. übersetzt. Ist im Rahmen kein Text (Bild, Video-Untertitel, Foto), liest Jester den Text aus dem Bild (ca. 1&nbsp;s) und zeigt den Rahmen als rote Box. Steht dort gar nichts: &bdquo;Kein Text gefunden&ldquo;.<br>Die rote Markierung funktioniert <b>wie eine normale Markierung</b>: <b>Klick irgendwo</b> = Markierung weg, Vorlesen stoppt. <b>Rechtsklick</b> drauf = Menü zum Kopieren. <b>Gedrückt halten und ziehen</b> = Text irgendwo ablegen. <b>Esc</b> = stoppen (beim Ziehen: Rahmen abbrechen). Tab wechseln stört nicht. Nach dem Vorlesen verschwindet sie von selbst. Normales blaues Markieren löst nichts aus, Kopieren geht wie immer.",
      selectOff: "<b>Markieren mit linker + rechter Taste (aus)</b>: Normal mit der linken Taste markieren, das Markierte wird sofort vorgelesen bzw. übersetzt. <b>Rechtsklick kurz</b> = Markierung weg, <b>kurz halten (0,3&nbsp;s)</b> = normales Rechtsklick-Menü (Kopieren usw.).",
      explainRead: "<b>Original vorlesen</b>: liest den Text in seiner Sprache vor (Deutsch, Englisch, Polnisch, Russisch, Japanisch werden erkannt).<br><b>DE + Overlay</b>: übersetzt ins Deutsche und legt die Übersetzung als Kasten über den Text, ein Klick darauf kopiert sie.<br><b>DE ohne Overlay</b>: übersetzt und liest nur vor.<br><b>Esc</b> oder ein Klick stoppt. <b>Alt+Shift+S</b> wechselt den Modus. Auch über Rechtsklick &rarr; &bdquo;Markierung vorlesen / übersetzen&ldquo;.",
      wheelTitle: "Mausrad & Pfeile (Video)",
      stepSec: "Sekunden pro Schritt",
      sec: "Sek.",
      ffSlow: "Tempo: nur scrollen",
      ffFast: "Tempo: rechte Taste halten + scrollen",
      ffHint: "Pro Raste {S} s Video: {A} s lang schnell, mit rechter Taste {B} s",
      explainWheel: "<b>Rad hoch</b> = vorspulen: Das Video läuft kurz schneller, bis die eingestellten Sekunden geschafft sind (5&nbsp;s bei 5x = 1&nbsp;s lang schnell). Mehrmals drehen = länger.<br><b>Rechte Taste halten + Rad</b> = schnelles Tempo. <b>Rechtsklick während des Vorspulens</b> = sofort stoppen, das Video läuft an der Stelle normal weiter.<br><b>Rad runter</b> = zurückspringen. Das Rad wirkt im Vollbild überall, sonst sobald die Maus auf dem Video ist.<br><b>{B} {F}</b> = im Vollbild sofort springen. Die Anzeige zählt gleiche Richtung zusammen (+5s, +10s &hellip;); wechselst du die Richtung (beim Vorspulen und bis 2&nbsp;s danach), fängt sie neu an.",
      footerKeys: "<strong>{K}</strong> Lautstärke &bull; <strong>Alt+Shift+S</strong> Lesemodus",
      toasts: "Hinweise",
      explainToasts: "<b>Hinweise</b>: So lange bleiben die kleinen Meldungen oben rechts im Video sichtbar (z.&nbsp;B. &bdquo;+5s&ldquo; oder &bdquo;Stufe 2&ldquo;).",
      space: "Leertaste",
      azVoice: "Microsoft-Stimme (optional)",
      azKeyLabel: "Schlüssel",
      azKeyPh: "aus dem Azure-Portal einfügen",
      azRegion: "Region",
      azTest: "Testen",
      azOff: "Natürlichere Vorlese-Stimme (Seraphina). Kostenlos bis 500.000 Zeichen im Monat, braucht ein Microsoft-Azure-Konto. <a href=\"https://github.com/Kronedeazy/jester#microsoft-voice-optional\" target=\"_blank\">Anleitung</a>",
      azNoKey: "Noch kein Schlüssel – es liest die normale Stimme. <a href=\"https://github.com/Kronedeazy/jester#microsoft-voice-optional\" target=\"_blank\">Anleitung (ca. 10 Min.)</a>",
      azUsage: "Diesen Monat: <b>{N}</b> von 500.000 Zeichen frei. Danach (oder ohne Internet) liest die normale Stimme. Der markierte Text geht dabei an Microsoft.",
      azNeedKey: "<b>Erst den Schlüssel einfügen.</b>",
      azTesting: "Teste &hellip;",
      azBadKey: "<b>Schlüssel oder Region passt nicht.</b>",
      azQuota: "<b>Kontingent aufgebraucht oder gesperrt.</b>",
      azErr: "<b>Fehler {N}</b>",
      azOk: "<b style='color:#10b981'>Klappt!</b>",
      azNoNet: "<b>Keine Verbindung.</b>",
      azSample: "Hallo, ich bin Jester. So klinge ich mit der Microsoft-Stimme."
    },
    en: {
      tagline: "Volume • Read aloud • Video scrubbing",
      langTitle: "Language: English / Deutsch",
      demoTitle: "Demo mode: explains everything, change keys",
      demoIntro: "<b>Demo mode</b>: Each section now explains what it does and how to use it. At the top you can <b>change the keys</b>. Click <b>D</b> again to hide it all.",
      keysTitle: "Keys",
      keysReset: "Defaults",
      keyBoost: "Volume boost (with Shift = off)",
      keyBack: "Jump back (fullscreen)",
      keyFwd: "Jump forward (fullscreen)",
      keyMode: "Switch read mode",
      keyModeChange: "change in Chrome",
      keyFrame: "Red frame",
      keyFrameVal: "Drag with left + right",
      keyTurbo: "Turbo fast-forward",
      keyTurboVal: "Right button + wheel",
      keysHint: "Click a key, then press the new key. Esc = cancel.",
      keyListening: "Press a key…",
      keyTaken: "This key is already in use.",
      keyBad: "This key can't be used – please pick another.",
      boostTitle: "Volume boost (key {K})",
      level: "LEVEL",
      explainBoost: "Makes videos and music louder than the normal 100&nbsp;% limit. <b>{K}</b> cycles: off &rarr; level 1 &rarr; 2 &rarr; 3 &rarr; off. <b>Shift+{K}</b> = off right away. Applies to the current tab only; the toolbar icon then shows e.g. <b>+6</b>.<br>Loud parts (explosions, intros) are tamed automatically, quiet voices get the full boost. A limiter prevents distortion.<br>Rule of thumb: <b>+6&nbsp;dB</b> &asymp; clearly louder, <b>+10&nbsp;dB</b> &asymp; twice as loud. Not possible on Netflix &amp; co. (copy protection).",
      readTitle: "Read aloud & translate",
      modeReader: "Read original",
      modeOverlay: "EN + overlay",
      modeAudio: "EN without overlay",
      modeOff: "Off",
      rate: "Reading speed",
      ttsOverlay: "Also read aloud in overlay mode",
      selectBox: "Select with left + right button",
      selectOn: "<b>Select with left + right button (on)</b>: Hold both mouse buttons and drag &rarr; red frame. Only the text inside is read or translated. No text in the frame (image, video subtitles, photo)? Jester reads the text from the image (about 1&nbsp;s) and shows the frame as a red box. Nothing there: &bdquo;No text found&ldquo;.<br>The red marking works <b>like a normal selection</b>: <b>click anywhere</b> = marking gone, reading stops. <b>Right-click</b> it = menu to copy. <b>Hold and drag</b> = drop the text anywhere. <b>Esc</b> = stop (while dragging: cancel the frame). Switching tabs doesn't interrupt it. It disappears by itself when reading is done. Normal blue selecting does nothing, copying works as usual.",
      selectOff: "<b>Select with left + right button (off)</b>: Select normally with the left button; the selection is read or translated right away. <b>Short right-click</b> = clear selection, <b>hold briefly (0.3&nbsp;s)</b> = normal context menu (copy etc.).",
      explainRead: "<b>Read original</b>: reads the text in its own language (German, English, Polish, Russian, Japanese are detected).<br><b>EN + overlay</b>: translates into English and shows the translation as a box over the text; click it to copy.<br><b>EN without overlay</b>: translates and only reads aloud.<br><b>Esc</b> or a click stops. <b>Alt+Shift+S</b> switches the mode. Also via right-click &rarr; &bdquo;Read / translate selection&ldquo;.",
      wheelTitle: "Mouse wheel & arrows (video)",
      stepSec: "Seconds per step",
      sec: "sec",
      ffSlow: "Speed: scroll only",
      ffFast: "Speed: hold right button + scroll",
      ffHint: "Per notch {S} s of video: {A} s fast, with right button {B} s",
      explainWheel: "<b>Wheel up</b> = fast-forward: the video briefly plays faster until the set seconds are covered (5&nbsp;s at 5x = 1&nbsp;s fast). Scroll more = longer.<br><b>Hold right button + wheel</b> = turbo speed. <b>Right-click while fast-forwarding</b> = stop right away, the video keeps playing normally from there.<br><b>Wheel down</b> = jump back. The wheel works anywhere in fullscreen, otherwise when the mouse is over the video.<br><b>{B} {F}</b> = jump instantly in fullscreen. The counter adds up the same direction (+5s, +10s &hellip;); switch direction (while fast-forwarding and up to 2&nbsp;s after) and it starts over.",
      footerKeys: "<strong>{K}</strong> Volume &bull; <strong>Alt+Shift+S</strong> Read mode",
      toasts: "Hints",
      explainToasts: "<b>Hints</b>: How long the small messages stay visible at the top right of the video (e.g. &bdquo;+5s&ldquo; or &bdquo;Level 2&ldquo;).",
      space: "Space",
      azVoice: "Microsoft voice (optional)",
      azKeyLabel: "Key",
      azKeyPh: "paste from the Azure portal",
      azRegion: "Region",
      azTest: "Test",
      azOff: "More natural reading voice (Ava). Free up to 500,000 characters a month, needs a Microsoft Azure account. <a href=\"https://github.com/Kronedeazy/jester#microsoft-voice-optional\" target=\"_blank\">Guide</a>",
      azNoKey: "No key yet – the normal voice reads. <a href=\"https://github.com/Kronedeazy/jester#microsoft-voice-optional\" target=\"_blank\">Guide (about 10 min)</a>",
      azUsage: "This month: <b>{N}</b> of 500,000 free characters used. After that (or offline) the normal voice reads. The selected text is sent to Microsoft.",
      azNeedKey: "<b>Paste the key first.</b>",
      azTesting: "Testing &hellip;",
      azBadKey: "<b>Key or region doesn't match.</b>",
      azQuota: "<b>Quota used up or blocked.</b>",
      azErr: "<b>Error {N}</b>",
      azOk: "<b style='color:#10b981'>Works!</b>",
      azNoNet: "<b>No connection.</b>",
      azSample: "Hi, I'm Jester. This is how I sound with the Microsoft voice."
    }
  };

  const DEF_KEYS = { key_boost: "v", key_back: "ArrowLeft", key_fwd: "ArrowRight" };
  let lang = (navigator.language || "en").toLowerCase().startsWith("de") ? "de" : "en";
  let keys = Object.assign({}, DEF_KEYS);
  let selectOn = true;
  const S = (k) => STR[lang][k];

  function keyName(k) {
    if (!k) return "–";
    const named = { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", " ": S("space") };
    if (named[k]) return named[k];
    return k.length === 1 ? k.toUpperCase() : k;
  }

  // Alle Texte setzen (bei Sprachwechsel und Tastenwechsel neu)
  function render() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = S(el.dataset.i18n)));
    document.querySelectorAll("[data-i18n-html]").forEach((el) => (el.innerHTML = S(el.dataset.i18nHtml)));
    document.querySelectorAll("[data-i18n-title]").forEach((el) => (el.title = S(el.dataset.i18nTitle)));
    const K = keyName(keys.key_boost);
    $("boost-title").textContent = S("boostTitle").replace("{K}", K);
    $("explain-boost").innerHTML = S("explainBoost").split("{K}").join(K);
    $("explain-wheel").innerHTML = S("explainWheel").replace("{B}", keyName(keys.key_back)).replace("{F}", keyName(keys.key_fwd));
    $("footer-keys").innerHTML = S("footerKeys").replace("{K}", K);
    $("explain-select").innerHTML = selectOn ? S("selectOn") : S("selectOff");
    $("lang-btn").textContent = lang.toUpperCase();
    document.querySelectorAll(".key-btn").forEach((b) => {
      if (!b.classList.contains("listening")) b.textContent = keyName(keys[b.dataset.key]);
    });
    updateFfHint();
    try { azRender(); } catch (e) {}
  }

  // === Microsoft-Stimme (optional) ===
  const azOn = $("azure-on"), azKey = $("azure-key"), azRegion = $("azure-region"), azInfo = $("azure-info");
  const AZ_VOICES = { de: "de-DE-SeraphinaMultilingualNeural", en: "en-US-AvaMultilingualNeural" };
  let azUsage = 0, azMsg = "";
  function azRender(msg) {
    if (msg !== undefined) azMsg = msg;
    azKey.placeholder = S("azKeyPh");
    $("azure-box").style.display = azOn.checked ? "" : "none";
    const num = azUsage.toLocaleString(lang === "de" ? "de-DE" : "en-US");
    const base = !azOn.checked ? S("azOff") : azKey.value.trim() ? S("azUsage").replace("{N}", num) : S("azNoKey");
    azInfo.innerHTML = (azMsg ? azMsg + "<br>" : "") + base;
  }
  azOn.addEventListener("change", () => { store({ azure_on: azOn.checked }); azRender(""); });
  azKey.addEventListener("change", () => { store({ azure_key: azKey.value.trim() }); azRender(""); });
  azRegion.addEventListener("change", () => store({ azure_region: azRegion.value }));
  $("azure-test").addEventListener("click", async () => {
    const key = azKey.value.trim();
    if (!key) { azRender(S("azNeedKey")); return; }
    store({ azure_key: key, azure_region: azRegion.value });
    azRender(S("azTesting"));
    const want = Number($("rate-slider").value) || 1.35;
    const rate = Math.min(2, Math.max(0.5, want));
    const pct = Math.round((rate - 1) * 100);
    const ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="' + (lang === "de" ? "de-DE" : "en-US") + '"><voice name="' + AZ_VOICES[lang] + '"><prosody rate="' + (pct >= 0 ? "+" : "") + pct + '%">' + S("azSample") + '</prosody></voice></speak>';
    try {
      const r = await fetch("https://" + azRegion.value + ".tts.speech.microsoft.com/cognitiveservices/v1", {
        method: "POST",
        headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3" },
        body: ssml
      });
      if (!r.ok) {
        azRender(r.status === 401 ? S("azBadKey") : r.status === 429 || r.status === 403 ? S("azQuota") : S("azErr").replace("{N}", r.status));
        return;
      }
      const a = new Audio(URL.createObjectURL(await r.blob()));
      a.preservesPitch = true;
      a.playbackRate = Math.max(1, want / rate);
      a.play();
      azRender(S("azOk"));
    } catch (e) {
      azRender(S("azNoNet"));
    }
  });

  // === Demo-Modus (D) ===
  $("demo-btn").addEventListener("click", () => document.body.classList.toggle("demo"));

  // === Sprache ===
  $("lang-btn").addEventListener("click", () => {
    lang = lang === "de" ? "en" : "de";
    store({ lang });
    render();
  });

  // === Tasten aendern ===
  let listening = null;
  function stopListening() {
    if (listening) listening.classList.remove("listening");
    listening = null;
    $("keys-hint").textContent = S("keysHint");
    render();
  }
  document.querySelectorAll(".key-btn").forEach((b) => {
    b.addEventListener("click", () => {
      if (listening) stopListening();
      listening = b;
      b.classList.add("listening");
      b.textContent = S("keyListening");
    });
  });
  document.addEventListener("keydown", (e) => {
    if (!listening) return;
    e.preventDefault();
    e.stopPropagation();
    const k = e.key;
    if (k === "Escape") { stopListening(); return; }
    if (["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock", "Tab", "Enter", "Dead", "Unidentified"].includes(k)) {
      $("keys-hint").textContent = S("keyBad");
      return;
    }
    const value = k.length === 1 ? k.toLowerCase() : k;
    const field = listening.dataset.key;
    const taken = Object.entries(keys).some(([f, v]) => f !== field && v.toLowerCase() === value.toLowerCase());
    if (taken) {
      $("keys-hint").textContent = S("keyTaken");
      return;
    }
    keys[field] = value;
    store({ [field]: value });
    stopListening();
  }, true);
  $("keys-reset").addEventListener("click", () => {
    keys = Object.assign({}, DEF_KEYS);
    store(DEF_KEYS);
    stopListening();
  });
  $("shortcuts-link").addEventListener("click", () => {
    try { chrome.tabs.create({ url: "chrome://extensions/shortcuts" }); } catch (_) {}
  });

  // === Lautstaerke ===
  const enableAudio = $("enable-audio");
  const DEF_STAGES = [3, 6, 9];
  const boostInputs = [$("boost-1"), $("boost-2"), $("boost-3")];
  const showBoost = () => boostInputs.forEach((inp, i) => ($("boost-" + (i + 1) + "-val").textContent = "+" + inp.value + " dB"));

  // === Vorlesen ===
  const btnReader = $("btn-reader");
  const btnTranslator = $("btn-translator");
  const btnTranslatorAudio = $("btn-translator-audio");
  const btnOff = $("btn-off");
  const rateSlider = $("rate-slider");
  const rateVal = $("rate-val");
  const ttsTranslator = $("tts-translator");
  const selectBox = $("select-box");

  function updateModeUI(mode) {
    btnReader.className = "mode-btn" + (mode === "reader" ? " active-reader" : "");
    btnTranslator.className = "mode-btn" + (mode === "translator" ? " active-translator" : "");
    btnTranslatorAudio.className = "mode-btn" + (mode === "translator_audio" ? " active-translator-audio" : "");
    btnOff.className = "mode-btn" + (mode === "off" ? " active-off" : "");
  }

  // === Mausrad ===
  const enableWheel = $("enable-wheel");
  const wheelStepInput = $("wheel-step");
  const ffRateInput = $("ff-rate");
  const ffFastInput = $("ff-rate-fast");
  const toastSecondsInput = $("toast-seconds");

  // Rechnet vor, wie lange ein Schritt schnell laeuft: Sekunden / Tempo
  function updateFfHint() {
    const step = parseFloat(wheelStepInput.value) || 5;
    const rate = Number(ffRateInput.value) || 3;
    const fast = Number(ffFastInput.value) || 8;
    $("ff-rate-val").textContent = rate + "x";
    $("ff-rate-fast-val").textContent = fast + "x";
    const sec = (r) => {
      const v = String(Math.round((step / r) * 10) / 10);
      return lang === "de" ? v.replace(".", ",") : v;
    };
    $("ff-hint").textContent = S("ffHint").replace("{S}", step).replace("{A}", sec(rate)).replace("{B}", sec(fast));
  }

  chrome.storage.local.get(null, (res) => {
    if (res.lang === "de" || res.lang === "en") lang = res.lang;
    azOn.checked = res.azure_on === true;
    azKey.value = res.azure_key || "";
    azRegion.value = res.azure_region || "germanywestcentral";
    const month = new Date().toISOString().slice(0, 7);
    azUsage = res.azure_usage && res.azure_usage.month === month ? res.azure_usage.chars : 0;
    for (const f of Object.keys(DEF_KEYS)) if (res[f]) keys[f] = res[f];

    enableAudio.checked = pick(res.enable_audio, true);
    const stages = Array.isArray(res.audio_stages) ? res.audio_stages : DEF_STAGES;
    boostInputs.forEach((inp, i) => (inp.value = pick(stages[i], DEF_STAGES[i])));
    showBoost();

    updateModeUI(res.mode || "reader");
    const r = Number(pick(res.rate, 1.35));
    rateSlider.value = r;
    rateVal.textContent = r.toFixed(2) + "x";
    ttsTranslator.checked = pick(res.ttsInTranslator, true);
    selectOn = pick(res.select_box, true);
    selectBox.checked = selectOn;

    enableWheel.checked = pick(res.enable_wheel, true);
    wheelStepInput.value = pick(res.wheel_step, 5);
    ffRateInput.value = Number(pick(res.ff_rate, 3));
    ffFastInput.value = Number(pick(res.ff_rate_fast, 8));
    toastSecondsInput.value = pick(res.toast_seconds, 0.8);
    render();
  });
  render();

  enableAudio.addEventListener("change", () => store({ enable_audio: enableAudio.checked }));
  boostInputs.forEach((inp) => {
    inp.addEventListener("input", () => {
      showBoost();
      store({ audio_stages: boostInputs.map((x) => Number(x.value)) });
    });
  });

  btnReader.addEventListener("click", () => store({ mode: "reader" }, () => updateModeUI("reader")));
  btnTranslator.addEventListener("click", () => store({ mode: "translator" }, () => updateModeUI("translator")));
  btnTranslatorAudio.addEventListener("click", () => store({ mode: "translator_audio" }, () => updateModeUI("translator_audio")));
  btnOff.addEventListener("click", () => store({ mode: "off" }, () => updateModeUI("off")));
  rateSlider.addEventListener("input", () => {
    const val = Number(rateSlider.value);
    rateVal.textContent = val.toFixed(2) + "x";
    store({ rate: val });
  });
  $("reset-rate").addEventListener("click", () => {
    rateSlider.value = 1.35;
    rateVal.textContent = "1.35x";
    store({ rate: 1.35 });
  });
  ttsTranslator.addEventListener("change", () => store({ ttsInTranslator: ttsTranslator.checked }));
  selectBox.addEventListener("change", () => {
    selectOn = selectBox.checked;
    store({ select_box: selectOn });
    render();
  });

  enableWheel.addEventListener("change", () => store({ enable_wheel: enableWheel.checked }));
  wheelStepInput.addEventListener("input", () => {
    const val = parseFloat(wheelStepInput.value);
    updateFfHint();
    if (!isNaN(val) && val > 0) store({ wheel_step: val });
  });
  ffRateInput.addEventListener("input", () => {
    updateFfHint();
    store({ ff_rate: Number(ffRateInput.value) });
  });
  ffFastInput.addEventListener("input", () => {
    updateFfHint();
    store({ ff_rate_fast: Number(ffFastInput.value) });
  });
  toastSecondsInput.addEventListener("input", () => {
    const val = parseFloat(toastSecondsInput.value);
    if (!isNaN(val) && val >= 0.2) store({ toast_seconds: val });
  });
});
