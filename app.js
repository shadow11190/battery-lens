import {summarize} from './parser.js?v=1.2.0';
import {createReportImage} from './report-image.js?v=1.2.0';
const $=id=>document.getElementById(id);
const demoText='示範資料，非真實手機報告\nPOWER_SUPPLY_CHARGE_FULL=4320000\nPOWER_SUPPLY_CHARGE_FULL_DESIGN=5000000\nPOWER_SUPPLY_CYCLE_COUNT=328\nlevel: 67\nhealth: 2\ncharge counter: 2894400';
let reports=[],worker=null,busy=false,isDemo=false,summary=null,exportUrl=null,imageExportId=0;
const nf=new Intl.NumberFormat('zh-TW',{maximumFractionDigits:1});
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function disable(value){busy=value;for(const id of ['analyzeText','demo','applyDesign','export','exportImage','file'])$(id).disabled=value;$('dropzone').setAttribute('aria-disabled',String(value));}
function activate(paste){$('fileTab').setAttribute('aria-selected',String(!paste));$('pasteTab').setAttribute('aria-selected',String(paste));$('fileTab').tabIndex=paste?-1:0;$('pasteTab').tabIndex=paste?0:-1;$('filePanel').hidden=paste;$('pastePanel').hidden=!paste;}
$('fileTab').onclick=()=>activate(false);$('pasteTab').onclick=()=>activate(true);
for(const id of ['fileTab','pasteTab'])$(id).onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const paste=e.key==='End'||(e.key!=='Home'&&id==='fileTab');activate(paste);$(paste?'pasteTab':'fileTab').focus();}};
function cancelImageExport(){imageExportId++;$('exportImage').textContent='下載圖片 PNG ↓';}
function reset(){cancelImageExport();worker?.terminate();worker=null;reports=[];summary=null;isDemo=false;disable(false);$('result').hidden=true;$('emptyResult').hidden=false;$('source').replaceChildren();$('evidenceBody').replaceChildren();$('evidenceCount').textContent='0';$('evidencePanel').open=false;$('manualDesign').value='';$('manualError').textContent='';$('reportText').value='';$('file').value='';$('fileLabel').textContent='未選取檔案';$('resultBadge').textContent='等待匯入';status('準備好了，匯入第一份報告吧。');if(exportUrl){URL.revokeObjectURL(exportUrl);exportUrl=null;}}
async function analyze(data,demo=false){
 if(busy)return;
 cancelImageExport();
 worker?.terminate();reports=[];summary=null;isDemo=demo;$('manualDesign').value='';$('manualError').textContent='';$('result').hidden=true;$('emptyResult').hidden=false;$('evidenceBody').replaceChildren();$('evidenceCount').textContent='0';$('resultBadge').textContent='正在解析';status('在本機解析中，較大報告需要一些時間…');disable(true);
 $('fileLabel').textContent=demo?'示範資料 · 非真實測量':data.file?.name||'貼上的報告';
 try{
  worker=new Worker(new URL('./worker.js?v=1.2.0',import.meta.url),{type:'module'});
  worker.onmessage=({data:result})=>{
   if(result.progress){const p=result.progress;status(`本機掃描 ${p.total?Math.floor(p.processed/p.total*100):0}% · ${(p.processed/1048576).toFixed(1)} / ${(p.total/1048576).toFixed(1)} MiB（解壓後）`);return;}
   worker.terminate();worker=null;disable(false);
   if(result.error){$('resultBadge').textContent='讀取失敗';status(result.error,true);return;}
   reports=result.reports;const choices=reports.map((r,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${r.name} (${r.evidence.length} 個欄位)`;return o;});$('source').replaceChildren(...choices);
   const best=reports.findIndex(r=>summarize(r).health!==null);$('source').value=String(best>=0?best:Math.max(0,reports.findIndex(r=>r.evidence.length>0)));
   $('result').hidden=false;$('emptyResult').hidden=true;status(demo?'目前為合成範例，並非你的電池數據。':`已在本機讀取 ${result.count} 份文字資料。請核對下方來源。`);render();
  };
  worker.onerror=()=>{worker?.terminate();worker=null;disable(false);$('resultBadge').textContent='讀取失敗';status('解析失敗。請以新版瀏覽器開啟網站網址（不可直接用 file://），或縮小報告後重試。',true);};
  worker.postMessage(data);
 }catch{disable(false);$('resultBadge').textContent='讀取失敗';status('無法啟動本機分析，請使用 HTTP/HTTPS 網址與新版瀏覽器。',true);}
}
function render(){
 const report=reports[Number($('source').value)];if(!report)return;
 summary=summarize(report,$('manualDesign').value||null);
 $('resultBadge').textContent=isDemo?'示範資料':summary.health===null?'資料不足':'分析完成';
 $('health').replaceChildren(document.createTextNode(summary.health===null?'—':nf.format(summary.health)),Object.assign(document.createElement('span'),{textContent:'%'}));
 $('method').textContent=summary.method;$('platform').textContent=summary.platform==='ios'?'iPhone · 實驗性':summary.platform==='android'?'Android':summary.platform;
 $('full').textContent=summary.full===null?'—':`${nf.format(summary.full)} mAh`;$('design').textContent=summary.design===null?'—':`${nf.format(summary.design)} mAh`;$('cycleLabel').textContent=summary.cycleDisplay.label;$('cycles').textContent=summary.cycleDisplay.value===null?'—':`${summary.cycleDisplay.estimated?'約 ':''}${new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(summary.cycleDisplay.value)}`;
 $('capacityFill').style.width=`${Math.min(100,summary.health||0)}%`;
 $('extraMetrics').replaceChildren(...summary.details.map(d=>{const item=document.createElement('div'),label=document.createElement('span'),value=document.createElement('strong');label.textContent=d.label;value.textContent=d.display;item.append(label,value);if(d.sources.length){const source=document.createElement('small');source.textContent=d.sources.slice(0,2).map(s=>`${s.key} · ${s.source}:${s.line}`).join(' / ')+(d.sources.length>2?`；另 ${d.sources.length-2} 筆，見原始欄位`:'');item.append(source);}return item;}));
 $('warnings').replaceChildren(...summary.warnings.map(w=>Object.assign(document.createElement('li'),{textContent:w})));
 $('evidenceCount').textContent=summary.evidence.length;
 $('evidenceBody').replaceChildren(...summary.evidence.map(e=>{const tr=document.createElement('tr');for(const content of [e.key,`${e.raw} ${e.unit}`,typeof e.value==='string'?e.value:`${nf.format(e.value)} ${e.kind==='full'||e.kind==='design'?'mAh':e.unit}`,`${e.source}:${e.line}${e.group?' · '+e.group:''}`]){const td=document.createElement('td');td.textContent=content;tr.append(td);}return tr;}));
}
$('source').onchange=()=>{$('manualDesign').value='';$('manualError').textContent='';render();};
$('applyDesign').onclick=()=>{const value=$('manualDesign').value;if($('manualDesign').validity.badInput||(value!==''&&(!Number.isFinite(Number(value))||Number(value)<10||Number(value)>100000))){$('manualError').textContent='請輸入 10～100,000 mAh，或留空以使用報告值。';return;}$('manualError').textContent='';render();};
$('manualDesign').onkeydown=e=>{if(e.key==='Enter')$('applyDesign').click();};
$('file').onchange=e=>{if(e.target.files[0])analyze({file:e.target.files[0]});};
$('analyzeText').onclick=()=>{const text=$('reportText').value;if(!text.trim()){status('請先貼上報告文字。',true);return;}if(text.length>20*1024*1024){status('貼上文字超過 20 Mi 字元，請改用檔案匯入。',true);return;}analyze({text});};
$('demo').onclick=()=>analyze({text:demoText},true);$('clear').onclick=reset;
for(const event of ['dragenter','dragover'])$('dropzone').addEventListener(event,e=>{e.preventDefault();if(!busy)$('dropzone').classList.add('drag');});
for(const event of ['dragleave','drop'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.remove('drag');});
$('dropzone').addEventListener('drop',e=>{if(busy)return;const files=e.dataTransfer.files;if(files.length!==1){status('請一次選取一份報告，避免混用手機資料。',true);return;}analyze({file:files[0]});});
function download(blob,name){if(exportUrl)URL.revokeObjectURL(exportUrl);exportUrl=URL.createObjectURL(blob);const a=document.createElement('a');a.href=exportUrl;a.download=name;document.body.append(a);a.click();a.remove();}
$('export').onclick=()=>{if(!summary)return;const output={tool:'Battery Lens',version:'1.2.0',createdAt:new Date().toISOString(),demo:isDemo,source:reports[Number($('source').value)].name,healthPercent:summary.health,method:summary.method,fullChargeCapacityMah:summary.full,designCapacityMah:summary.design,designCapacityManuallyProvided:summary.manual,cycleCount:summary.cycles,displayedCycle:summary.cycleDisplay,additionalMetrics:summary.details,warnings:summary.warnings,evidence:summary.evidence};download(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}),isDemo?'battery-lens-demo.json':'battery-lens-summary.json');};
$('exportImage').onclick=async()=>{
 if(!summary)return;const snapshot=summary,source=reports[Number($('source').value)].name,demo=isDemo,id=++imageExportId;
 $('exportImage').disabled=true;$('exportImage').textContent='正在產生圖片…';
 try{const blob=await createReportImage(snapshot,{source,demo});if(id!==imageExportId)return;download(blob,demo?'battery-lens-demo.png':'battery-lens-summary.png');status('已產生 PNG 圖片，可在下載項目中開啟或分享。');}
 catch(error){if(id===imageExportId)status(error.message||'圖片產生失敗，請重試或下載 JSON。',true);}
 finally{if(id===imageExportId){$('exportImage').disabled=busy;$('exportImage').textContent='下載圖片 PNG ↓';}}
};
