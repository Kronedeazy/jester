// Laeuft direkt in der Seite: Netflix laesst sich nur ueber den eigenen Player spulen.
(() => {
  window.addEventListener("message", (e) => {
    if (!e.data || e.data.source !== "JESTER_CONTENT" || e.data.cmd !== "SEEK_DELTA") return;
    try {
      if (window.netflix && window.netflix.appContext) {
        const vp = window.netflix.appContext.state.playerApp.getAPI().videoPlayer;
        const sids = vp.getAllPlayerSessionIds();
        if (sids && sids.length > 0) {
          const player = vp.getVideoPlayerBySessionId(sids[0]);
          if (player) player.seek(Math.max(0, player.getCurrentTime() + e.data.ms));
        }
      }
    } catch (_) {}
  });
})();
