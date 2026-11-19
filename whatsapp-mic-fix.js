// Mikrofon-Fix fuer WhatsApp Web: automatische Mikrofon-Lautstaerke (Auto Gain)
// und Rauschfilter aus, damit das Mikrofon nicht stottert oder knackt.
// Laeuft ganz frueh (document_start) direkt in der Seite (world MAIN).
(function () {
  'use strict';
  const EINSTELLUNGEN = {
    autoGainControl: false,   // automatische Lautstaerke aus (Hauptursache fuers Stottern)
    noiseSuppression: false,  // Rauschfilter aus
    echoCancellation: true,   // Echo-Unterdrueckung an lassen
    channelCount: 1,
  };
  const md = navigator.mediaDevices;
  if (!md || !md.getUserMedia || md.getUserMedia.__micFix) return;
  const original = md.getUserMedia.bind(md);
  const gepatcht = function (constraints) {
    try {
      if (constraints && constraints.audio) {
        const audio = typeof constraints.audio === 'object' ? { ...constraints.audio } : {};
        Object.assign(audio, EINSTELLUNGEN);
        audio.googAutoGainControl = EINSTELLUNGEN.autoGainControl;
        audio.googAutoGainControl2 = EINSTELLUNGEN.autoGainControl;
        audio.googNoiseSuppression = EINSTELLUNGEN.noiseSuppression;
        audio.googHighpassFilter = false;
        constraints = { ...constraints, audio };
        console.log('[Mikrofon-Fix] angewendet:', audio);
      }
    } catch (e) {
      console.warn('[Mikrofon-Fix] Fehler, nutze Original:', e);
    }
    return original(constraints);
  };
  gepatcht.__micFix = true;
  md.getUserMedia = gepatcht;
})();
