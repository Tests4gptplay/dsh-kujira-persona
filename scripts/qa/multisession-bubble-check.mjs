import test from 'node:test'
import assert from 'node:assert/strict'
const {PetController}=await import(process.env.PET_CONTROLLER??'../../pet/controller.js')
const session=id=>({header:{id,origin:'user',delegationDepth:0}})
const A=session('A'),B=session('B')
const ev=(c,s,type,data={})=>c.event(s,{type,data})
const choose=(c,s,model='gpt')=>c.select({sessionId:s.header.id,provider:'test',model})
const begin=(c,s)=>{ev(c,s,'turn/start',{turn:1});ev(c,s,'step/start',{turn:1,step:1})}
const tool=(c,s,name,id=s.header.id)=>ev(c,s,'tool/call',{name,callId:id})
const finish=(c,s,kind='completed')=>ev(c,s,'turn/end',{reason:{kind}})
const visible=c=>c.config.bubble!=='hidden'&&(c.config.bubble==='always'||c.task.phase!=='idle')
const make=async(extra={})=>{const c=new PetController({config:{enabled:true,bubble:'tasks',showUsage:false,showStats:false},...extra});await choose(c,A);return c}
const frame=(c,agent,type,revision,index,extra={})=>c.assistantFrame({agent,frame:{type,attemptId:'attempt',turn:1,step:1,revision,index,...extra}})

test('two working sessions survive 100 alternating selections with no new event',async()=>{
 const c=await make();begin(c,A);tool(c,A,'read_file');begin(c,B);tool(c,B,'write_file')
 for(let n=0;n<100;n++){
  await choose(c,n%2?A:B);assert.equal(c.task.activity,n%2?'searching':'editing');assert.equal(visible(c),true)
 }
 c.dispose()
})
test('background completion and abort are retained without publishing into foreground',async()=>{
 const c=await make();begin(c,A);tool(c,A,'read_file');begin(c,B);tool(c,B,'write_file')
 const before=c.revision;finish(c,B);assert.equal(c.revision,before);assert.equal(c.task.activity,'searching')
 await choose(c,B);assert.equal(c.task.phase,'completed');assert.equal(visible(c),true)
 finish(c,A,'aborted');assert.equal(c.task.phase,'completed');await choose(c,A);assert.equal(visible(c),false)
 c.dispose()
})
test('parallel tools, question and approvals retain ownership across switches',async()=>{
 const c=await make();begin(c,A);tool(c,A,'read_file','read');tool(c,A,'exec_command','exec')
 begin(c,B);tool(c,B,'ask_user_question','question');ev(c,A,'approval/asked',{id:'confirm'})
 await choose(c,B);assert.equal(c.task.phase,'waiting');await choose(c,A);assert.equal(c.task.phase,'waiting')
 await choose(c,B);ev(c,A,'approval/decided',{id:'confirm'});ev(c,A,'tool/result',{callId:'exec'});assert.equal(c.task.phase,'waiting')
 await choose(c,A);assert.equal(c.task.activity,'searching');assert.deepEqual(c.task.openTools.map(t=>t.id),['read'])
 ev(c,B,'user/message',{source:{kind:'user'}});await choose(c,B);assert.equal(c.task.phase,'thinking');c.dispose()
})
test('live assistant attempt continues on return without requiring a new start frame',async()=>{
 const c=await make(),a={session:A},b={session:B};begin(c,A);begin(c,B)
 frame(c,a,'start',1);frame(c,b,'start',1)
 frame(c,a,'chunk',2,0,{chunk:{type:'text-delta'}});frame(c,b,'chunk',2,0,{chunk:{type:'reasoning-delta'}})
 await choose(c,B);assert.equal(c.task.phase,'thinking');await choose(c,A);assert.equal(c.task.phase,'responding')
 await choose(c,B);frame(c,a,'chunk',3,1,{chunk:{type:'reasoning-delta'}});assert.equal(c.task.phase,'thinking')
 await choose(c,A);frame(c,a,'chunk',4,2,{chunk:{type:'text-delta'}});assert.equal(c.task.phase,'responding');c.dispose()
})
test('background retry and terminal events invalidate only their own stream',async()=>{
 const c=await make(),a={session:A},b={session:B};begin(c,A);begin(c,B)
 frame(c,a,'start',1);frame(c,b,'start',1);frame(c,a,'chunk',2,0,{chunk:{type:'text-delta'}});frame(c,b,'chunk',2,0,{chunk:{type:'text-delta'}})
 frame(c,b,'end',3,1,{outcome:{kind:'abandoned'}});assert.equal(c.task.phase,'responding')
 await choose(c,B);assert.equal(c.task.phase,'thinking');finish(c,A);frame(c,a,'chunk',3,1,{chunk:{type:'reasoning-delta'}})
 await choose(c,A);assert.equal(c.task.phase,'completed');c.dispose()
})
test('same-session model change and delayed persona resolution cannot replace latest route state',async()=>{
 const c=await make();begin(c,A);tool(c,A,'read_file');begin(c,B);tool(c,B,'write_file')
 const waits=[];c.resolvePersona=()=>new Promise(resolve=>waits.push(resolve))
 const first=choose(c,B,'claude');await Promise.resolve();await Promise.resolve()
 const last=choose(c,A,'gemini');await Promise.resolve();await Promise.resolve()
 waits[1]({id:'gemini'});await last;waits[0]({id:'claude'});await first
 assert.equal(c.route.sessionId,'A');assert.equal(c.route.art,'gemini');assert.equal(c.task.activity,'searching')
 c.dispose()
})
test('disposing sessions removes their semantic state; disable and dispose clear caches',async()=>{
 const c=await make();begin(c,A);begin(c,B);c.forgetSession(B);await choose(c,B);assert.equal(c.task.phase,'idle')
 await choose(c,A);assert.equal(c.task.phase,'thinking');c.forgetSession(A);assert.equal(c.task.phase,'idle')
 begin(c,A);await c.configure({enabled:false});assert.equal(c.sessionStates.size,0)
 await c.configure({enabled:true});assert.equal(c.task.phase,'idle');begin(c,A);c.dispose();assert.equal(c.sessionStates.size,0)
})
test('inactive session events do not query usage or read selected session statistics',async()=>{
 let reads=0,queries=0;const c=await make({readStats:()=>{reads++;return{}},queryUsage:async()=>{queries++;return{status:'ready'}}})
 await c.configure({showStats:true});begin(c,A);const before=reads;begin(c,B);finish(c,B)
 assert.equal(reads,before);assert.equal(queries,0);c.dispose()
})
test('subagent events never create selectable parent state and raw chunks are not read',async()=>{
 const c=await make();const child={header:{id:'child',origin:'subagent',delegationDepth:1}}
 begin(c,child);await choose(c,child);assert.equal(c.task.phase,'idle')
 begin(c,B);const b={session:B};frame(c,b,'start',1)
 const chunk={type:'text-delta'};Object.defineProperty(chunk,'text',{get(){throw Error('content read')}})
 frame(c,b,'chunk',2,0,{chunk});await choose(c,B);assert.equal(c.task.phase,'responding');c.dispose()
})
test('seeded interleaving keeps each selected snapshot equal to its independent event fold',async()=>{
 const {emptyTask,reduceTask}=await import('../../pet/task.js')
 const c=await make(),sessions=[A,B,session('C')],states=new Map(sessions.map(s=>[s.header.id,emptyTask()]))
 let seed=0x45a2,selected='A';const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed}
 const events=[['turn/start',{turn:1}],['tool/call',{name:'read_file',callId:'read'}],['tool/call',{name:'exec_command',callId:'exec'}],['tool/result',{callId:'read'}],['tool/result',{callId:'exec'}],['approval/asked',{id:'permission'}],['approval/decided',{id:'permission'}],['turn/end',{reason:{kind:'completed'}}],['turn/end',{reason:{kind:'aborted'}}]]
 for(let n=0;n<1200;n++){
  const s=sessions[random()%sessions.length],id=s.header.id
  if(random()%3===0){selected=id;await choose(c,s)}else{
   const [type,data]=events[random()%events.length],event={type,data},revision=c.revision
   states.set(id,reduceTask(states.get(id),event));c.event(s,event)
   if(id!==selected)assert.equal(c.revision,revision,'background event published at '+n)
  }
  assert.deepEqual(c.task,states.get(selected),'interleaving '+n+' selected '+selected)
 }
 c.dispose()
})
