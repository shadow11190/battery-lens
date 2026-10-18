export const MAX_FILE=1024*1024*1024,MAX_EXPANDED=2*1024*1024*1024;
const MAX_INDEX=16*1024*1024;
export function decodeText(bytes){return new TextDecoder(bytes[0]===255&&bytes[1]===254?'utf-16le':bytes[0]===254&&bytes[1]===255?'utf-16be':'utf-8').decode(bytes);}
const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function updateCrc32(n,bytes){for(const b of bytes)n=table[(n^b)&255]^(n>>>8);return n;}
export function crc32(bytes){return (updateCrc32(0xffffffff,bytes)^0xffffffff)>>>0;}
async function slice(file,start,length){if(!Number.isSafeInteger(start)||start<0||start+length>file.size)throw Error('ZIP 結構損壞或不完整。');return new Uint8Array(await file.slice(start,start+length).arrayBuffer());}
export async function readZipDirectory(file){
 if(file.size>MAX_FILE)throw Error('ZIP 超過 1 GiB 上限。');
 const tailStart=Math.max(0,file.size-65557),tail=await slice(file,tailStart,file.size-tailStart),v=new DataView(tail.buffer);let end=-1;
 for(let p=tail.length-22;p>=0;p--)if(v.getUint32(p,true)===0x06054b50&&p+22+v.getUint16(p+20,true)===tail.length){end=p;break;}
 if(end<0)throw Error('不是有效的 ZIP。');
 if(v.getUint16(end+4,true)||v.getUint16(end+6,true)||v.getUint16(end+8,true)!==v.getUint16(end+10,true))throw Error('不支援分卷 ZIP。');
 const count=v.getUint16(end+10,true),offset=v.getUint32(end+16,true),size=v.getUint32(end+12,true);
 if(count===65535||offset===0xffffffff||size===0xffffffff)throw Error('請先解壓 ZIP64，再選取 TXT。');
 if(count>10000||size>MAX_INDEX)throw Error('ZIP 索引過大，請先解壓並選取 TXT。');
 if(offset+size>tailStart+end)throw Error('ZIP 索引損壞。');
 const bytes=await slice(file,offset,size),index=new DataView(bytes.buffer),entries=[];let p=0;
 for(let i=0;i<count;i++){
  if(p+46>bytes.length||index.getUint32(p,true)!==0x02014b50)throw Error('ZIP 索引無效。');
  const flags=index.getUint16(p+8,true),method=index.getUint16(p+10,true),crc=index.getUint32(p+16,true),compressed=index.getUint32(p+20,true),expanded=index.getUint32(p+24,true),nl=index.getUint16(p+28,true),extra=index.getUint16(p+30,true),comment=index.getUint16(p+32,true),local=index.getUint32(p+42,true);
  if(p+46+nl+extra+comment>bytes.length)throw Error('ZIP 索引無效。');
  const name=decodeText(bytes.subarray(p+46,p+46+nl));p+=46+nl+extra+comment;
  if(/(^|\/)(bugreport[^/]*\.txt|dumpstate[^/]*\.txt)$/i.test(name)||/\/power_supply\/[^/]+\/(charge_full|charge_full_design|cycle_count|first_usage_date|manufacturing_date)$/.test(name))entries.push({name,flags,method,crc,compressed,expanded,local});
 }
 if(!entries.length)throw Error('ZIP 內找不到 bugreport*.txt、dumpstate*.txt 或支援的電池 sysfs 檔。');
 if(entries.length>100||entries.reduce((n,e)=>n+e.expanded,0)>MAX_EXPANDED)throw Error('相關報告解壓總量超過 2 GiB 或 100 個。');
 return entries;
}
export async function readZipReports(file,consume,{onProgress=()=>{},decompress=null}={}){
 const entries=await readZipDirectory(file),total=entries.reduce((n,e)=>n+e.expanded,0);let processed=0;
 const reports=[];
 for(const e of entries){
  if(e.flags&1)throw Error('不支援加密 ZIP，請先解壓。');
  if(e.method!==0&&e.method!==8)throw Error('不支援此 ZIP 壓縮格式，請先解壓。');
  const local=await slice(file,e.local,30),v=new DataView(local.buffer);
  if(v.getUint32(0,true)!==0x04034b50||v.getUint16(8,true)!==e.method)throw Error('ZIP 本機標頭無效。');
  const start=e.local+30+v.getUint16(26,true)+v.getUint16(28,true);
  if(start+e.compressed>file.size)throw Error('ZIP 結構損壞或不完整。');
  let stream=file.slice(start,start+e.compressed).stream();
  if(e.method===8){if(decompress)stream=decompress(stream);else{try{stream=stream.pipeThrough(new DecompressionStream('deflate-raw'));}catch{throw Error('此瀏覽器不支援 ZIP 解壓縮。請更新瀏覽器或先解壓後選取 TXT。');}}}
  let length=0,crc=0xffffffff;
  stream=stream.pipeThrough(new TransformStream({transform(chunk,controller){length+=chunk.length;if(length>e.expanded||processed+length>MAX_EXPANDED)throw Error('ZIP 解壓大小超過限制。');crc=updateCrc32(crc,chunk);onProgress({name:e.name,processed:processed+length,total});controller.enqueue(chunk);},flush(){if(length!==e.expanded||((crc^0xffffffff)>>>0)!==e.crc)throw Error('ZIP 完整性檢查失敗，請重新匯出報告。');}}));
  reports.push(await consume(stream,e.name));processed+=length;
 }
 return reports;
}
