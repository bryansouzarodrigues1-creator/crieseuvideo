// Serve a prebundled, trusted fixture without the production framework router
// or two dev-server dependency optimizers sharing the app's cache.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
const original=await readFile('scripts/fixtures/engine-comparison/index.html','utf8');
const html=original.replace('/scripts/fixtures/engine-comparison/harness.ts','/harness.js');
const js=await readFile('tmp/engine-comparison/harness.js');
http.createServer((req,res)=>{
 if(req.url?.split('?')[0]==='/harness.js'){
  res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(js);
 }else{
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);
 }
}).listen(4201,'127.0.0.1',()=>console.log('Trusted renderer fixture listening on 4201'));
