import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRelationalStore} from './relational-store.mjs';
import {dataDirectory,databaseFile,containedFile} from './data-paths.mjs';
import emptyReferences from '../dist/data/empty-references.js';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const defaultRoot = path.join(projectRoot, 'dist');
export const localPort = 4183;
export const healthPath = '/__yixu_local/health';
export const rootTag = crypto.createHash('sha256').update(fs.realpathSync(defaultRoot)).digest('hex').slice(0,16);
const types = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2'
};

export function createLocalServer({root = defaultRoot, databasePath=':memory:',dataDir,storeOptions={}} = {}) {
  const realRoot = fs.realpathSync(root);
  if(databasePath!==':memory:'&&path.resolve(databasePath).startsWith(realRoot+path.sep))throw Error('个人数据库不得位于公开文件目录');
  const mediaRoot=dataDir?path.join(dataDir,'public'):undefined;
  const store=createRelationalStore(databasePath,{...storeOptions,mediaRoot:mediaRoot||storeOptions.mediaRoot});
  const server = http.createServer(async (request, response) => {
    const port = server.address().port, origin = `http://127.0.0.1:${port}`;
    const finish = (status, body = '') => {response.writeHead(status); response.end(request.method === 'HEAD' ? '' : body);};
    response.setHeader('Cache-Control','no-store');
    response.setHeader('X-Content-Type-Options','nosniff');
    response.setHeader('Referrer-Policy','no-referrer');
    response.setHeader('Cross-Origin-Resource-Policy','same-origin');
    response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(request.headers.host)) return finish(403,'Invalid host');
    if (request.headers.origin && request.headers.origin !== origin && request.headers.origin !== `http://localhost:${port}`) return finish(403,'Cross-origin request denied');
    if (request.headers['sec-fetch-site'] === 'cross-site' && request.headers['sec-fetch-mode'] !== 'navigate') return finish(403,'Cross-site request denied');
    if (request.headers.host.startsWith('localhost:')) {
      response.setHeader('Location', origin + request.url);
      return finish(307);
    }
    let pathname;
    try {
      if (!request.url.startsWith('/')) return finish(400,'Invalid URL');
      pathname = decodeURIComponent(new URL(request.url, origin).pathname);
      if (pathname.includes('\0') || pathname.includes('\\')) return finish(400,'Invalid path');
    } catch {return finish(400,'Invalid URL');}
    if(pathname.startsWith('/__yixu_local/api/')) {
      response.setHeader('Content-Type','application/json; charset=utf-8');
      try {
        if(request.method==='GET'&&pathname==='/__yixu_local/api/state')return finish(200,JSON.stringify(store.read()));
        if(request.method==='GET'&&pathname==='/__yixu_local/api/catalog')return finish(200,JSON.stringify(store.catalog()));
        if(request.method==='GET'&&pathname==='/__yixu_local/api/references')return finish(200,JSON.stringify(store.document('reference-catalog')||emptyReferences));
        if(request.method==='GET'&&pathname==='/__yixu_local/api/thumbnails')return finish(200,JSON.stringify(store.document('thumbnails')));
        if(request.method!=='POST'){response.setHeader('Allow','GET, POST');return finish(405,JSON.stringify({error:'不支持的操作'}));}
        if(request.headers.origin!==origin||request.headers['x-yixu-client']!=='3'||request.headers['content-type']!=='application/json')return finish(403,JSON.stringify({error:'仅允许衣橱页面提交数据'}));
        if(!['/migrate','/command','/backup'].some(s=>pathname==='/__yixu_local/api'+s))return finish(404,JSON.stringify({error:'接口不存在'}));
        const chunks=[];let size=0;
        for await(const chunk of request){size+=chunk.length;if(size>20_000_000)return finish(413,JSON.stringify({error:'数据超过 20 MB'}));chunks.push(chunk);}
        const payload=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
        // Reference failures cannot block server startup, reads, notes or recovery.
        let resolveReference;
        if(pathname.endsWith('/command')&&['upsert-owned-outfit','upsert-planned-outfit'].includes(payload.command?.type)&&payload.command.record?.sourceReference){
          const {referenceContext}=await import('../dist/navigation-model.js');
          resolveReference=hash=>referenceContext(hash,store.document('reference-catalog')||emptyReferences);
        }
        const result=pathname.endsWith('/migrate')?store.initialize(payload.source):pathname.endsWith('/command')?store.commit(payload.command,payload.requestId,resolveReference):store.backup();
        return finish(200,JSON.stringify(result));
      } catch(error){return finish(error.code==='RETIRED_OPERATION'?410:400,JSON.stringify({error:error.message,...(error.code?{code:error.code}:{})}));}
    }
    if (!['GET','HEAD'].includes(request.method)) {response.setHeader('Allow','GET, HEAD'); return finish(405,'Method not allowed');}
    if (pathname === healthPath) {
      response.setHeader('Content-Type','application/json; charset=utf-8');
      return finish(200,JSON.stringify({app:'yixu-local',version:3,schemaVersion:2,storage:'sqlite',rootTag,dataTag:dataDir?crypto.createHash('sha256').update(path.resolve(dataDir)).digest('hex').slice(0,16):null,pid:process.pid,origin}));
    }
    if (pathname.split('/').some(segment => segment.startsWith('.'))) return finish(404,'Not found');
    const projected={
      '/data/catalog.json':()=>JSON.stringify(store.catalog()),
      '/data/guides.json':()=>JSON.stringify(store.document('guides')||{formulas:[],sources:[]}),
      '/data/reference-catalog.js':()=>`export default ${JSON.stringify(store.document('reference-catalog')||emptyReferences)};`,
      '/thumbnail-manifest.js':()=>`export const thumbnails = ${JSON.stringify(store.document('thumbnails')||{})};`
    };
    if(projected[pathname]){
      const bytes=projected[pathname](),etag='"'+crypto.createHash('sha256').update(bytes).digest('hex')+'"';
      response.setHeader('ETag',etag);response.setHeader('Content-Type',types[path.extname(pathname)]);
      if(request.headers['if-none-match']===etag)return finish(304);
      return finish(200,bytes);
    }
    // A private directory is NOT a static root. Only individually registered
    // files are reachable; database, archives, prompts and preferences are not.
    const asset=store.asset(pathname);
    if(asset&&mediaRoot){
      if(asset.kind==='retired')return finish(410,'Removed from this wardrobe');
      if(asset.kind.startsWith('redirect:')){
        const target=asset.kind.slice('redirect:'.length),destination=store.asset(target);
        if(!destination||destination.kind==='retired'||destination.kind.startsWith('redirect:'))return finish(410,'Review no longer available');
        response.setHeader('Location','/'+target);return finish(307);
      }
      try{
        const file=containedFile(mediaRoot,asset.relative_path),real=await fs.promises.realpath(file);
        if(!real.startsWith(fs.realpathSync(mediaRoot)+path.sep))return finish(404,'Not found');
        const bytes=await fs.promises.readFile(real);
        if(bytes.length!==asset.size||crypto.createHash('sha256').update(bytes).digest('hex')!==asset.sha256)return finish(409,'Asset integrity mismatch');
        response.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
        response.setHeader('Content-Length',bytes.length);return finish(200,bytes);
      }catch{return finish(404,'Not found');}
    }
    if(pathname.startsWith('/assets/')||pathname.startsWith('/reviews/')&&!['/reviews/candidate-review.js','/reviews/suggested-pieces.js'].includes(pathname))return finish(404,'Not registered');
    const target = path.resolve(realRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(realRoot + path.sep)) return finish(404,'Not found');
    try {
      const realFile = await fs.promises.realpath(target);
      if (!realFile.startsWith(realRoot + path.sep)) return finish(404,'Not found');
      const stat = await fs.promises.stat(realFile);
      if (!stat.isFile()) return finish(404,'Not found');
      if(['/data/catalog.json','/data/guides.json'].includes(pathname)){
        const bytes=await fs.promises.readFile(realFile);
        const etag='"'+crypto.createHash('sha256').update(bytes).digest('hex')+'"';
        response.setHeader('ETag',etag);
        if(request.headers['if-none-match']===etag)return finish(304);
        response.setHeader('Content-Type',types['.json']);
        return finish(200,bytes);
      }
      response.setHeader('Content-Type',types[path.extname(realFile)] || 'application/octet-stream');
      response.setHeader('Content-Length',stat.size);
      response.writeHead(200);
      if (request.method === 'HEAD') return response.end();
      const stream = fs.createReadStream(realFile);
      stream.on('error',() => response.destroy());
      response.on('close',() => stream.destroy());
      stream.pipe(response);
    } catch {return finish(404,'Not found');}
  });
  server.keepAliveTimeout = 1000;
  server.on('close',()=>store.close());
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = process.argv[2] === undefined ? localPort : Number(process.argv[2]);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid local port');
  const dataDir=dataDirectory();
  if(port!==localPort&&!process.env.YIXU_DATA_DIR)throw Error('QA 端口必须指定隔离的 YIXU_DATA_DIR');
  if(!fs.existsSync(databaseFile(dataDir))&&fs.existsSync(path.join(projectRoot,'.local-data/owner/wardrobe.sqlite')))throw Error('检测到旧私人数据库，请先完成显式迁移；未创建空库冒充原衣橱');
  const server = createLocalServer({databasePath:databaseFile(dataDir),dataDir});
  server.on('error',error => {console.error('本地衣橱未启动：'+error.message); process.exitCode = 1;});
  server.listen(port,'127.0.0.1',() => console.log(`本地衣橱：http://127.0.0.1:${port}/#outfits`));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,() => {
    server.close(() => process.exit(0));
    server.closeIdleConnections?.();
  });
}
