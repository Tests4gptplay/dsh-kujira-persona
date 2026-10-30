import { ui } from './ui-messages.js'
import {toolActivity,toolCallIdOf,isUserQuestionTool} from './activity.js'
export const emptyTask=()=>({phase:'idle',activity:'idle',text:'等你开始',ui:ui('task.idle'),tool:'',progress:null,inputTokens:0,outputTokens:0,openTools:[],turnActive:false,waitingApproval:null,waitingApprovals:[],signal:0,pulse:null})
const activityText={searching:'正在查找和阅读',editing:'正在修改内容',commanding:'正在执行命令',testing:'正在检查结果','using-tool':'正在使用工具'}
function resume(task) {
  const pending=task.openTools??[],question=pending.find(tool=>tool.waiting)
  if(task.waitingApproval||question){task.phase='waiting';task.activity='waiting';task.text='等你确认';task.ui=ui('task.waiting');task.tool=question?.name??task.tool;task.toolUi=question?.ui??task.toolUi;return}
  const last=pending.at(-1)
  task.phase=last?'working':'thinking';task.activity=last?toolActivity(last.name):'thinking'
  task.tool=last?.name??'';task.toolUi=last?.ui??null;task.text=last?activityText[task.activity]:'正在整理结果';task.ui=ui(last?'task.'+task.activity:'task.organizing')
}
export function reduceTask(previous,event) {
  const data=event?.data??{},type=event?.type
  const task={...previous,openTools:[...(previous.openTools??[])],waitingApprovals:[...(previous.waitingApprovals??(previous.waitingApproval?[previous.waitingApproval]:[]))]}
  const signal=()=>{task.signal=(previous.signal??0)+1;task.pulse=null}
  switch(type){
    case 'turn/start':return {...emptyTask(),phase:'thinking',activity:'thinking',text:'正在思考',ui:ui('task.thinking'),turnActive:true,signal:(previous.signal??0)+1}
    // Presentation-only signal from the host's live assistant stream.
    case 'assistant/activity': {
      const activity=data.activity
      if(!['thinking','responding'].includes(activity)||!task.turnActive||task.openTools.length||task.waitingApproval)return previous
      if(task.phase===activity&&task.activity===activity)return previous
      signal();task.phase=activity;task.activity=activity;task.tool='';task.toolUi=null;task.text=activity==='responding'?'正在回复':'正在思考';task.ui=ui('task.'+activity);break
    }
    case 'step/start':
    case 'assistant/chunk':
      if(!task.turnActive||task.openTools.length||task.waitingApproval)return previous
      if(task.phase==='thinking')return previous
      signal();resume(task);break
    case 'tool/call':{
      signal();task.turnActive=true
      const name=String(data.name??data.message?.name??'工具')
      const id=toolCallIdOf(event)||('event-'+String(event.seq??task.signal))
      task.openTools=task.openTools.filter(tool=>tool.id!==id)
      task.openTools.push({id,name,ui:data.name==null&&data.message?.name==null?ui('task.tool'):null,waiting:isUserQuestionTool(name)})
      resume(task);break
    }
    case 'approval/asked':{
      const id=String(data.id??'approval')
      if(task.waitingApprovals.includes(id))return previous
      signal();task.waitingApprovals.push(id);task.waitingApproval=task.waitingApprovals[0];resume(task);break
    }
    case 'approval/decided':{
      const id=data.id==null?(task.waitingApprovals.length===1?task.waitingApprovals[0]:null):String(data.id)
      if(!task.waitingApprovals.includes(id))return previous
      signal();task.waitingApprovals=task.waitingApprovals.filter(value=>value!==id);task.waitingApproval=task.waitingApprovals[0]??null;resume(task);break
    }
    case 'user/message':
      // DSH also emits user-role workspace/skill notices. Only a human reply
      // may dismiss the question animation before its tool result arrives.
      if((data.source?.kind??data.message?.source?.kind)!=='user')return previous
      if(!task.openTools.some(tool=>tool.waiting))return previous
      signal();task.openTools=task.openTools.filter(tool=>!tool.waiting);resume(task);break
    case 'tool/result':{
      signal()
      const id=toolCallIdOf(event)
      task.openTools=id?task.openTools.filter(tool=>tool.id!==id):task.openTools.length===1?[]:task.openTools
      resume(task)
      // A failed step is a temporary reaction, not a permanently failed turn.
      if((data.error||data.message?.isError)&&task.phase!=='waiting')task.pulse={id:task.signal,kind:'error'}
      break
    }
    case 'assistant/message':
      if(!data.usage)return previous
      task.inputTokens+=Number(data.usage.inputTokens)||0
      task.outputTokens+=Number(data.usage.outputTokens)||0
      break
    case 'todo/write':{
      const todos=Array.isArray(data.todos)?data.todos:[]
      task.progress=todos.length?{done:todos.filter(t=>['completed','done'].includes(t.status)).length,total:todos.length}:null
      break
    }
    case 'turn/end':{
      const reason=data.reason?.kind??'completed'
      const phase=reason==='completed'?'completed':reason==='aborted'?'idle':reason==='blocked'?'waiting':'error'
      if(!task.turnActive&&task.phase===phase)return previous
      signal();task.turnActive=false;task.openTools=[];task.waitingApproval=null;task.waitingApprovals=[];task.tool='';task.toolUi=null
      task.phase=phase;task.activity=phase==='completed'?'idle':phase
      task.ui=ui({completed:'task.completed',idle:'task.stopped',waiting:'task.waiting',error:'task.error'}[phase]);task.text={completed:'做完啦',idle:'已停止',waiting:'等你确认',error:'这次遇到了问题'}[phase]
      if(phase==='completed')task.pulse={id:task.signal,kind:'success'}
      break
    }
    default:return previous
  }
  return task
}

