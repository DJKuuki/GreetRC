const fs=require('node:fs');
const path=require('node:path');
const draco=require('draco3dgltf');
(async()=>{
  const root=path.resolve(__dirname,'..');
  const bytes=fs.readFileSync(process.argv[2]||path.join(root,'assets/fpv-drone3-v3.glb'));
  const size=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+size));
  const bin=bytes.subarray(28+size);
  const module=await draco.createDecoderModule({});
  const output={};
  for(const meshIndex of [119,120]){
    const primitive=doc.meshes[meshIndex].primitives[0];
    const ext=primitive.extensions.KHR_draco_mesh_compression;
    const view=doc.bufferViews[ext.bufferView];
    const raw=bin.subarray(view.byteOffset,view.byteOffset+view.byteLength);
    const decoder=new module.Decoder(),buffer=new module.DecoderBuffer(),mesh=new module.Mesh();
    buffer.Init(new Int8Array(raw),raw.length);
    const status=decoder.DecodeBufferToMesh(buffer,mesh);
    if(!status.ok())throw new Error(status.error_msg());
    const entry={attributes:{},indices:[]};
    for(const [semantic,id] of Object.entries(ext.attributes)){
      const attribute=decoder.GetAttributeByUniqueId(mesh,id),values=new module.DracoFloat32Array();
      decoder.GetAttributeFloatForAllPoints(mesh,attribute,values);
      entry.attributes[semantic]=Array.from({length:values.size()},(_,i)=>values.GetValue(i));
      module.destroy(values);
    }
    const face=new module.DracoInt32Array();
    for(let i=0;i<mesh.num_faces();i++){decoder.GetFaceFromMesh(mesh,i,face);entry.indices.push(face.GetValue(0),face.GetValue(1),face.GetValue(2));}
    output[meshIndex]=entry;
    for(const value of [face,mesh,buffer,decoder])module.destroy(value);
  }
  fs.writeFileSync(path.join(root,'artifacts/tail-decoded.json'),JSON.stringify(output));
  console.log('Decoded original TPU geometry for surgical tail reconstruction.');
})().catch(e=>{console.error(e);process.exitCode=1;});
