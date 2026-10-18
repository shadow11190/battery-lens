import {parseReport} from './parser.js';
import {readZip,decodeText,MAX_FILE} from './zip.js';
self.onmessage=async({data})=>{
 try{
  let reports;
  if(data.file){
   if(data.file.size>MAX_FILE)throw Error('檔案超過 80 MiB。請先解壓，選取較小的主報告 TXT。');
   const bytes=new Uint8Array(await data.file.arrayBuffer());
   reports=/\.zip$/i.test(data.file.name)?await readZip(bytes):[{name:data.file.name,text:decodeText(bytes)}];
  }else reports=[{name:'貼上的報告',text:data.text}];
  const parsed=reports.map(x=>parseReport(x.text,x.name));
  // Merge sysfs files only when their exact battery directory matches.
  const groups=new Map(), normal=[];
  for(const r of parsed){const m=r.name.match(/^(.*\/power_supply\/[^/]+)\//);if(!m){normal.push(r);continue;}if(!groups.has(m[1]))groups.set(m[1],{name:m[1],evidence:[]});groups.get(m[1]).evidence.push(...r.evidence);}
  self.postMessage({reports:[...normal,...groups.values()],count:reports.length});
 }catch(error){self.postMessage({error:error.message||'讀取失敗，請確認格式。'});}
};
