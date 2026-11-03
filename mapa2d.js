(() => {
  const CFG = window.MARUATAZO_CABINS;
  const $ = s => document.querySelector(s);
  const vp = $('#mapViewport'), world = $('#mapWorld'), panel = $('#cabinPanel');
  if (!CFG || !vp) return;

  const STATUS = {
    available:   { label: 'DISPONIBLE',  glyph: '✓' },
    pending:     { label: 'PENDIENTE',   glyph: '…' },
    occupied:    { label: 'OCUPADA',     glyph: '✕' },
    unconfirmed: { label: 'POR CONFIRMAR', glyph: '?' }
  };
  const money = n => '$' + n.toLocaleString('es-MX') + ' MXN';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v);
    }
    kids.flat().forEach(c => n.append(c));
    return n;
  }

  /* ---------- data ---------- */
  const statusOf = c => STATUS[c.status] ? c.status : 'unconfirmed';
  const TYPES = CFG.accommodations;
  const typeOf = c => TYPES.find(t => t.key === c.type) || (c.capacity != null && TYPES.find(t => t.kind === 'cabin' && (t.capacity === c.capacity || (t.capacities || []).includes(c.capacity))));
  const priceOf = c => c.pricePerPerson ?? typeOf(c)?.pricePerPerson ?? null;
  const hasPos = c => c.kind === 'cabin' && Number.isFinite(c.x) && Number.isFinite(c.y) && c.x >= 0 && c.x <= 1 && c.y >= 0 && c.y <= 1;
  const nameOf = c => c.name || ('Cabaña ' + c.id);
  const maxGuests = c => c.capacity ?? (c.capacities ? Math.max(...c.capacities) : CFG.defaultMaxGuests);
  const capacityText = c => c.capacity ? c.capacity + ' personas' : c.capacities ? c.capacities.join(' o ') + ' personas' : c.accKind === 'camping' ? 'Zona de camping' : 'Capacidad por confirmar';
  const typeItem = t => ({ ...t, id: t.key, kind: 'type', accKind: t.kind, status: statusOf(t) });

  /* Edit mode (?editar=1) works on a local draft; public visitors only ever see cabins-config.js. */
  const Q = new URLSearchParams(location.search);
  // The editor button is only offered where CAN_EDIT is true (see below).
  // Edits only ever touch a local draft; visitors can't change what is published without an export + deploy.
  // Editing is only offered on this machine (localhost / 127.0.0.1 / file://) or in a browser where the developer set the local flag
  // (console: localStorage.setItem('maruatazo-editor-dev','1')). ?editar=1 only opens edit mode where editing is already allowed.
  const CAN_EDIT = !window.MARUATAZO_PUBLIC_RELEASE && (['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname) || (() => { try { return localStorage.getItem('maruatazo-editor-dev') === '1'; } catch { return false; } })());   // published build: MARUATAZO_PUBLIC_RELEASE disables editing entirely
  let EDIT = CAN_EDIT && Q.has('editar');
  const DRAFT_KEY = 'maruatazo-cabins-draft-v1';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  let usingDraft = false;
  function loadCabins() {
    if (EDIT) { try { const d = JSON.parse(store.get(DRAFT_KEY)); if (Array.isArray(d?.cabins)) { usingDraft = true; return d.cabins; } } catch { /* no draft */ } }
    return clone(CFG.cabins);
  }
  let cabinData = loadCabins();
  const saveDraft = () => { usingDraft = true; return store.set(DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), cabins: cabinData })); };

  let items = [];
  function buildItems() {
    const cabins = cabinData.map(c => ({ ...c, status: statusOf(c), kind: 'cabin', accKind: 'cabin' }));
    // categories are always selectable inquiries for visitors; real cabins follow them. Edit mode shows cabins only.
    items = EDIT ? cabins : [...TYPES.map(typeItem), ...cabins];
  }
  buildItems();

  /* ---------- WhatsApp ---------- */
  function waUrl(c, guests) {
    const p = priceOf(c), n = guests || 1;
    const what = c.accKind === 'camping' ? 'el camping'
      : c.kind === 'type' ? `una ${nameOf(c).replace(/^Cabaña/, 'cabaña')}`
      : `la ${nameOf(c)}${typeOf(c) ? ' (' + typeOf(c).name.toLowerCase() + ')' : ''}`;
    const msg = `Hola, quiero solicitar ${what} para ${CFG.eventName}${CFG.event ? ' (' + CFG.event.dates + ')' : ''}, para ${n} ${n === 1 ? 'persona' : 'personas'}`
      + (p ? `, con precio cotizado de ${money(p)} por persona (${CFG.package.nights} noches y acceso al evento los 3 días)` : '')
      + '. ¿Me pueden confirmar disponibilidad e indicar cómo apartarla y las instrucciones de pago?';
    return `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(msg)}`;
  }
  window.__maruatazoWaUrl = waUrl; // QA hook, read-only

  /* ---------- map image + pins ---------- */
  const W = CFG.map.width, H = CFG.map.height;
  world.style.width = W + 'px'; world.style.height = H + 'px';
  world.append(el('img', { src: CFG.map.image, alt: CFG.map.alt, draggable: 'false', width: W, height: H }));

  const pinFor = new Map();
  function renderPins() {
    pinFor.forEach(p => p.remove()); pinFor.clear();
    items.filter(hasPos).forEach(c => {
      const st = STATUS[c.status];
      const pin = el('button', {
        class: 'cabin-pin s-' + c.status + (selected && selected.id === c.id ? ' active' : ''), type: 'button', 'aria-pressed': String(!!selected && selected.id === c.id),
        'aria-label': `${nameOf(c)}, ${capacityText(c)}, ${st.label.toLowerCase()}` + (EDIT ? '. Arrastra o usa las flechas para mover' : '')
      }, el('span', { class: 'pin-body' }, el('span', { class: 'pin-house', 'aria-hidden': 'true' }, st.glyph), el('b', { text: c.id })));
      pin.style.left = (c.x * 100) + '%'; pin.style.top = (c.y * 100) + '%';
      pin.addEventListener('click', () => { if (pin.dataset.dragged) { delete pin.dataset.dragged; return; } select(c, { center: !EDIT }); });
      if (EDIT) wireEditPin(pin, c.id);
      world.append(pin); pinFor.set(c.id, pin);
    });
  }

  /* ---------- pan / zoom ---------- */
  let scale = 1, x = 0, y = 0, minScale = .5; const maxScale = 4;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function draw() {
    const vw = vp.clientWidth, vh = vp.clientHeight;
    minScale = Math.min(vw / W, vh / H);
    scale = clamp(scale, minScale, maxScale);
    const sw = W * scale, sh = H * scale;
    x = sw <= vw ? (vw - sw) / 2 : clamp(x, vw - sw, 0);
    y = sh <= vh ? (vh - sh) / 2 : clamp(y, vh - sh, 0);
    world.style.setProperty('--inv', (1 / scale).toFixed(4));
    world.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`;
  }
  function reset() {
    const vw = vp.clientWidth, vh = vp.clientHeight;
    scale = Math.max(vw / W, vh / H) * 1.02;
    x = (vw - W * scale) / 2; y = (vh - H * scale) / 2; draw();
  }
  function zoomAt(f, cx = vp.clientWidth / 2, cy = vp.clientHeight / 2) {
    const ns = clamp(scale * f, minScale, maxScale), wx = (cx - x) / scale, wy = (cy - y) / scale;
    x = cx - wx * ns; y = cy - wy * ns; scale = ns; draw();
  }
  function toNorm(cx, cy) { // client pixels -> normalized image coordinates (null outside the image)
    const r = vp.getBoundingClientRect(), nx = ((cx - r.left - x) / scale) / W, ny = ((cy - r.top - y) / scale) / H;
    return nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1 ? { x: nx, y: ny } : null;
  }
  function centerOn(nx, ny) {
    scale = Math.max(scale, Math.max(vp.clientWidth / W, vp.clientHeight / H) * 1.6);
    const fy = sheet.matches ? .2 : .5; // on phones the open sheet covers the lower part of the map
    x = vp.clientWidth / 2 - nx * W * scale; y = vp.clientHeight * fy - ny * H * scale; draw();
  }

  const pointers = new Map(); let drag = false, sx = 0, sy = 0, bx = 0, by = 0, pinchDist = 0, pinchScale = 1, moved = 0;
  vp.addEventListener('wheel', e => {
    e.preventDefault(); const r = vp.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * .0015), e.clientX - r.left, e.clientY - r.top); hideHint();
  }, { passive: false });
  vp.addEventListener('pointerdown', e => {
    if (e.target.closest('button,output')) return;
    vp.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0;
    if (pointers.size === 1) { drag = true; sx = e.clientX; sy = e.clientY; bx = x; by = y; vp.classList.add('dragging'); }
    else if (pointers.size === 2) { const a = [...pointers.values()]; pinchDist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); pinchScale = scale; }
    hideHint();
  });
  vp.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const a = [...pointers.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), r = vp.getBoundingClientRect();
      const cx = (a[0].x + a[1].x) / 2 - r.left, cy = (a[0].y + a[1].y) / 2 - r.top;
      const ns = clamp(pinchScale * d / pinchDist, minScale, maxScale), wx = (cx - x) / scale, wy = (cy - y) / scale;
      x = cx - wx * ns; y = cy - wy * ns; scale = ns; draw();
    } else if (drag) { moved = Math.max(moved, Math.hypot(e.clientX - sx, e.clientY - sy)); x = bx + e.clientX - sx; y = by + e.clientY - sy; draw(); }
  });
  function up(e) {
    // a tap (no drag) on empty map in calibration mode reports normalized coordinates
    if (CALIBRATE && pointers.size === 1 && moved < 6 && e.type === 'pointerup') {
      const n = toNorm(e.clientX, e.clientY);
      if (n) { cal.hidden = false; cal.textContent = `x: ${n.x.toFixed(4)}, y: ${n.y.toFixed(4)}`; }
    }
    if (EDIT && pointers.size === 1 && moved < 6 && e.type === 'pointerup') { const n = toNorm(e.clientX, e.clientY); if (n) addCabin(n.x, n.y); }
    pointers.delete(e.pointerId); if (pointers.size < 2) pinchDist = 0;
    if (!pointers.size) { drag = false; vp.classList.remove('dragging'); }
    else { const a = [...pointers.values()][0]; sx = a.x; sy = a.y; bx = x; by = y; }
  }
  vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up);

  vp.addEventListener('keydown', e => {
    if (e.target !== vp) return;
    const step = 60, k = e.key;
    if (k === 'ArrowLeft') x += step; else if (k === 'ArrowRight') x -= step;
    else if (k === 'ArrowUp') y += step; else if (k === 'ArrowDown') y -= step;
    else if (k === '+' || k === '=') return (zoomAt(1.25), e.preventDefault());
    else if (k === '-' || k === '_') return (zoomAt(.8), e.preventDefault());
    else if (k === '0') return (reset(), e.preventDefault());
    else return;
    e.preventDefault(); draw();
  });

  $('#zoomIn').onclick = () => zoomAt(1.28);
  $('#zoomOut').onclick = () => zoomAt(.78);
  $('#resetMap').onclick = reset;
  new ResizeObserver(draw).observe(vp);

  const hint = $('#mapInstructions');
  function hideHint() { hint.classList.add('hidden'); }
  $('#mapHelp').onclick = () => hint.classList.toggle('hidden');

  /* ---------- calibration helper (?calibrar=1) ---------- */
  const CALIBRATE = CAN_EDIT && new URLSearchParams(location.search).has('calibrar');
  const cal = $('#calibrate');
  if (CALIBRATE) { cal.hidden = false; cal.textContent = 'MODO CALIBRAR · toca el mapa para leer x / y'; }

  /* ---------- panel: list, legend, detail ---------- */
  const list = $('#cabinList'), detail = $('#cabinDetail'), listSec = $('#panelList'), toggle = $('#panelToggle');
  const sheet = matchMedia('(max-width: 800px)');
  let selected = null;

  $('#panelReco').textContent = CFG.recommendation;
  if (CFG.event) $('#panelDates').textContent = 'Evento: ' + CFG.event.dates + ' · ' + CFG.package.nights + ' noches de hospedaje.';
  const legend = $('#legend');
  Object.entries(STATUS).forEach(([k, s]) => legend.append(el('li', {}, el('span', { class: 'swatch s-' + k, 'aria-hidden': 'true', text: s.glyph }), s.label)));

  function priceLine(c) { const p = priceOf(c); return p ? money(p) + ' por persona' : 'Precio por confirmar'; }

  function renderList() {
    const cabins = items.filter(c => c.kind === 'cabin'), notice = $('#panelNotice');
    $('#panelIntro').textContent = EDIT ? 'Toca el mapa para agregar una cabaña. Arrastra un marcador para moverlo.'
      : cabins.length ? 'Toca una cabaña en el mapa o elige camping o cabaña en la lista.' : 'Elige tu tipo de alojamiento y consulta por WhatsApp.';
    notice.hidden = EDIT || (cabins.length && cabins.some(hasPos));
    notice.textContent = cabins.length ? 'La ubicación de las cabañas en el mapa está por confirmar.'
      : 'Las cabañas individuales y su ubicación en el mapa se publicarán cuando la organización confirme el inventario.';
    list.replaceChildren(...items.map(c => {
      const st = STATUS[c.status];
      const b = el('button', { class: 'cabin-row' + (c.accKind === 'camping' ? ' is-camp' : ''), type: 'button', 'data-id': c.id },
        el('span', { class: 'row-main' }, el('b', { text: nameOf(c) }), el('small', { text: `${capacityText(c)} · ${priceLine(c)}` + (EDIT && !hasPos(c) ? ' · SIN UBICAR' : '') })),
        el('span', { class: 'row-status s-' + c.status, text: st.label }));
      b.addEventListener('click', () => select(c, { center: true }));
      return el('li', {}, b);
    }));
    $('#panelToggleLabel').textContent = EDIT ? `EDITAR CABAÑAS (${cabins.length})` : cabins.length ? `CABAÑAS (${items.length})` : 'ELEGIR CABAÑA';
    if (EDIT) $('#editCount').textContent = `${cabins.length} cabañas · ${usingDraft ? 'borrador local' : 'datos de cabins-config.js'}`;
  }
  function refresh() { buildItems(); renderPins(); renderList(); }

  function setSheet(open) {
    panel.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    $('#panelToggle i').textContent = open ? '▾' : '▴';
  }
  toggle.addEventListener('click', () => setSheet(!panel.classList.contains('open')));

  function select(c, { center = false } = {}) {
    selected = c;
    pinFor.forEach((p, id) => { const on = id === c.id; p.classList.toggle('active', on); p.setAttribute('aria-pressed', String(on)); });
    (EDIT ? renderEditor : renderDetail)(c);
    listSec.hidden = true; detail.hidden = false; setSheet(true);
    if (center && hasPos(c)) centerOn(c.x, c.y);
    $('#cabinName').focus({ preventScroll: true });
    hideHint();
  }
  function deselect(collapse = false) {
    const prev = selected; selected = null;
    pinFor.forEach(p => { p.classList.remove('active'); p.setAttribute('aria-pressed', 'false'); });
    detail.hidden = true; listSec.hidden = false;
    if (collapse && sheet.matches) setSheet(false);
    (prev && (pinFor.get(prev.id) || list.querySelector(`[data-id="${prev.id}"]`)))?.focus();
  }

  function renderDetail(c) {
    const st = STATUS[c.status], occupied = c.status === 'occupied', p = priceOf(c), isCamp = c.accKind === 'camping';
    const max = maxGuests(c);
    const guests = el('input', { id: 'guests', type: 'number', min: '1', max: String(max), value: String(Math.min(c.capacity || 1, max)), inputmode: 'numeric' });
    const cta = occupied
      ? el('button', { class: 'wa-cta', type: 'button', disabled: '', 'aria-disabled': 'true', text: 'NO DISPONIBLE' })
      : el('a', { class: 'wa-cta', target: '_blank', rel: 'noopener noreferrer', text: 'SOLICITAR POR WHATSAPP' });
    const sync = () => {
      const n = clamp(parseInt(guests.value, 10) || 1, 1, max);
      if (!occupied) cta.href = waUrl(c, n);
    };
    guests.addEventListener('input', sync);
    guests.addEventListener('change', () => { guests.value = clamp(parseInt(guests.value, 10) || 1, 1, max); sync(); });
    sync();
    detail.replaceChildren(
      el('button', { class: 'card-back', type: 'button', text: '← TODAS LAS OPCIONES' }),
      el('small', { text: c.kind === 'type' ? 'CATEGORÍA DE ALOJAMIENTO' : 'CABAÑA SELECCIONADA' }),
      el('h2', { id: 'cabinName', tabindex: '-1', text: nameOf(c) }),
      c.photo ? el('img', { class: 'card-photo', src: c.photo, alt: 'Foto de ' + nameOf(c) }) : '',
      el('div', { class: 'card-status s-' + c.status }, el('span', { class: 'swatch s-' + c.status, 'aria-hidden': 'true', text: st.glyph }), st.label),
      el('div', { class: 'card-price' }, el('small', { text: 'PRECIO POR PERSONA' }), el('b', { text: p ? money(p) : 'POR CONFIRMAR' }),
        el('span', { text: `${CFG.package.nights} noches + acceso al evento los 3 días` })),
      el('dl', { class: 'card-facts' },
        el('div', {}, el('dt', { text: 'ALOJAMIENTO' }), el('dd', { text: capacityText(c) })),
        CFG.event ? el('div', {}, el('dt', { text: 'FECHAS' }), el('dd', { text: CFG.event.short })) : '',
        el('div', {}, el('dt', { text: 'DURACIÓN' }), el('dd', { text: CFG.package.nights + ' noches' }))),
      el('ul', { class: 'card-includes' }, CFG.package.includes.map(t => el('li', { text: isCamp ? t.replace('hospedaje', 'camping') : t }))),
      el('p', { class: 'card-note', text: CFG.recommendation }),
      c.kind === 'type' ? el('p', { class: 'card-note', text: 'Elegir una categoría solo inicia una consulta: no aparta ni asigna una cabaña o espacio específico.' }) : '',
      c.note ? el('p', { class: 'card-note', text: c.note }) : '',
      el('p', { class: 'card-note', text: c.status === 'unconfirmed' ? 'Disponibilidad por confirmar con la organización.' : 'El precio y la disponibilidad finales se confirman por WhatsApp.' }),
      occupied ? el('p', { class: 'card-occupied', role: 'status', text: 'Esta cabaña ya está ocupada y no recibe solicitudes. Vuelve a la lista para consultar otra.' }) : '',
      el('div', { class: 'cta-bar' }, occupied ? '' : el('label', { class: 'guests', for: 'guests' }, el('span', { text: 'PERSONAS EN TU GRUPO' }), guests), cta),
      el('p', { class: 'fineprint', text: 'Es una consulta, no una reserva confirmada. No se solicita ningún pago en este sitio.' })
    );
    /* everything except the WhatsApp bar goes in a scroll region, so on phones the pinned bar sits BELOW the text instead of over it */
    const scrollBox = el('div', { class: 'card-scroll' });
    [...detail.children].forEach(n => { if (!n.classList.contains('cta-bar')) scrollBox.append(n); });
    detail.prepend(scrollBox);
    detail.querySelector('.card-back').addEventListener('click', () => deselect());
  }

  /* ---------- EDIT CABINS mode (?editar=1) ---------- */
  const CABIN_TYPES = TYPES.filter(t => t.kind === 'cabin');
  const round4 = n => Math.round(n * 10000) / 10000;
  const recIndex = id => cabinData.findIndex(r => r.id === id);

  function validateCabin(c, i, seen) {
    const errs = [], tag = `Cabaña #${i + 1}${c && c.id ? ' (' + c.id + ')' : ''}`;
    if (!c || typeof c !== 'object') return [`${tag}: registro inválido`];
    if (typeof c.id !== 'string' || !c.id.trim()) errs.push(`${tag}: falta id`);
    else if (seen.has(c.id)) errs.push(`${tag}: id repetido`); else seen.add(c.id);
    if (c.status !== undefined && !STATUS[c.status]) errs.push(`${tag}: estado inválido "${c.status}"`);
    if (c.type && !CABIN_TYPES.some(t => t.key === c.type)) errs.push(`${tag}: tipo desconocido "${c.type}"`);
    if (c.capacity != null && !(Number.isInteger(c.capacity) && c.capacity >= 1 && c.capacity <= 99)) errs.push(`${tag}: capacidad inválida`);
    if (c.pricePerPerson != null && !(Number.isFinite(c.pricePerPerson) && c.pricePerPerson > 0)) errs.push(`${tag}: precio inválido`);
    for (const k of ['x', 'y']) if (c[k] != null && !(Number.isFinite(c[k]) && c[k] >= 0 && c[k] <= 1)) errs.push(`${tag}: ${k} debe estar entre 0 y 1`);
    return errs;
  }
  const validateAll = list => { const seen = new Set(); return list.flatMap((c, i) => validateCabin(c, i, seen)); };

  function cleanRecord(c) { // same schema as cabins-config.js, without empty fields
    const o = { id: c.id };
    if (c.name) o.name = c.name;
    if (c.type) o.type = c.type;
    if (c.capacity != null) o.capacity = c.capacity;
    if (c.pricePerPerson != null) o.pricePerPerson = c.pricePerPerson;
    o.status = STATUS[c.status] ? c.status : 'unconfirmed';
    o.x = Number.isFinite(c.x) ? round4(c.x) : null; o.y = Number.isFinite(c.y) ? round4(c.y) : null;
    if (c.photo) o.photo = c.photo;
    if (c.note) o.note = c.note;
    return o;
  }

  function nextId() { let n = cabinData.length + 1, id; do { id = String(n++).padStart(2, '0'); } while (recIndex(id) >= 0); return id; }

  function addCabin(nx, ny) { // a new, unconfirmed record at the clicked point; the organizer fills in the real data
    const rec = { id: nextId(), status: 'unconfirmed', x: round4(nx), y: round4(ny) };
    cabinData.push(rec); saveDraft(); refresh();
    select(items.find(c => c.id === rec.id));
  }

  function wireEditPin(pin, id) {
    pin.addEventListener('pointerdown', e => {
      e.stopPropagation(); pin.setPointerCapture(e.pointerId);
      const sx0 = e.clientX, sy0 = e.clientY; let dragged = false;
      const mv = ev => {
        if (!dragged && Math.hypot(ev.clientX - sx0, ev.clientY - sy0) < 4) return;
        dragged = true; pin.dataset.dragged = '1';
        const r = vp.getBoundingClientRect(), rec = cabinData[recIndex(id)];
        if (!rec) return;
        rec.x = round4(clamp(((ev.clientX - r.left - x) / scale) / W, 0, 1)); rec.y = round4(clamp(((ev.clientY - r.top - y) / scale) / H, 0, 1));
        pin.style.left = rec.x * 100 + '%'; pin.style.top = rec.y * 100 + '%';
        const rd = $('#edCoords'); if (rd && selected?.id === id) rd.textContent = `x ${rec.x.toFixed(4)} · y ${rec.y.toFixed(4)}`;
      };
      const end = () => { pin.removeEventListener('pointermove', mv); pin.removeEventListener('pointerup', end); pin.removeEventListener('pointercancel', end); if (dragged) { saveDraft(); setTimeout(() => delete pin.dataset.dragged, 0); } };
      pin.addEventListener('pointermove', mv); pin.addEventListener('pointerup', end); pin.addEventListener('pointercancel', end);
    });
    pin.addEventListener('keydown', e => {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d) return; e.preventDefault(); e.stopPropagation();
      const rec = cabinData[recIndex(id)], st = e.shiftKey ? .01 : .002;
      rec.x = round4(clamp(rec.x + d[0] * st, 0, 1)); rec.y = round4(clamp(rec.y + d[1] * st, 0, 1));
      saveDraft(); refresh(); pinFor.get(id)?.focus(); selected = items.find(c => c.id === id);
    });
  }

  function renderEditor(c) {
    const rec = cabinData[recIndex(c.id)], curId = c.id;
    const field = (label, input, hint) => el('label', { class: 'ed-field' }, el('span', { text: label }), input, hint ? el('small', { text: hint }) : '');
    const text = (v, ph) => el('input', { type: 'text', value: v ?? '', placeholder: ph || '', autocomplete: 'off' });
    const num = (v, ph, min) => el('input', { type: 'number', value: v ?? '', placeholder: ph || '', min: String(min ?? 1), inputmode: 'numeric' });
    const sel = (opts, v) => { const s = el('select', {}, opts.map(([k, l]) => el('option', { value: k, text: l }))); s.value = v ?? ''; return s; };
    const err = el('p', { class: 'ed-error', role: 'alert', hidden: '' });
    const fId = text(rec.id), fName = text(rec.name, 'Cabaña ' + rec.id), fCap = num(rec.capacity, 'personas'), fPrice = num(rec.pricePerPerson, '', 0), fNote = text(rec.note);
    const fType = sel([['', '— sin tipo —'], ...CABIN_TYPES.map(t => [t.key, `${t.name} · ${money(t.pricePerPerson)}`])], rec.type);
    const fStatus = sel(Object.entries(STATUS).map(([k, s]) => [k, s.label]), rec.status || 'unconfirmed');
    const typePrice = () => CABIN_TYPES.find(t => t.key === fType.value)?.pricePerPerson;
    const showPriceHint = () => { fPrice.placeholder = typePrice() ? `${typePrice()} (según tipo)` : 'precio por persona'; };
    showPriceHint();

    let currentId = curId;
    const commit = () => {
      const r = cabinData[recIndex(currentId)];
      r.name = fName.value.trim() || undefined; r.type = fType.value || undefined;
      r.capacity = fCap.value === '' ? undefined : parseInt(fCap.value, 10);
      r.pricePerPerson = fPrice.value === '' ? undefined : Number(fPrice.value);
      r.status = fStatus.value; r.note = fNote.value.trim() || undefined;
      const nid = fId.value.trim(), others = cabinData.filter(o => o !== r);
      if (!nid) { err.hidden = false; err.textContent = 'El id no puede estar vacío.'; }
      else if (others.some(o => o.id === nid)) { err.hidden = false; err.textContent = `Ya existe una cabaña con id "${nid}".`; }
      else { err.hidden = true; r.id = nid; currentId = nid; }
      const bad = validateAll(cabinData).filter(m => !/id repetido|falta id/.test(m));
      if (bad.length) { err.hidden = false; err.textContent = bad[0]; }
      saveDraft(); refresh(); selected = items.find(i => i.id === currentId) || selected;
      $('#edTitle').textContent = nameOf(selected || r);
    };
    fType.addEventListener('change', () => { const t = CABIN_TYPES.find(k => k.key === fType.value); if (t?.capacity && fCap.value === '') fCap.value = t.capacity; showPriceHint(); commit(); });
    [fId, fName, fCap, fPrice, fNote, fStatus].forEach(f => f.addEventListener('input', commit));

    const del = el('button', { class: 'ed-btn danger', type: 'button', text: 'ELIMINAR CABAÑA' });
    del.addEventListener('click', () => {
      if (!confirm(`¿Eliminar "${nameOf(selected || rec)}" del borrador?`)) return;
      cabinData.splice(recIndex(currentId), 1); saveDraft(); selected = null; refresh(); detail.hidden = true; listSec.hidden = false;
    });
    const back = el('button', { class: 'card-back', type: 'button', text: '← LISTO · TODAS LAS CABAÑAS' });
    back.addEventListener('click', () => deselect());
    detail.replaceChildren(back, el('small', { text: 'EDITANDO CABAÑA' }), el('h2', { id: 'cabinName', tabindex: '-1' }, el('span', { id: 'edTitle', text: nameOf(c) })),
      el('p', { class: 'ed-coords', id: 'edCoords', text: Number.isFinite(rec.x) ? `x ${rec.x.toFixed(4)} · y ${rec.y.toFixed(4)}` : 'Sin ubicar: toca el mapa para colocarla' }),
      field('ID', fId), field('NOMBRE', fName, 'Opcional; por defecto "Cabaña <id>"'), field('TIPO (define el precio)', fType), field('CAPACIDAD', fCap),
      field('PRECIO POR PERSONA (opcional)', fPrice, 'Déjalo vacío para usar el precio del tipo'), field('DISPONIBILIDAD', fStatus), field('NOTA PÚBLICA', fNote), err, del,
      el('p', { class: 'fineprint', text: 'Los cambios se guardan solos en este navegador. Para publicarlos usa EXPORTAR CONFIG.' }));
  }

  function setEditing(on) { // switch between the public view and the organizer editor without reloading
    EDIT = on; usingDraft = false; cabinData = loadCabins(); selected = null; detail.hidden = true; listSec.hidden = false;
    document.body.classList.toggle('is-editing', on);
    $('#editTools').hidden = !on; $('#editBanner').hidden = !on; $('#panelReco').hidden = on;
    $('#listTitle').textContent = on ? 'EDITAR CABAÑAS' : 'ELIGE TU ALOJAMIENTO';
    document.title = on ? 'Editar cabañas — Maruatazo XII' : 'Maruatazo XII — Mapa de cabañas';
    const b = $('#editToggle'); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? 'SALIR DEL EDITOR' : 'EDITAR CABAÑAS';
    try { const u = new URL(location.href); on ? u.searchParams.set('editar', '1') : u.searchParams.delete('editar'); history.replaceState(null, '', u); } catch { /* ignore */ }
    refresh(); setSheet(!sheet.matches);
  }

  function wireEditTools() {
    const tgl = $('#editToggle'); tgl.hidden = false; vp.classList.add('has-edit-toggle');
    tgl.addEventListener('click', () => setEditing(!EDIT));
    $('#exportCfg').addEventListener('click', () => {
      const bad = validateAll(cabinData);
      if (bad.length && !confirm('Hay datos inválidos:\n' + bad.slice(0, 5).join('\n') + '\n¿Exportar de todos modos?')) return;
      const data = { schema: 'maruatazo-cabins', version: 1, exportedAt: new Date().toISOString(), cabins: cabinData.map(cleanRecord) };
      const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' })), download: 'maruatazo-cabins-export.json' });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    const file = $('#importFile');
    $('#importCfg').addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files[0]; file.value = ''; if (!f) return;
      let data; try { data = JSON.parse(await f.text()); } catch { alert('El archivo no es JSON válido.'); return; }
      const list = Array.isArray(data) ? data : data?.cabins;
      if (!Array.isArray(list)) { alert('El archivo no contiene una lista "cabins".'); return; }
      const bad = validateAll(list);
      if (bad.length) { alert('No se importó nada. Corrige:\n' + bad.slice(0, 8).join('\n')); return; }
      if (!confirm(`Importar ${list.length} cabañas y reemplazar el borrador actual?`)) return;
      store.set(DRAFT_KEY + '-prev', store.get(DRAFT_KEY) || ''); // one-step safety copy
      cabinData = list.map(c => ({ ...c, x: c.x ?? null, y: c.y ?? null })); saveDraft(); selected = null; detail.hidden = true; listSec.hidden = false; refresh();
    });
    $('#discardDraft').addEventListener('click', () => {
      if (!confirm('¿Descartar el borrador local y volver a los datos de cabins-config.js?')) return;
      store.del(DRAFT_KEY); usingDraft = false; cabinData = clone(CFG.cabins); selected = null; detail.hidden = true; listSec.hidden = false; refresh();
    });
  }

  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (selected) deselect(true); else if (panel.classList.contains('open')) setSheet(false); } });
  sheet.addEventListener?.('change', () => setSheet(!sheet.matches));
  setSheet(!sheet.matches);
  reset();
  if (CAN_EDIT) { wireEditTools(); setEditing(EDIT); } else refresh();
  const wanted = new URLSearchParams(location.search).get('tipo'); // deep link from the landing
  const pre = !EDIT && wanted && items.find(c => c.kind === 'type' && c.id === wanted);
  if (pre) select(pre);
  if (reduceMotion.matches) vp.classList.add('reduce-motion');
})();
