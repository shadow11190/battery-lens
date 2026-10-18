export const MAX_FILE=80*1024*1024, MAX_EXPANDED=120*1024*1024;
export function decodeText(bytes) {
 const encoding=bytes[0]===255&&bytes[1]===254?'utf-16le':bytes[0]===254&&bytes[1]===255?'utf-16be':'utf-8';
 return new TextDecoder(encoding).decode(bytes);
}
const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=table[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
async function inflateRaw(bytes,expected) {
 let ds;
 try {ds=new DecompressionStream('deflate-raw');}catch {throw Error('此瀏覽器不支援 ZIP 解壓縮。請先解壓後選取主報告 TXT。');}
 const reader=new Blob([bytes]).stream().pipeThrough(ds).getReader();
 const chunks=[];let length=0;
 try {while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>expected||length>MAX_EXPANDED){await reader.cancel();throw Error('ZIP 解壓大小超過限制。');}chunks.push(value);}}
 finally {reader.releaseLock();}
 const out=new Uint8Array(length);let pos=0;for(const c of chunks){out.set(c,pos);pos+=c.length;}return out;
}
export async function readZip(bytes,inflate=inflateRaw) {
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const range=(o,n)=>{if(o<0||o+n>bytes.length)throw Error('ZIP 結構損壞或不完整。');};
 let end=-1;
 for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--) if(v.getUint32(p,true)===0x06054b50 && p+22+v.getUint16(p+20,true)===bytes.length){end=p;break;}
 if(end<0)throw Error('不是有效的 ZIP。');
 if(v.getUint16(end+4,true)||v.getUint16(end+6,true))throw Error('不支援分卷 ZIP。');
 const count=v.getUint16(end+10,true), offset=v.getUint32(end+16,true), size=v.getUint32(end+12,true);
 if(count===65535||offset===0xffffffff||size===0xffffffff)throw Error('請先解壓 ZIP64，再選取 TXT。');
 if(count>10000)throw Error('ZIP 內檔案過多，請先解壓並選取 TXT。');
 range(offset,size);if(offset+size>end)throw Error('ZIP 索引損壞。');
 const entries=[];let p=offset;
 for(let i=0;i<count;i++){
  range(p,46);if(v.getUint32(p,true)!==0x02014b50)throw Error('ZIP 索引無效。');
  const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),crc=v.getUint32(p+16,true),compressed=v.getUint32(p+20,true),expanded=v.getUint32(p+24,true),nl=v.getUint16(p+28,true),extra=v.getUint16(p+30,true),comment=v.getUint16(p+32,true),local=v.getUint32(p+42,true);
  range(p+46,nl+extra+comment);const name=decodeText(bytes.subarray(p+46,p+46+nl));p+=46+nl+extra+comment;
  if(/(^|\/)(bugreport[^/]*\.txt|dumpstate[^/]*\.txt)$/i.test(name)||/\/power_supply\/[^/]+\/(charge_full|charge_full_design|cycle_count)$/.test(name))entries.push({name,flags,method,crc,compressed,expanded,local});
 }
 if(!entries.length)throw Error('ZIP 內找不到 bugreport*.txt、dumpstate*.txt 或支援的電池 sysfs 檔。請先解壓並選取相關 TXT。');
 if(entries.length>100 || entries.reduce((n,e)=>n+e.expanded,0)>MAX_EXPANDED)throw Error('相關報告超過 120 MiB 或 100 個，請解壓並單獨選取 TXT。');
 const reports=[];
 for(const e of entries){
  if(e.flags&1)throw Error('不支援加密 ZIP，請先解壓。');
  if(e.method!==0&&e.method!==8)throw Error('不支援此 ZIP 壓縮格式，請先解壓。');
  range(e.local,30);if(v.getUint32(e.local,true)!==0x04034b50)throw Error('ZIP 本機標頭無效。');
  const start=e.local+30+v.getUint16(e.local+26,true)+v.getUint16(e.local+28,true);range(start,e.compressed);
  const body=bytes.subarray(start,start+e.compressed);const result=e.method===0?body:await inflate(body,e.expanded);
  if(result.length!==e.expanded||crc32(result)!==e.crc)throw Error('ZIP 完整性檢查失敗，請重新匯出報告。');
  let content=decodeText(result);
  if(/\/power_supply\/[^/]+\/(charge_full|charge_full_design|cycle_count)$/.test(e.name))content=`/${e.name}: ${content.trim()}`;
  reports.push({name:e.name,text:content});
 }
 return reports;
}
