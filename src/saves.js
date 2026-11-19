// Local save operations are synchronous, bounded and never discard a manual
// checkpoint to make space for automatic backups.
export const gameKey=city=>`hat-atolyesi:v1:${city}`
export const slotsKey=city=>`hat-atolyesi:slots:${city}`
export const recoveryKey=city=>`hat-atolyesi:recovery:${city}`
export const MAX_SLOTS=12
export const MAX_SAVE_BYTES=4_000_000
const validSlot=x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&typeof x.json==='string'&&Number.isInteger(x.day)&&x.day>=1&&typeof x.automatic==='boolean'
export function readSlots(storage,city){
  const raw=storage.getItem(slotsKey(city))
  if(raw===null)return []
  const rows=JSON.parse(raw)
  if(!Array.isArray(rows)||!rows.every(validSlot))throw Error('Kayıt yuvaları bozuk.')
  return rows
}
export function storeSlot(storage,city,entry){
  try{
    const before=readSlots(storage,city)
    // Replace only the automatic slot when saving another automatic checkpoint.
    const rows=entry.automatic?before.filter(x=>!x.automatic):before
    if(rows.length>=MAX_SLOTS)return {ok:false,reason:'full'}
    storage.setItem(slotsKey(city),JSON.stringify([entry,...rows]))
    return {ok:true}
  }catch{return {ok:false,reason:'storage'}}
}
export function removeSlot(storage,city,id){
  try{const rows=readSlots(storage,city);if(!rows.some(x=>x.id===id))return false;storage.setItem(slotsKey(city),JSON.stringify(rows.filter(x=>x.id!==id)));return true}catch{return false}
}
export function writeGame(storage,city,json,expected){
  try{if(storage.getItem(gameKey(city))!==expected)return {ok:false,reason:'conflict'};storage.setItem(gameKey(city),json);return {ok:true,raw:json}}catch{return {ok:false,reason:'storage'}}
}

export function recoverGame(storage,city,parse,newGame){
  let raw
  try{raw=storage.getItem(gameKey(city))}catch{return {state:newGame(city),raw:null,status:'unavailable',blocked:true}}
  if(raw===null)return {state:newGame(city),raw,status:'new',blocked:false}
  try{const state=parse(raw);if(state.city!==city)throw Error('City mismatch');return {state,raw,status:'loaded',blocked:false}}catch{}
  let recovered
  try{const rows=JSON.parse(storage.getItem(slotsKey(city))??'[]');if(Array.isArray(rows))for(const row of rows.filter(validSlot)){try{const state=parse(row.json);if(state.city===city){recovered=state;break}}catch{}}}catch{}
  // Keep the original bytes available for export, even if a fallback is used.
  let archived=false
  try{const existing=storage.getItem(recoveryKey(city));if(existing===null){storage.setItem(recoveryKey(city),raw);archived=true}else archived=existing===raw}catch{}
  return {state:recovered??newGame(city),raw,status:recovered?'recovered':'corrupt',blocked:!archived}
}
