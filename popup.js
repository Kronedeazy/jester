document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const store = (obj, cb) => chrome.storage.local.set(obj, cb);
  const pick = (v, def) => (v !== undefined ? v : def);

  // === Demo-Modus (D): Erklaerungen ein-/ausblenden ===
  $("demo-btn").addEventListener("click", () => document.body.classList.toggle("demo"));

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
  function updateSelectExplain(on) {
    $("explain-select").innerHTML = on
      ? "<b>Markieren mit linker + rechter Taste (an)</b>: Beide Maustasten halten und ziehen &rarr; ein roter Rahmen. Nur der Text darin wird vorgelesen bzw. &uuml;bersetzt. Normales blaues Markieren l&ouml;st nichts aus, Kopieren geht wie immer."
      : "<b>Markieren mit linker + rechter Taste (aus)</b>: Normal mit der linken Taste markieren, das Markierte wird sofort vorgelesen bzw. &uuml;bersetzt. <b>Rechtsklick kurz</b> = Markierung weg, <b>kurz halten (0,3&nbsp;s)</b> = normales Rechtsklick-Men&uuml; (Kopieren usw.).";
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
    const sec = (r) => String(Math.round((step / r) * 10) / 10).replace(".", ",");
    $("ff-hint").textContent = "Pro Raste " + step + " s Video: " + sec(rate) + " s lang schnell, mit rechter Taste " + sec(fast) + " s";
  }

  chrome.storage.local.get(null, (res) => {
    enableAudio.checked = pick(res.enable_audio, true);
    const stages = Array.isArray(res.audio_stages) ? res.audio_stages : DEF_STAGES;
    boostInputs.forEach((inp, i) => (inp.value = pick(stages[i], DEF_STAGES[i])));
    showBoost();

    updateModeUI(res.mode || "reader");
    const r = Number(pick(res.rate, 1.35));
    rateSlider.value = r;
    rateVal.textContent = r.toFixed(2) + "x";
    ttsTranslator.checked = pick(res.ttsInTranslator, true);
    selectBox.checked = pick(res.select_box, true);
    updateSelectExplain(selectBox.checked);

    enableWheel.checked = pick(res.enable_wheel, true);
    wheelStepInput.value = pick(res.wheel_step, 5);
    ffRateInput.value = Number(pick(res.ff_rate, 3));
    ffFastInput.value = Number(pick(res.ff_rate_fast, 8));
    updateFfHint();
    toastSecondsInput.value = pick(res.toast_seconds, 0.8);
  });

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
    updateSelectExplain(selectBox.checked);
    store({ select_box: selectBox.checked });
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
