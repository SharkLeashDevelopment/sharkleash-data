/* SharkLeash Drop Score map: colors the shoreline on the Shark Water map by tonight's (or this morning's) Drop Score.
   Loaded by shark-water.js. Reads the scores the scoring job writes every 2 hours. */
(function(){
if(window.SLH_LOADED)return;window.SLH_LOADED=true;
var BB='https://raw.githubusercontent.com/SharkLeashDevelopment/sharkleash-best-beaches/main/data/';
var COAST_URL='https://sharkleashdevelopment.github.io/sharkleash-data/coastline.json';
var SNAMES=['Maine','New Hampshire','Massachusetts','Rhode Island','Connecticut','New York','New Jersey','Delaware','Maryland','Virginia','North Carolina','South Carolina','Georgia','Florida','Alabama','Mississippi','Louisiana','Texas'];
var BUCKETS=[{min:90,col:'#22c55e',label:'90+'},{min:75,col:'#a3e635',label:'75–89'},{min:60,col:'#facc15',label:'60–74'},{min:40,col:'#fb923c',label:'40–59'},{min:-1,col:'#ef4444',label:'Under 40'}];
var BANCOL='#5b6470',REACH_KM=25,BAND=9;
/* same map projection as shark-water.js */
var R=Math.PI/180,P0=27*R,P1=45*R,ROT=84,K=840.0706120349276,TX=283.98253597249266,TY=742.680833262471;
function ty(y){return Math.tan((Math.PI/2+y)/2);}
var N=Math.log(Math.cos(P0)/Math.cos(P1))/Math.log(ty(P1)/ty(P0)),F=Math.cos(P0)*Math.pow(ty(P0),N)/N;
function raw(l,p){var r=F/Math.pow(ty(p),N);return [r*Math.sin(N*l),F-r*Math.cos(N*l)];}
var C0=raw(0,0),DX=TX-K*C0[0],DY=TY+K*C0[1];
function proj(lon,lat){var q=raw((lon+ROT)*R,lat*R);return [DX+K*q[0],DY-K*q[1]];}
function km(a,b,c,d){var x=Math.sin((c-a)*R/2),y=Math.sin((d-b)*R/2);var h=x*x+Math.cos(a*R)*Math.cos(c*R)*y*y;return 12742*Math.asin(Math.sqrt(h));}
function col(b){if(b.flag)return BANCOL;for(var i=0;i<BUCKETS.length;i++)if(b.score>=BUCKETS[i].min)return BUCKETS[i].col;return BANCOL;}
var LINES=[],DATA={pm:null,am:null},mode='temps',win='pm';
try{mode=localStorage.getItem('slh_mode')==='score'?'score':'temps';win=localStorage.getItem('slh_win')==='am'?'am':'pm';}catch(e){}
function get(u){return fetch(u,{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json();});}
var tick=Math.floor(Date.now()/3e5);
var pCoast=get(COAST_URL).then(function(J){J.coast.split('|').forEach(function(l){var t=l.split('~'),a=0,o=0,line=[];t[1].split(' ').forEach(function(s){var q=s.split(',');a+=+q[0];o+=+q[1];var p=proj(o/100,a/100);line.push([p[0],p[1],a/100,o/100]);});LINES.push(line);});});
function load(w){if(DATA[w])return Promise.resolve(DATA[w]);return get(BB+(w==='am'?'best-mornings.json':'best-beaches.json')+'?t='+tick).then(function(j){DATA[w]=j;return j;});}
function nearest(beaches,la,lo,max){var b=null,bd=max;beaches.forEach(function(x){if(x.score==null)return;var d=km(la,lo,x.lat,x.lon);if(d<bd){bd=d;b=x;}});return b;}
function ready(){return document.getElementById('slm-map')&&document.getElementById('slsw-layer')&&document.getElementById('slsw-ui')&&window.SLSW;}
function start(){if(!ready())return setTimeout(start,400);pCoast.then(setup).catch(function(){});}
var NS='http://www.w3.org/2000/svg',svg,layer,ui,box,leg,info;
function setup(){
svg=document.getElementById('slm-map');ui=document.getElementById('slsw-ui');info=document.getElementById('slsw-info');
layer=document.createElementNS(NS,'g');layer.setAttribute('id','slh-layer');layer.style.display='none';layer.style.pointerEvents='none';
var tl=document.getElementById('slsw-layer');tl.parentNode.insertBefore(layer,tl.nextSibling);
var css=document.createElement('style');css.textContent=
'#slh-box{margin:4px 0 10px}#slh-box .seg{display:flex;gap:6px;flex-wrap:wrap}'+
'#slh-box button{font:inherit;font-size:13px;font-weight:900;color:#fff;background:rgba(255,255,255,.06);border:1px solid rgba(110,231,255,.35);border-radius:999px;padding:7px 12px;min-height:36px;cursor:pointer}'+
'#slh-box button.on{background:linear-gradient(135deg,#ff2b2b,#ff6a00);border-color:transparent}'+
'#slh-box .sub button{font-size:12px;padding:5px 10px;min-height:30px}#slh-box .sub button.on{background:rgba(110,231,255,.18);border-color:#6ee7ff}'+
'#slh-leg{margin-top:8px;font-size:12.5px;font-weight:700;color:rgba(255,255,255,.8)}#slh-leg .row{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:6px}'+
'#slh-leg .k{display:inline-flex;align-items:center;gap:6px}#slh-leg .k i{display:inline-block;width:20px;height:10px;border-radius:3px}'+
'#slh-leg .n{margin-top:6px;font-size:11.5px;font-weight:600;color:rgba(255,255,255,.6)}'+
'#slm.slh-on .st,#slm.slh-on .st.sel,#slm.slh-on .st:hover{filter:saturate(.25) brightness(.45)!important}';
document.head.appendChild(css);
box=document.createElement('div');box.id='slh-box';
box.innerHTML='<div class="seg"><button type="button" data-m="temps">🌡️ Shark water</button><button type="button" data-m="score">🎯 Drop Score map</button></div><div id="slh-leg" style="display:none"></div>';
var hd=ui.querySelector('.hd');ui.insertBefore(box,hd?hd.nextSibling:ui.firstChild);leg=box.querySelector('#slh-leg');
box.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('button');if(!b)return;
if(b.dataset.m){mode=b.dataset.m;try{localStorage.setItem('slh_mode',mode);}catch(x){}if(window.gtag)gtag('event','heat_mode',{mode:mode});apply();}
if(b.dataset.w){win=b.dataset.w;try{localStorage.setItem('slh_win',win);}catch(x){}if(window.gtag)gtag('event','heat_window',{window:win});apply();}});
svg.addEventListener('click',onTap,true);
apply();}
function show(el,on){if(el)el.style.display=on?'':'none';}
function apply(){
var sc=mode==='score';
[].forEach.call(box.querySelectorAll('[data-m]'),function(b){b.classList.toggle('on',b.dataset.m===mode);});
show(document.getElementById('slsw-layer'),!sc);show(document.getElementById('slsw-leg'),!sc);show(document.getElementById('slsw-mchk'),!sc);
var mig=document.getElementById('slsw-mig'),chk=document.getElementById('slsw-mig-on');if(mig)mig.style.display=!sc&&(!chk||chk.checked)?'':'none';
var hd=ui.querySelector('.hd');if(hd){if(!hd.dataset.t)hd.dataset.t=hd.textContent;hd.textContent=sc?'🎯 Drop Score map · where conditions line up':hd.dataset.t;}
var slm=document.getElementById('slm');if(slm)slm.classList.toggle('slh-on',sc);
show(layer,sc);show(leg,sc);if(!sc)return;
leg.innerHTML='<div class="sub seg"><button type="button" data-w="pm"'+(win==='pm'?' class="on"':'')+'>Tonight · sunset window</button><button type="button" data-w="am"'+(win==='am'?' class="on"':'')+'>Morning 5–11 AM</button></div><div class="n">Loading scores…</div>';
load(win).then(draw,function(){leg.querySelector('.n').textContent='Couldn’t load the scores right now. Refresh to try again.';});}
function draw(j){if(mode!=='score')return;
var bs=j.beaches||[],paths={},casing=[];
LINES.forEach(function(l){var prev=null;l.forEach(function(q,i){var b=nearest(bs,q[2],q[3],REACH_KM);
if(b&&prev){var c=col(b),d='M'+prev[0].toFixed(1)+','+prev[1].toFixed(1)+'L'+q[0].toFixed(1)+','+q[1].toFixed(1);(paths[c]=paths[c]||[]).push(d);casing.push(d);}
prev=b?q:null;});});
layer.innerHTML='';
function P(d,stroke,w){var p=document.createElementNS(NS,'path');p.setAttribute('d',d);p.setAttribute('fill','none');p.setAttribute('stroke',stroke);p.setAttribute('stroke-width',w);p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');layer.appendChild(p);}
P(casing.join(''),'#02080d',BAND+4);
[BANCOL].concat(BUCKETS.slice().reverse().map(function(b){return b.col;})).forEach(function(c){if(paths[c])P(paths[c].join(''),c,BAND);});
var up=j.updated?new Date(j.updated).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'',ok=bs.filter(function(b){return !b.flag&&b.score!=null;}).sort(function(a,b){return b.score-a.score;});
var h=leg.querySelector('.sub').outerHTML+'<div class="row">'+BUCKETS.map(function(b){return '<span class="k"><i style="background:'+b.col+'"></i>'+b.label+'</span>';}).join('')+'<span class="k"><i style="background:'+BANCOL+'"></i>Banned / no drones</span><span class="k"><i style="background:#7fa3b5;height:3px"></i>Not scored (marsh, bay or no beach access)</span></div>';
if(ok.length)h+='<div class="n" style="color:#fff;font-weight:800">Best right now: '+ok.slice(0,3).map(function(b){return b.name.replace(/,\s*[A-Z]{2}$/,'')+' '+b.score;}).join(' · ')+'</div>';
h+='<div class="n">Drop Score out of 100 for '+(win==='am'?'the morning window (5–11 AM)':'tonight (2 hours before sunset to about 4 hours after)')+(up?', updated '+up:'')+'. Tap the shoreline for a beach. Conditions only: the sharks still decide.</div>';
leg.innerHTML=h;}
function onTap(e){if(mode!=='score'||!DATA[win])return;var m=svg.getScreenCTM();if(!m)return;var pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;var s=pt.matrixTransform(m.inverse());
var lim=36/(Math.abs(m.a)||1),best=null,bd=lim;LINES.forEach(function(l){l.forEach(function(q){var d=Math.hypot(q[0]-s.x,q[1]-s.y);if(d<bd){bd=d;best=q;}});});
if(!best)return;var b=nearest(DATA[win].beaches||[],best[2],best[3],REACH_KM);if(!b)return;
setTimeout(function(){if(!info)return;var old=info.querySelector('.slh-tap');if(old)old.remove();
var t=b.flag?'<b>'+b.name+'</b>: 🚫 '+b.flag:'🎯 <b>'+b.score+'</b> Drop Score '+(win==='am'?'for the morning':'tonight')+' at <b>'+b.name+'</b>'+(b.w&&b.w.dir?' · '+b.w.dir+' '+b.w.avg+' mph':'')+(b.wv!=null?' · '+Math.round(b.wv*2)/2+' ft':'');
var d=document.createElement('div');d.className='slh-tap';d.style.cssText='margin:0 0 8px;padding:8px 11px;border-radius:10px;background:'+(b.flag?'rgba(91,100,112,.25)':'rgba(34,197,94,.12)')+';border:1px solid '+col(b)+';font-size:13.5px';d.innerHTML=t;
var nm=info.querySelector('.slsw-nm');if(nm)nm.parentNode.insertBefore(d,nm.nextSibling);else info.insertBefore(d,info.firstChild);
if(window.gtag)gtag('event','heat_tap',{beach:b.id||b.name,window:win});},30);}
start();
})();
