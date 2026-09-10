const cards=[...document.querySelectorAll('[data-choice]')], out=document.querySelector('#selection');
cards.forEach(b=>b.addEventListener('click',()=>{cards.forEach(x=>x.classList.remove('selected'));b.classList.add('selected');if(out)out.innerHTML=`<strong>${b.dataset.choice.toUpperCase()} SELECCIONADO</strong> — Aquí abriremos disponibilidad, cantidad y reserva. <span style="float:right">CONTINUAR →</span>`}));
document.querySelectorAll('.tabs button').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));t.classList.add('active')}));

// Landing only. The 3D cabins world now lives on mapa.html, isolated from this page/editor.
const goTickets=()=>document.querySelector('#boletos')?.scrollIntoView({behavior:'smooth',block:'start'});
document.querySelector('#enterTickets')?.addEventListener('click',goTickets);
document.querySelector('#topTickets')?.addEventListener('click',goTickets);

const navToggle=document.querySelector('#navToggle'), siteNav=document.querySelector('#siteNav');
const closeNav=()=>{siteNav?.classList.remove('is-open');navToggle?.setAttribute('aria-expanded','false')};
navToggle?.addEventListener('click',()=>{const open=!siteNav?.classList.contains('is-open');siteNav?.classList.toggle('is-open',open);navToggle.setAttribute('aria-expanded',String(open))});
siteNav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeNav));
window.addEventListener('resize',()=>{if(innerWidth>760)closeNav()});

// Printed INFO index: reveal its native guide accordion before navigating.
document.querySelectorAll('.guide-index a[href^="#info-"]').forEach(link=>link.addEventListener('click',()=>{
  const guide=document.querySelector(link.getAttribute('href'));
  if(guide?.matches('details')) guide.open=true;
}));

// Phone layout treats INFO as a readable field guide, never a collapsed accordion.
const mobileInfo=matchMedia('(max-width: 760px)');
const keepMobileInfoOpen=()=>{if(!mobileInfo.matches)return;document.querySelectorAll('#info details').forEach(detail=>{detail.open=true;detail.ontoggle=()=>{if(mobileInfo.matches&&!detail.open)detail.open=true}})};
keepMobileInfoOpen();mobileInfo.addEventListener?.('change',keepMobileInfoOpen);
