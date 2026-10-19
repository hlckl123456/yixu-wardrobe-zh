import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {projectRoot, localPort, rootTag, healthPath} from './local-server.mjs';
import {dataDirectory} from './data-paths.mjs';
import crypto from 'node:crypto';

const action = process.argv[2] || 'start';
const port = process.argv[3] === undefined ? localPort : Number(process.argv[3]);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid local port');
const origin = `http://127.0.0.1:${port}`;
const runDir = path.join(dataDirectory(),'run');
const stateFile = path.join(runDir,`${port}.json`);
const logFile = path.join(runDir,`${port}.log`);

async function health() {
  return new Promise((resolve,reject) => {
    const request = http.get(origin + healthPath, {timeout:1500},response => {
      let body = '';
      response.on('data',chunk => {body += chunk; if(body.length > 10000) request.destroy(Error('端口已被其他服务占用'));});
      response.on('end',() => {
        try {
          const data = JSON.parse(body);
          if (response.statusCode !== 200 || data.app !== 'yixu-local' || data.rootTag !== rootTag || data.origin !== origin) throw Error();
          resolve(data);
        } catch {reject(Error(`端口 ${port} 已被其他服务占用；未终止任何进程。`));}
      });
    });
    request.on('timeout',() => request.destroy(Error('本地服务没有响应；未终止任何进程。')));
    request.on('error',error => error.code === 'ECONNREFUSED' ? resolve(null) : reject(error));
  });
}

try {
  if (!['start','stop','status'].includes(action)) throw Error('Usage: node scripts/local.mjs start|stop|status');
  let current = await health();
  if (action === 'start') {
    if(current?.version>=3&&current.dataTag!==crypto.createHash('sha256').update(path.resolve(dataDirectory())).digest('hex').slice(0,16))throw Error('该端口正在使用另一数据目录，未切换或覆盖；请先核对并停止原服务。');
    if (!current) {
      fs.mkdirSync(runDir,{recursive:true,mode:0o700});
      const log = fs.openSync(logFile,'a',0o600);
      const child = spawn(process.execPath,[path.join(projectRoot,'scripts/local-server.mjs'),String(port)],{
        cwd:projectRoot, detached:true, stdio:['ignore',log,log]
      });
      let startError;
      child.on('error',error => {startError=error;});
      child.unref(); fs.closeSync(log);
      for (let i=0;i<40&&!current;i++) {if(startError)throw startError; await delay(100); current=await health();}
      if (!current) throw Error(`启动失败，请查看 ${logFile}`);
      fs.writeFileSync(stateFile,JSON.stringify(current,null,2),{mode:0o600});
    }
    console.log(`衣橱已在本机运行：${origin}/#outfits\n仅监听 127.0.0.1；关闭启动窗口不会停止服务。\n停止：npm run stop（不会删除搭配或笔记）。`);
  } else if (action === 'status') {
    console.log(current ? `运行中：${origin}/#outfits（PID ${current.pid}）` : '本地衣橱未运行。');
    if (!current) process.exitCode=1;
  } else {
    if (!current) console.log('本地衣橱已经停止。');
    else {
      const recorded = JSON.parse(fs.readFileSync(current.version<3?path.join(projectRoot,'.local-run',`${port}.json`):stateFile,'utf8'));
      if (recorded.pid !== current.pid || recorded.rootTag !== rootTag) throw Error('无法确认服务归属，未停止任何进程。');
      process.kill(current.pid,'SIGTERM');
      for (let i=0;i<40;i++) {await delay(100); if(!await health()){current=null;break;}}
      if (current) throw Error('服务尚未停止，请稍后检查状态。');
      console.log('本地衣橱已停止；搭配、笔记和衣物文件均未删除。');
    }
  }
} catch (error) {console.error(error.message);process.exitCode=1;}
