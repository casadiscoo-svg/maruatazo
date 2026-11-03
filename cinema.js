/* MARUATAZO XII — cinema layer behaviour (public presentation only).
   Additive: does nothing unless <body class="cinema"> is present and never touches the editor's state or storage.
   Scenes are permanent per section (real game captures): landing = sunset lighthouse, LINE UP = night fireflies, INFO = day lighthouse. */
(() => {
  'use strict';
  const doc = document, root = doc.documentElement, body = doc.body;
  if (!body.classList.contains('cinema')) return;
  const CFG = window.MARUATAZO_CABINS;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const hero = doc.getElementById('cinemaHero');

  /* ---------- hero: pause the slow image drift while the hero is off-screen or the tab is hidden ---------- */
  if (hero) {
    const setOff = off => hero.classList.toggle('is-offscreen', off);
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => setOff(!e.isIntersecting), { threshold: 0 }).observe(hero);
    doc.addEventListener('visibilitychange', () => { if (doc.hidden) setOff(true); });
  }

  /* ---------- V30 state quirk: the Line Up kicker is saved as a literal "\\n"; restore the original label (public view only) ---------- */
  const KICK = { lineup: '02 — PROGRAMA', cabins: '03 — TU CASA EN EL PACÍFICO', menu: '04 — CANTINA DE PLAYA', merch: '05 — SOUVENIRS', boletos: '07 — RESERVA' };
  doc.querySelectorAll('main > section .kicker').forEach(k => { const sec = k.closest('section'); if (sec && KICK[sec.id] && /^\s*(\\n)?\s*$/.test(k.textContent)) k.textContent = KICK[sec.id]; });

  /* ---------- section order is now INFO → HORARIOS (was LINE UP → INFO). Saved V30 states (the owner's localStorage and the baked default) still carry the old visible
     texts, so relabel what is ON SCREEN only: nothing here reads or writes storage, and any text the owner has retyped (anything other than the old defaults) is left alone. ---------- */
  const relabel = () => {
    const setText = (el, re, to) => { if (el && re.test(el.textContent)) el.textContent = el.textContent.replace(re, to); };
    doc.querySelectorAll('#lineup .section-title-row h2, #lineup header h2').forEach(h => setText(h, /^\s*LINE UP\s*$/i, 'HORARIOS'));
    doc.querySelectorAll('[data-le-id="hero-lineup"] b, [data-le-id="header-lineup"], .bottom a[href="#lineup"] b, .closing-links a[href="#lineup"]').forEach(el => setText(el, /^\s*LINE UP\s*$/i, 'HORARIOS'));
    doc.querySelectorAll('#lineup .kicker').forEach(k => setText(k, /^(\s*)01(\s*—)/, '$102$2'));
    doc.querySelectorAll('#lineup .kicker').forEach(k => { if (/^\s*(\\n)?\s*$/.test(k.textContent)) k.textContent = KICK.lineup; });   // default V30 state saves this kicker as a literal "\n"
    doc.querySelectorAll('#info .kicker').forEach(k => setText(k, /^(\s*)02(\s*—)/, '$101$2'));
    const nav = doc.querySelector('[data-le-id="cin-nav-lineup"]'); if (nav && nav.dataset.leName === 'Menú: LINE UP') nav.dataset.leName = 'Menú: HORARIOS';
  };
  relabel(); addEventListener('load', relabel);
  if (window.__MZ_EDITOR && typeof window.__MZ_EDITOR.onChange === 'function') window.__MZ_EDITOR.onChange(relabel);   // undo / redo / import re-apply old saved text: relabel again

  /* ---------- restrained iconography: drop emoji the V30 saved state restores into public headings ---------- */
  const EMOJI = /^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u;
  doc.querySelectorAll('#menu .menu-guide h3, #boletos .ticket-notices b').forEach(h => { const t = h.textContent; if (EMOJI.test(t)) h.textContent = t.replace(EMOJI, ''); });

  /* ---------- header: transparent dark overlay over the hero at the top of the page, solid once scrolled (class toggled here; solid by default without JS) ---------- */
  const top = doc.querySelector('.top');
  if (top) {
    let rafT = 0;
    const sync = () => { rafT = 0; top.classList.toggle('cin-top', scrollY < 40 && !doc.querySelector('.site-nav.is-open')); };
    const queue = () => { if (!rafT) rafT = requestAnimationFrame(sync); };
    addEventListener('scroll', queue, { passive: true }); addEventListener('resize', queue);
    doc.querySelector('#navToggle')?.addEventListener('click', () => setTimeout(sync, 0));
    sync();
  }

  /* ---------- accommodation categories + prices (single source: cabins-config.js) ---------- */
  const copy = doc.querySelector('#cabins .cabins-copy');
  if (copy && CFG && Array.isArray(CFG.accommodations) && CFG.accommodations.length) {
    const mxn = n => '$' + Number(n).toLocaleString('es-MX');
    const cap = a => a.capacity ? a.capacity + ' personas' : a.capacities ? a.capacities.join(' o ') + ' personas' : a.kind === 'camping' ? 'Zona de camping' : 'Capacidad por confirmar';
    const ul = doc.createElement('ul'); ul.className = 'cabin-prices'; ul.setAttribute('aria-label', 'Categorías de alojamiento y precios por persona');
    CFG.accommodations.forEach(a => {
      const li = doc.createElement('li'), link = doc.createElement('a');
      link.href = 'mapa2d.html?tipo=' + encodeURIComponent(a.key);
      const left = doc.createElement('div'), name = doc.createElement('b'), small = doc.createElement('small'), price = doc.createElement('span');
      name.textContent = a.name; small.textContent = cap(a); price.textContent = mxn(a.pricePerPerson) + ' por persona';
      left.append(name, small); link.append(left, price); li.append(link); ul.append(li);
    });
    const note = doc.createElement('div'); note.className = 'cabin-prices-note';
    note.textContent = 'Precio por persona: ' + ((CFG.package && CFG.package.nights) || 3) + ' noches y acceso al evento los 3 días. Elegir una categoría abre su detalle; consultar no aparta tu lugar y la disponibilidad se confirma con la organización.';
    const actions = copy.querySelector('.cabins-explore-actions');
    if (actions) { copy.insertBefore(ul, actions); copy.insertBefore(note, actions); } else copy.append(ul, note);
    if (window.MARUATAZO_EDITOR_REFRESH) window.MARUATAZO_EDITOR_REFRESH();   // register + apply saved card styles to the generated price links
  }

  /* ---------- WhatsApp links follow the config number (one place to change it) ---------- */
  if (CFG && CFG.whatsapp) doc.querySelectorAll('a[data-wa]').forEach(a => { try { const u = new URL(a.href); a.href = 'https://wa.me/' + CFG.whatsapp + u.search; } catch { /* keep static href */ } });

  /* ---------- INFO: deep links open the right panel (also the old V30 anchors) ---------- */
  const LEGACY = { 'info-mar': 'info-mar-seguridad', 'info-llegadas': 'trip-llegar', 'info-carretera': 'trip-llegar', 'info-hospedaje': 'trip-hospedaje', 'info-clima': 'trip-clima', 'info-conducta': 'care-conducta', 'info-basura': 'care-basura', 'info-donativos': 'care-donativos', 'info-importante': 'info' };
  const openFromHash = () => {
    let id = decodeURIComponent(location.hash.slice(1)); if (!id) return;
    if (LEGACY[id]) id = LEGACY[id];
    const t = doc.getElementById(id); if (!t || !t.closest('.info-cinema')) return;
    if (t.tagName === 'DETAILS') t.open = true;
    t.scrollIntoView({ block: 'start', behavior: reduce.matches ? 'auto' : 'smooth' });
  };
  addEventListener('hashchange', openFromHash);
  addEventListener('load', openFromHash);

  /* ---------- LINE UP: tab-label repair + data-driven timetable (all content lives in lineup-data.js) ---------- */
  (() => {
    const sec = doc.getElementById('lineup'); if (!sec) return;
    // V30 saved tab text contains a literal "\n" and a missing accent ("Sabado"): repaired in the rendered text only
    sec.querySelectorAll('.tabs button').forEach(b => { const t = b.textContent; let n = t.replace(/\\n/g, '').trim(); if (/^sabado$/i.test(n)) n = n[0] === 'S' ? 'Sábado' : 'sábado'; if (n !== t) b.textContent = n; if (!b.classList.contains('active') && /239,\s*182,\s*41/.test(b.style.backgroundColor)) { b.style.removeProperty('background-color'); b.style.removeProperty('color'); } });   // legacy gold fill saved on a non-active tab would read as a second active tab
    const D = window.MARUATAZO_LINEUP, box = doc.getElementById('lineupTimetable'), note = sec.querySelector('.lineup-status');
    if (!D || !box) return;
    const acts = (Array.isArray(D.acts) ? D.acts : []).filter(a => a && String(a.name || '').trim());
    if (note) { if (D.notice) note.textContent = D.notice; note.hidden = D.status === 'confirmed' && acts.length > 0; }
    if (!acts.length) return;                                   // nothing confirmed yet: keep the provisional placeholders
    const stages = Object.fromEntries((D.stages || []).map(s => [s.id, s.label]));
    const groups = [...(D.days || []).map(d => ({ id: d.id, label: d.label, date: d.date, acts: [] })), { id: '_tbc', label: 'Por confirmar', acts: [] }];
    const byId = Object.fromEntries(groups.map(g => [g.id, g]));
    const num = v => (v !== '' && v != null && Number.isFinite(+v)) ? +v : 1e9;
    const mins = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : 1e9; };
    acts.forEach((a, i) => (byId[a.day] || byId._tbc).acts.push(Object.assign({ _i: i }, a)));
    groups.forEach(g => g.acts.sort((a, b) => num(a.order) - num(b.order) || mins(a.start) - mins(b.start) || a._i - b._i));
    const live = groups.filter(g => g.acts.length);
    const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    box.replaceChildren();
    const tabs = el('div', 'lt-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Días del programa');
    const panels = live.map((g, i) => {
      const b = el('button', 'lt-tab', g.label); b.type = 'button'; b.id = 'lt-tab-' + g.id; b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'lt-panel-' + g.id);
      const p = el('div', 'lt-panel'); p.id = 'lt-panel-' + g.id; p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', b.id);
      const ol = el('ol', 'lt-list');
      g.acts.forEach(a => { const li = el('li', 'lt-act'); const time = a.start ? (a.end ? a.start + '–' + a.end : a.start) : 'Hora por confirmar';
        li.append(el('span', 'lt-time', time), el('span', 'lt-name', String(a.name).trim())); if (a.stage) li.append(el('span', 'lt-stage', stages[a.stage] || String(a.stage))); ol.append(li); });
      p.append(ol); tabs.append(b); box.append(p); return { b, p };
    });
    const show = i => panels.forEach((x, k) => { const on = k === i; x.p.hidden = !on; x.b.setAttribute('aria-selected', String(on)); x.b.tabIndex = on ? 0 : -1; x.b.classList.toggle('active', on); });
    panels.forEach((x, i) => { x.b.addEventListener('click', () => show(i)); x.b.addEventListener('keydown', e => { const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!k) return; e.preventDefault(); const n = (i + k + panels.length) % panels.length; show(n); panels[n].b.focus(); }); });
    if (live.length > 1) box.prepend(tabs);
    show(0); box.hidden = false; sec.classList.add('has-timetable');
  })();

  /* ---------- section title entrance (progressive: content is visible unless this script is running and motion is allowed) ---------- */
  if ('IntersectionObserver' in window && !reduce.matches) {
    const targets = [...doc.querySelectorAll('main > section.section h2, .info-card, .cabin-prices')].filter(el => el.getBoundingClientRect().top > innerHeight * 0.9);
    if (targets.length) {
      root.classList.add('cin-js');
      targets.forEach(el => el.setAttribute('data-cin-reveal', ''));
      const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('cin-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
      targets.forEach(el => io.observe(el));
      setTimeout(() => targets.forEach(el => el.classList.add('cin-in')), 6000); // safety net: never leave content hidden
      addEventListener('hashchange', () => targets.forEach(el => el.classList.add('cin-in')));
    }
  }
})();
