import crypto from 'node:crypto';
export const origin=()=>{
  const value=process.env.YIXU_ORIGIN||'http://127.0.0.1:4183';
  if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(value))throw Error('只允许本机 loopback 服务');return value;
};
export async function readResource(resource){
  const response=await fetch(origin()+'/__yixu_local/api/'+resource,{signal:AbortSignal.timeout(15000)});
  const value=await response.json();if(!response.ok)throw Error(value.error||'读取失败');return value;
}
export async function commit(command,requestId=crypto.randomUUID()){
  const response=await fetch(origin()+'/__yixu_local/api/command',{method:'POST',headers:{'content-type':'application/json','x-yixu-client':'3',origin:origin()},body:JSON.stringify({command,requestId}),signal:AbortSignal.timeout(30000)});
  const value=await response.json();if(!response.ok)throw Error(value.error||'写入失败');return value;
}
