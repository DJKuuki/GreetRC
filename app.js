import {paintHelicopter, prepareRotors} from './aircraft.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const $ = id => document.getElementById(id);
const requestedModel = new URLSearchParams(location.search).get('model');
const versions = ['custom', 'original', 'fixed-wing', 'helicopter'];
const modelNames = ['白蓝配色 · 双图传天线', '原始模型', '固定翼 · 运动涂装', '直升机 · 运动涂鸦'];
const modelFiles = ['fpv-drone3-v3-white-blue.glb', 'fpv-drone3-v3.glb', 'fixed-wing-sport.glb', 'helicopter.glb'];
let modelVersion = versions.includes(requestedModel) ? requestedModel : 'custom';
let originalModel, fixedWing, helicopter, switching = false, resizePending = false;
const droneDefinitions = {
  Sketchfab_model: ['机架', '承载所有部件的结构骨架。碳纤维板和连接柱共同提供刚性，并保护内部电子设备。'],
  motor1: ['电机 1', '无刷电机带动螺旋桨转动，将电能转化为推力。四个电机的转速差控制飞行姿态。'],
  motor2: ['电机 2', '四个动力单元之一。电调根据飞控指令改变电机转速，与其他电机共同控制姿态。'],
  motor3: ['电机 3', '四个动力单元之一。相邻螺旋桨通常采用相反旋转方向，以抵消反作用扭矩。'],
  motor4: ['电机 4', '四个动力单元之一。电机、桨叶和电池的匹配影响推力、效率与飞行手感。'],
  esc: ['电调 ESC', '将电池直流电转换为驱动无刷电机的三相电流，并执行飞控发来的转速指令。'],
  fc: ['飞控', '穿越机的控制核心。读取陀螺仪和遥控输入，计算姿态修正，再向电调发送指令。'],
  battery: ['电池', '为动力系统、飞控和图传提供电能。容量、电压与放电能力共同决定动力和续航表现。'],
  cam: ['摄像头', '捕捉机头方向的实时画面，通过图传发送给飞行眼镜，提供第一人称视角。'],
  vtx: ['图传', '接收摄像头画面并无线发送至地面接收设备。此模型展示了 DJI O4 图传部件。'],
  wireless: ['图传天线', '负责发射图传射频信号。安装位置和天线方向会影响信号覆盖。'],
  'wireless-extra': ['新增图传天线', '机尾右侧外展天线，通过金色接头连接到重构的黑色双天线座。天线可独立拆解，安装座随机架保留。'],
  'receiver-ic': ['接收机', '接收遥控器发送的控制信号，将摇杆和开关指令传递给飞控。'],
  'receiver-wireless': ['接收机天线', '接收遥控链路的无线信号，是遥控器与机上接收机之间的重要连接。'],
};
let definitions;
function configureModel(version) {
  modelVersion = version;
  originalModel = version === 'original'; fixedWing = version === 'fixed-wing'; helicopter = version === 'helicopter';
  definitions = {...droneDefinitions};
  if (originalModel) delete definitions['wireless-extra'];
  if (fixedWing) definitions = {'fixed-wing': ['运动固定翼', '白色底色搭配蓝青色翼面和橙色竞速条纹。拖动旋转，可从不同角度查看机翼、机身与涂装。']};
  if (helicopter) definitions = {helicopter: ['涂鸦运动直升机', '左右对称的青蓝、玫红与荧光黄竞速涂装，配以 GREET 标识、07 号赛车编号及局部喷溅纹理。石墨色桨叶与银白起落架保持纯色。']};
  $('model-version').textContent = modelNames[versions.indexOf(version)];
  $('model-index').textContent = `${String(versions.indexOf(version)+1).padStart(2,'0')} / 04`;
  document.querySelector('.subtitle').textContent = helicopter ? '让色彩起飞。探索运动涂鸦直升机。' : fixedWing ? '舒展双翼，探索飞行。旋转查看你的运动固定翼。' : '从一颗螺丝，到一整片天空。拆开看看你的穿越机。';
  $('explode').hidden = fixedWing || helicopter;
  document.querySelector('.toolbar .divider').hidden = fixedWing || helicopter;
  document.querySelector('.parts-heading h2').textContent = helicopter ? '认识这架直升机' : fixedWing ? '认识这架固定翼' : '认识每一个部件';
  $('parts-count').textContent = fixedWing || helicopter ? '整体模型 / 点击查看' : `${Object.keys(definitions).length} COMPONENTS / 点击查看`;
  $('viewer').setAttribute('aria-label', `可交互的${helicopter ? '直升机' : fixedWing ? '固定翼' : '穿越机'}三维模型`);
}
configureModel(modelVersion);
// Local offsets match the reference site's layout. World coordinates are converted below.
const plan = {
  'fixed-wing': [0,0,0], helicopter: [0,0,0],
  vtx: [180,120,30], cam: [180,100,0], wireless: [0,40,0], battery: [80,120,0],
  'wireless-extra': [-70,75,10],
  'receiver-wireless': {worldOffset:[280,80,0]}, 'receiver-ic': {worldPosition:[280,94,-35]},
  motor1:[40,0,80], motor2:[-40,0,80], motor3:[-40,0,-80], motor4:[40,0,-80],
  esc:[-100,80,0], fc:[-180,80,0], Sketchfab_model:[0,0,0],
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let model, renderer, camera, controls, scene, parts = [], meshes = [], tween = null, rotors = [], rotorSpeed = 0, flight = null;
let expanded = false, ready = false, selected = null, hover = null, overview;
let visible = true, raf = null, lastTime = 0, down = null;
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
const box = new THREE.Box3(), center = new THREE.Vector3();

function selectPart(part) {
  selected = part;
  $('detail').hidden = !part;
  for (const button of $('parts').children) button.setAttribute('aria-pressed', String(button.dataset.part === part?.name));
  if (!part) return;
  $('part-title').textContent = definitions[part.name][0];
  $('part-description').textContent = definitions[part.name][1];
}
function syncRotate() {
  $('rotate').textContent = controls.autoRotate ? '暂停旋转' : '自动旋转';
  $('rotate').setAttribute('aria-pressed', String(controls.autoRotate));
}
function poseForBounds(bounds, top = false) {
  const target = bounds.getCenter(new THREE.Vector3());
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const direction = top ? new THREE.Vector3(0,1,.015) : (fixedWing ? new THREE.Vector3(1.15,1.8,1.45) : new THREE.Vector3(1.8,1,1.65)).normalize();
  direction.normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction,right).normalize();
  let distance = 0;
  // Fit all eight corners in camera space, with room above the bottom toolbar.
  for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) {
    const corner = new THREE.Vector3(x,y,z).sub(target);
    const depth = corner.dot(direction);
    distance = Math.max(distance, depth + Math.abs(corner.dot(right))/(Math.tan(vFov/2)*camera.aspect*.83), depth + Math.abs(corner.dot(up))/(Math.tan(vFov/2)*.66));
  }
  return {target, position: target.clone().addScaledVector(direction, distance)};
}
function transition(toExpanded, reset = false) {
  if (!ready || switching) return;
  expanded = toExpanded;
  hover = null; $('tooltip').hidden = true;
  controls.autoRotate = !toExpanded && !reducedMotion; syncRotate();
  const from = parts.map(p => p.node.position.clone());
  const destination = parts.map(p => (toExpanded ? p.target : p.origin).clone());
  // Compute the complete destination bounding box before moving the camera.
  parts.forEach((p,i) => p.node.position.copy(destination[i]));
  model.updateMatrixWorld(true);
  const goal = toExpanded ? poseForBounds(new THREE.Box3().setFromObject(model), true) : overview;
  parts.forEach((p,i) => p.node.position.copy(from[i]));
  model.updateMatrixWorld(true);
  tween = {start:performance.now(), duration:reducedMotion ? 0 : 800, from, destination,
    cameraFrom:camera.position.clone(), targetFrom:controls.target.clone(), goal};
  controls.enabled = false;
  $('explode').textContent = toExpanded ? '↙ 组装模型' : '↗ 拆解模型';
  $('view-state').textContent = toExpanded ? '部件拆解视图' : '整机视图';
  if (reset) selectPart(null);
}
function hit(event) {
  if (!ready || tween || switching) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  const mesh = raycaster.intersectObjects(meshes,false)[0]?.object;
  return mesh?.userData.part || null;
}
function resize() {
  if(switching)resizePending=true;
  const rect = $('canvas-wrap').getBoundingClientRect();
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix(); renderer.setSize(rect.width, rect.height);
  if (ready && !switching) {
    // Keep the assembled reference pose valid for the new aspect ratio.
    const current = parts.map(p=>p.node.position.clone());
    parts.forEach(p=>p.node.position.copy(p.origin)); model.updateMatrixWorld(true);
    overview = poseForBounds(new THREE.Box3().setFromObject(model));
    parts.forEach((p,i)=>p.node.position.copy(current[i])); model.updateMatrixWorld(true);
    transition(expanded);
  }
}
function frame(now) {
  raf = null;
  if (!visible || document.hidden) return;
  const delta = Math.min((now-lastTime)/1000,.05); lastTime = now;
  if (tween) {
    const t = tween.duration ? Math.min(1,(now-tween.start)/tween.duration) : 1;
    const ease = t < .5 ? 2*t*t : 1-(-2*t+2)**2/2;
    parts.forEach((p,i)=>p.node.position.lerpVectors(tween.from[i],tween.destination[i],ease));
    camera.position.lerpVectors(tween.cameraFrom,tween.goal.position,ease);
    controls.target.lerpVectors(tween.targetFrom,tween.goal.target,ease);
    if (t===1) { tween = null; controls.enabled = true; }
  }
  rotorSpeed=THREE.MathUtils.damp(rotorSpeed,flight&&!reducedMotion?14:0,5,delta);
  if(rotorSpeed>.01)for(const rotor of rotors)rotor.node.rotateOnAxis(rotor.axis,rotorSpeed*delta*rotor.direction);
  if(flight){
    if(rotorSpeed>.01)for(const rotor of flight.rotors)rotor.node.rotateOnAxis(rotor.axis,rotorSpeed*delta*rotor.direction);
    updateFlight(now);
  }
  controls.update(delta);
  if (hover) {
    box.setFromObject(hover.node); box.getCenter(center); center.y += box.getSize(new THREE.Vector3()).y*.55;
    center.project(camera);
    $('tooltip').style.left = `${(center.x*.5+.5)*$('canvas-wrap').clientWidth}px`;
    $('tooltip').style.top = `${(-center.y*.5+.5)*$('canvas-wrap').clientHeight}px`;
    $('tooltip').hidden = center.z < -1 || center.z > 1;
  }
  if(flight){
    const tone=renderer.toneMapping;
    renderer.toneMapping=flight.toneMapping;renderer.render(flight.scene,flight.camera);
    renderer.toneMapping=tone;renderer.autoClear=false;renderer.clearDepth();renderer.render(scene,camera);renderer.autoClear=true;
  }else renderer.render(scene,camera);
  raf = requestAnimationFrame(frame);
}
function resume() { if (!raf && visible && !document.hidden) { lastTime=performance.now(); raf=requestAnimationFrame(frame); } }
async function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45,1,.1,10000);
  renderer = new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0,0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (!originalModel) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .9;
  }
  renderer.domElement.setAttribute('aria-label',`${fixedWing ? '固定翼' : '穿越机'}三维视图，拖动旋转，滚轮缩放`);
  $('canvas-wrap').appendChild(renderer.domElement);
  scene.add(new THREE.AmbientLight(0xffffff,originalModel ? 5 : 1.2));
  for (const [x,y,z,intensity] of [[50,100,50,4],[-50,30,20,3],[0,50,-50,.8],[-50,160,-50,1.5],[50,160,-50,1.5]]) {
    const light = new THREE.DirectionalLight(0xffffff,intensity * (originalModel ? 1 : .55)); light.userData.baseIntensity=intensity; light.position.set(x,y,z); scene.add(light);
  }
  controls = new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true; controls.dampingFactor=.05; controls.enablePan=false;
  controls.autoRotate=!reducedMotion; controls.autoRotateSpeed=1.1; syncRotate();
  resize(); new ResizeObserver(resize).observe($('canvas-wrap'));
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;resume();}).observe($('viewer'));
  document.addEventListener('visibilitychange',resume);
  renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
  renderer.domElement.addEventListener('pointermove',e=>{
    hover=hit(e); $('tooltip').hidden=!hover;
    renderer.domElement.style.cursor=hover?'pointer':'grab';
    if(hover) $('tooltip').textContent=definitions[hover.name][0];
  });
  renderer.domElement.addEventListener('pointerleave',()=>{hover=null;$('tooltip').hidden=true;});
  renderer.domElement.addEventListener('click',e=>{
    if(down && Math.hypot(e.clientX-down.x,e.clientY-down.y)>5) return;
    selectPart(hit(e));
  });
  resume();
  installModel(await loadModel(modelVersion));
  $('model-prev').addEventListener('click',()=>switchModel(-1));
  $('model-next').addEventListener('click',()=>switchModel(1));
  $('viewer').addEventListener('keydown',event=>{
    if (!['ArrowLeft','ArrowRight'].includes(event.key) || event.target.closest('input,select,textarea')) return;
    event.preventDefault(); switchModel(event.key === 'ArrowRight' ? 1 : -1);
  });
  window.addEventListener('popstate',()=>{
    const version = new URLSearchParams(location.search).get('model') || 'custom';
    if (versions.includes(version)) switchModel(1, version, false);
  });
  $('explode').addEventListener('click',()=>transition(!expanded));
  $('rotate').addEventListener('click',()=>{controls.autoRotate=!controls.autoRotate;syncRotate();});
  $('reset').addEventListener('click',()=>transition(false,true));
  $('close-detail').addEventListener('click',()=>selectPart(null));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')selectPart(null);});
  window.fpvDiagnostics=()=>({ready,modelVersion,switching,expanded,orientation:model.quaternion.toArray(),flight:flight?{elapsed:flight.elapsed,direction:flight.direction,outgoingX:flight.outgoingX,incomingX:flight.incomingX,outgoingOrientation:flight.outgoing.object.quaternion.toArray(),incomingOrientation:model.quaternion.toArray(),outgoingVersion:flight.version}:null,rotorSpeed,rotors:rotors.map(r=>({name:r.mesh.name,axis:r.axis.toArray(),angle:r.node.quaternion.toArray(),pivot:r.node.position.toArray()})),animating:!!tween||switching,parts:parts.map(p=>({name:p.name,position:p.node.position.toArray(),origin:p.origin.toArray()})),camera:camera.position.toArray(),selected:selected?.name??null});
}
async function loadModel(version) {
  const draco = new DRACOLoader(); draco.setDecoderPath('./vendor/draco/');
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  try { return await loader.loadAsync('./assets/'+modelFiles[versions.indexOf(version)]); }
  finally { draco.dispose(); }
}
function disposeModel(root) {
  const resources = new Set();
  root.traverse(node=>{if(node.isMesh){resources.add(node.geometry);for(const material of [].concat(node.material)){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}}});
  resources.forEach(resource=>resource.dispose());
}
function flightPose(object,view,version,direction){
  object.updateMatrixWorld(true);view.updateMatrixWorld(true);
  const center=new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
  const right=new THREE.Vector3().setFromMatrixColumn(view.matrixWorld,0).normalize();
  const heading=right.clone();heading.y=0;heading.normalize().multiplyScalar(direction);
  const forward=new THREE.Vector3(0,0,version==='fixed-wing'?1:-1);
  const depth=center.clone().sub(view.position).dot(view.getWorldDirection(new THREE.Vector3()));
  return {object,center,localCenter:object.worldToLocal(center.clone()),right,
    width:2*depth*Math.tan(THREE.MathUtils.degToRad(view.fov)/2)*view.aspect,
    rest:object.quaternion.clone(),position:object.position.clone(),heading:new THREE.Quaternion().setFromUnitVectors(forward,heading)};
}
function poseFlight(pose,from,to,turn,offset){
  pose.object.quaternion.slerpQuaternions(from,to,turn);
  pose.object.position.copy(pose.center).addScaledVector(pose.right,offset*pose.width)
    .sub(pose.localCenter.clone().multiply(pose.object.scale).applyQuaternion(pose.object.quaternion));
  pose.object.updateMatrixWorld(true);
}
function updateFlight(now){
  const f=flight;f.elapsed=Math.max(0,now-f.start);
  const out=Math.min(1,f.elapsed/850),enter=Math.min(1,f.elapsed/1150),turn=Math.min(1,f.elapsed/540);
  f.outgoingX=f.direction*.85*(.25*out+.75*out*out);
  f.incomingX=-f.direction*.76*(1-enter)**3;
  poseFlight(f.outgoing,f.outgoing.rest,f.outgoing.heading,turn*turn*(3-2*turn),f.outgoingX);
  poseFlight(f.incoming,f.incoming.heading,f.incoming.rest,enter*enter*(3-2*enter),f.incomingX);
  if(enter===1)f.resolve();
}
async function switchModel(direction, version, updateURL=true) {
  if (!ready || switching) return;
  const next = version || versions[(versions.indexOf(modelVersion)+direction+versions.length)%versions.length];
  if(next === modelVersion) return;
  switching = true; rotorSpeed = 0; tween = null; hover = null; $('tooltip').hidden=true; selectPart(null);
  controls.enabled=false; controls.autoRotate=false;
  for (const id of ['model-prev','model-next','explode','rotate','reset']) $(id).disabled=true;
  $('switch-status').textContent='正在准备下一机型…';
  let previous;
  try {
    // Keep the current aircraft still while fetching; all motion starts on the shared flight clock.
    const gltf = await loadModel(next);
    if(expanded){parts.forEach(p=>p.node.position.copy(p.origin));expanded=false;camera.position.copy(overview.position);controls.target.copy(overview.target);controls.update();}
    previous=model;
    const previousVersion=modelVersion, previousRotors=rotors, previousCamera=camera.clone(), previousTone=renderer.toneMapping;
    const departure=new THREE.Scene();scene.children.filter(n=>n.isLight).forEach(light=>departure.add(light.clone()));
    const outgoing=flightPose(previous,previousCamera,previousVersion,direction);
    scene.remove(previous);departure.add(previous);parts=[];meshes=[];$('parts').replaceChildren();
    configureModel(next);installModel(gltf);
    $('explode').textContent='↗ 拆解模型';$('view-state').textContent='整机视图';
    if(!reducedMotion){
      const incoming=flightPose(model,camera,next,direction);
      const completed=new Promise(resolve=>{
        flight={start:performance.now(),elapsed:0,direction,outgoing,incoming,scene:departure,camera:previousCamera,
          rotors:previousRotors,toneMapping:previousTone,version:previousVersion,resolve};
      });
      rotorSpeed=0;updateFlight(flight.start);resume();
      await completed;
      model.position.copy(incoming.position);model.quaternion.copy(incoming.rest);
      flight=null;
    }
    departure.remove(previous);disposeModel(previous);previous=null;
    if(updateURL){const url=new URL(location.href);url.searchParams.set('model',next);history.pushState(null,'',url);}
    $('switch-status').textContent=modelNames[versions.indexOf(next)];
  } catch(error) {
    console.error(error); $('switch-status').textContent='模型加载失败，请点击箭头重试。';
  } finally {
    if(flight){model.position.copy(flight.incoming.position);model.quaternion.copy(flight.incoming.rest);flight=null;}
    if(previous&&previous!==model){previous.removeFromParent();disposeModel(previous);}
    switching=false; controls.enabled=true; controls.autoRotate=!reducedMotion; syncRotate();
    for (const id of ['model-prev','model-next','explode','rotate','reset']) $(id).disabled=false;
    if(resizePending){resizePending=false;resize();}
  }
}
function installModel(gltf) {
  model = gltf.scene; model.scale.setScalar(.975); model.rotation.y=Math.PI;
  if (helicopter) { model.name='helicopter'; paintHelicopter(model,renderer); }
  rotors=prepareRotors(model,modelVersion);
  renderer.toneMapping = originalModel ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.9;
  scene.children.filter(node=>node.isAmbientLight).forEach(light=>light.intensity=originalModel ? 5 : 1.2);
  scene.children.filter(node=>node.isDirectionalLight).forEach(light=>light.intensity=light.userData.baseIntensity*(originalModel ? 1 : .55));
  renderer.domElement.setAttribute('aria-label', `${helicopter ? '直升机' : fixedWing ? '固定翼' : '穿越机'}三维视图，拖动旋转，滚轮缩放`);
  scene.add(model); model.updateMatrixWorld(true);
  for (const [name,definition] of Object.entries(definitions)) {
    const node = model.getObjectByName(name);
    if (!node) throw new Error(`模型缺少部件：${name}`);
    const origin = node.position.clone(), spec = plan[name];
    let target;
    if (Array.isArray(spec)) target=origin.clone().add(new THREE.Vector3(...spec));
    else {
      const world=spec.worldPosition ? new THREE.Vector3(...spec.worldPosition) : node.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...spec.worldOffset));
      target=node.parent.worldToLocal(world);
    }
    const part={name,node,origin,target}; parts.push(part);
    node.traverse(child=>{if(child.isMesh){child.userData.part=part;meshes.push(child);}});
    const button=document.createElement('button'); button.dataset.part=name; button.setAttribute('aria-pressed','false');
    const number=document.createElement('span'); number.textContent=String(parts.length).padStart(2,'0');
    button.append(number,definition[0]); button.addEventListener('click',()=>selectPart(part)); $('parts').appendChild(button);
  }
  overview=poseForBounds(new THREE.Box3().setFromObject(model));
  camera.position.copy(overview.position); controls.target.copy(overview.target);
  const distance=camera.position.distanceTo(controls.target); controls.minDistance=distance*.25; controls.maxDistance=distance*5;
  controls.update(); ready=true; $('loading').hidden=true;
  for(const id of ['explode','rotate','reset']) $(id).disabled=switching;
  for(const id of ['model-prev','model-next']) $(id).disabled=switching;

}
init().catch(error=>{
  console.error(error); $('loading').hidden=false;
  $('loading').querySelector('.spinner')?.remove();
  $('progress').textContent='模型加载失败';
  $('loading').querySelector('small').textContent=`${error.message}。请通过“启动离线版.cmd”打开。`;
});
