const cards=[...document.querySelectorAll('[data-choice]')], out=document.querySelector('#selection');
// Accommodation guidance. Prices come from cabins-config.js (single source); selecting a category is only an inquiry, never a reservation.
const CFG=window.MARUATAZO_CABINS, mxn=n=>'$'+n.toLocaleString('es-MX'), acc=k=>CFG?.accommodations?.find(a=>a.key===k);
const catLink=(k,label)=>{const a=acc(k);return a?`<a class="sel-link" href="mapa2d.html?tipo=${k}"><b>${label}</b> · ${mxn(a.pricePerPerson)} por persona →</a>`:''};
const GUIDE={
  'Cabaña':()=>`<strong>CABAÑA — ELIGE UNA CATEGORÍA</strong><span class="sel-links">${catLink('shared','Baño compartido')}${catLink('cabin-6','Cabaña de 6 personas')}${catLink('cabin-4-5','Cabaña de 4 o 5 personas')}</span><span class="sel-note">Precio por persona: 3 noches y acceso al evento los 3 días. ${CFG?.recommendation||''} Elegir una categoría abre su detalle, desde donde puedes consultar por WhatsApp: no aparta ninguna cabaña. Disponibilidad por confirmar.</span>`,
  'Camping':()=>`<strong>CAMPING</strong><span class="sel-links">${catLink('camping','Ver camping y consultar')}</span><span class="sel-note">Precio por persona: 3 noches y acceso al evento los 3 días. Elegirlo abre su detalle, desde donde puedes consultar por WhatsApp: no aparta ningún espacio. Disponibilidad por confirmar.</span>`,
  'Solo evento':()=>`<strong>SOLO EVENTO</strong><span class="sel-links"><a class="sel-link" target="_blank" rel="noopener noreferrer" href="https://wa.me/${CFG?.whatsapp||''}?text=${encodeURIComponent('Hola, quiero información sobre el acceso solo al evento de Maruatazo XII. ¿Me pueden confirmar precio, modalidades y fechas?')}"><b>Consultar por WhatsApp</b> →</a></span><span class="sel-note">Precio por confirmar.</span>`
};
cards.forEach(b=>b.addEventListener('click',()=>{cards.forEach(x=>x.classList.remove('selected'));b.classList.add('selected');const g=GUIDE[b.dataset.choice];if(out&&g)out.innerHTML=g()}));
document.querySelectorAll('.tabs button').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));t.classList.add('active')}));

// Landing only. The 3D cabins world now lives on mapa.html, isolated from this page/editor.
const goTickets=()=>document.querySelector('#boletos')?.scrollIntoView({behavior:'smooth',block:'start'});
document.querySelector('#topTickets')?.addEventListener('click',goTickets);

const navToggle=document.querySelector('#navToggle'), siteNav=document.querySelector('#siteNav');
const closeNav=()=>{siteNav?.classList.remove('is-open');navToggle?.setAttribute('aria-expanded','false')};
navToggle?.addEventListener('click',()=>{const open=!siteNav?.classList.contains('is-open');siteNav?.classList.toggle('is-open',open);navToggle.setAttribute('aria-expanded',String(open))});
siteNav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeNav));
window.addEventListener('resize',()=>{if(innerWidth>767)closeNav()});

// Printed INFO index: reveal its native guide accordion before navigating.
document.querySelectorAll('.guide-index a[href^="#info-"]').forEach(link=>link.addEventListener('click',()=>{
  const guide=document.querySelector(link.getAttribute('href'));
  if(guide?.matches('details')) guide.open=true;
}));

// V30 phone layout (legacy INFO block only) keeps its guide open; the new public INFO (.info-cinema) uses real, collapsible accordions.
const mobileInfo=matchMedia('(max-width: 760px)');
const keepMobileInfoOpen=()=>{if(!mobileInfo.matches)return;document.querySelectorAll('#info .info-layout details').forEach(detail=>{detail.open=true;detail.ontoggle=()=>{if(mobileInfo.matches&&!detail.open)detail.open=true}})};
keepMobileInfoOpen();mobileInfo.addEventListener?.('change',keepMobileInfoOpen);

// Public cabin flow is 2D only. Re-point the CTA even if a visitor's saved editor state still holds the old 3D text.
window.addEventListener('load',()=>{const cta=document.querySelector('#enterCabins');if(!cta)return;cta.setAttribute('href','mapa2d.html');if(/3D/i.test(cta.textContent))cta.innerHTML='EXPLORAR CABAÑAS <span>→</span>'});

// Official 2026 accommodation prices: refresh stale placeholder text that a visitor's saved editor state may still hold.
window.addEventListener('load',()=>{
  const price=CFG?{'Cabaña':`DESDE ${mxn(acc('shared').pricePerPerson)} · POR PERSONA`,'Camping':`${mxn(acc('camping').pricePerPerson)} · POR PERSONA`}:{};
  document.querySelectorAll('#boletos [data-choice]').forEach(b=>{const s=b.querySelector('small'),p=price[b.dataset.choice];if(s&&p&&/CONFIRMAR/i.test(s.textContent))s.textContent=p});
  const intro=document.querySelector('[data-le-id="tickets-intro"]');
  if(intro&&/Modalidades, precios/.test(intro.textContent))intro.textContent='PRECIO POR PERSONA · 3 noches y acceso al evento los 3 días. Evento: '+(CFG?.event?.dates||'fechas por confirmar')+'. Recomendamos armar tu grupito para compartir cabaña.';
});

// Confirmed event dates (cabins-config.js > event): refresh stale text that a saved editor state may still hold. No times or schedules are implied.
window.addEventListener('load',()=>{
  const ev=CFG?.event;if(!ev)return;
  document.querySelectorAll('[data-le-id="hero-date"],.closing-inner span').forEach(el=>{if(/NOVIEMBRE 2026/.test(el.textContent)&&!/13–16/.test(el.textContent))el.textContent='MARUATA · MICHOACÁN · '+ev.datesShort});
  const intro=document.querySelector('[data-le-id="tickets-intro"]');if(intro&&/Fechas por confirmar/.test(intro.textContent))intro.textContent=intro.textContent.replace('Fechas por confirmar.','Evento: '+ev.dates+'.');
  document.querySelectorAll('#info-llegadas .guide-stamp').forEach(el=>{if(/18 DE NOVIEMBRE|MEDIOD/i.test(el.textContent))el.textContent='EVENTO · VIERNES 13 AL LUNES 16 DE NOVIEMBRE'});
  const lu=document.querySelector('[data-le-id="lineup-intro"]');if(lu&&/ret[ií]cula/i.test(lu.textContent))lu.textContent='Cartel y horarios por confirmar.';
  document.querySelectorAll('#info-llegadas p').forEach(el=>{if(/fuera de este horario/.test(el.textContent))el.textContent='El horario de llegada está por confirmar. Cualquier llegada fuera del horario que indique la organización deberá ser notificada con anticipación para que haya una persona para recibirlos y llevarlos hasta su hospedaje.'});
});
