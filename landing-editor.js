(()=>{
const KEY='maruatazo-v29-landing-studio', LEGACY_KEY='maruatazo-v28-landing-studio', ASSET_DB='maruatazo-v18-landing-assets', PANEL_KEY='maruatazo-v24-editor-panel-pos';
const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let editing=false, selected=null, dragging=false, dragStart=null, history=[], historyIndex=-1, currentSection=q('#home');
let activeBreakpoint=innerWidth<=767?'mobile':innerWidth<=1024?'tablet':'desktop', applyTo='breakpoint', responsive={desktop:{},tablet:{},mobile:{}}, sectionBackgrounds={desktop:{},tablet:{},mobile:{}};

// One real canvas contains the full page, including its header and mobile dock.
const canvas=document.createElement('div');canvas.id='leCanvas';
const firstPageNode=q('.top');if(firstPageNode){firstPageNode.before(canvas);[q('.top'),q('main'),q('.bottom')].filter(Boolean).forEach(n=>canvas.appendChild(n))}

// ----- UI -----
const launcher=document.createElement('button'); launcher.id='landingEditLauncher'; launcher.textContent='EDITAR WEB ✦'; document.body.appendChild(launcher);
const panel=document.createElement('aside'); panel.id='landingStudio'; panel.innerHTML=`
  <div class="le-head"><div><small>MARUATAZO STUDIO · LANDING</small><b>EDITOR WEB</b></div><div><button id="leUndo">↶</button><button id="leRedo">↷</button><button id="leClose">×</button></div></div>
  <div class="le-tabs"><button class="active" data-le-tab="layers">CAPAS</button><button data-le-tab="add">AÑADIR</button><button data-le-tab="style">ESTILO</button><button data-le-tab="fx">FX</button><button data-le-tab="page">PÁGINA</button></div>
  <div class="le-pane active" data-le-pane="layers">
    <div class="le-toolbar le-breakpoints"><button id="leDesktop">DESKTOP</button><button id="leTablet">TABLET</button><button id="leMobile">MOBILE</button><button id="lePreview">PREVIEW</button></div>
    <label class="le-field">APLICAR A<select id="leApplyTo"><option value="breakpoint">ESTE TAMAÑO</option><option value="all">TODOS</option></select></label>
    <label class="le-field">SECCIÓN<select id="leSection"></select></label>
    <div class="le-sub">OUTLINER</div><div id="leOutliner" class="le-outliner"></div>
    <label class="le-field">NOMBRE<input id="leLayerName" type="text" placeholder="Nombre de capa"></label>
    <div class="le-toolbar"><button id="leDuplicate">DUPLICAR</button><button id="leHide">OCULTAR</button><button id="leLock">BLOQUEAR</button><button id="leDelete">BORRAR</button></div>
    <div class="le-toolbar"><button id="leBack">AL FONDO</button><button id="leBackward">ATRÁS</button><button id="leForward">ADELANTE</button><button id="leFront">AL FRENTE</button></div>
  </div>
  <div class="le-pane" data-le-pane="add">
    <p>Añade elementos a la sección seleccionada. Después muévelos libremente.</p>
    <div class="le-addgrid"><button data-le-add="text">＋ TEXTO</button><button data-le-add="button">＋ BOTÓN</button><button data-le-add="shape">＋ FORMA</button><button data-le-add="line">＋ LÍNEA</button><button data-le-add="image">＋ IMAGEN</button><button data-le-add="glb">＋ GLB 3D</button></div>
    <input id="leImageFile" type="file" accept="image/*" hidden><input id="leGLBFile" type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" hidden>
    <div class="le-sub">OBJETOS ATMÓSFERA</div><div class="le-addgrid"><button data-le-add="star">＋ ESTRELLA</button><button data-le-add="glow">＋ GLOW</button><button data-le-add="orb">＋ ORB</button><button data-le-add="label">＋ ETIQUETA</button></div>
  </div>
  <div class="le-pane" data-le-pane="style">
    <div class="le-selected">SELECCIÓN <strong id="leSelected">NINGUNA</strong></div>
    <label class="le-field">TEXTO / HTML<textarea id="leText" rows="3"></textarea></label>
    <div class="le-sub">TRANSFORM</div>
    <div class="le-numgrid"><label>X<input id="leX" type="number" step="1"></label><label>Y<input id="leY" type="number" step="1"></label><label>ROT<input id="leRot" type="number" step="1"></label><label>ESCALA<input id="leScale" type="number" step=".05" min=".05"></label></div>
    <div class="le-numgrid"><label>ANCHO<input id="leW" type="number" step="1"></label><label>ALTO<input id="leH" type="number" step="1"></label><label>Z-INDEX<input id="leZ" type="number" step="1"></label><label>RADIO<input id="leRadius" type="number" step="1"></label></div>
    <div class="le-sub">TIPOGRAFÍA</div>
    <label class="le-field">FONT<select id="leFont"><option value="inherit">HEREDADA</option><option value="Arial,Helvetica,sans-serif">SANS</option><option value="Georgia,serif">EDITORIAL SERIF</option><option value="'Times New Roman',serif">TIMES</option><option value="Impact,Haettenschweiler,sans-serif">DISPLAY</option><option value="monospace">MONO</option></select></label>
    <div class="le-numgrid"><label>TAMAÑO<input id="leFontSize" type="number" min="6"></label><label>PESO<input id="leWeight" type="number" step="100" min="100" max="900"></label><label>TRACK<input id="leLetter" type="number" step=".1"></label><label>INTERLÍNEA<input id="leLineHeight" type="number" step=".05" min=".5"></label></div>
    <div class="le-numgrid"><label>OPACIDAD<input id="leOpacity" type="number" step=".05" min="0" max="1"></label><label>BORDE PX<input id="leBorderWidth" type="number" step="1" min="0"></label><label>PAD TOP<input id="lePaddingTop" type="number" step="1"></label><label>PAD BOTTOM<input id="lePaddingBottom" type="number" step="1"></label></div>
    <div class="le-colors"><label>TEXTO<input id="leColor" type="color"></label><label>FONDO<input id="leBg" type="color"></label><label>BORDE<input id="leBorder" type="color"></label></div>
    <label class="le-field">ALINEACIÓN<select id="leAlign"><option>left</option><option>center</option><option>right</option></select></label>
    <label class="le-field">MAYÚSCULAS<select id="leTransformText"><option value="none">ORIGINAL</option><option value="uppercase">MAYÚSCULAS</option><option value="lowercase">MINÚSCULAS</option></select></label>
    <label class="le-field">BORDE<select id="leBorderStyle"><option>solid</option><option>dashed</option><option>dotted</option><option>double</option><option value="none">ninguno</option></select></label>
    <label class="le-field le-check"><input id="leTransparentBg" type="checkbox"> FONDO TRANSPARENTE</label>
    <div class="le-sub">ALINEAR EN SECCIÓN</div><div class="le-toolbar"><button data-le-alignbox="left">IZQ</button><button data-le-alignbox="center">CENTRO</button><button data-le-alignbox="right">DER</button><button data-le-alignbox="middle">MEDIO</button></div>
    <div class="le-sub">SOMBRA</div><div class="le-numgrid"><label>X<input id="leShadowX" type="number" step="1"></label><label>Y<input id="leShadowY" type="number" step="1"></label><label>BLUR<input id="leShadowBlur" type="number" step="1" min="0"></label><label>SPREAD<input id="leShadowSpread" type="number" step="1"></label></div>
    <div class="le-colors"><label>COLOR SOMBRA<input id="leShadowColor" type="color"></label></div>
    <div id="leImageTools"><div class="le-sub">IMAGEN</div><label class="le-field">AJUSTE<select id="leObjectFit"><option>cover</option><option>contain</option><option>fill</option><option>none</option></select></label><label class="le-field">POSICIÓN<input id="leObjectPosition" type="text" value="50% 50%"></label><button id="leReplaceImage" class="le-wide" type="button">REEMPLAZAR IMAGEN</button><button id="leUseAsSectionBg" class="le-wide" type="button">USAR COMO FONDO DE SECCIÓN</button><input id="leReplaceImageFile" type="file" accept="image/*" hidden></div>
    <div id="leSectionBackground"><div class="le-sub">FONDO DE SECCIÓN</div><div id="leSectionBgPreview" class="le-bg-preview">SIN FONDO</div><label class="le-field">AJUSTE<select id="leSectionBgFit"><option value="cover">COVER</option><option value="contain">CONTAIN</option><option value="auto">AUTO</option></select></label><label class="le-range">POS X <input id="leSectionBgX" type="range" min="0" max="100" step="1" value="50"><output></output></label><label class="le-range">POS Y <input id="leSectionBgY" type="range" min="0" max="100" step="1" value="50"><output></output></label><label class="le-field">REPETIR<select id="leSectionBgRepeat"><option value="no-repeat">NO REPETIR</option><option value="repeat">REPETIR</option></select></label><div class="le-colors"><label>OVERLAY<input id="leSectionBgOverlay" type="color" value="#171714"></label></div><label class="le-range">OPACIDAD OVERLAY <input id="leSectionBgOverlayOpacity" type="range" min="0" max="1" step=".05" value="0"><output></output></label><div class="le-toolbar"><button id="leReplaceSectionBg" type="button">REEMPLAZAR FONDO</button><button id="leRemoveSectionBg" type="button">QUITAR FONDO</button></div><input id="leSectionBgFile" type="file" accept="image/*" hidden></div>
    <div class="le-sub">SECCIÓN</div><div class="le-numgrid"><label>ALTURA MÍN<input id="leMinHeight" type="number" step="1"></label></div>
  </div>
  <div class="le-pane" data-le-pane="fx">
    <div class="le-sub">EFECTOS DEL OBJETO</div>
    <label class="le-range">BLUR <input id="leBlur" type="range" min="0" max="30" step=".5" value="0"><output></output></label>
    <label class="le-range">BRILLO <input id="leBright" type="range" min=".1" max="3" step=".05" value="1"><output></output></label>
    <label class="le-range">SATURACIÓN <input id="leSat" type="range" min="0" max="3" step=".05" value="1"><output></output></label>
    <label class="le-range">HUE <input id="leHue" type="range" min="-180" max="180" step="1" value="0"><output></output></label>
    <label class="le-field">BLEND<select id="leBlend"><option>normal</option><option>screen</option><option>lighten</option><option>overlay</option><option>soft-light</option><option>multiply</option><option>difference</option></select></label>
    <label class="le-field">ANIMACIÓN<select id="leAnim"><option value="none">NINGUNA</option><option value="float">FLOTAR</option><option value="pulse">PULSAR</option><option value="spin">GIRAR</option><option value="fade">FADE</option><option value="drift">DERIVA</option></select></label>
    <div class="le-numgrid"><label>VELOCIDAD<input id="leAnimSpeed" type="number" step=".1" min=".1" value="1"></label><label>AMPLITUD<input id="leAnimAmp" type="number" step="1" value="12"></label><label>DELAY<input id="leDelay" type="number" step=".1" value="0"></label><label>DURACIÓN<input id="leDuration" type="number" step=".1" value="1.2"></label></div>
    <div class="le-sub">ENTRADA</div><label class="le-field">REVEAL<select id="leReveal"><option value="none">NINGUNO</option><option value="fade-up">FADE UP</option><option value="fade-in">FADE IN</option><option value="zoom-in">ZOOM IN</option><option value="blur-in">BLUR IN</option></select></label>
  </div>
  <div class="le-pane" data-le-pane="page">
    <div class="le-sub">PALETA GLOBAL</div>
    <div class="le-colors"><label>PAPEL<input id="lePaper" type="color" value="#f1ebdd"></label><label>PACÍFICO<input id="leSky" type="color" value="#258baa"></label><label>PROFUNDO<input id="leWater" type="color" value="#12647a"></label></div>
    <input id="leHorizon" type="color" value="#77bed0" hidden>
    <div class="le-sub">FONDO LANDING</div>
    <div class="le-colors"><label>COSTA<input id="leVegetation" type="color" value="#0e5d38"></label><label>BOTÓN BASE<input id="leButtonBase" type="color" value="#f4ead0"></label></div>
    <label class="le-field le-check"><input id="leVegetationVisible" type="checkbox" checked> MOSTRAR CAPA DE COSTA</label>
    <small class="le-note">Cada capa de fondo puede seleccionarse, ocultarse o borrarse desde CAPAS. Para cambiar un botón concreto (LINE UP, MENÚ, etc.), selecciónalo y usa ESTILO → FONDO.</small>
    <label class="le-range">ESTRELLAS <input id="leStars" type="range" min="0" max="2" step=".05" value="1"><output></output></label>
    <label class="le-range">GRAIN <input id="lePageGrain" type="range" min="0" max="1" step=".02" value=".18"><output></output></label>
    <label class="le-range">VIGNETTE <input id="lePageVignette" type="range" min="0" max="1" step=".02" value=".24"><output></output></label>
    <label class="le-range">GLOW <input id="lePageGlow" type="range" min="0" max="2" step=".05" value=".7"><output></output></label>
    <div class="le-sub">PROYECTO</div>
    <div class="le-toolbar"><button id="leSave">GUARDAR ⌘S</button><button id="leExport">EXPORTAR JSON</button><button id="leImport">IMPORTAR JSON</button><button id="leReset">RESET</button></div><input id="leProjectFile" type="file" accept="application/json,.json" hidden>
    <small class="le-note">Doble click sobre texto = editar directamente. Arrastra cualquier elemento seleccionado. Shift = movimiento fino. ⌘S/Ctrl+S = guardar. Los cambios también se autoguardan.</small>
  </div>`;
document.body.appendChild(panel);
const resizeHandle=document.createElement('button');resizeHandle.id='leResizeHandle';resizeHandle.type='button';resizeHandle.title='Arrastra para redimensionar';resizeHandle.setAttribute('aria-label','Redimensionar elemento');document.body.appendChild(resizeHandle);

// ----- movable editor window -----
const panelHead=panel.querySelector('.le-head');
let panelDrag=null;
function restorePanelPosition(){try{const p=JSON.parse(localStorage.getItem(PANEL_KEY)||'null');if(!p)return;panel.style.left=p.left+'px';panel.style.top=p.top+'px';panel.style.right='auto';panel.style.bottom='auto';if(p.width)panel.style.width=p.width+'px';if(p.height)panel.style.height=p.height+'px';}catch(e){}}
function savePanelPosition(){const r=panel.getBoundingClientRect();localStorage.setItem(PANEL_KEY,JSON.stringify({left:r.left,top:r.top,width:r.width,height:r.height}));}
panelHead.title='Arrastra esta barra para mover el editor';
panelHead.addEventListener('pointerdown',e=>{if(e.target.closest('button,input,select,textarea'))return;const r=panel.getBoundingClientRect();panelDrag={dx:e.clientX-r.left,dy:e.clientY-r.top,id:e.pointerId};panel.style.left=r.left+'px';panel.style.top=r.top+'px';panel.style.right='auto';panel.style.bottom='auto';panelHead.setPointerCapture?.(e.pointerId);e.preventDefault();});
panelHead.addEventListener('pointermove',e=>{if(!panelDrag)return;const maxX=Math.max(0,innerWidth-panel.offsetWidth),maxY=Math.max(0,innerHeight-70);panel.style.left=clamp(e.clientX-panelDrag.dx,0,maxX)+'px';panel.style.top=clamp(e.clientY-panelDrag.dy,0,maxY)+'px';});
panelHead.addEventListener('pointerup',e=>{if(!panelDrag)return;panelDrag=null;panelHead.releasePointerCapture?.(e.pointerId);savePanelPosition();});
panel.addEventListener('mouseup',()=>setTimeout(savePanelPosition,0));
restorePanelPosition();

// ----- editable discovery -----
const sections=qa('main > section:not(.portal)');
sections.forEach((s,i)=>{s.dataset.leSection=s.id||`section-${i}`; if(!s.style.position)s.style.position='relative';});
const sectionSelect=q('#leSection'); sections.forEach(s=>{const o=document.createElement('option');o.value=s.dataset.leSection;o.textContent=(s.id||'SECCIÓN').toUpperCase();sectionSelect.appendChild(o)});
function isEditorUI(el){return el.closest('#landingStudio,#landingEditLauncher,#leResizeHandle,.bottom')}
function stableDomId(el){
  if(el.id) return 'id-'+el.id;
  const parts=[]; let n=el;
  while(n && n!==document.body){
    const parent=n.parentElement; if(!parent) break;
    const siblings=[...parent.children].filter(x=>x.tagName===n.tagName);
    const idx=siblings.indexOf(n);
    parts.unshift(n.tagName.toLowerCase()+':'+idx);
    if(parent.id){parts.unshift('id-'+parent.id);break}
    n=parent;
  }
  return 'dom-'+parts.join('/');
}
function tagEditables(){
  const selectors=['.editor-item','.top','.brand','#topTickets','#enterCabins','.hero-composition','.hero-copy','.hero-copy small','.hero-copy h1','.hero-copy p','.orbit-nav a','.orbit-nav b','.orbit-nav b span','.hero-paper','.hero-print-texture','.hero-sun','.hero-registration','.hero-caption','.hero-scroll','.section','.section-inner','.section > .kicker','.section h2','.section h3','.section p','.section a','.section button','.section img','.section figure','.section figcaption','.section article','.section details','.section summary','.section strong','.section small','.guide-list li','.menu-guide li','.cards > button','.info-grid details','.print-photo','.print-photo img','.artist-list','.menu-list','.merch-grid','.gallery-grid','.gallery-grid img','.closing','.closing-inner','.closing-inner p','.closing-inner h2','.closing-inner span','.closing-inner small','.closing-texture'];
  qa(selectors.join(',')).forEach(el=>{if(isEditorUI(el))return; if(!el.dataset.leId)el.dataset.leId=stableDomId(el); el.classList.add('le-editable');
    if(!el.dataset.leKind){
      if(el.matches('.hero-paper'))el.dataset.leKind='fondo papel';
      else if(el.matches('.hero-photo'))el.dataset.leKind='foto principal';
      else if(el.matches('.hero-ink'))el.dataset.leKind='tinta de foto';
      else if(el.matches('.hero-print-texture'))el.dataset.leKind='textura impresa';
      else if(el.matches('.hero-coast'))el.dataset.leKind='costa';
      else if(el.matches('.hero-ocean'))el.dataset.leKind='océano';
      else if(el.matches('.hero-sun'))el.dataset.leKind='sol';
      else if(el.matches('.hero-registration'))el.dataset.leKind='marcas de impresión';
      else if(el.matches('.orbit-nav a'))el.dataset.leKind='botón landing';
    }
  });
  qa('.le-added').forEach(el=>el.classList.add('le-editable'));
}
tagEditables();

function rootSection(el){return el?.closest('[data-le-section]')||q('#home')}
function isTextTarget(el){return !!el&&el.tagName!=='IMG'&&!el.classList.contains('le-glb')&&(el.children.length===0||el.matches('h1,h2,h3,p,small,strong,b,em,figcaption,summary'))}
function stateOf(el){return {id:el.dataset.leId,html:isTextTarget(el)?el.innerHTML:null,classes:el.className,name:el.dataset.leName||'',x:+(el.dataset.leX||0),y:+(el.dataset.leY||0),rot:+(el.dataset.leRot||0),scale:+(el.dataset.leScale||1),w:el.style.width||'',h:el.style.height||'',z:el.style.zIndex||'',radius:el.style.borderRadius||'',font:el.style.fontFamily||'',fontSize:el.style.fontSize||'',weight:el.style.fontWeight||'',letter:el.style.letterSpacing||'',lineHeight:el.style.lineHeight||'',textTransform:el.style.textTransform||'',opacity:el.style.opacity||'',color:el.style.color||'',bg:el.style.backgroundColor||'',transparentBg:el.dataset.leTransparentBg==='1',border:el.style.borderColor||'',borderWidth:el.style.borderWidth||'',borderStyle:el.style.borderStyle||'',align:el.style.textAlign||'',paddingTop:el.style.paddingTop||'',paddingBottom:el.style.paddingBottom||'',minHeight:el.style.minHeight||'',shadowX:+(el.dataset.leShadowX||0),shadowY:+(el.dataset.leShadowY||0),shadowBlur:+(el.dataset.leShadowBlur||0),shadowSpread:+(el.dataset.leShadowSpread||0),shadowColor:el.dataset.leShadowColor||'#171714',objectFit:el.style.objectFit||'',objectPosition:el.style.objectPosition||'',blur:+(el.dataset.leBlur||0),bright:+(el.dataset.leBright||1),sat:+(el.dataset.leSat||1),hue:+(el.dataset.leHue||0),blend:el.style.mixBlendMode||'',anim:el.dataset.leAnim||'none',animSpeed:+(el.dataset.leAnimSpeed||1),animAmp:+(el.dataset.leAnimAmp||12),delay:+(el.dataset.leDelay||0),duration:+(el.dataset.leDuration||1.2),reveal:el.dataset.leReveal||'none',hidden:el.dataset.leHidden==='1',deleted:el.dataset.leDeleted==='1',locked:el.dataset.leLocked==='1',added:el.classList.contains('le-added'),tag:el.tagName,section:rootSection(el)?.dataset.leSection,kind:el.dataset.leKind||'',src:el.tagName==='IMG'&&!el.dataset.assetId?el.getAttribute('src')||'':'',assetId:el.dataset.assetId||''};}
function applyTransform(el){el.style.setProperty('--le-x',(+(el.dataset.leX||0))+'px');el.style.setProperty('--le-y',(+(el.dataset.leY||0))+'px');el.style.setProperty('--le-r',(+(el.dataset.leRot||0))+'deg');el.style.setProperty('--le-s',+(el.dataset.leScale||1));el.style.translate=`var(--le-x,0px) var(--le-y,0px)`;el.style.rotate='var(--le-r,0deg)';el.style.scale='var(--le-s,1)';}
function applyFx(el){const b=+(el.dataset.leBlur||0),br=+(el.dataset.leBright||1),s=+(el.dataset.leSat||1),h=+(el.dataset.leHue||0);el.style.filter=`blur(${b}px) brightness(${br}) saturate(${s}) hue-rotate(${h}deg)`;el.dataset.leAnim=el.dataset.leAnim||'none';el.style.setProperty('--le-speed',(+(el.dataset.leAnimSpeed||1))+'s');el.style.setProperty('--le-amp',(+(el.dataset.leAnimAmp||12))+'px');el.style.setProperty('--le-delay',(+(el.dataset.leDelay||0))+'s');el.style.setProperty('--le-duration',(+(el.dataset.leDuration||1.2))+'s');}
function applyState(el,s){
  if(s.html!=null && el.tagName!=='IMG' && !el.classList.contains('le-glb'))el.innerHTML=s.html;
  ['x','y','rot','scale'].forEach(k=>el.dataset['le'+k[0].toUpperCase()+k.slice(1)]=s[k]??({x:0,y:0,rot:0,scale:1}[k]));
  el.dataset.leName=s.name||'';el.style.width=s.w||'';el.style.height=s.h||'';el.style.zIndex=s.z||'';el.style.borderRadius=s.radius||'';el.style.fontFamily=s.font||'';el.style.fontSize=s.fontSize||'';el.style.fontWeight=s.weight||'';el.style.letterSpacing=s.letter||'';el.style.lineHeight=s.lineHeight||'';el.style.textTransform=s.textTransform||'';el.style.opacity=s.opacity||'';
  if(s.color)el.style.setProperty('color',s.color,'important');else el.style.removeProperty('color');
  el.dataset.leTransparentBg=s.transparentBg?'1':'0';if(s.transparentBg)el.style.setProperty('background-color','transparent','important');else if(s.bg)el.style.setProperty('background-color',s.bg,'important');else el.style.removeProperty('background-color');
  if(s.border)el.style.setProperty('border-color',s.border,'important');else el.style.removeProperty('border-color');
  el.style.borderWidth=s.borderWidth||'';el.style.borderStyle=s.borderStyle||'';el.style.textAlign=s.align||'';el.style.paddingTop=s.paddingTop||'';el.style.paddingBottom=s.paddingBottom||'';el.style.minHeight=s.minHeight||'';el.dataset.leShadowX=s.shadowX??0;el.dataset.leShadowY=s.shadowY??0;el.dataset.leShadowBlur=s.shadowBlur??0;el.dataset.leShadowSpread=s.shadowSpread??0;el.dataset.leShadowColor=s.shadowColor||'#171714';el.style.boxShadow=(s.shadowX||s.shadowY||s.shadowBlur||s.shadowSpread)?`${s.shadowX||0}px ${s.shadowY||0}px ${s.shadowBlur||0}px ${s.shadowSpread||0}px ${s.shadowColor||'#171714'}`:'';el.style.objectFit=s.objectFit||'';el.style.objectPosition=s.objectPosition||'';el.style.mixBlendMode=s.blend||'';
  el.dataset.leBlur=s.blur??0;el.dataset.leBright=s.bright??1;el.dataset.leSat=s.sat??1;el.dataset.leHue=s.hue??0;el.dataset.leAnim=s.anim||'none';el.dataset.leAnimSpeed=s.animSpeed??1;el.dataset.leAnimAmp=s.animAmp??12;el.dataset.leDelay=s.delay??0;el.dataset.leDuration=s.duration??1.2;el.dataset.leReveal=s.reveal||'none';el.dataset.leHidden=s.hidden?'1':'0';el.dataset.leDeleted=s.deleted?'1':'0';el.dataset.leLocked=s.locked?'1':'0';
  el.style.display=(s.hidden||s.deleted)?'none':'';if(el.tagName==='IMG'){if(s.assetId){el.dataset.assetId=s.assetId;hydrateImage(el,s.assetId)}else if(s.src)el.setAttribute('src',s.src)}applyTransform(el);applyFx(el);
}

// ----- selection / outliner -----
function select(el){if(selected)selected.classList.remove('le-selected-el');selected=el;if(el){el.classList.add('le-selected-el');currentSection=rootSection(el);sectionSelect.value=currentSection.dataset.leSection;}syncInspector();syncSectionBackgroundInspector();rebuildOutliner();updateHandle()}
function updateHandle(){if(!editing||!selected||selected.dataset.leLocked==='1'||selected.dataset.leHidden==='1'||selected.dataset.leDeleted==='1'){resizeHandle.hidden=true;return}const r=selected.getBoundingClientRect();resizeHandle.hidden=false;resizeHandle.style.left=(r.right-8)+'px';resizeHandle.style.top=(r.bottom-8)+'px'}
let resizeStart=null;resizeHandle.onpointerdown=e=>{if(!selected||selected.dataset.leLocked==='1')return;const cs=getComputedStyle(selected),r=selected.getBoundingClientRect();resizeStart={x:e.clientX,y:e.clientY,w:parseFloat(cs.width),h:parseFloat(cs.height),ratio:r.width/r.height,id:e.pointerId};resizeHandle.setPointerCapture(e.pointerId);e.preventDefault();e.stopPropagation()};resizeHandle.onpointermove=e=>{if(!resizeStart||e.pointerId!==resizeStart.id)return;const nw=Math.max(24,resizeStart.w+e.clientX-resizeStart.x);selected.style.width=nw+'px';if(selected.tagName==='IMG'&&!e.shiftKey)selected.style.height=(nw/resizeStart.ratio)+'px';else selected.style.height=Math.max(24,resizeStart.h+e.clientY-resizeStart.y)+'px';updateHandle();syncInspector()};resizeHandle.onpointerup=e=>{if(!resizeStart)return;resizeStart=null;recordElement(selected);pushHistory();autosave()};
addEventListener('scroll',updateHandle,true);addEventListener('resize',updateHandle);
function rebuildOutliner(){const box=q('#leOutliner');box.innerHTML='';const sec=q(`[data-le-section="${CSS.escape(sectionSelect.value)}"]`)||currentSection;currentSection=sec;const items=qa('.le-editable').filter(e=>rootSection(e)===sec||e===q('.top'));items.forEach(el=>{const r=document.createElement('div');r.className='le-layer'+(el===selected?' active':'');const depth=Math.min(3,[...el.closest('[data-le-section],.top').querySelectorAll('*')].includes(el)?parentsUntil(el,el.closest('[data-le-section],.top')):0);r.style.setProperty('--depth',depth);const title=el.dataset.leName||(el.textContent||el.alt||el.dataset.leId).trim().slice(0,28)||el.dataset.leId;r.innerHTML=`<button class="le-eye" title="Mostrar/ocultar">${el.dataset.leHidden==='1'?'○':'●'}</button><button class="le-pad" title="Bloquear">${el.dataset.leLocked==='1'?'⌁':'◇'}</button><span><small>${el.dataset.leKind||el.tagName.toLowerCase()}</small><b>${title}</b></span>`;r.querySelector('.le-eye').onclick=e=>{e.stopPropagation();select(el);mut(x=>{x.dataset.leHidden=x.dataset.leHidden==='1'?'0':'1';x.style.display=x.dataset.leHidden==='1'?'none':''})};r.querySelector('.le-pad').onclick=e=>{e.stopPropagation();select(el);const was=el.dataset.leLocked==='1';el.dataset.leLocked=was?'0':'1';recordElement(el);pushHistory();rebuildOutliner();autosave()};r.onclick=()=>select(el);box.appendChild(r)})}
function parentsUntil(el,root){let n=el,d=0;while(n&&n!==root){d++;n=n.parentElement}return d}
function hexOf(s,f='#ffffff'){if(!s)return f;const c=document.createElement('canvas').getContext('2d');c.fillStyle=s;const v=c.fillStyle;if(/^#[0-9a-f]{6}$/i.test(v))return v;return f}
function syncInspector(){const s=selected?stateOf(selected):null;q('#leSelected').textContent=s?(selected.dataset.leKind||selected.tagName)+' · '+selected.dataset.leId:'NINGUNA';const set=(id,v)=>{const e=q(id);if(e)e.value=v??''};if(!s){set('#leText','');updateHandle();return}set('#leText',selected.tagName==='IMG'?'[IMAGEN]':selected.innerHTML);set('#leLayerName',s.name);set('#leX',s.x);set('#leY',s.y);set('#leRot',s.rot);set('#leScale',s.scale);set('#leW',parseFloat(s.w)||Math.round(selected.getBoundingClientRect().width));set('#leH',parseFloat(s.h)||Math.round(selected.getBoundingClientRect().height));set('#leZ',parseInt(s.z)||0);set('#leRadius',parseFloat(s.radius)||0);set('#leFont',s.font||'inherit');set('#leFontSize',parseFloat(s.fontSize)||parseFloat(getComputedStyle(selected).fontSize));set('#leWeight',parseInt(s.weight)||parseInt(getComputedStyle(selected).fontWeight)||400);set('#leLetter',parseFloat(s.letter)||0);set('#leLineHeight',parseFloat(s.lineHeight)||parseFloat(getComputedStyle(selected).lineHeight)||1);set('#leOpacity',s.opacity===''?1:s.opacity);set('#leColor',hexOf(getComputedStyle(selected).color,'#ffffff'));set('#leBg',hexOf(getComputedStyle(selected).backgroundColor,'#000000'));set('#leBorder',hexOf(getComputedStyle(selected).borderColor,'#ffffff'));set('#leBorderWidth',parseFloat(s.borderWidth)||0);set('#leBorderStyle',s.borderStyle||'solid');set('#leAlign',s.align||getComputedStyle(selected).textAlign||'left');set('#leTransformText',s.textTransform||'none');set('#lePaddingTop',parseFloat(s.paddingTop)||0);set('#lePaddingBottom',parseFloat(s.paddingBottom)||0);set('#leMinHeight',parseFloat(s.minHeight)||0);set('#leShadowX',s.shadowX);set('#leShadowY',s.shadowY);set('#leShadowBlur',s.shadowBlur);set('#leShadowSpread',s.shadowSpread);set('#leShadowColor',s.shadowColor);set('#leObjectFit',s.objectFit||getComputedStyle(selected).objectFit||'cover');set('#leObjectPosition',s.objectPosition||getComputedStyle(selected).objectPosition||'50% 50%');q('#leTransparentBg').checked=s.transparentBg;q('#leImageTools').hidden=selected.tagName!=='IMG';set('#leBlur',s.blur);set('#leBright',s.bright);set('#leSat',s.sat);set('#leHue',s.hue);set('#leBlend',s.blend||'normal');set('#leAnim',s.anim);set('#leAnimSpeed',s.animSpeed);set('#leAnimAmp',s.animAmp);set('#leDelay',s.delay);set('#leDuration',s.duration);set('#leReveal',s.reveal);updateHandle()}

// ----- responsive state / history / save -----
function clone(v){return JSON.parse(JSON.stringify(v))}
function sectionId(section){return section?.dataset.leSection||'home'}
function defaultSectionBackground(){return {assetId:'',src:'',fit:'cover',x:50,y:50,repeat:'no-repeat',overlay:'#171714',overlayOpacity:0}}
function resolvedSectionBackground(id,bp=activeBreakpoint){return sectionBackgrounds[bp][id]||((bp==='mobile')?sectionBackgrounds.tablet[id]:null)||sectionBackgrounds.desktop[id]||null}
function setSectionBackground(section,bg,scope=applyTo){const id=sectionId(section);if(scope==='all')['desktop','tablet','mobile'].forEach(bp=>sectionBackgrounds[bp][id]=clone(bg));else sectionBackgrounds[activeBreakpoint][id]=clone(bg);applySectionBackground(section,resolvedSectionBackground(id));syncSectionBackgroundInspector()}
function clearSectionBackground(section,scope=applyTo){const id=sectionId(section);if(scope==='all')['desktop','tablet','mobile'].forEach(bp=>delete sectionBackgrounds[bp][id]);else delete sectionBackgrounds[activeBreakpoint][id];applySectionBackground(section,resolvedSectionBackground(id));syncSectionBackgroundInspector()}
function cssImage(url){return url?`url(${JSON.stringify(url)})`:''}
function renderSectionBackground(section,bg,url){if(!bg||!url){section.classList.remove('le-section-has-bg');section.style.removeProperty('--le-section-image');section.style.removeProperty('--le-section-fit');section.style.removeProperty('--le-section-position');section.style.removeProperty('--le-section-repeat');section.style.removeProperty('--le-section-overlay');return}const hex=bg.overlay||'#171714',alpha=+(bg.overlayOpacity||0);section.classList.add('le-section-has-bg');section.style.setProperty('--le-section-image',cssImage(url));section.style.setProperty('--le-section-fit',bg.fit||'cover');section.style.setProperty('--le-section-position',`${bg.x??50}% ${bg.y??50}%`);section.style.setProperty('--le-section-repeat',bg.repeat||'no-repeat');section.style.setProperty('--le-section-overlay',`color-mix(in srgb, ${hex} ${Math.round(alpha*100)}%, transparent)`)}
async function applySectionBackground(section,bg){if(!section)return;if(!bg){renderSectionBackground(section,null,'');if(section===currentSection)syncSectionBackgroundInspector();return}if(bg.assetId){try{const blob=await getBlob(bg.assetId);if(!blob||resolvedSectionBackground(sectionId(section))?.assetId!==bg.assetId)return;const old=section.dataset.leSectionBgUrl;if(old)URL.revokeObjectURL(old);const url=URL.createObjectURL(blob);section.dataset.leSectionBgUrl=url;renderSectionBackground(section,bg,url);if(section===currentSection)syncSectionBackgroundInspector()}catch(e){console.warn('No se pudo cargar el fondo de sección',e)}}else{renderSectionBackground(section,bg,bg.src||'');if(section===currentSection)syncSectionBackgroundInspector()}}
function applySectionBackgrounds(bp=activeBreakpoint){sections.forEach(section=>applySectionBackground(section,resolvedSectionBackground(sectionId(section),bp)))}
function syncSectionBackgroundInspector(){const section=currentSection||q('#home'),bg=resolvedSectionBackground(sectionId(section))||defaultSectionBackground(),has=!!resolvedSectionBackground(sectionId(section));const set=(id,v)=>{const el=q(id);if(el)el.value=v};set('#leSectionBgFit',bg.fit);set('#leSectionBgX',bg.x);set('#leSectionBgY',bg.y);set('#leSectionBgRepeat',bg.repeat);set('#leSectionBgOverlay',bg.overlay);set('#leSectionBgOverlayOpacity',bg.overlayOpacity);const preview=q('#leSectionBgPreview');if(preview){preview.textContent=has?'FONDO ACTIVO · '+sectionId(section).toUpperCase():'SIN FONDO';preview.style.backgroundImage=section.style.getPropertyValue('--le-section-image')||''}}
function seedResponsive(){qa('.le-editable').forEach(el=>responsive.desktop[el.dataset.leId]=stateOf(el))}
function recordElement(el,scope=applyTo){const s=stateOf(el);if(scope==='all'){['desktop','tablet','mobile'].forEach(bp=>responsive[bp][s.id]=clone(s))}else responsive[activeBreakpoint][s.id]=clone(s)}
function recordAll(){qa('.le-editable').forEach(el=>recordElement(el,'breakpoint'))}
function resolvedState(id,bp=activeBreakpoint){return responsive[bp][id]||((bp==='mobile')?responsive.tablet[id]:null)||responsive.desktop[id]}
function applyResponsive(bp=activeBreakpoint){const known=new Map(qa('.le-editable').map(e=>[e.dataset.leId,e])),ids=new Set([...Object.keys(responsive.desktop),...Object.keys(responsive.tablet),...Object.keys(responsive.mobile)]);ids.forEach(id=>{const s=resolvedState(id,bp);if(!s)return;let el=known.get(id);if(!el&&s.added){el=createAddedFromState(s);known.set(id,el)}if(el)applyState(el,s)});qa('.le-added').forEach(el=>{if(!ids.has(el.dataset.leId))el.remove()});applySectionBackgrounds(bp);tagEditables();rebuildOutliner();syncInspector();syncSectionBackgroundInspector()}
function setBreakpoint(bp){if(!['desktop','tablet','mobile'].includes(bp))return;recordAll();activeBreakpoint=bp;document.body.dataset.lePreview=bp;applyResponsive(bp);qa('.le-breakpoints button').forEach(b=>b.classList.toggle('active',b.id.toLowerCase()===`le${bp}`));select(null)}
function capture(){recordAll();return {version:30,breakpoint:activeBreakpoint,responsive:clone(responsive),sectionBackgrounds:clone(sectionBackgrounds),elements:qa('.le-editable').map(stateOf),page:readPage()}}
function pushHistory(){const s=JSON.stringify(capture());if(history[historyIndex]===s)return;history=history.slice(0,historyIndex+1);history.push(s);if(history.length>60)history.shift();historyIndex=history.length-1}
function restore(snapshot,useSavedBreakpoint=editing){if(typeof snapshot==='string')snapshot=JSON.parse(snapshot);if(snapshot.responsive){responsive={desktop:clone(snapshot.responsive.desktop||{}),tablet:clone(snapshot.responsive.tablet||{}),mobile:clone(snapshot.responsive.mobile||{})}}else if(snapshot.elements){responsive={desktop:{},tablet:{},mobile:{}};snapshot.elements.forEach(s=>['desktop','tablet','mobile'].forEach(bp=>responsive[bp][s.id]=clone(s)))}if(snapshot.sectionBackgrounds)sectionBackgrounds={desktop:clone(snapshot.sectionBackgrounds.desktop||{}),tablet:clone(snapshot.sectionBackgrounds.tablet||{}),mobile:clone(snapshot.sectionBackgrounds.mobile||{})};if(useSavedBreakpoint)activeBreakpoint=snapshot.breakpoint||activeBreakpoint;if(editing)document.body.dataset.lePreview=activeBreakpoint;applyResponsive(activeBreakpoint);applyPage(snapshot.page||{});select(null)}
let saveTimer=null;
function save(showStatus=true){
  try{
    const payload=JSON.stringify(capture());
    localStorage.setItem(KEY,payload);
    localStorage.setItem(KEY+'-saved-at',String(Date.now()));
    // Read-back check so a failed/blocked storage write is never reported as saved.
    if(localStorage.getItem(KEY)!==payload) throw new Error('No se pudo verificar el guardado');
    if(showStatus){const b=q('#leSave');if(b){b.textContent='GUARDADO ✓';setTimeout(()=>b.textContent='GUARDAR ⌘S',900)}}
    return true;
  }catch(err){
    console.error('MARUATAZO save failed',err);
    const b=q('#leSave');if(b){b.textContent='ERROR AL GUARDAR';setTimeout(()=>b.textContent='GUARDAR ⌘S',1800)}
    return false;
  }
}
function autosave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>save(false),400)}
function load(){try{const raw=localStorage.getItem(KEY)||localStorage.getItem(LEGACY_KEY);if(!raw)return;const d=JSON.parse(raw);if(d)restore(d)}catch(e){console.warn('MARUATAZO load failed',e)}}

// ----- add assets -----
function makeAdded(tag='div',kind='element'){const sec=currentSection||q('#home'),el=document.createElement(tag);el.className='le-added le-editable';el.dataset.leId='added-'+Date.now()+'-'+Math.random().toString(36).slice(2,6);el.dataset.leKind=kind;el.dataset.leX=40;el.dataset.leY=40;el.dataset.leRot=0;el.dataset.leScale=1;el.style.position='absolute';el.style.left='50%';el.style.top='50%';el.style.zIndex='20';sec.appendChild(el);applyTransform(el);return el}
function createAddedFromState(s){const sec=q(`[data-le-section="${CSS.escape(s.section||'home')}"]`)||q('#home');let el;if(s.kind==='image'){el=document.createElement('img');if(s.src)el.src=s.src}else if(s.kind==='glb'){el=document.createElement('div');el.dataset.assetId=s.assetId||''}else el=document.createElement(s.tag&&/^(DIV|SPAN|BUTTON|P|H1|H2|A|ARTICLE|FIGURE)$/i.test(s.tag)?s.tag:'div');if(s.classes)el.className=s.classes;el.classList.remove('le-selected-el');el.classList.add('le-added','le-editable');el.dataset.leId=s.id;el.dataset.leKind=s.kind||'element';el.style.position='absolute';el.style.left='50%';el.style.top='50%';el.style.zIndex='20';sec.appendChild(el);if(s.kind==='glb'){el.classList.add('le-glb');setupGLBElement(el,s.assetId)}if(s.kind==='image'&&s.assetId){el.dataset.assetId=s.assetId;hydrateImage(el,s.assetId)}return el}
function add(kind){let el;if(kind==='text'){el=makeAdded('div','text');el.textContent='NUEVO TEXTO';el.style.font='700 42px Georgia';el.style.color='#eef8f2'}else if(kind==='button'){el=makeAdded('button','button');el.textContent='BOTÓN →';el.style.padding='14px 20px';el.style.border='1px solid rgba(255,255,255,.5)';el.style.background='rgba(5,20,35,.5)';el.style.color='#fff'}else if(kind==='shape'){el=makeAdded('div','shape');el.style.width='120px';el.style.height='120px';el.style.borderRadius='50%';el.style.background='#6de7db'}else if(kind==='line'){el=makeAdded('div','line');el.style.width='180px';el.style.height='2px';el.style.background='#d7fff8'}else if(kind==='star'){el=makeAdded('div','star');el.textContent='✦';el.style.fontSize='34px';el.style.color='#a8fff5';el.dataset.leAnim='pulse';applyFx(el)}else if(kind==='glow'){el=makeAdded('div','glow');el.style.width='180px';el.style.height='180px';el.style.borderRadius='50%';el.style.background='radial-gradient(circle,rgba(72,255,229,.65),rgba(72,255,229,0) 68%)';el.style.mixBlendMode='screen'}else if(kind==='orb'){el=makeAdded('div','orb');el.style.width='90px';el.style.height='90px';el.style.borderRadius='50%';el.style.background='radial-gradient(circle at 35% 30%,#dcfff8,#27a3aa 45%,#08374a 76%)';el.style.boxShadow='0 0 50px rgba(73,240,224,.32)'}else if(kind==='label'){el=makeAdded('div','label');el.textContent='MARUATA';el.style.font='700 11px Arial';el.style.letterSpacing='.18em';el.style.color='#d9f5ee'}else if(kind==='image'){q('#leImageFile').click();return}else if(kind==='glb'){q('#leGLBFile').click();return}if(el){select(el);pushHistory();autosave();q('[data-le-tab="style"]').click()}}
qa('[data-le-add]').forEach(b=>b.onclick=()=>add(b.dataset.leAdd));
q('#leImageFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;const id='landing-image-'+Date.now();await storeBlob(id,f);const el=makeAdded('img','image');el.dataset.assetId=id;el.src=URL.createObjectURL(f);el.style.width='260px';el.style.height='auto';el.style.objectFit='cover';recordElement(el,'all');select(el);q('[data-le-tab="style"]')?.click();pushHistory();autosave();e.target.value=''};

// ----- simple landing GLB -----
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(ASSET_DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('assets');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function storeBlob(id,b){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put(b,id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
async function getBlob(id){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction('assets').objectStore('assets').get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function hydrateImage(el,id){try{const blob=await getBlob(id);if(!blob||!el.isConnected)return;const old=el.dataset.leObjectUrl;if(old)URL.revokeObjectURL(old);const url=URL.createObjectURL(blob);el.dataset.leObjectUrl=url;el.src=url}catch(e){console.warn('No se pudo cargar la imagen local',e)}}
async function setupGLBElement(el,assetId,blob){if(!window.THREE||!THREE.GLTFLoader)return;el.classList.add('le-glb');el.dataset.assetId=assetId;el.style.width=el.style.width||'320px';el.style.height=el.style.height||'260px';el.style.background='radial-gradient(circle at 50% 55%,rgba(84,224,203,.13),transparent 65%)';const canvas=document.createElement('canvas');canvas.style.cssText='width:100%;height:100%;display:block;pointer-events:none';el.innerHTML='';el.appendChild(canvas);blob=blob||await getBlob(assetId);if(!blob)return;const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputEncoding=THREE.sRGBEncoding;const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(34,1,.1,100);cam.position.set(0,1.4,5);scene.add(new THREE.HemisphereLight(0xbdefff,0x14212b,1.8));const d=new THREE.DirectionalLight(0xffc18c,2);d.position.set(4,5,3);scene.add(d);const url=URL.createObjectURL(blob);new THREE.GLTFLoader().load(url,g=>{URL.revokeObjectURL(url);const obj=g.scene,box=new THREE.Box3().setFromObject(obj),size=new THREE.Vector3(),center=new THREE.Vector3();box.getSize(size);box.getCenter(center);obj.position.sub(center);obj.scale.setScalar(2.4/(Math.max(size.x,size.y,size.z)||1));scene.add(obj);const loop=()=>{if(!el.isConnected)return;requestAnimationFrame(loop);obj.rotation.y+=.004;const w=el.clientWidth||320,h=el.clientHeight||260;renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();renderer.render(scene,cam)};loop()})}
q('#leGLBFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;const id='landing-glb-'+Date.now();await storeBlob(id,f);const el=makeAdded('div','glb');el.dataset.assetId=id;await setupGLBElement(el,id,f);select(el);pushHistory();autosave();e.target.value=''};

// ----- inspector events -----
const mut=(fn)=>{if(!selected||selected.dataset.leLocked==='1')return;fn(selected);applyTransform(selected);applyFx(selected);recordElement(selected);pushHistory();rebuildOutliner();syncInspector();autosave()};
q('#leText').onchange=e=>mut(el=>{if(isTextTarget(el))el.innerHTML=e.target.value});
[['#leX','leX'],['#leY','leY'],['#leRot','leRot'],['#leScale','leScale']].forEach(([id,k])=>q(id).oninput=e=>mut(el=>el.dataset[k]=e.target.value));
q('#leW').oninput=e=>mut(el=>el.style.width=e.target.value?e.target.value+'px':'');q('#leH').oninput=e=>mut(el=>el.style.height=e.target.value?e.target.value+'px':'');q('#leZ').oninput=e=>mut(el=>el.style.zIndex=e.target.value);q('#leRadius').oninput=e=>mut(el=>el.style.borderRadius=e.target.value+'px');
q('#leFont').onchange=e=>mut(el=>el.style.fontFamily=e.target.value);q('#leFontSize').oninput=e=>mut(el=>el.style.fontSize=e.target.value+'px');q('#leWeight').oninput=e=>mut(el=>el.style.fontWeight=e.target.value);q('#leLetter').oninput=e=>mut(el=>el.style.letterSpacing=e.target.value+'px');q('#leLineHeight').oninput=e=>mut(el=>el.style.lineHeight=e.target.value);q('#leOpacity').oninput=e=>mut(el=>el.style.opacity=e.target.value);q('#leColor').oninput=e=>mut(el=>el.style.setProperty('color',e.target.value,'important'));q('#leBg').oninput=e=>mut(el=>{el.dataset.leTransparentBg='0';el.style.setProperty('background-color',e.target.value,'important')});q('#leTransparentBg').onchange=e=>mut(el=>{el.dataset.leTransparentBg=e.target.checked?'1':'0';if(e.target.checked)el.style.setProperty('background-color','transparent','important');else el.style.removeProperty('background-color')});q('#leBorder').oninput=e=>mut(el=>{el.style.borderStyle=el.style.borderStyle||'solid';el.style.setProperty('border-color',e.target.value,'important')});q('#leBorderWidth').oninput=e=>mut(el=>el.style.borderWidth=e.target.value+'px');q('#leBorderStyle').onchange=e=>mut(el=>el.style.borderStyle=e.target.value);q('#leAlign').onchange=e=>mut(el=>el.style.textAlign=e.target.value);q('#leTransformText').onchange=e=>mut(el=>el.style.textTransform=e.target.value);q('#lePaddingTop').oninput=e=>mut(el=>el.style.paddingTop=e.target.value+'px');q('#lePaddingBottom').oninput=e=>mut(el=>el.style.paddingBottom=e.target.value+'px');q('#leMinHeight').oninput=e=>mut(el=>el.style.minHeight=e.target.value+'px');
[['#leShadowX','leShadowX'],['#leShadowY','leShadowY'],['#leShadowBlur','leShadowBlur'],['#leShadowSpread','leShadowSpread']].forEach(([id,k])=>q(id).oninput=e=>mut(el=>{el.dataset[k]=e.target.value;el.style.boxShadow=`${el.dataset.leShadowX||0}px ${el.dataset.leShadowY||0}px ${el.dataset.leShadowBlur||0}px ${el.dataset.leShadowSpread||0}px ${el.dataset.leShadowColor||'#171714'}`}));q('#leShadowColor').oninput=e=>mut(el=>{el.dataset.leShadowColor=e.target.value;el.style.boxShadow=`${el.dataset.leShadowX||0}px ${el.dataset.leShadowY||0}px ${el.dataset.leShadowBlur||0}px ${el.dataset.leShadowSpread||0}px ${e.target.value}`});
q('#leObjectFit').onchange=e=>mut(el=>{if(el.tagName==='IMG')el.style.objectFit=e.target.value});q('#leObjectPosition').onchange=e=>mut(el=>{if(el.tagName==='IMG')el.style.objectPosition=e.target.value});q('#leReplaceImage').onclick=()=>{if(selected?.tagName==='IMG')q('#leReplaceImageFile').click()};q('#leReplaceImageFile').onchange=async e=>{const f=e.target.files?.[0];if(!f||selected?.tagName!=='IMG')return;const id='landing-image-'+Date.now();await storeBlob(id,f);selected.dataset.assetId=id;selected.src=URL.createObjectURL(f);recordElement(selected);pushHistory();autosave();e.target.value=''};
function updateCurrentSectionBackground(patch){const section=currentSection||q('#home'),current=resolvedSectionBackground(sectionId(section));if(!current)return;setSectionBackground(section,{...current,...patch});pushHistory();autosave()}
q('#leUseAsSectionBg').onclick=()=>{if(selected?.tagName!=='IMG')return;const section=rootSection(selected)||currentSection||q('#home'),bg={...defaultSectionBackground(),assetId:selected.dataset.assetId||'',src:selected.dataset.assetId?'':selected.getAttribute('src')||''};setSectionBackground(section,bg);selected.dataset.leHidden='1';selected.style.display='none';recordElement(selected);pushHistory();autosave();select(null)};
q('#leReplaceSectionBg').onclick=()=>q('#leSectionBgFile').click();q('#leSectionBgFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;const id='section-background-'+Date.now();await storeBlob(id,f);const section=currentSection||q('#home'),old=resolvedSectionBackground(sectionId(section))||defaultSectionBackground();setSectionBackground(section,{...old,assetId:id,src:''});pushHistory();autosave();e.target.value=''};
q('#leRemoveSectionBg').onclick=()=>{clearSectionBackground(currentSection||q('#home'));pushHistory();autosave()};q('#leSectionBgFit').onchange=e=>updateCurrentSectionBackground({fit:e.target.value});q('#leSectionBgRepeat').onchange=e=>updateCurrentSectionBackground({repeat:e.target.value});[['#leSectionBgX','x'],['#leSectionBgY','y'],['#leSectionBgOverlay','overlay'],['#leSectionBgOverlayOpacity','overlayOpacity']].forEach(([id,key])=>q(id).oninput=e=>updateCurrentSectionBackground({[key]:e.target.value}));
[['#leBlur','leBlur'],['#leBright','leBright'],['#leSat','leSat'],['#leHue','leHue'],['#leAnimSpeed','leAnimSpeed'],['#leAnimAmp','leAnimAmp'],['#leDelay','leDelay'],['#leDuration','leDuration']].forEach(([id,k])=>q(id).oninput=e=>mut(el=>el.dataset[k]=e.target.value));q('#leBlend').onchange=e=>mut(el=>el.style.mixBlendMode=e.target.value);q('#leAnim').onchange=e=>mut(el=>el.dataset.leAnim=e.target.value);q('#leReveal').onchange=e=>mut(el=>el.dataset.leReveal=e.target.value);

function duplicateSelected(){if(!selected||selected.dataset.leLocked==='1')return;const s=stateOf(selected);s.id='added-'+Date.now();s.added=true;s.x+=24;s.y+=24;const c=createAddedFromState(s);applyState(c,s);recordElement(c,'all');select(c);pushHistory();autosave()}
q('#leDuplicate').onclick=duplicateSelected;q('#leHide').onclick=()=>mut(el=>{el.dataset.leHidden=el.dataset.leHidden==='1'?'0':'1';el.style.display=el.dataset.leHidden==='1'?'none':''});q('#leLock').onclick=()=>{if(!selected)return;selected.dataset.leLocked=selected.dataset.leLocked==='1'?'0':'1';recordElement(selected);pushHistory();rebuildOutliner();autosave()};q('#leDelete').onclick=()=>{if(!selected||selected.dataset.leLocked==='1')return;const el=selected;if(el.classList.contains('le-added')){['desktop','tablet','mobile'].forEach(bp=>delete responsive[bp][el.dataset.leId]);el.remove()}else{el.dataset.leDeleted='1';el.style.display='none';recordElement(el)}selected=null;pushHistory();rebuildOutliner();syncInspector();autosave()};
q('#leLayerName').onchange=e=>mut(el=>el.dataset.leName=e.target.value.trim());
[['#leBack',-999],['#leBackward',-1],['#leForward',1],['#leFront',999]].forEach(([id,delta])=>q(id).onclick=()=>mut(el=>{const z=parseInt(getComputedStyle(el).zIndex)||0;el.style.zIndex=delta===999?'999':delta===-999?'0':String(z+delta)}));
qa('[data-le-alignbox]').forEach(b=>b.onclick=()=>mut(el=>{const sec=rootSection(el),sr=sec.getBoundingClientRect(),r=el.getBoundingClientRect(),mode=b.dataset.leAlignbox;if(mode==='left')el.dataset.leX=+(el.dataset.leX||0)+(sr.left-r.left);if(mode==='center')el.dataset.leX=+(el.dataset.leX||0)+(sr.left+sr.width/2-(r.left+r.width/2));if(mode==='right')el.dataset.leX=+(el.dataset.leX||0)+(sr.right-r.right);if(mode==='middle')el.dataset.leY=+(el.dataset.leY||0)+(sr.top+sr.height/2-(r.top+r.height/2))}));

// ----- page look -----
function readPage(){return {paper:q('#lePaper').value,sky:q('#leSky').value,horizon:q('#leHorizon').value,water:q('#leWater').value,vegetation:q('#leVegetation').value,buttonBase:q('#leButtonBase').value,vegetationVisible:q('#leVegetationVisible').checked,stars:+q('#leStars').value,grain:+q('#lePageGrain').value,vignette:+q('#lePageVignette').value,glow:+q('#lePageGlow').value}}
function applyPage(p=readPage()){const root=document.documentElement;root.style.setProperty('--le-paper',p.paper||'#f1ebdd');root.style.setProperty('--le-sky',p.sky||'#258baa');root.style.setProperty('--le-horizon',p.horizon||'#77bed0');root.style.setProperty('--le-water',p.water||'#12647a');root.style.setProperty('--le-vegetation',p.vegetation||'#477c48');root.style.setProperty('--le-button-base',p.buttonBase||'#f1ebdd');root.style.setProperty('--le-stars',p.stars??1);root.style.setProperty('--le-page-grain',p.grain??.15);root.style.setProperty('--le-page-vignette',p.vignette??.18);root.style.setProperty('--le-page-glow',p.glow??.7);document.body.classList.toggle('le-hide-vegetation',p.vegetationVisible===false);Object.entries({lePaper:p.paper,leSky:p.sky,leHorizon:p.horizon,leWater:p.water,leVegetation:p.vegetation,leButtonBase:p.buttonBase,leStars:p.stars,lePageGrain:p.grain,lePageVignette:p.vignette,lePageGlow:p.glow}).forEach(([id,v])=>{const e=q('#'+id);if(e&&v!=null)e.value=v});const vv=q('#leVegetationVisible');if(vv)vv.checked=p.vegetationVisible!==false}
['#lePaper','#leSky','#leHorizon','#leWater','#leVegetation','#leButtonBase','#leVegetationVisible','#leStars','#lePageGrain','#lePageVignette','#lePageGlow'].forEach(id=>q(id).oninput=()=>{applyPage();pushHistory();autosave()});

// ----- tabs / editor mode -----
qa('[data-le-tab]').forEach(b=>b.onclick=()=>{qa('[data-le-tab]').forEach(x=>x.classList.toggle('active',x===b));qa('[data-le-pane]').forEach(p=>p.classList.toggle('active',p.dataset.lePane===b.dataset.leTab))});
sectionSelect.onchange=()=>{currentSection=q(`[data-le-section="${CSS.escape(sectionSelect.value)}"]`);select(null);syncSectionBackgroundInspector();rebuildOutliner()};
function freezeDesignTransforms(){
  qa('.le-editable').forEach(el=>{
    if(el.dataset.leFrozen==='1')return;
    el.dataset.leFrozen='1';
    el.dataset.leInlineTransform=el.style.getPropertyValue('transform')||'';
    el.dataset.leInlineTransformPriority=el.style.getPropertyPriority('transform')||'';
    const t=getComputedStyle(el).transform;
    el.style.setProperty('transform',t&&t!=='none'?t:'none','important');
  });
}
function unfreezeDesignTransforms(){
  qa('.le-editable[data-le-frozen="1"]').forEach(el=>{
    const v=el.dataset.leInlineTransform||'',p=el.dataset.leInlineTransformPriority||'';
    if(v)el.style.setProperty('transform',v,p);else el.style.removeProperty('transform');
    delete el.dataset.leFrozen;delete el.dataset.leInlineTransform;delete el.dataset.leInlineTransformPriority;
  });
}
function setEditing(on){
  editing=on;
  if(on){activeBreakpoint=innerWidth<=767?'mobile':innerWidth<=1024?'tablet':'desktop';document.body.dataset.lePreview=activeBreakpoint;applyResponsive(activeBreakpoint);tagEditables();freezeDesignTransforms()}else{recordAll();unfreezeDesignTransforms();delete document.body.dataset.lePreview;activeBreakpoint=innerWidth<=767?'mobile':innerWidth<=1024?'tablet':'desktop';applyResponsive(activeBreakpoint)}
  document.body.classList.toggle('landing-editing',on);panel.classList.toggle('show',on);launcher.textContent=on?'PREVIEW WEB ◉':'EDITAR WEB ✦';if(!on)select(null)
}
launcher.onclick=()=>setEditing(!editing);q('#leClose').onclick=()=>setEditing(false);q('#lePreview').onclick=()=>setEditing(false);
q('#leDesktop').onclick=()=>setBreakpoint('desktop');q('#leTablet').onclick=()=>setBreakpoint('tablet');q('#leMobile').onclick=()=>setBreakpoint('mobile');q('#leApplyTo').onchange=e=>applyTo=e.target.value;

// ----- click / drag / direct text edit -----
let activePointerId=null, movedDuringDrag=false;
function beginTextEdit(el){if(!el||!isTextTarget(el)||el.dataset.leLocked==='1'||el.contentEditable==='true')return;const before=el.innerHTML;el.contentEditable='true';el.focus();const range=document.createRange(),selection=getSelection();range.selectNodeContents(el);selection.removeAllRanges();selection.addRange(range);const done=commit=>{el.contentEditable='false';el.removeEventListener('blur',onBlur);el.removeEventListener('keydown',onKey);if(!commit)el.innerHTML=before;else recordElement(el);pushHistory();syncInspector();autosave()};const onBlur=()=>done(true);const onKey=ev=>{if(ev.key==='Escape'){ev.preventDefault();done(false)}else if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();done(true)}};el.addEventListener('blur',onBlur);el.addEventListener('keydown',onKey)}
function stopPageAction(e){
  if(!editing||isEditorUI(e.target))return false;
  const action=e.target.closest('a,button,[role="button"],summary');
  if(action){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();return true}
  return false;
}
document.addEventListener('pointerdown',e=>{
  if(!editing||isEditorUI(e.target)||e.button!==0)return;
  const el=e.target.closest('.le-editable');if(!el)return;
  e.preventDefault();e.stopPropagation();
  select(el);
  if(e.detail===2&&isTextTarget(el)){beginTextEdit(el);return}
  if(el.dataset.leLocked==='1')return;
  dragging=true;movedDuringDrag=false;activePointerId=e.pointerId;
  dragStart={mx:e.clientX,my:e.clientY,x:+(el.dataset.leX||0),y:+(el.dataset.leY||0)};
  el.setPointerCapture?.(e.pointerId);
},true);
document.addEventListener('pointermove',e=>{
  if(!editing||!dragging||!selected||e.pointerId!==activePointerId)return;
  const dx=e.clientX-dragStart.mx,dy=e.clientY-dragStart.my;if(Math.abs(dx)+Math.abs(dy)>2)movedDuringDrag=true;
  const fine=e.shiftKey?.25:1;selected.dataset.leX=dragStart.x+dx*fine;selected.dataset.leY=dragStart.y+dy*fine;
  applyTransform(selected);syncInspector();
  e.preventDefault();
},true);
function finishDrag(e){
  if(!dragging)return;dragging=false;activePointerId=null;if(selected)recordElement(selected);pushHistory();autosave();
}
document.addEventListener('pointerup',finishDrag,true);document.addEventListener('pointercancel',finishDrag,true);
// While editing, links/buttons are inert design objects. This runs in capture phase before app.js.
document.addEventListener('click',e=>{
  if(!editing||isEditorUI(e.target))return;
  const el=e.target.closest('.le-editable');
  if(el){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();select(el);if(e.detail===2)beginTextEdit(el);return}
  stopPageAction(e);
},true);
document.addEventListener('dragstart',e=>{if(editing&&!isEditorUI(e.target)&&e.target.closest('.le-editable')){e.preventDefault();e.stopPropagation()}},true);
document.addEventListener('dblclick',e=>{if(!editing||isEditorUI(e.target))return;const el=e.target.closest('.le-editable');if(!el)return;e.preventDefault();e.stopPropagation();beginTextEdit(el)},true);

// ----- project controls -----
q('#leSave').onclick=save;q('#leExport').onclick=()=>{const blob=new Blob([JSON.stringify(capture(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='maruatazo-web-v29.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};q('#leImport').onclick=()=>q('#leProjectFile').click();q('#leProjectFile').onchange=async e=>{try{restore(JSON.parse(await e.target.files[0].text()));save()}catch(err){alert('Proyecto inválido')}e.target.value=''};q('#leReset').onclick=()=>{if(confirm('¿Restaurar la landing original?')){localStorage.removeItem(KEY);localStorage.removeItem(LEGACY_KEY);location.reload()}};
q('#leUndo').onclick=()=>{if(historyIndex>0){historyIndex--;restore(history[historyIndex])}};q('#leRedo').onclick=()=>{if(historyIndex<history.length-1){historyIndex++;restore(history[historyIndex])}};
let copiedState=null;
window.addEventListener('keydown',e=>{const mod=e.metaKey||e.ctrlKey,key=e.key.toLowerCase();if(mod&&key==='s'){e.preventDefault();save();return}if(!editing)return;if(mod&&key==='z'){e.preventDefault();q(e.shiftKey?'#leRedo':'#leUndo').click();return}if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')||document.activeElement?.isContentEditable)return;if(mod&&key==='c'&&selected){e.preventDefault();copiedState=stateOf(selected);return}if(mod&&key==='v'&&copiedState){e.preventDefault();const s=clone(copiedState);s.id='added-'+Date.now();s.added=true;s.x+=24;s.y+=24;const c=createAddedFromState(s);applyState(c,s);recordElement(c,'all');select(c);pushHistory();autosave();return}if(mod&&key==='d'){e.preventDefault();duplicateSelected();return}if(e.key.startsWith('Arrow')&&selected&&selected.dataset.leLocked!=='1'){e.preventDefault();const step=e.shiftKey?10:1;if(e.key==='ArrowLeft')selected.dataset.leX=+(selected.dataset.leX||0)-step;if(e.key==='ArrowRight')selected.dataset.leX=+(selected.dataset.leX||0)+step;if(e.key==='ArrowUp')selected.dataset.leY=+(selected.dataset.leY||0)-step;if(e.key==='ArrowDown')selected.dataset.leY=+(selected.dataset.leY||0)+step;applyTransform(selected);recordElement(selected);pushHistory();syncInspector();autosave();return}if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();q('#leDelete').click()}if(e.key==='Escape')setEditing(false)});
window.addEventListener('beforeunload',()=>save(false));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save(false)});

// outputs
qa('.le-range').forEach(l=>{const i=l.querySelector('input'),o=l.querySelector('output');const upd=()=>o.textContent=i.value;i.addEventListener('input',upd);upd()});

// load persistent state and delayed GLBs
seedResponsive();load();applyResponsive(activeBreakpoint);tagEditables();qa('.le-glb[data-asset-id]').forEach(el=>setupGLBElement(el,el.dataset.assetId));pushHistory();rebuildOutliner();
})();
