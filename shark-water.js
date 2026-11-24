(function(){
var GROUPS={
cool:{label:'Cool-water sharks',who:'sandbar, sand tiger, smooth dogfish',min:55,max:70,col:'#bfe6ff'},
core:{label:'Core migrators',who:'blacktip, spinner, dusky, sharpnose, bonnethead, finetooth',min:62,max:80,col:'#009E73'},
warm:{label:'Warm-water sharks',who:'bull, tiger, lemon, nurse, hammerheads',min:72,max:99,col:'#E69F00',low:true}
};
var COLD='#7b8794';
var BAND=9;
var OBS_KM=40;
var INLAND_KM=20;
var STRIDE=10, TILE=3;
var COAST="";
var AB={'Maine':'ME','New Hampshire':'NH','Massachusetts':'MA','Rhode Island':'RI','Connecticut':'CT','New York':'NY','New Jersey':'NJ','Delaware':'DE','Maryland':'MD','Virginia':'VA','North Carolina':'NC','South Carolina':'SC','Georgia':'GA','Florida':'FL','Alabama':'AL','Mississippi':'MS','Louisiana':'LA','Texas':'TX'};
var SNAMES=['Maine','New Hampshire','Massachusetts','Rhode Island','Connecticut','New York','New Jersey','Delaware','Maryland','Virginia','North Carolina','South Carolina','Georgia','Florida','Alabama','Mississippi','Louisiana','Texas'];
var PTS=[],PST=[],SW_COAST_OK=false;function parseCoast(){COAST.split('|').forEach(function(l){var t=l.split('~'),a=0,o=0,line=[];t[1].split(' ').forEach(function(s){var q=s.split(',');a+=+q[0];o+=+q[1];line.push([a/100,o/100]);});PTS.push(line);PST.push(SNAMES[+t[0]]);});SW_COAST_OK=true;}
var R=Math.PI/180,P0=27*R,P1=45*R,ROT=84,K=840.0706120349276,TX=283.98253597249266,TY=742.680833262471;
function ty(y){return Math.tan((Math.PI/2+y)/2);}
var N=Math.log(Math.cos(P0)/Math.cos(P1))/Math.log(ty(P1)/ty(P0)),F=Math.cos(P0)*Math.pow(ty(P0),N)/N;
function raw(l,p){var r=F/Math.pow(ty(p),N);return [r*Math.sin(N*l),F-r*Math.cos(N*l)];}
var C0=raw(0,0),DX=TX-K*C0[0],DY=TY+K*C0[1];
function proj(lon,lat){var q=raw((lon+ROT)*R,lat*R);return [DX+K*q[0],DY-K*q[1]];}
function km(a,b,c,d){var x=Math.sin((c-a)*R/2),y=Math.sin((d-b)*R/2);var h=x*x+Math.cos(a*R)*Math.cos(c*R)*y*y;return 12742*Math.asin(Math.sqrt(h));}
function groupsFor(t){var g=[];for(var k in GROUPS){if(t>=GROUPS[k].min&&t<GROUPS[k].max)g.push(k);}return g;}
function bandKey(t){var g=groupsFor(t);return g.length?g.join('+'):'cold';}
/* Water temps load nearest-first: the spot picked (or the last one this phone used) loads before the rest of the coast. */
var FOC=null;try{FOC=JSON.parse(localStorage.getItem('slsw_last')||'null');}catch(e){}
function focus(la,lo){FOC={la:+la,lo:+lo};try{localStorage.setItem('slsw_last',JSON.stringify(FOC));}catch(e){}}
var jn=0;
function jsonp(u){return new Promise(function(res,rej){var cb='slswJ'+Date.now()+(jn++),sc=document.createElement('script'),done=0;
function end(){try{delete window[cb];}catch(e){window[cb]=undefined;}if(sc.parentNode)sc.parentNode.removeChild(sc);}
window[cb]=function(d){done=1;end();res(d);};sc.onerror=function(){if(!done){done=1;end();rej(new Error('load'));}};
setTimeout(function(){if(!done){done=1;end();rej(new Error('timeout'));}},45000);
sc.src=u+'&.jsonp='+cb;document.head.appendChild(sc);});}
function tiles(){var t={};PTS.forEach(function(l){l.forEach(function(p){var k=Math.floor(p[0]/TILE)+','+Math.floor(p[1]/TILE),b=t[k]||(t[k]={s:90,n:-90,w:180,e:-180});
b.s=Math.min(b.s,p[0]);b.n=Math.max(b.n,p[0]);b.w=Math.min(b.w,p[1]);b.e=Math.max(b.e,p[1]);});});
return Object.keys(t).map(function(k){var b=t[k];return [+(b.s-0.3).toFixed(2),+(b.n+0.3).toFixed(2),+(b.w-0.3).toFixed(2),+(b.e+0.3).toFixed(2)];});}
function cacheGet(k){try{var c=JSON.parse(localStorage.getItem(k)||'null');if(c&&Date.now()-c.at<6*36e5)return c;}catch(e){}return null;}
function cacheSet(k,v){try{v.at=Date.now();localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function loadTile(b){
var key='slsw_t_'+b.join('_'),c=cacheGet(key);if(c)return Promise.resolve(c);
var q='analysed_sst[(last)][('+b[0]+'):'+STRIDE+':('+b[1]+')][('+b[2]+'):'+STRIDE+':('+b[3]+')]',u='https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41F.json?'+encodeURIComponent(q);
function go(){return jsonp(u);}
return go().catch(function(){return new Promise(function(r){setTimeout(r,2000);}).then(go);}).then(function(j){
var cn=j.table.columnNames,it=cn.indexOf('time'),ila=cn.indexOf('latitude'),ilo=cn.indexOf('longitude'),iv=cn.indexOf('analysed_sst'),out={day:'',cells:[]};
j.table.rows.forEach(function(r){var v=r[iv];if(v===null||isNaN(v)||v<28||v>98)return;out.day=r[it];out.cells.push([+(+r[ila]).toFixed(2),+(+r[ilo]).toFixed(2),+(+v).toFixed(1)]);});
cacheSet(key,out);return out;});
}
function loadObs(){
var c=cacheGet('slsw_obs_g');if(c)return Promise.resolve(c.list);
var q=['station,latitude,longitude,time,WTMP','time>=now-1days','latitude>=23','latitude<=46','longitude>=-98','longitude<=-64','WTMP!=NaN','orderByMax("station,time")'].map(encodeURIComponent).join('&');
return jsonp('https://coastwatch.pfeg.noaa.gov/erddap/tabledap/cwwcNDBCMet.json?'+q).then(function(j){
var cn=j.table.columnNames,ix=function(n){return cn.indexOf(n);};
var list=j.table.rows.map(function(r){var sid=String(r[ix('station')]);return {id:(/^\d+$/.test(sid)?'buoy ':'station ')+sid,la:r[ix('latitude')],lo:r[ix('longitude')],f:r[ix('WTMP')]*9/5+32};}).filter(function(o){return o.f>32&&o.f<90;});
cacheSet('slsw_obs_g',{list:list});return list;
}).catch(function(){return [];});
}
function index(cells){var b={};cells.forEach(function(c){var k=Math.floor(c[0]*5)+','+Math.floor(c[1]*5);(b[k]=b[k]||[]).push(c);});
return function(la,lo,maxKm){var best=null,bd=maxKm,ka=Math.floor(la*5),ko=Math.floor(lo*5);
for(var x=-2;x<=2;x++)for(var y=-2;y<=2;y++){var a=b[(ka+x)+','+(ko+y)];if(!a)continue;for(var i=0;i<a.length;i++){var d=km(la,lo,a[i][0],a[i][1]);if(d<bd){bd=d;best=a[i];}}}
return best?best[2]:null;};}
var MIG={
cool:{who:'Sandbar & sand tiger',m:['W','W','W','N','N','N','U','U','U','S','S','W'],
win:[28.0,35.5],sum:[38.5,43.6],path:[[-75.0,34.6],[-74.4,36.4],[-73.6,38.4],[-72.4,39.9],[-70.6,40.6],[-69.4,41.3]],winter:'Cape Hatteras to central Florida',summer:'Delaware Bay to New England'},
core:{who:'Blacktips & spinners',m:['W','W','N','N','N','U','U','U','U','S','S','S'],
win:[25.5,28.2],sum:[31.0,35.6],path:[[-79.25,26.6],[-79.45,28.4],[-79.7,30.2],[-79.0,31.9],[-77.6,32.9],[-76.2,33.9]],winter:'Southeast Florida (Palm Beach to Jupiter)',summer:'the Carolinas and Georgia'},
warm:{who:'Lemon, bull, tiger & hammerhead (lower confidence)',m:['W','W','W','N','N','N','U','U','U','S','S','W'],
win:[24.4,29.0],sum:[28.0,35.6],path:[[-78.6,26.9],[-78.8,28.6],[-79.0,30.3],[-78.3,31.7]],winter:'central and south Florida',summer:'Florida to the Carolinas'}
};
var GMIG=[
{k:'core',who:'Blacktips & spinners (eastern Gulf)',m:['W','W','N','N','N','U','U','U','U','S','S','S'],path:[[-82.9,25.4],[-83.7,26.6],[-84.4,27.75],[-85.3,28.65],[-86.4,29.15],[-87.6,29.4]],winter:'Southwest Florida, the Keys and deeper shelf water',summer:'the Florida Panhandle and Alabama'},
{k:'core',who:'Blacktips & spinners (western Gulf)',m:['W','W','N','N','N','U','U','U','U','S','S','S'],path:[[-96.55,25.3],[-96.35,26.6],[-95.6,27.65],[-94.2,28.25],[-92.5,28.4],[-90.8,28.25],[-89.3,28.6]],winter:'south Texas, Mexico and deeper shelf water',summer:'the Texas, Louisiana and Mississippi coast'},
{k:'warm',who:'Bull, tiger & hammerhead, Gulf (lower confidence)',m:['W','W','W','N','N','N','U','U','U','S','S','W'],path:[[-82.1,24.75],[-83.0,25.7],[-83.55,26.85],[-84.1,27.9],[-84.9,28.7]],winter:'South Florida and the Keys',summer:'the whole Gulf coast'}];
function gText(g,mo){var c=g.m[mo];return c==='N'?g.who+': typically heading back inshore and up the coast this month':c==='S'?g.who+': typically heading '+(g.path[0][0]<-90?'down the coast and offshore':'south toward '+g.winter)+' this month':c==='W'?g.who+': typically wintering in '+g.winter:g.who+': typically summering along '+g.summer;}
function migAt(k,lat,mo){var g=MIG[k],c=g.m[mo],w=g.win,u=g.sum;
if(c==='W')return lat>=w[0]&&lat<=w[1]?['here','wintering here']:lat>w[1]?['away','most are south of here for the winter']:['away','most winter north of here'];
if(c==='U')return lat>=u[0]&&lat<=u[1]?['here','summering here']:lat<u[0]?['away','most have moved north of here']:['away','most summer south of here'];
if(lat<w[0]&&lat<u[0])return ['away','not usually this far south'];
if(c==='N'){if(lat>u[1])return ['away','not here yet; they arrive later in the season'];if(lat>=u[0])return ['here','arriving here now (heading north)'];if(lat>w[1])return ['here','passing through here, heading north'];return ['here','leaving here now, heading north'];}
if(lat>u[1])return ['away','not usually this far north'];if(lat>=u[0])return ['here','leaving here now, heading south'];if(lat>w[1])return ['here','passing through here, heading south'];return ['here','arriving here now for the winter'];}
function migText(k,mo){var g=MIG[k],c=g.m[mo];return c==='N'?g.who+': typically heading north this month':c==='S'?g.who+': typically heading south this month':c==='W'?g.who+': typically wintering in '+g.winter:g.who+': typically summering in '+g.summer;}
var SPX={sk:{n:'Silky',t:[70,88]},bn:{n:'Blacknose',t:[70,88]},sb:{n:'Sandbar',t:[58,82]},st:{n:'Sand tiger',t:[55,76]},du:{n:'Dusky',t:[62,80]},bt:{n:'Blacktip',t:[68,86]},sp:{n:'Spinner',t:[68,86]},
sn:{n:'Atlantic sharpnose',t:[62,88]},bo:{n:'Bonnethead',t:[62,90]},ft:{n:'Finetooth',t:[70,88]},bu:{n:'Bull',t:[64,92]},le:{n:'Lemon',t:[70,90]},
ti:{n:'Tiger',t:[72,90]},nu:{n:'Nurse',t:[72,90]},sh:{n:'Scalloped hammerhead',t:[72,88]},gh:{n:'Great hammerhead',t:[72,88]},
sm:{n:'Smooth dogfish',t:[50,72]},sd:{n:'Spiny dogfish',t:[40,64]}};
var PROT_ALL=['sb','st','du'],PROT_ST={FL:['le','ti','sh','gh']};
var SPM={},BT={},BN={},BR={};
var SW_COAST_URL="https://sharkleashdevelopment.github.io/sharkleash-data/coastline.json";
var SW_DATA_URL="https://sharkleashdevelopment.github.io/sharkleash-data/shark-data.json";
var DEEP=[];
fetch(SW_COAST_URL).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(J){COAST=J.coast;parseCoast();}).catch(function(){});
fetch(SW_DATA_URL,{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(J){
var sp=J.speciesByMonth||{};for(var k in sp)SPM[k]=sp[k];sp=J.speciesByRegion||{};for(k in sp)SPM[k]=sp[k];var pr=J.protected||{};for(var a in pr){if(a==='FL'){PROT_ST['FL-PAN']=pr[a];PROT_ST['FL-SW']=pr[a];}else PROT_ST[a]=pr[a];}
BT=J.baitByRegion||{};BR=J.baitRules||{};(J.baitSpecies||[]).forEach(function(b){BN[b.code]=b.short||b.name;});
var C={high:'h',medium:'m',low:'l',inlet:'i'},f=function(v){return v==null?'':String(v).replace(/^>\s*/,'+');};
/* a local ban with banMonths (1-12) only applies in those months, Eastern time */
function banOn(b){if(!b||!b.localBan)return false;var m=b.banMonths;if(!m||!m.length)return true;var mo=+new Intl.DateTimeFormat('en-US',{month:'numeric',timeZone:'America/New_York'}).format(new Date());return m.indexOf(mo)>=0;}
(J.beaches||[]).forEach(function(b){var d=b.depth;if(!d)return;DEEP.push([b.lat,b.lon,f(d.to10ftYd),f(d.to15ftYd),C[d.confidence]||'m',b.name+(b.state?', '+b.state:''),banOn(b)?b.localBan:'']);});
try{window.dispatchEvent(new Event('slsw:data'));}catch(e){}
}).catch(function(){});
var SHOW_ID=true,ID_URL='/shark-id';
function idOn(){return SHOW_ID||/[?&]idtest=1/.test(location.search);}
function idLink(ab,mo,r){var top=r.here.filter(function(s){return s.fit!==false;}).slice(0,3).map(function(s){return s.c;});
var c=window.SLMC_LAST||{},w=c.w||{},where=c.where||(w.town?w.town:'');
return ID_URL+'?st='+ab+'&mo='+mo+(top.length?'&lk='+top.join(','):'')+(where?'&bw='+encodeURIComponent(where):'');}
/* Temps in SPX are preferred ranges, not hard limits: within EDGE °F outside them a species still shows as possible (🟡). */
var EDGE=4;
var LVL=['','possible','common','peak'],MSH=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function spRegion(ab,lat,lon){if(ab==='FL'&&lat!=null&&lon!=null&&lon<-81.65&&lat>25.3){var k=lat>=28.9?'FL-PAN':'FL-SW';if(SPM[k])return k;}return ab;}
function speciesAt(ab,mo,t,lat,lon){if(lat==null&&window.SLMC_LAST){lat=SLMC_LAST.lat;if(lon==null)lon=SLMC_LAST.lon;}var rk=spRegion(ab,lat,lon),rows=SPM[rk]||[],nx=(mo+1)%12,here=[],later=[];
var OV=rk==='FL'&&lat!=null&&lat<27.6?{bu:'222333333222'}:{};
rows.forEach(function(r,i){var c=r[0],P=OV[c]||r[1],l=+P.charAt(mo),n=+P.charAt(nx),sp=SPX[c],pr=PROT_ALL.indexOf(c)>-1||(PROT_ST[rk]||[]).indexOf(c)>-1;
var lo=sp.t[0],hi=sp.t[1],fit=t==null?null:(t>=lo&&t<=hi)?true:(t>=lo-EDGE&&t<=hi+EDGE)?'edge':false;
var why=t==null||fit===true?'':fit==='edge'?(t<lo?'water on the cool side for them':'water on the warm side for them'):(t<lo?'water too cold':'water too warm');
if(l>0)here.push({c:c,name:sp.n,lvl:l,lvlName:LVL[l],trend:n>l?'arriving':n<l?(n?'thinning out':'leaving'):'steady',fit:fit,why:why,prot:pr,i:i});
else{var fwd=0,back=0;
for(var k=1;k<12;k++){if(+P.charAt((mo+k)%12)>0){fwd=k;break;}}
for(var k2=1;k2<12;k2++){if(+P.charAt((mo-k2+12)%12)>0){back=k2;break;}}
if(fwd)later.push({c:c,name:sp.n,back:MSH[(mo+fwd)%12],prot:pr,k:fwd,gone:!!back&&back<fwd});}});
here.sort(function(a,b){return (b.fit===false?0:1)-(a.fit===false?0:1)||b.lvl-a.lvl||a.i-b.i;});
later.sort(function(a,b){return a.k-b.k;});
return {here:here,later:later};}
function speciesHTML(ab,mo,t,lat,lon){var r=speciesAt(ab,mo,t,lat,lon),h='';
if(idOn()&&r.here.length)h+='<a href="'+idLink(ab,mo,r)+'" onclick="if(window.gtag)gtag(\'event\',\'shark_id_open\',{state:\''+ab+'\'});" style="display:block;text-align:center;margin:8px 0 10px;font-size:16px;font-weight:900;color:#fff;background:linear-gradient(135deg,#ff2b2b,#ff6a00);border-radius:14px;padding:12px 16px;text-decoration:none;box-shadow:0 8px 22px rgba(0,0,0,.4)">🦈 Caught one? Identify your shark →</a>';
if(!r.here.length)h+='<div style="margin-top:6px">⏸️ No sharks typically in from shore here this month.</div>';
r.here.forEach(function(s){var ic=s.fit===false?'🌡️':s.fit==='edge'?'🟡':s.lvl>=2?'✅':'🟡';
h+='<div style="margin-top:4px">'+ic+' <b>'+s.name+'</b>'+(s.prot?' <span style="font-size:10px;font-weight:900;letter-spacing:.06em;color:#fff;background:#ff2b2b;border-radius:999px;padding:1px 6px">PROTECTED</span>':'')+
' · '+s.lvlName+', '+s.trend+(s.why?' <span style="color:rgba(255,255,255,.6)">('+s.why+' right now)</span>':'')+'</div>';});
if(lat==null&&window.SLMC_LAST){lat=SLMC_LAST.lat;lon=SLMC_LAST.lon;}var br=BT[spRegion(ab,lat,lon)]||BT[ab]||[],pk=[],cm=[];
br.forEach(function(x){var l=+x[1].charAt(mo);if(l>2)pk.push(BN[x[0]]);else if(l>1)cm.push(BN[x[0]]);});
if(pk.length||cm.length)h+='<div style="margin-top:10px;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#6ee7ff">Bait running here in '+MSH[mo]+'</div><div style="margin-top:3px">'+(pk.length?'<b>'+pk.join(', ')+'</b> (peak)':'')+(pk.length&&cm.length?' · ':'')+cm.join(', ')+'</div>'+(BR[ab]?'<div style="margin-top:3px;font-size:12px;color:rgba(255,255,255,.6)">Catching bait in '+ab+': '+BR[ab][0]+'</div>':'');
var gone=r.later.filter(function(s){return s.gone;}),notyet=r.later.filter(function(s){return !s.gone;});
var fmt=function(a){return a.map(function(s){return s.name+' (~'+s.back+')';}).join(', ');};
if(gone.length)h+='<div style="margin-top:6px;font-weight:600;color:rgba(255,255,255,.65)">Gone for the season, back: '+fmt(gone)+'</div>';
if(notyet.length)h+='<div style="margin-top:6px;font-weight:600;color:rgba(255,255,255,.65)">Not in yet: '+fmt(notyet)+'</div>';
return h;}
function init(){
var svg=document.getElementById('slm-map'),root=document.getElementById('slm'),ui=document.getElementById('slsw-ui');
if(!svg||!root||!svg.querySelector('.st')||!SW_COAST_OK)return setTimeout(init,300);
var ch=document.getElementById('slm-chips');ch.parentNode.insertBefore(ui,ch.nextSibling);root.classList.add('sw-soft');
var info=document.getElementById('slsw-info');svg.parentNode.insertBefore(info,svg.nextSibling);
var NS='http://www.w3.org/2000/svg',leg=document.getElementById('slsw-leg');
var defs=document.createElementNS(NS,'defs');
function stripe(id,a,b){return '<pattern id="'+id+'" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)"><rect width="5" height="5" fill="'+a+'"/><rect width="2.5" height="5" fill="'+b+'"/></pattern>';}
defs.innerHTML=stripe('slsw-cc',GROUPS.cool.col,GROUPS.core.col)+stripe('slsw-cw',GROUPS.core.col,GROUPS.warm.col)+stripe('slsw-kw',GROUPS.cool.col,GROUPS.warm.col);
svg.insertBefore(defs,svg.firstChild);
var FILL={'cold':COLD,'cool':GROUPS.cool.col,'core':GROUPS.core.col,'warm':GROUPS.warm.col,'cool+core':'url(#slsw-cc)','core+warm':'url(#slsw-cw)','cool+warm':'url(#slsw-kw)','cool+core+warm':'url(#slsw-cw)'};
var layer=document.createElementNS(NS,'g');layer.setAttribute('id','slsw-layer');layer.style.display='none';svg.insertBefore(layer,defs.nextSibling);
var mark=document.createElementNS(NS,'g');mark.style.display='none';mark.style.pointerEvents='none';mark.innerHTML='<path class="tk" fill="none" stroke="#02080d" stroke-linecap="round"/><path class="tk2" fill="none" stroke="#fff" stroke-linecap="round"/><circle class="h" fill="none" stroke="#02080d"/><circle class="r" fill="rgba(255,255,255,.12)" stroke="#fff"/><circle class="d" fill="#fff" stroke="#02080d"/>';svg.appendChild(mark);var mq=null;
function placeMark(){if(!mq)return;var k=(vb?vb[2]:520)/520,x=+mq[0],y=+mq[1],r=10*k,t1=r+2*k,t2=r+7*k,E=mark.children,A=function(el,o){for(var a in o)el.setAttribute(a,o[a]);};
var d='M'+(x-t2)+','+y+'H'+(x-t1)+'M'+(x+t1)+','+y+'H'+(x+t2)+'M'+x+','+(y-t2)+'V'+(y-t1)+'M'+x+','+(y+t1)+'V'+(y+t2);
A(E[0],{d:d,'stroke-width':4.4*k});A(E[1],{d:d,'stroke-width':2*k});A(E[2],{cx:x,cy:y,r:r,'stroke-width':5*k});A(E[3],{cx:x,cy:y,r:r,'stroke-width':2.4*k});A(E[4],{cx:x,cy:y,r:2.6*k,'stroke-width':1.2*k});}
var XY=PTS.map(function(l){return l.map(function(p){var q=proj(p[1],p[0]);q.push(p[0],p[1]);return q;});});
var base=document.createElementNS(NS,'path');base.setAttribute('d',XY.map(function(l){return 'M'+l.map(function(q){return q[0].toFixed(1)+','+q[1].toFixed(1);}).join('L');}).join(''));base.setAttribute('fill','none');base.setAttribute('stroke','#7fa3b5');base.setAttribute('stroke-width',3);base.setAttribute('stroke-linejoin','round');base.style.pointerEvents='none';svg.insertBefore(base,layer);
function snapXY(sp){var b=null,bd=1e9;XY.forEach(function(l){l.forEach(function(q){var d=Math.hypot(q[0]-sp.x,q[1]-sp.y);if(d<bd){bd=d;b=q;}});});return b;}
var MO=new Date().getMonth(),MON=new Date().toLocaleDateString([], {month:'long'});
var arrows=document.createElementNS(NS,'g');arrows.setAttribute('id','slsw-mig');
['cool','core','warm'].map(function(k){return {k:k,g:MIG[k],t:migText(k,MO)};}).concat(GMIG.map(function(g){return {k:g.k,g:g,t:gText(g,MO)};})).forEach(function(it){
var k=it.k,g=it.g,TXT=it.t,c=g.m[MO],col=GROUPS[k].col,pts=g.path.map(function(p){return proj(p[0],p[1]);});
if(c==='S')pts=pts.slice().reverse();
if(c==='W')pts=pts.slice(0,c==='W'?3:pts.length);
if(c==='U')pts=pts.slice(pts.length-3);
var d='M'+pts.map(function(p){return p[0].toFixed(1)+','+p[1].toFixed(1);}).join('L');
var G=document.createElementNS(NS,'g');G.style.cursor='pointer';
var mv=(c==='N'||c==='S');
G.innerHTML='<path d="'+d+'" fill="none" stroke="#02080d" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'+
'<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"'+(mv?' marker-end="url(#slsw-ah-'+k+')"':' stroke-dasharray="2 6"')+'/>'+
(mv?'':'<circle cx="'+pts[Math.floor(pts.length/2)][0].toFixed(1)+'" cy="'+pts[Math.floor(pts.length/2)][1].toFixed(1)+'" r="6" fill="#02080d" stroke="'+col+'" stroke-width="2.5"/>')+
'<path d="'+d+'" fill="none" stroke="transparent" stroke-width="22"/><title>'+TXT+'</title>';
G.addEventListener('click',function(ev){ev.stopPropagation();info.style.display='block';info.innerHTML='<b>'+MON+':</b> '+TXT+'<small>Typical season from shark tagging studies; timing shifts year to year with water temperature.</small>';});
arrows.appendChild(G);});
['cool','core','warm'].forEach(function(k){var m=document.createElementNS(NS,'marker');m.setAttribute('id','slsw-ah-'+k);m.setAttribute('viewBox','0 0 10 10');m.setAttribute('refX','5');m.setAttribute('refY','5');
m.setAttribute('markerWidth','3.2');m.setAttribute('markerHeight','3.2');m.setAttribute('orient','auto-start-reverse');m.innerHTML='<path d="M0,0L10,5L0,10Z" fill="'+GROUPS[k].col+'" stroke="#02080d" stroke-width="1"/>';defs.appendChild(m);});
svg.appendChild(arrows);
var LA_BADGE=[200,318];
function droneLines(){var B=svg.querySelectorAll('.dbadge');if(!B.length)return setTimeout(droneLines,300);
var old=svg.querySelector('#slsw-dl');if(old)old.remove();
var g=document.createElementNS(NS,'g');g.setAttribute('id','slsw-dl');g.style.pointerEvents='none';
B.forEach(function(b){var n=b.dataset.n;if(n==='Louisiana')b.setAttribute('transform','translate('+LA_BADGE[0]+','+LA_BADGE[1]+')');
var m=/translate\(\s*([-\d.]+)[ ,]+([-\d.]+)/.exec(b.getAttribute('transform')||'');if(!m)return;
var x=+m[1],y=+m[2],best=null,bd=1e9;
XY.forEach(function(l,li){if(PST[li]!==n)return;l.forEach(function(q){var d=Math.hypot(q[0]-x,q[1]-y);if(d<bd){bd=d;best=q;}});});
if(!best||bd<16)return;var k=13/bd,ln=document.createElementNS(NS,'line');
ln.setAttribute('x1',(x+(best[0]-x)*k).toFixed(1));ln.setAttribute('y1',(y+(best[1]-y)*k).toFixed(1));
ln.setAttribute('x2',best[0].toFixed(1));ln.setAttribute('y2',best[1].toFixed(1));
ln.setAttribute('stroke','#fff');ln.setAttribute('stroke-width','1');ln.setAttribute('stroke-opacity','.8');
ln.setAttribute('stroke-linecap','round');ln.setAttribute('vector-effect','non-scaling-stroke');g.appendChild(ln);});
svg.insertBefore(g,svg.querySelector('.dbadge'));}
droneLines();
var chk=document.getElementById('slsw-mig-on');
try{if(localStorage.getItem('slsw_mig')==='0')chk.checked=false;}catch(e){}
function migVis(){arrows.style.display=chk.checked?'':'none';var r=leg.querySelector('.migrow');if(r)r.style.display=chk.checked?'':'none';try{localStorage.setItem('slsw_mig',chk.checked?'1':'0');}catch(e){}}
chk.addEventListener('change',function(){migVis();if(!chk.checked&&/typically/.test(info.textContent))status();if(!chk.checked&&legOpen==='mig')legend();});
var VAL=[],day='',built=false,partial=false;
function sw(k){var f=FILL[k];if(f.indexOf('url(')===0){var id=f.slice(5,-1);return '<svg viewBox="0 0 22 14"><defs>'+defs.querySelector('#'+id).outerHTML.replace('id="'+id+'"','id="'+id+'-l"')+'</defs><rect width="22" height="14" fill="url(#'+id+'-l)"/></svg>';}
return '<svg viewBox="0 0 22 14"><rect width="22" height="14" fill="'+f+'"/></svg>';}
var legOpen=null,aboutOpen=false,SHORT={cool:'Cool',core:'Core',warm:'Warm'};
var ZCHIP={'cool':'cool','core':'core','warm':'warm','cool+core':'cc','core+warm':'cw','cool+warm':'cw','cool+core+warm':'cw','cold':'cold'},pickZone=null;
function paintZone(){var z=legOpen&&legOpen!=='mig'?legOpen:pickZone;
layer.querySelectorAll('path[data-k]').forEach(function(p){p.style.opacity=!z||ZCHIP[p.getAttribute('data-k')]===z?'':'.28';});
leg.querySelectorAll('.it').forEach(function(b){b.classList.toggle('zon',!!pickZone&&b.getAttribute('data-k')===pickZone);});}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}
function rng(g){return g.min+(g.max<99?'–'+g.max:'+')+'°F';}
var KX={
cool:function(){var g=GROUPS.cool;return ['<b>'+g.label+' · '+rng(g)+'</b>'+cap(g.who)+'.','Sandbar and sand tiger are catch-and-release only.'];},
core:function(){var g=GROUPS.core;return ['<b>'+g.label+' · '+rng(g)+'</b>'+cap(g.who)+'.','Dusky is catch-and-release only.'];},
warm:function(){var g=GROUPS.warm;return ['<b>'+g.label+' · '+rng(g)+'</b>'+cap(g.who)+'. Lower confidence.','Florida: lemon, tiger and hammerheads are catch-and-release only.'];},
cc:function(){return ['<b>Cool + Core · '+GROUPS.core.min+'–'+GROUPS.cool.max+'°F</b>Overlap water: cool-water sharks and core migrators can both be in. Typical in spring and fall.','Sandbar, sand tiger and dusky are catch-and-release only.'];},
cw:function(){return ['<b>Core + Warm · '+GROUPS.warm.min+'–'+GROUPS.core.max+'°F</b>Overlap water: core migrators plus bull, tiger, lemon and hammerheads. Lower confidence on the warm group.','Dusky is catch-and-release only. Florida: lemon, tiger and hammerheads too.'];},
cold:function(){return ['<b>Under '+GROUPS.cool.min+'°F</b>Too cold for most sharks from shore. Expect slow fishing.'];},
mig:function(){return ['<b>Migration in '+MON+'</b>Solid arrows offshore show which way each group typically moves this month. Dotted lines mark where they winter or summer. Tap any arrow for details.'];}
};
function legend(){
if(legOpen==='mig'&&!chk.checked)legOpen=null;
function chip(k,s,txt,cls){return '<button type="button" class="it'+(cls?' '+cls:'')+'" data-k="'+k+'" aria-expanded="'+(legOpen===k)+'">'+s+txt+'</button>';}
var h='<div class="row">';
['cool','core','warm'].forEach(function(k){var g=GROUPS[k];h+=chip(k,sw(k),SHORT[k]+' '+g.min+(g.max<99?'–'+g.max:'+')+'°');});
h+=chip('cc',sw('cool+core'),'Cool + Core')+chip('cw',sw('core+warm'),'Core + Warm')+chip('cold',sw('cold'),'Under '+GROUPS.cool.min+'°');
h+=chip('mig','<svg viewBox="0 0 22 14"><path d="M2,7H16" stroke="#fff" stroke-width="2.4"/><path d="M14,3L20,7L14,11Z" fill="#fff"/></svg>','Migration','migrow')+'</div>';
if(legOpen&&KX[legOpen]){var x=KX[legOpen]();h+='<div class="kx" aria-live="polite">'+x[0]+(x[1]?'<div class="cr">'+x[1]+'</div>':'')+'</div>';}
h+='<div class="hint">Tap a color for species. Tap the shoreline for what\u2019s there this month.'+(partial?' <b>Some coast didn\u2019t load; refresh to retry.</b>':'')+'</div>';
h+='<details'+(aboutOpen?' open':'')+'><summary>About this data</summary><div class="note">Nearshore water temps from NOAA satellite data'+(day?' ('+new Date(day).toLocaleDateString([], {month:'short',day:'numeric'})+')':'')+', checked against the nearest buoys and coastal stations. The band is drawn wider than the surf zone so you can see it. It\u2019s a temperature fit, not a forecast of where sharks are.</div></details>';
leg.innerHTML=h;if(typeof migVis==='function')migVis();paintZone();}
leg.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.it');if(!b)return;var k=b.getAttribute('data-k');legOpen=legOpen===k?null:k;legend();});
leg.addEventListener('toggle',function(e){if(e.target.tagName==='DETAILS')aboutOpen=e.target.open;},true);
function build(sat,obs){
day=sat.day;var near=index(sat.cells);
obs.forEach(function(o){o.sat=near(o.la,o.lo,25);});
var paths={};
PTS.forEach(function(l,li){VAL[li]=l.map(function(p){
var s=near(p[0],p[1],20),best=null,bd=OBS_KM;
obs.forEach(function(o){var d=km(p[0],p[1],o.la,o.lo);if(d<bd){bd=d;best=o;}});
var v=s,src='satellite';
if(best){var w=Math.max(0,1-bd/OBS_KM);
if(s!==null&&best.sat!==null){v=s+(best.f-best.sat)*w;src='satellite, checked against '+best.id+' ('+Math.round(bd*0.621)+' mi)';}
else if(s===null&&bd<25){v=best.f;src='reading from '+best.id+' ('+Math.round(bd*0.621)+' mi)';}}
return v===null?null:{t:v,src:src};});
for(var i=1;i<l.length;i++){var a=VAL[li][i-1],b=VAL[li][i];if(!a||!b)continue;var k=bandKey((a.t+b.t)/2),A=XY[li][i-1],B=XY[li][i];
(paths[k]=paths[k]||[]).push('M'+A[0].toFixed(1)+','+A[1].toFixed(1)+'L'+B[0].toFixed(1)+','+B[1].toFixed(1));}});
layer.innerHTML='';var all=[];Object.keys(paths).forEach(function(k){all=all.concat(paths[k]);});var cs=document.createElementNS(NS,'path');cs.setAttribute('d',all.join(''));cs.setAttribute('fill','none');cs.setAttribute('stroke','#02080d');cs.setAttribute('stroke-width',BAND+4);cs.setAttribute('stroke-linecap','round');cs.setAttribute('stroke-linejoin','round');layer.appendChild(cs);
Object.keys(paths).forEach(function(k){var p=document.createElementNS(NS,'path');p.setAttribute('d',paths[k].join(''));p.setAttribute('fill','none');p.setAttribute('data-k',k);
p.setAttribute('stroke',FILL[k]||COLD);p.setAttribute('stroke-width',BAND);p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');layer.appendChild(p);});
paintZone();built=true;try{window.dispatchEvent(new Event('slsw:ready'));}catch(e){}if(waitPick){waitPick=false;onCond();}}
var CELLS={},OBS=[],DAY='',total=0,done=0,failed=0,pending=null,timer=null;
var qT=null,pill=document.createElement('div');pill.style.cssText='display:none;position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:9999;background:#02080d;color:#6ee7ff;border:1px solid #6ee7ff;border-radius:999px;padding:8px 14px;font:700 13px Arial,sans-serif;pointer-events:none;white-space:nowrap';document.body.appendChild(pill);
function pillUp(){if(qT&&Date.now()-qT[2]>30000)qT=null;pill.textContent='Loading water temps\u2026 '+done+' of '+total;pill.style.display=qT&&done<total?'':'none';}
var shownPick=false;function status(){if(qT&&built){var t=qT,m=svg.getScreenCTM();qT=null;if(m)svg.dispatchEvent(new MouseEvent('click',{clientX:m.a*t[0]+m.c*t[1]+m.e,clientY:m.b*t[0]+m.d*t[1]+m.f}));}pillUp();if(shownPick)return;info.style.display='block';
if(done<total)info.textContent='Loading NOAA nearshore water temperatures… '+done+' of '+total+' areas';
else if(!Object.keys(CELLS).length)info.textContent='Couldn\u2019t load satellite water temps right now. Refresh to try again.';
else info.textContent='Tap the shoreline for the nearshore water temp and which sharks fit.'+(failed?' ('+failed+' area'+(failed>1?'s':'')+' didn\u2019t load; refresh to retry.)':'');}
function redraw(){clearTimeout(timer);timer=setTimeout(function(){var arr=[];for(var k in CELLS)arr.push(CELLS[k]);if(arr.length)build({day:DAY,cells:arr},OBS);partial=failed>0;legend();status();},150);}
function preload(){if(pending)return pending;
var list=tiles();total=list.length;done=0;failed=0;
loadObs().then(function(o){OBS=o;redraw();});
function next(){var f=FOC||(window.SLMC_LAST&&SLMC_LAST.lat!=null?{la:SLMC_LAST.lat,lo:SLMC_LAST.lon}:null),j=0,bd=1e9;
if(f)list.forEach(function(b,k){var d=km(f.la,f.lo,(b[0]+b[1])/2,(b[2]+b[3])/2);if(d<bd){bd=d;j=k;}});return list.splice(j,1)[0];}
function worker(){if(!list.length)return Promise.resolve();var b=next();
return loadTile(b).then(function(t){if(t.day)DAY=t.day;t.cells.forEach(function(c){CELLS[c[0]+','+c[1]]=c;});},function(){failed++;})
.then(function(){done++;redraw();status();}).then(worker);}
pending=Promise.all([worker(),worker(),worker(),worker()]).then(function(){if(failed)pending=null;});
return pending;}
layer.style.display='';legend();
preload();
svg.style.touchAction='manipulation';
var TAP_PX=28;
function spotName(q,stName){var b=null,bd=1e9;DEEP.forEach(function(d){var k=km(q[2],q[3],d[0],d[1]);if(k<bd){bd=k;b=d;}});if(b&&bd<=13)return b[5];
var c=window.SLMC_LAST;if(c&&c.town&&c.lat!=null&&Math.abs(c.lat-q[2])<.15&&Math.abs(c.lon-q[3])<.15)return 'Near '+c.town;return (stName||'')+' shoreline';}
function nameHTML(q,stName){return '<div class="slsw-nm" style="font-size:13px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:#6ee7ff;margin:0 0 6px">📍 '+spotName(q,stName)+'</div>';}
var lastSt='';
function show(q,v,extra,stName){shownPick=true;pickZone=ZCHIP[bandKey(v.t)]||null;paintZone();lastSt=stName||lastSt;mq=q;placeMark();mark.style.display='';svg.appendChild(mark);setTimeout(function(){svg.appendChild(mark);},0);info.style.display='block';
var g=groupsFor(v.t),h=(extra?extra+'<br>':'')+Math.round(v.t)+'°F near shore · '+(g.length?g.map(function(k){return GROUPS[k].label;}).join(' + ')+' fit':'Too cold for most sharks');
if(chk.checked){var ab=AB[stName];
if(ab){h+='<div style="margin-top:6px;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#6ee7ff">Sharks you could hook here in '+MON+'</div>'+speciesHTML(ab,MO,v.t,q[2],q[3]);}
else{var lat=q[2],rows='';['cool','core','warm'].forEach(function(k){var a=migAt(k,lat,MO),fit=g.indexOf(k)>=0,
mark=a[0]==='here'&&fit?'✅':a[0]==='here'?'🌡️':'⏸️',tail=a[0]==='here'&&!fit?' (but water is '+(v.t<GROUPS[k].min?'too cold':'too warm')+' for them right now)':'';
rows+='<div style="margin-top:4px">'+mark+' <b style="color:'+GROUPS[k].col+'">'+MIG[k].who+'</b>: '+a[1]+tail+'</div>';});
h+=rows;}}
info.innerHTML=nameHTML(q,stName)+h+'<small>🎯 Press and drag the target along the shore to fine-tune.</small><small>✅ common/peak and water fits · 🟡 possible, or water on the edge of their range · 🌡️ in season but water is off right now. Water: '+v.src+'. Seasons: typical '+MON+' pattern from tagging studies; timing shifts year to year.</small>';}
var VB0=[0,0,520,362],vb=VB0.slice(),zoomed=false,anim=null;
svg.style.overflow='hidden';
function setVB(b){vb=b;svg.setAttribute('viewBox',b.map(function(n){return n.toFixed(1);}).join(' '));placeMark();}
function animateTo(t){cancelAnimationFrame(anim);var f=vb.slice(),t0=performance.now();
(function step(now){var k=Math.min(1,(now-t0)/260),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;setVB(f.map(function(v,i){return v+(t[i]-v)*e;}));if(k<1)anim=requestAnimationFrame(step);})(t0);}
var zbtn=document.createElement('button');zbtn.type='button';zbtn.textContent='✕  Zoom map back out';
zbtn.style.cssText='display:none;position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:99999;font:inherit;font-size:15px;font-weight:900;color:#fff;background:linear-gradient(135deg,#ff2b2b,#ff6a00);border:none;border-radius:999px;padding:12px 20px;box-shadow:0 10px 30px rgba(0,0,0,.5);cursor:pointer';
document.body.appendChild(zbtn);
function pinched(){var v=window.visualViewport;return !!(v&&v.scale>1.05);}
function zoomIn(q){if(pinched())return;var w=520/3.2,h=362/3.2,x=Math.max(0,Math.min(520-w,q[0]-w/2)),y=Math.max(0,Math.min(362-h,q[1]-h/2));zoomed=true;zY=mapTop();zbtn.style.display='';animateTo([x,y,w,h]);}
var zY=0,adj=false,pinT=0,pinTop=0;function mapTop(){return svg.getBoundingClientRect().top;}function pinMap(ms){pinTop=mapTop();pinT=Date.now()+ms;}function fix(){if(Date.now()>pinT)return;var d=mapTop()-pinTop;if(Math.abs(d)>1){adj=true;window.scrollBy(0,d);requestAnimationFrame(function(){adj=false;});}}if(window.ResizeObserver)new ResizeObserver(fix).observe(document.body);
var uT=0;function userScroll(){if(typeof drag!=='undefined'&&drag)return;uT=Date.now();pinT=0;}
window.addEventListener('touchstart',function(){if(zoomed)zY=mapTop();},{passive:true});
window.addEventListener('touchmove',userScroll,{passive:true});window.addEventListener('wheel',userScroll,{passive:true});
window.addEventListener('keydown',function(e){if(/^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| )$/.test(e.key))userScroll();});
window.addEventListener('scroll',function(){if(adj)return;pinTop=mapTop();},{passive:true});
function zoomOut(){zoomed=false;zbtn.style.display='none';animateTo(VB0.slice());}
zbtn.addEventListener('click',function(ev){ev.stopPropagation();zoomOut();});
if('IntersectionObserver' in window)new IntersectionObserver(function(en){if(zoomed)zbtn.style.display=en[0].isIntersecting?'':'none';}).observe(svg);
var REP={ME:[43.51,-70.37],NH:[42.91,-70.81],MA:[41.67,-69.95],RI:[41.43,-71.46],CT:[41.26,-72.55],NY:[40.63,-73.26],NJ:[39.87,-74.09],DE:[38.79,-75.09],MD:[38.21,-75.15],VA:[36.72,-75.94],NC:[35.23,-75.53],SC:[32.66,-79.94],GA:[32.01,-80.85],FL:[28.32,-80.61],AL:[30.246,-87.7],MS:[30.39,-88.89],LA:[29.24,-89.99],TX:[29.28,-94.8]};
function nearestPt(lat,lon,state){var b=null,bd=1e9;XY.forEach(function(l,li){if(state&&PST[li]!==state)return;l.forEach(function(q,i){var v=VAL[li]&&VAL[li][i];if(!v)return;var d=Math.hypot(q[2]-lat,(q[3]-lon)*Math.cos(lat*R));if(d<bd){bd=d;b={q:q,v:v,st:PST[li]};}});});return b;}
var syncing=false;
function deepAt(lat,lon){var b=null,bd=1e9;DEEP.forEach(function(d){var k=km(lat,lon,d[0],d[1]);if(k<bd){bd=k;b=d;}});return bd<15?b:null;}
function banAt(lat,lon){var b=null,bd=1e9;DEEP.forEach(function(d){var k=km(lat,lon,d[0],d[1]);if(k<bd){bd=k;b=d;}});return b&&bd<=8&&b[6]?b:null;}
function yd(v){return v.charAt(0)==='+'?'over '+(+v.slice(1)).toLocaleString():(+v).toLocaleString();}
function gapLine(c){var b=null,bd=1e9;DEEP.forEach(function(d){if(d[4]==='i'||!d[2])return;var k=km(c.lat,c.lon,d[0],d[1]);if(k<bd){bd=k;b=d;}});
if(!b||bd>160)return '';var mi=Math.max(1,Math.round(bd*0.621)),dir=['north','northeast','east','southeast','south','southwest','west','northwest'][Math.round(((Math.atan2((b[1]-c.lon)*Math.cos(c.lat*R),b[0]-c.lat)/R)+360)%360/45)%8],far=b[2].charAt(0)==='+'||+b[2]>800;
return '<div style="margin-top:4px;opacity:.85">🌊 No depth data for this exact spot. Nearest measured: '+b[5]+', '+(far?'stays under 10 ft for '+yd(b[2])+' yd':'10 ft about '+yd(b[2])+' yd out'+(b[3]?(b[3].charAt(0)==='+'?', stays under 15 ft past '+yd(b[3].slice(1))+' yd':', 15 ft about '+yd(b[3])+' yd'):''))+' ('+mi+' mi '+dir+').</div>';}
function deepLine(c){var d=deepAt(c.lat,c.lon);if(!d)return gapLine(c);
if(d[4]==='i')return '<div style="margin-top:4px">🌊 Inlet: the deep channel runs right along the jetty.</div>';
var far=d[2].charAt(0)==='+'||+d[2]>800,no15=d[3].charAt(0)==='+',h='🌊 '+(far?'Stays under 10 ft for '+yd(d[2])+' yd'+(d[3]&&!no15?', 15 ft about '+yd(d[3])+' yd':''):'Deep water (10 ft at low tide) about <b>'+yd(d[2])+' yd</b> out, '+(no15?'stays under 15 ft past '+yd(d[3].slice(1))+' yd':'15 ft about '+yd(d[3])+' yd'))+(d[4]==='l'?' (rough estimate)':'');
var w=c.w||{},sp=String(w.spd||'').match(/\d+/g),mx=sp?Math.max.apply(null,sp.map(Number)):0,dp=document.querySelector('#slm-panel .drone.ban');
if(!dp){if(mx>=29)h+='<br>💨 '+mx+' mph: too windy to fly a drop safely.';
else if(mx>=17)h+='<br>💨 Windy ('+mx+' mph): try a shorter drop'+(far?' to the nearest trough you can reach':', just past ~'+yd(d[2])+' yd')+'.';
else if(!far)h+='<br>🎯 Drop just past ~'+(no15?yd(d[2])+' yd (the 10 ft line)':yd(d[3])+' yd')+'.';
else h+='<br>🎯 Aim for the deepest trough within your drone’s range.';}
return '<div style="margin-top:4px">'+h+' <span style="opacity:.6;font-size:11.5px">NOAA depth data; bars shift after storms.</span></div>';}
var pickT=0;function upBtn(){drawSum();}
function drawSum(){var old=info.querySelector('.slsw-sum');if(old)old.remove();if(!mq||!window.slmcRun)return;
var c=window.SLMC_LAST,ok=c&&c.lat!=null&&(c.at||0)>=pickT&&Math.abs(c.lat-mq[2])<.15&&Math.abs(c.lon-mq[3])<.15,h='';
if(!ok)h='<div style="opacity:.75">⏳ Loading wind, waves &amp; tides…</div>';
else{var w=c.w,b=[];
if(w&&w.dir)b.push('🌬️ '+w.dir+' '+String(w.spd||'').replace(/ mph/g,'')+' mph');
if(c.wv&&c.wv.now!=null)b.push('🌊 '+(c.wv.now<.5?'<1':Math.round(c.wv.now*2)/2)+' ft');
if(c.wt&&c.wt.f!=null)b.push('🌡️ '+Math.round(c.wt.f)+'°F water');
var f=c.t&&c.t.first;if(f)b.push((f.type==='H'?'⬆️ High ':'⬇️ Low ')+f.t+(f.day&&f.day!=='Today'?' '+f.day:''));
h='<div>'+(b.join(' · ')||'Conditions loaded')+'</div>';
var bn=banAt(c.lat,c.lon);
if(bn)h+='<div style="margin-top:4px;padding:6px 9px;border-radius:8px;background:rgba(255,43,43,.16);border:1px solid rgba(255,43,43,.55);font-weight:800">🚫 Shark fishing banned at '+bn[5].replace(/,\s*[A-Z]{2}$/,'')+'<div style="font-weight:600;font-size:12px;opacity:.8">'+bn[6]+'</div></div>';
else h+=deepLine(c);
var dp=document.querySelector('#slm-panel .drone'),dl='';
if(dp){var cl=dp.classList.contains('ban')?'ban':dp.classList.contains('limit')?'limit':'none',lb=dp.querySelector('b'),S=(c.w||{}).state,la=+c.lat;
dl=(cl==='ban'?'🚫 ':cl==='limit'?'⚠️ ':'✅ ')+(lb?lb.textContent:'');if(cl==='limit'&&(S==='NC'&&!(la>35.88&&la<36.02)||S==='MD'&&la<38.32))dl='✅ Drone bait drops: no state ban';}
var np=document.getElementById('sl-air-nps');if(np&&np.style.display!=='none'&&np.textContent){var nb=np.querySelectorAll('b');dl+=(dl?'<br>':'')+'⚠️ No drones: '+(nb[1]?nb[1].textContent:'National Park land');}
var ag=document.getElementById('sl-air-go');
if(dl||ag)h+='<div style="margin-top:4px">'+dl+(ag&&ag.getAttribute('href')&&ag.getAttribute('href')!=='#'?' <a class="slsw-air" href="'+ag.getAttribute('href')+'" style="color:#6ee7ff;font-weight:900;white-space:nowrap">✈️ Airspace →</a>':'')+'</div>';}
var nmEl=info.querySelector('.slsw-nm');if(nmEl&&mq)nmEl.outerHTML=nameHTML(mq,lastSt);nmEl=info.querySelector('.slsw-nm');
(nmEl||info).insertAdjacentHTML(nmEl?'afterend':'afterbegin','<div class="slsw-sum" role="button" tabindex="0" style="cursor:pointer;margin:0 0 8px;padding:9px 11px;border-radius:10px;background:rgba(255,255,255,.07);border:1px solid rgba(110,231,255,.45);font-size:13.5px;line-height:1.45">'+h+'<div style="margin-top:5px;font-size:12px;font-weight:900;color:#6ee7ff">↑ Tap for full conditions</div></div>');
var sm=info.querySelector('.slsw-sum'),air=sm.querySelector('.slsw-air');
if(air)air.addEventListener('click',function(ev){ev.stopPropagation();var g=document.getElementById('sl-air-go');if(g){ev.preventDefault();g.click();}});
sm.addEventListener('click',function(ev){ev.stopPropagation();var e=document.getElementById('slmc');if(e)e.scrollIntoView({behavior:'smooth',block:'start'});});}
window.addEventListener('sl:nps',function(){if(info.querySelector('.slsw-sum'))drawSum();});
window.addEventListener('slsw:data',function(){if(info.querySelector('.slsw-sum'))drawSum();});
window.addEventListener('slmc:conditions',function(){if(!info.querySelector('.slsw-sum'))return;setTimeout(drawSum,80);setTimeout(drawSum,1800);});
function pick(p,extra,from){if(!p)return;if(from!=='laws')focus(p.q[2],p.q[3]);pickT=from==='conditions'?0:Date.now();if(from!=='conditions')pinMap(9000);show(p.q,p.v,extra,p.st);if(from==='conditions')setTimeout(drawSum,80);syncing=true;
if(from!=='laws'&&p.st&&window.slmSelectState&&AB[p.st])window.slmSelectState(AB[p.st]);
if(from!=='conditions'&&window.slmcRun){window.slmcRun(p.q[2],p.q[3],undefined,from==='laws'?{noMem:1,src:'laws'}:{src:'map'});upBtn();}
setTimeout(function(){syncing=false;},50);}
function inland(p,d){shownPick=true;mark.style.display='none';info.style.display='block';
info.innerHTML='📍 You\u2019re about '+Math.round(d*0.621)+' miles from the nearest shoreline, so there are no sharks to show where you are.'+
'<small>Nearest coast: '+p.st+'.</small><button type="button" class="slsw-near" style="margin-top:8px;font:inherit;font-size:13px;font-weight:900;color:#02080d;background:#6ee7ff;border:none;border-radius:999px;padding:7px 12px;cursor:pointer">Show sharks at the nearest beach</button>';
var nb=info.querySelector('.slsw-near');if(nb)nb.addEventListener('click',function(ev){ev.stopPropagation();pick(p);if(!zoomed)zoomIn(p.q);});}
var waitPick=false;
function onCond(){var c=window.SLMC_LAST;if(!c||syncing)return;if(c.fromMapSync)return;if(c.lat!=null)focus(c.lat,c.lon);
if(!built){waitPick=true;preload();return;}
var p=nearestPt(c.lat,c.lon),d=p?km(c.lat,c.lon,p.q[2],p.q[3]):1e9;
if(d>INLAND_KM&&done<total){waitPick=true;return;}
if(!p)return;
if(d>INLAND_KM){inland(p,d);return;}
pick(p,null,'conditions');}
window.addEventListener('slmc:conditions',onCond);
var chipsEl=document.getElementById('slm-chips');
if(chipsEl)chipsEl.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('button');if(!b||!built)return;var ab=b.textContent.trim(),r=REP[ab];if(!r)return;
var name=null;for(var k in AB)if(AB[k]===ab)name=k;pick(nearestPt(r[0],r[1],name),null,'laws');});
var dragEnd=0;
svg.addEventListener('click',function(e){
if(Date.now()-dragEnd<450){e.stopPropagation();return;}
var pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;var m=svg.getScreenCTM();if(!m)return;var s=pt.matrixTransform(m.inverse());
if(!built||done<total){var nq=snapXY(s);if(nq)focus(nq[2],nq[3]);}
if(!built){qT=[s.x,s.y,Date.now()];pillUp();return;}
var r=TAP_PX/(Math.abs(m.a)||1),best=null,bd=r,bv=null;
var bestState=null;XY.forEach(function(l,li){l.forEach(function(q,i){var dx=s.x-q[0],d=Math.hypot(dx>0?dx*.45:dx,q[1]-s.y);if(d<bd&&VAL[li]&&VAL[li][i]){bd=d;best=q;bv=VAL[li][i];bestState=PST[li];}});});
if(best){e.stopPropagation();pick({q:best,v:bv,st:bestState});if(!zoomed)zoomIn(best);return;}
if(done<total){qT=[s.x,s.y,Date.now()];pillUp();return;}
var st=e.target.closest&&e.target.closest('.st'),name=st&&st.getAttribute('aria-label');
if(name){var nb=null,nd=1e9,nv=null,lo=1e9,hi=-1e9;
XY.forEach(function(l,li){if(PST[li]!==name)return;l.forEach(function(q,i){var v=VAL[li]&&VAL[li][i];if(!v)return;lo=Math.min(lo,v.t);hi=Math.max(hi,v.t);var d=Math.hypot(q[0]-s.x,q[1]-s.y);if(d<nd){nd=d;nb=q;nv=v;}});});
if(nb){pick({q:nb,v:nv,st:name},'<span style="color:#6ee7ff">'+name+' shoreline today: '+Math.round(lo)+(Math.round(hi)!==Math.round(lo)?'–'+Math.round(hi):'')+'°F</span> · nearest beach to your tap:','laws');return;}}
if(!st){info.style.display='block';info.textContent='Tap closer to the shoreline for water temps.';}
},true);
function toMap(cx,cy){var m=svg.getScreenCTM();if(!m)return null;var pt=svg.createSVGPoint();pt.x=cx;pt.y=cy;return pt.matrixTransform(m.inverse());}
function onTarget(cx,cy){if(!mq||mark.style.display==='none')return false;var m=svg.getScreenCTM();if(!m)return false;
var x=m.a*mq[0]+m.c*mq[1]+m.e,y=m.b*mq[0]+m.d*mq[1]+m.f;return Math.hypot(cx-x,cy-y)<=36;}
function snap(sp){var best=null,bd=1e9;XY.forEach(function(l,li){l.forEach(function(q,i){var v=VAL[li]&&VAL[li][i];if(!v)return;var d=Math.hypot(q[0]-sp.x,q[1]-sp.y);if(d<bd){bd=d;best={q:q,v:v,st:PST[li]};}});});return best;}
var drag=null,dragRAF=0;
function dragMove(cx,cy){var sp=toMap(cx,cy);if(!sp)return;var b=snap(sp);if(!b)return;drag.p=b;
if(!dragRAF)dragRAF=requestAnimationFrame(function(){dragRAF=0;if(drag&&drag.p)show(drag.p.q,drag.p.v,'<span style="color:#6ee7ff">Drag along the shore, let go to pick this spot</span>',drag.p.st);});}
function dragStop(){if(!drag)return;var p=drag.p;drag=null;dragEnd=Date.now();if(p){pick(p);if(window.gtag)gtag('event','map_target_drag');}}
svg.addEventListener('touchstart',function(e){if(e.touches.length!==1||!built)return;var t=e.touches[0];if(!onTarget(t.clientX,t.clientY))return;
e.preventDefault();drag={p:null};},{passive:false});
svg.addEventListener('touchmove',function(e){if(!drag)return;e.preventDefault();var t=e.touches[0];dragMove(t.clientX,t.clientY);},{passive:false});
svg.addEventListener('touchend',function(){if(drag){if(drag.p)dragStop();else{drag=null;}}});
svg.addEventListener('touchcancel',function(){drag=null;});
svg.addEventListener('mousedown',function(e){if(!built||!onTarget(e.clientX,e.clientY))return;e.preventDefault();drag={p:null};});
window.addEventListener('mousemove',function(e){if(drag)dragMove(e.clientX,e.clientY);});
window.addEventListener('mouseup',function(){if(drag){if(drag.p)dragStop();else drag=null;}});
window.SLSW={GROUPS:GROUPS,MIG:MIG,migAt:migAt,month:MO,speciesAt:speciesAt,idLink:function(ab,mo,t){return idLink(ab,mo,speciesAt(ab,mo,t));},
inlandKm:INLAND_KM,stateAt:function(lat,lon){if(!built)return null;var p=nearestPt(lat,lon);return p&&km(lat,lon,p.q[2],p.q[3])<INLAND_KM?AB[p.st]:null;},tempAt:function(lat,lon){if(!built)return null;var p=nearestPt(lat,lon);return p&&km(lat,lon,p.q[2],p.q[3])<15?{t:p.v.t,src:p.v.src}:null;}};
try{window.dispatchEvent(new Event('slsw:ready'));}catch(e){}
}
init();
})();
/* Drop Score map layer (heat.js): adds the Shark water / Drop Score map toggle */
(function(){var s=document.createElement('script');s.src='https://sharkleashdevelopment.github.io/sharkleash-data/heat.js?v='+Math.floor(Date.now()/6e5);s.async=true;document.head.appendChild(s);})();
