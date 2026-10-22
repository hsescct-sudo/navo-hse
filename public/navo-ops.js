/* NAVO operations helpers, loaded right after the database adapter:
   1. every call to NAVO's own /api/ functions carries the signed-in session, so the server can refuse anonymous use;
   2. browser errors are reported to /api/log (once per message, at most 10 per visit) so problems are seen before users call;
   3. outside production, a strip says which environment you are in. */
'use strict';
(function () {
  const baseFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    try {
      const url = typeof input === 'string' ? input : input && input.url;
      const own = url && (url.startsWith('/api/') || url.startsWith(location.origin + '/api/'));
      if (own) {
        init = { ...(init || {}) };
        const h = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
        if (!h.has('Authorization') && window.L && L.db && L.db.token) { const t = await L.db.token(); if (t) h.set('Authorization', 'Bearer ' + t); }
        init.headers = h;
      }
    } catch (e) { /* never block a request because of the helper */ }
    return baseFetch(input, init);
  };

  const seen = new Set(); let sent = 0;
  function report(kind, msg, src, line, stack) {
    try {
      msg = String(msg || '').slice(0, 500); if (!msg || seen.has(msg) || sent >= 10) return;
      if (/ResizeObserver loop|Script error\.?$/.test(msg)) return;
      seen.add(msg); sent++;
      const body = JSON.stringify({ kind, msg, src: String(src || '').slice(0, 200), line: line || null, stack: String(stack || '').slice(0, 1500), view: window.st && st.view || '', env: window.NAVO_ENV, ua: navigator.userAgent.slice(0, 200), at: new Date().toISOString() });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/log', new Blob([body], { type: 'application/json' }));
      else baseFetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    } catch (e) {}
  }
  window.addEventListener('error', e => report('error', e.message, e.filename, e.lineno, e.error && e.error.stack));
  window.addEventListener('unhandledrejection', e => { const r = e.reason || {}; report('promise', r.message || r, '', null, r.stack); });
  window.navoReportError = (msg, stack) => report('app', msg, '', null, stack);

  if (window.NAVO_ENV && window.NAVO_ENV !== 'production') {
    document.addEventListener('DOMContentLoaded', () => {
      const b = document.createElement('div'); b.className = 'navo-env';
      b.textContent = window.NAVO_ENV === 'staging' ? 'STAGING · test data only' : 'PREVIEW · connected to LIVE data';
      b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:0;z-index:9999;padding:3px 12px;border-radius:8px 8px 0 0;font:700 11px/1.4 system-ui;letter-spacing:.06em;color:#fff;background:' + (window.NAVO_ENV === 'staging' ? '#7c3aed' : '#b42318');
      document.body.appendChild(b);
    });
  }
})();
