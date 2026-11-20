// Texterkennung (OCR) fuer den roten Rahmen, wenn dort kein echter Text ist.
// Laeuft unsichtbar im Add-on, nichts wird ins Internet geschickt.
let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker(["deu", "eng"], 1, {
      workerPath: chrome.runtime.getURL("lib/worker.min.js"),
      corePath: chrome.runtime.getURL("lib/tesseract-core-simd-lstm.wasm.js"),
      langPath: chrome.runtime.getURL("lib/lang"),
      workerBlobURL: false,
      gzip: true,
      cacheMethod: "none"
    }).catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Bild nicht lesbar"));
    img.src = src;
  });
}

// Ausschnitt holen, vergroessern, in Graustufen; helle Schrift auf dunklem Grund wird umgedreht
async function prepareCanvas(dataUrl, rect, dpr) {
  const img = await loadImage(dataUrl);
  const sx = Math.max(0, Math.round(rect.x * dpr));
  const sy = Math.max(0, Math.round(rect.y * dpr));
  const sw = Math.max(1, Math.min(img.width - sx, Math.round(rect.w * dpr)));
  const sh = Math.max(1, Math.min(img.height - sy, Math.round(rect.h * dpr)));
  const scale = Math.max(1, Math.min(3, 900 / Math.max(sw, sh)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const p = data.data;
  let sum = 0;
  for (let i = 0; i < p.length; i += 4) {
    const g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    p[i] = p[i + 1] = p[i + 2] = g;
    sum += g;
  }
  if (sum / (p.length / 4) < 110) {
    for (let i = 0; i < p.length; i += 4) p[i] = p[i + 1] = p[i + 2] = 255 - p[i];
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

// Nur Woerter behalten, bei denen sich die Erkennung halbwegs sicher ist (sonst kommt "Buchstabensalat")
function cleanText(data) {
  const lines = [];
  for (const block of data.blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        // ein einzelner senkrechter Strich am Satzanfang ist fast immer ein grosses I
        const words = (line.words || [])
          .map((w, i) => (i === 0 && /^[|l1]$/.test(w.text) ? Object.assign({}, w, { text: "I", confidence: Math.max(w.confidence, 40) }) : w))
          .filter((w) => w.confidence >= 40 && /[\p{L}\p{N}]/u.test(w.text));
        if (words.length) lines.push(words.map((w) => w.text).join(" "));
      }
    }
  }
  if (lines.length) return lines.join("\n");
  return data.confidence >= 50 ? String(data.text || "") : "";
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== "ocr") return false;
  (async () => {
    try {
      const canvas = await prepareCanvas(msg.dataUrl, msg.rect, Number(msg.dpr) || 1);
      const worker = await getWorker();
      const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
      sendResponse({ text: cleanText(data) });
    } catch (e) {
      sendResponse({ error: String((e && e.message) || e) });
    }
  })();
  return true;
});
