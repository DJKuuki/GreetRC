const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const root = __dirname;
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.wasm':'application/wasm','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
const server = http.createServer((req,res)=>{
  if(req.url==='/health'){res.writeHead(200,{'Content-Type':'text/plain'});res.end('fpv-offline-explorer');return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  let pathname;
  try {pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);} catch {res.writeHead(400);res.end();return;}
  let file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  const rel=path.relative(root,file);
  if(rel.startsWith('..')||path.isAbsolute(rel)){res.writeHead(403);res.end();return;}
  // Document routes share the local community shell; asset misses remain real 404s.
  if(pathname!=='/'&&!path.extname(pathname)) file=path.join(root,'site.html');
  fs.stat(file,(err,stat)=>{
    if(err||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD'){res.end();return;}
    const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
  });
});
function open(){if(process.argv.includes('--open'))spawn('rundll32.exe',['url.dll,FileProtocolHandler',`http://127.0.0.1:${port}`],{windowsHide:true,stdio:'ignore'}).unref();}
server.on('error',error=>{
  if(error.code==='EADDRINUSE'){
    http.get(`http://127.0.0.1:${port}/health`,res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>{if(body==='fpv-offline-explorer'){open();process.exit(0);}console.error(`Port ${port} is in use. Set PORT to another port.`);process.exit(1);});}).on('error',()=>{console.error(error.message);process.exit(1);});
  }else{console.error(error);process.exit(1);}
});
server.listen(port,'127.0.0.1',()=>{console.log(`FPV offline explorer: http://127.0.0.1:${port}\nKeep this window open. Press Ctrl+C to stop.`);open();});
