
const {C,f}=M;const t=M.textG;
let g='';for(let k=0;k<14;k++){let s='';for(let x=11;x<=199;x+=2){const y=18+k*2+2.2*Math.sin(x*0.09+k*0.45)+1.2*Math.sin(x*0.21-k*0.3);s+=(s?'L':'M')+f(x)+' '+f(y);}g+=s;}
const notch=(x,y)=>'<circle cx="'+x+'" cy="'+y+'" r="3" fill="'+C.paper+'" stroke="'+C.emerald+'" stroke-width="0.2"/>';
const FIELDS={qr:[160,240,29.63,29.63],photo:[73,94,64,64],name:[20,166,170,22],catid:[20,200,170,10],date:[20,220,170,10]};
async function frame(sample){
 let s='<rect x="0" y="0" width="210" height="297" fill="'+C.paper+'"/>';
 s+='<path d="'+g+'" fill="none" stroke="'+C.emerald+'" stroke-opacity=".12" stroke-width="0.18"/>';
 s+='<rect x="8" y="8" width="194" height="281" rx="3" fill="none" stroke="'+C.emerald+'" stroke-width="0.6"/><rect x="11" y="11" width="188" height="275" rx="1.5" fill="none" stroke="'+C.emerald+'" stroke-width="0.2"/>';
 s+=notch(11,148.5)+notch(199,148.5);
 s+='<rect x="84" y="16" width="42" height="31" fill="'+C.paper+'"/>'+M.logoG('stacked',C.emerald,90,19,30,19);
 s+=await t('mono500','THE MORACAT REGISTER',2.1,105,44.5,C.copper,'center',{tracking:.2});
 s+=await t('lyon','شهادة تسجيل في سجل مرقط',11,105,64,C.ink,'center');
 s+=await t('fraunces500i','Certificate of registration in the Moracat register',5,105,74.5,C.emerald,'center');
 s+='<path d="M40 83H170" stroke="'+C.ink+'" stroke-opacity=".25" stroke-width="0.25" stroke-dasharray="1 1"/>';
 s+='<rect x="71" y="92" width="68" height="68" rx="9" fill="none" stroke="'+C.emerald+'" stroke-width="0.3"/>';
 s+=sample?'<rect x="73" y="94" width="64" height="64" rx="7" fill="#D9C6AE"/>'+await t('mono400','CAT PHOTO',2.4,105,127,'#7A6650','center',{tracking:.2}):'<rect x="73" y="94" width="64" height="64" rx="7" fill="'+C.cream+'"/>';
 const row=async(y,ar,en)=>'<path d="M20 '+y+'H190" stroke="'+C.ink+'" stroke-opacity=".35" stroke-width="0.25"/>'+await t('plexAr400',ar,3.2,190,y+5,'#3D4B47','right')+await t('inter400',en,2.8,20,y+5,'#3D4B47','left');
 s+=await row(188,'اسم القط',"Cat's name")+await row(210,'رقم الهوية','Cat ID')+await row(230,'تاريخ الإصدار','Date issued');
 if(sample){s+=await t('lyon','لولو',13,105,184,C.ink,'center')+await t('mono500','MRC-2K9F-7YQ3',4.2,105,207,C.copper,'center',{tracking:.12})+await t('mono400','2026-10-03',3.6,105,227.5,C.ink,'center',{tracking:.06});}
 s+=await M.sealG(38,257,17,C.copper);
 s+='<rect x="158" y="238" width="33.63" height="33.63" rx="1.5" fill="#FFFFFF" stroke="'+C.ink+'" stroke-opacity=".2" stroke-width="0.2"/>';
 if(sample){s+='<rect x="160" y="240" width="29.63" height="29.63" fill="none" stroke="'+C.ink+'" stroke-width="0.3" stroke-dasharray="1 0.8"/>'+await t('mono400','QR 84PT',2.2,174.8,256,C.ink,'center');}
 s+=await t('plexAr700','امسح للتحقق',3.2,153,252,C.ink,'right')+await t('inter400','Scan to verify this record',2.6,153,257.5,'#3D4B47','right');
 s+=await t('plexAr400','صفحة من سجل قطك في مرقط',2.8,105,279,'#3D4B47','center');
 s+=await t('mono400','MORACAT.CO',2,105,283.5,C.copper,'center',{tracking:.24});
 return s;
}
return {frame,FIELDS};