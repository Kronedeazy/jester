// Microsoft-Stimme (Azure): holt die Sprache Stueck fuer Stueck und spielt sie unsichtbar ab.
// Das erste Stueck spielt schon, waehrend es noch laedt (schneller Start); die weiteren werden
// geladen, waehrend das vorige laeuft (keine Pausen dazwischen).
// Tempo: Microsoft spricht selbst bis 2x schneller (klingt natuerlich), alles darueber
// wird beim Abspielen mit gleicher Tonhoehe nachgeschoben.
const MAX_SYNTH_RATE = 2.0;
const FORMAT = "audio-24khz-96kbitrate-mono-mp3";
let job = null;

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function synthRateFor(rate) {
  return Math.max(0.5, Math.min(MAX_SYNTH_RATE, rate));
}

function endpoint(region) {
  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
}

// Startet die Anfrage; liefert die Antwort, sobald die ersten Daten kommen
async function request(j, chunk, rate) {
  const sr = synthRateFor(rate);
  const pct = Math.round((sr - 1) * 100);
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="de-DE">` +
    `<voice name="${j.voice}"><prosody rate="${pct >= 0 ? "+" : ""}${pct}%">${esc(chunk.text)}</prosody></voice></speak>`;
  const r = await fetch(endpoint(j.region), {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": j.key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": FORMAT
    },
    body: ssml,
    signal: j.abort.signal
  });
  if (!r.ok) { const e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
  return { response: r, synthRate: sr, chars: chunk.text.length };
}

// Ganzes Stueck laden (fuer die vorgeladenen Folgestuecke)
async function synth(j, chunk, rate) {
  const it = await request(j, chunk, rate);
  const blob = await it.response.blob();
  if (!blob.size) { const e = new Error("leer"); e.status = 0; throw e; }
  return { url: URL.createObjectURL(blob), synthRate: it.synthRate, chars: it.chars };
}

// Erstes Stueck: abspielen, waehrend es noch laedt
function streamUrl(j, it) {
  if (!window.MediaSource || !MediaSource.isTypeSupported("audio/mpeg") || !it.response.body) return null;
  const ms = new MediaSource();
  const url = URL.createObjectURL(ms);
  ms.addEventListener("sourceopen", async () => {
    let sb;
    try { sb = ms.addSourceBuffer("audio/mpeg"); } catch (e) { return; }
    const reader = it.response.body.getReader();
    const appended = () => new Promise((res) => sb.addEventListener("updateend", res, { once: true }));
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done || j.stopped) break;
        sb.appendBuffer(value);
        await appended();
      }
      if (!j.stopped && ms.readyState === "open") ms.endOfStream();
    } catch (e) {
      if (!j.stopped && ms.readyState === "open") { try { ms.endOfStream("network"); } catch (e2) {} }
    }
  }, { once: true });
  return url;
}

function report(j, type, extra) {
  chrome.runtime.sendMessage(Object.assign({ action: "ttsEvent", type, id: j.id, tabId: j.tabId, frameId: j.frameId }, extra || {}), () => void chrome.runtime.lastError);
}

function stopJob() {
  if (!job) return;
  job.stopped = true;
  try { job.abort.abort(); } catch (e) {}
  if (job.audio) { job.audio.pause(); job.audio.removeAttribute("src"); }
  for (const u of job.urls) URL.revokeObjectURL(u);
  job = null;
}

function playUrl(j, item) {
  return new Promise((resolve, reject) => {
    const a = new Audio();
    a.preload = "auto";
    a.src = item.url;
    j.audio = a;
    j.cur = item;
    a.preservesPitch = true;
    a.playbackRate = Math.max(0.5, j.rate / item.synthRate);
    a.onended = () => resolve();
    a.onerror = () => { const e = new Error("Abspielfehler"); e.status = -1; reject(e); };
    a.onratechange = null;
    const p = a.play();
    if (p) p.catch(reject);
  });
}

async function runJob(j) {
  const n = j.chunks.length;
  // erstes Stueck: Anfrage starten und abspielen, sobald Daten kommen
  let first;
  try {
    first = await request(j, j.chunks[j.start], j.rate);
  } catch (e) {
    if (!j.stopped) report(j, "fail", { i: j.start, status: e.status || 0 });
    return;
  }
  if (j.stopped) return;
  let next = null;
  for (let i = j.start; i < n; i++) {
    let item;
    try {
      if (i === j.start) {
        const sUrl = streamUrl(j, first);
        if (sUrl) item = { url: sUrl, synthRate: first.synthRate, chars: first.chars };
        else {
          const blob = await first.response.blob();
          item = { url: URL.createObjectURL(blob), synthRate: first.synthRate, chars: first.chars };
        }
      } else {
        item = await next;
      }
    } catch (e) {
      if (j.stopped) return;
      report(j, "fail", { i, status: e.status || 0 });
      return;
    }
    if (j.stopped) return;
    j.urls.push(item.url);
    report(j, "chunk", { i, chars: item.chars });
    // naechstes Stueck schon holen
    if (i + 1 < n) { next = synth(j, j.chunks[i + 1], j.rate); next.catch(() => {}); }
    try {
      await playUrl(j, item);
    } catch (e) {
      if (j.stopped) return;
      report(j, "fail", { i, status: e.status || -1 });
      return;
    }
    URL.revokeObjectURL(item.url);
    if (j.stopped) return;
  }
  report(j, "done");
  if (job === j) job = null;
}

// Vorwaermen: Verbindung zu Microsoft schon mal aufbauen (kostet nichts, keine Zeichen)
let lastWarm = 0;
function warm(region) {
  const now = Date.now();
  if (now - lastWarm < 15000) return;
  lastWarm = now;
  fetch(endpoint(region), { method: "HEAD", cache: "no-store" }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== "tts") return false;
  if (msg.cmd === "speak") {
    stopJob();
    job = Object.assign({}, msg, { abort: new AbortController(), urls: [], stopped: false, audio: null, start: msg.start || 0 });
    runJob(job);
    sendResponse({ ok: true });
  } else if (msg.cmd === "stop") {
    if (job && (!msg.id || msg.id === job.id) && (msg.tabId === undefined || msg.tabId === job.tabId)) stopJob();
    sendResponse({ ok: true });
  } else if (msg.cmd === "rate") {
    if (job && (!msg.id || msg.id === job.id)) {
      job.rate = Number(msg.rate) || job.rate;
      if (job.audio && job.cur) job.audio.playbackRate = Math.max(0.5, job.rate / job.cur.synthRate);
    }
    sendResponse({ ok: true });
  } else if (msg.cmd === "warm") {
    warm(msg.region || "westeurope");
    sendResponse({ ok: true });
  }
  return false;
});
