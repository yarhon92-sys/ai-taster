const MEDIA = {"assets/experience-wall/magic-drink-house.mov": {"size": 129267162, "hash": "f0a69ce15c9b491037eb68ca3960ca6a5ad4cce29ccc52c9ed0c2bfd84de57cd", "chunkSize": 16777216, "parts": ["media/2a05ac4ca7e6295a/000.bin", "media/2a05ac4ca7e6295a/001.bin", "media/2a05ac4ca7e6295a/002.bin", "media/2a05ac4ca7e6295a/003.bin", "media/2a05ac4ca7e6295a/004.bin", "media/2a05ac4ca7e6295a/005.bin", "media/2a05ac4ca7e6295a/006.bin", "media/2a05ac4ca7e6295a/007.bin"], "mime": "video/quicktime"}, "assets/storybook/starlight-daily-scene.mp4": {"size": 54314311, "hash": "7d984c58dd1b56228ce7396d7407bbc87732fc39fffd48880a000b036f3ac3cb", "chunkSize": 16777216, "parts": ["media/9a110572cebdc252/000.bin", "media/9a110572cebdc252/001.bin", "media/9a110572cebdc252/002.bin", "media/9a110572cebdc252/003.bin"], "mime": "video/mp4"}, "assets/storybook/tea-house-ad-4k.mp4": {"size": 142406055, "hash": "2fdb2cd2246f1a29f8ce2ec046527a56d3312902ec20560127422f2c76ebf0b1", "chunkSize": 16777216, "parts": ["media/8c02cae0f3ff543b/000.bin", "media/8c02cae0f3ff543b/001.bin", "media/8c02cae0f3ff543b/002.bin", "media/8c02cae0f3ff543b/003.bin", "media/8c02cae0f3ff543b/004.bin", "media/8c02cae0f3ff543b/005.bin", "media/8c02cae0f3ff543b/006.bin", "media/8c02cae0f3ff543b/007.bin", "media/8c02cae0f3ff543b/008.bin"], "mime": "video/mp4"}, "assets/storybook/tea-station-scene-3.mp4": {"size": 78484835, "hash": "48e4750106d40835d1472d40691b03caafb18577182394f9bf227362aee73e43", "chunkSize": 16777216, "parts": ["media/1b83ccdfa523aa73/000.bin", "media/1b83ccdfa523aa73/001.bin", "media/1b83ccdfa523aa73/002.bin", "media/1b83ccdfa523aa73/003.bin", "media/1b83ccdfa523aa73/004.bin"], "mime": "video/mp4"}};
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { return; }
  const scope = decodeURIComponent(new URL(self.registration.scope).pathname);
  const item = path.startsWith(scope) ? MEDIA[path.slice(scope.length)] : null;
  if (item && ['GET', 'HEAD'].includes(event.request.method)) event.respondWith(serve(event.request,item));
});
async function serve(request,item) {
  const headers = new Headers({'Content-Type':item.mime,'Accept-Ranges':'bytes','ETag':'"'+item.hash+'"','Cache-Control':'no-cache'});
  let start=0,end=item.size-1,status=200;
  const range=request.headers.get('Range');
  if(range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(range);
    if(!match || (!match[1]&&!match[2])) return invalid();
    if(match[1]){start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
    else{const suffix=Number(match[2]);if(!suffix)return invalid();start=Math.max(0,item.size-suffix);}
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=item.size)return invalid();
    status=206;headers.set('Content-Range',`bytes ${start}-${end}/${item.size}`);
  }
  headers.set('Content-Length',String(end-start+1));
  if(request.method==='HEAD')return new Response(null,{status,headers});
  const abort=new AbortController();
  let reader=null,index=Math.floor(start/item.chunkSize),cursor=0,remaining=end-start+1,skip=0;
  const stream=new ReadableStream({
    async pull(controller){
      try{
        while(remaining>0){
          if(!reader){
            const chunkStart=index*item.chunkSize,localStart=Math.max(0,start-chunkStart),localEnd=Math.min(item.chunkSize-1,end-chunkStart,item.size-1-chunkStart);
            const response=await fetch(new URL(item.parts[index],self.registration.scope),{headers:{Range:`bytes=${localStart}-${localEnd}`},signal:abort.signal});
            if(!response.ok||!response.body)throw new Error('Video segment unavailable');
            skip=response.status===206?0:localStart;
            cursor=localEnd-localStart+1;
            reader=response.body.getReader();index++;
          }
          const {done,value}=await reader.read();
          if(done){reader=null;if(cursor>0)throw new Error('Incomplete video segment');continue;}
          if(skip>=value.length){skip-=value.length;continue;}
          const data=value.subarray(skip,Math.min(value.length,skip+cursor,skip+remaining));skip=0;
          cursor-=data.length;remaining-=data.length;
          if(cursor===0){const finished=reader;reader=null;finished.cancel().catch(()=>{});}
          if(data.length){controller.enqueue(data);if(remaining===0)controller.close();return;}
        }
        controller.close();
      }catch(error){controller.error(error);abort.abort();if(reader)await reader.cancel().catch(()=>{});}
    },
    async cancel(){abort.abort();if(reader)await reader.cancel().catch(()=>{});}
  });
  return new Response(stream,{status,headers});
  function invalid(){headers.set('Content-Range','bytes */'+item.size);return new Response(null,{status:416,headers});}
}
