import * as THREE from 'three';

// One side profile is shared by both sides: X never enters the paint coordinates.
export function createLiveryCanvas(mirrorText=false) {
  const canvas=document.createElement('canvas'); canvas.width=2048; canvas.height=1024;
  const c=canvas.getContext('2d');
  const polygon=(color,points)=>{c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
  c.fillStyle='#f2f5ef';c.fillRect(0,0,2048,1024);
  // Deep ink canopy, white breathing space, long aerodynamic color sweeps.
  polygon('#122435',[[0,0],[2048,0],[2048,330],[1470,190],[1070,210],[780,335],[0,400]]);
  polygon('#00aabd',[[0,330],[740,290],[1060,210],[1510,200],[2010,305],[1280,290],[890,450],[0,600]]);
  polygon('#c9ef35',[[0,585],[880,437],[1290,282],[2020,310],[1300,324],[900,492],[0,650]]);
  polygon('#172b3b',[[0,760],[570,665],[1000,635],[2048,535],[1530,820],[710,890],[0,1024]]);
  polygon('#ec3479',[[0,850],[660,726],[1040,708],[1880,580],[1510,727],[740,823],[0,1005]]);
  polygon('#00adbd',[[0,1000],[760,864],[1560,775],[1240,905],[0,1024]]);
  // Controlled graffiti ticks and flecks, concentrated around the rear color block.
  let seed=71;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  c.save();c.beginPath();c.rect(0,360,660,400);c.clip();
  for(let i=0;i<160;i++){const x=random()*620,y=390+random()*360;c.fillStyle=i%3?'#122435':'#f2f5ef';c.beginPath();c.arc(x,y,1+random()*5,0,Math.PI*2);c.fill();}
  c.restore();
  for(let i=0;i<4;i++)polygon('#f2f5ef',[[140+i*66,420],[170+i*66,415],[115+i*66,506],[85+i*66,513]]);
  const label=(text,x,y)=>{c.save();if(mirrorText){c.translate(2*x+c.measureText(text).width,0);c.scale(-1,1);}c.fillText(text,x,y);c.restore();};
  c.save();c.translate(720,605);c.transform(1,-.11,-.17,1,0,0);
  c.fillStyle='#152b3a';c.font='900 104px Arial';label('GREET',0,0);
  c.font='bold 29px Arial';label('ROTOR DIVISION  /  SPORT SERIES',6,46);
  c.restore();
  c.save();c.translate(1470,550);c.transform(1,-.1,-.16,1,0,0);c.fillStyle='#152b3a';c.font='900 100px Arial';label('07',0,0);c.restore();
  c.strokeStyle='#00aabd';c.lineWidth=8;c.beginPath();c.moveTo(1390,433);c.lineTo(1670,409);c.stroke();
  return canvas;
}

export function paintHelicopter(root,renderer) {
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=2048;
  const context=canvas.getContext('2d');context.drawImage(createLiveryCanvas(false),0,0);context.drawImage(createLiveryCanvas(true),0,1024);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  root.traverse(node=>{
    if(!node.isMesh)return;
    const previous=node.material;node.material=previous.clone();
    const material=node.material;
    // Target the actual exterior shell, never a shared material family.
    if(node.name==='canopy_0'){
      node.geometry=node.geometry.clone();
      const positions=node.geometry.attributes.position, bounds=new THREE.Box3().setFromBufferAttribute(positions);
      const size=bounds.getSize(new THREE.Vector3()),uv=new Float32Array(positions.count*2);
      for(let i=0;i<positions.count;i++){
        uv[2*i]=(positions.getY(i)-bounds.min.y)/size.y;
        uv[2*i+1]=(positions.getZ(i)-bounds.min.z)/size.z;
      }
      node.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
      material.color.set('#ffffff');material.map=texture;material.metalness=.16;material.roughness=.3;
      // Same mirrored graphics, but each side gets correctly readable lettering.
      material.onBeforeCompile=shader=>{
        shader.vertexShader='varying float paintSide;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npaintSide=position.x;');
        shader.fragmentShader='varying float paintSide;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
          vec2 sideUV=vec2(vMapUv.x,vMapUv.y*.5+(paintSide>=0.0?.5:0.0));
          diffuseColor *= texture2D(map,sideUV);
        #endif`);
      };
      material.customProgramCacheKey=()=> 'symmetric-heli-livery-v2';
      node.userData.livery='bilateral-side-projection';
    }else if(node.name==='Rotor_3'||node.name==='Tail_2'){
      material.map=null;material.color.set('#263441');material.metalness=.25;material.roughness=.38;
    }else if(node.name==='Heli_11'){
      material.map=null;material.color.set('#e3e9e8');material.metalness=.25;material.roughness=.4;
    }else if(material.name.toLowerCase().includes('red'))material.color.set('#ee3476');
    else if(material.name.toLowerCase().includes('yellow'))material.color.set('#c9ef35');
    else if(material.name.toLowerCase().includes('blue'))material.color.set('#00aabd');
  });
}

export function prepareRotors(root,type){
  const rotors=[];
  function add(mesh,pivotPosition,axis,direction){
    if(!mesh)return;
    const pivot=new THREE.Group();pivot.name=mesh.name+'-spin-axis';pivot.position.copy(pivotPosition);
    mesh.parent.add(pivot);root.updateMatrixWorld(true);pivot.attach(mesh);
    rotors.push({node:pivot,axis,direction,mesh});
  }
  if(type==='helicopter'){
    const main=root.getObjectByName('Rotor_3'),tail=root.getObjectByName('Tail_2');
    main.geometry.computeBoundingBox();tail.geometry.computeBoundingBox();
    const mainCenter=main.geometry.boundingBox.getCenter(new THREE.Vector3());
    // The mast lies at X=Y=0 in the Z-up source coordinate system.
    add(main,new THREE.Vector3(0,0,mainCenter.z),new THREE.Vector3(0,0,1),1);
    add(tail,tail.geometry.boundingBox.getCenter(new THREE.Vector3()),new THREE.Vector3(1,0,0),-1);
  }else if(type!=='fixed-wing'){
    for(const [i,name] of ['motor1','motor2','motor3','motor4'].entries()){
      const motor=root.getObjectByName(name),prop=motor?.children.find(node=>node.name.startsWith('propeller'));
      if(prop)add(prop,prop.position.clone(),new THREE.Vector3(0,1,0),i%2?-1:1);
    }
  }
  return rotors;
}
