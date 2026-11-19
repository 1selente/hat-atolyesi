// Deterministic, bounded optional extension to the classic simulation.
// No request-time service or paid data is needed.
import {modes,vehicleModels} from './cities.js'

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x))
const finite=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b
const integer=(x,a,b)=>Number.isInteger(x)&&finite(x,a,b)
const record=x=>x&&typeof x==='object'&&!Array.isArray(x)
const suppliers={budget:1.25,balanced:1,premium:.8}
const random=(day,id)=>{let h=day|0;for(const c of String(id))h=Math.imul(h^c.charCodeAt(0),16777619);h^=h>>>16;h=Math.imul(h,0x45d9f3b);return (h>>>0)/4294967296}
export const SHIFT_NAMES=['Sabah 06–12','Öğle 12–18','Akşam 18–24']
export const COMPLAINT_NAMES={crowding:'Aşırı doluluk',waiting:'Uzun bekleme',breakdown:'Araç arızası',access:'Erişilebilirlik',cleaning:'Temizlik',coverage:'Ulaşım eksikliği',security:'Güvenlik / istasyon hizmeti'}
export const ROAD_CLASSES={local:'Yerel cadde',arterial:'Ana arter',priority:'Ayrılmış otobüs yolu'}
export const shiftIndex=hour=>hour===undefined?0:clamp(Math.floor((hour-6)/6),0,2)

export function roster(line,day=1){
  const p=line.operations??{},known=Array.isArray(line.units)?line.units:[],normal=known.filter(u=>!u.reserve).slice(0,line.fleet),reserve=known.filter(u=>u.reserve).slice(0,p.spare??0)
  let next=Math.max(line.nextUnit??1,...known.map(u=>u.number+1),1)
  const add=(arr,count,isReserve)=>{while(arr.length<count)arr.push({number:next++,reserve:isReserve,wear:known.length||isReserve?0:p.wear??0,km:known.length||isReserve?0:(p.km??0)/Math.max(1,line.fleet),supplier:p.supplier??'balanced',acquired:day,failedUntil:!known.length&&!arr.length&&!isReserve?p.failedUntil??0:0,maintenanceUntil:!known.length&&!arr.length&&!isReserve?p.maintenanceUntil??0:0,lastService:day})}
  add(normal,line.fleet,false);add(reserve,p.spare??0,true)
  return [...normal,...reserve]
}
export function syncRoster(line,day,delivery={}){
  const existing=new Set((line.units??[]).map(u=>u.number)),had=Array.isArray(line.units)
  const units=roster(line,day)
  if(had)for(const u of units)if(!existing.has(u.number)){u.wear=delivery.used?45:0;u.supplier=delivery.supplier??line.operations?.supplier??'balanced'}
  line.units=units;line.nextUnit=Math.max(line.nextUnit??1,...units.map(u=>u.number+1),1)
  return units
}
export function syncCondition(line,day){
  const units=syncRoster(line,day),p=line.operations??={}
  p.wear=units.length?units.reduce((n,u)=>n+u.wear,0)/units.length:0
  p.km=units.reduce((n,u)=>n+u.km,0)
  p.failedUntil=Math.max(0,...units.map(u=>u.failedUntil))
  p.maintenanceUntil=Math.max(0,...units.map(u=>u.maintenanceUntil))
}
export const unitStatus=(unit,day)=>unit.maintenanceUntil>day?'Bakımda':unit.failedUntil>day?'Arızalı':unit.reserve?'Yedek':'Hazır'
export function availableUnits(line,day){
  if(!line.units)return null
  const ready=roster(line,day).filter(u=>u.failedUntil<=day&&u.maintenanceUntil<=day)
  return Math.min(line.fleet,ready.length)
}
export function shiftPlan(state){const c=state.company,drivers=c.staff.driver;return c.shifts??[drivers,drivers,drivers]}
export function setShifts(state,values){
  if(!Array.isArray(values)||values.length!==3||!values.every(x=>integer(x,0,10000))||values.reduce((a,b)=>a+b,0)>state.company.staff.driver)return false
  state.company.shifts=[...values];return true
}
export function setLineShifts(state,line,values){
  if(!Array.isArray(values)||values.length!==3||!values.every(x=>integer(x,0,40)))return false
  line.shiftLimit=[...values];return true
}
export function driverCapacity(state,line,hour,isOperating){
  const slot=shiftIndex(hour),pool=shiftPlan(state)[slot]
  const cap=l=>{const p=l.operations??{},schedule=(state.day-1)%7>=5?p.weekendSchedule??p.schedule:p.schedule;if(hour!==undefined&&schedule?.[hour-6]===0)return 0;return Math.min(l.fleet,l.shiftLimit?.[slot]??40,availableUnits(l,state.day)??l.fleet)}
  const assigned=state.lines.filter(l=>l.number<line.number&&isOperating(l,state.day)).reduce((n,l)=>n+cap(l),0)
  return Math.min(cap(line),Math.max(0,pool-assigned))
}
export function maintainUnit(state,line,number,repair=false){
  const units=roster(line,state.day),u=units.find(u=>u.number===number),p=line.operations??{}
  if(!u||u.maintenanceUntil>state.day||repair&&u.failedUntil<=state.day)return false
  const depot=state.depots.find(d=>d.id===p.depot),workshops=depot?(depot.facility?.workshop??1):state.depots.reduce((n,d)=>n+(d.facility?.workshop??1),0)
  if(state.company.realism){
    const active=state.lines.reduce((n,l)=>n+roster(l,state.day).filter(u=>u.maintenanceUntil>state.day).length,0)
    if(active>=Math.min(state.company.staff.maintenance,workshops*4))return false
  }
  const cost=Math.ceil((repair?12:5)+u.wear*(repair?.3:.15))
  if(state.cash<cost)return false
  syncRoster(line,state.day);const target=line.units.find(x=>x.number===number)
  target.wear=Math.max(0,target.wear-(repair?25:55));target.failedUntil=0;target.maintenanceUntil=state.day+(repair?2:1);target.lastService=state.day
  state.cash-=cost;syncCondition(line,state.day);return cost
}
export function advanceUnits(state,line,result,km){
  const units=syncRoster(line,state.day),ready=units.filter(u=>u.failedUntil<=state.day&&u.maintenanceUntil<=state.day).sort((a,b)=>Number(a.reserve)-Number(b.reserve)||a.km-b.km||a.number-b.number)
  const regular=ready.filter(u=>!u.reserve),reserve=ready.filter(u=>u.reserve),operated=new Set()
  for(const [i,slice] of (result?.bySlice??[]).entries()){
    if(!slice.capacity||!ready.length)continue
    const n=Math.min(slice.available??line.fleet,ready.length);if(!n)continue
    const normalCount=Math.min(n,regular.length),active=Array.from({length:normalCount},(_,j)=>regular[(i+j)%regular.length]);active.push(...Array.from({length:n-normalCount},(_,j)=>reserve[(i+j)%reserve.length]))
    const distance=Math.min(modes[line.mode].speed*vehicleModels[line.model].speed,km*60/Math.max(slice.interval,1)*(line.operations?.ring&&line.operations?.oneway?1:2)/n)
    for(const u of active){operated.add(u.number);u.km=Math.min(1e12,u.km+distance);u.wear=clamp(u.wear+distance*.006*suppliers[u.supplier],0,100)}
  }
  for(const u of ready)if(operated.has(u.number)&&u.wear>25&&random(state.day,line.id+':'+u.number)<(u.wear/100)**2*.12)u.failedUntil=state.day+2+Math.floor(random(state.day+1,u.number)*3)
  syncCondition(line,state.day)
}

const stages=[['Etüt ve proje',.08],['Kamulaştırma',.12],['Kazı / temel',.23],['Ray ve altyapı',.23],['Elektrifikasyon',.10],['İstasyon donanımı',.14],['Test ve kabul',.10]]
export function newConstruction(day,days,cost){return {start:day,total:Math.max(1,days),done:0,crew:1,paused:false,budget:Math.max(0,cost),extra:0,delays:0}}
export function constructionDetails(line,day){
  const j=line.construction??newConstruction(Math.max(1,line.operations?.started||day),Math.max(1,line.readyAt-(line.operations?.started||day)),0)
  const ratio=line.readyAt<=day?1:clamp(line.construction?j.done/j.total:(day-j.start)/j.total,0,1)
  let offset=0;const tasks=stages.map(([name,share])=>{const progress=clamp((ratio-offset)/share,0,1);offset+=share;return {name,progress:Math.round(progress*100)}})
  return {...j,ratio,tasks,active:tasks.find(t=>t.progress<100)?.name??'Açılış'}
}
export function setConstruction(state,line,crew,paused){
  if(line.readyAt<=state.day||!integer(crew,1,3)||typeof paused!=='boolean')return false
  if(!line.construction){const start=Math.min(state.day,line.operations?.started||state.day);line.construction=newConstruction(start,line.readyAt-start,0);line.construction.done=state.day-start}
  line.construction.crew=crew;line.construction.paused=paused;return true
}
export function accelerateConstruction(state,line){
  if(line.readyAt<=state.day||state.cash<40)return false
  if(line.construction){const j=line.construction;j.done=Math.min(j.total,j.done+1);j.extra+=40;line.readyAt=state.day+Math.max(1,Math.ceil(j.total-j.done))}
  else line.readyAt=Math.max(state.day+1,line.readyAt-1)
  state.cash-=40;return true
}
export function advanceConstruction(state,line){
  if(!line.construction&&line.readyAt>state.day){const start=Math.min(state.day,line.operations?.started||state.day);line.construction=newConstruction(start,line.readyAt-start,0);line.construction.done=state.day-start}
  const j=line.construction;if(!j)return
  if(line.readyAt<=state.day){j.done=j.total;return}
  let progress=1,cost=0
  if(j.paused){progress=0}
  else if(state.company.realism){
    const weather=state.company.weather,structure=line.operations?.structure
    const underground=['tunnel','underwater'].includes(structure)||(line.mode==='metro'&&line.depth>10)
    const factor=weather==='storm'?(underground?.8:.45):weather==='snow'?.7:weather==='rain'?.85:1
    cost=(j.crew-1)*8;progress=factor*(1+(j.crew-1)*.4)
    if(state.cash<cost){cost=0;progress=factor}
    if(progress<1)j.delays++
  }
  state.cash-=cost;j.extra+=cost;j.done=Math.min(j.total,j.done+progress)
  line.readyAt=state.day+1+Math.ceil(Math.max(0,j.total-j.done))
  return cost
}

// Hourly, configurable simulated road congestion based on route density and the
// number of overlapping bus stops, not a claim about live traffic measurements.
export function roadTraffic(state,line,hour){
  if(!state.company.realism||!['bus','localbus'].includes(line.mode))return 1
  const peak=[.8,1.25,1.45,1.35,1.12,1.05,1.02,1.05,1.07,1.18,1.36,1.48,1.39,1.16,.95,.84,.76,.70][hour===undefined?6:clamp(hour-6,0,17)]
  const cls=line.roadClass??'arterial',factor={local:1.24,arterial:1,priority:.68}[cls]
  const ids=new Set(line.stops),overlap=state.lines.filter(l=>l.id!==line.id&&['bus','localbus'].includes(l.mode)&&l.readyAt<=state.day&&l.fleet>0&&!l.operations?.closed&&l.stops.some(s=>ids.has(s))).length
  const points=state.stations.filter(s=>ids.has(s.id)).map(s=>s.position)
  const population=(state.company.customDistricts??[]).filter(d=>d.population>0&&points.some(p=>Math.hypot((p[0]-d.lng)*Math.cos(d.lat*Math.PI/180),p[1]-d.lat)<.015)).reduce((n,d)=>n+d.population,0)
  return clamp(1+(peak-1)*factor+Math.min(.45,overlap*.035)+Math.min(.2,population/500000)*(cls==='priority'?.3:1)+(cls==='local'?.12:cls==='priority'?-.15:0),.65,2.4)
}
export function complaintsFor(state,projection){
  const reports=[]
  const push=(kind,target,label,count)=>{const n=Math.round(count);if(n>0)reports.push({kind,target,label,count:n})}
  for(const l of state.lines){const r=projection.results[l.id];if(!r)continue
    push('crowding',l.id,l.name,Math.max(0,r.boards-r.served)*.035)
    push('waiting',l.id,l.name,r.bySlice.reduce((n,s)=>n+(s.interval>15&&s.capacity>0?s.served*(s.interval-15)/600:0),0))
    push('breakdown',l.id,l.name,roster(l,state.day).filter(u=>u.failedUntil>state.day).length*8)
    if(state.company.realism)push('cleaning',l.id,l.name,Math.max(0,l.fleet-state.company.staff.cleaning/Math.max(1,state.lines.length)*5)*2)
  }
  for(const s of state.stations){const load=projection.stops[s.id]??0;if((s.facility?.accessibility??0)<1)push('access',s.id,s.name,load*.0015);if(state.company.realism&&state.company.staff.security*5<state.stations.length)push('security',s.id,s.name,load*.001)}
  for(const d of projection.districts??[])if(!d.stop)push('coverage',d.name,d.name,d.weight*.6)
  return reports.sort((a,b)=>b.count-a.count).slice(0,50)
}
export function settleComplaints(state,projection){
  const c=state.company,old=c.complaints??[],current=complaintsFor(state,projection),active=new Set(current.map(x=>x.kind+'|'+x.target))
  for(const x of old)if(x.status==='open'&&!active.has(x.kind+'|'+x.target)){x.status='resolved';x.closedDay=state.day}
  for(const x of current){let row=old.find(o=>o.status==='open'&&o.kind===x.kind&&o.target===x.target);if(row){row.count=x.count;row.lastDay=state.day;row.label=x.label}else old.push({...x,id:Math.max(0,...old.map(o=>o.id))+1,firstDay:state.day,lastDay:state.day,status:'open',closedDay:0})}
  c.complaints=old.slice(-200)
  const total=current.reduce((n,x)=>n+x.count,0)
  if(c.realism&&projection.riders>0)c.reputation=clamp(c.reputation-Math.min(4,total/Math.max(1,projection.riders)*100),0,100)
}

export function neighborhoodRows(dataset,city,bounds,limit,occupied){
  if(!Array.isArray(dataset?.cities?.[city])||!integer(limit,1,100))return []
  const [w,s,e,n]=bounds,existing=new Set(occupied),rows=[]
  for(const row of dataset.cities[city]){
    if(!Array.isArray(row)||row.length!==6)continue
    const [code,name,district,population,lng,lat]=row
    if(!integer(code,1,1e9)||typeof name!=='string'||typeof district!=='string'||!integer(population,1,1e8)||!finite(lng,w,e)||!finite(lat,s,n))continue
    const label=(name+' / '+district).slice(0,48)
    if(existing.has(label))continue
    existing.add(label);rows.push({name:label,lng,lat,population,weight:Math.round(clamp(Math.sqrt(population/10000)*1.8,.3,5)*10)/10,kind:'home',source:'TÜİK ADNKS 2025 / OSM / Topografya (ODbL), kod '+code})
    if(rows.length>=limit)break
  }
  return rows
}

export function simplifyRoute(data,bounds){
  const coords=data?.type==='Feature'?data.geometry?.coordinates:data?.type==='LineString'?data.coordinates:data
  if(!Array.isArray(coords)||coords.length<2||coords.length>10000)return null
  const [w,s,e,n]=bounds
  if(!coords.every(p=>Array.isArray(p)&&p.length>=2&&finite(p[0],w,e)&&finite(p[1],s,n)))return null
  const p=coords.map(x=>x.slice(0,2)),chosen=[0,p.length-1]
  // Retain the most significant bends rather than taking arbitrary points.
  const deviation=(x,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x[0]-a[0])*dx+(x[1]-a[1])*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(x[0]-a[0]-t*dx,x[1]-a[1]-t*dy)}
  while(chosen.length<14&&chosen.length<p.length){let best=-1,score=0;for(let i=0;i<chosen.length-1;i++)for(let j=chosen[i]+1;j<chosen[i+1];j++){const d=deviation(p[j],p[chosen[i]],p[chosen[i+1]]);if(d>score){score=d;best=j}}if(best<0)break;chosen.push(best);chosen.sort((a,b)=>a-b)}
  return chosen.map(i=>p[i])
}
export function validUnitDetails(line,day){
  if(line.units!==undefined&&(!Array.isArray(line.units)||line.units.length!==line.fleet+(line.operations?.spare??0)||new Set(line.units.map(u=>u?.number)).size!==line.units.length||!line.units.every(u=>record(u)&&integer(u.number,1,1e9)&&typeof u.reserve==='boolean'&&finite(u.wear,0,100)&&finite(u.km,0,1e12)&&Object.hasOwn(suppliers,u.supplier)&&integer(u.acquired,1,day)&&integer(u.lastService,1,day)&&integer(u.failedUntil,0,1e8+1000)&&integer(u.maintenanceUntil,0,1e8+1000))||line.units.filter(u=>!u.reserve).length!==line.fleet))return false
  if(line.nextUnit!==undefined&&(!integer(line.nextUnit,1,1e9)||line.nextUnit<=Math.max(0,...(line.units??[]).map(u=>u.number))))return false
  if(line.shiftLimit!==undefined&&(!Array.isArray(line.shiftLimit)||line.shiftLimit.length!==3||!line.shiftLimit.every(n=>integer(n,0,40))))return false
  if(line.roadClass!==undefined&&!Object.hasOwn(ROAD_CLASSES,line.roadClass))return false
  const j=line.construction
  return j===undefined||record(j)&&integer(j.start,1,day)&&integer(j.total,1,100000)&&finite(j.done,0,j.total)&&integer(j.crew,1,3)&&typeof j.paused==='boolean'&&finite(j.budget,0,1e12)&&finite(j.extra,0,1e12)&&integer(j.delays,0,1e8)
}
export function validCompanyDetails(c,day){
  if(c.shifts!==undefined&&(!Array.isArray(c.shifts)||c.shifts.length!==3||!c.shifts.every(n=>integer(n,0,10000))||c.shifts.reduce((a,b)=>a+b,0)>c.staff.driver))return false
  const rows=c.complaints
  return rows===undefined||Array.isArray(rows)&&rows.length<=200&&new Set(rows.map(x=>x?.id)).size===rows.length&&rows.every(x=>record(x)&&integer(x.id,1,1e9)&&Object.hasOwn(COMPLAINT_NAMES,x.kind)&&typeof x.target==='string'&&x.target.length<=80&&typeof x.label==='string'&&x.label.length<=80&&integer(x.count,1,1e9)&&integer(x.firstDay,1,day)&&integer(x.lastDay,x.firstDay,day)&&['open','resolved'].includes(x.status)&&integer(x.closedDay,0,day)&&(x.status==='open'?x.closedDay===0:x.closedDay>=x.lastDay))
}
