/* NAVO on Supabase: provides the claude.use("db") / claude.use("user") interface the app is written against,
   backed by Supabase Auth and Postgres. Access is enforced by Row Level Security (supabase/schema.sql). */
(function () {
  const cfg = window.NAVO_SUPABASE_CONFIG || {};
  const sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  let session = null, resolveAuthed;
  const authed = new Promise(r => (resolveAuthed = r));

  // App field names <-> table column names
  const TO_COL = { by: "created_by", desc: "description", eventTs: "event_ts", closedAt: "closed_at", planInsp: "plan_insp", planWalk: "plan_walk", walkTarget: "walk_target", originalText: "original_text", personType: "person_type", injuryType: "injury_type", bodyPart: "body_part", incClass: "inc_class", lostDays: "lost_days", sourceId: "source_id" };
  const TO_FIELD = Object.fromEntries(Object.entries(TO_COL).map(([a, b]) => [b, a]));
  const toRow = o => Object.fromEntries(Object.entries(o).filter(([k]) => k !== "id").map(([k, v]) => [TO_COL[k] || k, typeof v === "number" && Math.abs(v) > 1e11 ? Math.round(v) : v]));
  const fromRow = r => Object.fromEntries(Object.entries(r).map(([k, v]) => [TO_FIELD[k] || k, v]));
  const TABLE = { reports: "reports", actions: "actions", inspections: "inspections", activities: "activities", records: "hsse_records", "admin/rv/months": "reviews" };

  const fail = error => { throw { code: error.code === "42501" || /row-level security|permission/i.test(error.message || "") ? "invalid_argument" : error.code === "53100" ? "quota_exceeded" : "unavailable", message: error.message || "" }; };
  const run = async q => { const { data, error } = await q; if (error) fail(error); return data; };
  const snapDoc = (id, data) => ({ id, exists: !!data, data: () => data, metadata: { fromCache: false, hasPendingWrites: false } });
  const snapQuery = rows => { const docs = rows.map(r => snapDoc(String(r.id), fromRow(r))); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {} }; };

  // Fetch now, then refetch whenever the table changes (Row Level Security still applies to what is returned).
  let chan = 0;
  function watch(table, filter, onRows, onErr) {
    let alive = true, t;
    const fetch = async () => {
      // Page through results: the API returns at most 1,000 rows per request.
      const all = [];
      for (let from = 0; ; from += 1000) {
        let q = sb.from(table).select("*").order(table === "members" ? "user_id" : "id").range(from, from + 999);
        if (filter) q = q.eq(filter[0], filter[1]);
        const { data, error } = await q;
        if (!alive) return;
        if (error) { onErr && onErr({ code: "unavailable", message: error.message }); return; }
        all.push(...data);
        if (data.length < 1000) break;
      }
      onRows(all);
    };
    fetch();
    const ch = sb.channel("navo-" + table + "-" + (++chan))
      .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter: filter[0] + "=eq." + filter[1] } : {}) },
        () => { clearTimeout(t); t = setTimeout(fetch, 150); })
      .subscribe();
    return () => { alive = false; sb.removeChannel(ch); };
  }

  function projectsFromRows(rows) { return { list: rows.map(r => ({ id: r.id, name: r.name, country: r.country, headcount: r.headcount, planInsp: r.plan_insp, planWalk: r.plan_walk, platform: r.platform || "Construction", division: r.division || "", cluster: r.cluster || "" })) }; }
  function membersFromRows(rows) { return { map: Object.fromEntries(rows.map(r => [r.user_id, { role: r.role, projects: r.projects || [], leader: !!r.leader, walkTarget: r.walk_target }])) }; }

  async function syncList(table, key, rows) {
    if (rows.length) await run(sb.from(table).upsert(rows, { onConflict: key }));
    const keep = rows.map(r => r[key]);
    let del = sb.from(table).delete();
    del = keep.length ? del.not(key, "in", "(" + keep.map(k => '"' + String(k).replace(/"/g, "") + '"').join(",") + ")") : del.neq(key, "__none__");
    await run(del);
  }

  function docRef(path) {
    const parts = path.split("/"), id = parts.pop(), coll = parts.join("/");
    if (path === "admin/projects") return {
      id, path,
      onSnapshot: (n, e) => watch("projects", null, rows => n(snapDoc(id, projectsFromRows(rows))), e),
      get: async () => snapDoc(id, projectsFromRows(await run(sb.from("projects").select("*")))),
      set: async d => syncList("projects", "id", (d.list || []).map(p => ({ id: p.id, name: p.name, country: p.country, headcount: p.headcount ?? null, plan_insp: p.planInsp ?? null, plan_walk: p.planWalk ?? null, platform: p.platform || "Construction", division: p.division || null, cluster: p.cluster || null })))
    };
    if (path === "admin/members") return {
      id, path,
      onSnapshot: (n, e) => watch("members", null, rows => n(snapDoc(id, membersFromRows(rows))), e),
      get: async () => snapDoc(id, membersFromRows(await run(sb.from("members").select("*")))),
      set: async d => syncList("members", "user_id", Object.entries(d.map || {}).map(([uid, m]) => ({ user_id: uid, role: m.role, projects: m.projects || [], leader: !!m.leader, walk_target: m.walkTarget ?? null })))
    };
    if (path === "admin/checklists" || path === "admin/workflows") { const sid = path.split("/")[1]; return {
      id, path,
      onSnapshot: (n, e) => watch("settings", ["id", sid], rows => n(snapDoc(id, rows[0] ? rows[0].data : undefined)), e),
      get: async () => { const r = await run(sb.from("settings").select("*").eq("id", sid).maybeSingle()); return snapDoc(id, r ? r.data : undefined); },
      set: async d => run(sb.from("settings").upsert({ id: sid, data: d }))
    }; }
    if (path === "admin/structure") return {
      id, path,
      onSnapshot: (n, e) => watch("settings", ["id", "structure"], rows => n(snapDoc(id, rows[0] ? rows[0].data : undefined)), e),
      get: async () => { const r = await run(sb.from("settings").select("*").eq("id", "structure").maybeSingle()); return snapDoc(id, r ? r.data : undefined); },
      set: async d => run(sb.from("settings").upsert({ id: "structure", data: d }))
    };
    const table = TABLE[coll];
    if (!table) throw new TypeError("Unknown path " + path);
    return {
      id, path,
      get: async () => { const r = await run(sb.from(table).select("*").eq("id", id).maybeSingle()); return snapDoc(id, r ? fromRow(r) : undefined); },
      set: async d => run(sb.from(table).upsert({ id, ...toRow(d) })),
      update: async d => run(sb.from(table).update(toRow(d)).eq("id", id)),
      delete: async () => run(sb.from(table).delete().eq("id", id)),
      onSnapshot: (n, e) => watch(table, ["id", id], rows => n(snapDoc(id, rows[0] ? fromRow(rows[0]) : undefined)), e)
    };
  }

  function collection(path, filter) {
    const table = TABLE[path];
    if (!table) throw new TypeError("Unknown collection " + path);
    const q = {
      path,
      where: (f, op, v) => { if (op !== "==") throw new TypeError("Only == filters are supported"); return collection(path, [TO_COL[f] || f, v]); },
      orderBy: () => q, limit: () => q,
      get: async () => { let s = sb.from(table).select("*"); if (filter) s = s.eq(filter[0], filter[1]); return snapQuery(await run(s)); },
      onSnapshot: (n, e) => watch(table, filter, rows => n(snapQuery(rows)), e),
      doc: id => docRef(path + "/" + (id || crypto.randomUUID())),
      add: async d => { const r = await run(sb.from(table).insert(toRow(d)).select("id").single()); return docRef(path + "/" + r.id); }
    };
    return q;
  }
  const db = { doc: docRef, collection: p => collection(p),
    cases: {
      list: async () => {
        const rows = [];
        for (let from = 0; ; from += 1000) {
          const page = await run(sb.from('navo_cases').select('*').order('updated_at', { ascending: false }).order('id').range(from, from + 999));
          rows.push(...page); if (page.length < 1000) return rows;
        }
      },
      create: async (project, case_type, body) => run(sb.from('navo_cases').insert({ project, case_type, body }).select().single()),
      save: async (row, submit) => {
        const rows = await run(sb.from('navo_cases').update({ title: row.title, body: row.body, status: submit ? 'Registered' : row.status })
          .eq('id', row.id).eq('revision', row.revision).select());
        if (!rows.length) throw new Error('This case changed in another window. Reopen it before editing.');
        return rows[0];
      },
      discard: async id => run(sb.from('navo_cases').delete().eq('id', id).eq('status', 'Draft')),
      notes: async id => run(sb.from('navo_case_notes').select('*').eq('case_id', id).order('created_at')),
      medical: async id => run(sb.from('navo_case_medical').select('data').eq('case_id', id).maybeSingle()),
      saveMedical: async (case_id, data) => run(sb.from('navo_case_medical').upsert({ case_id, data })),
      note: async (row, kind, content) => run(sb.from('navo_case_notes').insert({ case_id: row.id, revision: row.revision, kind, content }).select().single()),
      links: async id => run(sb.from('navo_case_links').select('*').or('case_id.eq.' + id + ',target_id.eq.' + id)),
      link: async (case_id, target_id, relation) => run(sb.from('navo_case_links').insert({ case_id, target_id, relation })),
      upload: async (project, caseId, file) => {
        if (file.size > 50 * 1024 * 1024) throw new Error('Maximum file size is 50MB.');
        const path = project + '/cases/' + caseId + '/' + crypto.randomUUID() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        await run(sb.storage.from('photos').upload(path, file, { upsert: false }));
        return { name: file.name, path, size: file.size, type: file.type };
      },
      url: async path => {
        const data = await run(sb.storage.from('photos').createSignedUrl(path, 600)); return data.signedUrl;
      }
    },
    // Bulk helpers used by the admin demo-data tools.
    bulkInsert: async (table, rows) => {
      // Every row in a batch must carry the same columns, or Postgres stores NULL instead of the column default.
      const keys = new Set(); rows.forEach(r => Object.keys(toRow(r)).forEach(k => keys.add(k)));
      const fill = { history: [], status: table === "reports" ? "Open" : null };
      const norm = r => { const o = { id: r.id || crypto.randomUUID(), ...toRow(r) }; keys.forEach(k => { if (o[k] === undefined) o[k] = k in fill ? fill[k] : null; }); return o; };
      for (let i = 0; i < rows.length; i += 200) await run(sb.from(table).insert(rows.slice(i, i + 200).map(norm)));
    },
    removeDemo: async () => run(sb.from("projects").delete().like("id", "demo-%")),
    ai: async (action, payload) => {
      const r = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (session && session.access_token) }, body: JSON.stringify({ action, ...payload }) });
      let j = {}; try { j = await r.json(); } catch (e) {}
      if (!r.ok) throw new Error(j.error || "The AI service is not available right now.");
      return j;
    },
    uploadPhoto: async (project, blob) => {
      const path = project + "/" + crypto.randomUUID() + ".jpg";
      const { error } = await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
      if (error) fail(error);
      return path;
    },
    photoUrl: async path => { const { data, error } = await sb.storage.from("photos").createSignedUrl(path, 600); if (error) fail(error); return data.signedUrl; }
  };

  const cache = {};
  const me = () => session && session.user;
  const user = {
    id: async () => me() ? me().id : null,
    isOwner: async () => { if (!me()) return false; const r = await sb.from("owner").select("user_id").maybeSingle(); return !!(r.data && r.data.user_id === me().id); },
    me: async () => ({ id: me() ? me().id : null, name: me() ? (me().user_metadata?.name || me().email) : "", email: me() ? me().email : null, isOwner: await user.isOwner(), canEdit: false, avatarUrl: "", color: "#0f4c45" }),
    canEdit: async () => false, can: async () => null,
    profiles: async ids => {
      ids = [].concat(ids).filter(Boolean);
      const missing = ids.filter(i => !cache[i]);
      if (missing.length) { const { data } = await sb.from("people").select("*").in("user_id", missing); (data || []).forEach(p => (cache[p.user_id] = p)); missing.forEach(i => (cache[i] = cache[i] || {})); }
      return Object.fromEntries(ids.map(i => [i, { id: i, name: cache[i].name || cache[i].email || "", email: cache[i].email || null, isMe: me() && i === me().id, avatarUrl: "", color: "#0f4c45", guest: false }]));
    },
    search: async q => {
      q = (q || "").trim();
      let s = sb.from("people").select("*").limit(8);
      if (q) s = s.or(`name.ilike.%${q.replace(/[%,()]/g, "")}%,email.ilike.%${q.replace(/[%,()]/g, "")}%`);
      const { data } = await s;
      return (data || []).map(p => { cache[p.user_id] = p; return { id: p.user_id, name: p.name || p.email, email: p.email, isMe: me() && p.user_id === me().id, avatarUrl: "", color: "#0f4c45", guest: false }; });
    }
  };
  window.claude = { use: async n => { await authed; return n === "db" ? db : n === "user" ? user : null; } };

  // ---------- Sign-in screen ----------
  const box = document.getElementById("login");
  const msg = (t, ok) => { const m = document.getElementById("lg-msg"); m.textContent = t; m.style.color = ok ? "var(--ok)" : "var(--crit)"; };
  const nameWrap = document.getElementById("lg-name-wrap");
  let mode = "in";
  document.getElementById("lg-toggle").onclick = () => {
    mode = mode === "in" ? "up" : "in";
    nameWrap.hidden = mode === "in";
    document.getElementById("lg-submit").textContent = mode === "in" ? "Sign in" : "Create account";
    document.getElementById("lg-toggle").textContent = mode === "in" ? "New to NAVO? Create an account" : "Already have an account? Sign in";
    msg("");
  };
  async function start(s) {
    session = s;
    if (!s) { box.hidden = false; return; }
    box.hidden = true;
    const u = s.user;
    await sb.from("people").upsert({ user_id: u.id, name: u.user_metadata?.name || u.email, email: u.email });
    await sb.rpc("claim_owner");
    const ctr = document.querySelector(".ctrls");
    if (ctr && !document.getElementById("signout")) {
      const b = document.createElement("button"); b.id = "signout"; b.className = "btn"; b.textContent = "Sign out";
      b.onclick = () => sb.auth.signOut().then(() => location.reload()); ctr.appendChild(b);
    }
    resolveAuthed();
  }
  sb.auth.getSession().then(({ data }) => start(data.session));
  sb.auth.onAuthStateChange(async (ev, s) => {
    if (s) session = s;
    if (ev === "PASSWORD_RECOVERY") {
      const pw = window.prompt("Choose a new password (at least 8 characters)");
      if (pw && pw.length >= 8) { const { error } = await sb.auth.updateUser({ password: pw }); window.alert(error ? error.message : "Password updated."); }
    }
    if (ev === "SIGNED_IN" && !session) start(s);
  });
  document.getElementById("lg-form").onsubmit = async e => {
    e.preventDefault();
    const email = document.getElementById("lg-email").value.trim(), password = document.getElementById("lg-pass").value;
    if (mode === "up") {
      const name = document.getElementById("lg-name").value.trim();
      if (!name) { msg("Add your full name."); return; }
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
      if (error) { msg(error.message); return; }
      if (!data.session) msg("Check your email and press the confirmation link, then sign in.", true);
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) msg(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
    }
  };
  document.getElementById("lg-reset").onclick = async () => {
    const email = document.getElementById("lg-email").value.trim();
    if (!email) { msg("Type your email first."); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    msg(error ? error.message : "Password reset email sent.", !error);
  };
})();
