import {parseReport,scanReportStream} from './parser.js?v=1.2.0';
import {readZipReports,MAX_FILE} from './zip.js?v=1.1.0';
self.onmessage=async({data})=>{
 try{
  let parsed,lastProgress=0;
  const progress=info=>{const now=Date.now();if(now-lastProgress>150||info.processed===info.total){self.postMessage({progress:info});lastProgress=now;}};
  if(data.file){
   if(data.file.size>MAX_FILE)throw Error('檔案超過 1 GiB 上限。');
   if(/\.zip$/i.test(data.file.name))parsed=await readZipReports(data.file,scanReportStream,{onProgress:progress});
   else {let processed=0;const stream=data.file.stream().pipeThrough(new TransformStream({transform(chunk,controller){processed+=chunk.length;progress({name:data.file.name,processed,total:data.file.size});controller.enqueue(chunk);}}));parsed=[await scanReportStream(stream,data.file.name)];}
  }else parsed=[parseReport(data.text,'貼上的報告')];
  const groups=new Map(),normal=[];
  for(const r of parsed){const m=r.name.match(/^(.*\/power_supply\/[^/]+)\//);if(!m){normal.push(r);continue;}if(!groups.has(m[1]))groups.set(m[1],{name:m[1],evidence:[]});groups.get(m[1]).evidence.push(...r.evidence);}
  self.postMessage({reports:[...normal,...groups.values()],count:parsed.length});
 }catch(error){self.postMessage({error:error.message||'讀取失敗，請確認格式。'});}
};
