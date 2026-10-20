import './style.css';
import * as api from './api.js';

const $ = (s) => document.querySelector(s), app = $('#app');
const STAT = ['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Rejected'];
const ST = { submitted: 0, under_review: 1, assigned: 2, in_progress: 3, resolved: 4, rejected: 5 };
const POS = { Banjul: [110, 150], Serrekunda: [160, 170], Brikama: [200, 195], Farafenni: [330, 95], Basse: [520, 110] };
const DEMO = [
  { ref: 'DG-2026-7KQ4M9', title: 'Blocked drainage near the market', cat: 'Water & Drainage', st: 3, area: 'Brikama' },
  { ref: 'DG-2026-3XWH2P', title: 'Damaged road on Banjul Highway', cat: 'Roads & Transport', st: 1, area: 'Banjul' },
  { ref: 'DG-2026-9TNB6C', title: 'Overflowing waste bin', cat: 'Waste & Sanitation', st: 0, area: 'Serrekunda' },
  { ref: 'DG-2026-5RFD8J', title: 'Broken streetlight', cat: 'Electricity & Streetlights', st: 2, area: 'Farafenni' },
  { ref: 'DG-2026-2MGZ4V', title: 'Water leakage on main pipe', cat: 'Water & Drainage', st: 4, area: 'Basse' },
];
const I18N = { en: { tag: 'Your voice. Our community. A better Gambia.', sub: 'Report public issues, track their progress, and help create safer, cleaner, and stronger communities across The Gambia.', rep: 'Report a problem', map: 'Explore community map' }, wo: {}, mnk: {} };
let lang = 'en', user = null, refs = null;
const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.en[k];
const el = (tag, p, ...kids) => { const e = document.createElement(tag); for (const k in p || {}) { if (p[k] == null) continue; k.startsWith('on') ? e.addEventListener(k.slice(2), p[k]) : e.setAttribute(k, p[k]); } kids.flat().forEach((c) => c != null && e.append(c)); return e; };
const chip = (i) => el('span', { class: 'st s' + i }, STAT[i]);
const pill = (txt, demo) => el('span', { class: 'pill' + (demo ? ' demo' : '') }, txt);
const fmt = (s) => new Date(s).toLocaleString();
const getRefs = async () => (refs ||= await api.refs());
const retryBox = (box, fn, msg) => box.replaceChildren(el('p', { class: 'err', role: 'alert' }, msg), el('button', { class: 'btn', onclick: fn }, 'Retry'));

// demo-mode storage (browser only)
const load = () => { try { return JSON.parse(localStorage.getItem('dg_reports') || '[]'); } catch { return []; } };
const save = (a) => { try { localStorage.setItem('dg_reports', JSON.stringify(a)); return true; } catch { return false; } };
const mkRef = () => { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', b = crypto.getRandomValues(new Uint8Array(6)); return 'DG-' + new Date().getFullYear() + '-' + [...b].map((x) => A[x % 31]).join(''); };

const rows = (rs) => rs.length ? rs.map((r) => el('div', { class: 'row' }, el('div', {}, el('b', {}, r.title), el('div', { style: 'font-size:.85rem;color:var(--mut)' }, [r.area, r.cat, r.ref].filter(Boolean).join(' · '))), chip(r.st))) : [el('p', {}, 'No reports to show yet.')];
const fromPublic = (r) => ({ title: r.title, area: r.area, cat: r.category, st: ST[r.status], at: r.created_at, lat: r.lat, lng: r.lng });

// ------------------------------------------------------------------ home
async function home() {
  app.innerHTML = `<section class="hero"><div class="wrap"><h1>${t('tag')}</h1><p>${t('sub')}</p><p class="coast">The Gambia: Smiling Coast of West Africa</p><a class="btn" href="#/report">${t('rep')}</a> <a class="btn alt" href="#/map">${t('map')}</a></div>
<svg class="boats" viewBox="0 0 600 90" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><g id="b"><path d="M0 70 Q30 88 100 70 L92 58 Q50 66 8 58Z"/><path d="M30 58 L36 34 L64 58Z"/></g><use href="#b" x="170" y="6"/><use href="#b" x="360" y="-4"/><use href="#b" x="470" y="8"/></svg></section>
<div class="wrap"><div class="stats" id="st"></div><h2 style="margin-top:2rem">How it works</h2><div class="grid" id="how"></div><h2 style="margin-top:2rem">Recent public reports</h2><div class="card" id="rec">Loading…</div></div>`;
  [['Describe it', 'Pick a category, say what is wrong, and where.'], ['Get a reference', 'Every report gets a unique code you can use to follow it.'], ['Follow progress', 'Check the status timeline until the issue is resolved.']].forEach(([h, p]) => $('#how').append(el('div', { class: 'card' }, el('h3', {}, h), p)));
  const cards = (items, demo) => { $('#st').replaceChildren(...items.map(([n, l]) => el('div', { class: 'card' }, el('b', {}, String(n)), l, demo ? el('div', {}, pill('Demo data', true)) : ''))); };
  if (!api.live) {
    cards([['1,248', 'Reports submitted'], ['892', 'Issues resolved'], ['45', 'Active communities'], ['312', 'In progress']], true);
    $('#rec').replaceChildren(pill('Demo data', true), ...rows(DEMO.slice(0, 4)));
    return;
  }
  try {
    const [s, r] = await Promise.all([api.stats(), api.publicReports()]), b = s.by_status || {};
    cards([[s.total, 'Reports submitted'], [b.resolved || 0, 'Resolved'], [b.in_progress || 0, 'In progress'], [b.under_review || 0, 'Under review']], false);
    $('#rec').replaceChildren(...(r.length ? rows(r.slice(0, 4).map(fromPublic)) : [el('p', {}, 'No reports have been approved for public display yet.')]));
  } catch { cards([['—', 'Reports submitted'], ['—', 'Resolved'], ['—', 'In progress'], ['—', 'Under review']], false); $('#rec').textContent = 'Could not load live data. Check your connection and refresh.'; }
}

// ------------------------------------------------------------------ report form
const KW = { 'Waste & Sanitation': ['waste', 'bin', 'garbage', 'rubbish'], 'Roads & Transport': ['road', 'pothole', 'bridge'], 'Water & Drainage': ['drain', 'water', 'pipe', 'flood', 'leak'], 'Electricity & Streetlights': ['light', 'power', 'electric', 'cable'] };
async function report() {
  const box = el('section', { class: 'wrap narrow' }); app.replaceChildren(box);
  let R; try { R = await getRefs(); } catch { return retryBox(box, () => { refs = null; report(); }, 'Could not load categories. Check your connection.'); }
  const d = { title: '', desc: '', cat: '', area: '', mark: '', coords: null, photo: '', link: false, key: null };
  let s = 1, prev = null, aiNote = '', missing = [];
  const err = el('div', { class: 'err', role: 'alert' });
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const fld = (l, n) => [el('label', {}, l), n];

  async function suggest() {
    if (d.desc.trim().length < 10) { err.textContent = 'Write a longer description first.'; return; }
    const r = await api.ai({ action: 'analyze_draft', title: d.title, description: d.desc });
    if (r.suggestion) {
      const c = R.cats.find((x) => x.slug === r.suggestion.category);
      if (c) d.cat = c.label; missing = r.suggestion.missing_details || [];
      aiNote = r.source === 'ai' ? 'AI suggestion. Check it before you continue.' : 'Keyword rules, not AI';
      draw(); if (!c) err.textContent = 'No clear match. Choose a category yourself.'; return;
    }
    const x = (d.title + ' ' + d.desc).toLowerCase(), m = Object.keys(KW).find((k) => KW[k].some((w) => x.includes(w)));
    if (m && R.cats.some((c) => c.label === m)) { d.cat = m; aiNote = 'Keyword rules, not AI'; draw(); } else err.textContent = r.limited ? 'Too many requests. Wait a few minutes.' : 'No suggestion available. Choose a category yourself.';
  }
  async function tidy() {
    if (d.desc.trim().length < 10) { err.textContent = 'Write or speak your report first.'; return; }
    const r = await api.ai({ action: 'organise', text: `${d.title}. ${d.desc}` });
    if (r.draft) { prev = { title: d.title, desc: d.desc }; d.title = r.draft.title; d.desc = r.draft.description; missing = r.draft.missing_details || []; aiNote = 'AI rewrote your text. Read it and correct it.'; draw(); }
    else err.textContent = r.message || 'AI tidy-up is unavailable. You can submit your own text.';
  }
  function speak() {
    const rec = new SR(); rec.lang = 'en-GB';
    rec.onresult = (e) => { d.desc = (d.desc + ' ' + e.results[0][0].transcript).trim().slice(0, 500); draw(); };
    rec.onerror = () => { err.textContent = 'Voice input did not work. You can type instead.'; };
    rec.start();
  }
  async function submit(btn) {
    btn.disabled = true; err.textContent = '';
    try {
      let ref;
      if (api.live) {
        d.key ||= crypto.randomUUID(); // same key on retry, so a network retry cannot create a duplicate
        ref = await api.submitReport({ title: d.title.trim(), desc: d.desc.trim(), slug: R.cats.find((x) => x.label === d.cat).slug, areaId: R.areas.find((x) => x.name === d.area).id, mark: d.mark.trim(), coords: d.coords, link: d.link }, d.key);
      } else {
        ref = mkRef(); const a = load(); a.push({ ref, title: d.title.trim(), cat: d.cat, area: d.area, st: 0, at: new Date().toISOString(), local: true });
        if (!save(a)) throw new Error('storage');
      }
      box.replaceChildren(el('div', { class: 'card' }, el('h2', {}, api.live ? 'Report submitted' : 'Report saved in demo mode'), el('p', {}, 'Your reference is:'), el('p', { style: 'font:700 1.6rem Georgia,serif;color:var(--pri)' }, ref),
        el('p', {}, api.live ? 'Keep this code to track your report. It appears on the public map only after staff approve it.' : 'Stored in this browser only, not in Supabase.'), el('a', { class: 'btn', href: '#/track/' + ref }, 'Track this report')));
    } catch (e) { err.textContent = api.explain(e); btn.disabled = false; }
  }

  function draw() {
    const c = el('div', { class: 'card' }); box.replaceChildren(c); err.textContent = '';
    c.append(el('h2', {}, 'Tell us what needs attention'), el('div', { class: 'steps' }, ['Issue', 'Location', 'Media', 'Review'].map((n, i) => el('span', { class: i + 1 === s ? 'on' : '', 'aria-current': i + 1 === s ? 'step' : null }, `${i + 1}. ${n}`))));
    if (s === 1) {
      const ca = el('select', { onchange: (e) => { d.cat = e.target.value; } }, el('option', { value: '' }, 'Select a category'), R.cats.map((x) => el('option', { value: x.label }, x.label))); ca.value = d.cat;
      c.append(...fld('Issue title *', el('input', { maxlength: 80, value: d.title, oninput: (e) => { d.title = e.target.value; } })), ...fld('Description * (10 to 500 characters)', el('textarea', { rows: 5, maxlength: 500, oninput: (e) => { d.desc = e.target.value; } }, d.desc)), ...fld('Category *', ca),
        el('p', { style: 'display:flex;gap:.5rem;flex-wrap:wrap;align-items:center' },
          el('button', { class: 'btn alt', type: 'button', onclick: suggest }, 'Suggest category'),
          api.live ? el('button', { class: 'btn alt', type: 'button', onclick: tidy }, 'Tidy my text (AI)') : '',
          SR ? el('button', { class: 'btn alt', type: 'button', title: 'Uses your browser’s speech service; some browsers send audio to their provider', onclick: speak }, '🎤 Speak') : '',
          prev ? el('button', { class: 'btn alt', type: 'button', onclick: () => { Object.assign(d, { title: prev.title, desc: prev.desc }); prev = null; aiNote = ''; draw(); } }, 'Undo AI rewrite') : '', aiNote ? pill(aiNote, !aiNote.startsWith('AI')) : ''),
        missing.length ? el('div', { class: 'card' }, el('b', {}, 'Details that would help:'), el('ul', {}, missing.map((m) => el('li', {}, m)))) : '');
    }
    if (s === 2) {
      const ar = el('select', { onchange: (e) => { d.area = e.target.value; } }, el('option', { value: '' }, 'Select a locality'), R.areas.map((x) => el('option', { value: x.name }, x.name))); ar.value = d.area; const gl = el('p', {});
      c.append(...fld('Locality *', ar), ...fld('Nearest landmark or street', el('input', { maxlength: 100, value: d.mark, oninput: (e) => { d.mark = e.target.value; } })),
        el('button', { class: 'btn alt', type: 'button', onclick: () => { if (!navigator.geolocation) { gl.textContent = 'Location is not available here. Choose a locality instead.'; return; } navigator.geolocation.getCurrentPosition((p) => { d.coords = [+p.coords.latitude.toFixed(2), +p.coords.longitude.toFixed(2)]; gl.textContent = 'Approximate location added.'; }, () => { gl.textContent = 'Permission denied. Choose a locality instead.'; }); } }, 'Use my location (optional)'), gl);
    }
    if (s === 3) {
      const msg = el('p', {}, d.photo ? `Attached on this device only: ${d.photo} (not uploaded).` : '');
      c.append(...fld('Photo (optional, up to 5 MB)', el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', onchange: (e) => { const f = e.target.files[0]; err.textContent = ''; d.photo = ''; msg.textContent = ''; if (!f) return; if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { err.textContent = 'Use a JPEG, PNG, or WebP image.'; e.target.value = ''; return; } if (f.size > 5 * 1048576) { err.textContent = 'Photo is larger than 5 MB.'; e.target.value = ''; return; } d.photo = f.name; msg.textContent = `Attached on this device only: ${f.name} (not uploaded).`; } })), msg, el('p', { style: 'color:var(--mut)' }, 'Photos are not uploaded in this version. Avoid faces and personal details anyway.'));
    }
    if (s === 4) {
      c.append(el('dl', {}, [['Title', d.title], ['Description', d.desc], ['Category', d.cat], ['Locality', d.area + (d.mark ? ', ' + d.mark : '')], ['Photo', d.photo ? d.photo + ' (stays on your device)' : 'None']].flatMap(([k, v]) => [el('dt', { style: 'font-weight:700' }, k), el('dd', { style: 'margin:0 0 .5rem' }, v)])));
      if (api.live && user) c.append(el('label', { style: 'font-weight:400' }, el('input', { type: 'checkbox', style: 'width:auto;margin-right:.5rem', onchange: (e) => { d.link = e.target.checked; } }), 'Link this report to my account (otherwise it stays anonymous and will not appear in My account)'));
    }
    c.append(err);
    c.append(el('div', { style: 'display:flex;gap:.5rem;justify-content:space-between;margin-top:1rem' },
      el('button', { class: 'btn alt', type: 'button', disabled: s === 1 ? '' : null, onclick: () => { s--; draw(); } }, 'Back'),
      el('button', { class: 'btn', type: 'button', onclick: (e) => {
        const m = (s === 1 && (d.title.trim().length < 3 ? 'Enter a title (at least 3 characters).' : d.desc.trim().length < 10 ? 'Describe the issue (at least 10 characters).' : !d.cat ? 'Select a category.' : '')) || (s === 2 && !d.area ? 'Select a locality.' : '');
        if (m) { err.textContent = m; return; }
        if (s < 4) { s++; draw(); } else submit(e.currentTarget);
      } }, s < 4 ? 'Next step' : 'Submit report')));
  }
  draw();
}

// ------------------------------------------------------------------ track
function track(arg) {
  const box = el('section', { class: 'wrap narrow' }); app.replaceChildren(box);
  const out = el('div', { role: 'status' }), inp = el('input', { id: 'q', placeholder: 'e.g. DG-2026-7KQ4M9', maxlength: 20 });
  const show = (r) => out.append(el('div', { class: 'card' }, el('h3', {}, r.title), r.note ? pill(r.note, true) : '', el('p', {}, [r.area, r.cat].filter(Boolean).join(' · ')), el('ol', { class: 'tl' }, r.steps.map((x) => el('li', { class: x.done ? 'd' : '' }, x.text, x.note ? el('div', { style: 'font-size:.9rem' }, x.note) : '')))));
  const go = async (q) => {
    out.replaceChildren(); q = q.trim().toUpperCase();
    if (!/^DG-\d{4}-[A-Z0-9]{6}$/.test(q)) { out.append(el('p', { class: 'err' }, 'Check the format: DG-YYYY-XXXXXX.')); return; }
    if (!api.live) {
      const r = [...load(), ...DEMO].find((x) => x.ref === q);
      if (!r) { out.append(el('p', {}, 'No report found with that reference. Check the code and try again.')); return; }
      return show({ title: r.title, note: r.local ? '' : 'Sample report', area: r.area, cat: r.cat, steps: STAT.slice(0, 5).map((n, i) => ({ text: n + (i === 0 && r.at ? ' · ' + fmt(r.at) : ''), done: i <= r.st })) });
    }
    out.append(el('p', {}, 'Looking up…'));
    try {
      const r = await api.track(q); out.replaceChildren();
      if (!r.found) { out.append(el('p', r.reason === 'invalid_format' ? { class: 'err' } : {}, r.reason === 'invalid_format' ? 'Check the format: DG-YYYY-XXXXXX.' : 'No report found with that reference. Check the code and try again.')); return; }
      show({ title: `Status: ${STAT[ST[r.status]]}`, area: r.area, cat: r.category, steps: r.timeline.map((x) => ({ text: `${STAT[ST[x.status]]} · ${fmt(x.at)}`, note: x.note, done: true })) });
    } catch { out.replaceChildren(el('p', { class: 'err', role: 'alert' }, 'Could not reach the server.'), el('button', { class: 'btn', onclick: () => go(q) }, 'Retry')); }
  };
  box.append(el('h2', {}, 'Track your complaint'), el('label', { for: 'q' }, 'Reference number'), inp, el('p', {}, el('button', { class: 'btn', onclick: () => go(inp.value) }, 'Track')),
    api.live ? '' : el('p', {}, 'Try: ', DEMO.slice(0, 3).map((r) => el('button', { class: 'pill', style: 'margin-right:.3rem;cursor:pointer', onclick: () => { inp.value = r.ref; go(r.ref); } }, r.ref))), out);
  if (arg) { inp.value = arg; go(arg); }
}

// ------------------------------------------------------------------ map
async function map() {
  const box = el('section', { class: 'wrap' }); app.replaceChildren(box);
  let all, R;
  try {
    R = await getRefs();
    all = api.live ? (await api.publicReports()).map(fromPublic) : [...load(), ...DEMO];
  } catch { return retryBox(box, map, 'Could not load the map data.'); }
  let fc = '', fs = '';
  const cs = el('select', { 'aria-label': 'Category', onchange: (e) => { fc = e.target.value; draw(); } }, el('option', { value: '' }, 'All categories'), R.cats.map((x) => el('option', { value: x.label }, x.label)));
  const ss = el('select', { 'aria-label': 'Status', onchange: (e) => { fs = e.target.value; draw(); } }, el('option', { value: '' }, 'All statuses'), STAT.map((x, i) => el('option', { value: i }, x)));
  const body = el('div');
  box.append(el('h2', {}, 'Community map ', api.live ? '' : pill('Demo data', true)), el('p', {}, 'Markers show localities, not exact addresses. ' + (api.live ? 'Only reports approved by staff for public display appear here.' : 'A street map needs OpenStreetMap tiles, which are not enabled yet.')), el('div', { class: 'filters' }, cs, ss), body);
  function draw() {
    const rs = all.filter((r) => (!fc || r.cat === fc) && (fs === '' || r.st == fs)); body.replaceChildren();
    const NS = 'http://www.w3.org/2000/svg', sv = document.createElementNS(NS, 'svg');
    sv.setAttribute('viewBox', '0 0 600 260'); sv.setAttribute('class', 'map'); sv.setAttribute('role', 'img'); sv.setAttribute('aria-label', 'Stylised map of The Gambia with report localities');
    sv.innerHTML = '<rect width="600" height="260" fill="#e7f3ee"/><path d="M0 170 Q120 140 200 160 T380 120 T600 95" stroke="#7fc4d8" stroke-width="26" fill="none" stroke-linecap="round"/><text x="260" y="215" fill="#6b8a85" font-size="13">The Gambia River</text>';
    Object.entries(POS).forEach(([n, [x, y]]) => { const k = rs.filter((r) => r.area === n); if (!k.length) return; const g = document.createElementNS(NS, 'g'); g.innerHTML = `<circle cx="${x}" cy="${y}" r="${12 + k.length * 3}" fill="#0f6b5e" fill-opacity=".85" stroke="#fff" stroke-width="2"/><text x="${x}" y="${y + 4}" text-anchor="middle" fill="#fff" font-size="12" font-weight="700">${k.length}</text><text x="${x}" y="${y - 20}" text-anchor="middle" fill="#12323a" font-size="11">${n}</text>`; sv.append(g); });
    body.append(sv, el('h3', { style: 'margin-top:1rem' }, 'List view'), el('div', { class: 'card' }, ...(rs.length ? rows(rs) : [el('p', {}, api.live && !all.length ? 'No reports have been approved for public display yet.' : 'No reports match these filters.')])));
  }
  draw();
}

// ------------------------------------------------------------------ account + citizen dashboard
async function account() {
  const box = el('section', { class: 'wrap narrow' }); app.replaceChildren(box);
  if (!api.live) { box.append(el('div', { class: 'card' }, el('h2', {}, 'Accounts need Supabase'), el('p', {}, 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to enable sign in. Until then the app runs in demo mode.'))); return; }
  if (user) {
    box.append(el('div', { class: 'card' }, el('p', {}, 'Loading…')));
    try {
      const [p, rs] = await Promise.all([api.profile(), api.myReports(user.id)]);
      box.replaceChildren(el('div', { class: 'card' }, el('h2', {}, `Welcome${p?.display_name ? ', ' + p.display_name : ''}`), el('p', {}, `Signed in as ${user.email}`),
        p && p.role !== 'citizen' ? el('p', {}, pill('Staff and admin portals are not built yet')) : '', el('button', { class: 'btn alt', onclick: async () => { await api.signOut(); } }, 'Sign out')),
        el('div', { class: 'card', style: 'margin-top:1rem' }, el('h3', {}, 'My reports'), ...(rs.length ? rs.map((r) => el('div', { class: 'row' }, el('div', {}, el('b', {}, r.title), el('div', { style: 'font-size:.85rem' }, el('a', { href: '#/track/' + r.reference }, r.reference + ' · ' + fmt(r.created_at)))), chip(ST[r.status]))) : [el('p', {}, 'No reports linked to your account yet. Anonymous reports are never shown here.')])));
    } catch { retryBox(box, account, 'Could not load your account.'); }
    return;
  }
  let mode = 'in'; const err = el('div', { class: 'err', role: 'alert' }), ok = el('p', { role: 'status' });
  const draw = () => {
    const email = el('input', { type: 'email', autocomplete: 'email', required: '' }), pw = el('input', { type: 'password', autocomplete: mode === 'in' ? 'current-password' : 'new-password', minlength: 8 }), nm = el('input', { maxlength: 80 });
    err.textContent = ''; ok.textContent = '';
    box.replaceChildren(el('div', { class: 'card' }, el('div', { class: 'tabs' }, [['in', 'Sign in'], ['up', 'Create account'], ['reset', 'Forgot password']].map(([m, l]) => el('button', { class: 'btn ' + (mode === m ? '' : 'alt'), type: 'button', onclick: () => { mode = m; draw(); } }, l))),
      ...(mode === 'up' ? [el('label', {}, 'Display name (optional)'), nm] : []), el('label', {}, 'Email'), email, ...(mode === 'reset' ? [] : [el('label', {}, 'Password (8+ characters)'), pw]), err, ok,
      el('p', {}, el('button', { class: 'btn', type: 'button', onclick: async (e) => {
        const b = e.currentTarget; b.disabled = true; err.textContent = '';
        try {
          if (mode === 'in') await api.signIn(email.value.trim(), pw.value);
          else if (mode === 'up') { const r = await api.signUp(email.value.trim(), pw.value, nm.value.trim()); if (!r.session) ok.textContent = 'Account created. If email confirmation is on, check your inbox to confirm.'; }
          else { await api.recover(email.value.trim()); ok.textContent = 'If that email has an account, a reset link is on its way.'; }
        } catch (x) { err.textContent = x.message || 'Could not complete that.'; }
        b.disabled = false;
      } }, mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link')),
      el('p', { style: 'color:var(--mut)' }, 'You can also report without an account. Anonymous reports store no identity.')));
  };
  draw();
}

// ------------------------------------------------------------------ help (civic assistant)
function help() {
  const box = el('section', { class: 'wrap narrow' }); app.replaceChildren(box);
  const msgs = [], log = el('div', { class: 'chat', 'aria-live': 'polite' }), inp = el('input', { maxlength: 500, placeholder: 'e.g. How do I track my report?' });
  const add = (who, txt) => log.append(el('div', { class: 'msg ' + (who === 'user' ? 'u' : 'a') }, txt)), send = async () => {
    const q = inp.value.trim(); if (!q) return; inp.value = ''; add('user', q); msgs.push({ role: 'user', content: q });
    const r = await api.ai({ action: 'assistant', messages: msgs });
    const a = r.reply || (r.limited ? 'Too many questions. Please wait a few minutes.' : r.message || 'The assistant is unavailable right now. See the “How it works” section on the home page.');
    if (r.reply) msgs.push({ role: 'assistant', content: a }); add('assistant', a);
  };
  box.append(el('div', { class: 'card' }, el('h2', {}, 'Help assistant'), el('p', {}, pill('AI helper, not a government official', true), ' It only explains how to use Déglu Gambia and may be wrong.'), log, el('div', { style: 'display:flex;gap:.5rem' }, inp, el('button', { class: 'btn', onclick: send }, 'Ask'))));
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  if (!api.live) add('assistant', 'The assistant needs Supabase and an AI key. It is switched off in demo mode.');
}

// ------------------------------------------------------------------ router
const routes = { '': home, report, track, map, account, help };
function render() {
  const [r, arg] = (location.hash.replace('#/', '') || '').split('/');
  (routes[r] || home)(arg);
  document.querySelectorAll('nav a').forEach((a) => (a.getAttribute('data-r') === r ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  window.scrollTo(0, 0);
}
const setUser = (s) => { user = s?.user || null; $('#acct').textContent = user ? 'My account' : 'Sign in'; };
$('#lang').addEventListener('change', (e) => { lang = e.target.value; $('#note').hidden = lang === 'en'; render(); });
addEventListener('hashchange', render);
if (!api.live) { $('#banner').hidden = false; $('#banner').textContent = 'Demo mode: Supabase is not configured. Nothing is stored in Supabase; reports stay in this browser only.'; }
api.onAuth((s) => { const was = !!user; setUser(s); if (was !== !!user && location.hash.startsWith('#/account')) render(); });
api.session().then(setUser).catch(() => {}).finally(render);
