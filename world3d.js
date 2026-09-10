(() => {
  const host = document.getElementById('world3d');
  const canvas = document.getElementById('worldCanvas');
  if (!host || !window.THREE) {
    if (host) host.innerHTML = '<div style="padding:30px">Conecta a internet para cargar el mapa 3D.</div>';
    return;
  }

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x8c6682, 0.0065);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 260);
  camera.position.set(31, 22, 34);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  if ('useLegacyLights' in renderer) renderer.useLegacyLights = false;

  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.minDistance = 10;
  controls.maxDistance = 54;
  controls.minPolarAngle = 0.42;
  controls.maxPolarAngle = 1.31;
  controls.enablePan = true;
  controls.screenSpacePanning = false;
  controls.target.set(0, 3, -2);

  // Sunset sky dome: peach horizon -> lavender -> deep blue-violet.
  const skyGeo = new THREE.SphereGeometry(150, 32, 18);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x514b83) },
      midColor: { value: new THREE.Color(0xcf7f8f) },
      horizonColor: { value: new THREE.Color(0xf5ba76) },
      offset: { value: 10.0 },
      exponent: { value: 0.72 }
    },
    vertexShader: `varying vec3 vWorldPosition; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vWorldPosition=wp.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 midColor; uniform vec3 horizonColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; void main(){ float h=normalize(vWorldPosition+vec3(0.0,offset,0.0)).y; float t=pow(max(h,0.0),exponent); vec3 c=mix(horizonColor,midColor,smoothstep(0.0,.35,t)); c=mix(c,topColor,smoothstep(.38,1.0,t)); gl_FragColor=vec4(c,1.0); }`
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.1, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.92, fog: false })
  );
  sunDisc.position.set(-40, 19, -52);
  sunDisc.lookAt(camera.position);
  scene.add(sunDisc);

  scene.add(new THREE.HemisphereLight(0x8f83ad, 0x182f25, 0.62));
  const sun = new THREE.DirectionalLight(0xff8a45, 5.2);
  sun.position.set(-34, 20, 23); // low warm side-light = long PS2-style shadows
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.035;
  sun.shadow.camera.left = -42; sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 42; sun.shadow.camera.bottom = -42;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 100;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x66558d, 0.38);
  fill.position.set(30, 14, -26);
  scene.add(fill);

  function heightLocal(x, z) {
    // Continuous coastal hillside: high inland (negative z), falling toward the beach/ocean.
    let h = 1.15;
    h += 8.4 * Math.exp(-((x + 13) ** 2 + (z + 11) ** 2) / 115);
    h += 6.7 * Math.exp(-((x - 8) ** 2 + (z + 15) ** 2) / 145);
    h += 3.8 * Math.exp(-((x - 17) ** 2 + (z + 2) ** 2) / 105);
    h += 2.0 * Math.exp(-((x + 25) ** 2 + (z + 20) ** 2) / 260);
    h += 0.72 * Math.sin(x * 0.20) * Math.cos(z * 0.19) + 0.28 * Math.sin((x + z) * 0.52);
    const seaDrop = 1.0 - THREE.MathUtils.smoothstep(z, 5.5, 17.0);
    const cliffShelf = 0.55 * (1.0 - THREE.MathUtils.smoothstep(z, 7.5, 12.5));
    return Math.max(0.08, h * seaDrop + cliffShelf);
  }

  const TERRAIN_Z = -5;
  const TERRAIN_W = 118, TERRAIN_D = 96, TERRAIN_SEG_X = 150, TERRAIN_SEG_Z = 120;
  const EDIT_NX = 64, EDIT_NZ = 52;
  const terrainHeights = new Float32Array(EDIT_NX * EDIT_NZ);
  const terrainPaint = new Uint8Array(EDIT_NX * EDIT_NZ); // 0 auto, 1 sand, 2 grass, 3 rock, 4 dirt
  const terrainStateKey = 'maruatazo-v11-terrain';
  const terrainPalette = {
    sand:new THREE.Color(0xcfa56d), grass:new THREE.Color(0x315f43), rock:new THREE.Color(0x765f59), dirt:new THREE.Color(0x895b43)
  };

  function gridCoord(worldX, worldZ){
    const u=THREE.MathUtils.clamp((worldX + TERRAIN_W/2)/TERRAIN_W,0,1)*(EDIT_NX-1);
    const v=THREE.MathUtils.clamp((worldZ - (TERRAIN_Z-TERRAIN_D/2))/TERRAIN_D,0,1)*(EDIT_NZ-1);
    return {u,v};
  }
  function sampleGrid(arr, worldX, worldZ){
    const {u,v}=gridCoord(worldX,worldZ), x0=Math.floor(u), z0=Math.floor(v), x1=Math.min(x0+1,EDIT_NX-1), z1=Math.min(z0+1,EDIT_NZ-1);
    const tx=u-x0,tz=v-z0;
    const a=arr[z0*EDIT_NX+x0]*(1-tx)+arr[z0*EDIT_NX+x1]*tx;
    const b=arr[z1*EDIT_NX+x0]*(1-tx)+arr[z1*EDIT_NX+x1]*tx;
    return a*(1-tz)+b*tz;
  }
  function samplePaint(worldX,worldZ){
    const {u,v}=gridCoord(worldX,worldZ);
    return terrainPaint[Math.round(v)*EDIT_NX+Math.round(u)]||0;
  }
  function groundY(worldX, worldZ){ return heightLocal(worldX, worldZ - TERRAIN_Z) + sampleGrid(terrainHeights,worldX,worldZ); }

  const geo = new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D, TERRAIN_SEG_X, TERRAIN_SEG_Z);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count*3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors,3));
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:.98, metalness:0, flatShading:true });
  const terrain = new THREE.Mesh(geo, terrainMat);
  terrain.position.z = TERRAIN_Z;
  terrain.receiveShadow = true;
  scene.add(terrain);

  function autoTerrainColor(x, localZ, y){
    const low=new THREE.Color(0xb97945), grass=new THREE.Color(0x355c35), high=new THREE.Color(0x173e32);
    let c=y<1 ? low.clone().lerp(grass,THREE.MathUtils.smoothstep(y,.15,1)) : grass.clone().lerp(high,THREE.MathUtils.smoothstep(y,1,8.5));
    c.multiplyScalar(.93+.10*Math.sin(x*.82+localZ*.54));
    return c;
  }
  function updateTerrainGeometry(){
    const pos=geo.attributes.position, col=geo.attributes.color;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i), localZ=pos.getZ(i), worldZ=localZ+TERRAIN_Z;
      const y=heightLocal(x,localZ)+sampleGrid(terrainHeights,x,worldZ); pos.setY(i,y);
      const paint=samplePaint(x,worldZ); let c=autoTerrainColor(x,localZ,y);
      if(paint===1)c=terrainPalette.sand.clone(); else if(paint===2)c=terrainPalette.grass.clone(); else if(paint===3)c=terrainPalette.rock.clone(); else if(paint===4)c=terrainPalette.dirt.clone();
      const shade=.94+.08*Math.sin(x*.47+localZ*.39); c.multiplyScalar(shade);
      col.setXYZ(i,c.r,c.g,c.b);
    }
    pos.needsUpdate=true; col.needsUpdate=true; geo.computeVertexNormals();
  }
  function saveTerrainState(){
    try{localStorage.setItem(terrainStateKey,JSON.stringify({h:Array.from(terrainHeights).map(v=>Math.round(v*1000)/1000),p:Array.from(terrainPaint)}));}catch(e){}
  }
  function loadTerrainState(){
    try{const d=JSON.parse(localStorage.getItem(terrainStateKey)||'null'); if(!d)return; if(Array.isArray(d.h))d.h.slice(0,terrainHeights.length).forEach((v,i)=>terrainHeights[i]=+v||0); if(Array.isArray(d.p))d.p.slice(0,terrainPaint.length).forEach((v,i)=>terrainPaint[i]=v||0);}catch(e){}
  }
  loadTerrainState(); updateTerrainGeometry();

  const terrainFollowers = [];

  // Rocky coastal wall, warmer at sunset and fully grounded.
  const rockMats = [0x8e5943, 0xaa6e50, 0xc0825e].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
  for (let i = 0; i < 39; i++) {
    const x = -25 + i * 1.34;
    const z = 8.0 + Math.sin(i * .83) * 1.25;
    const y = Math.max(.32, groundY(x, z));
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(.7 + Math.random() * 1.15, 1), rockMats[i % rockMats.length]);
    r.scale.set(1.05 + Math.random() * .55, .75 + Math.random() * 1.8, .75 + Math.random() * .35);
    r.rotation.set(Math.random() * .7, Math.random() * Math.PI, Math.random() * .35);
    r.position.set(x, y + r.scale.y * .18, z);
    r.userData.terrainFollowOffset = r.position.y - groundY(x,z); terrainFollowers.push(r);
    r.castShadow = true;
    r.receiveShadow = true;
    scene.add(r);
  }

  // Irregular beach strip so the coastline never reads as a rectangular platform.
  const beachShape = new THREE.Shape();
  beachShape.moveTo(-43, 8.4);
  beachShape.bezierCurveTo(-25, 7.1, -10, 9.8, 4, 8.7);
  beachShape.bezierCurveTo(18, 7.4, 31, 10.2, 45, 9.0);
  beachShape.lineTo(48, 19.5);
  beachShape.bezierCurveTo(25, 17.0, 9, 18.8, -8, 17.2);
  beachShape.bezierCurveTo(-24, 15.8, -37, 18.5, -47, 16.0);
  beachShape.closePath();
  const beachGeo = new THREE.ShapeGeometry(beachShape, 48);
  beachGeo.rotateX(-Math.PI / 2);
  const beach = new THREE.Mesh(beachGeo, new THREE.MeshStandardMaterial({ color: 0xc88752, roughness: 1 }));
  beach.position.set(0, .08, 0);
  beach.receiveShadow = true;
  scene.add(beach);

  const waterGeo = new THREE.PlaneGeometry(170, 110, 70, 45);
  waterGeo.rotateX(-Math.PI / 2);
  const waterBase = Array.from(waterGeo.attributes.position.array);
  const water = new THREE.Mesh(waterGeo, new THREE.MeshPhysicalMaterial({
    color: 0x125878,
    roughness: .24,
    metalness: .05,
    transparent: true,
    opacity: .96,
    clearcoat: .62,
    clearcoatRoughness: .20
  }));
  const seaStateKey='maruatazo-v11-sea-state';
  const seaDefaults={level:-.10,waveHeight:1,waveSpeed:1};
  let seaState={...seaDefaults};
  try{const saved=JSON.parse(localStorage.getItem(seaStateKey)||'null');if(saved)seaState={...seaState,...saved};}catch(e){}
  water.position.set(0, seaState.level, 47);
  water.receiveShadow = true;
  scene.add(water);

  for (let j = 0; j < 5; j++) {
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(86, .10 + j*.025), new THREE.MeshBasicMaterial({ color: 0xffecd2, transparent: true, opacity: .42 - j*.045 }));
    foam.rotation.x = -Math.PI / 2;
    foam.rotation.z = -.018 + j*.006;
    foam.position.set(-2 + j*.8, .13, 14.4 + j * 1.25);
    scene.add(foam);
  }

  const clickable = [];
  const editable = [];
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6c4634, roughness: 1 });
  const leafMats = [0x174a35, 0x225f3a, 0x347145].map(c => new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: .94 }));
  function palm(x, z, s = .9) {
    const y = groundY(x, z);
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.10, .18, 2.7 * s, 6), trunkMat);
    trunk.position.y = 1.35 * s;
    trunk.rotation.z = (Math.random() - .5) * .13;
    g.add(trunk);
    const leafMat = leafMats[(Math.random() * leafMats.length) | 0];
    for (let k = 0; k < 7; k++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(.38 * s, 2.3 * s, 4), leafMat);
      leaf.scale.set(.38, 1, .12);
      leaf.rotation.z = Math.PI / 2;
      leaf.rotation.y = k * Math.PI * 2 / 7;
      leaf.position.y = 2.75 * s;
      g.add(leaf);
    }
    g.position.set(x, y, z);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g); terrainFollowers.push(g); return g;
  }
  for (let i = 0; i < 115; i++) {
    const x = -24 + Math.random() * 48, z = -23 + Math.random() * 29;
    if (z > 7 || Math.random() < .10) continue;
    palm(x, z, .55 + Math.random() * .75);
  }

  // Recognizable Maruata-style palapa cabin: raised base, porch, door, windows, posts and steep thatch roof.
  function hut(x, z, label, scale = 1) {
    const y = groundY(x, z);
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x6f4434, roughness: 1 });
    const woodLight = new THREE.MeshStandardMaterial({ color: 0x9a6546, roughness: 1 });
    const thatch = new THREE.MeshStandardMaterial({ color: 0xa66b3f, roughness: 1, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2c2521, roughness: 1 });
    const warmWindow = new THREE.MeshStandardMaterial({ color: 0xffbf6c, emissive: 0xe27032, emissiveIntensity: .35, roughness: .5 });

    // stilts
    [[-1,-.75],[1,-.75],[-1,.75],[1,.75]].forEach(([sx,sz]) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,.95*scale,6), wood);
      post.position.set(sx*scale,.47*scale,sz*scale); g.add(post);
    });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(2.5*scale,.22*scale,2.05*scale), woodLight);
    floor.position.y = 1.00*scale; g.add(floor);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.25*scale,1.45*scale,1.82*scale), wood);
    cabin.position.y = 1.77*scale; g.add(cabin);
    // front door + window
    const door = new THREE.Mesh(new THREE.BoxGeometry(.54*scale,1.12*scale,.04*scale), dark);
    door.position.set(-.45*scale,1.62*scale, .93*scale); g.add(door);
    const window = new THREE.Mesh(new THREE.BoxGeometry(.58*scale,.48*scale,.045*scale), warmWindow);
    window.position.set(.48*scale,1.90*scale,.935*scale); g.add(window);
    // porch
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.05*scale,.15*scale,1.15*scale), woodLight);
    deck.position.set(0,.98*scale,1.38*scale); g.add(deck);
    // porch rails
    [-1.35,1.35].forEach(px => { const rp=new THREE.Mesh(new THREE.CylinderGeometry(.04,.05,.82*scale,5),wood); rp.position.set(px*scale,1.36*scale,1.62*scale); g.add(rp); });
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.75*scale,.07*scale,.07*scale), woodLight);
    rail.position.set(0,1.58*scale,1.62*scale); g.add(rail);
    // stairs touching terrain
    for(let s=0;s<4;s++){
      const step=new THREE.Mesh(new THREE.BoxGeometry(.95*scale,.12*scale,.34*scale),woodLight);
      step.position.set(-.42*scale,(.77-s*.18)*scale,(2.00+s*.25)*scale);g.add(step);
    }
    // steep palapa roof + cap
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.12*scale,2.05*scale,8), thatch);
    roof.scale.z = .78; roof.rotation.y = Math.PI/8; roof.position.y = 3.05*scale; g.add(roof);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.22*scale,.58*scale,7), thatch);
    cap.position.y=4.28*scale; g.add(cap);

    // Cabin floor is level, but every visible support reaches the terrain independently.
    const platformY = y + 0.72 * scale;
    g.position.set(x, platformY, z);
    // Extra downhill foundation posts hide any gap on steep terrain and make the cabin read as built into the hillside.
    [[-1,-.75],[1,-.75],[-1,.75],[1,.75],[-1.35,1.38],[1.35,1.38]].forEach(([lx,lz]) => {
      const wx=x+lx*scale, wz=z+lz*scale, gy=groundY(wx,wz);
      const top=platformY + .08*scale; const len=Math.max(.18, top-gy);
      const fp=new THREE.Mesh(new THREE.CylinderGeometry(.065*scale,.095*scale,len,5),wood);
      fp.position.set(lx*scale, gy + len/2 - platformY, lz*scale); g.add(fp);
    });
    // Small warm porch lamp makes each cabin legible at sunset.
    const lamp=new THREE.PointLight(0xff8d45,.42,5.5); lamp.position.set(0,2.0*scale,1.45*scale); g.add(lamp);
    g.userData = { title: label, text: 'Cabaña de palma · baño privado · hospedaje · ubicación conceptual por ahora.', editable:true, kind:'cabin', groundOffset:0.72*scale };
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g); clickable.push(g); editable.push(g); return g;
  }
  [[-13,-8,'CABAÑA 01'],[-8,-11,'CABAÑA 02'],[-3,-9,'CABAÑA 03'],[4,-10,'CABAÑA 04'],[10,-7,'CABAÑA 05'],[14,-3,'CABAÑA 06']].forEach(a => hut(...a, .78));

  function register(g,title,text,isEditable=true,groundOffset=.02){
    g.userData={title,text,editable:isEditable,kind:'zone',groundOffset};
    g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
    scene.add(g); clickable.push(g); if(isEditable) editable.push(g); return g;
  }
  function stage(x,z){
    const y=groundY(x,z), g=new THREE.Group();
    const wood=new THREE.MeshStandardMaterial({color:0x51382d,roughness:1});
    const black=new THREE.MeshStandardMaterial({color:0x171719,roughness:.82});
    const deck=new THREE.Mesh(new THREE.BoxGeometry(6,.35,3.7),wood); deck.position.y=.2; g.add(deck);
    for(const sx of [-2.6,2.6]) for(const sz of [-1.5,1.5]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,3.5,6),wood);p.position.set(sx,1.8,sz);g.add(p)}
    const canopy=new THREE.Mesh(new THREE.ConeGeometry(3.8,1.25,4),new THREE.MeshStandardMaterial({color:0xb66b43,roughness:1,flatShading:true}));canopy.rotation.y=Math.PI/4;canopy.scale.z=.68;canopy.position.y=3.65;g.add(canopy);
    const booth=new THREE.Mesh(new THREE.BoxGeometry(2.8,.9,.9),black);booth.position.set(0,.95,.25);g.add(booth);
    for(const sx of [-1.8,1.8]){const sp=new THREE.Mesh(new THREE.BoxGeometry(.65,1.35,.65),black);sp.position.set(sx,1.15,-.45);g.add(sp)}
    const amber=new THREE.PointLight(0xff6a36,1.5,11);amber.position.set(0,2.7,0);g.add(amber);
    g.position.set(x,y+.03,z); return register(g,'TERRAZA / ESCENARIO','Escenario principal frente al Pacífico · lineup y horarios aquí.');
  }
  function camping(x,z){
    const y=groundY(x,z),g=new THREE.Group();
    const cols=[0xd98b42,0x6e7d48,0xb95b49,0xd6b260];
    [[-1.5,0],[0,1.1],[1.5,-.15],[-.2,-1.15]].forEach((q,i)=>{const tent=new THREE.Mesh(new THREE.ConeGeometry(.85,1.25,4),new THREE.MeshStandardMaterial({color:cols[i],roughness:1,flatShading:true}));tent.rotation.y=Math.PI/4;tent.position.set(q[0],.62,q[1]);g.add(tent)});
    const fire=new THREE.PointLight(0xff6b2e,1.1,7);fire.position.set(0,.7,0);g.add(fire);
    g.position.set(x,y+.02,z); return register(g,'CAMPING','Zona de camping · cupo y selección próximamente.');
  }
  function lookout(x,z){
    const y=groundY(x,z),g=new THREE.Group(),wood=new THREE.MeshStandardMaterial({color:0x69462f,roughness:1});
    const deck=new THREE.Mesh(new THREE.BoxGeometry(4.5,.25,2.6),wood);deck.position.y=.15;g.add(deck);
    for(const sx of [-2,2]) for(const sz of [-1.05,1.05]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,1.1,5),wood);p.position.set(sx,.65,sz);g.add(p)}
    const rail=new THREE.Mesh(new THREE.BoxGeometry(4.3,.08,.08),wood);rail.position.set(0,1.05,-1.05);g.add(rail);
    g.position.set(x,y+.02,z); return register(g,'MIRADOR','Mirador panorámico de Maruata y del evento.');
  }
  function beachMarker(x,z){
    const y=.17,g=new THREE.Group();
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.04,.05,1.8,6),new THREE.MeshStandardMaterial({color:0x60442f}));pole.position.y=.9;g.add(pole);
    const cloth=new THREE.Mesh(new THREE.ConeGeometry(1.25,.42,16),new THREE.MeshStandardMaterial({color:0xd57a48,roughness:1}));cloth.rotation.x=Math.PI;cloth.position.y=1.75;g.add(cloth);
    g.position.set(x,y,z); return register(g,'PLAYA','Acceso a playa · revisa las zonas seguras para nadar.');
  }
  camping(-15,1); stage(1,1); beachMarker(12,15.2); lookout(0,-15);


  // Grounded path follows the same world-coordinate terrain function.
  const pathPts = [[-18,-13],[-8,-10],[0,-7],[8,-2],[13,3]].map(([x,z]) => new THREE.Vector3(x,groundY(x,z)+.06,z));
  const curve = new THREE.CatmullRomCurve3(pathPts);
  const path = new THREE.Mesh(new THREE.TubeGeometry(curve,70,.16,6,false), new THREE.MeshStandardMaterial({color:0xc49a5a,roughness:1}));
  path.receiveShadow=true; scene.add(path);


  // --- V11 world builder: objects + terrain sculpt + material paint -----------------
  const layoutKey = 'maruatazo-v11-layout';
  let uidCounter=1;
  function objectId(o){ return o.userData.uid || o.userData.title || ('obj-'+editable.indexOf(o)); }
  function applyGround(o){
    const off=Number.isFinite(o.userData.groundOffset)?o.userData.groundOffset:.02;
    o.position.y=groundY(o.position.x,o.position.z)+off;
  }
  function makeAddedEditable(g,kind,title,groundOffset=0){
    g.userData={...(g.userData||{}),title,text:title+' · objeto colocado en el editor.',editable:true,kind,groundOffset,uid:'added-'+(uidCounter++),added:true};
    if(!clickable.includes(g))clickable.push(g); if(!editable.includes(g))editable.push(g); return g;
  }
  function editablePalm(x,z,title){const g=palm(x,z,.9); return makeAddedEditable(g,'palm',title||'PALMERA',0);}
  function editableRock(x,z,title){
    const m=new THREE.MeshStandardMaterial({color:0x75645d,roughness:1,flatShading:true});
    const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(1.15,1),m); mesh.scale.set(1.25,1.0,.95); mesh.castShadow=mesh.receiveShadow=true;
    const g=new THREE.Group();g.add(mesh);g.position.set(x,groundY(x,z)+.7,z);scene.add(g);return makeAddedEditable(g,'rock',title||'ROCA',.7);
  }
  function editableTent(x,z,title){
    const g=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:0xb96d4e,roughness:1,flatShading:true});
    const tent=new THREE.Mesh(new THREE.ConeGeometry(1.05,1.55,4),mat);tent.rotation.y=Math.PI/4;tent.position.y=.78;g.add(tent);g.position.set(x,groundY(x,z)+.02,z);scene.add(g);return makeAddedEditable(g,'tent',title||'CAMPING',.02);
  }
  function addObject(kind,x,z,title){
    if(kind==='cabin'){const g=hut(x,z,title||('CABAÑA '+String(editable.filter(o=>o.userData.kind==='cabin').length+1).padStart(2,'0')),.78);g.userData.uid='added-'+(uidCounter++);g.userData.added=true;return g;}
    if(kind==='palm')return editablePalm(x,z,title);
    if(kind==='rock')return editableRock(x,z,title);
    if(kind==='tent')return editableTent(x,z,title);
    if(kind==='stage'){const g=stage(x,z);g.userData.uid='added-'+(uidCounter++);g.userData.added=true;g.userData.kind='stage';return g;}
    return null;
  }
  // Give seed objects stable IDs so saves survive title changes.
  editable.forEach((o,i)=>{if(!o.userData.uid)o.userData.uid='seed-'+i;});
  const seedObjects=editable.slice();
  const seedLayout={};
  seedObjects.forEach(o=>seedLayout[objectId(o)]={x:o.position.x,z:o.position.z,ry:o.rotation.y,off:o.userData.groundOffset||0});
  function saveLayout(){
    const data=editable.map(o=>({uid:objectId(o),title:o.userData.title,kind:o.userData.kind,x:o.position.x,z:o.position.z,ry:o.rotation.y,off:o.userData.groundOffset||0,scale:o.scale.x||1,added:!!o.userData.added}));
    try{localStorage.setItem(layoutKey,JSON.stringify(data));}catch(e){}
  }
  function loadLayout(){
    try{
      const data=JSON.parse(localStorage.getItem(layoutKey)||'[]'); if(!Array.isArray(data))return;
      data.filter(d=>d.added).forEach(d=>{const o=addObject(d.kind,d.x,d.z,d.title);if(o){o.userData.uid=d.uid;o.userData.added=true;uidCounter=Math.max(uidCounter,parseInt(String(d.uid).split('-').pop())+1||uidCounter);}});
      data.forEach(d=>{const o=editable.find(x=>objectId(x)===d.uid);if(!o)return;o.position.x=d.x;o.position.z=d.z;o.rotation.y=d.ry||0;o.userData.groundOffset=Number.isFinite(d.off)?d.off:o.userData.groundOffset;const sc=Number.isFinite(d.scale)?d.scale:1;o.scale.setScalar(sc);applyGround(o)});
    }catch(e){}
  }
  loadLayout();

  const editBtn=document.getElementById('editWorld'), editorPanel=document.getElementById('editorPanel'), editorSelected=document.getElementById('editorSelected');
  let editorMode=false, selected=null, dragging=false, sculpting=false, editorTool='raise', flattenTarget=0;
  const ray=new THREE.Raycaster(), mouse=new THREE.Vector2(), card=document.getElementById('placecard');
  let down={x:0,y:0};
  const dragPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0), dragPoint=new THREE.Vector3();
  const selectRing=new THREE.Mesh(new THREE.RingGeometry(1.7,1.95,32),new THREE.MeshBasicMaterial({color:0xffc85a,transparent:true,opacity:.9,side:THREE.DoubleSide,depthTest:false}));
  selectRing.rotation.x=-Math.PI/2;selectRing.visible=false;selectRing.renderOrder=11;scene.add(selectRing);
  const brushRing=new THREE.Mesh(new THREE.RingGeometry(.92,1,48),new THREE.MeshBasicMaterial({color:0x9af3df,transparent:true,opacity:.9,side:THREE.DoubleSide,depthTest:false}));
  brushRing.rotation.x=-Math.PI/2;brushRing.visible=false;brushRing.renderOrder=12;scene.add(brushRing);

  function pointerRay(e){const r=canvas.getBoundingClientRect();mouse.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(mouse,camera);}
  function terrainHit(e){pointerRay(e);const h=ray.intersectObject(terrain,false);return h[0]||null;}
  function rootFromHit(hit){let o=hit;while(o.parent&&!o.userData.title)o=o.parent;return o.userData.title?o:null;}
  function syncRing(){if(!selected){selectRing.visible=false;return;}selectRing.visible=true;selectRing.position.set(selected.position.x,groundY(selected.position.x,selected.position.z)+.10,selected.position.z);}
  function setSelected(o){selected=o||null;editorSelected.textContent=selected?(selected.userData.title||objectId(selected)):'NINGUNA';syncRing();}
  function isTerrainTool(t){return ['raise','lower','smooth','flatten','paint-sand','paint-grass','paint-rock','paint-dirt'].includes(t);}
  function isAddTool(t){return t.startsWith('add-');}
  function setTool(t){editorTool=t;document.querySelectorAll('[data-editor-tool]').forEach(b=>b.classList.toggle('active',b.dataset.editorTool===t));brushRing.visible=editorMode&&isTerrainTool(t);}
  function brushRadius(){return parseFloat(document.getElementById('brushRadius')?.value||4.5)}
  function brushStrength(){return parseFloat(document.getElementById('brushStrength')?.value||.24)}
  function gridWorld(ix,iz){return {x:-TERRAIN_W/2+(ix/(EDIT_NX-1))*TERRAIN_W,z:TERRAIN_Z-TERRAIN_D/2+(iz/(EDIT_NZ-1))*TERRAIN_D};}
  function applyTerrainBrush(point){
    const radius=brushRadius(), strength=brushStrength(), {u,v}=gridCoord(point.x,point.z);
    const rx=radius/TERRAIN_W*(EDIT_NX-1), rz=radius/TERRAIN_D*(EDIT_NZ-1);
    const minx=Math.max(0,Math.floor(u-rx-1)),maxx=Math.min(EDIT_NX-1,Math.ceil(u+rx+1)),minz=Math.max(0,Math.floor(v-rz-1)),maxz=Math.min(EDIT_NZ-1,Math.ceil(v+rz+1));
    const snapshot=editorTool==='smooth'?terrainHeights.slice():null;
    for(let iz=minz;iz<=maxz;iz++)for(let ix=minx;ix<=maxx;ix++){
      const w=gridWorld(ix,iz),dist=Math.hypot(w.x-point.x,w.z-point.z);if(dist>radius)continue;
      const fall=Math.pow(1-dist/radius,1.65),idx=iz*EDIT_NX+ix;
      if(editorTool==='raise')terrainHeights[idx]+=strength*.16*fall;
      else if(editorTool==='lower')terrainHeights[idx]-=strength*.16*fall;
      else if(editorTool==='flatten'){
        const target=flattenTarget-heightLocal(w.x,w.z-TERRAIN_Z);terrainHeights[idx]=THREE.MathUtils.lerp(terrainHeights[idx],target,Math.min(.55,strength*.28*fall));
      } else if(editorTool==='smooth'){
        let sum=0,n=0;for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const xx=THREE.MathUtils.clamp(ix+dx,0,EDIT_NX-1),zz=THREE.MathUtils.clamp(iz+dz,0,EDIT_NZ-1);sum+=snapshot[zz*EDIT_NX+xx];n++;}
        terrainHeights[idx]=THREE.MathUtils.lerp(snapshot[idx],sum/n,Math.min(.75,strength*.55*fall));
      } else if(editorTool.startsWith('paint-')&&fall>.12){terrainPaint[idx]={sand:1,grass:2,rock:3,dirt:4}[editorTool.slice(6)]||0;}
    }
    updateTerrainGeometry();editable.forEach(applyGround);terrainFollowers.forEach(o=>{if(o.userData&&o.userData.editable)return;const off=Number.isFinite(o.userData?.terrainFollowOffset)?o.userData.terrainFollowOffset:0;o.position.y=groundY(o.position.x,o.position.z)+off;});syncRing();brushRing.position.set(point.x,groundY(point.x,point.z)+.08,point.z);brushRing.scale.set(radius,radius,radius);
  }
  function deleteSelected(){if(!selected||!selected.userData.added)return;scene.remove(selected);let i=editable.indexOf(selected);if(i>=0)editable.splice(i,1);i=clickable.indexOf(selected);if(i>=0)clickable.splice(i,1);setSelected(null);saveLayout();}
  function setEditor(on){editorMode=on;host.classList.toggle('editing',on);editBtn.classList.toggle('active',on);editorPanel.classList.toggle('show',on);editBtn.textContent=on?'TERMINAR EDICIÓN ✓':'EDITAR MAPA ✎';brushRing.visible=on&&isTerrainTool(editorTool);if(!on){dragging=sculpting=false;controls.enabled=true;setSelected(null);brushRing.visible=false;}}
  editBtn.onclick=()=>setEditor(!editorMode);document.getElementById('closeEditor').onclick=()=>setEditor(false);

  document.querySelectorAll('[data-editor-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-editor-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('[data-editor-pane]').forEach(p=>p.classList.toggle('active',p.dataset.editorPane===b.dataset.editorTab));});
  document.querySelectorAll('[data-editor-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.editorTool));
  const br=document.getElementById('brushRadius'),bs=document.getElementById('brushStrength');
  function syncRanges(){document.getElementById('brushRadiusOut').textContent=(+br.value).toFixed(1)+' m';document.getElementById('brushStrengthOut').textContent=(+bs.value).toFixed(2);}
  br?.addEventListener('input',syncRanges);bs?.addEventListener('input',syncRanges);syncRanges();

  const seaLevelEl=document.getElementById('seaLevel'),waveHeightEl=document.getElementById('waveHeight'),waveSpeedEl=document.getElementById('waveSpeed');
  function applySeaState(){
    water.position.y=seaState.level;
    if(seaLevelEl)seaLevelEl.value=seaState.level;
    if(waveHeightEl)waveHeightEl.value=seaState.waveHeight;
    if(waveSpeedEl)waveSpeedEl.value=seaState.waveSpeed;
    document.getElementById('seaLevelOut').textContent=Number(seaState.level).toFixed(2)+' m';
    document.getElementById('waveHeightOut').textContent=Number(seaState.waveHeight).toFixed(2)+'×';
    document.getElementById('waveSpeedOut').textContent=Number(seaState.waveSpeed).toFixed(2)+'×';
  }
  function readSeaControls(save=false){
    seaState.level=parseFloat(seaLevelEl?.value??seaState.level);
    seaState.waveHeight=parseFloat(waveHeightEl?.value??seaState.waveHeight);
    seaState.waveSpeed=parseFloat(waveSpeedEl?.value??seaState.waveSpeed);
    applySeaState();
    if(save)localStorage.setItem(seaStateKey,JSON.stringify(seaState));
  }
  seaLevelEl?.addEventListener('input',()=>readSeaControls(false));
  waveHeightEl?.addEventListener('input',()=>readSeaControls(false));
  waveSpeedEl?.addEventListener('input',()=>readSeaControls(false));
  document.getElementById('saveSea').onclick=()=>{readSeaControls(true);document.getElementById('seaLevelOut').textContent=Number(seaState.level).toFixed(2)+' m · GUARDADO';};
  document.getElementById('resetSea').onclick=()=>{seaState={...seaDefaults};localStorage.removeItem(seaStateKey);applySeaState();};
  applySeaState();
  document.getElementById('rotLeft').onclick=()=>{if(selected){selected.rotation.y-=Math.PI/12;saveLayout();}};
  document.getElementById('rotRight').onclick=()=>{if(selected){selected.rotation.y+=Math.PI/12;saveLayout();}};
  document.getElementById('raiseObj').onclick=()=>{if(selected){selected.userData.groundOffset=(selected.userData.groundOffset||0)+.12;applyGround(selected);syncRing();saveLayout();}};
  document.getElementById('lowerObj').onclick=()=>{if(selected){selected.userData.groundOffset=(selected.userData.groundOffset||0)-.12;applyGround(selected);syncRing();saveLayout();}};
  document.getElementById('scaleUpObj').onclick=()=>{if(selected){selected.scale.multiplyScalar(1.08);saveLayout();}};
  document.getElementById('scaleDownObj').onclick=()=>{if(selected){selected.scale.multiplyScalar(.92);saveLayout();}};
  document.getElementById('deleteObj').onclick=deleteSelected;
  document.getElementById('saveLayout').onclick=()=>{saveLayout();editorSelected.textContent=(selected?selected.userData.title:'MAPA')+' · GUARDADO';};
  document.getElementById('saveTerrain').onclick=()=>{saveTerrainState();editorSelected.textContent='TERRENO · GUARDADO';};
  document.getElementById('resetTerrain').onclick=()=>{terrainHeights.fill(0);terrainPaint.fill(0);localStorage.removeItem(terrainStateKey);updateTerrainGeometry();editable.forEach(applyGround);terrainFollowers.forEach(o=>{if(o.userData&&o.userData.editable)return;const off=Number.isFinite(o.userData?.terrainFollowOffset)?o.userData.terrainFollowOffset:0;o.position.y=groundY(o.position.x,o.position.z)+off;});};
  document.getElementById('resetLayout').onclick=()=>{
    localStorage.removeItem(layoutKey);editable.filter(o=>o.userData.added).slice().forEach(o=>{scene.remove(o);editable.splice(editable.indexOf(o),1);const k=clickable.indexOf(o);if(k>=0)clickable.splice(k,1)});
    seedObjects.forEach(o=>{const d=seedLayout[objectId(o)];if(!d)return;o.position.x=d.x;o.position.z=d.z;o.rotation.y=d.ry;o.userData.groundOffset=d.off;applyGround(o)});setSelected(null);
  };

  canvas.addEventListener('pointerdown',e=>{
    down={x:e.clientX,y:e.clientY};if(!editorMode)return;
    if(isTerrainTool(editorTool)){const hit=terrainHit(e);if(!hit)return;sculpting=true;controls.enabled=false;flattenTarget=groundY(hit.point.x,hit.point.z);applyTerrainBrush(hit.point);canvas.setPointerCapture?.(e.pointerId);return;}
    if(isAddTool(editorTool)){const hit=terrainHit(e);if(!hit)return;const kind=editorTool.replace('add-','');const o=addObject(kind,hit.point.x,hit.point.z);if(o){setSelected(o);saveLayout();setTool('move');}return;}
    pointerRay(e);const hits=ray.intersectObjects(editable,true);if(!hits.length){setSelected(null);return;}const o=rootFromHit(hits[0].object);if(!o||!o.userData.editable)return;setSelected(o);dragging=true;controls.enabled=false;canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!editorMode)return;
    if(isTerrainTool(editorTool)){const hit=terrainHit(e);if(hit){brushRing.visible=true;brushRing.position.set(hit.point.x,groundY(hit.point.x,hit.point.z)+.08,hit.point.z);const r=brushRadius();brushRing.scale.set(r,r,r);if(sculpting)applyTerrainBrush(hit.point);}return;}
    if(!dragging||!selected)return;pointerRay(e);dragPlane.constant=0;if(ray.ray.intersectPlane(dragPlane,dragPoint)){selected.position.x=THREE.MathUtils.clamp(dragPoint.x,-45,45);selected.position.z=THREE.MathUtils.clamp(dragPoint.z,-38,17);applyGround(selected);syncRing();}
  });
  canvas.addEventListener('pointerup',e=>{
    if(editorMode&&sculpting){sculpting=false;controls.enabled=true;saveTerrainState();canvas.releasePointerCapture?.(e.pointerId);return;}
    if(editorMode&&dragging){dragging=false;controls.enabled=true;saveLayout();canvas.releasePointerCapture?.(e.pointerId);return;}
    if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>5||editorMode)return;
    pointerRay(e);const hits=ray.intersectObjects(clickable,true);if(!hits.length){card.classList.remove('show');return;}const o=rootFromHit(hits[0].object);if(!o)return;document.getElementById('placeTitle').textContent=o.userData.title;document.getElementById('placeText').textContent=o.userData.text;card.classList.add('show');controls.target.copy(o.position);controls.target.y+=1.5;
  });
  canvas.addEventListener('pointerleave',()=>{if(editorMode&&!sculpting)brushRing.visible=false;});

  document.getElementById('resetWorld').onclick=()=>{camera.position.set(31,22,34);controls.target.set(0,3,-5);card.classList.remove('show')};
  function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(host); resize();

  let t=0;
  function loop(){
    requestAnimationFrame(loop); t+=.018;
    const wp=waterGeo.attributes.position;
    const wt=t*seaState.waveSpeed, wh=seaState.waveHeight;
    for(let i=0;i<wp.count;i++) wp.setY(i,waterBase[i*3+1]+(Math.sin(waterBase[i*3]*.22+wt)*.09+Math.cos(waterBase[i*3+2]*.27+wt*1.2)*.07)*wh);
    wp.needsUpdate=true; waterGeo.computeVertexNormals();
    sunDisc.lookAt(camera.position);
    controls.update(); if(selected) syncRing(); renderer.render(scene,camera);
  }
  loop();
})();
