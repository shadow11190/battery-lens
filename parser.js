// Explicit allowlist: state of charge and charge_counter are deliberately excluded.
const specs = [
 ['full', 'android', 'uAh', ['POWER_SUPPLY_CHARGE_FULL','charge_full','batteryFullChargeUah','Full charge','Full charge capacity']],
 ['design','android','uAh',['POWER_SUPPLY_CHARGE_FULL_DESIGN','charge_full_design','batteryFullChargeDesignCapacityUah']],
 ['cycles','android','count',['POWER_SUPPLY_CYCLE_COUNT','cycle_count','batteryCycleCount','Cycle count']],
 ['percent','ios','%', ['MaximumCapacityPercent']],
 ['full','ios','mAh',['NominalChargeCapacity']],
 ['design','ios','mAh',['DesignCapacity']],
 ['cycles','ios','count',['CycleCount']]
];
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function parseReport(text, name='報告') {
 const evidence=[];
 const lines=text.split(/\r?\n/);
 const seen=new Set();
 let context='';
 for(let i=0;i<lines.length;i++) {
  const line=lines[i];
  // Path-qualified batteries are kept separate, including ZIP sysfs members.
  const path=(line.match(/\/power_supply\/([^/\s:]+)\//)||name.match(/\/power_supply\/([^/\s:]+)\//))?.[1];
  if(path) context=path;
  if(/^------|^DUMP OF SERVICE/.test(line)) context='';
  if(!/charge_full|Full.?charge|batteryFullCharge|cycle.?count|MaximumCapacityPercent|NominalChargeCapacity|DesignCapacity/i.test(line)) continue;
  for(const [kind,platform,defaultUnit,keys] of specs) {
   for(const key of keys) {
    const re=new RegExp('(?:^|[\\s{,])(?:["\']?(?:last_value_)?'+escape(key)+'["\']?)(?:\\s*\\((mAh|[uµμ]Ah)\\))?\\s*[:=]\\s*["\']?(-?\\d+(?:\\.\\d+)?)(?:\\s*(mAh|[uµμ]Ah|%))?(?=["\'\\s,}\\]]|$)','gi');
    let match;
    while((match=re.exec(line))) add(Number(match[2]),match[3]||match[1]||defaultUnit);
    // sysfs path followed by a number, on the same or next line.
    if(platform==='android' && /^charge_|^cycle_count$/.test(key)) {
     const pm=line.match(new RegExp('/power_supply/([^/\\s]+)/'+escape(key)+'(?:\\s*[:=]\\s*|\\s+)(-?\\d+)(?:\\s*(mAh|[uµμ]Ah))?\\s*$','i'));
     if(pm) add(Number(pm[2]),pm[3]||defaultUnit,pm[1]);
     const pn=line.match(new RegExp('/power_supply/([^/\\s]+)/'+escape(key)+'[\\s:=-]*$','i'));
     if(pn && /^\s*\d+\s*$/.test(lines[i+1]||'')) add(Number(lines[i+1]),defaultUnit,pn[1]);
    }
    function add(raw,unit,group=context) {
     unit=unit.replace(/[µμ]/g,'u');
     if(!Number.isFinite(raw)||raw<0 || (kind!=='cycles'&&raw===0)) return;
     if(kind==='cycles' && (!Number.isInteger(raw)||raw>100000)) return;
     if(kind==='percent' && raw>150) return;
     const value=unit==='uAh'?raw/1000:raw;
     if((kind==='full'||kind==='design') && (value<10||value>100000)) return;
     const fingerprint=[kind,platform,group,value,key].join('|');
     if(seen.has(fingerprint)) return;
     seen.add(fingerprint);
     evidence.push({kind,platform,group,key,raw,unit,value,line:i+1,source:name});
    }
   }
  }
 }
 return {name,evidence};
}
export function summarize(report, manualDesign=null) {
 const e=report.evidence;
 const platforms=[...new Set(e.map(x=>x.platform))];
 const groups=[...new Set(e.filter(x=>x.group).map(x=>x.group))];
 const warnings=[];
 const field=k=>{
  const entries=e.filter(x=>x.kind===k);
  const values=[...new Set(entries.map(x=>x.value))];
  if(values.length>1) warnings.push(`${{full:'滿充容量',design:'設計容量',percent:'健康度百分比',cycles:'循環次數'}[k]}出現多個不同數值，未自動選取。`);
  return values.length===1?values[0]:null;
 };
 const full=field('full'), foundDesign=field('design'), percent=field('percent'), cycles=field('cycles');
 const manual=manualDesign!==null && manualDesign!=='' ? Number(manualDesign):null;
 const validManual=manual!==null&&Number.isFinite(manual)&&manual>=10&&manual<=100000;
 const design=validManual?manual:foundDesign;
 let health=null, method='資料不足';
 if(platforms.length>1||groups.length>1) warnings.push('偵測到不同平台或多個電池來源，請分開提供單一電池資料。');
 else if(e.some(x=>x.kind==='percent') && percent===null) { /* conflicting direct values: do not fall back */ }
 else if(percent!==null) {health=percent;method='報告中的百分比（相容性讀取）';}
 else if(full!==null && design!==null) {health=full/design*100;method=validManual?'容量比值估算 · 手動設計容量':'容量比值估算';}
 if(health!==null && (health<1||health>150)) {health=null;warnings.push('容量比例異常，請檢查電池來源與單位。');}
 if(health!==null && health>100) warnings.push('原始結果超過 100%，已保留；可能與容量公差、校準或欄位語意有關。');
 if(percent!==null&&full!==null&&design!==null&&Math.abs(full/design*100-percent)>3) warnings.push('百分比與容量比值不一致；此處顯示報告百分比，請核對原始資料。');
 if(platforms.includes('ios')) warnings.push('Apple 未公開保證這些分析欄位的格式與語意；結果僅供參考，以系統「電池健康度」為準。');
 if(health===null) warnings.push('不能用目前電量、charge_counter 或 health: 2 計算容量健康度。若只有滿充容量，可輸入規格表的設計容量。');
 return {health,method,full,design,cycles,platform:platforms.join(' / ')||'未知',manual:validManual,warnings,evidence:e};
}
