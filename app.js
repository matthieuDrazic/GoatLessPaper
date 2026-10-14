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
let target=null,readerPromise=null,scanGeneration=0;
const cameraInput=document.querySelector('#cameraCapture');
function parseTipTagDataMatrix(raw){
  const code=String(raw??'').trim().replace(/[\u001d\u001e\u001f]/g,'').replace(/\s+/g,' ').toUpperCase();
  const match=/^(\d{1,3})\s*FR\s*(0[1-9]|[1-9][0-9])\s*(\d+)$/.exec(code);
  if(!match||Number(match[1])<1||Number(match[1])>999)throw Error('Format attendu : 50 FR 35 576.');
  return {tipTag:match[1],department:match[2],ede:match[3]};
}
function apply(value){
  if(!target)return false;
  const val=String(value??'').trim();if(!val)return false;
  const {a,k,el}=target;
  if(k==='tipTag'){
    let p;
    try{p=parseTipTagDataMatrix(val)}catch(e){alert('Data Matrix non valide : '+e.message);return false}
    if(data.some(row=>row!==a&&row.tipTag===p.tipTag&&row.ede===p.ede)&&!confirm('Cet identifiant existe déjà. Enregistrer quand même ?'))return false;
    if(a.ede&&a.ede!==p.ede&&!confirm('Remplacer le numéro EDE existant ?'))return false;
    a.tipTag=p.tipTag;a.ede=p.ede;el.value=p.tipTag;
    const edeInput=el.closest('tr')?.children[3]?.querySelector('input');if(edeInput)edeInput.value=p.ede;
  }else{a[k]=val;el.value=val}
  save();target=null;return true;
}
function ensureReader(){
  if(window.ZXingBrowser?.BrowserMultiFormatReader)return Promise.resolve();
  if(readerPromise)return readerPromise;
  readerPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js';
    script.onload=resolve;script.onerror=()=>reject(Error('Lecteur Data Matrix indisponible. Vérifiez la connexion internet.'));
    document.head.append(script);
  }).catch(e=>{readerPromise=null;throw e});
  return readerPromise;
}
function scan(a,k,el){
  target={a,k,el};scanGeneration++;
  // capture=environment délègue l'ouverture de l'appareil photo à iOS/Android.
  cameraInput.value='';
  cameraInput.click();
}
cameraInput.addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';
  if(!file||!target)return;
  const generation=scanGeneration;
  try{
    const source=await createImageBitmap(file).catch(()=>null);
    if(generation!==scanGeneration)return;
    let decoded=null;
    if(source&&'BarcodeDetector'in window){
      const formats=await BarcodeDetector.getSupportedFormats();
      const format=target.k==='tipTag'?'data_matrix':'qr_code';
      if(formats.includes(format)){
        const detector=new BarcodeDetector({formats:[format]});
        decoded=(await detector.detect(source))[0]?.rawValue??null;
      }
    }
    source?.close?.();
    if(!decoded){
      await ensureReader();
      if(generation!==scanGeneration)return;
      const reader=new window.ZXingBrowser.BrowserMultiFormatReader();
      const url=URL.createObjectURL(file);
      try{
        const img=new Image();img.src=url;await img.decode();
        decoded=(await reader.decodeFromImageElement(img)).getText();
      }finally{URL.revokeObjectURL(url)}
    }
    if(generation!==scanGeneration)return;
    if(!apply(decoded))alert('Le code n’a pas été enregistré. Reprenez une photo ou saisissez-le manuellement.');
  }catch(err){
    if(generation!==scanGeneration)return;
    alert('Data Matrix non reconnu sur cette photo. Cadrez le carré nettement, rapprochez-vous et évitez les reflets. Détail : '+err.message);
  }
});
render();

if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
