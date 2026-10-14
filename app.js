'use strict';
const F=['tipTag','electronicId','ede','birthDate','sex','motherId','fatherId','litterSize','healthNotes'];
const H=['Tip Tag ID','Electronic ID','Farm EDE','Date of birth','Sex','Mother ID','Father ID','Kids per litter','Health notes'];
const K='goatlesspaper-v1',$=s=>document.querySelector(s);
const uid=()=>globalThis.crypto?.randomUUID?.()||String(Date.now())+Math.random();
const norm=a=>Object.fromEntries([['_id',a._id||uid()],...F.map(k=>[k,String(a[k]??'')])]);
let data=[];try{const v=JSON.parse(localStorage.getItem(K)||'[]');if(Array.isArray(v))data=v.map(norm)}catch(e){alert('Local data cannot be read. Restore a backup.')}
function save(){try{localStorage.setItem(K,JSON.stringify(data))}catch(e){alert('Local storage is unavailable. Export your data.');}updateDashboard();}
function cell(a,k){const w=document.createElement('div');if(k==='tipTag'||k==='electronicId')w.className='scan';const el=k==='healthNotes'?document.createElement('textarea'):k==='sex'?document.createElement('select'):document.createElement('input');if(k==='sex'){for(const[v,t]of[['','—'],['F','Female'],['M','Male'],['I','Unknown']]){const o=document.createElement('option');o.value=v;o.textContent=t;el.append(o)}}else if(k!=='healthNotes'){el.type=k==='birthDate'?'date':k==='litterSize'?'number':'text';if(k==='litterSize'){el.min='0';el.step='1'}}el.value=a[k];el.setAttribute('aria-label',H[F.indexOf(k)]);el.addEventListener('input',()=>{a[k]=el.value;save()});w.append(el);if(k==='tipTag'||k==='electronicId'){const b=document.createElement('button');b.textContent='📷';b.title='Scan '+H[F.indexOf(k)];b.onclick=()=>scan(a,k,el);w.append(b)}return w}
function render(){const q=$('#search').value.toLowerCase(),body=$('#rows');body.replaceChildren();for(const a of data.filter(a=>F.some(k=>a[k].toLowerCase().includes(q)))){const tr=document.createElement('tr'),n=document.createElement('td');n.textContent=data.indexOf(a)+1;tr.append(n);for(const k of F){const td=document.createElement('td');td.append(cell(a,k));tr.append(td)}const td=document.createElement('td'),b=document.createElement('button');b.textContent='Delete';b.onclick=()=>{if(confirm('Delete this animal?')){data=data.filter(x=>x!==a);save();render()}};td.append(b);tr.append(td);body.append(tr)}$('#count').textContent=data.length+' animals';updateDashboard()}
$('#add').onclick=()=>{data.push(norm({}));save();$('#search').value='';render()};$('#search').oninput=render;
const today=()=>new Date().toISOString().slice(0,10);
function dl(name,contents,type){const url=URL.createObjectURL(new Blob([contents],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function esc(v){v=String(v??'');return /[";\r\n]/.test(v)?'"'+v.replaceAll('"','""')+'"':v}
$('#export').onclick=()=>dl('GoatLessPaper-'+today()+'.csv','\ufeff'+[H,...data.map(a=>F.map(k=>a[k]))].map(r=>r.map(esc).join(';')).join('\r\n'),'text/csv;charset=utf-8');
$('#backup').onclick=()=>dl('GoatLessPaper-backup-'+today()+'.json',JSON.stringify({format:K,animals:data},null,2),'application/json');
function parseCsv(s){s=s.replace(/^\ufeff/,'');const out=[];let row=[],v='',quoted=false;for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){v+='"';i++}else quoted=!quoted}else if(!quoted&&(c===';'||c===',')){row.push(v);v=''}else if(!quoted&&(c==='\r'||c==='\n')){if(c==='\r'&&s[i+1]==='\n')i++;row.push(v);if(row.some(x=>x))out.push(row);row=[];v=''}else v+=c}if(quoted)throw Error('Invalid CSV file');row.push(v);if(row.some(x=>x))out.push(row);return out}
$('#import').onclick=()=>$('#csv').click();$('#csv').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{const rows=parseCsv(await file.text());if(!rows.length||H.some((h,i)=>h!==rows[0][i]))throw Error('CSV headers do not match');const added=rows.slice(1).map(r=>norm(Object.fromEntries(F.map((k,i)=>[k,r[i]||'']))));if(confirm('Add '+added.length+' animals?')){data.push(...added);save();render()}}catch(err){alert('Import failed: '+err.message)}};
$('#restore').onclick=()=>$('#json').click();$('#json').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{const j=JSON.parse(await file.text());if(j.format!==K||!Array.isArray(j.animals))throw Error('Incompatible backup format');if(confirm('Replace all local records with this backup?')){data=j.animals.map(norm);save();render()}}catch(err){alert('Restore failed: '+err.message)}};
let target=null,readerPromise=null,reader=null,controls=null,stream=null,nativeDetector=null,scanTimer=null,generation=0,processing=false;
const overlay=document.querySelector('#scanner'),video=document.querySelector('#scannerVideo'),status=document.querySelector('#scannerStatus');
const zoomInput=document.querySelector('#scanZoom'),zoomValue=document.querySelector('#scanZoomValue'),zoomHelp=document.querySelector('#scanZoomHelp');
let cameraZoomTrack=null,softwareZoom=1;
function activeCameraTrack(){return cameraZoomTrack?.readyState==='live'?cameraZoomTrack:(stream?.getVideoTracks?.()[0]||video.srcObject?.getVideoTracks?.()[0]||null)}
async function setScannerZoom(requested){
 const track=activeCameraTrack();
 const value=Math.max(1,Number(requested)||1);
 const capabilities=track?.getCapabilities?.()||{};
 if(track?.applyConstraints&&capabilities.zoom&&Number.isFinite(capabilities.zoom.min)&&Number.isFinite(capabilities.zoom.max)){
  const zoom=Math.min(capabilities.zoom.max,Math.max(capabilities.zoom.min,value));
  try{
   await track.applyConstraints({advanced:[{zoom}]});
   softwareZoom=1;
   video.style.transform='';
   zoomValue.textContent=zoom.toFixed(1)+'×';
   zoomHelp.textContent='Camera zoom active · auto scanning';
   return;
  }catch(e){}
 }
 // CSS crop alone cannot improve decoder range: keep feed unmodified.
 softwareZoom=1;
 video.style.transform='';
 zoomInput.value='1';
 zoomValue.textContent='1×';
 zoomHelp.textContent='Camera zoom is not supported on this device';
}
function configureScannerZoom(){
 cameraZoomTrack=activeCameraTrack();
 const caps=cameraZoomTrack?.getCapabilities?.()||{};
 const supported=!!(cameraZoomTrack?.applyConstraints&&caps.zoom&&Number.isFinite(caps.zoom.max)&&caps.zoom.max>1);
 zoomInput.disabled=!supported;
 zoomInput.min=supported?Math.max(1,caps.zoom.min||1):1;
 zoomInput.max=supported?Math.min(8,caps.zoom.max):1;
 zoomInput.value=1;
 zoomValue.textContent='1×';
 zoomHelp.textContent=supported?'Zoom in to scan from farther away':'Camera zoom is not supported on this device';
 // Avoid automatic zoom: it can switch iPhone lenses and reduce close-focus sharpness.

}
zoomInput.addEventListener('input',()=>{setScannerZoom(zoomInput.value)});
function parseTipTagDataMatrix(raw){
 const match=/^(\d{1,3})\s*FR\s*(0[1-9]|[1-9][0-9])\s*(\d+)$/i.exec(String(raw??'').trim().replace(/[\u001d\u001e\u001f]/g,'').replace(/\s+/g,' '));
 if(!match||Number(match[1])<1||Number(match[1])>999)throw Error('Expected format: 50 FR 35 576.');
 return {tipTag:match[1],department:match[2],ede:match[3]};
}
function closeScanner(){
 generation++;processing=false;
 if(scanTimer!==null){clearTimeout(scanTimer);scanTimer=null}
 try{controls?.stop()}catch(e){}controls=null;
 try{reader?.reset?.()}catch(e){}reader=null;
 stream?.getTracks().forEach(track=>track.stop());stream=null;
 video.pause();video.srcObject=null;cameraZoomTrack=null;video.style.transform='';overlay.hidden=true;document.body.classList.remove('scanning');target=null;
}
function applyDecoded(raw){
 if(!target||processing)return false;
 let parsed=null;
 if(target.k==='tipTag'){
  try{parsed=parseTipTagDataMatrix(raw)}catch(e){status.textContent='Code detected, but it does not match 50 FR 35 576. Try again.';return false}
 }
 processing=true;
 const {a,k,el}=target;
 if(parsed){
  if(data.some(x=>x!==a&&x.tipTag===parsed.tipTag&&x.ede===parsed.ede)&&!confirm('An animal already has this Tip Tag and EDE. Continue?')){processing=false;return false}
  if(a.ede&&a.ede!==parsed.ede&&!confirm('Replace the existing EDE number?')){processing=false;return false}
  a.tipTag=parsed.tipTag;a.ede=parsed.ede;el.value=parsed.tipTag;
  const edeField=el.closest('tr')?.children[3]?.querySelector('input');if(edeField)edeField.value=parsed.ede;
 }else{a[k]=String(raw).trim();el.value=a[k]}
 save();if(navigator.vibrate)navigator.vibrate(75);closeScanner();return true;
}
function ensureReader(){
 if(window.ZXingBrowser?.BrowserMultiFormatReader)return Promise.resolve();
 if(readerPromise)return readerPromise;
 readerPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js';
  script.onload=resolve;script.onerror=()=>reject(Error('Scanner engine unavailable. Check your internet connection.'));
  document.head.append(script);
 }).catch(err=>{readerPromise=null;throw err});
 return readerPromise;
}
async function nativeLoop(id){
 if(id!==generation||!nativeDetector||!overlay||overlay.hidden)return;
 try{
  if(video.readyState>=2&&!processing){
   const codes=await nativeDetector.detect(video);
   if(id!==generation)return;
   for(const result of codes){if(applyDecoded(result.rawValue))return}
  }
 }catch(e){status.textContent='Looking for a Data Matrix…'}
 if(id===generation)scanTimer=setTimeout(()=>nativeLoop(id),180);
}
async function scan(a,k,el){
 closeScanner();target={a,k,el};const id=generation;
 overlay.hidden=false;document.body.classList.add('scanning');status.textContent='Starting the rear camera…';
 document.querySelector('#scannerTitle').textContent=k==='tipTag'?'Scan the Data Matrix':'Scan electronic ID';
 if(!navigator.mediaDevices?.getUserMedia){status.textContent='Camera unavailable. Open the app over HTTPS.';return}
 try{
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
  if(id!==generation){stream.getTracks().forEach(t=>t.stop());return}
  video.srcObject=stream;await video.play();configureScannerZoom();
  status.textContent='Align the Data Matrix within the frame. Scanning automatically…';
  nativeDetector=null;
  if('BarcodeDetector'in window){
   try{
    const formats=await BarcodeDetector.getSupportedFormats();
    const formatsWanted=k==='tipTag'?['data_matrix']:['data_matrix','qr_code'];
    const available=formatsWanted.filter(format=>formats.includes(format));
    if(available.length)nativeDetector=new BarcodeDetector({formats:available});
   }catch(e){}
  }
  // Prefer the native Data Matrix detector when available, including on iPhone.
  // If unsupported, fall back to ZXing as before.
  if(nativeDetector){nativeLoop(id);return}
  status.textContent='Loading the Data Matrix reader…';
  await ensureReader();if(id!==generation)return;
  reader=new window.ZXingBrowser.BrowserMultiFormatReader();
  stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;cameraZoomTrack=null;
  controls=await reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}},video,(result)=>{
    if(id!==generation||!result||processing)return;
    applyDecoded(result.getText());
  });
  if(id!==generation){controls?.stop();return}
  if(video.srcObject)configureScannerZoom();
  status.textContent='Align the Data Matrix within the frame. Scanning automatically…';
 }catch(err){
  if(id!==generation)return;
  stream?.getTracks().forEach(t=>t.stop());stream=null;
  status.textContent='Scanner unavailable: '+err.message+'. Close and try again.';
 }
}
document.querySelector('#scannerClose').addEventListener('click',closeScanner);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!overlay.hidden)closeScanner()});

function updateDashboard(){
 const put=(id,n)=>{const e=document.getElementById(id);if(e)e.textContent=n};
 put('kTotal',data.length);put('kFemale',data.filter(a=>a.sex==='F').length);
 put('kMale',data.filter(a=>a.sex==='M').length);
 put('kHealth',data.filter(a=>a.healthNotes.trim()).length);
 const recent=document.querySelector('#recent');if(!recent)return;
 recent.replaceChildren();
 for(const a of data.slice(-5).reverse()){
  const row=document.createElement('div');row.className='recent-row';
  const label=document.createElement('strong');label.textContent='🐐 '+(a.tipTag||'No ID');
  const detail=document.createElement('span');detail.textContent='EDE '+(a.ede||'—')+' · '+(a.sex==='F'?'Female':a.sex==='M'?'Male':'Sex not specified');
  row.append(label,detail);recent.append(row);
 }
 if(!data.length)recent.textContent='No animals recorded yet.';
}
function showTab(tab){
 for(const id of ['dashboard','herd','settingsPanel']){const section=document.getElementById(id);if(section)section.hidden=id!==tab;}
 document.querySelectorAll('.tabbar button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
}
document.querySelectorAll('.tabbar button').forEach(b=>b.addEventListener('click',()=>{
 if(b.dataset.tab==='scan'){
  showTab('herd');
  if(data.length){document.querySelector('#search').value='';render();const a=data[data.length-1];const row=[...document.querySelectorAll('#rows tr')].at(-1);const input=row?.querySelector('input');if(input)scan(a,'tipTag',input);else alert('Could not start the scanner.');}
  else{document.querySelector('#add').click();const a=data[data.length-1];const input=document.querySelector('#rows tr:last-child input');if(input)scan(a,'tipTag',input)}
  return;
 }
 showTab(b.dataset.tab);
}));
document.querySelector('#goHerd').onclick=()=>showTab('herd');
document.querySelector('#settingsExport').onclick=()=>document.querySelector('#export').click();
document.querySelector('#settingsBackup').onclick=()=>document.querySelector('#backup').click();
window.addEventListener('error',e=>{console.error('GoatLessPaper:',e.error||e.message)});
showTab('dashboard');

render();

if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
