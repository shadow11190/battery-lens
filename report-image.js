// Render the same analysis snapshot as a standalone PNG, entirely on this device.
export async function createReportImage(summary,{source='報告',demo=false,createdAt=new Date()}={}) {
 await document.fonts?.ready;
 const canvas=document.createElement('canvas');canvas.width=1080;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('此瀏覽器無法產生圖片。');
 const colors={paper:'#f6f7f1',ink:'#203e30',muted:'#66735f',line:'#dce1d4',lime:'#bce97c'};
 const family='"Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif';
 const font=(size,weight=400)=>`${weight} ${size}px ${family}`;
 const lines=(text,width,size=22,weight=400)=>{
  ctx.font=font(size,weight);const out=[];
  for(const paragraph of String(text).split('\n')){let row='';for(const ch of paragraph){if(row&&ctx.measureText(row+ch).width>width&&!/[，。、；：！？）》」』]/.test(ch)){out.push(row);row=ch;}else row+=ch;}out.push(row);}
  return out;
 };
 const details=summary.details||[];
 const notes=[...summary.warnings];
 if(demo)notes.unshift('示範資料：這張圖片不是你的手機測量結果。');
 if(summary.manual)notes.unshift('設計容量由使用者手動提供，結果已標記為估算。');
 const sourceLines=lines(`報告來源：${String(source).slice(0,400)}`,920,20);
 const noteLines=notes.flatMap(note=>lines(`• ${note}`,920,22));
 const detailStart=684,notesStart=detailStart+Math.ceil(details.length/2)*134+38;
 const sourceStart=notesStart+(noteLines.length?48+noteLines.length*34:0)+30;
 canvas.height=sourceStart+sourceLines.length*30+146;
 const text=(value,x,y,size=24,color=colors.ink,weight=400)=>{ctx.font=font(size,weight);ctx.fillStyle=color;ctx.textBaseline='top';ctx.fillText(value,x,y);};
 const box=(x,y,w,h,fill,r=20)=>{ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();};
 const number=value=>value===null||value===undefined?'未提供':new Intl.NumberFormat('zh-TW',{maximumFractionDigits:1}).format(value);
 const metric=(label,value,x,y,width=280)=>{text(label,x,y,21,colors.muted);const wrapped=lines(value,width,29,650);wrapped.forEach((line,i)=>text(line,x,y+36+i*35,29,colors.ink,650));};
 ctx.fillStyle=colors.paper;ctx.fillRect(0,0,canvas.width,canvas.height);
 box(64,56,37,44,colors.ink,8);box(76,49,13,9,colors.ink,3);box(71,64,23,29,colors.lime,4);
 text('BATTERY LENS',120,62,28,colors.ink,750);
 text('電池分析摘要',64,132,48,colors.ink,750);
 text(`匯出時間：${new Intl.DateTimeFormat('zh-TW',{dateStyle:'medium',timeStyle:'short'}).format(createdAt)}`,66,197,21,colors.muted);
 box(48,254,984,254,'#ffffff',24);
 text('電池健康度（報告／估算）',80,282,23,colors.muted);
 text(summary.health===null?'無法計算':`${number(summary.health)}%`,77,332,summary.health===null?62:94,colors.ink,750);
 const badge=demo?'示範資料':summary.platform==='ios'?'iPhone · 實驗性':summary.platform==='android'?'Android':'資料不足';
 box(750,284,245,45,demo?'#fff2cb':'#edf2e6',10);text(badge,770,295,21,colors.ink,600);
 text(summary.method,81,440,25,colors.muted);
 box(80,482,920,7,'#e6ebdf',3);
 if(summary.health!==null)box(80,482,920*Math.min(100,Math.max(0,summary.health))/100,7,'#4d703b',3);
 box(48,532,984,122,'#eaf0e2',20);
 metric('滿充容量',summary.full===null?'未提供':`${number(summary.full)} mAh`,80,555);
 metric(summary.manual?'設計容量（手動）':'設計容量',summary.design===null?'未提供':`${number(summary.design)} mAh`,397,555);
 const cycle=summary.cycleDisplay;
 metric(cycle.label,cycle.value===null?'未提供':`${cycle.estimated?'約 ':''}${new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(cycle.value)} 次`,714,555);
 details.forEach((d,i)=>{const x=48+(i%2)*504,y=detailStart+Math.floor(i/2)*134;box(x,y,480,116,'#ffffff',16);metric(d.label,d.display,x+28,y+20,424);});
 if(noteLines.length){text('解讀提醒',64,notesStart,24,colors.ink,650);noteLines.forEach((line,i)=>text(line,64,notesStart+46+i*34,22,colors.muted));}
 sourceLines.forEach((line,i)=>text(line,64,sourceStart+i*30,20,colors.muted));
 const footerY=canvas.height-92;
 ctx.strokeStyle=colors.line;ctx.beginPath();ctx.moveTo(64,footerY-20);ctx.lineTo(1016,footerY-20);ctx.stroke();
 text('報告在本機解析 · 內容為報告值或估算，非即時測量',64,footerY,20,colors.muted);
 text('shadow11190.github.io/battery-lens',64,footerY+35,20,colors.muted);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('圖片產生失敗，請重試或下載 JSON。')),'image/png'));
}
