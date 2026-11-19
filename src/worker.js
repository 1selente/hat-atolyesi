import { projectDay } from './model.js'

self.onmessage = ({data:{revision,state}}) => {
  try { self.postMessage({revision,projection:projectDay(state)}) }
  catch(error) { self.postMessage({revision,error:String(error)}) }
}
