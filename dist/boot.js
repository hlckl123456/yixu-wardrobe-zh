// A classic script starts independently of the module dependency graph.
(() => {
 const main=document.getElementById('main');let done=false;
 function fail(error){if(done)return;done=true;clearTimeout(timer);console.error('Wardrobe startup failed',error);main.replaceChildren();const box=document.createElement('div');box.className='error';const title=document.createElement('h2');title.textContent='衣橱暂时未能打开';const note=document.createElement('p');note.textContent='页面资源未完成加载。请重试；如果仍失败，可在系统浏览器打开此网址。你的衣物档案没有被修改。';const retry=document.createElement('button');retry.className='btn primary';retry.textContent='重新打开';retry.onclick=()=>location.reload();box.append(title,note,retry);main.append(box);}
 const timer=setTimeout(()=>fail(new Error('启动超过 20 秒')),20000);
 import('./workspace.js').then(()=>{if(done)return;done=true;clearTimeout(timer);}).catch(fail);
})();
