/* ==========================================================================
   MARUATAZO XII — IMÁGENES + FONDO DE SECCIÓN + PUBLICACIÓN (extension of the V30 editor)
   • Public part (runs for every visitor): applies the saved section backgrounds (image, crop per device, overlay).
   • Editor part (only where EDITAR WEB is allowed): IMÁGENES tab (upload / library / insert / replace), FONDOS tab
     (change a section's background with live preview, crop per device, overlay, restore), PUBLICAR (deployable package).
   Uses the existing V30 state: sceneBg travels with capture()/restore(), so save, undo/redo, import/export all cover it.
   Uploaded images live in this browser (IndexedDB) until a package is exported and copied into the project: they are NOT
   public before that. No backend, no base64 in the published files.
   ========================================================================== */
(() => {
'use strict';
const E = window.__MZ_EDITOR; if (!E) return;
const doc = document, $ = (s, r = doc) => r.querySelector(s), $$ = (s, r = doc) => [...r.querySelectorAll(s)];
const clone = v => JSON.parse(JSON.stringify(v));
const LIB_KEY = 'maruatazo-v30-library', EXP_KEY = 'maruatazo-v30-last-export';
const MAX_BYTES = 12 * 1024 * 1024, OPT_BYTES = 1.6 * 1024 * 1024, OPT_SIDE = 2400, MIN_W = 300, MIN_H = 200, MAX_SIDE = 12000;
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const DEVS = ['desktop', 'tablet', 'mobile'], DEV_LABEL = { desktop: 'ESCRITORIO', tablet: 'TABLET', mobile: 'MÓVIL' }, DEV_RATIO = { desktop: 1440 / 800, tablet: 820 / 1000, mobile: 390 / 800 };
const SECTIONS = [
  { k: 'landing', label: 'Landing', img: '#cinemaHero .cin-img', wrap: '#cinScene', sec: '#home' },
  { k: 'lineup', label: 'Line Up', img: '#lineup .sec-scene img', wrap: '#lineup .sec-scene', sec: '#lineup' },
  { k: 'info', label: 'Info', img: '#info .sec-scene img', wrap: '#info .sec-scene', sec: '#info' },
  { k: 'cabins', label: 'Cabañas', img: '#cabins .sec-scene img', wrap: '#cabins .sec-scene', sec: '#cabins' },
  { k: 'menu', label: 'Menú', img: '#menu .sec-scene img', wrap: '#menu .sec-scene', sec: '#menu' },
  { k: 'merch', label: 'Merch', img: '#merch .sec-scene img', wrap: '#merch .sec-scene', sec: '#merch' },
  { k: 'boletos', label: 'Boletos', img: '#boletos .sec-scene img', wrap: '#boletos .sec-scene', sec: '#boletos' },
  { k: 'closing', label: 'Closing / Footer', img: '#closing .sec-scene img', wrap: '#closing .sec-scene', sec: '#closing' }
];
const SEC = Object.fromEntries(SECTIONS.map(s => [s.k, s]));
const ORIG = { lineup: { desktop: [50, 49, 1], tablet: [50, 50, 1], mobile: [50, 50, 1] }, info: { desktop: [88, 50, 1], tablet: [62, 50, 1], mobile: [30, 50, 1] } };   // crops shipped in cinema.css
const origCrop = k => clone(ORIG[k] || { desktop: [50, 50, 1], tablet: [50, 50, 1], mobile: [50, 50, 1] });

/* ---------------------------------------------------------------- state: sceneBg[sectionKey] ---------------------------------------------------------------- *
   { src: null | {type:'asset',id,name} | {type:'path',path,name},   // null = keep the shipped image (crop/overlay only)
     crop: {desktop:[x%,y%,zoom],tablet:[…],mobile:[…]}, overlay: {color,a}, prev: [entry|null, …] (newest first; null = the shipped original) } */
let sceneBg = {};
const bgDevice = () => E.editing ? E.activeBreakpoint : (innerWidth <= 767 ? 'mobile' : innerWidth <= 1023 ? 'tablet' : 'desktop');
const urlCache = new Map(); let manifestP = null;
const manifest = () => manifestP || (manifestP = fetch('assets/landing/manifest.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).catch(() => ({})));
async function urlFor(src) {
  if (!src) return null; if (src.type === 'path') return src.path;
  if (src.type !== 'asset') return null; if (urlCache.has(src.id)) return urlCache.get(src.id);
  let u = null; try { const b = await E.getBlob(src.id); if (b) u = URL.createObjectURL(b); } catch { /* not in this browser */ }
  if (!u) { const m = await manifest(); if (typeof m[src.id] === 'string' && /^[\w.\-]+$/.test(m[src.id])) u = 'assets/landing/' + m[src.id]; }   // public visitors: published file
  if (u) urlCache.set(src.id, u); return u;
}
const tokens = {};
async function applyScene(k) {
  const sec = SEC[k], img = $(sec.img), wrap = $(sec.wrap); if (!img || !wrap) return;
  if (img.dataset.mzSrc === undefined) { img.dataset.mzSrc = img.getAttribute('src') || ''; img.dataset.mzSrcset = img.getAttribute('srcset') || ''; img.dataset.mzSizes = img.getAttribute('sizes') || ''; }
  const e = sceneBg[k], my = tokens[k] = (tokens[k] || 0) + 1;
  if (e && e.src) { const u = await urlFor(e.src); if (my !== tokens[k]) return; if (u) { img.removeAttribute('srcset'); img.removeAttribute('sizes'); if (img.getAttribute('src') !== u) img.setAttribute('src', u); img.dataset.mzCustom = '1'; } }
  else if (img.dataset.mzCustom) { img.setAttribute('src', img.dataset.mzSrc); if (img.dataset.mzSrcset) img.setAttribute('srcset', img.dataset.mzSrcset); if (img.dataset.mzSizes) img.setAttribute('sizes', img.dataset.mzSizes); delete img.dataset.mzCustom; }
  const c = e && e.crop && e.crop[bgDevice()];
  if (c) { img.style.setProperty('--x', c[0] + '%'); img.style.setProperty('--y', c[1] + '%'); img.style.setProperty('--z', c[2]); } else ['--x', '--y', '--z'].forEach(p => img.style.removeProperty(p));
  applyDark(k, e);
  const ov = e && e.overlay && e.overlay.a > 0 ? e.overlay : null;
  if (ov) { wrap.style.setProperty('--ov-c', ov.color); wrap.style.setProperty('--ov-a', ov.a); } else { wrap.style.removeProperty('--ov-c'); wrap.style.removeProperty('--ov-a'); }
}
/* OSCURECIMIENTO DEL FONDO (0–100 %): 0 = no darkening, 100 = black. The default shown is each section's saved scene-configuration scrim (maruatazo-scene-config: landing .38, lineup .30, info .38, others .50).
   At that value the page looks exactly as designed. Below it the section's EXISTING design scrim (shape + tint) is scaled down (--dk-s, 0…1); above it a separate black layer (.sec-dark, --dk-a) fades in until 100 % = black.
   Nothing is stacked twice and the image, its crop and its source are never touched. */
const DK_BASE = { landing: .38, lineup: .30, info: .38, cabins: .50, menu: .50, merch: .50, boletos: .50, closing: .50 }, LANDING_S = .50;
const dkOf = (k, e) => (e || sceneBg[k]) && typeof (e || sceneBg[k]).dk === 'number' ? (e || sceneBg[k]).dk : null;
function applyDark(k, e) {
  const sec = SEC[k], wrap = $(sec.wrap), host = k === 'landing' ? $('#cinemaHero') : $(sec.sec); if (!wrap || !host) return;
  const d = dkOf(k, e), B = DK_BASE[k], scale = d == null ? null : Math.min(1, d / B), a = d == null || d <= B ? 0 : (d - B) / (1 - B);
  if (k === 'landing') { if (scale == null) host.style.removeProperty('--s'); else host.style.setProperty('--s', (LANDING_S * scale).toFixed(4)); }
  else if (scale == null) host.style.removeProperty('--dk-s'); else host.style.setProperty('--dk-s', scale.toFixed(4));
  let layer = wrap.querySelector(':scope > .sec-dark');
  if (a > 0) { if (!layer) { layer = doc.createElement('i'); layer.className = 'sec-dark'; layer.setAttribute('aria-hidden', 'true'); wrap.append(layer); } wrap.style.setProperty('--dk-a', a.toFixed(4)); }
  else { wrap.style.removeProperty('--dk-a'); if (layer) layer.remove(); }
}
const applyAll = () => SECTIONS.forEach(s => applyScene(s.k));
E.registerState('sceneBg', { get: () => sceneBg, set: v => { sceneBg = v && typeof v === 'object' ? v : {}; }, empty: () => ({}), apply: applyAll });
E.onChange(applyAll);
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(applyAll, 120); });

if (!E.allowed) return;   // ============ everything below is editor-only ============

/* ---------------------------------------------------------------- helpers ---------------------------------------------------------------- */
const h = (tag, props = {}, ...kids) => { const n = doc.createElement(tag); for (const [k, v] of Object.entries(props)) { if (v == null || v === false) continue; if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v); } kids.flat().forEach(c => c != null && c !== false && n.append(c)); return n; };
const fmtMB = b => (b / 1048576).toFixed(b > 1048576 * 10 ? 0 : 2) + ' MB';
const fmtTime = iso => { try { return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };
async function sha256(blob) { try { if (crypto && crypto.subtle) { const d = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join(''); } } catch { /* insecure context */ } let a = 2166136261 >>> 0; const u = new Uint8Array(await blob.arrayBuffer()); for (let i = 0; i < u.length; i += 7) a = Math.imul(a ^ u[i], 16777619) >>> 0; return 'f' + a.toString(16).padStart(8, '0') + blob.size.toString(16).padStart(8, '0') + 'x'.repeat(40); }
const libLoad = () => { try { return JSON.parse(localStorage.getItem(LIB_KEY) || '[]'); } catch { return []; } };
const libSave = l => { try { localStorage.setItem(LIB_KEY, JSON.stringify(l)); return true; } catch { return false; } };
let LIB = libLoad();

/* ---------------------------------------------------------------- upload: validate, optimise, de-duplicate ---------------------------------------------------------------- */
async function sniff(file) { const b = new Uint8Array(await file.slice(0, 16).arrayBuffer()); const s = (a, z) => String.fromCharCode(...b.slice(a, z));
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg'; if (b[0] === 0x89 && s(1, 4) === 'PNG') return 'image/png'; if (s(0, 4) === 'RIFF' && s(8, 12) === 'WEBP') return 'image/webp'; return ''; }
async function ingest(file) {
  const nm = '"' + file.name + '"';
  if (!file.size) throw new Error(nm + ' está vacío.');
  const type = await sniff(file);
  if (!type) throw new Error(nm + ' no se puede usar: solo JPG, PNG o WebP (detectado: ' + (file.type || file.name.split('.').pop() || 'desconocido') + '). Conviértelo, por ejemplo con Vista Previa → Archivo → Exportar.');
  if (file.size > MAX_BYTES) throw new Error(nm + ' pesa ' + fmtMB(file.size) + '; el máximo es ' + fmtMB(MAX_BYTES) + '. Redúcelo antes de subirlo.');
  let bmp; try { bmp = await createImageBitmap(file); } catch { throw new Error(nm + ' está dañado o no se pudo leer como imagen.'); }
  const w = bmp.width, hgt = bmp.height;
  if (w < MIN_W || hgt < MIN_H) { bmp.close && bmp.close(); throw new Error(nm + ' es muy pequeño (' + w + '×' + hgt + ' px); mínimo ' + MIN_W + '×' + MIN_H + '.'); }
  if (w > MAX_SIDE || hgt > MAX_SIDE) { bmp.close && bmp.close(); throw new Error(nm + ' mide ' + w + '×' + hgt + ' px; el máximo es ' + MAX_SIDE + ' px por lado.'); }
  let blob = file, bt = type, W = w, H = hgt, note = '';
  if (Math.max(w, hgt) > OPT_SIDE || file.size > OPT_BYTES) {     // lightweight for a static site: downscale + re-encode a COPY (the original file on the Mac is never touched)
    const sc = Math.min(1, OPT_SIDE / Math.max(w, hgt)); W = Math.round(w * sc); H = Math.round(hgt * sc);
    const cv = doc.createElement('canvas'); cv.width = W; cv.height = H; cv.getContext('2d').drawImage(bmp, 0, 0, W, H);
    const out = await new Promise(r => cv.toBlob(r, 'image/webp', .88));
    if (out && out.type === 'image/webp' && out.size < file.size) { blob = out; bt = 'image/webp'; note = 'optimizada ' + fmtMB(file.size) + ' → ' + fmtMB(out.size) + (sc < 1 ? ' (' + W + '×' + H + ')' : ''); } else { W = w; H = hgt; }
  }
  bmp.close && bmp.close();
  const hash = await sha256(blob), id = 'lib-' + hash.slice(0, 12), dup = LIB.find(x => x.id === id);
  if (dup) return { item: dup, dup: true };
  await E.storeBlob(id, blob);
  const item = { id, name: file.name.replace(/\.[^.]+$/, '').slice(0, 60), type: bt, bytes: blob.size, w: W, h: H, hash, added: Date.now(), note };
  LIB.push(item); if (!libSave(LIB)) throw new Error('El navegador no pudo guardar la lista de imágenes (almacenamiento lleno).');
  return { item, dup: false };
}

/* ---------------------------------------------------------------- UI shell ---------------------------------------------------------------- */
const panel = E.panel, tabsBar = $('[data-le-tab]').parentElement, paneHost = $('[data-le-pane="style"]').parentElement;
doc.head.append(h('style', {}, `
.mz{font:12px/1.4 system-ui,sans-serif;color:#eaf2f1}.mz *{box-sizing:border-box}.mz .mz-sub{margin:14px 0 6px;font:800 10px system-ui;letter-spacing:.14em;color:#e8b04a}
.mz .mz-primary{width:100%;min-height:42px;border:0;border-radius:10px;background:#e8b04a;color:#14211f;font:800 12px system-ui;letter-spacing:.08em;cursor:pointer}.mz .mz-btn{min-height:34px;padding:0 10px;border:1px solid #2a3f4b;border-radius:8px;background:#1a2b35;color:#eaf2f1;font:800 10px system-ui;letter-spacing:.06em;cursor:pointer;margin:3px 3px 0 0}.mz .mz-btn:hover{background:#22394a}.mz .mz-btn:disabled{opacity:.4;cursor:not-allowed}.mz .mz-red{border-color:#7a3a2c;color:#ff9d85}
.mz .mz-drop{margin:8px 0;padding:16px 10px;border:2px dashed #3a5563;border-radius:12px;text-align:center;color:#9db4b8;cursor:pointer}.mz .mz-drop.over{border-color:#e8b04a;background:rgba(232,176,74,.08);color:#fff}
.mz .mz-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.mz .mz-th{position:relative;aspect-ratio:3/2;border:2px solid transparent;border-radius:8px;overflow:hidden;background:#0a1013;padding:0;cursor:pointer}.mz .mz-th img{width:100%;height:100%;object-fit:cover;display:block}.mz .mz-th.sel{border-color:#e8b04a}.mz .mz-th small{position:absolute;left:0;right:0;bottom:0;padding:2px 4px;background:rgba(6,12,20,.78);font:600 9px system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}
.mz .mz-msg{margin:6px 0;padding:8px 10px;border-radius:8px;font-size:11px;white-space:pre-wrap}.mz .mz-msg.err{background:rgba(229,116,90,.14);border:1px solid #7a3a2c;color:#ffb4a2}.mz .mz-msg.ok{background:rgba(111,207,151,.1);border:1px solid #2f6b4a;color:#9be0b8}.mz .mz-msg.info{background:rgba(157,180,184,.08);border:1px solid #2a3f4b;color:#cdbf9a}
.mz .mz-box{padding:10px;border:1px solid #2a3f4b;border-radius:10px;background:rgba(255,255,255,.03);margin:8px 0}.mz details>summary{cursor:pointer;font:800 10px system-ui;letter-spacing:.1em;color:#9db4b8;margin:10px 0 6px}
.mz label.mz-r{display:flex;align-items:center;gap:6px;margin:6px 0;font:700 10px system-ui;letter-spacing:.06em;color:#9db4b8}.mz label.mz-r span{min-width:64px}.mz input[type=range]{flex:1;accent-color:#e8b04a}.mz output{min-width:38px;text-align:right;color:#eaf2f1;font:11px system-ui}
.mz .mz-secs{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}.mz .mz-sc{display:flex;gap:6px;align-items:center;padding:5px;border:2px solid #2a3f4b;border-radius:8px;background:#142129;cursor:pointer;text-align:left;color:#eaf2f1}.mz .mz-sc.sel{border-color:#e8b04a}.mz .mz-sc img{width:44px;height:30px;object-fit:cover;border-radius:4px;flex:none}.mz .mz-sc b{font:800 10px system-ui}.mz .mz-sc em{display:block;font:600 9px system-ui;color:#9db4b8;font-style:normal}
.mz .mz-prev{position:relative;margin:8px auto;overflow:hidden;border-radius:8px;background:#000;max-width:100%}.mz .mz-prev img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.mz .mz-prev .ov{position:absolute;inset:0}.mz .mz-prev .tx{position:absolute;left:8%;top:12%;font:700 clamp(14px,4vw,26px)/1 Cinzel,Georgia,serif;letter-spacing:.06em;color:#efe2c4;text-shadow:0 2px 12px rgba(0,0,0,.7)}.mz .mz-prev .tx small{display:block;margin-top:6px;font:italic 400 11px Georgia,serif;letter-spacing:0;color:#f1e6cc}
.mz .mz-pub li{margin:3px 0;list-style:none}.mz .mz-pub ul{padding:0;margin:6px 0}.mz .mz-ok{color:#9be0b8}.mz .mz-warn{color:#f1c56a}.mz .mz-bad{color:#ff9d85}`));
const tabImg = h('button', { 'data-le-tab': 'images', type: 'button', text: 'IMÁGENES' }), tabBg = h('button', { 'data-le-tab': 'bg', type: 'button', text: 'FONDOS' });
tabsBar.append(tabImg, tabBg);
const paneImg = h('div', { class: 'le-pane', 'data-le-pane': 'images' }), paneBg = h('div', { class: 'le-pane', 'data-le-pane': 'bg' });
paneHost.append(paneImg, paneBg);
const showTab = name => { $$('[data-le-tab]').forEach(b => b.classList.toggle('active', b.dataset.leTab === name)); $$('[data-le-pane]').forEach(p => p.classList.toggle('active', p.dataset.lePane === name)); };
[tabImg, tabBg].forEach(b => b.addEventListener('click', () => showTab(b.dataset.leTab)));

/* ---------------------------------------------------------------- library data ---------------------------------------------------------------- */
let siteItems = null, catItems = null, selItem = null;
function collectSite() {
  const seen = new Set(), out = [];
  const push = (path, name) => { if (!path || seen.has(path)) return; seen.add(path); out.push({ kind: 'site', path, name }); };
  SECTIONS.forEach(s => { const i = $(s.img); if (i) push(i.dataset.mzSrc || i.getAttribute('src'), s.label + ' (actual)'); });
  $$('img').forEach(i => { const p = i.getAttribute('src') || ''; if (/^assets\/(?!title\/|fonts\/)/.test(p) && !i.closest('#landingStudio')) push(p, p.split('/').pop().replace(/\.[^.]+$/, '')); });
  return out;
}
async function collectCat() { try { const r = await fetch('scene-picker/catalog.json', { cache: 'no-cache' }); if (!r.ok) return []; const j = await r.json(); return (j.scenes || []).map(s => ({ kind: 'cat', path: s.web, name: s.name || s.id, w: s.width, h: s.height, bytes: s.bytes })); } catch { return []; } }
const thumbUrl = async it => it.kind === 'mine' ? urlFor({ type: 'asset', id: it.id }) : it.path;
const asSrc = it => it.kind === 'mine' ? { type: 'asset', id: it.id, name: it.name } : { type: 'path', path: it.path, name: it.name };
const sameItem = (a, b) => a && b && a.kind === b.kind && (a.id || a.path) === (b.id || b.path);

/* ---------------------------------------------------------------- IMÁGENES pane ---------------------------------------------------------------- */
const msg = h('div', { id: 'mzMsg', role: 'status', 'aria-live': 'polite' });
const say = (t, k = 'info') => { msg.replaceChildren(h('div', { class: 'mz-msg ' + k, text: t })); };
const fileInput = h('input', { type: 'file', id: 'mzFile', accept: 'image/jpeg,image/png,image/webp', multiple: 'multiple', hidden: 'hidden' });
const drop = h('div', { class: 'mz-drop', id: 'mzDrop', tabindex: '0', role: 'button', 'aria-label': 'Subir imágenes' }, h('b', { text: 'Arrastra imágenes aquí desde Finder' }), h('br'), 'o haz clic para elegirlas', h('br'), h('small', { text: 'JPG · PNG · WebP · máx. ' + fmtMB(MAX_BYTES) + ' · mín. 300×200 px' }));
const targetSel = h('select', { id: 'mzTarget', 'aria-label': 'Sección donde insertar' });
const mineGrid = h('div', { class: 'mz-grid', id: 'mzMine' }), siteGrid = h('div', { class: 'mz-grid', id: 'mzSite' }), catGrid = h('div', { class: 'mz-grid', id: 'mzCat' });
const selBox = h('div', { class: 'mz-box', id: 'mzSel', hidden: 'hidden' });
const pubBox = h('div', { class: 'mz mz-box mz-pub', id: 'mzPub' });
paneImg.append(h('div', { class: 'mz' },
  h('button', { class: 'mz-primary', id: 'mzAdd', type: 'button', text: 'AGREGAR IMAGEN', onclick: () => fileInput.click() }),
  h('label', { class: 'mz-r' }, h('span', { text: 'INSERTAR EN' }), targetSel), drop, fileInput, msg,
  h('div', { class: 'mz-sub', text: 'MIS IMÁGENES (subidas en este navegador)' }), mineGrid, selBox,
  h('details', { open: 'open' }, h('summary', { text: 'ESCENAS DEL JUEGO Y FOTOS DEL SITIO' }), siteGrid),
  h('details', {}, h('summary', { text: 'MÁS ESCENAS DEL JUEGO (biblioteca local del proyecto)' }), catGrid),
  h('div', { class: 'mz-sub', text: 'PUBLICAR' }), pubBox));

function fillTargets() { const src = $('#leSection'); targetSel.replaceChildren(...(src ? [...src.options] : []).map(o => h('option', { value: o.value, text: o.textContent }))); if (src) targetSel.value = src.value; }
targetSel.addEventListener('change', () => { const el = $(`[data-le-section="${CSS.escape(targetSel.value)}"]`); if (el) { E.currentSection = el; const s = $('#leSection'); if (s) s.value = targetSel.value; } });
const secEl = () => $(`[data-le-section="${CSS.escape(targetSel.value)}"]`) || E.currentSection;

async function thumb(it, extra = {}) {
  const b = h('button', { class: 'mz-th' + (sameItem(it, selItem) ? ' sel' : ''), type: 'button', title: it.name, 'aria-label': it.name, onclick: () => { selItem = it; renderSel(); renderGrids(); } }, h('small', { text: it.name }));
  thumbUrl(it).then(u => { if (u) b.prepend(h('img', { src: u, alt: '', loading: 'lazy', decoding: 'async' })); }); return b;
}
async function renderGrids() {
  mineGrid.replaceChildren(...(LIB.length ? await Promise.all(LIB.map(x => thumb({ kind: 'mine', ...x }))) : [h('div', { class: 'mz-msg info', style: 'grid-column:1/-1', text: 'Aún no has subido imágenes. Usa AGREGAR IMAGEN o arrástralas aquí.' })]));
  siteItems = siteItems || collectSite(); siteGrid.replaceChildren(...await Promise.all(siteItems.map(x => thumb(x))));
  if (catItems === null) catItems = await collectCat(); catGrid.replaceChildren(...(catItems.length ? await Promise.all(catItems.map(x => thumb(x))) : [h('div', { class: 'mz-msg info', style: 'grid-column:1/-1', text: 'Esta biblioteca solo existe en el equipo del proyecto.' })]));
}
function renderSel() {
  selBox.hidden = !selItem; if (!selItem) return; const it = selItem, isImg = E.selected && E.selected.tagName === 'IMG';
  selBox.replaceChildren(h('b', { text: it.name }), h('div', { style: 'color:#9db4b8;margin:2px 0 6px', text: (it.kind === 'mine' ? 'Subida · ' + it.w + '×' + it.h + ' · ' + fmtMB(it.bytes) + (it.note ? ' · ' + it.note : '') : it.kind === 'cat' ? 'Escena del juego (biblioteca local; se copia al paquete al publicar)' : 'Imagen del sitio') }),
    h('button', { class: 'mz-btn', type: 'button', text: 'INSERTAR EN LA PÁGINA', onclick: () => insertImage(it, secEl()) }),
    h('button', { class: 'mz-btn', type: 'button', text: 'USAR COMO FONDO…', onclick: () => { showTab('bg'); startChange(curSec, it); } }),
    h('button', { class: 'mz-btn', type: 'button', disabled: isImg ? null : 'disabled', title: isImg ? '' : 'Selecciona primero una imagen en la página', text: 'REEMPLAZAR LA IMAGEN SELECCIONADA', onclick: () => replaceSelected(it) }),
    it.kind === 'mine' ? h('button', { class: 'mz-btn mz-red', type: 'button', text: 'QUITAR DE MIS IMÁGENES', onclick: () => removeMine(it) }) : null);
}
async function removeMine(it) {
  const used = [];
  ['desktop', 'tablet', 'mobile'].forEach(bp => Object.values(E.capture().responsive[bp] || {}).forEach(s => { if (s && s.assetId === it.id && !s.deleted) used.push('una imagen de la página'); })); Object.entries(sceneBg).forEach(([k, e]) => { if (e.src && e.src.id === it.id) used.push('el fondo de ' + SEC[k].label); });
  if (used.length) { say('No se puede quitar: se usa en ' + [...new Set(used)].join(' y ') + '. Cámbiala primero.', 'err'); return; }
  if (!confirm('¿Quitar "' + it.name + '" de tus imágenes? (Tu archivo original en el Mac no se toca.)')) return;
  LIB = LIB.filter(x => x.id !== it.id); libSave(LIB); selItem = null; renderSel(); renderGrids(); say('Imagen quitada de la biblioteca.', 'ok');
}

async function handleFiles(files, opts = {}) {
  const list = [...files]; if (!list.length) return; const ok = [], errs = [], dups = [];
  for (const f of list) { try { const r = await ingest(f); (r.dup ? dups : ok).push(r.item); if (r.dup) ok.push(r.item); } catch (e) { errs.push(e.message); } }
  await renderGrids();
  let t = ''; if (ok.length) t += '✓ ' + ok.length + ' imagen(es) lista(s)' + (dups.length ? ' (' + dups.length + ' ya estaba(n) en tu biblioteca: se reutiliza)' : '') + '. ' + (ok[0].note || '') + '\n';
  if (errs.length) t += '✗ ' + errs.join('\n✗ ');
  say(t.trim(), errs.length && !ok.length ? 'err' : errs.length ? 'info' : 'ok');
  if (ok.length && opts.insert !== false) { selItem = { kind: 'mine', ...ok[0] }; renderSel(); await insertImage(selItem, opts.section || secEl(), true); }
}
fileInput.addEventListener('change', () => { handleFiles(fileInput.files); fileInput.value = ''; });
drop.addEventListener('click', () => fileInput.click()); drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
doc.addEventListener('dragover', e => { if (E.editing && hasFiles(e)) e.preventDefault(); });
doc.addEventListener('drop', e => { if (!E.editing || !hasFiles(e) || e.defaultPrevented) return; e.preventDefault(); const t = doc.elementFromPoint(e.clientX, e.clientY), sec = t && t.closest('[data-le-section]'); handleFiles(e.dataTransfer.files, { section: sec || secEl() }); });

async function insertImage(it, section, keepMsg) {
  if (section) { E.currentSection = section; }
  const el = E.makeAdded('img', 'image'); el.alt = it.name || ''; el.style.width = '320px'; el.style.height = 'auto'; el.style.objectFit = 'contain';
  if (it.kind === 'mine') { el.dataset.assetId = it.id; await E.hydrateImage(el, it.id); } else el.setAttribute('src', it.path);
  E.recordElement(el, 'all'); E.select(el); E.pushHistory(); E.autosave();
  const note = h('div', { class: 'mz-msg ok', text: '✓ Imagen insertada en ' + (section && section.dataset.leSection || 'la página') + '. Arrástrala, cambia su tamaño con la esquina, o usa ESTILO para opacidad y ajuste.' }); if (keepMsg) msg.append(note); else msg.replaceChildren(note);
}
async function replaceSelected(it) {
  const el = E.selected; if (!el || el.tagName !== 'IMG') { say('Selecciona primero una imagen en la página.', 'err'); return; }
  el.removeAttribute('srcset'); el.removeAttribute('sizes');
  if (it.kind === 'mine') { el.dataset.assetId = it.id; await E.hydrateImage(el, it.id); } else { delete el.dataset.assetId; el.setAttribute('src', it.path); }
  E.recordElement(el); E.pushHistory(); E.autosave(); E.syncInspector(); say('✓ Imagen reemplazada (posición y estilo se conservan).', 'ok');
}

/* ---------------------------------------------------------------- FONDOS pane (section background editor) ---------------------------------------------------------------- */
let curSec = 'info', draft = null, dDev = 'desktop', chooser = false;
const bgHead = h('div', { class: 'mz-secs', id: 'mzSecs' }), bgCur = h('div', { class: 'mz-box', id: 'mzBgCur' }), bgEdit = h('div', { class: 'mz-box', id: 'mzBgEdit', hidden: 'hidden' }), bgChoose = h('div', { class: 'mz-box', id: 'mzBgChoose', hidden: 'hidden' }), bgMsg = h('div', { id: 'mzBgMsg', role: 'status', 'aria-live': 'polite' });
paneBg.append(h('div', { class: 'mz' }, h('div', { class: 'mz-sub', text: 'FONDO DE SECCIÓN' }), bgHead, bgMsg, bgCur, bgChoose, bgEdit));
const bgSay = (t, k = 'info') => bgMsg.replaceChildren(h('div', { class: 'mz-msg ' + k, text: t }));
const curImg = k => $(SEC[k].img);
const curEntry = k => sceneBg[k] || null;
function darkBox() {
  const k = curSec, B = DK_BASE[k], cur = dkOf(k), val = Math.round((cur == null ? B : cur) * 100), out = h('output', { id: 'mzDkOut', text: val + '%' }), warn = h('div', { id: 'mzDkWarn', class: 'mz-msg err', hidden: 'hidden', role: 'status' });
  const r = h('input', { type: 'range', id: 'mzDk', min: 0, max: 100, value: val, 'aria-label': 'Oscurecimiento del fondo de ' + SEC[k].label });
  const setDk = v => { const e = sceneBg[k] || (sceneBg[k] = { src: null, crop: null, overlay: null, prev: [] }); e.dk = v; applyScene(k); E.markDirty(); };
  r.addEventListener('input', () => { out.textContent = r.value + '%'; setDk(+r.value / 100); checkContrast(k, +r.value / 100, warn); });   // live on the real section background
  r.addEventListener('change', () => { E.pushHistory(); E.autosave(); renderSecs(); });                                                            // one drag = one history step
  const reset = h('button', { class: 'mz-btn mz-red', id: 'mzDkReset', type: 'button', disabled: cur == null ? 'disabled' : null, text: 'RESTABLECER ORIGINAL', onclick: () => { const e = sceneBg[k]; if (!e) return; delete e.dk; if (!e.src && !e.crop && !e.overlay) delete sceneBg[k]; applyScene(k); E.pushHistory(); E.autosave(); renderBg(); bgSay('Oscurecimiento de ' + SEC[k].label + ' restablecido al valor original (' + Math.round(B * 100) + '%).', 'ok'); } });
  checkContrast(k, cur == null ? B : cur, warn);
  return h('div', { class: 'mz-box', id: 'mzDkBox' }, h('b', { text: 'OSCURECIMIENTO DEL FONDO' }), h('label', { class: 'mz-r' }, h('span', { text: SEC[k].label.toUpperCase() }), r, out),
    h('div', { style: 'color:#9db4b8;font-size:10px' }, '0% = imagen sin oscurecer · 100% = negro. Valor original: ' + Math.round(B * 100) + '%. Solo cambia una capa de oscurecimiento: la imagen y su encuadre no se tocan; los degradados de transición entre secciones se mantienen.'), reset, warn);
}
let dkTimer; function checkContrast(k, d, box) {   // warning only: never changes the value the user chose
  clearTimeout(dkTimer); dkTimer = setTimeout(() => { const img = $(SEC[k].img); if (!img || !img.naturalWidth) return; try { const cv = doc.createElement('canvas'); cv.width = 32; cv.height = 18; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, 32, 18); const px = cx.getImageData(0, 0, 32, 18).data, f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }, L = []; for (let i = 0; i < px.length; i += 4) L.push(.2126 * f(px[i]) + .7152 * f(px[i + 1]) + .0722 * f(px[i + 2])); L.sort((a, b) => a - b);
      const bright = L[Math.floor(L.length * .9)] * (1 - d), ratio = (0.8 + .05) / (bright + .05); if (ratio < 4.5) { box.hidden = false; box.textContent = '⚠ Con ' + Math.round(d * 100) + '% de oscurecimiento, el texto claro podría leerse mal sobre las zonas más luminosas (contraste estimado ' + ratio.toFixed(1) + ':1; lo recomendado es 4.5:1). Tu valor no se ha cambiado.'; } else box.hidden = true; } catch { box.hidden = true; } }, 120); }
function renderSecs() {
  bgHead.replaceChildren(...SECTIONS.map(s => { const i = curImg(s.k), e = curEntry(s.k); return h('button', { class: 'mz-sc' + (s.k === curSec ? ' sel' : ''), type: 'button', onclick: () => { curSec = s.k; draft = null; chooser = false; renderBg(); } }, h('img', { src: i ? (i.currentSrc || i.src) : '', alt: '' }), h('span', {}, h('b', { text: s.label }), h('em', { text: (e ? (e.src ? 'imagen cambiada' : e.crop || e.overlay ? 'encuadre ajustado' : 'original aprobado') : 'original aprobado') + (dkOf(s.k) != null ? ' · oscuridad ' + Math.round(dkOf(s.k) * 100) + '%' : '') }))); }));
}
function renderBg() {
  renderSecs(); const e = curEntry(curSec), i = curImg(curSec);
  bgCur.replaceChildren(h('b', { text: SEC[curSec].label + ' — fondo actual' }), h('div', { class: 'mz-prev', style: 'width:100%;aspect-ratio:16/9' }, h('img', { src: i ? (i.currentSrc || i.src) : '', alt: '' })),
    h('div', { style: 'color:#9db4b8;margin:2px 0 6px', text: e ? (e.src ? 'Personalizado: ' + (e.src.name || e.src.path || e.src.id) : e.crop || e.overlay ? 'Imagen original con encuadre/overlay propios' : 'Imagen original (solo cambia el oscurecimiento)') : 'Es el fondo ORIGINAL aprobado.' }),
    h('button', { class: 'mz-primary', type: 'button', text: 'CAMBIAR FONDO', onclick: () => { chooser = true; draft = null; renderBg(); } }),
    h('button', { class: 'mz-btn', type: 'button', text: 'AJUSTAR ENCUADRE', onclick: () => startChange(curSec, null) }),
    h('button', { class: 'mz-btn', type: 'button', disabled: e && e.prev && e.prev.length ? null : 'disabled', text: 'RESTAURAR ANTERIOR', onclick: restorePrev }),
    h('button', { class: 'mz-btn mz-red', type: 'button', disabled: e ? null : 'disabled', text: 'RESTAURAR ORIGINAL', onclick: restoreOrig }),
    darkBox());
  bgChoose.hidden = !chooser; if (chooser) renderChooser();
  bgEdit.hidden = !draft; if (draft) renderDraft();
}
async function renderChooser() {
  const items = [...LIB.map(x => ({ kind: 'mine', ...x })), ...(siteItems || (siteItems = collectSite())), ...(catItems === null ? (catItems = await collectCat()) : catItems)];
  const g = h('div', { class: 'mz-grid' }); const btns = await Promise.all(items.map(async it => { const b = h('button', { class: 'mz-th', type: 'button', title: it.name, 'aria-label': 'Usar ' + it.name, onclick: () => startChange(curSec, it) }, h('small', { text: it.name })); const u = await thumbUrl(it); if (u) b.prepend(h('img', { src: u, alt: '', loading: 'lazy' })); return b; })); g.append(...btns);
  const up = h('button', { class: 'mz-btn', type: 'button', text: 'SUBIR UNA IMAGEN NUEVA…', onclick: () => { const f = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp' }); f.addEventListener('change', async () => { try { const r = await ingest(f.files[0]); await renderGrids(); startChange(curSec, { kind: 'mine', ...r.item }); } catch (er) { bgSay(er.message, 'err'); } }); f.click(); } });
  bgChoose.replaceChildren(h('b', { text: 'Elige la nueva imagen para ' + SEC[curSec].label }), h('div', { style: 'margin:6px 0' }, up, h('button', { class: 'mz-btn', type: 'button', text: 'CANCELAR', onclick: () => { chooser = false; renderBg(); } })), g);
}
function startChange(k, it) {
  curSec = k; chooser = false; const e = curEntry(k), crop = e && e.crop ? clone(e.crop) : origCrop(k);
  draft = { src: it ? asSrc(it) : (e ? clone(e.src) : null), crop, overlay: e && e.overlay ? clone(e.overlay) : { color: '#06101a', a: 0 }, previewUrl: null, name: it ? it.name : null };
  dDev = E.activeBreakpoint || 'desktop'; renderBg();
}
async function draftUrl() { if (draft.src) return urlFor(draft.src); const i = curImg(curSec); return i ? (i.dataset.mzSrc ? (i.dataset.mzCustom ? i.dataset.mzSrc : (i.currentSrc || i.src)) : (i.currentSrc || i.src)) : ''; }
function renderDraft() {
  const d = draft, c = d.crop[dDev], row = (lab, id, min, max, val, fmt, on) => { const out = h('output', { text: fmt(val) }), r = h('input', { type: 'range', id, min, max, value: val }); r.addEventListener('input', () => { out.textContent = fmt(+r.value); on(+r.value); upd(); }); return h('label', { class: 'mz-r' }, h('span', { text: lab }), r, out); };
  const prev = h('div', { class: 'mz-prev', id: 'mzPrev', style: `width:min(100%,${dDev === 'desktop' ? 340 : dDev === 'tablet' ? 220 : 140}px);aspect-ratio:${DEV_RATIO[dDev]}` }), pimg = h('img', { alt: '' }), pov = h('div', { class: 'ov' }), tx = h('div', { class: 'tx' }, SEC[curSec].label.toUpperCase(), h('small', { text: 'Así se leerá el título sobre este fondo' }));
  prev.append(pimg, pov, tx);
  function upd() { const cc = d.crop[dDev]; pimg.style.objectPosition = cc[0] + '% ' + cc[1] + '%'; pimg.style.transformOrigin = cc[0] + '% ' + cc[1] + '%'; pimg.style.transform = 'scale(' + cc[2] + ')'; pov.style.background = d.overlay.color; pov.style.opacity = d.overlay.a; }
  draftUrl().then(u => { pimg.src = u || ''; });
  const dv = h('div', {}, ...DEVS.map(x => h('button', { class: 'mz-btn' + (x === dDev ? ' mz-red' : ''), type: 'button', text: DEV_LABEL[x], onclick: () => { dDev = x; renderDraft(); } })));
  const ovc = h('input', { type: 'color', value: d.overlay.color }); ovc.addEventListener('input', () => { d.overlay.color = ovc.value; upd(); });
  bgEdit.replaceChildren(h('b', { text: 'AJUSTAR ENCUADRE — vista previa (aún no aplicada)' }), dv, prev,
    row('FOCO X', 'mzFx', 0, 100, c[0], v => v + '%', v => { d.crop[dDev][0] = v; }), row('FOCO Y', 'mzFy', 0, 100, c[1], v => v + '%', v => { d.crop[dDev][1] = v; }), row('ZOOM', 'mzFz', 100, 220, Math.round(c[2] * 100), v => (v / 100).toFixed(2) + '×', v => { d.crop[dDev][2] = v / 100; }),
    h('label', { class: 'mz-r' }, h('span', { text: 'COLOR OVERLAY' }), ovc), row('OPACIDAD', 'mzOa', 0, 90, Math.round(d.overlay.a * 100), v => v + '%', v => { d.overlay.a = v / 100; }),
    h('div', {}, h('button', { class: 'mz-btn', type: 'button', text: 'COPIAR ESTE ENCUADRE A LOS OTROS TAMAÑOS', onclick: () => { DEVS.forEach(x => { d.crop[x] = [...d.crop[dDev]]; }); bgSay('Encuadre copiado a los tres tamaños.', 'info'); } })),
    h('div', { style: 'margin-top:8px' }, h('button', { class: 'mz-primary', type: 'button', text: 'APLICAR FONDO', onclick: applyDraft }), h('button', { class: 'mz-btn', type: 'button', text: 'CANCELAR', onclick: () => { draft = null; renderBg(); } })));
  upd();
}
function applyDraft() {
  const k = curSec, old = curEntry(k), keep = old ? (({ prev, ...r }) => r)(clone(old)) : null;
  sceneBg[k] = { src: draft.src, crop: clone(draft.crop), overlay: clone(draft.overlay), prev: [keep, ...((old && old.prev) || [])].slice(0, 6) }; if (old && typeof old.dk === 'number') sceneBg[k].dk = old.dk;
  draft = null; E.pushHistory(); E.autosave(); applyScene(k).then(() => { bgSay('✓ Fondo de ' + SEC[k].label + ' aplicado. Puedes deshacer (⌘Z) o restaurar el anterior/original.', 'ok'); renderBg(); });
}
function restorePrev() { const k = curSec, e = curEntry(k); if (!e || !e.prev || !e.prev.length) return; const [p, ...rest] = e.prev; if (p === null) delete sceneBg[k]; else sceneBg[k] = { ...p, prev: rest }; E.pushHistory(); E.autosave(); applyScene(k).then(() => { bgSay('Fondo anterior restaurado.', 'ok'); renderBg(); }); }
function restoreOrig() { const k = curSec; if (!sceneBg[k]) return; if (!confirm('¿Restaurar el fondo ORIGINAL aprobado de ' + SEC[k].label + '?')) return; delete sceneBg[k]; E.pushHistory(); E.autosave(); applyScene(k).then(() => { bgSay('✓ Fondo original aprobado restaurado.', 'ok'); renderBg(); }); }
E.onChange(() => { if (panel.classList.contains('show') && paneBg.classList.contains('active')) renderSecs(); });

/* ---------------------------------------------------------------- PUBLICAR: deployable package (zip: site-design.js + assets) ---------------------------------------------------------------- */
const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t.push(c >>> 0); } return t; })();
const crc32 = u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = crcT[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0; const d = new Date(), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length, lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(10, tm, true); lh.setUint16(12, dt, true); lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, name.length, true);
    parts.push(lh.buffer, name, f.data);
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(12, tm, true); ch.setUint16(14, dt, true); ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    cen.push(ch.buffer, name); off += 30 + name.length + sz;
  }
  const cd = cen.reduce((a, b) => a + b.byteLength, 0), end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cd, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...cen, end.buffer], { type: 'application/zip' });
}
async function verifyZip(blob, files) {   // re-read the archive we just built: entry count, names and CRC of every file
  const u = new Uint8Array(await blob.arrayBuffer()), dv = new DataView(u.buffer); let e = u.length - 22; while (e > 0 && dv.getUint32(e, true) !== 0x06054b50) e--; if (e <= 0) return { ok: false, why: 'sin directorio central' };
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true), ok = n === files.length; const dec = new TextDecoder(), bad = [];
  for (let i = 0; i < n; i++) { const nl = dv.getUint16(p + 28, true), name = dec.decode(u.slice(p + 46, p + 46 + nl)), crc = dv.getUint32(p + 16, true), size = dv.getUint32(p + 24, true), lo = dv.getUint32(p + 42, true), dl = dv.getUint16(lo + 26, true), el = dv.getUint16(lo + 28, true), data = u.slice(lo + 30 + dl + el, lo + 30 + dl + el + size); const f = files.find(x => x.name === name); if (!f || crc32(data) !== crc || crc !== crc32(f.data)) bad.push(name); p += 46 + nl; }
  return { ok: ok && !bad.length, count: n, bad };
}
const utf8 = s => new TextEncoder().encode(s);
const readExp = () => { try { return JSON.parse(localStorage.getItem(EXP_KEY) || 'null'); } catch { return null; } };
E.onDirty(() => { const x = readExp(); if (x && !x.dirtySince) { x.dirtySince = true; try { localStorage.setItem(EXP_KEY, JSON.stringify(x)); } catch { /* ignore */ } } });
function renderPub(report) {
  const pub = window.MARUATAZO_PUBLISHED_DESIGN, x = readExp();
  pubBox.replaceChildren(h('div', { class: 'mz-msg info', text: 'LOCAL ≠ PUBLICADO. Lo que guardas aquí vive solo en este navegador. Para que lo vea el público: exporta el paquete, descomprímelo dentro de la carpeta del proyecto (reemplaza site-design.js) y sube el sitio a tu hosting.' }),
    h('ul', {}, h('li', { text: 'Este navegador: ' + (E.dirty ? '● hay cambios sin guardar' : '✓ guardado' + (E.lastSavedAt ? ' · ' + fmtTime(E.lastSavedAt) : '')) }),
      h('li', { text: 'Último paquete exportado: ' + (x ? fmtTime(x.at) + (x.dirtySince ? ' — HAY CAMBIOS POSTERIORES sin exportar' : ' — sin cambios posteriores') + ' (aún no es público hasta desplegarlo)' : 'ninguno') }),
      h('li', { text: 'Sitio público (site-design.js): ' + (pub ? 'diseño publicado el ' + fmtTime(pub.publishedAt) : 'ninguno — el sitio usa el diseño base') })),
    h('button', { class: 'mz-primary', id: 'mzExport', type: 'button', text: 'EXPORTAR PAQUETE DE PUBLICACIÓN (.zip)', onclick: exportPackage }),
    report ? h('ul', { id: 'mzReport' }, ...report.map(r => h('li', { class: 'mz-' + r[0], text: (r[0] === 'ok' ? '✓ ' : r[0] === 'warn' ? '⚠ ' : '✗ ') + r[1] }))) : null);
}
async function exportPackage() {
  const rep = [], files = [], man = {}, assets = {}; let blocked = false; const S = E.capture();
  const bad = t => { rep.push(['bad', t]); blocked = true; }, warn = t => rep.push(['warn', t]);
  const pubMan = await manifest(), seen = new Set();
  const needAsset = async (id, where) => {
    if (seen.has(id)) return; seen.add(id); const b = await E.getBlob(id).catch(() => null);
    if (!b) { if (typeof pubMan[id] === 'string') { man[id] = pubMan[id]; warn(where + ': ' + id + ' no está en este navegador; se conserva la imagen ya publicada (' + pubMan[id] + ').'); return; } if (/^landing-image-/.test(id)) { warn(where + ': imagen heredada del diseño V30 (' + id + ') sin archivo; el sitio ya la oculta, no se publica.'); return; } bad(where + ': falta la imagen ' + id + ' (no está en este navegador ni publicada).'); return; }
    if (!EXT[b.type]) { bad(where + ': tipo de archivo no permitido (' + b.type + ').'); return; }
    const name = id + '.' + EXT[b.type], data = new Uint8Array(await b.arrayBuffer()); files.push({ name: 'assets/landing/' + name, data }); man[id] = name; assets[id] = { file: 'assets/landing/' + name, bytes: data.length, type: b.type, sha256: await sha256(b) };
    if (data.length > OPT_BYTES) warn(where + ': ' + name + ' pesa ' + fmtMB(data.length) + ' (conviene < ' + fmtMB(OPT_BYTES) + ').');
  };
  const fixPath = async (p, where) => {
    if (!p) return p; if (/^(blob:|data:)/.test(p)) { bad(where + ': referencia temporal no publicable (' + p.slice(0, 20) + '…).'); return p; }
    if (/^scene-picker\//.test(p)) { const target = 'assets/scenes/' + p.split('/').pop(); if (!files.some(f => f.name === target)) { const r = await fetch(p).catch(() => null); if (!r || !r.ok) { bad(where + ': no se encuentra ' + p); return p; } files.push({ name: target, data: new Uint8Array(await r.arrayBuffer()) }); } return target; }
    const r = await fetch(p, { method: 'HEAD' }).catch(() => null); if (!r || !r.ok) bad(where + ': el archivo ' + p + ' no existe en el proyecto.'); return p;
  };
  const live = id => !!doc.querySelector('[data-le-id="' + CSS.escape(id) + '"]');   // only elements that exist on the page are checked (orphaned saved entries are ignored)
  for (const bp of DEVS) for (const [id, st] of Object.entries(S.responsive[bp] || {})) { if (!st || !st.added || st.deleted || st.kind !== 'image') continue; const w = 'Imagen añadida (' + (st.section || '?') + ')'; if (st.assetId) await needAsset(st.assetId, w); else if (st.src) st.src = await fixPath(st.src, w); }
  for (const bp of DEVS) for (const [id, st] of Object.entries(S.responsive[bp] || {})) { if (st && !st.added && st.src && !/^assets\//.test(st.src) && !st.assetId && live(id)) st.src = await fixPath(st.src, 'Imagen reemplazada ' + id); }
  for (const [k, e] of Object.entries(S.sceneBg || {})) { if (!e.src) continue; const w = 'Fondo de ' + SEC[k].label; if (e.src.type === 'asset') await needAsset(e.src.id, w); else e.src.path = await fixPath(e.src.path, w); (e.prev || []).forEach(p => { if (p && p.src && p.src.type === 'path' && /^scene-picker\//.test(p.src.path)) p.src.path = 'assets/scenes/' + p.src.path.split('/').pop(); }); }
  if (blocked) { rep.unshift(['bad', 'NO se creó el paquete: corrige lo marcado y vuelve a exportar.']); renderPub(rep); return; }
  const design = { version: 1, publishedAt: new Date().toISOString(), state: S, assets }; const js = '/* MARUATAZO XII — diseño publicado (generado por EDITAR WEB; no editar a mano) */\nwindow.MARUATAZO_PUBLISHED_DESIGN=' + JSON.stringify(design) + ';\n';
  files.push({ name: 'site-design.js', data: utf8(js) }, { name: 'maruatazo-design.json', data: utf8(JSON.stringify(S, null, 2) + '\n') }, { name: 'assets/landing/manifest.json', data: utf8(JSON.stringify(man, null, 2) + '\n') },
    { name: 'README-PUBLICAR.txt', data: utf8('PAQUETE DE PUBLICACIÓN — MARUATAZO XII\nGenerado: ' + design.publishedAt + '\n\n1. Descomprime este .zip DENTRO de la carpeta del proyecto (junto a index.html), aceptando reemplazar site-design.js y assets/landing/manifest.json.\n2. Se añaden las imágenes nuevas en assets/landing/ (y assets/scenes/ si usaste escenas de la biblioteca local).\n3. Abre el sitio en local y revisa. 4. Sube la carpeta del proyecto a tu hosting.\n\nHasta el paso 4, estos cambios NO son públicos. Los cambios guardados en el navegador son locales.\nNo contiene imágenes en base64: solo archivos con rutas relativas (ver assets/landing/manifest.json).\n') });
  const zip = makeZip(files), v = await verifyZip(zip, files), total = files.reduce((a, f) => a + f.data.length, 0);
  rep.push(v.ok ? ['ok', 'Paquete verificado: ' + v.count + ' archivos, ' + fmtMB(total) + ', CRC correctos.'] : ['bad', 'El paquete no pasó la verificación: ' + (v.bad || []).join(', ')]);
  Object.keys(man).forEach(id => rep.push(['ok', 'Imagen ' + man[id] + ' incluida' + (assets[id] ? ' (' + fmtMB(assets[id].bytes) + ')' : ' (ya publicada)')])); if (!Object.keys(man).length) rep.push(['ok', 'Sin imágenes nuevas: el paquete solo lleva la configuración.']);
  if (!v.ok) { renderPub(rep); return; }
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, ''), name = 'maruatazo-publicacion-' + stamp + '.zip', a = h('a', { href: URL.createObjectURL(zip), download: name }); doc.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  try { localStorage.setItem(EXP_KEY, JSON.stringify({ at: design.publishedAt, name, dirtySince: false, files: files.length })); } catch { /* ignore */ }
  window.__mzLastPackage = { blob: zip, files: files.map(f => f.name), name }; rep.push(['warn', 'Descargado ' + name + '. Aún NO es público: cópialo al proyecto y despliega.']); renderPub(rep);
}

/* ---------------------------------------------------------------- init ---------------------------------------------------------------- */
const refresh = () => { fillTargets(); renderGrids(); renderBg(); renderPub(); };
$('#launcher, #landingEditLauncher') && $('#landingEditLauncher').addEventListener('click', () => setTimeout(refresh, 150));
tabImg.addEventListener('click', refresh); tabBg.addEventListener('click', () => { renderBg(); });
E.onDirty(() => { if (paneImg.classList.contains('active')) { const r = $('#mzReport'); if (!r) renderPub(); } });
fillTargets(); renderGrids(); renderBg(); renderPub();
window.__mzLibrary = { ingest, LIB: () => LIB, sceneBg: () => sceneBg, exportPackage };
})();
