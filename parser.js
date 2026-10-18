// Explicit allowlist: state of charge and charge_counter are deliberately excluded.
const specs = [
 ['full', 'android', 'uAh', ['POWER_SUPPLY_CHARGE_FULL','charge_full','batteryFullChargeUah','Full charge','Full charge capacity']],
 ['design','android','uAh',['POWER_SUPPLY_CHARGE_FULL_DESIGN','charge_full_design','batteryFullChargeDesignCapacityUah']],
 ['cycles','android','count',['POWER_SUPPLY_CYCLE_COUNT','cycle_count','batteryCycleCount','Cycle count']],
 ['percent','android','%',['mSavedBatteryAsoc']],
 ['bsoh','android','%',['mSavedBatteryBsoh']],
 ['usage','android','cycles×100',['mSavedBatteryUsage']],
 ['firstUse','android','YYYYMMDD',['battery FirstUseDate','mSavedBatteryFirstUsedDate','mSavedBatteryFirstUseDate']],
 ['firstUse','android','epoch-s',['batteryFirstUsageSeconds','first_usage_date']],
 ['manufactured','android','epoch-s',['batteryManufacturingDateSeconds','manufacturing_date']],
 ['manufactured','android','YYYYMMDD',['mSavedBatteryManufactureDate']],
 ['temperature','android','0.1°C',['batteryTemperatureTenthsCelsius','temperature']],
 ['voltage','android','mV',['batteryVoltageMillivolts','voltage']],
 ['level','android','%',['batteryLevel','level']],
 ['status','android','code',['batteryStatus','status']],
 ['percent','ios','%', ['MaximumCapacityPercent']],
 ['full','ios','mAh',['NominalChargeCapacity']],
 ['design','ios','mAh',['DesignCapacity']],
 ['cycles','ios','count',['CycleCount']]
];
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function createReportParser(name='報告') {
 const evidence=[],seen=new Set();let context='',pending=null,lineNumber=0,inBatteryService=false;
 const definitions=specs.flatMap(([kind,platform,defaultUnit,keys])=>keys.map(key=>({kind,platform,defaultUnit,key,
  serviceOnly:['temperature','voltage','level','status'].includes(key),
  regex:new RegExp('(?:^|[\\s{,])(?:["\']?(?:last_value_)?'+escape(key)+'["\']?)(?:\\s*\\((mAh|[uµμ]Ah)\\))?\\s*[:=]\\s*(?:["\']?\\[?)(-?\\d+(?:\\.\\d+)?)(?:\\s*(mAh|[uµμ]Ah|%))?(?=["\'\\s,}\\]]|$)','gi')})));
 function add(def,raw,unit,group,line=lineNumber) {
  const {kind,platform,key}=def;unit=unit.replace(/[µμ]/g,'u');
  if(!Number.isFinite(raw)||raw<0||(['full','design','percent','bsoh','firstUse','manufactured'].includes(kind)&&raw===0))return;
  if(kind==='cycles'&&(!Number.isInteger(raw)||raw>100000))return;
  if(['percent','bsoh'].includes(kind)&&raw>150)return;
  let value=unit==='uAh'?raw/1000:raw;
  if(kind==='temperature'){value=raw/10;unit='°C';if(value>100)return;}
  if(kind==='level'&&raw>100)return;
  if(kind==='voltage'&&(raw<1000||raw>20000))return;
  if(kind==='status'&&(!Number.isInteger(raw)||raw<1||raw>5))return;
  if(kind==='usage'&&raw>10000000)return;
  if(kind==='firstUse'||kind==='manufactured'){
   let date;if(unit==='epoch-s')date=new Date(raw*1000);else{const s=String(raw);if(!/^\d{8}$/.test(s))return;date=new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T00:00:00Z`);if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10).replaceAll('-','')!==s)return;}
   if(!Number.isFinite(date.getTime())||date.getUTCFullYear()<2000||date.getUTCFullYear()>2100)return;
   value=date.toISOString().slice(0,10);
  }
  if((kind==='full'||kind==='design')&&(value<10||value>100000))return;
  const fingerprint=[kind,platform,group,value,key].join('|');if(seen.has(fingerprint))return;
  if(evidence.length>=5000)throw Error('電池欄位過多，請選取較小的相關報告。');
  seen.add(fingerprint);evidence.push({kind,platform,group,key,raw,unit,value,line,source:name});
 }
 function feedLine(line) {
  lineNumber++;
  if(/^DUMP OF SERVICE\s+/i.test(line))inBatteryService=/^DUMP OF SERVICE battery\s*:/i.test(line);
  if(/^\s*Current Battery Service state\s*:/i.test(line))inBatteryService=true;
  if(pending){if(/^\s*\d+\s*$/.test(line))add(pending.def,Number(line),pending.def.defaultUnit,pending.group,pending.line);pending=null;}
  // Path-qualified batteries are kept separate, including ZIP sysfs members.
  const path=(line.match(/\/power_supply\/([^/\s:]+)\//)||name.match(/\/power_supply\/([^/\s:]+)\//))?.[1];
  if(path) context=path;
  if(/^------|^DUMP OF SERVICE/.test(line)) context='';
  if(!/charge_full|Full.?charge|batteryFullCharge|cycle.?count|MaximumCapacityPercent|NominalChargeCapacity|DesignCapacity|mSavedBattery|FirstUseDate|first_usage_date|batteryFirstUsageSeconds|ManufacturingDate|manufacturing_date|batteryTemperature|batteryVoltage|batteryLevel|batteryStatus|^(?:\s*)(?:temperature|voltage|level|status)\s*:/i.test(line)) return;
  for(const def of definitions) {
    const {platform,defaultUnit,key,regex:re}=def;re.lastIndex=0;
    if(def.serviceOnly&&!inBatteryService)continue;
    let match;
    while((match=re.exec(line))) add(def,Number(match[2]),match[3]||match[1]||defaultUnit,context);
    // sysfs path followed by a number, on the same or next line.
    if(platform==='android' && /^(charge_|cycle_count$|first_usage_date$|manufacturing_date$)/.test(key)) {
     const pm=line.match(new RegExp('/power_supply/([^/\\s]+)/'+escape(key)+'(?:\\s*[:=]\\s*|\\s+)(-?\\d+)(?:\\s*(mAh|[uµμ]Ah))?\\s*$','i'));
     if(pm) add(def,Number(pm[2]),pm[3]||defaultUnit,pm[1]);
     const pn=line.match(new RegExp('/power_supply/([^/\\s]+)/'+escape(key)+'[\\s:=-]*$','i'));
     if(pn) pending={def,group:pn[1],line:lineNumber};
    }
  }
 }
 return {feedLine,result:()=>({name,evidence})};
}
export function parseReport(text,name='報告') {
 const parser=createReportParser(name);for(const line of text.split(/\r?\n/))parser.feedLine(line);return parser.result();
}
export async function scanReportStream(stream,name='報告') {
 const parser=createReportParser(name),reader=stream.getReader();let decoder=null,head=new Uint8Array(0),carry='';
 const sysfs=/\/power_supply\/[^/]+\/(charge_full|charge_full_design|cycle_count|first_usage_date|manufacturing_date)$/.test(name);
 function consume(text,final=false){carry+=text;const lines=carry.split('\n');carry=final?'':lines.pop();for(let line of lines){line=line.replace(/\r$/,'');parser.feedLine(sysfs?`/${name}: ${line}`:line);}if(carry.length>4*1024*1024)throw Error('單行文字超過 4 MiB，無法安全解析此格式。');}
 try {
  while(true){const {done,value}=await reader.read();if(done)break;
   if(!decoder){const combined=new Uint8Array(head.length+value.length);combined.set(head);combined.set(value,head.length);head=combined;if(head.length<2)continue;decoder=new TextDecoder(head[0]===255&&head[1]===254?'utf-16le':head[0]===254&&head[1]===255?'utf-16be':'utf-8');consume(decoder.decode(head,{stream:true}));head=new Uint8Array(0);}
   else consume(decoder.decode(value,{stream:true}));
  }
  consume(decoder?decoder.decode():new TextDecoder().decode(head),true);
 }catch(error){await reader.cancel(error).catch(()=>{});throw error;}finally{reader.releaseLock();}
 return parser.result();
}
export function summarize(report, manualDesign=null) {
 const e=report.evidence;
 const healthKinds=['full','design','percent'];
 const platforms=[...new Set(e.filter(x=>healthKinds.includes(x.kind)).map(x=>x.platform))];
 const groups=[...new Set(e.filter(x=>x.group&&healthKinds.includes(x.kind)).map(x=>x.group))];
 const warnings=[];
 const field=k=>{
  const entries=e.filter(x=>x.kind===k);
  const values=[...new Set(entries.map(x=>x.value))];
  if(values.length>1) warnings.push(`${{full:'滿充容量',design:'設計容量',percent:'健康度百分比',cycles:'循環次數'}[k]}出現多個不同數值，未自動選取。`);
  return values.length===1?values[0]:null;
 };
 const full=field('full'), foundDesign=field('design'), percent=field('percent'), cycles=field('cycles');
 const usageValues=[...new Set(e.filter(x=>x.kind==='usage').map(x=>x.value))];
 const estimatedCycles=usageValues.length===1&&usageValues[0]>0?usageValues[0]/100:null;
 const useEstimatedCycles=estimatedCycles!==null&&(cycles===null||cycles===0);
 const cycleDisplay={value:useEstimatedCycles?estimatedCycles:cycles,estimated:useEstimatedCycles,label:useEstimatedCycles?'等效循環（估算）':'標準循環次數',source:useEstimatedCycles?'mSavedBatteryUsage ÷ 100':'報告標準循環欄位',standardReportedValue:cycles};
 const manual=manualDesign!==null && manualDesign!=='' ? Number(manualDesign):null;
 const validManual=manual!==null&&Number.isFinite(manual)&&manual>=10&&manual<=100000;
 const design=validManual?manual:foundDesign;
 let health=null, method='資料不足';
 if(platforms.length>1||groups.length>1) warnings.push('偵測到不同平台或多個電池來源，請分開提供單一電池資料。');
 else if(e.some(x=>x.kind==='percent') && percent===null) { /* conflicting direct values: do not fall back */ }
 else if(percent!==null) {health=percent;method=e.some(x=>x.key==='mSavedBatteryAsoc')?'Samsung ASOC（廠商回報）':'報告中的百分比（相容性讀取）';}
 else if(full!==null && design!==null) {health=full/design*100;method=validManual?'容量比值估算 · 手動設計容量':'容量比值估算';}
 if(health!==null && (health<1||health>150)) {health=null;warnings.push('容量比例異常，請檢查電池來源與單位。');}
 if(health!==null && health>100) warnings.push('原始結果超過 100%，已保留；可能與容量公差、校準或欄位語意有關。');
 if(percent!==null&&full!==null&&design!==null&&Math.abs(full/design*100-percent)>3) warnings.push('百分比與容量比值不一致；此處顯示報告百分比，請核對原始資料。');
 if(platforms.includes('ios')) warnings.push('Apple 未公開保證這些分析欄位的格式與語意；結果僅供參考，以系統「電池健康度」為準。');
 if(full!==null&&full===design)warnings.push('滿充與設計容量相同；部分廠商可能回報標稱值，容量比值 100% 不代表完全沒有老化。');
 if(e.some(x=>/^mSavedBattery/.test(x.key)))warnings.push('Samsung ASOC、BSOH 與使用量是廠商內部欄位，定義可能隨版本改變；分開顯示，不互相平均。使用量 ÷ 100 僅標為等效循環估算。');
 if(cycles===0&&e.some(x=>x.kind==='usage'&&x.value>0))warnings.push('標準循環欄位回報 0，但 Samsung 使用量不為 0；此 0 可能是未實作值，不能當作全新電池。');
 if(health===null) warnings.push('不能用目前電量、charge_counter 或 health: 2 計算容量健康度。若只有滿充容量，可輸入規格表的設計容量。');
 const detailSpecs=[['firstUse','首次使用日期'],['manufactured','製造日期'],['level','報告電量'],['temperature','報告溫度'],['voltage','報告電壓'],['status','充電狀態'],['bsoh','Samsung BSOH'],['usage','Samsung 等效循環（估算）']];
 const details=detailSpecs.map(([kind,label])=>{
  const entries=e.filter(x=>x.kind===kind),values=[...new Set(entries.map(x=>x.value))];let display='未提供';
  if(values.length){if(['firstUse','manufactured'].includes(kind))display=values.length===1?values[0]:'多筆日期（見原始欄位）';
   else if(kind==='status')display=values.length===1?({1:'未知',2:'充電中',3:'放電中',4:'未充電',5:'已充滿'}[values[0]]):'多種狀態（見原始欄位）';
   else {const converted=values.map(v=>kind==='usage'?v/100:v),format=v=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(v);display=converted.length===1?format(converted[0]):`${format(Math.min(...converted))}～${format(Math.max(...converted))}`;display+=({level:'%',temperature:' °C',voltage:' mV',bsoh:'%',usage:' 次'}[kind]||'');}}
  return {kind,label,display,sources:entries.map(x=>({source:x.source,line:x.line,key:x.key}))};
 });
 return {health,method,full,design,cycles,cycleDisplay,details,platform:platforms.join(' / ')||'未知',manual:validManual,warnings,evidence:e};
}
