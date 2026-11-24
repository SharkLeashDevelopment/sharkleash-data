(function(){
var ST=[];
var SPOTS=[];
var $=function(id){return document.getElementById(id)};
var STN={ME:'Maine',NH:'New Hampshire',MA:'Massachusetts',RI:'Rhode Island',CT:'Connecticut',NY:'New York',NJ:'New Jersey',DE:'Delaware',MD:'Maryland',VA:'Virginia',NC:'North Carolina',SC:'South Carolina',GA:'Georgia',FL:'Florida',AL:'Alabama',MS:'Mississippi',LA:'Louisiana',TX:'Texas'};
/* Remembers the last beach on this phone so the picker opens there next time */
var SRC='list',NOMEM=false;
function memBeach(n){if(NOMEM)return;try{localStorage.setItem('slmc_beach',n);}catch(e){}}
function lastBeach(){try{var n=localStorage.getItem('slmc_beach');if(!n)return -1;for(var i=0;i<SPOTS.length;i++)if(SPOTS[i][0]===n)return i;}catch(e){}return -1;}
function spotSt(s){var m=/,\s*([A-Z]{2})$/.exec(s[0]);return m?m[1]:'';}
var STATES=[];
var stSel;
function fillSpots(st,pick){sel.innerHTML='<option value="">'+(st?'Pick a beach in '+(STN[st]||st):'Then a beach')+'</option>';
  SPOTS.forEach(function(s,i){if(spotSt(s)!==st)return;var o=document.createElement('option');o.value=i;o.textContent=s[0].replace(/,\s*[A-Z]{2}$/,'');sel.appendChild(o);});
  sel.disabled=!st;sel.value=pick!==undefined&&pick!==null?pick:'';}
function syncPicker(lat,lon,state){if(!stSel)return;var st=STATES.indexOf(state)>-1?state:'';
  var bi=null,bd=1e9;SPOTS.forEach(function(s,i){var d=km(lat,lon,s[1],s[2]);if(d<bd){bd=d;bi=i;}});
  if(bi!==null&&bd<25&&(!st||spotSt(SPOTS[bi])===st))st=spotSt(SPOTS[bi]);else bi=null;
  if(!st)return;stSel.value=st;fillSpots(st,bi===null?'':String(bi));if(bi!==null)memBeach(SPOTS[bi][0]);}
var ROOT=(function(){var a=document.querySelectorAll('[id="slmc"]');return a[a.length-1];})();
var out,sel;
var DIRS=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
function km(a,b,c,d){var r=Math.PI/180,x=Math.sin((c-a)*r/2),y=Math.sin((d-b)*r/2);var h=x*x+Math.cos(a*r)*Math.cos(c*r)*y*y;return 12742*Math.asin(Math.sqrt(h));}
function nearest(lat,lon){var best=null,bd=1e9;for(var i=0;i<ST.length;i++){var d=km(lat,lon,ST[i][2],ST[i][3]);if(d<bd){bd=d;best=ST[i];}}return [best,bd];}
function ymd(d){return d.getFullYear()+('0'+(d.getMonth()+1)).slice(-2)+('0'+d.getDate()).slice(-2);}
function fmtT(s){var p=s.split(/[- :]/),h=+p[3],m=p[4],ap=h>=12?'PM':'AM',h12=h%12||12;var d=new Date(+p[0],p[1]-1,+p[2]),t=new Date();var day=(d.toDateString()===t.toDateString())?'Today':(d.getDate()===new Date(t.getTime()+864e5).getDate()?'Tomorrow':d.toLocaleDateString(undefined,{weekday:'short'}));return {t:h12+':'+m+' '+ap,day:day,date:new Date(+p[0],p[1]-1,+p[2],h,+m)};}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}
function getJSON(u,o){return fetch(u,o).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();});}
function wind(lat,lon){
return getJSON('https://api.weather.gov/points/'+lat.toFixed(4)+','+lon.toFixed(4),{headers:{Accept:'application/geo+json'}}).then(function(p){
var rl=p.properties.relativeLocation&&p.properties.relativeLocation.properties;
return getJSON(p.properties.forecastHourly,{headers:{Accept:'application/geo+json'}}).then(function(f){
var now=Date.now(),per=f.properties.periods.find(function(x){return new Date(x.endTime).getTime()>now;})||f.properties.periods[0];
var nxt=f.properties.periods[f.properties.periods.indexOf(per)+3];
var pop=per.probabilityOfPrecipitation&&per.probabilityOfPrecipitation.value;return {temp:per.temperature,unit:per.temperatureUnit||'F',sky:per.shortForecast||'',day:per.isDaytime!==false,pop:(pop===null||pop===undefined)?null:pop,dir:per.windDirection,spd:per.windSpeed,next:nxt?{dir:nxt.windDirection,spd:nxt.windSpeed,t:new Date(nxt.startTime)}:null,town:rl?rl.city+', '+rl.state:'',state:rl?rl.state:'',grid:p.properties.forecastGridData,cwa:p.properties.cwa||p.properties.gridId,zone:(p.properties.forecastZone||'').split('/').pop(),P:f.properties.periods};
});
});
}
function durMs(d){var m=/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/.exec(d)||[];return ((+m[1]||0)*24*36e5)+((+m[2]||0)*36e5)+((+m[3]||0)*6e4);}
function waveAt(vals,t){for(var i=0;i<vals.length;i++){var p=vals[i].validTime.split('/'),s0=new Date(p[0]).getTime(),e=s0+durMs(p[1]);if(t>=s0&&t<e)return vals[i].value;}return null;}
function waveFrom(grid){return getJSON(grid,{headers:{Accept:'application/geo+json'}}).then(function(g){var wh=g.properties.waveHeight;var k=(wh&&wh.uom&&/ft|foot/i.test(wh.uom))?1:3.28084;var vals=wh&&wh.values?wh.values.filter(function(v){return v.value!==null;}):[];if(!vals.length||vals.every(function(v){return v.value<=0;}))return null;var now=Date.now(),a=waveAt(vals,now),b=waveAt(vals,now+3*36e5);if(a===null||a<=0)return null;if(b!==null&&b<=0)b=null;return {now:a*k,in3:b===null?null:b*k,vals:vals,k:k};});}
function gridFor(lat,lon){return getJSON('https://api.weather.gov/points/'+lat.toFixed(4)+','+lon.toFixed(4),{headers:{Accept:'application/geo+json'}}).then(function(p){return p.properties.forecastGridData;});}
function waves(lat,lon,grid){
return waveFrom(grid).then(function(r){if(r)return r;
var OFF=[[0,0.05],[-0.05,0],[0,-0.05],[0,0.12],[-0.12,0],[0,-0.12]];
return Promise.all(OFF.map(function(o){return gridFor(lat+o[0],lon+o[1]).then(waveFrom).catch(function(){return null;});})).then(function(rs){
for(var i=0;i<rs.length;i++){if(rs[i]){rs[i].off=true;return rs[i];}}return null;});
}).catch(function(){return null;});
}
function ftTxt(f){if(f<0.5)return '<1';return f<10?(Math.round(f*2)/2).toFixed(1).replace('.0',''):Math.round(f)+'';}
function tides(st){
var b=new Date();b.setHours(0,0,0,0);
var u='https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=SharkLeash&datum=MLLW&interval=hilo&units=english&time_zone=lst_ldt&format=json&range=192&station='+st[0]+'&begin_date='+ymd(b);
return getJSON(u).then(function(j){
if(!j.predictions)throw new Error('no predictions');
var now=new Date(),full=j.predictions.map(function(p){var f=fmtT(p.t);f.type=p.type;f.v=(+p.v).toFixed(1);return f;}),up=full.filter(function(p){return p.date>now;});
return {hi:up.find(function(p){return p.type==='H'}),lo:up.find(function(p){return p.type==='L'}),first:up[0],all:up,full:full};
});
}
var WT=null;
function wtStations(){
if(WT)return Promise.resolve(WT);
try{var c=sessionStorage.getItem('slmc_wt');if(c){WT=JSON.parse(c);return Promise.resolve(WT);}}catch(e){}
return getJSON('https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=watertemp').then(function(j){
WT=(j.stations||j.stationList||[]).map(function(s){return [s.id,s.name,+s.lat,+s.lng];}).filter(function(s){return !isNaN(s[2])&&!isNaN(s[3]);});
try{sessionStorage.setItem('slmc_wt',JSON.stringify(WT));}catch(e){}
return WT;
});
}
function waterTemp(lat,lon){
return wtStations().then(function(list){
var c=list.map(function(s){return [s,km(lat,lon,s[2],s[3])];}).filter(function(x){return x[1]<150;}).sort(function(a,b){return a[1]-b[1];}).slice(0,6);
return Promise.all(c.map(function(x){
var s=x[0];
return getJSON('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_temperature&application=SharkLeash&units=english&time_zone=lst_ldt&format=json&range=24&station='+s[0]).then(function(j){
var d=(j.data||[]).filter(function(r){return r.v!==''&&!isNaN(parseFloat(r.v))&&parseFloat(r.v)>32&&parseFloat(r.v)<90;});
if(!d.length)return null;
var last=d[d.length-1],ft=fmtT(last.t),age=(Date.now()-ft.date.getTime())/36e5;
return {f:parseFloat(last.v),name:s[1],mi:Math.round(x[1]*0.621),at:(age>3?(ft.day==='Today'?'':ft.day+' ')+ft.t:ft.t),old:age>3};
}).catch(function(){return null;});
})).then(function(rs){for(var k=0;k<rs.length;k++){if(rs[k])return rs[k];}return null;});
}).catch(function(){return null;});
}
function jsonp(u){return new Promise(function(res,rej){var cb='slmcJ'+Date.now()+Math.floor(Math.random()*1e4),sc=document.createElement('script'),done=false;
function end(){try{delete window[cb];}catch(e){window[cb]=undefined;}if(sc.parentNode)sc.parentNode.removeChild(sc);}
window[cb]=function(d){done=true;end();res(d);};
sc.onerror=function(){if(!done){done=true;end();rej(new Error('jsonp'));}};
setTimeout(function(){if(!done){done=true;end();rej(new Error('timeout'));}},12000);
sc.src=u+'&.jsonp='+cb;document.head.appendChild(sc);});}
function buoyTemp(lat,lon){
var q=['station,latitude,longitude,time,WTMP','time>=now-1days','latitude>='+(lat-1.3).toFixed(2),'latitude<='+(lat+1.3).toFixed(2),'longitude>='+(lon-1.3).toFixed(2),'longitude<='+(lon+1.3).toFixed(2),'WTMP!=NaN','orderByMax("station,time")'].map(encodeURIComponent).join('&');
return jsonp('https://coastwatch.pfeg.noaa.gov/erddap/tabledap/cwwcNDBCMet.json?'+q).then(function(j){
var cn=j.table.columnNames,ix=function(n){return cn.indexOf(n);},best=null,bd=1e9;
j.table.rows.forEach(function(r){var v=r[ix('WTMP')];if(v===null||isNaN(v))return;var vf=v*9/5+32;if(vf<=32||vf>=90)return;var d=km(lat,lon,r[ix('latitude')],r[ix('longitude')]);if(d<bd&&d<150){bd=d;best=r;}});
if(!best)return null;
var t=new Date(best[ix('time')]),age=(Date.now()-t.getTime())/36e5,today=t.toDateString()===new Date().toDateString();
var tt=t.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
return {f:best[ix('WTMP')]*9/5+32,name:'Buoy '+best[ix('station')],mi:Math.round(bd*0.621),at:(today?'':t.toLocaleDateString([], {weekday:'short'})+' ')+tt,old:age>3};
}).catch(function(){return null;});
}
function satTemp(lat,lon){var d=.12,q='analysed_sst[(last)][('+(lat-d).toFixed(2)+'):1:('+(lat+d).toFixed(2)+')][('+(lon-d).toFixed(2)+'):1:('+(lon+d).toFixed(2)+')]';
return jsonp('https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41F.json?'+encodeURIComponent(q)).then(function(j){var c=j.table.columnNames,I=function(n){return c.indexOf(n);},b=null,bd=1e9;
j.table.rows.forEach(function(r){var v=r[I('analysed_sst')];if(v===null||isNaN(v)||v<40||v>95)return;var k=km(lat,lon,r[I('latitude')],r[I('longitude')]);if(k<bd){bd=k;b=r;}});
return b?{f:b[I('analysed_sst')],name:'Nearshore satellite',mi:Math.max(1,Math.round(bd*.621)),at:new Date(b[I('time')]).toLocaleDateString([],{month:'short',day:'numeric'}),sat:1}:null;}).catch(function(){return null;});}
function wxIcon(t,day){
t=(t||'').toLowerCase();
if(/thunder|t-storm|tstorm/.test(t))return '⛈️';
if(/snow|flurr|sleet|freezing|ice|wintry/.test(t))return '🌨️';
if(/rain|shower|drizzle/.test(t))return /chance|slight|partly|isolated|scattered/.test(t)&&day?'🌦️':'🌧️';
if(/fog|haze|smoke|mist/.test(t))return '🌫️';
if(/mostly cloudy|overcast|^cloudy/.test(t))return '☁️';
if(/partly/.test(t))return day?'⛅':'☁️';
if(/mostly sunny|mostly clear/.test(t))return day?'🌤️':'🌙';
if(/sunny|clear|fair/.test(t))return day?'☀️':'🌙';
if(/wind|breez|blustery/.test(t))return '🌬️';
return day?'🌤️':'🌙';
}
function ugcHas(txt,zone){ var m=/^([A-Z]{2})Z(\d{3})$/.exec(zone);if(!m)return false;var st=m[1],n=+m[2],cur=null,ok=false;
txt.replace(/\s/g,'').split('-').forEach(function(t){var a=/^([A-Z]{2})Z(\d{3})(?:>(\d{3}))?$/.exec(t),b=/^(\d{3})(?:>(\d{3}))?$/.exec(t);
if(a){cur=a[1];if(cur===st&&n>=+a[2]&&n<=+(a[3]||a[2]))ok=true;}else if(b&&cur===st&&n>=+b[1]&&n<=+(b[2]||b[1]))ok=true;});return ok;}
var ALERTS=[];
/* many beach points sit just offshore in a marine zone, which misses land alerts (floods, rip currents); shark-data.json gives each beach its land zone + county (nws) */
function nwsZones(lat,lon){var b=null,bd=15;(FC_BEACH||[]).forEach(function(x){if(!x.nws)return;var d=km(lat,lon,x.lat,x.lon);if(d<bd){bd=d;b=x;}});return b?b.nws:null;}
function rip(lat,lon,w){
var H={headers:{Accept:'application/geo+json'}},nz=nwsZones(lat,lon),zone=nz?nz[0]:(w&&w.zone);ALERTS=[];
var q=function(u){return getJSON('https://api.weather.gov/alerts/active?'+u,H).catch(function(){return {features:[]};});};
return Promise.all([q('point='+lat.toFixed(4)+','+lon.toFixed(4)),nz?q('zone='+nz.join(',')):{features:[]}]).then(function(rs){
var a={features:(rs[0].features||[]).concat(rs[1].features||[])};
var seen={};(a.features||[]).forEach(function(x){var p=x.properties||{};if(!p.event||seen[p.event])return;seen[p.event]=1;ALERTS.push({ev:p.event,sev:/extreme|severe/i.test(p.severity||'')});});
var f=(a.features||[]).map(function(x){return x.properties.event;}).filter(function(e){return /rip current|beach hazard|high surf/i.test(e);});
if(f.some(function(e){return /rip current/i.test(e);}))return {risk:'High',src:'NWS '+f[0]+' in effect'};
return null;}).catch(function(){return null;}).then(function(al){
if(al)return al;if(!w||!w.cwa)return null;
return getJSON('https://api.weather.gov/products/types/SRF/locations/'+w.cwa+'/latest',H).then(function(p){
var txt=p.productText||'',segs=txt.split('$$'),seg=null;
for(var i=0;i<segs.length;i++){var head=(segs[i].match(/^[A-Z]{2}Z[\d>\-\s]+?-\d{6}-/m)||[''])[0];if(head&&ugcHas(head,zone)){seg=segs[i];break;}}
if(!seg)return {risk:null,src:'NWS '+w.cwa+' surf forecast doesn\u2019t cover this exact spot',old:(Date.now()-new Date(p.issuanceTime))/864e5>2};
var m=/rip current risk[^\n.]*?\.{2,}\s*([a-z]+)/i.exec(seg);
var age=(Date.now()-new Date(p.issuanceTime))/864e5;
if(!m)return null;return {risk:m[1].charAt(0).toUpperCase()+m[1].slice(1).toLowerCase(),src:'NWS surf zone forecast',old:age>2};
}).catch(function(){return null;});});
}
/* ===== Tide curve: the day's rise and fall from NOAA's high/low predictions, tonight's 4-10 PM drop window shaded, a dot for now ===== */
function tideTile(t){
  if(!document.getElementById('slmc-tide-css')){var c=document.createElement('style');c.id='slmc-tide-css';
    c.textContent='#slmc .tile.tide{grid-column:span 2}@media(max-width:640px){#slmc .tile.tide{grid-column:auto}}'
      +'#slmc .tide svg{display:block;width:100%;height:auto;margin:6px 0 2px}#slmc .tide .tdn{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13.5px;font-weight:700;color:rgba(255,255,255,.85)}#slmc .tide .tdn b{color:#fff}';
    document.head.appendChild(c);}
  var hi=t&&t.hi,lo=t&&t.lo,E=t&&(t.full||t.all)||[];
  var lab='<div class="lab">Tides <span style="opacity:.6">· predicted</span></div>';
  if(!E.length)return '<div class="tile tide">'+lab+'<div class="big">--</div><div class="small err">Tide unavailable</div></div>';
  var now=Date.now(),t0=now-3*36e5,t1=now+21*36e5;
  var P=E.map(function(e){return {x:e.date.getTime(),v:+e.v,type:e.type,t:e.t};}).sort(function(a,b){return a.x-b.x;});
  /* before the first known turn: assume the opposite turn about 6.2 h earlier */
  while(P[0].x>t0-36e5){var a=P[0],b=P[1]||P[0];P.unshift({x:a.x-6.21*36e5,v:a===b?a.v:b.v,type:a.type==='H'?'L':'H',est:1});}
  var lv=function(x){for(var i=0;i<P.length-1;i++){var a=P[i],b=P[i+1];if(x>=a.x&&x<=b.x){var k=(x-a.x)/(b.x-a.x);return a.v+(b.v-a.v)*(1-Math.cos(Math.PI*k))/2;}}return P[P.length-1].v;};
  var W=320,H=96,top=26,bot=80,vs=[];/* top leaves a lane above the curve for the 4-10 PM label, so it never sits on a high-tide label */for(var x=t0;x<=t1;x+=12*6e4)vs.push(lv(x));
  var mn=Math.min.apply(null,vs),mx=Math.max.apply(null,vs),pad=(mx-mn)*.12||.3;mn-=pad;mx+=pad;
  var X=function(x){return (x-t0)/(t1-t0)*W;},Y=function(v){return bot-(v-mn)/(mx-mn)*(bot-top);};
  var pts=[];for(var x2=t0;x2<=t1;x2+=12*6e4)pts.push(X(x2).toFixed(1)+','+Y(lv(x2)).toFixed(1));
  var g='';
  /* drop windows (4-10 PM local) that fall inside the chart */
  for(var d=-1;d<=1;d++){var day=new Date(now+d*864e5);var w0=new Date(day.getFullYear(),day.getMonth(),day.getDate(),16).getTime(),w1=w0+6*36e5;
    var a0=Math.max(w0,t0),a1=Math.min(w1,t1);if(a1>a0)g+='<rect x="'+X(a0).toFixed(1)+'" y="'+top+'" width="'+(X(a1)-X(a0)).toFixed(1)+'" height="'+(bot-top)+'" fill="rgba(126,231,135,.16)"/>'+(a1-a0>2*36e5?'<text x="'+((X(a0)+X(a1))/2).toFixed(1)+'" y="10" fill="#7ee787" font-size="9" font-weight="800" text-anchor="middle">4–10 PM</text>':'');}
  g+='<polygon points="0,'+bot+' '+pts.join(' ')+' '+W+','+bot+'" fill="rgba(110,231,255,.18)"/><polyline points="'+pts.join(' ')+'" fill="none" stroke="#6ee7ff" stroke-width="2"/>';
  /* turn labels */
  P.forEach(function(p){if(p.est||p.x<t0+20*6e4||p.x>t1-20*6e4)return;var px=X(p.x),py=Y(p.v),up=p.type==='H';
    g+='<circle cx="'+px.toFixed(1)+'" cy="'+py.toFixed(1)+'" r="2.6" fill="#fff"/><text x="'+px.toFixed(1)+'" y="'+(up?py-5:py+11).toFixed(1)+'" fill="#fff" font-size="9" font-weight="800" text-anchor="middle">'+(up?'H ':'L ')+p.t.replace(':00','').replace(' AM','a').replace(' PM','p')+'</text>';});
  /* now */
  var nx=X(now),ny=Y(lv(now)),rising=lv(now+15*6e4)>lv(now);
  g+='<line x1="'+nx.toFixed(1)+'" y1="'+top+'" x2="'+nx.toFixed(1)+'" y2="'+bot+'" stroke="rgba(255,255,255,.35)" stroke-dasharray="2 3"/><circle cx="'+nx.toFixed(1)+'" cy="'+ny.toFixed(1)+'" r="4" fill="#ff4444" stroke="#fff" stroke-width="1.5"/><text x="'+nx.toFixed(1)+'" y="'+(H-2)+'" fill="rgba(255,255,255,.7)" font-size="9" font-weight="800" text-anchor="middle">now · '+(rising?'rising':'falling')+'</text>';
  var nxt='';if(hi)nxt+='<span>⬆️ High <b>'+hi.t+'</b> '+(hi.day==='Today'?'':hi.day+' ')+'· '+hi.v+' ft</span>';if(lo)nxt+='<span>⬇️ Low <b>'+lo.t+'</b> '+(lo.day==='Today'?'':lo.day+' ')+'· '+lo.v+' ft</span>';
  return '<div class="tile tide">'+lab+'<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Tide curve for the next day">'+g+'</svg><div class="tdn">'+nxt+'</div></div>';}
function sunTimes(d,lat,lon){var R=Math.PI/180,J=Date.UTC(d.getFullYear(),d.getMonth(),d.getDate(),12)/864e5+2440587.5,n=Math.round(J-2451545+0.0008-lon/360),
Js=2451545+0.0009-lon/360+n,M=(357.5291+0.98560028*(Js-2451545))%360,C=1.9148*Math.sin(M*R)+0.02*Math.sin(2*M*R)+0.0003*Math.sin(3*M*R),L=(M+C+180+102.9372)%360,
Jt=Js+0.0053*Math.sin(M*R)-0.0069*Math.sin(2*L*R),dec=Math.asin(Math.sin(L*R)*Math.sin(23.44*R)),
w=Math.acos((Math.sin(-0.833*R)-Math.sin(lat*R)*Math.sin(dec))/(Math.cos(lat*R)*Math.cos(dec)))/R/360,toD=function(j){return new Date((j-2440587.5)*864e5);};
return {rise:toD(Jt-w),set:toD(Jt+w)};}
function bestWindow(tl,lat,lon){
if(!tl||!tl.all||!tl.all.length)return null;var now=Date.now(),end=now+30*36e5,sun=[];
for(var k=-1;k<=2;k++){var d=new Date(now+k*864e5);sun.push(sunTimes(d,lat,lon));}
function dark(t){for(var i=0;i<sun.length-1;i++){if(t>sun[i].set.getTime()&&t<sun[i+1].rise.getTime())return true;}return false;}
function nearDusk(t){return sun.some(function(s){return Math.abs(t-s.set.getTime())<75*6e4||Math.abs(t-s.rise.getTime())<75*6e4;});}
var best=null;
tl.all.forEach(function(p){var turn=p.date.getTime();if(turn>end)return;var a=Math.max(turn-2*36e5,now),b=turn+1*36e5;if(b<=now)return;
var sc=0;for(var t=a;t<b;t+=15*6e4){sc+=dark(t)?2:0;sc+=nearDusk(t)?1.5:0;}sc+=1;
if(!best||sc>best.sc)best={sc:sc,a:a,b:b,p:p,dark:dark((a+b)/2)||dark(turn),dusk:nearDusk(a)||nearDusk(turn)||nearDusk(b)};});
return best;}
function hmr(a,b){var x=hm(a),y=hm(b),pa=x.slice(-2),pb=y.slice(-2);return (pa===pb&&/[AP]M$/.test(pa)?x.slice(0,-3):x)+'–'+y;}
function hm(t){return new Date(t).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}).replace(':00','').replace(' ','\u00a0');}
function moon(d){
var SYN=29.530588853,ref=Date.UTC(2000,0,6,18,14),age=((d.getTime()-ref)/864e5)%SYN;if(age<0)age+=SYN;
var ill=Math.round((1-Math.cos(2*Math.PI*age/SYN))/2*100);
var names=['New moon','Waxing crescent','First quarter','Waxing gibbous','Full moon','Waning gibbous','Last quarter','Waning crescent'],icons=['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];
var k=Math.floor((age/SYN)*8+0.5)%8;
var toFull=(SYN/2-age+SYN)%SYN,toNew=SYN-age;
var fmt=function(n){var x=new Date(d.getTime()+n*864e5);return x.toLocaleDateString([], {month:'short',day:'numeric'});};
var next=toFull<toNew?'Full moon ~'+fmt(toFull):'New moon ~'+fmt(toNew);
if(k===4)next='New moon ~'+fmt(toNew);if(k===0)next='Full moon ~'+fmt(toFull);
return {name:names[k],icon:icons[k],ill:ill,next:next,age:age,syn:SYN};
}
function arrowSVG(dir){var i=DIRS.indexOf(dir);var deg=i<0?0:i*22.5+180;return '<svg class="arrow" viewBox="0 0 24 24" style="transform:rotate('+deg+'deg)" aria-hidden="true"><path d="M12 2l6 14-6-3-6 3z" fill="#e4572e"/></svg>';}

/* ===== 7-evening outlook: same scoring as Best Beaches (wind, surf, water temp, sharks running, deep water, front) ===== */
var FC_SPM={},FC_BEACH=[],FC_BBP=null,FC_DIRS=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
var FC_SPX={sk:[70,88],bn:[70,88],sb:[58,82],st:[55,76],du:[62,80],bt:[68,86],sp:[68,86],sn:[66,88],bo:[68,90],ft:[70,88],bu:[70,92],le:[70,90],ti:[72,90],nu:[72,90],sh:[72,88],gh:[72,88],sm:[50,72],sd:[40,64]};
var FC_ROWS=null,FC_REG={};function fcLv(code,st,mo,lat){var rows=FC_ROWS||FC_SPM[st]||[];for(var i=0;i<rows.length;i++)if(rows[i][0]===code){var P=rows[i][1];if(code==='bu'&&st==='FL'&&lat<27.6)P='222333333222';return +P.charAt(mo);}return 0;}
function fcScore(st,lat,w,wv,wt,dp,mo){var b={};
  var v=w?w.avg:null;b.wind=v===null?10:v<5?10+3*v:v<=12?25:v>=29?0:Math.round(25*(29-v)/17);
  b.waves=wv==null?8:wv<1?9:wv<=3?15:wv<=5?Math.round(15-5*(wv-3)):wv<=6?3:0;
  b.temp=wt==null?8:(wt>=66&&wt<=82)?20:Math.max(0,Math.round(20-2*(wt<66?66-wt:wt-82)));
  var sum=0;(FC_ROWS||FC_SPM[st]||[]).forEach(function(r){var l=fcLv(r[0],st,mo,lat),t=FC_SPX[r[0]];if(!l||!t)return;if(wt!=null&&(wt<t[0]||wt>t[1]))return;sum+=l===3?3:l===2?2:0.5;});
  b.sharks=Math.round(25*Math.min(1,sum/10));
  var d=dp?dp.d10:'';b.deep=dp&&dp.c==='i'?12:!d?7:d.charAt(0)==='+'||+d>800?2:+d<=150?15:Math.round(15-10*Math.min(1,(+d-150)/450));
  b.front=w&&w.front?5:0;return {tot:b.wind+b.waves+b.temp+b.sharks+b.deep+b.front,b:b};}
function fcNearBeach(lat,lon){var b=null,bd=1e9;FC_BEACH.forEach(function(x){var d=km(lat,lon,x.lat,x.lon);if(d<bd){bd=d;b=x;}});return bd<=15?b:null;}
function fcDeep(b){if(!b||!b.depth)return null;var d=b.depth,C={high:'h',medium:'m',low:'l',inlet:'i'};return {d10:d.to10ftYd==null?'':String(d.to10ftYd).replace(/^>\s*/,'+'),c:C[d.confidence]||'m'};}
function fcBB(){if(!FC_BBP)FC_BBP=fetch('https://raw.githubusercontent.com/SharkLeashDevelopment/sharkleash-best-beaches/main/data/best-beaches.json?t='+Math.floor(Date.now()/3e5)).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});return FC_BBP;}
function fcMax(p){var m=String(p.windSpeed).match(/\d+/g)||[0];return Math.max.apply(null,m.map(Number));}
function fcDays(P){var now=Date.now(),out=[],seen={};
  for(var i=0;i<P.length&&out.length<7;i++){var t=new Date(P[i].startTime);if(t.getTime()<now-36e5||+String(P[i].startTime).slice(11,13)<16)continue;var key=t.toDateString();if(seen[key])continue;seen[key]=1;
    var W=P.slice(i,i+6);if(W.length<3)break;var sp=W.map(fcMax),avg=sp.reduce(function(a,b){return a+b;},0)/sp.length;
    var A=P.slice(i,i+36),t0=A[0].temperature,n=0;A.forEach(function(p){var d=FC_DIRS.indexOf(p.windDirection);if((d>=13||d<=2)&&t0-p.temperature>=8)n++;});
    var before=P.slice(i,i+4).every(function(p){var d=FC_DIRS.indexOf(p.windDirection);return d>=5&&d<=11;});
    out.push({start:t,avg:Math.round(avg),dir:W[0].windDirection,front:n>=2&&before});}
  return out;}
function fcWhy(b,v,wv,wt){if(!b)return '';var r=[['wind',b.wind/25],['waves',wv==null?1:b.waves/15],['temp',wt==null?1:b.temp/20],['sharks',b.sharks/25],['deep',b.deep/15]].sort(function(x,y){return x[1]-y[1];})[0];if(r[1]>=0.6)return '';
  return r[0]==='wind'?(v!=null&&v<5?'🍃 very light wind':'💨 windy'):r[0]==='waves'?(wv!=null&&wv<1?'🏖️ flat surf':'🌊 rough surf'):r[0]==='temp'?(wt!=null&&wt>82?'🔥 hot water':'🥶 cold water'):r[0]==='sharks'?'🦈 few sharks':'📏 deep water far';}
function fcCol(v){return v>=80?'#7ee787':v>=60?'#ffb020':'#ff6a6a';}
/* ===== Past years (TEST): this night in past seasons + best weeks, from the backfill files in the public repo (data/past/<beach>.json) ===== */
var PAST_BASE='https://raw.githubusercontent.com/SharkLeashDevelopment/sharkleash-best-beaches/main/data/past/',PAST_C={};
var PAST_MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function pastSlug(n){return String(n).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
function pastGet(fid){if(!PAST_C[fid])PAST_C[fid]=fetch(PAST_BASE+fid+'.json?t='+Math.floor(Date.now()/36e5)).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});return PAST_C[fid];}
/* week of the year, 0-51 (Dec 31 and Feb 29 fold into their neighbors) */
function pastWk(md){var m=+md.slice(0,2),d=+md.slice(3,5),doy=Math.round((Date.UTC(2025,m-1,Math.min(d,m===2?28:31))-Date.UTC(2025,0,1))/864e5);return Math.min(51,Math.floor(doy/7));}
function pastWkLabel(w){var a=new Date(Date.UTC(2025,0,1+w*7)),b=new Date(Date.UTC(2025,0,1+w*7+6));if(w===51)b=new Date(Date.UTC(2025,11,31));
  return PAST_MON[a.getUTCMonth()]+' '+a.getUTCDate()+'–'+(b.getUTCMonth()!==a.getUTCMonth()?PAST_MON[b.getUTCMonth()]+' ':'')+b.getUTCDate();}
/* pure math, no page access: what the panel shows */
function pastCalc(p,now){if(!p||!p.days)return null;var D=p.days,md=('0'+(now.getMonth()+1)).slice(-2)+'-'+('0'+now.getDate()).slice(-2);
  var y0=+p.from.slice(0,4),y1=+p.to.slice(0,4),nights=[];
  var tk=now.getFullYear()+'-'+md;for(var y=y1;y>=y0;y--){var r=D[y+'-'+md];if(r&&y+'-'+md!==tk)nights.push({y:y,sc:r[0],mph:r[1],dir:r[2],wv:r[3],wt:r[4],hi:r[5]});}
  var S=[],N=[];for(var i=0;i<52;i++){S.push(0);N.push(0);}
  var W={},tideFrom=null;for(var k in D){if(D[k][5]&&(!tideFrom||k<tideFrom))tideFrom=k;var w=pastWk(k.slice(5)),v=D[k][0];(W[w]=W[w]||[]).push(k);if(v==null)continue;S[w]+=v;N[w]++;}
  var avg=S.map(function(s,i){return N[i]?Math.round(s/N[i]):null;}),cur=pastWk(md);
  var order=avg.map(function(v,i){return [i,v];}).filter(function(x){return x[1]!=null;}).sort(function(a,b){return b[1]-a[1];});
  var rank=0;order.forEach(function(x,i){if(x[0]===cur)rank=i+1;});
  return {md:md,nights:nights,avg:avg,cur:cur,curAvg:avg[cur],rank:rank,of:order.length,best:order.slice(0,3),W:W,tideFrom:tideFrom,years:Math.round((Date.parse(p.to)-Date.parse(p.from))/(365.25*864e5))};}
(function(){if(document.getElementById('slmc-past-css'))return;var s=document.createElement('style');s.id='slmc-past-css';
  s.textContent='#slmc .ph .phr{display:flex;flex-direction:column;gap:6px;margin:0 0 10px}'
  +'#slmc .ph .phy{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:12px;flex-wrap:wrap;row-gap:2px;padding:8px 12px;font-size:13px;font-weight:700;color:rgba(255,255,255,.82)}'
  +'#slmc .ph .phy b{font-size:13px;color:rgba(255,255,255,.6);min-width:38px}'
  +'#slmc .ph .phy .phs{font-size:22px;font-weight:900;min-width:44px;text-align:right}'
  +'#slmc .ph .phy span{white-space:nowrap}'
  +'#slmc .ph .phb{display:flex;align-items:flex-end;gap:2px;height:56px;margin:6px 0 2px}'
  +'#slmc .ph .phb i{flex:1;border-radius:2px 2px 0 0;opacity:.55;min-height:2px}'
  +'#slmc .ph .phb i.now{opacity:1;outline:2px solid #6ee7ff;outline-offset:1px}'
  +'#slmc .ph .phm{display:flex;justify-content:space-between;font-size:10.5px;color:rgba(255,255,255,.45);font-weight:800;margin:0 0 10px}'
  +'#slmc .ph .phw{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 6px}'
  +'#slmc .ph .phw span{background:rgba(126,231,135,.1);border:1px solid rgba(126,231,135,.4);border-radius:999px;padding:5px 11px;font-size:12.5px;font-weight:800;color:#fff}'
  +'#slmc .ph .phw span b{color:#7ee787;margin-left:4px}'
  +'#slmc .ph details{background:rgba(110,231,255,.06);border:1px solid rgba(110,231,255,.45);border-radius:16px;padding:0 14px;box-shadow:0 0 0 1px rgba(110,231,255,.08),0 10px 30px rgba(0,0,0,.25)}'
  +'#slmc .ph summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:13px 0;min-height:48px}'
  +'#slmc .ph summary::-webkit-details-marker{display:none}'
  +'#slmc .ph .pht{font-size:13.5px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#ff4444}'
  +'#slmc .ph .phs2{font-size:12.5px;font-weight:700;color:rgba(255,255,255,.7);flex:1}'
  +'#slmc .ph .phx{margin-left:auto;display:inline-flex;align-items:center;gap:6px;background:rgba(110,231,255,.16);border:1px solid rgba(110,231,255,.6);color:#6ee7ff;border-radius:999px;padding:7px 14px;font-size:13px;font-weight:900;white-space:nowrap}'
  +'#slmc .ph summary:hover .phx{background:rgba(110,231,255,.28)}'
  +'#slmc .ph .phx i{font-style:normal;display:inline-block;font-size:17px;line-height:1;transition:transform .2s}#slmc .ph details[open] .phx i{transform:rotate(180deg)}'
  +'#slmc .ph details:not([open]) .phl::before{content:"Show history"}#slmc .ph details[open] .phl::before{content:"Hide"}'
  +'#slmc .ph .phc{padding:0 0 12px}'
  +'#slmc .ph .phb{cursor:pointer}#slmc .ph .phb i.pick{opacity:1;box-shadow:0 0 0 2px #fff}'
  +'#slmc .ph .pwh{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13.5px;font-weight:800;margin:6px 0 0}'
  +'#slmc .ph .pwh button{min-height:38px;min-width:42px;padding:0;border-radius:10px;font-size:20px;line-height:1;cursor:pointer}'
  +'#slmc .ph .pwr{display:flex;align-items:center;gap:4px;margin:0 0 4px}'
  +'#slmc .ph .pwr b{font-size:12px;color:rgba(255,255,255,.55);min-width:38px;flex:none}'
  +'#slmc .ph .pwr button{flex:1 1 0;min-width:0;min-height:42px;padding:3px 0;border-radius:8px;font-size:15px;font-weight:900;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1;cursor:pointer}'
  +'#slmc .ph .pwr button small{font-size:9.5px;color:rgba(255,255,255,.5);font-weight:700;white-space:nowrap}'
  +'#slmc .ph .pwr button.on{border-color:#6ee7ff;background:rgba(110,231,255,.14)}'
  +'#slmc .ph .pwn{font-size:12.5px;color:rgba(255,255,255,.82);font-weight:600;margin:6px 0 10px;min-height:1.2em}'
  +'#slmc .ph .phv{margin:16px 0 0;font-size:15px;font-weight:900;color:#fff}'
  +'#slmc .ph h4{margin:12px 0 6px;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#ff4444}';
  document.head.appendChild(s);})();
function pastPanel(key,id){
  if(!key||BAN_NOW||!out)return;
  var box=document.createElement('div');box.className='fc ph';box.innerHTML='<p class="msg"><i class="sp"></i>Loading past years…</p>';
  var rig=out.querySelector('.rig');if(rig)out.insertBefore(box,rig);else out.appendChild(box);
  pastGet(id||pastSlug(key)).then(function(p){if(!box.isConnected)return;var c=pastCalc(p,new Date());if(!c||!c.of){box.remove();return;}
    var nm=esc(key.replace(/,\s*[A-Z]{2}$/,'')),today=PAST_MON[+c.md.slice(0,2)-1]+' '+(+c.md.slice(3,5));
    var po=clStore('slmc_past_open')==='1',teaser=c.curAvg!=null?'This week usually <b style="color:'+fcCol(c.curAvg)+'">'+c.curAvg+'</b> · best '+pastWkLabel(c.best[0][0]):'';
    var h='<details class="phd"'+(po?' open':'')+'><summary><span class="pht">📅 Past years at '+nm+'</span><span class="phs2">'+teaser+'</span><span class="phx"><span class="phl"></span><i aria-hidden="true"><svg viewBox="0 0 12 12" width="15" height="15" style="display:block"><path d="M2.5 4.5l3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></i></span></summary><div class="phc">';
    if(c.nights.length){h+='<h4>'+today+' in past years</h4><div class="phr">'+c.nights.map(function(n){
        return '<div class="phy"><b>'+n.y+'</b><span class="phs" style="color:'+fcCol(n.sc)+'">'+n.sc+'</span>'
          +'<span>'+(n.mph==null?'wind n/a':(n.mph<2||!n.dir?'Calm':esc(n.dir)+' '+n.mph+' mph'))+'</span>'
          +'<span>'+(n.wv!=null?ftTxt(n.wv)+' ft':'surf n/a')+'</span>'
          +'<span>'+(n.wt!=null?n.wt+'°F':'')+'</span>'+(n.hi?'<span>⬆️ high tide</span>':'')+'</div>';}).join('')+'</div>';}
    h+='<p class="phv">Planning a vacation? 🏖️✈️</p><h4 style="margin-top:4px">Best weeks of the year</h4><div class="phw">'+c.best.map(function(x){return '<span>'+pastWkLabel(x[0])+'<b>'+x[1]+'</b></span>';}).join('')+'</div>';
    var lo=Math.min.apply(null,c.avg.filter(function(v){return v!=null;})),hi=Math.max.apply(null,c.avg.filter(function(v){return v!=null;})),hp=function(v){return hi>lo?Math.round(15+85*(v-lo)/(hi-lo)):60;};
    h+='<div class="phb">'+c.avg.map(function(v,i){return '<i'+(i===c.cur?' class="now"':'')+' title="'+pastWkLabel(i)+': '+(v==null?'no data':v)+'" style="height:'+(v==null?2:hp(v))+'%;background:'+(v==null?'rgba(255,255,255,.15)':fcCol(v))+'"></i>';}).join('')+'</div>';
    h+='<div class="phm"><span>Jan</span><span>Apr</span><span>Jul</span><span>Oct</span><span>Dec</span></div><div class="pwk"></div>';
    if(c.curAvg!=null)h+='<p class="fcx">This week ('+pastWkLabel(c.cur)+') averages <b style="color:'+fcCol(c.curAvg)+'">'+c.curAvg+'</b> here, #'+c.rank+' of '+c.of+' weeks.</p>';
    h+='<p class="fcn">Average Drop Score by week over '+c.years+' years ('+esc(p.from)+' to '+esc(p.to)+'), re-scored with today’s Drop Score math from archived wind, buoy and satellite readings. Past fronts and tides are counted; bait reports and water clarity didn’t exist yet. A guide to when this beach usually lines up, not a forecast.</p>';
    h+='</div></details>';box.innerHTML=h;var dt=box.querySelector('details');
    var bars=box.querySelector('.phb'),pw=box.querySelector('.pwk'),sel=-1;
    function dl(k){return PAST_MON[+k.slice(5,7)-1]+' '+(+k.slice(8,10));}
    function night(k){var r=p.days[k];return '<b>'+dl(k)+', '+k.slice(0,4)+'</b> · <span style="color:'+fcCol(r[0])+';font-weight:900">'+r[0]+'</span> · '+(r[1]==null?'wind n/a':(r[1]<2||!r[2]?'Calm':esc(r[2])+' '+r[1]+' mph'))+' · '+(r[3]!=null?ftTxt(r[3])+' ft surf':'surf n/a')+(r[4]!=null?' · '+r[4]+'°F water':'')+(r[5]?' · ⬆️ high tide in the window':'');}
    function showWk(w){if(w<0)w=51;if(w>51)w=0;sel=w;bars.querySelectorAll('i').forEach(function(b,i){b.classList.toggle('pick',i===w);});
      var ks=(c.W[w]||[]).slice().sort(),Y={},n=0,sw=0,nw=0,sv=0,nv=0,stt=0,nt=0,hi=0,th=0;
      ks.forEach(function(k){var r=p.days[k];(Y[k.slice(0,4)]=Y[k.slice(0,4)]||[]).push(k);n++;if(r[1]!=null){sw+=r[1];nw++;}if(r[3]!=null){sv+=r[3];nv++;}if(r[4]!=null){stt+=r[4];nt++;}if(c.tideFrom&&k>=c.tideFrom){th++;if(r[5])hi++;}});
      var q='<div class="pwh"><button type="button" data-d="-1" aria-label="Previous week">‹</button><span><b>'+pastWkLabel(w)+'</b>'+(c.avg[w]!=null?' · avg <b style="color:'+fcCol(c.avg[w])+'">'+c.avg[w]+'</b>':'')+'</span><button type="button" data-d="1" aria-label="Next week">›</button></div>';
      if(n)q+='<p class="fcx" style="margin:4px 0 8px">Typical: '+(nw?Math.round(sw/nw)+' mph wind':'')+(nv?' · '+ftTxt(sv/nv)+' ft surf':'')+(nt?' · '+Math.round(stt/nt)+'°F water':'')+(th>=10?' · high tide in the window '+Math.round(100*hi/th)+'% of nights':'')+'</p>';
      q+=Object.keys(Y).sort().reverse().map(function(y){return '<div class="pwr"><b>'+y+'</b>'+Y[y].map(function(k){var v=p.days[k][0];return '<button type="button" data-k="'+k+'" style="color:'+fcCol(v)+'"><small>'+dl(k)+'</small>'+v+'</button>';}).join('')+'</div>';}).join('')||'<p class="fcn">No nights on record for this week.</p>';
      pw.innerHTML=q+'<div class="pwn">Tap a score for that night’s conditions.</div>';}
    bars.addEventListener('click',function(e){var r=bars.getBoundingClientRect();showWk(Math.max(0,Math.min(51,Math.floor((e.clientX-r.left)/r.width*52))));if(window.gtag)gtag('event','past_week_tap',{beach:key});});
    pw.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;if(b.getAttribute('data-d'))showWk(sel+(+b.getAttribute('data-d')));else if(b.getAttribute('data-k')){pw.querySelectorAll('.pwr button').forEach(function(x){x.classList.toggle('on',x===b);});pw.querySelector('.pwn').innerHTML=night(b.getAttribute('data-k'));}});
    showWk(c.cur);
    dt.addEventListener('toggle',function(){clStore('slmc_past_open',dt.open?'1':'0');if(dt.open&&window.gtag)gtag('event','past_years_open',{beach:key});});
    if(window.gtag)gtag('event','past_years_view',{beach:key,open:po?1:0});});}
/* Local shark-fishing bans (localBan in shark-data.json). A beach picked from the list matches exactly; a GPS or map spot uses the nearest listed beach within 8 km. */
/* a local ban with banMonths (1-12, e.g. [5,6,7,8,9]) only applies in those months, Eastern time */
function banOn(b){if(!b||!b.localBan)return false;var m=b.banMonths;if(!m||!m.length)return true;var mo=+new Intl.DateTimeFormat('en-US',{month:'numeric',timeZone:'America/New_York'}).format(new Date());return m.indexOf(mo)>=0;}
var BAN_NOW=null,SEAS_NOW=null;function banNear(lat,lon,label){SEAS_NOW=null;var b=null;if(label)FC_BEACH.forEach(function(x){if(x.name+', '+x.state===label)b=x;});
  if(!b){var bd=1e9,nb=null;FC_BEACH.forEach(function(x){var d=km(lat,lon,x.lat,x.lon);if(d<bd){bd=d;nb=x;}});if(nb&&bd<=8)b=nb;else return null;}
  if(!b||!b.localBan)return null;var r={name:b.name,rule:b.localBan,exact:!!label};if(!banOn(b)){SEAS_NOW=r;return null;}return r;}
function bbRank(bb,bm){if(!bb||!bm)return null;if(bm.flag||bm.redtide)return {out:bm.flag?bm.flag.replace(/\s*\(.*\)\s*$/,''):'red tide reported '+bm.redtide.mi+' mi away'};var rv=function(x){return x.raw!=null?x.raw:x.score;};
  var ok=(bb.beaches||[]).filter(function(x){return !x.flag&&!x.redtide&&rv(x)!=null;}).sort(function(a,b){return rv(b)-rv(a);}),i=ok.indexOf(bm);return i<0?null:{n:i+1,of:ok.length};}
function bbMatch(lat,lon,label,bb){var near=null;if(label)FC_BEACH.forEach(function(x){if(x.name+', '+x.state===label)near=x;});if(!near)near=fcNearBeach(lat,lon);
  var m=null;if(bb&&near){var nm=near.name+', '+near.state;(bb.beaches||[]).forEach(function(x){if(x.name===nm)m=x;});}return {near:near,match:m};}
/* ===== Rules: when this state's rules were last checked, plus "Rule wrong or changed?" reports (type "rule" in the report Sheet) ===== */
var FC_STATES=[],RULE_V=[['outdated','Rule is out of date'],['new_rule','There’s a new rule'],['drone','Drone rule is wrong'],['other','Something else']];
function ruleDate(ab){var s=null;FC_STATES.forEach(function(x){if(x.ab===ab)s=x;});if(!s||!s.lastVerified)return null;var d=new Date(s.lastVerified+'T12:00:00');return {name:s.name,d:isNaN(d)?s.lastVerified:d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})};}
function ruleRow(ab){var r=ruleDate(ab);if(!r&&!REPORT_URL)return '';
  return '<div id="slmc-rule" style="margin:0 0 10px;padding:7px 12px;border-radius:10px;background:rgba(255,255,255,.05);font-size:13px">'
    +'<div>⚖️ '+(r?'<a href="#slm-panel" class="rll" style="color:#fff;font-weight:800;text-decoration:underline">'+esc(r.name)+' rules</a> checked <b>'+esc(r.d)+'</b>':'Local rules')+(REPORT_URL?' · <a href="#" class="rlo" style="color:#6ee7ff;font-weight:800">Wrong? Tell us</a>':'')+'</div>'
    +(REPORT_URL?'<div class="rlf" style="display:none;margin-top:8px"><div class="clb rlb" style="flex-wrap:wrap">'+RULE_V.map(function(v){return '<button type="button" data-v="'+v[0]+'">'+v[1]+'</button>';}).join('')+'</div>'
      +'<textarea class="rlt" maxlength="300" rows="2" placeholder="What changed? A link to the new rule helps (optional)" style="width:100%;box-sizing:border-box;margin-top:8px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.25);color:#fff;padding:8px;font:inherit"></textarea>'
      +'<button type="button" class="rls" disabled style="margin-top:6px;padding:8px 14px;border-radius:8px;border:0;background:#ff3b1f;color:#fff;font-weight:800">Send</button>'
      +'<div class="small rlm" style="margin-top:6px;color:#6ee7ff"></div><div class="small" style="margin-top:4px;opacity:.65">&#128274; Sent under the beach name only. Never your location or your name.</div></div>':'')+'</div>';}
function ruleWire(beachKey,ab){var el=out&&out.querySelector('#slmc-rule');if(!el)return;
  /* "<State> rules" opens that state on the laws map panel and scrolls to it */
  var ll=el.querySelector('.rll');if(ll)ll.addEventListener('click',function(e){var p=$('slm-panel')||$('slm');if(!p)return;e.preventDefault();
    try{if(ab&&window.slmSelectState)window.slmSelectState(ab);}catch(x){}window.scrollTo({top:p.getBoundingClientRect().top+window.pageYOffset-150,behavior:'smooth'});/* clears the sticky toolbar */if(window.gtag)gtag('event','rules_link_click',{beach_state:ab||''});});
  if(!REPORT_URL)return;var pick='',f=el.querySelector('.rlf'),send=el.querySelector('.rls');
  el.querySelector('.rlo').addEventListener('click',function(e){e.preventDefault();f.style.display=f.style.display==='none'?'':'none';if(window.gtag)gtag('event','rule_report_open',{beach:beachKey||'unlisted'});});
  el.querySelectorAll('.rlb button').forEach(function(b){b.addEventListener('click',function(){pick=b.getAttribute('data-v');el.querySelectorAll('.rlb button').forEach(function(x){x.style.outline=x===b?'2px solid #6ee7ff':'';});send.disabled=false;});});
  send.addEventListener('click',function(){if(!pick)return;send.disabled=true;var m=el.querySelector('.rlm');
    var p={type:'rule',beach:beachKey||'unlisted',value:pick,device:clDevice(),tester:clStore('sl_tester')||'',app:SL_APP,extra:{comment:String(el.querySelector('.rlt').value||'').slice(0,300),state:ab||'',app:SL_APP}};
    fetch(REPORT_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(p)}).then(function(r){return r.json();})
      .then(function(j){m.textContent=j.ok?'Thanks! We check every rule report and fix the app when it’s confirmed.':(j.error==='already reported'?'You already sent a report for this beach today. Thanks!':'Couldn’t send that. Try again later.');if(!j.ok&&j.error!=='already reported')send.disabled=false;})
      .catch(function(){m.textContent='Couldn’t send that. Try again later.';send.disabled=false;});
    if(window.gtag)gtag('event','rule_report',{beach:beachKey||'unlisted',reason:pick,beach_state:ab||''});});}
/* ===== Water clarity: outlook from the scoring job; angler reports override it (see REPORT_URL) ===== */
var SL_APP=!!window.SL_APP;/* set site-wide in the head code */
var REPORT_URL='https://script.google.com/macros/s/AKfycbzO-9-krA8DIvmFRk1N-uIw6rYV1O75beHxxIi9IRthrOnoGBBSci6MONJU9apbPecACA/exec';/* paste the Apps Script /exec URL here to turn on the report buttons */
var CL={clean:['Clean','#7ee787'],stained:['Stained','#ffb020'],dirty:['Dirty','#ff6a6a']},CL_REP=null;
function clStore(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}}
function clDevice(){var d=clStore('sl_device');if(!d){d=Math.random().toString(36).slice(2)+Date.now().toString(36);clStore('sl_device',d);}return d;}
(function(){var m=location.search.match(/[?&]tester=([^&]+)/);if(m)clStore('sl_tester',decodeURIComponent(m[1]));})();
function clReports(){if(!REPORT_URL)return Promise.resolve(null);if(!CL_REP)CL_REP=getJSON(REPORT_URL+'?type=clarity').catch(function(){return null;});return CL_REP;}
function clAgo(t){var m=Math.round((Date.now()-t)/6e4);return m<60?m+' min ago':Math.round(m/60)+' hr ago';}
function clDecide(o,r){if(!r||!r.counts)return null;var top=null,n=0;for(var k in r.counts)if(r.counts[k]>n){top=k;n=r.counts[k];}if(r.trusted){top=r.trusted;n=Math.max(n,1);}if(!CL[top])return null;
  if(o&&top===o.rating)return {rating:top,line:'Confirmed by '+n+(n>1?' anglers':' angler')+' · '+clAgo(r.latest),strong:true};
  if(r.trusted||n>=2)return {rating:top,line:'Reported by '+(r.trusted?'a SharkLeash tester':n+' anglers')+' · '+clAgo(r.latest)+(o?' · outlook said '+CL[o.rating][0]:''),strong:true};
  return {rating:o?o.rating:top,line:'1 angler says '+CL[top][0]+' ('+clAgo(r.latest)+')',strong:false};}
function clTile(beachKey,o){if(!o&&!REPORT_URL)return '';
  var h='<div class="tile" id="slmc-cl"><div class="lab">Water clarity <span style="opacity:.6">· outlook</span></div>';
  h+=o?'<div class="big" style="color:'+CL[o.rating][1]+'">'+CL[o.rating][0]+'</div><div class="small">~'+o.vis[0]+'–'+o.vis[1]+' ft visibility · '+esc(o.why)+'</div>':'<div class="big">--</div><div class="small">No outlook for this spot yet</div>';
  h+='<div class="small clr" style="color:#6ee7ff"></div>';
  if(REPORT_URL&&beachKey)h+='<div class="clq">How’s the water right now?</div><div class="clb"><button type="button" data-v="clean">Clean</button><button type="button" data-v="stained">Stained</button><button type="button" data-v="dirty">Dirty</button></div><div class="clt"></div><div class="small" style="margin-top:6px;opacity:.65">&#128274; Shared under the beach name only. Never your exact spot or your name.</div>';
  return h+'</div>';}
function clWire(beachKey,o){var el=out&&out.querySelector('#slmc-cl');if(!el||!beachKey)return;
  clReports().then(function(j){var r=j&&j.beaches?j.beaches[beachKey]:null,d=clDecide(o,r);if(!d||!el.isConnected)return;
    if(d.strong){var b=el.querySelector('.big');b.textContent=CL[d.rating][0];b.style.color=CL[d.rating][1];el.querySelector('.lab span').textContent=' · angler reports';if(o&&d.rating!==o.rating){var sm=el.querySelector('.small');if(sm)sm.style.display='none';}}
    el.querySelector('.clr').textContent=d.line;});
  el.querySelectorAll('.clb button').forEach(function(btn){btn.addEventListener('click',function(){
    el.querySelectorAll('.clb button').forEach(function(x){x.disabled=true;});var msg=el.querySelector('.clt');
    var p={type:'clarity',beach:beachKey,value:btn.getAttribute('data-v'),device:clDevice(),tester:clStore('sl_tester')||'',predicted:o?o.rating:'',predictedVisFt:o?(o.vis[0]+o.vis[1])/2:'',app:SL_APP,extra:{app:SL_APP}};
    fetch(REPORT_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(p)}).then(function(r){return r.json();})
      .then(function(j){msg.textContent=j.ok?'Thanks! Anglers checking '+beachKey.replace(/,\s*[A-Z]{2}$/,'')+' will see your report for the next 8 hours.':(j.error==='already reported'?(SL_APP?'You already reported this beach in the last hour.':'You already reported this beach recently.'):'Couldn’t log that. Try again later.');CL_REP=null;})
      .catch(function(){msg.textContent='Couldn’t log that. Try again later.';});
    if(window.gtag)gtag('event','clarity_report',{beach:beachKey,reported:p.value,predicted:p.predicted||'none'});});});}
function fcStrip(lat,lon,w,wv,wt,t,label){
  var g=out&&out.querySelector('.grid');if(!g||!w||!w.P)return;
  if(BAN_NOW){var bx=document.createElement('div');bx.className='fc';bx.innerHTML='<p class="fcn">🚫 No SharkLeash Drop Score here: shark fishing is banned at '+esc(BAN_NOW.name)+'. It\u2019s also left out of Top 5 Drop Spots.</p>';g.parentNode.insertBefore(bx,g.nextSibling);return;}
  /* too far from any listed beach (inland or offshore tap): no Drop Score, point them to the nearest beach instead */
  if(!label){var nb=null,nd=1e9;FC_BEACH.forEach(function(x){var d=km(lat,lon,x.lat,x.lon);if(d<nd){nd=d;nb=x;}});
    if(nb&&nd>25){var ix=document.createElement('div');ix.className='fc';ix.innerHTML='<p class="fcn">🦈 No SharkLeash Drop Score here: you\u2019re about '+Math.round(nd*0.621)+' miles from the nearest beach we score ('+esc(nb.name+', '+nb.state)+'). Pick a beach above to see its score.</p>';g.parentNode.insertBefore(ix,g.nextSibling);return;}}
  var box=document.createElement('div');box.className='fc';box.innerHTML='<p class="msg"><i class="sp"></i>Loading the 7-evening outlook…</p>';g.parentNode.insertBefore(box,g.nextSibling);
  fcBB().then(function(bb){if(!box.isConnected)return;
    var days=fcDays(w.P);if(!days.length){box.remove();return;}
    var st=w.state||'',BM=bbMatch(lat,lon,label,bb),near=BM.near;FC_ROWS=near&&near.speciesRegion?(FC_REG[near.speciesRegion]||null):null;var dp=fcDeep(near),wtf=wt&&wt.f!=null?+wt.f:null,match=null,wtJob=false;
    match=BM.match;if(match&&match.wt!=null){wtf=+match.wt;wtJob=true;}
    var today=new Date().toDateString(),tiles=days.map(function(d,i){
      var mid=d.start.getTime()+3*36e5,wf=wv&&wv.vals?waveAt(wv.vals,mid):null;wf=wf!=null&&wf>0?wf*wv.k:null;var wfb=false;if(wf==null&&i===0&&match&&match.wv!=null&&match.w&&new Date(match.w.start).toDateString()===d.start.toDateString()){wf=match.wv;wfb=true;}
      var S=fcScore(st,lat,d,wf,wtf,dp,d.start.getMonth()),sc=S.tot,why=fcWhy(S.b,d.avg,wf,wtf),useBB=false;
      if(i===0&&match&&match.w&&new Date(match.w.start).toDateString()===d.start.toDateString()){sc=match.score;useBB=true;why=fcWhy(match.parts,match.w&&match.w.avg,match.wv,match.wt);}
      var tc=null;(t&&t.all||[]).some(function(e){if(e.date.getTime()>=d.start.getTime()&&e.date.getTime()<=d.start.getTime()+6*36e5){tc=e;return true;}return false;});
      var lbl=d.start.toDateString()===today?'Tonight':i===0||(i===1&&days[0].start.toDateString()===today)?'Tomorrow':d.start.toLocaleDateString(undefined,{weekday:'short'});
      return '<div class="fcd'+(i>=3?' early':'')+'"><div class="fdn">'+lbl+'</div><div class="fdd">'+d.start.toLocaleDateString(undefined,{month:'short',day:'numeric'})+'</div>'
        +'<div class="fsc" style="color:'+fcCol(sc)+'">'+sc+'</div><div class="fsl">drop score</div>'
        +'<div class="fx">'+(d.avg<2||!d.dir?'Calm':esc(d.dir)+' '+d.avg+' mph')+'</div>'
        +'<div class="fx">'+(wf!=null?ftTxt(wf)+' ft '+(wfb?'(offshore)':'surf'):'surf n/a')+'</div>'
        +(tc?'<div class="fx">'+(tc.type==='H'?'⬆️ High ':'⬇️ Low ')+tc.t.replace(':00','').replace(' PM','p').replace(' AM','a')+'</div>':'')
        +(why?'<div class="fwy">'+why+'</div>':'')+(d.front?'<div class="ffr">⚡ front</div>':'')+(useBB?'<div class="fce" style="color:#6ee7ff">live</div>':i>=3?'<div class="fce">early look</div>':'<div class="fce">forecast</div>')+'</div>';});
    box.innerHTML='<div class="fch"><b>🎯 SharkLeash Drop Score · next 7 evenings, 4–10 PM</b></div><p class="fcx">The SharkLeash Drop Score rates each evening for a drone drop, out of 100 (a front coming can push it higher). <b>100</b> = light wind, fishable surf, warm water, sharks running and deep water close. Tonight is live from the latest Top 5 run; the other evenings are forecasts.</p><div class="fcr">'+tiles.join('')+'</div>'
      +'<p class="fcn">Wind: NWS hourly forecast. Surf: NWS wave model (Tonight falls back to the nearest buoy or NOAA wave model). Water temp: '+(wtJob?'today’s offshore buoy/satellite reading (same as Top 5)':'today’s reading')+'. Days 4–7 are an early look; forecasts get shakier past 3 days.'+(near?' Deep water from '+esc(near.name)+'.':'')+'</p>';
    FC_ROWS=null;if(window.gtag)gtag('event','forecast_strip_view');
  });}
function run(lat,lon,label,fromMap){
var LD=[['w','Weather & wind'],['t','Tides'],['v','Waves'],['tp','Water temp'],['r','Rip current risk'],['bb','SharkLeash Drop Score & water clarity']];
out.innerHTML='<div class="ld"><b><i class="sp"></i>Pulling live data'+(label?' for '+esc(label.replace(/,\s*[A-Z]{2}$/,'')):'')+'…</b><ul>'+LD.map(function(x){return '<li data-k="'+x[0]+'">○ '+x[1]+'</li>';}).join('')+'</ul><div class="small sl" style="margin-top:6px;color:#ffb020"></div></div>';
function tk(k,ok){var li=out.querySelector('.ld li[data-k="'+k+'"]');if(li){li.className=ok?'ok':'';li.textContent=(ok?'✓ ':'– ')+li.textContent.slice(2);}}
var slowT=setTimeout(function(){var e=out.querySelector('.ld .sl');if(e)e.textContent='NOAA is slow right now. Hang tight…';},8000);
var n=nearest(lat,lon),st=n[0],mi=(n[1]*0.621).toFixed(0);
var wp=wind(lat,lon);
var P=[wp,tides(st),wp.then(function(w){return waves(lat,lon,w.grid);}),Promise.all([waterTemp(lat,lon),buoyTemp(lat,lon).catch(function(){return null;}),satTemp(lat,lon)]).then(function(a){var x=a[0],y=a[1],z=a[2],s=x&&y?((y.mi<x.mi&&!y.old)?y:x):x||y;if(z&&(!s||s.mi>20||Math.abs(s.f-z.f)>6)){if(s&&Math.abs(s.f-z.f)>6)s.odd=1;z.ref=s;return z;}return s;}),wp.then(function(w){return rip(lat,lon,w);}),fcBB()],KK=['w','t','v','tp','r','bb'];P.forEach(function(p,i){if(KK[i])p.then(function(v){tk(KK[i],v!=null);},function(){tk(KK[i],false);});});
Promise.allSettled(P).then(function(r){clearTimeout(slowT);
var w=r[0].status==='fulfilled'?r[0].value:null,t=r[1].status==='fulfilled'?r[1].value:null,wv=r[2].status==='fulfilled'?r[2].value:null,wt=r[3].status==='fulfilled'?r[3].value:null,rc=r[4].status==='fulfilled'?r[4].value:null,bb=r[5].status==='fulfilled'?r[5].value:null;
var BM=bbMatch(lat,lon,label,bb),bm=BM.match,bkey=BM.near?BM.near.name+', '+BM.near.state:null,bwv=!wv&&bm&&bm.wv!=null?bm.wv:null;
/* show the scoring job's ocean reading for this beach (seaward buoy or nearshore satellite) instead of a sensor that is far away (over 15 mi, often up a bay) or more than 6F off it (harbor or bay water) */
if(bm&&bm.wt!=null&&(!wt||!wt.sat&&(wt.mi>15||Math.abs(wt.f-bm.wt)>6))){var src=bm.tsrc||'';wt={f:+bm.wt,name:/^buoy/.test(src)?'Offshore buoy '+src.replace(/^buoy\s*/,''):'Nearshore satellite',job:1,ref:wt?{name:wt.name,f:wt.f,mi:wt.mi}:null};}
var where=label||(w&&w.town?'Near '+w.town:'Your location');
var h='<p class="where">'+esc(where)+'</p>';
BAN_NOW=banNear(lat,lon,label);if(BAN_NOW){h+='<div class="ban">🚫 Shark fishing is banned '+(BAN_NOW.exact?'here':'near you ('+esc(BAN_NOW.name)+')')+'<small>'+esc(BAN_NOW.rule)+'. '+(BAN_NOW.exact?'':'Check exactly where the boundary is before you set up. ')+'Regular surf fishing rules may still apply.</small></div>';if(window.gtag)gtag('event','local_ban_view',{beach:BAN_NOW.name});}
else if(SEAS_NOW)h+='<div class="nws">📅 Seasonal rule '+(SEAS_NOW.exact?'here':'near you ('+esc(SEAS_NOW.name)+')')+', not in effect right now<small>'+esc(SEAS_NOW.rule)+'.</small></div>';
/* tonight's place on the Drop Score list: same order as the Top 5 (raw score, beaches with a fishing ban or red tide left out) */
var RK=bbRank(bb,bm);if(RK&&RK.out)h+='<div class="rank" style="color:rgba(255,255,255,.7)">Not on tonight’s Drop Score list · '+esc(RK.out)+'</div>';else if(RK)h+='<a class="rank" href="#slbb">🏆 <b>#'+RK.n+'</b> of '+RK.of+' beaches tonight'+(label?'':' ('+esc(bm.name.replace(/,\s*[A-Z]{2}$/,''))+')')+'<small>See the list →</small></a>';
if(ALERTS.length){var sv=ALERTS.some(function(x){return x.sev;});h+='<div class="nws'+(sv?' sev':'')+'">⚠️ NWS: '+ALERTS.slice(0,4).map(function(x){return esc(x.ev);}).join(' · ')+'<small>Active now for this beach’s area. <a href="https://forecast.weather.gov/MapClick.php?lat='+(+lat).toFixed(4)+'&lon='+(+lon).toFixed(4)+'" target="_blank" rel="noopener">Details at weather.gov ↗</a></small></div>';if(window.gtag)gtag('event','nws_alert_view',{beach:bkey||'unlisted',alerts:ALERTS.map(function(x){return x.ev;}).join(', ').slice(0,100)});}
h+=ruleRow(BM.near?BM.near.state:(w&&w.state));
h+='<div class="grid">';
h+='<div class="tile"><div class="lab">Weather <span style="opacity:.6">· NWS forecast</span></div>'+(w&&w.temp!==undefined&&w.temp!==null?'<div class="big"><span aria-hidden="true">'+wxIcon(w.sky,w.day)+'</span>'+esc(w.temp)+'<span style="font-size:16px">°'+esc(w.unit)+'</span></div><div class="small">'+esc(w.sky)+(w.pop!==null?' · '+w.pop+'% rain':'')+'</div>':'<div class="big">--</div><div class="small err">Weather unavailable</div>')+'</div>';
h+='<div class="tile"><div class="lab">Wind <span style="opacity:.6">· NWS forecast</span></div>'+(w?'<div class="big">'+arrowSVG(w.dir)+esc(w.dir)+' '+esc(w.spd.replace(' mph',''))+'<span style="font-size:16px">mph</span></div><div class="small">'+(w.next?'In 3 hrs: '+esc(w.next.dir)+' '+esc(w.next.spd):'')+'</div>':'<div class="big">--</div><div class="small err">Wind unavailable</div>')+'</div>';
h+='<div class="tile"><div class="lab">Waves <span style="opacity:.6">· '+(wv||bwv==null?'NWS forecast':(bm.wsrc==='model'?'NOAA wave model':'nearest buoy'))+'</span></div>'+(!wv&&bwv!=null?'<div class="big">'+ftTxt(bwv)+'<span style="font-size:16px">ft</span></div><div class="small">'+(bm.wp?Math.round(bm.wp)+'s period · ':'')+'measured offshore, updated every 2 hrs</div>':wv?'<div class="big">'+ftTxt(wv.now)+'<span style="font-size:16px">ft</span></div><div class="small">'+(wv.in3!==null?'In 3 hrs: '+ftTxt(wv.in3)+' ft':'')+(wv.off?' · just offshore':'')+'</div>':'<div class="big">--</div><div class="small">No wave forecast for this spot</div>')+'</div>';
h+=clTile(bkey,bm&&bm.clarity);
h+='<div class="tile"><div class="lab">Water temp'+(wt?' <span style="color:'+(wt.job?'#2ecc71">· ocean reading':wt.sat?'#ffb020">· satellite, daily':wt.old?'#ffb020">· sensor, older':'#2ecc71">· live sensor')+'</span>':'')+'</div>'+(wt?'<div class="big">'+Math.round(wt.f)+'<span style="font-size:16px">°F</span></div><div class="small">'+esc(wt.name)+' · '+(wt.job?'updated every 2 hrs'+(wt.ref?' · skipped '+esc(wt.ref.name)+' '+Math.round(wt.ref.f)+'°F, '+wt.ref.mi+' mi ('+(wt.ref.mi>15?'too far away':'likely a harbor or bay sensor')+')':''):wt.sat?wt.at+(wt.ref?' · nearest sensor '+esc(wt.ref.name)+' '+Math.round(wt.ref.f)+'°F, '+wt.ref.mi+' mi'+(wt.ref.odd?' (skipped: far off the satellite, likely a harbor or bay sensor)':''):''):wt.mi+' mi · '+(wt.old?'as of ':'')+wt.at)+'</div>':'<div class="big">--</div><div class="small">No water temp reading nearby</div>')+'</div>';
h+=tideTile(t);
var mo=moon(new Date()),spring=Math.min(mo.age,Math.abs(mo.age-mo.syn/2),mo.syn-mo.age)<2.5;
var RC={Low:['#2ecc71','🟢'],Moderate:['#ffb020','🟡'],High:['#ff4444','🔴']},rk=rc&&rc.risk&&RC[rc.risk]?rc.risk:null;
h+='<div class="tile"><div class="lab">Rip current risk</div>'+(rk?'<div class="big" style="color:'+RC[rk][0]+'">'+RC[rk][1]+' '+rk+'</div><div class="small">'+esc(rc.src)+(rc.old?' · may be out of date':'')+'</div>':'<div class="big">--</div><div class="small">'+(rc&&rc.src?esc(rc.src):'No NWS surf forecast for this spot right now (many offices only issue it in beach season)')+'</div>')+'</div>';
var bw=bestWindow(t,lat,lon);
h+='<div class="tile"><div class="lab">Best window</div>'+(bw?'<div class="big" style="font-size:clamp(22px,2.1vw,30px);white-space:normal;flex-wrap:wrap">'+hmr(bw.a,bw.b)+'</div><div class="small">'+(new Date(bw.a).toDateString()===new Date().toDateString()?'Today':'Tomorrow')+' · around '+(bw.p.type==='H'?'high':'low')+' tide '+bw.p.t+(bw.dark?' · after dark':bw.dusk?' · at dusk/dawn':'')+(spring?' · strong '+(mo.age<5||mo.age>24?'new':'full')+'-moon tides':'')+'</div>':'<div class="big">--</div><div class="small">Needs tide data</div>')+'</div>';
var mo=moon(new Date());h+='<div class="tile"><div class="lab">Moon</div><div class="big">'+mo.icon+' '+mo.ill+'<span style="font-size:16px">%</span></div><div class="small">'+mo.name+' · '+mo.next+'</div></div>';
h+='</div><p class="small" style="margin:8px 0 0">Tide station: '+esc(st[1])+' ('+mi+' mi away)</p>';
h+='<a class="rig" href="/#buy-anchor" onclick="if(window.gtag)gtag(\'event\',\'rig_up_click\',{event_category:\'Conditions\'})"><span>Fishing here? Rig up right.</span><b>Get Gen 2 →</b></a>';
out.innerHTML=h;
try{clWire(bkey,bm&&bm.clarity);}catch(e){}
try{ruleWire(bkey,BM.near?BM.near.state:(w&&w.state));}catch(e){}
try{fcStrip(lat,lon,w,wv,wt,t,label);}catch(e){}
try{pastPanel(bkey,BM.near&&BM.near.id);}catch(e){}
var nl=$('slmc-noaa');if(nl)nl.href='https://forecast.weather.gov/MapClick.php?lat='+(+lat).toFixed(4)+'&lon='+(+lon).toFixed(4);
try{if(window.gtag)gtag('event','beach_view',{beach:bkey||'unlisted',beach_state:BM.near?BM.near.state:(w&&w.state)||'',pick_source:SRC});}catch(e){}
var NB=null;if(!bkey&&FC_BEACH.length){var nd=1e9;FC_BEACH.forEach(function(x){var d=km(lat,lon,x.lat,x.lon);if(d<nd){nd=d;NB={beach:x.name+', '+x.state,id:x.id||pastSlug(x.name+', '+x.state),mi:Math.round(d*0.621)};}});}
try{window.SLMC_LAST={beachId:BM.near?(BM.near.id||pastSlug(bkey)):null,near:NB?NB.beach:null,nearId:NB?NB.id:null,nearMi:NB?NB.mi:null,gps:!label&&!fromMap,fromMapSync:!!fromMap,where:where,town:w&&w.town,lat:lat,lon:lon,at:Date.now(),w:w,wv:wv,wt:wt,t:t,mo:mo,bw:bw,rc:rc,beach:bkey,ds:bm&&bm.score!=null?bm.score:null,cl:bm&&bm.clarity?bm.clarity.rating:null,state:BM.near?BM.near.state:(w&&w.state)||null};window.dispatchEvent(new Event('slmc:conditions'));}catch(e){}
if(w&&w.state&&window.slmSelectState)window.slmSelectState(w.state);
if(!label)syncPicker(lat,lon,w&&w.state);
});
}
function setup(){
if(!ROOT||!ROOT.parentNode)return;
var all=document.querySelectorAll('[id="slmc"]');
for(var i=0;i<all.length;i++){if(all[i]!==ROOT&&all[i].parentNode)all[i].parentNode.removeChild(all[i]);}
var oldSel=ROOT.querySelector('#slmc-spot'),oldLoc=ROOT.querySelector('#slmc-loc'),oldSt=ROOT.querySelector('#slmc-st'),keep=oldSel?oldSel.value:'';
stSel=oldSt.cloneNode(false);oldSt.parentNode.replaceChild(stSel,oldSt);
sel=oldSel.cloneNode(false);oldSel.parentNode.replaceChild(sel,oldSel);
var loc=oldLoc.cloneNode(false);loc.innerHTML=oldLoc.innerHTML;oldLoc.parentNode.replaceChild(loc,oldLoc);
out=ROOT.querySelector('#slmc-out');
stSel.innerHTML='<option value="">…or pick a state</option>';
STATES.forEach(function(k){var o=document.createElement('option');o.value=k;o.textContent=STN[k]||k;stSel.appendChild(o);});
fillSpots('');
stSel.addEventListener('change',function(){fillSpots(stSel.value);if(stSel.value&&window.gtag)gtag('event','state_pick',{state:stSel.value});});
/* ===== Use my location: when it fails, show this phone's own fix-it steps, plus a way to pick from the list instead ===== */
function locPlat(){var u=navigator.userAgent||'';if(/iPhone|iPad|iPod/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1))return /CriOS/.test(u)?'ios-chrome':'ios';if(/Android/.test(u))return /SamsungBrowser/.test(u)?'android-samsung':'android';return 'desktop';}
function locEvt(r){try{if(window.gtag)gtag('event','location_result',{result:r,platform:locPlat()});}catch(e){}}
function locHelp(code){
  if(!document.getElementById('slmc-lch-css')){var c=document.createElement('style');c.id='slmc-lch-css';
    c.textContent='#slmc .lch{padding:14px 16px;border:1px solid rgba(255,138,138,.45);border-radius:16px;background:rgba(255,43,43,.07)}'
      +'#slmc .lch ol{margin:6px 0 12px;padding:0 0 0 20px}#slmc .lch li{margin:0 0 6px;font-size:14px;font-weight:600;color:rgba(255,255,255,.88);line-height:1.4}#slmc .lch li b{color:#fff}'
      +'#slmc .lch .lcp{width:100%;min-height:46px;font-size:15px;border-radius:12px;background:rgba(110,231,255,.12);border:1px solid rgba(110,231,255,.55);color:#6ee7ff;cursor:pointer}';
    document.head.appendChild(c);}
  var pf=locPlat(),k=code===1?'denied':code===3?'timeout':code===0?'unsupported':'unavailable';locEvt(k);
  var on={ios:'Open the <b>Settings</b> app → <b>Privacy &amp; Security</b> → <b>Location Services</b> and make sure it’s <b>On</b>.',
    'ios-chrome':'Open the <b>Settings</b> app → <b>Privacy &amp; Security</b> → <b>Location Services</b> and make sure it’s <b>On</b>.',
    android:'Swipe down from the top of the screen and make sure <b>Location</b> is <b>on</b>.','android-samsung':'Swipe down from the top of the screen and make sure <b>Location</b> is <b>on</b>.',
    desktop:'Make sure location is turned on for your computer.'}[pf];
  var allow={ios:'In that same screen, scroll down to <b>Safari Websites</b> and choose <b>While Using the App</b>.',
    'ios-chrome':'Go back to <b>Settings</b>, scroll down to <b>Chrome</b> → <b>Location</b> → <b>While Using the App</b>.',
    android:'In Chrome, tap the icon just left of the web address → <b>Permissions</b> (or <b>Site settings</b>) → <b>Location</b> → <b>Allow</b>.',
    'android-samsung':'In Samsung Internet, tap the lock icon by the web address → <b>Permissions</b> → turn on <b>Location</b>.',
    desktop:'Click the icon just left of the web address (a lock or sliders) and set <b>Location</b> to <b>Allow</b>.'}[pf];
  var tp=pf==='desktop'?'click':'tap',again='Reload this page and '+tp+' <b>Use my location</b> again'+(pf==='ios'?'. Tap <b>Allow</b> when Safari asks.':'.');
  var head={denied:'Location is turned off for this site.',timeout:'Your phone couldn’t find its location in time.',unavailable:'Your phone couldn’t find its location.',unsupported:'This browser can’t share its location.'}[k];
  var steps=k==='denied'?[on,allow,again]:k==='timeout'?['Step outside or away from tall buildings.',(pf==='desktop'?'Click':'Tap')+' <b>Use my location</b> again.']:k==='unavailable'?[on,(pf==='desktop'?'Click':'Tap')+' <b>Use my location</b> again.']:[];
  out.innerHTML='<div class="lch"><p class="msg err" style="margin:0 0 4px;padding:0"><b>'+head+'</b>'+(steps.length?' Here’s how to fix it:':'')+'</p>'
    +(steps.length?'<ol>'+steps.map(function(x){return '<li>'+x+'</li>';}).join('')+'</ol>':'')
    +'<button type="button" class="lcp">Or pick your beach from the list →</button></div>';
  var b=out.querySelector('.lcp');if(b)b.onclick=function(){locEvt('picked_instead');stSel.scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(function(){try{stSel.focus();if(stSel.showPicker)stSel.showPicker();}catch(e){}},450);};}
loc.addEventListener('click',function(){
if(!navigator.geolocation){locHelp(0);return;}
out.innerHTML='<p class="msg"><i class="sp"></i>Finding you…</p>';
navigator.geolocation.getCurrentPosition(function(p){locEvt('ok');sel.value='';SRC='gps';NOMEM=false;run(p.coords.latitude,p.coords.longitude);},function(e){locHelp(e&&e.code||2);},{enableHighAccuracy:false,timeout:15000,maximumAge:300000});
});
sel.addEventListener('change',function(){if(sel.value==='')return;var s=SPOTS[+sel.value];SRC='list';NOMEM=false;memBeach(s[0]);run(s[1],s[2],s[0]);});
}
/* ===== Where the beach list and tide stations live. Change only these lines if the repo moves. ===== */
var DATA_URL="https://sharkleashdevelopment.github.io/sharkleash-data/shark-data.json";
var STATIONS_URL="https://sharkleashdevelopment.github.io/sharkleash-data/tide-stations.json";
var READY=false,PENDING=null;
function afterLoad(){setup();var L=window.SLMC_LAST;if(L&&L.lat!=null){syncPicker(L.lat,L.lon,L.w&&L.w.state);return;}if(/Pulling|Finding/.test(out.textContent))return;
  var bi=lastBeach();if(bi>-1){var s=SPOTS[bi],st=spotSt(s);stSel.value=st;fillSpots(st,String(bi));SRC='saved';NOMEM=false;run(s[1],s[2],s[0]);return;}
  out.innerHTML='<p class="msg">Tap <b>Use my location</b> on the beach, or pick a state and beach.</p>';}
window.slmcRun=function(a,b,lb,o){if(!READY){PENDING=[a,b,lb,o];return;}SRC=o&&o.src?o.src:'map';NOMEM=!!(o&&o.noMem);if(sel)sel.value='';if(lb){syncPicker(a,b,'');run(a,b,lb);}else run(a,b,null,1);};
window.slmcStates=STATES;
Promise.all([getJSON(DATA_URL,{cache:'no-cache'}),getJSON(STATIONS_URL),getJSON('https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions').catch(function(){return null;})]).then(function(r){
  FC_REG=r[0].speciesByRegion||{};FC_STATES=r[0].states||[];
  /* Gulf tide stations come live from NOAA (Florida's Gulf side west to Texas) */
  if(r[2]&&r[2].stations){r[2].stations.forEach(function(x){var la=+x.lat,lo=+x.lng;if(la<31.5&&la>25.3&&lo>-98&&(lo<-82.5||(lo<-81.65&&la<28.5)))r[1].stations.push([x.id,x.name,la,lo]);});}
  r[0].beaches.forEach(function(b){SPOTS.push([b.name+', '+b.state,b.lat,b.lon]);});FC_SPM=r[0].speciesByMonth||{};FC_BEACH=r[0].beaches;
  r[1].stations.forEach(function(s){ST.push(s);});
  SPOTS.forEach(function(s){var k=spotSt(s);if(k&&STATES.indexOf(k)<0)STATES.push(k);});
  READY=true;setup();
  if(document.readyState==='complete')afterLoad();else window.addEventListener('load',afterLoad);
  if(PENDING){var p=PENDING;PENDING=null;window.slmcRun(p[0],p[1],p[2],p[3]);}
}).catch(function(){var o=document.getElementById('slmc-out');if(o)o.innerHTML='<p class="msg err">Couldn\'t load the beach list right now. Refresh the page to try again.</p>';});
/* ===== Version badge + What's new (changelog.json in sharkleash-data; edit that file to announce updates, no code change) ===== */
var CHANGELOG_URL="https://sharkleashdevelopment.github.io/sharkleash-data/changelog.json";
(function(){
  if(!ROOT||ROOT.querySelector('.slv'))return;
  var MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var fd=function(d){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(d||'');return m?MO[+m[2]-1]+' '+(+m[3]):esc(d||'');};
  var st=document.createElement('style');
  st.textContent='#slmc .slv{position:relative;display:inline-block;margin:0 0 12px 8px;vertical-align:top}'
    +'#slmc .slv>button{min-height:0;padding:7px 12px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.04em;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.22);color:rgba(255,255,255,.85);cursor:pointer;display:inline-flex;align-items:center;gap:6px}'
    +'#slmc .slv>button:hover{border-color:#6ee7ff;color:#fff}'
    +'#slmc .slv .dot{display:inline-block;background:#ff2b2b;color:#fff;border-radius:999px;padding:1px 6px;font-size:10px;font-weight:900;letter-spacing:.06em}'
    +'#slmc .slvp{position:absolute;left:0;top:calc(100% + 6px);z-index:50;width:min(340px,86vw);max-height:60vh;overflow:auto;background:#061923;border:1px solid rgba(110,231,255,.45);border-radius:14px;padding:12px 14px;box-shadow:0 18px 44px rgba(0,0,0,.55);text-align:left}'
    +'#slmc .slvp h5{margin:0 0 8px;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#6ee7ff}'
    +'#slmc .slvp b{display:block;margin:10px 0 4px;font-size:12px;font-weight:900;color:#ff4444;text-transform:uppercase;letter-spacing:.08em}'
    +'#slmc .slvp ul{margin:0;padding:0 0 0 16px}#slmc .slvp li{margin:0 0 4px;font-size:13px;font-weight:600;color:rgba(255,255,255,.85);line-height:1.35}';
  document.head.appendChild(st);
  getJSON(CHANGELOG_URL,{cache:'no-cache'}).then(function(c){
    if(!c||!c.version)return;
    var seen=null;try{seen=localStorage.getItem('slmc_seen_ver');}catch(e){}
    var isNew=seen!==String(c.version);
    var w=document.createElement('span');w.className='slv';
    w.innerHTML='<button type="button" aria-expanded="false">v'+esc(c.version)+' · Updated '+fd(c.date)+(isNew?' <span class="dot">NEW</span>':'')+' · What’s new ›</button>';
    var ups=(c.updates||[]).slice(0,5);
    var p=document.createElement('div');p.className='slvp';p.style.display='none';
    p.innerHTML='<h5>What’s new</h5>'+ups.map(function(u){return '<b>'+fd(u.date)+'</b><ul>'+(u.notes||[]).map(function(n){return '<li>'+esc(n)+'</li>';}).join('')+'</ul>';}).join('');
    w.appendChild(p);
    var eb=ROOT.querySelector('.eyebrow');if(eb&&eb.parentNode)eb.parentNode.insertBefore(w,eb.nextSibling);else ROOT.insertBefore(w,ROOT.firstChild);
    var btn=w.querySelector('button');
    btn.addEventListener('click',function(e){e.stopPropagation();var o=p.style.display==='none';p.style.display=o?'':'none';btn.setAttribute('aria-expanded',o);
      if(o){try{localStorage.setItem('slmc_seen_ver',String(c.version));}catch(err){}var d=btn.querySelector('.dot');if(d)d.remove();if(window.gtag)gtag('event','whats_new_open',{version:String(c.version)});}});
    document.addEventListener('click',function(e){if(p.style.display!=='none'&&!w.contains(e.target)){p.style.display='none';btn.setAttribute('aria-expanded','false');}});
    /* the footer's old version tag follows the badge */
    var ft=ROOT.querySelector('.foot span');if(ft&&/^v\d+$/.test(ft.textContent.trim()))ft.textContent='v'+c.version;
  }).catch(function(){});
})();
/* ===== "Share this beach" (its own embed) shares tonight's numbers instead of a generic line. Only touches shares titled "SharkLeash: <beach>" for the beach on screen. ===== */
function shareLine(){var L=window.SLMC_LAST;if(!L||!L.beach||BAN_NOW)return null;var nm=String(L.beach).replace(/,\s*[A-Z]{2}$/,''),p=[];
  var hr=new Date().getHours(),when=hr>=22?'tomorrow night':'tonight';
  if(L.ds!=null)p.push('Drop Score '+L.ds);
  if(L.w&&L.w.dir&&L.w.spd)p.push(L.w.dir+' '+String(L.w.spd).replace(/\s*mph/i,'')+' mph');
  if(L.wv&&L.wv.now!=null)p.push(ftTxt(L.wv.now)+' ft surf');
  if(L.wt&&L.wt.f!=null)p.push(Math.round(L.wt.f)+'°F water');
  /* the tide turn inside the 4-10 PM window the score covers (a high tide first); none in the window = no tide in the message */
  var d0=new Date();if(hr>=22)d0=new Date(d0.getTime()+864e5);var w0=new Date(d0.getFullYear(),d0.getMonth(),d0.getDate(),16).getTime(),w1=w0+6*36e5;
  var tw=((L.t&&L.t.all)||[]).filter(function(e){var x=e.date.getTime();return x>=w0&&x<=w1;}),tc=tw.filter(function(e){return e.type==='H';})[0]||tw[0];
  if(tc)p.push((tc.type==='H'?'high':'low')+' tide '+tc.t);
  if(!p.length)return null;
  return nm+' '+when+': '+p.join(' · ')+' 🦈 Free shark fishing conditions + the local rules:';}
(function(){if(!navigator.share||navigator.__slShare)return;var orig=navigator.share.bind(navigator);
  try{navigator.share=function(d){try{var L=window.SLMC_LAST;if(d&&L&&L.beach&&String(d.title||'')==='SharkLeash: '+L.beach){var t=shareLine();if(t){d=Object.assign({},d,{text:t});if(window.gtag)gtag('event','share_numbers',{beach:L.beach});}}}catch(e){}return orig(d);};navigator.__slShare=1;}catch(e){}})();
document.addEventListener('click',function(e){if(!e.target.closest||!e.target.closest('#slmc-map'))return;var m=$('slm-map');if(!m)return;m.scrollIntoView({behavior:'smooth',block:'center'});if(window.gtag)gtag('event','map_pick_click');});
window.addEventListener('load',function(){if(!$('slm-map')){var mb=$('slmc-map');if(mb)mb.style.display='none';}});
/* ===== Next-visit trip question: "How'd it go at <beach> last night?" =====
   Remembers the beach checked for tonight (noon to 3 AM). The next time this phone opens the page, from 5 AM the
   next morning and within 40 hours, it asks once. One tap sends a trip report filed under the night it was fished
   (night_of; Apps Script v13), with that night's saved Drop Score and conditions. Skipped if a trip report was
   already sent for that night. Same privacy as the trip form: beach name only. */
(function(){
var K='sl_lastcheck',D='sl_tripask',LBL={landed:'Landed one',lost:'Hooked, lost it',no:'No bites',rig_broke:'Rig broke'};
function pad(n){return ('0'+n).slice(-2);}
function nightKey(t){var d=new Date(t-12*3600e3);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function jget(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}}
function jset(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
window.addEventListener('slmc:conditions',function(){var c=window.SLMC_LAST;if(!c||!c.beach||c.fromMapSync)return;var h=new Date().getHours();if(h>=3&&h<12)return;
  var w=c.w||{};jset(K,{b:c.beach,at:Date.now(),n:nightKey(Date.now()),ds:c.ds!=null?c.ds:null,cl:c.cl||null,wt:c.wt&&c.wt.f!=null?Math.round(c.wt.f):null,
    wv:c.wv&&c.wv.now!=null?Math.round(c.wv.now*2)/2:null,wind:String(w.spd||''),dir:String(w.dir||''),st:c.state||null});});
/* any trip report (the form below or this question) closes that night */
var rf=window.fetch;if(rf&&!window.__slTripHook){window.__slTripHook=1;window.fetch=function(u,o){try{if(typeof u==='string'&&u.indexOf('script.google.com/macros/s/')>=0&&o&&o.method==='POST'){var b=JSON.parse(o.body);if(b&&b.type==='session')jset(D,{n:b.night_of||nightKey(Date.now())});}}catch(e){}return rf.apply(this,arguments);};}
function ask(){var L=jget(K);if(!L||!L.b||!REPORT_URL)return;var now=Date.now(),hr=new Date(now).getHours();if(now-L.at>40*3600e3||(L.n===nightKey(now)&&!(hr>=5&&hr<12)))return;var dn=jget(D);if(dn&&dn.n===L.n)return;
  if(!ROOT||document.getElementById('sltq'))return;
  var name=String(L.b).replace(/,\s*[A-Z]{2}$/,''),box=document.createElement('div');box.id='sltq';
  box.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom));width:calc(100% - 24px);max-width:520px;z-index:9998;box-sizing:border-box;padding:16px 16px 10px;border-radius:18px;border:1px solid rgba(110,231,255,.5);background:linear-gradient(135deg,#07202c,#1a0f14);box-shadow:0 12px 40px rgba(0,0,0,.6);color:#fff;font-family:-apple-system,Segoe UI,Arial,sans-serif';
  box.innerHTML='<button type="button" data-v="later" aria-label="Not now" style="position:absolute;top:6px;right:8px;background:none;border:none;color:rgba(255,255,255,.55);font-size:20px;line-height:1;padding:8px;cursor:pointer">✕</button><div style="font-size:19px;font-weight:900;line-height:1.2;padding-right:26px">🦈 How’d it go at '+name.replace(/</g,'&lt;')+' last night?</div>'+
    '<div style="margin:4px 0 12px;font-size:13px;color:rgba(255,255,255,.7)">One tap. It teaches the Drop Score what works there. Beach name only, never your spot.</div>'+
    '<div class="g" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">'+['landed','lost','no','rig_broke'].map(function(v){return '<button type="button" data-v="'+v+'" style="min-height:48px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:#0f1c26;color:#fff;font:inherit;font-size:15px;font-weight:800;cursor:pointer">'+LBL[v]+'</button>';}).join('')+'</div>'+
    '<button type="button" data-v="x" style="display:block;margin:8px auto 0;background:none;border:none;color:rgba(255,255,255,.6);font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;padding:8px">Didn’t make it out</button>';
  document.body.appendChild(box);if(window.gtag)gtag('event','trip_prompt_shown',{beach:L.b});
  box.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('button');if(!b)return;var v=b.getAttribute('data-v');
    if(v==='later'){box.remove();if(window.gtag)gtag('event','trip_prompt_later',{beach:L.b});return;}
    jset(D,{n:L.n});
    if(v==='x'){box.remove();if(window.gtag)gtag('event','trip_prompt_skip',{beach:L.b});return;}
    var drone='';try{drone=localStorage.getItem('sldrop_drone')||'';}catch(x){}
    var body={type:'session',beach:L.b,value:v,device:clDevice(),app:SL_APP,night_of:L.n,f:{species:v==='landed'?'skipped':'n/a',held:'skipped',
      drop_score:L.ds!=null?L.ds:'none',clarity:L.cl||'none',water_f:L.wt!=null?L.wt:'none',waves_ft:L.wv!=null?L.wv:'none',wind:L.wind,wind_dir:L.dir,
      used_oz:'skipped',suggested_oz:'none',drop_yd:'skipped',deep10_yd:'none',drift_ok:'skipped',current:'none',sl_rig:v==='rig_broke'?'skipped':'n/a',drone:drone||'none',state:L.st||'unknown'}};
    var tk=clStore('sl_tester');if(tk)body.tester=tk;
    if(window.gtag)gtag('event','trip_prompt_answer',{beach:L.b,outcome:v});
    box.innerHTML='<div style="font-size:16px;font-weight:800;color:#7ee787">Sending…</div>';
    function fin(t){box.innerHTML='<div style="font-size:16px;font-weight:800;color:#7ee787">'+t+'</div>'+(v==='landed'?'<a href="/shark-id" style="display:inline-block;margin-top:8px;color:#6ee7ff;font-weight:900">Identify your shark →</a>':'')+'<div style="margin-top:6px;font-size:13px;color:rgba(255,255,255,.7)">Reports like yours are how the Drop Score at '+name.replace(/</g,'&lt;')+' gets more accurate.</div>';setTimeout(function(){if(box.parentNode)box.remove();},v==='landed'?20000:8000);}
    fetch(REPORT_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)}).then(function(r){return r.json();})
      .then(function(j){fin(j&&j.ok?'Thanks! Logged: '+LBL[v].toLowerCase()+'. Tight lines.':j&&j.error==='already reported'?'Thanks! You already reported this beach.':'Thanks! (Couldn’t save it this time.)');})
      .catch(function(){try{var q=JSON.parse(localStorage.getItem('sl_q')||'[]');q.push({id:Date.now()+'_t',at:Date.now(),body:body});localStorage.setItem('sl_q',JSON.stringify(q));}catch(x){}fin('Thanks! Weak signal, so it’s saved on your phone and will send when you have signal.');});});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(ask,600);});else setTimeout(ask,600);
})();
})();
