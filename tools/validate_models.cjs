const fs=require('node:fs');
const validator=require('gltf-validator');
(async()=>{
  const reports=[];
  for(const name of ['fpv-drone3-v3.glb','fpv-drone3-v3-white-blue.glb']){
    const report=await validator.validateBytes(new Uint8Array(fs.readFileSync('assets/'+name)),{uri:name,maxIssues:1000});
    fs.writeFileSync('artifacts/'+name+'.validation.json',JSON.stringify(report,null,2));
    reports.push({name,errors:report.issues.numErrors,warnings:report.issues.numWarnings,messages:report.issues.messages});
  }
  console.log(JSON.stringify(reports.map(r=>({...r,messages:r.messages.filter(m=>m.severity===0)})),null,2));
  const baseline=new Set(reports[0].messages.filter(m=>m.severity===0).map(m=>m.code+':'+m.pointer));
  if(reports[1].messages.some(m=>m.severity===0&&!baseline.has(m.code+':'+m.pointer)))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
