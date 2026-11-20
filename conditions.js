// SharkLeash Drop Score history backfill (runs in the PRIVATE repo, sharkleash-private).
// Re-scores every beach for every day in the window below with the SAME math as the live score.js,
// using what actually happened instead of the evening forecast:
//   wind + fronts  -> Open-Meteo hourly archive (ERA5), 4-10 PM Eastern
//   waves + temp   -> nearest seaward NDBC buoy (same rules as live: waves within 80 km, temp within 40 km),
//                     read at 20:00 UTC (last reading in the 6 h before), like the afternoon live run
//   temp backup    -> MUR satellite (and the live "drop the buoy if it disagrees by more than 6F" check)
//   wave backup    -> Open-Meteo marine model, like live falls back to WaveWatch III
//   tide           -> NOAA hi/lo predictions, nearest station within 30 km, high tide 4-10 PM
//   no bait reports or clarity existed back then, so bait comes from the calendar and clarity is blank.
// Writes:
//   history/<beach>.csv  full rows, same columns as the live history (run_utc = "backfill")  -> stays private
//   past/<beach>.json    small per-beach file for the website's "this night in past years"   -> copied to public
// v2: satellite water temp now comes from a whole-coast MUR cache (sat/YYYY-MM.json), built one month per request, the same
//     0.2 degree grid the live job uses. v1 asked for a year per beach, which timed out, so ~1 in 3 beaches had no backup temp.
//     Beaches already done are patched from the cache (water temp filled, live 6F buoy check applied, score recomputed).
// Resumable: a beach whose CSV already exists is skipped, so if a run stops (time cap or the weather
// archive's daily limit) the next run picks up where it left off.
const fs = require('fs'), zlib = require('zlib');

const START = '2021-11-17', END = '2026-11-16';       // live history in the public repo starts 2026-11-17
const TIME_CAP_MIN = 300;                             // stop starting new beaches after 5 h (GitHub's limit is 6 h)
const DATA_URL = 'https://raw.githubusercontent.com/SharkLeashDevelopment/sharkleash-data/main/shark-data.json';
const TIDE_URL = 'https://raw.githubusercontent.com/SharkLeashDevelopment/sharkleash-data/main/tide-stations.json';
const UA = { 'User-Agent': 'SharkLeash history backfill (sharkleashfishing.com)' };
const T0 = Date.now();
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- copied verbatim from score.js (keep in sync) ---------------- */
var SPX={sk:{n:'Silky',t:[70,88]},bn:{n:'Blacknose',t:[70,88]},sb:{n:'Sandbar',t:[58,82]},st:{n:'Sand tiger',t:[55,76]},du:{n:'Dusky',t:[62,80]},bt:{n:'Blacktip',t:[68,86]},sp:{n:'Spinner',t:[68,86]},
  sn:{n:'Atlantic sharpnose',t:[66,88]},bo:{n:'Bonnethead',t:[68,90]},ft:{n:'Finetooth',t:[70,88]},bu:{n:'Bull',t:[70,92]},le:{n:'Lemon',t:[70,90]},
  ti:{n:'Tiger',t:[72,90]},nu:{n:'Nurse',t:[72,90]},sh:{n:'Scalloped hammerhead',t:[72,88]},gh:{n:'Great hammerhead',t:[72,88]},
  sm:{n:'Smooth dogfish',t:[50,72]},sd:{n:'Spiny dogfish',t:[40,64]}};
var PROT_ALL=['sb','st','du'],PROT_ST={FL:['le','ti','sh','gh']};
var SPOTS=[],SPM={},DEEP=[],BAN={},REG=[],LBAN=[],CLB=[],BAIT={},BAITN={},PARK={},PRIV={};
const NOFLY_MPH=25,NOFLY_CAP=40;
const DIRS=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
function km(a,b,c,d){var r=Math.PI/180,x=Math.sin((c-a)*r/2),y=Math.sin((d-b)*r/2);return 12742*Math.asin(Math.sqrt(x*x+Math.cos(a*r)*Math.cos(c*r)*y*y));}
function st(s){var m=/,\s*([A-Z]{2})$/.exec(s[0]);return m?m[1]:'';}
function brg(a,b,c,d){var r=Math.PI/180,y=Math.sin((d-b)*r)*Math.cos(c*r),x=Math.cos(a*r)*Math.sin(c*r)-Math.sin(a*r)*Math.cos(c*r)*Math.cos((d-b)*r);return (Math.atan2(y,x)/r+360)%360;}
var OCEAN_PIERS={LKWF1:1,MROS1:1,JMPN7:1,DUKN7:1};
function seaward(lat,lon,faces,p){if(faces==null||OCEAN_PIERS[p.id])return true;if(km(lat,lon,p.lat,p.lon)<=3)return true;var d=Math.abs(brg(lat,lon,p.lat,p.lon)-faces)%360;if(d>180)d=360-d;return d<=(/^\d{5}$/.test(String(p.id))?110:75);}
function lv(code,s,MO,rk){var rows=SPM[rk]||[];for(var i=0;i<rows.length;i++)if(rows[i][0]===code){var P=rows[i][1];if(code==='bu'&&rk==='FL'&&s[1]<27.6)P='222333333222';return +P.charAt(MO);}return 0;}
function score(s,w,wv,wt,dp,MO,rk,tide,brep){var b={};rk=rk||st(s);
  var v=w?w.avg:null;b.wind=v===null?10:v<5?10+3*v:v<=12?25:v>=29?0:Math.round(25*(29-v)/17);
  b.waves=wv==null?8:wv<1?9:wv<=3?15:wv<=5?Math.round(15-5*(wv-3)):wv<=6?3:0;
  b.temp=wt==null?8:(wt>=66&&wt<=82)?20:Math.max(0,Math.round(20-2*(wt<66?66-wt:wt-82)));
  var sum=0,got=[],prot=PROT_ALL.concat(PROT_ST[st(s)]||[]);(SPM[rk]||[]).forEach((r,ix)=>{var l=lv(r[0],s,MO,rk),sp=SPX[r[0]];if(!l||!sp)return;var fit=wt==null||(wt>=sp.t[0]&&wt<=sp.t[1]);if(!fit)return;sum+=l===3?3:l===2?2:0.5;got.push({n:sp.n,l:l,ix:ix,p:prot.indexOf(r[0])>=0});});
  got.sort((a,b)=>b.l-a.l||a.ix-b.ix);var list=got.filter(g=>g.l>=2).map(g=>g.n),maybe=got.filter(g=>g.l===1).map(g=>g.n),rel=got.filter(g=>g.p).map(g=>g.n);
  var bt=BAIT[rk]||BAIT[st(s)],bsum=0,blist=[];
  if(bt){bt.forEach((r,ix)=>{var l=+r[1].charAt(MO);if(!l)return;bsum+=l===3?3:l===2?2:0.5;if(l>=2)blist.push({n:BAITN[r[0]]||r[0],l:l,ix:ix});});
    blist.sort((a,c)=>c.l-a.l||a.ix-c.ix);
    var bf=Math.min(1,bsum/8),y=brep&&brep.counts?brep.counts.yes||0:0,nn=brep&&brep.counts?brep.counts.no||0:0;
    if((y>=2&&y>nn)||(brep&&brep.trusted==='yes'))bf=1;else if((nn>=2&&nn>y)||(brep&&brep.trusted==='no'))bf=0;
    b.sharks=Math.round(15*Math.min(1,sum/10));b.bait=Math.round(10*bf*b.temp/20);}
  else b.sharks=Math.round(25*Math.min(1,sum/10));
  var d=dp?dp.d10:'';b.deep=dp&&dp.c==='i'?12:!d?7:d.charAt(0)==='+'||+d>800?2:+d<=150?15:Math.round(15-10*Math.min(1,(+d-150)/450));
  b.front=w&&w.front?5:0;
  b.tide=tide&&tide.high?5:0;
  var tot=b.wind+b.waves+b.temp+b.sharks+(b.bait||0)+b.deep+b.front+b.tide;
  if(w&&w.avg>=NOFLY_MPH){b.nofly=1;tot=Math.min(tot,NOFLY_CAP);}
  return {b:b,tot:tot,list:list,maybe:maybe,rel:rel,bait:blist.map(x=>[x.n,x.l])};}
function loadSharedFrom(j){
  var C={high:'h',medium:'m',low:'l',inlet:'i'},f=v=>v==null?'':String(v).replace(/^>\s*/,'+');
  SPOTS=j.beaches.map(b=>[b.name+', '+b.state,b.lat,b.lon]);
  DEEP=j.beaches.map(b=>{var d=b.depth||{};return {d10:f(d.to10ftYd),c:C[d.confidence]||'m'};});
  SPM=Object.assign({},j.speciesByMonth||{},j.speciesByRegion||{});
  REG=j.beaches.map(b=>b.speciesRegion&&SPM[b.speciesRegion]?b.speciesRegion:b.state);
  LBAN=j.beaches.map(b=>b.localBan||'');
  CLB=j.beaches.map(b=>({faces:b.faces,clarityBase:b.clarityBase||0}));
  PARK={};PRIV={};j.beaches.forEach(b=>{var k=b.name+', '+b.state;if(b.noDrones)PARK[k]=b.noDrones;if(b.privateLaunch)PRIV[k]=1;});
  if(j.protected)PROT_ST=j.protected;
  BAIT=j.baitByRegion||{};BAITN={};(j.baitSpecies||[]).forEach(b=>{BAITN[b.code]=b.short||b.name;});
  BAN={};(j.states||[]).forEach(s=>{if(s.drone&&s.drone.status==='ban')BAN[s.ab]=1;});}
/* ------------------------------------------------------------------------------ */

async function get(u, as = 'json', tries = 4, timeoutMs = 120000) {
  let why = '';
  for (let k = 0; k < tries; k++) {
    try {
      const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(timeoutMs) });
      if (r.status === 404) return null;
      if (r.status === 429) {
        const t = await r.text();
        if (/daily/i.test(t)) throw Object.assign(new Error('Open-Meteo daily limit reached'), { daily: true });
        why = 'HTTP 429'; await sleep(65000); continue;
      }
      if (r.ok) return as === 'json' ? await r.json() : as === 'buf' ? Buffer.from(await r.arrayBuffer()) : await r.text();
      why = 'HTTP ' + r.status + ' ' + (await r.text().catch(() => '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    } catch (e) { if (e.daily) throw e; why = e.message; }
    await sleep(3000 * (k + 1));
  }
  throw new Error(why || 'failed');
}
const ymd = d => d.toISOString().slice(0, 10);
const DAYS = []; for (let d = new Date(START + 'T00:00:00Z'); ymd(d) <= END; d.setUTCDate(d.getUTCDate() + 1)) DAYS.push(ymd(d));
const Y0 = +START.slice(0, 4), Y1 = +END.slice(0, 4);
const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dirOf = deg => deg == null ? null : DIRS[Math.round(deg / 22.5) % 16];
/* the hour that starts 4 PM Eastern on a day, in UTC ms (handles daylight saving) */
function fourPmEt(day) {
  for (const off of [4, 5]) { const t = Date.parse(day + 'T' + String(16 + off).padStart(2, '0') + ':00:00Z');
    if (+new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }).format(t) % 24 === 16) return t; }
  return Date.parse(day + 'T21:00:00Z');
}
function lastIn(arr, t1, hours, pick) { // newest non-null value in (t1 - hours, t1]; arr sorted by time
  let lo = 0, hi = arr.length - 1, b = -1; const t0 = t1 - hours * 36e5;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m][0] <= t1) { b = m; lo = m + 1; } else hi = m - 1; }
  for (let k = b; k >= 0 && arr[k][0] >= t0; k--) { const v = pick(arr[k]); if (v != null) return v; }
  return null;
}

/* ---- wind: Open-Meteo ERA5 archive, one call per 0.25 degree cell (ERA5's own grid) ---- */
const cell = (lat, lon) => (Math.round(lat * 4) / 4) + ',' + (Math.round(lon * 4) / 4);
const OM = {};
async function windSeries(lat, lon) {
  const k = cell(lat, lon); if (OM[k]) return OM[k];
  const [a, o] = k.split(',');
  const j = await get('https://archive-api.open-meteo.com/v1/archive?latitude=' + a + '&longitude=' + o + '&start_date=' + START + '&end_date=' +
    ymd(new Date(Date.parse(END) + 2 * 864e5)) + '&hourly=temperature_2m,wind_speed_10m,wind_direction_10m&models=era5&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=GMT');
  if (!j || !j.hourly) throw new Error('no wind archive for ' + k);
  const H = j.hourly, idx = {}; H.time.forEach((t, i) => idx[Date.parse(t + ':00Z')] = i);
  await sleep(1500);
  return OM[k] = { H, idx };
}
function windDay(W, day) {
  const t0 = fourPmEt(day), i0 = W.idx[t0]; if (i0 == null) return null;
  const H = W.H, sp = [];
  for (let k = 0; k < 6; k++) { const v = H.wind_speed_10m[i0 + k]; if (v == null) return null; sp.push(Math.round(v)); }
  const tt = H.temperature_2m[i0]; let n = 0;
  for (let k = 0; k < 36; k++) { const t = H.temperature_2m[i0 + k], d = DIRS.indexOf(dirOf(H.wind_direction_10m[i0 + k])); if (t == null) continue; if ((d >= 13 || d <= 2) && tt - t >= 8) n++; }
  let before = true; for (let k = 0; k < 4; k++) { const d = DIRS.indexOf(dirOf(H.wind_direction_10m[i0 + k])); if (!(d >= 5 && d <= 11)) before = false; }
  return { avg: Math.round(sp.reduce((a, b) => a + b, 0) / 6), dir: dirOf(H.wind_direction_10m[i0]), front: n >= 2 && before, start: new Date(t0).toISOString() };
}

/* ---- buoys: NDBC station list + yearly/monthly/realtime files, cached per station ---- */
let STATIONS = [];
async function loadStations() {
  const x = await get('https://www.ndbc.noaa.gov/activestations.xml', 'text');
  STATIONS = [...x.matchAll(/<station\s+id="([^"]+)"\s+lat="([-\d.]+)"\s+lon="([-\d.]+)"/g)]
    .map(m => ({ id: m[1].toUpperCase(), lat: +m[2], lon: +m[3] })).filter(s => s.lat >= 24 && s.lat <= 45.5 && s.lon >= -98 && s.lon <= -66);
  console.log('NDBC stations in range: ' + STATIONS.length);
}
const BUOY = {};
function parseStd(txt, out) {
  const L = txt.split('\n'); if (!L.length) return;
  const h = L[0].replace('#', '').trim().split(/\s+/), I = n => h.indexOf(n);
  const iY = I('YY') >= 0 ? I('YY') : I('YYYY'), iW = I('WVHT'), iT = I('WTMP'), iMin = I('mm');
  L.forEach(l => { if (!l || l[0] === '#') return; const a = l.trim().split(/\s+/); if (a.length < 5) return;
    let y = +a[iY]; if (y < 100) y += 1900;
    const t = Date.UTC(y, +a[iY + 1] - 1, +a[iY + 2], +a[iY + 3], iMin >= 0 ? +a[iMin] : 0);
    const n = (v, bad) => v == null || v === 'MM' || +v >= bad ? null : +v;
    out.push([t, iW >= 0 ? n(a[iW], 99) : null, iT >= 0 ? n(a[iT], 999) : null]); });
}
async function buoySeries(id) {
  if (BUOY[id]) return BUOY[id];
  const rows = [], low = id.toLowerCase(), gz = async u => { const b = await get(u, 'buf', 2).catch(() => null); if (!b) return ''; try { return zlib.gunzipSync(b).toString(); } catch (e) { return b.toString(); } };
  for (let y = Y0; y <= Y1; y++) parseStd(await gz('https://www.ndbc.noaa.gov/data/historical/stdmet/' + low + 'h' + y + '.txt.gz'), rows);
  // the current year's months that are not in a yearly file yet
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], CODE = '123456789abc';
  const have = new Set(rows.map(r => new Date(r[0]).toISOString().slice(0, 7)));
  for (let m = 0; m < 12; m++) { const ym = Y1 + '-' + String(m + 1).padStart(2, '0'); if (ym > END.slice(0, 7) || have.has(ym)) continue;
    parseStd(await gz('https://www.ndbc.noaa.gov/data/stdmet/' + MON[m] + '/' + low + CODE[m] + Y1 + '.txt.gz'), rows); }
  parseStd((await get('https://www.ndbc.noaa.gov/data/realtime2/' + id + '.txt', 'text', 2).catch(() => '')) || '', rows);
  const M = {}; rows.forEach(r => { M[r[0]] = r; });
  return BUOY[id] = Object.values(M).sort((a, b) => a[0] - b[0]);
}

/* ---- MUR satellite water temp: whole-coast cache, one file per month (same grid as the live job) ---- */
const SAT_DIR = 'sat', SAT_KEEP_KM = 40;
let NEED = null;                       // grid cells within 40 km of any beach
const cellKey = (la, lo) => la.toFixed(2) + ',' + lo.toFixed(2);
function needCell(la, lo) {
  const k = cellKey(la, lo); if (k in NEED) return NEED[k];
  return NEED[k] = SPOTS.some(s => km(s[1], s[2], la, lo) <= SAT_KEEP_KM);
}
const MONTHS = (() => { const out = []; let y = +START.slice(0, 4), m = +START.slice(5, 7);
  while (y * 100 + m <= +END.slice(0, 4) * 100 + +END.slice(5, 7)) { out.push(y + '-' + String(m).padStart(2, '0')); if (++m > 12) { m = 1; y++; } } return out; })();
async function buildSatCache() {
  fs.mkdirSync(SAT_DIR, { recursive: true }); NEED = {};
  let built = 0;
  for (const ym of MONTHS) {
    const f = SAT_DIR + '/' + ym + '.json'; if (fs.existsSync(f)) continue;
    if ((Date.now() - T0) / 60000 > TIME_CAP_MIN) { console.log('Time cap reached while building the satellite cache.'); return false; }
    const y = +ym.slice(0, 4), m = +ym.slice(5, 7), last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    let a = ym + '-01', b = ym + '-' + String(last).padStart(2, '0'); if (a < START) a = START; if (b > END) b = END;
    const t0 = Date.now(), cells = {}, days = {};
    /* about 10 days per request (smaller answers), coastwatch first, then the upwell mirror */
    const spans = []; for (let d = new Date(a + 'T00:00:00Z'); ymd(d) <= b; d.setUTCDate(d.getUTCDate() + 10)) {
      const e = new Date(d); e.setUTCDate(e.getUTCDate() + 9); spans.push([ymd(d), ymd(e) > b ? b : ymd(e)]); }
    let ok = true;
    for (const [x, y] of spans) {
      const q = 'analysed_sst[(' + x + 'T09:00:00Z):1:(' + y + 'T09:00:00Z)][(24.4):20:(45)][(-98):20:(-66.5)]';
      let txt = null, why = [];
      for (const host of ['https://coastwatch.pfeg.noaa.gov', 'https://upwell.pfeg.noaa.gov']) {
        txt = await get(host + '/erddap/griddap/jplMURSST41F.csv?' + encodeURIComponent(q), 'text', 2, 300000).catch(e => { why.push(host.split('//')[1].split('.')[0] + ': ' + e.message); return null; });
        if (txt) break;
        if (txt === null && !why.length) why.push(host.split('//')[1].split('.')[0] + ': HTTP 404 (no data)');
      }
      if (!txt) { console.log('Satellite ' + x + ' to ' + y + ' failed: ' + why.join(' | ')); ok = false; break; }
      txt.split('\n').slice(2).forEach(l => { const p = l.split(','); if (p.length < 4) return;
        const v = parseFloat(p[3]); if (isNaN(v)) return; const la = +p[1], lo = +p[2]; if (!needCell(la, lo)) return;
        const k = cellKey(la, lo), d = p[0].slice(0, 10); (days[d] = days[d] || {})[k] = Math.round(v * 10) / 10; cells[k] = 1; });
    }
    if (!ok) { console.log('Satellite ' + ym + ': not saved (will retry next run)'); if (built === 0 && MONTHS.indexOf(ym) < 2) { console.log('Satellite source is failing; stopping the cache for this run.'); return false; } continue; }
    fs.writeFileSync(f, JSON.stringify({ days }));
    built++; console.log('Satellite ' + ym + ': ' + Object.keys(days).length + ' days, ' + Object.keys(cells).length + ' cells (' + Math.round((Date.now() - t0) / 1000) + 's)');
  }
  console.log('Satellite cache: ' + built + ' months added, ' + MONTHS.filter(ym => fs.existsSync(SAT_DIR + '/' + ym + '.json')).length + ' of ' + MONTHS.length + ' ready');
  return MONTHS.every(ym => fs.existsSync(SAT_DIR + '/' + ym + '.json'));
}
let SAT = null;
function loadSat() { if (SAT) return SAT; SAT = {}; MONTHS.forEach(ym => { const f = SAT_DIR + '/' + ym + '.json'; if (fs.existsSync(f)) Object.assign(SAT, JSON.parse(fs.readFileSync(f, 'utf8')).days); }); return SAT; }
/* per day: the nearest grid cell within 40 km that has a reading (live job: near(S, 40 km)) */
function satSeries(lat, lon) {
  const S = loadSat(), cand = {};
  const out = {};
  for (const d in S) { let best = null, bd = 1e9; for (const k in S[d]) {
      let dist = cand[k]; if (dist === undefined) { const [la, lo] = k.split(',').map(Number); dist = cand[k] = km(lat, lon, la, lo); }
      if (dist <= SAT_KEEP_KM && dist < bd) { bd = dist; best = S[d][k]; } }
    if (best != null) out[d] = [best, bd]; }
  return out;
}

/* ---- patch beaches done before v2: fill water temp from the cache, apply the live 6F buoy check, re-score changed rows ---- */
function csvSplit(l) { const out = []; let cur = '', q = false; for (let i = 0; i < l.length; i++) { const c = l[i];
    if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; }
  out.push(cur); return out; }
function patchBeach(i) {
  const s = SPOTS[i], name = s[0], f = 'history/' + slug(name) + '.csv'; if (!fs.existsSync(f)) return null;
  const sat = satSeries(s[1], s[2]), L = fs.readFileSync(f, 'utf8').split('\n'), H = csvSplit(L[0]), I = n => H.indexOf(n);
  const pf = 'past/' + slug(name) + '.json', past = fs.existsSync(pf) ? JSON.parse(fs.readFileSync(pf, 'utf8')) : null;
  let filled = 0, swapped = 0;
  const rows = L.slice(1).filter(Boolean).map(l => { const r = csvSplit(l), day = r[I('date')], sx = sat[day] ? sat[day][0] : null;
    const old = r[I('water_f')] === '' ? null : +r[I('water_f')]; let wt = old;
    if (sx != null && old == null) { wt = sx; filled++; } else if (sx != null && Math.abs(old - sx) > 6) { wt = sx; swapped++; }
    if (wt === old) return l;
    const w = { avg: +r[I('wind_mph')], front: r[I('front')] === '1' }, wv = r[I('waves_ft')] === '' ? null : +r[I('waves_ft')];
    const sc = score(s, w, wv, wt, DEEP[i], +day.slice(5, 7) - 1, REG[i], { high: r[I('tide_high')] || null }, null), b = sc.b;
    r[I('score')] = sc.tot; r[I('raw')] = sc.tot; r[I('water_f')] = rd(wt, 0);
    ['wind', 'waves', 'temp', 'sharks', 'bait', 'deep', 'front', 'tide'].forEach(k => { r[I('pts_' + k)] = b[k]; });
    r[I('sharks_running')] = sc.list.join('; '); r[I('bait_running')] = sc.bait.map(x => x[0]).join('; ');
    if (past && past.days[day]) { past.days[day][0] = sc.tot; past.days[day][4] = Math.round(wt); }
    return r.map(q).join(','); });
  fs.writeFileSync(f, [L[0]].concat(rows).join('\n') + '\n');
  if (past) fs.writeFileSync(pf, JSON.stringify(past));
  const miss = rows.filter(l => csvSplit(l)[I('water_f')] === '').length;
  console.log('Patched ' + name + ': ' + filled + ' temps filled, ' + swapped + ' buoy temps replaced (6F off the satellite), ' + miss + ' days still without a temp');
  return true;
}

/* ---- backup waves: Open-Meteo marine model, nearest sea cell ---- */
const MAR = {};
async function marineSeries(lat, lon) {
  const k = cell(lat, lon); if (MAR[k] !== undefined) return MAR[k];
  const [a, o] = k.split(',');
  const j = await get('https://marine-api.open-meteo.com/v1/marine?latitude=' + a + '&longitude=' + o + '&start_date=' + START + '&end_date=' + END + '&hourly=wave_height&cell_selection=sea&timezone=GMT').catch(e => { if (e.daily) throw e; return null; });
  await sleep(1500);
  if (!j || !j.hourly) return MAR[k] = null;
  const idx = {}; j.hourly.time.forEach((t, i) => idx[Date.parse(t + ':00Z')] = i);
  return MAR[k] = { v: j.hourly.wave_height, idx };
}

/* ---- tides: hi/lo predictions per station per year ---- */
let TST = []; const TIDE = {};
async function tideSeries(stn) {
  if (TIDE[stn.id]) return TIDE[stn.id];
  const P = [];
  for (let y = Y0; y <= Y1; y++) {
    const j = await get('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&interval=hilo&datum=MLLW&time_zone=gmt&units=english&format=json&application=SharkLeash&station=' + stn.id + '&begin_date=' + y + '0101&end_date=' + y + '1231', 'json', 2).catch(() => null);
    (j && j.predictions || []).forEach(p => P.push({ t: Date.parse(p.t.replace(' ', 'T') + 'Z'), type: p.type }));
  }
  return TIDE[stn.id] = P;
}

const HDR = 'date,beach,score,raw,wind_mph,wind_dir,front,waves_ft,water_f,clarity,tide_high,pts_wind,pts_waves,pts_temp,pts_sharks,pts_bait,pts_deep,pts_front,pts_tide,sharks_running,bait_running,flagged,run_utc';
const q = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }, rd = (v, n) => v == null || isNaN(v) ? '' : (+v).toFixed(n);

async function doBeach(i) {
  const s = SPOTS[i], [name, lat, lon] = s, fc = CLB[i] && CLB[i].faces, stt = st(s);
  const W = await windSeries(lat, lon);
  // candidate buoys, nearest first, that pass the live seaward rule
  const cand = STATIONS.filter(p => seaward(lat, lon, fc, p)).map(p => Object.assign({ d: km(lat, lon, p.lat, p.lon) }, p)).filter(p => p.d <= 80).sort((a, b) => a.d - b.d);
  const series = []; for (const p of cand) series.push({ p, rows: await buoySeries(p.id) });
  const sat = satSeries(lat, lon);
  const tst = (() => { let b = null, bd = 1e9; TST.forEach(t => { const d = km(lat, lon, t.lat, t.lon); if (d < bd) { bd = d; b = t; } }); return bd <= 30 ? b : null; })();
  const tides = tst ? await tideSeries(tst) : null;
  let mar = null, needMar = false;
  const flag = LBAN[i] ? 'x' : BAN[stt] ? 'x' : PARK[name] && !PRIV[name] ? 'x' : '';
  const rows = [], past = {}, src = { buoyWv: 0, modelWv: 0, buoyWt: 0, satWt: 0, noWt: 0, noWind: 0 };
  for (const day of DAYS) {
    const w = windDay(W, day); if (!w) { src.noWind++; continue; }
    const t1 = Date.parse(day + 'T20:00:00Z'), MO = +day.slice(5, 7) - 1;
    let wv = null, wt = null, bt = null;
    for (const x of series) { const v = lastIn(x.rows, t1, 6, r => r[1]); if (v != null) { wv = v * 3.28084; break; } }
    for (const x of series) { if (x.p.d > 40) break; const v = lastIn(x.rows, t1, 6, r => r[2]); if (v != null) { bt = v * 9 / 5 + 32; break; } }
    const sx = sat[day] ? sat[day][0] : null;
    if (bt != null && sx != null && Math.abs(bt - sx) > 6) bt = null;      // live rule: buoy disagrees with satellite by 6F+
    wt = bt != null ? bt : sx;
    if (wv != null) src.buoyWv++;
    else { if (!needMar) { needMar = true; mar = await marineSeries(lat, lon); }
      const k = mar && mar.idx[t1]; if (k != null && mar.v[k] != null) { wv = mar.v[k] * 3.28084; src.modelWv++; } }
    if (bt != null) src.buoyWt++; else if (sx != null) src.satWt++; else src.noWt++;
    const ts = Date.parse(w.start), hi = tides && tides.find(p => p.type === 'H' && p.t >= ts && p.t <= ts + 6 * 36e5);
    const tide = tst ? { station: tst.name, high: hi ? new Date(hi.t).toISOString() : null } : null;
    const sc = score(s, w, wv, wt, DEEP[i], MO, REG[i], tide, null), b = sc.b;
    rows.push([day, name, sc.tot, sc.tot, w.avg, w.dir, w.front ? 1 : 0, rd(wv, 1), rd(wt, 0), '', tide && tide.high ? tide.high : '',
      b.wind, b.waves, b.temp, b.sharks, b.bait, b.deep, b.front, b.tide, sc.list.join('; '), sc.bait.map(x => x[0]).join('; '), flag ? 1 : 0, 'backfill'].map(q).join(','));
    past[day] = [sc.tot, w.avg, w.dir, wv == null ? null : Math.round(wv * 10) / 10, wt == null ? null : Math.round(wt), tide && tide.high ? 1 : 0];
  }
  fs.mkdirSync('history', { recursive: true }); fs.mkdirSync('past', { recursive: true });
  fs.writeFileSync('history/' + slug(name) + '.csv', [HDR].concat(rows).join('\n') + '\n');
  fs.writeFileSync('past/' + slug(name) + '.json', JSON.stringify({ beach: name, source: 'backfill', from: START, to: END,
    fields: ['score', 'wind_mph', 'wind_dir', 'waves_ft', 'water_f', 'high_tide_in_window'], days: past }));
  const avg = rows.length ? Math.round(Object.values(past).reduce((a, x) => a + x[0], 0) / rows.length) : 0;
  console.log(name + ': ' + rows.length + ' days, avg ' + avg + ' | waves buoy ' + src.buoyWv + ' / model ' + src.modelWv + ' | temp buoy ' + src.buoyWt + ' / satellite ' + src.satWt + ' / none ' + src.noWt +
    (cand.length ? ' | buoys ' + cand.slice(0, 3).map(p => p.id + ' ' + Math.round(p.d) + 'km').join(', ') : ' | no buoy in range') + (tst ? ' | tide ' + tst.id : ' | no tide station'));
}

(async function () {
  const j = await get(DATA_URL); loadSharedFrom(j);
  TST = ((await get(TIDE_URL)).stations || []).map(x => ({ id: x[0], name: x[1], lat: x[2], lon: x[3] }));
  await loadStations();
  const only = (process.env.ONLY || '').trim().toLowerCase();
  // group beaches by weather cell so each archive call is used for all its beaches in the same run
  const order = SPOTS.map((s, i) => i).filter(i => !only || SPOTS[i][0].toLowerCase().includes(only))
    .sort((a, b) => cell(SPOTS[a][1], SPOTS[a][2]).localeCompare(cell(SPOTS[b][1], SPOTS[b][2])));
  const satReady = await buildSatCache();
  const patched = fs.existsSync(SAT_DIR + '/patched.json') ? JSON.parse(fs.readFileSync(SAT_DIR + '/patched.json', 'utf8')) : [];
  if (satReady) {
    SPOTS.forEach((s, i) => { if (patched.indexOf(s[0]) >= 0) return; if (patchBeach(i)) patched.push(s[0]); });
    fs.writeFileSync(SAT_DIR + '/patched.json', JSON.stringify(patched));
  } else console.log('Satellite cache not finished: scoring beaches without the satellite backup for now; they get patched once the cache is complete.');
  let done = 0, skipped = 0, failed = [];
  for (const i of order) {
    const name = SPOTS[i][0];
    if (!only && fs.existsSync('history/' + slug(name) + '.csv')) { skipped++; continue; }
    if ((Date.now() - T0) / 60000 > TIME_CAP_MIN) { console.log('Time cap reached; the next run continues from here.'); break; }
    try { await doBeach(i); done++; if (satReady) { patched.push(name); fs.writeFileSync(SAT_DIR + '/patched.json', JSON.stringify(patched)); } }
    catch (e) {
      if (e.daily) { console.log('Weather archive daily limit reached after ' + done + ' beaches; the next run continues from here.'); break; }
      console.log(name + ': FAILED (' + e.message + ')'); failed.push(name);
    }
  }
  const left = SPOTS.filter(s => !fs.existsSync('history/' + slug(s[0]) + '.csv')).length;
  console.log('\nThis run: ' + done + ' beaches done, ' + skipped + ' already done, ' + failed.length + ' failed. Beaches still to do: ' + left + ' of ' + SPOTS.length + '.');
  fs.writeFileSync('progress.json', JSON.stringify({ updated: new Date().toISOString(), done: SPOTS.length - left, total: SPOTS.length, satelliteMonths: MONTHS.filter(ym => fs.existsSync(SAT_DIR + '/' + ym + '.json')).length + ' of ' + MONTHS.length, patched: patched.length, failed }, null, 1));
})().catch(e => { console.error('Backfill stopped: ' + e.message); process.exit(1); });
