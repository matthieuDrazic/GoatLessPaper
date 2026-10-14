'use strict';
const F=['tipTag','electronicId','ede','birthDate','sex','motherId','fatherId','litterSize','healthNotes'];
const H=['ID Tip Tag','ID électronique','EDE élevage','Date de naissance','Sexe','ID mère','ID père','Chevreaux / portée','Observations sanitaires'];
const K='goatlesspaper-v1',$=s=>document.querySelector(s);
const uid=()=>crypto.randomUUID?.()||String(Date.now())+Math.random();
const norm=a=>Object.fromEntries([['_id',a._id||uid()],...F.map(k=>[k,String(a[k]??'')])]);
let data=[];try{const v=JSON.parse(localStorage.getItem(K)||'[]');if(Array.isArray(v))data=v.map(norm)}catch(e){alert('Stockage local illisible. Restaurez une sauvegarde.')}
function save(){try{localStorage.setItem(K,JSON.stringify(data))}catch(e){alert('Stockage local indisponible. Exportez vos données.');}}
function cell(a,k){const w=document.createElement('div');if(k==='tipTag'||k==='electronicId')w.className='scan';const el=k==='healthNotes'?document.createElement('textarea'):k==='sex'?document.createElement('select'):document.createElement('input');if(k==='sex'){for(const[v,t]of[['','—'],['F','Femelle'],['M','Mâle'],['I','Indéterminé']]){const o=document.createElement('option');o.value=v;o.textContent=t;el.append(o)}}else if(k!=='healthNotes'){el.type=k==='birthDate'?'date':k==='litterSize'?'number':'text';if(k==='litterSize'){el.min='0';el.step='1'}}el.value=a[k];el.setAttribute('aria-label',H[F.indexOf(k)]);el.addEventListener('input',()=>{a[k]=el.value;save()});w.append(el);if(k==='tipTag'||k==='electronicId'){const b=document.createElement('button');b.textContent='📷';b.title='Scanner '+H[F.indexOf(k)];b.onclick=()=>scan(a,k,el);w.append(b)}return w}
function render(){const q=$('#search').value.toLowerCase(),body=$('#rows');body.replaceChildren();for(const a of data.filter(a=>F.some(k=>a[k].toLowerCase().includes(q)))){const tr=document.createElement('tr'),n=document.createElement('td');n.textContent=data.indexOf(a)+1;tr.append(n);for(const k of F){const td=document.createElement('td');td.append(cell(a,k));tr.append(td)}const td=document.createElement('td'),b=document.createElement('button');b.textContent='Supprimer';b.onclick=()=>{if(confirm('Supprimer cet animal ?')){data=data.filter(x=>x!==a);save();render()}};td.append(b);tr.append(td);body.append(tr)}$('#count').textContent=data.length+' animaux'}
$('#add').onclick=()=>{data.push(norm({}));save();$('#search').value='';render()};$('#search').oninput=render;
const today=()=>new Date().toISOString().slice(0,10);
function dl(name,contents,type){const url=URL.createObjectURL(new Blob([contents],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function esc(v){v=String(v??'');return /[";\r\n]/.test(v)?'"'+v.replaceAll('"','""')+'"':v}
$('#export').onclick=()=>dl('GoatLessPaper-'+today()+'.csv','\ufeff'+[H,...data.map(a=>F.map(k=>a[k]))].map(r=>r.map(esc).join(';')).join('\r\n'),'text/csv;charset=utf-8');
$('#backup').onclick=()=>dl('GoatLessPaper-backup-'+today()+'.json',JSON.stringify({format:K,animals:data},null,2),'application/json');
function parseCsv(s){s=s.replace(/^\ufeff/,'');const out=[];let row=[],v='',quoted=false;for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){v+='"';i++}else quoted=!quoted}else if(!quoted&&(c===';'||c===',')){row.push(v);v=''}else if(!quoted&&(c==='\r'||c==='\n')){if(c==='\r'&&s[i+1]==='\n')i++;row.push(v);if(row.some(x=>x))out.push(row);row=[];v=''}else v+=c}if(quoted)throw Error('CSV mal formé');row.push(v);if(row.some(x=>x))out.push(row);return out}
$('#import').onclick=()=>$('#csv').click();$('#csv').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{const rows=parseCsv(await file.text());if(!rows.length||H.some((h,i)=>h!==rows[0][i]))throw Error('En-têtes CSV incompatibles');const added=rows.slice(1).map(r=>norm(Object.fromEntries(F.map((k,i)=>[k,r[i]||'']))));if(confirm('Ajouter '+added.length+' animaux ?')){data.push(...added);save();render()}}catch(err){alert('Import impossible : '+err.message)}};
$('#restore').onclick=()=>$('#json').click();$('#json').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{const j=JSON.parse(await file.text());if(j.format!==K||!Array.isArray(j.animals))throw Error('Format incompatible');if(confirm('Remplacer tout le registre local par cette sauvegarde ?')){data=j.animals.map(norm);save();render()}}catch(err){alert('Restauration impossible : '+err.message)}};
let stream=null,detector=null,frame=null,target=null,active=false,reader=null,scanGeneration=0;
const modal=$('#modal'),video=$('#video');
function parseTipTagDataMatrix(raw){
  const code=String(raw??'').trim().replace(/[\u001d\u001e\u001f]/g,'');
  const match=/^(00[1-9]|0[1-9][0-9]|[1-9][0-9]{2})FR(0[1-9]|[1-9][0-9])([0-9]+)$/.exec(code);
  if(!match)throw new Error('Format attendu : 001 à 999 + FR + département 01 à 99 + numéro EDE numérique.');
  return {tipTag:match[1],department:match[2],ede:match[3]};
}
function stop(){
  scanGeneration++;active=false;
  if(frame!==null)cancelAnimationFrame(frame);frame=null;
  if(reader){try{reader.controls?.stop();reader.reset?.()}catch(e){}reader=null}
  stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;
  if(modal.open)modal.close();target=null;
}
function apply(value){
  if(!target)return;
  const val=String(value??'').trim();if(!val)return;
  if(target.k==='tipTag'){
    let parsed;
    try{parsed=parseTipTagDataMatrix(val)}catch(e){$('#status').textContent='⚠ '+e.message;return}
    const duplicates=data.filter(a=>a!==target.a&&a.tipTag===parsed.tipTag&&a.ede===parsed.ede);
    if(duplicates.length&&!confirm('Un animal possède déjà ce Tip Tag et cet EDE. Continuer ?'))return;
    if(target.a.ede&&target.a.ede!==parsed.ede&&!confirm('Le numéro EDE existant sera remplacé par celui du Data Matrix. Confirmer ?'))return;
    target.a.tipTag=parsed.tipTag;target.a.ede=parsed.ede;target.el.value=parsed.tipTag;
    const tr=target.el.closest('tr');if(tr){const edeInput=tr.children[3]?.querySelector('input');if(edeInput)edeInput.value=parsed.ede}
  }else{
    target.a[target.k]=val;target.el.value=val;
  }
  save();stop();
}
async function loop(generation){
  if(!active||generation!==scanGeneration)return;
  try{
    if(video.readyState>=2){
      const found=await detector.detect(video);
      if(!active||generation!==scanGeneration)return;
      if(found.length){apply(found[0].rawValue);if(!active)return}
    }
  }catch(e){$('#status').textContent='Détection interrompue : '+e.message}
  if(active&&generation===scanGeneration)frame=requestAnimationFrame(()=>loop(generation));
}
async function scan(a,k,el){
  stop();target={a,k,el};const generation=scanGeneration;
  $('#title').textContent=k==='tipTag'?'Scanner le Data Matrix Tip Tag':'Scanner ID électronique';
  $('#status').textContent='Ouverture de la caméra arrière…';
  $('#manual').value='';$('#manual').placeholder=k==='tipTag'?'Ex. 025FR3512345678':'Identifiant électronique';
  modal.showModal();
  if(!navigator.mediaDevices?.getUserMedia){$('#status').textContent='Caméra inaccessible. Ouvrez l’application en HTTPS ou saisissez le code complet.';return}
  try{
    const supportsNative='BarcodeDetector' in window;
    if(supportsNative){
      const formats=await BarcodeDetector.getSupportedFormats();
      const format=k==='tipTag'?'data_matrix':(formats.includes('data_matrix')?'data_matrix':'qr_code');
      if(formats.includes(format))detector=new BarcodeDetector({formats:[format]});
      else detector=null;
    }else detector=null;
    if(generation!==scanGeneration)return;
    if(!detector){
      $('#status').textContent='Initialisation du lecteur Data Matrix compatible iPhone…';
      await ensureZxing();
      if(generation!==scanGeneration)return;
      if(!window.ZXingBrowser?.BrowserMultiFormatReader)throw new Error('Bibliothèque de scan indisponible');
      reader=new window.ZXingBrowser.BrowserMultiFormatReader();
      $('#status').textContent='Cadrez nettement le Data Matrix. La caméra reste ouverte tant que le code n’est pas valide.';
      active=true;
      const controls=await reader.decodeFromVideoDevice(undefined,video,(result,error)=>{
        if(!active||generation!==scanGeneration||!result)return;
        apply(result.getText());
      });
      if(generation!==scanGeneration){controls?.stop();return}
      if(reader)reader.controls=controls;
      return;
    }
    stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
    if(generation!==scanGeneration){stream.getTracks().forEach(t=>t.stop());stream=null;return}
    video.srcObject=stream;await video.play();active=true;
    $('#status').textContent=k==='tipTag'?'Cadrez le Data Matrix, pas un QR code.':'Cadrez le code de l’identifiant électronique.';
    loop(generation);
  }catch(e){stream?.getTracks().forEach(t=>t.stop());stream=null;$('#status').textContent='Scan impossible : '+e.message+'. Saisie manuelle disponible.'}
}
let zxingPromise=null;
function ensureZxing(){
  if(window.ZXingBrowser?.BrowserMultiFormatReader)return Promise.resolve();
  if(zxingPromise)return zxingPromise;
  zxingPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js';
    script.onload=resolve;script.onerror=()=>reject(new Error('Impossible de charger le lecteur Data Matrix (connexion requise lors du premier scan)'));
    document.head.append(script);
  }).catch(e=>{zxingPromise=null;throw e});
  return zxingPromise;
}
$('#validate').onclick=()=>apply($('#manual').value);
$('#manual').onkeydown=e=>{if(e.key==='Enter')apply(e.currentTarget.value)};
$('#close').onclick=stop;
modal.addEventListener('cancel',e=>{e.preventDefault();stop()});
render();

if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
