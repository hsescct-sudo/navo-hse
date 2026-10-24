/* NAVO usage analytics with PostHog (EU), switched on by a System admin in Settings → Usage analytics.
   Privacy by design, because HSE records name people and injuries:
   - no session recording, no heatmaps, no surveys;
   - nothing typed is captured: autocapture records clicks only, with element text and form values masked;
   - people are identified by an anonymous id (hash of their account id), never by name or email;
   - only the page name is sent (Incidents, CEO report…), never record ids or search text;
   - each person can opt out on their own device. */
'use strict';
const AN = { on: false, key: null, host: 'https://eu.i.posthog.com', view: null };
const anCfg = () => ((L.structure || {}).analytics) || {};
async function anId(uid) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('navo:' + uid)); return [...new Uint8Array(b)].slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join(''); }
const anOptedOut = () => { try { return localStorage.getItem('navo-analytics-optout') === '1'; } catch (e) { return false; } };
function anLoad(key, host) {
  if (window.posthog && window.posthog.__loaded) return;
  /* PostHog's standard loader, pinned to the EU host */
  !function (t, e) { var o, n, p, r; e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) { function g(t, e) { var o = e.split("."); 2 == o.length && (t = t[o[0]], e = o[1]), t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } } (p = t.createElement("script")).type = "text/javascript", p.crossOrigin = "anonymous", p.async = !0, p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js", (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r); var u = e; for (void 0 !== a ? u = e[a] = [] : a = "posthog", u.people = u.people || [], u.toString = function (t) { var e = "posthog"; return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e }, u.people.toString = function () { return u.toString(1) + ".people (stub)" }, o = "init capture register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset identify alias set_config people.set".split(" "), n = 0; n < o.length; n++)g(u, o[n]); e._i.push([i, s, a]) }, e.__SV = 1) }(document, window.posthog || []);
  posthog.init(key, {
    api_host: host, person_profiles: 'identified_only', capture_pageview: false, capture_pageleave: true,
    disable_session_recording: true, enable_heatmaps: false, disable_surveys: true,
    mask_all_text: true, mask_all_element_attributes: true,
    autocapture: { dom_event_allowlist: ['click'], element_allowlist: ['button', 'a'] },
    sanitize_properties: p => { ['$current_url', '$pathname', '$referrer', '$initial_referrer'].forEach(k => { if (p[k]) p[k] = String(p[k]).split(/[?#]/)[0]; }); delete p.$el_text; return p; },
  });
}
async function anStart() {
  const c = anCfg();
  if (!c.key || c.enabled === false || anOptedOut() || !L.me || !L.me.id || window.NAVO_ENV === 'staging') return;
  if (AN.on && AN.key === c.key) return;
  AN.on = true; AN.key = c.key; anLoad(c.key, c.host || AN.host);
  posthog.identify(await anId(L.me.id), { role: typeof myRole === 'function' ? myRole() : '', level: (L.members[L.me.id] || {}).scopeLevel || '' });
  posthog.register({ app: 'navo', env: window.NAVO_ENV || 'production' });
}
function anPage() {
  if (!AN.on || !window.posthog || st.view === AN.view) return; AN.view = st.view;
  posthog.capture('$pageview', { page: st.view, title: (typeof TITLES !== 'undefined' && TITLES[st.view]) || st.view });
}
/* a few named moments that answer the pilot's questions */
window.navoTrack = (event, props) => { try { if (AN.on && window.posthog) posthog.capture(event, Object.fromEntries(Object.entries(props || {}).filter(([, v]) => typeof v !== 'string' || v.length < 40))); } catch (e) {} };

onAfterRender(function () {try { anStart().then(anPage); } catch (e) {}});

/* Settings → Usage analytics (System admin) */
function anSettingsPanel() {
  const c = anCfg();
  return `<div class="panel" id="an-settings"><h2>Usage analytics <small>PostHog, EU</small></h2>
   <p class="mx-muted">Shows who uses NAVO and which pages, to measure the pilot. No screen recording, nothing typed, no names or emails: people appear under an anonymous id.</p>
   <div class="ceo-grid"><div class="fld"><label for="an-key">PostHog project API key</label><input class="mx-in" id="an-key" placeholder="phc_…" value="${esc(c.key || '')}" autocomplete="off"></div>
    <div class="fld"><label for="an-host">Region</label><select class="mx-in" id="an-host"><option value="https://eu.i.posthog.com" ${(c.host || AN.host).includes('eu.') ? 'selected' : ''}>EU (recommended)</option><option value="https://us.i.posthog.com" ${(c.host || '').includes('us.') ? 'selected' : ''}>US</option></select></div></div>
   <div class="filters"><button class="btn pri" data-an-save>Save</button>${c.key ? `<button class="btn" data-an-toggle>${c.enabled === false ? 'Turn analytics on' : 'Turn analytics off'}</button>` : ''}<span class="mx-muted">${!c.key ? 'Off: no key yet.' : c.enabled === false ? 'Off for everyone.' : 'On for everyone' + (anOptedOut() ? ' except you (opted out on this device).' : '.')}</span></div>
   <div class="filters"><button class="btn" data-an-optout>${anOptedOut() ? 'Include me again' : 'Opt me out on this device'}</button></div></div>`;
}
addSettingsPanel(function () { return (myRole() === 'admin' ? anSettingsPanel() : `<div class="panel"><h2>Usage analytics</h2><div class="filters"><button class="btn" data-an-optout>${anOptedOut() ? 'Include me again' : 'Opt me out on this device'}</button></div></div>`); });
document.addEventListener('click', e => {
  const t = e.target.closest('[data-an-save],[data-an-toggle],[data-an-optout]'); if (!t) return; e.preventDefault();
  if (t.hasAttribute('data-an-save')) {
    const key = document.getElementById('an-key').value.trim(), host = document.getElementById('an-host').value;
    if (key && !/^phc_[A-Za-z0-9]{20,}$/.test(key)) { toast('That does not look like a PostHog project key (it starts with phc_).'); return; }
    return ceoStructSave({ analytics: { ...anCfg(), key, host, enabled: true } }, key ? 'Analytics on' : 'Analytics key removed');
  }
  if (t.hasAttribute('data-an-toggle')) return ceoStructSave({ analytics: { ...anCfg(), enabled: anCfg().enabled === false } }, anCfg().enabled === false ? 'Analytics on' : 'Analytics off');
  if (t.hasAttribute('data-an-optout')) { const out = !anOptedOut(); try { localStorage.setItem('navo-analytics-optout', out ? '1' : '0'); } catch (err) {} if (out && window.posthog && posthog.opt_out_capturing) posthog.opt_out_capturing(); if (!out && window.posthog && posthog.opt_in_capturing) posthog.opt_in_capturing(); toast(out ? 'You are opted out on this device' : 'Included again'); render(); }
});
