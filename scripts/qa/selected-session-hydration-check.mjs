import test from 'node:test'
import assert from 'node:assert/strict'
const {PetController}=await import(process.env.PET_CONTROLLER??'../../pet/controller.js')
const tick=async()=>{for(let i=0;i<5;i++)await Promise.resolve()}
const visible=c=>c.config.bubble!=='hidden'&&(c.config.bubble==='always'||c.task.phase!=='idle')
const models=['gpt','claude','gemini','deepseek']
function fixture(count=3,{deferred=false,coldStats=false}={}){
 const sessions=Array.from({length:count},(_,i)=>({header:{id:'s-'+i},events:[],running:true,views:{sessionStats:{turns:i+1,steps:i+10},tokenUsage:{uncachedInputTokens:100+i,cacheReadTokens:30,cacheWriteTokens:0,outputTokens:20},contextPressure:{projectedTokens:i+100,contextWindow:1000}}}))
 const requests=[],reads=[]
 const observe=(s,after)=>({header:s.header,cursor:s.events.length-1,inheritedEventCount:s.inheritedEventCount??0,running:s.running,events:s.events.slice(after===undefined?0:after+1),projections:{values:s.views}})
 const c=new PetController({config:{enabled:true,bubble:'tasks',showUsage:false},readStats:id=>coldStats?undefined:sessions.find(s=>s.header.id===id)?.views,readSession:(id,after)=>{reads.push({id,after});const s=sessions.find(s=>s.header.id===id),snapshot=observe(s,after);return deferred?new Promise(resolve=>requests.push({id,resolve:()=>resolve(snapshot)})):Promise.resolve(snapshot)}})
 const append=(s,type,data={},deliver=true)=>{const e={type,data,seq:s.events.length};s.events.push(e);if(type==='turn/start')s.running=true;if(type==='turn/end')s.running=false;if(deliver)c.event(s,e);return e}
 const begin=(s,deliver=false)=>{append(s,'turn/start',{turn:sessions.indexOf(s)+1},deliver);append(s,'step/start',{turn:sessions.indexOf(s)+1,step:1},deliver)}
 const choose=(s,model=models[sessions.indexOf(s)%models.length])=>c.select({sessionId:s.header.id,provider:'fixture',model})
 return{c,sessions,requests,reads,append,begin,choose}
}
for(const count of [2,3,10,50])test(`${count} sessions running before observation hydrate on every selection and 200 rapid returns`,async()=>{
 const f=fixture(count,{coldStats:true});const {c,sessions,begin,choose,append,reads}=f
 sessions.forEach((s,i)=>{begin(s);append(s,'tool/call',{name:i%2?'write_file':'read_file',callId:s.header.id},false)})
 for(let n=0;n<200+count;n++){const i=(n*7+n%3)%count,s=sessions[i];await choose(s);assert.equal(c.route.sessionId,s.header.id);assert.equal(c.route.model,models[i%models.length]);assert.equal(c.task.activity,i%2?'editing':'searching');assert.equal(c.stats.steps,i+10);assert.equal(c.stats.totalTokens,150+i);assert.equal(visible(c),true)}
 assert.equal(reads.filter(r=>r.after===undefined).length,count);assert.equal(reads.filter(r=>r.after!==undefined).every(r=>r.after===2),true);c.dispose()
})
test('same selected route rehydrates after enable; completion and cancellation survive reopen',async()=>{
 const {c,sessions,begin,choose,append}=fixture();const [a,b]=sessions;begin(a);begin(b);await choose(a)
 await c.configure({enabled:false});append(a,'tool/call',{name:'write_file',callId:'x'});await c.configure({enabled:true});await c.hydrate(c.route.sessionId);assert.equal(c.task.activity,'editing')
 append(a,'turn/end',{reason:{kind:'completed'}});await choose(a);assert.equal(c.task.phase,'completed');assert.equal(visible(c),true)
 append(b,'turn/end',{reason:{kind:'aborted'}});await choose(b);assert.equal(c.task.phase,'idle');assert.equal(visible(c),false);c.dispose()
})
test('A B C requests settling C A B cannot move current model, state or stats',async()=>{
 const {c,sessions,begin,choose,requests}=fixture(3,{deferred:true,coldStats:true});sessions.forEach(s=>begin(s))
 const pending=sessions.map(s=>choose(s));await tick();requests[2].resolve();await pending[2];assert.equal(c.route.sessionId,'s-2');assert.equal(c.stats.steps,12)
 requests[0].resolve();requests[1].resolve();await Promise.all(pending);assert.equal(c.route.sessionId,'s-2');assert.equal(c.route.model,'gemini');assert.equal(c.stats.steps,12);assert.equal(c.task.turnActive,true);c.dispose()
})
test('A B A while reads are pending retains the newest explicit selection',async()=>{
 const {c,sessions,begin,choose,requests}=fixture(2,{deferred:true});sessions.forEach(s=>begin(s))
 const p=[choose(sessions[0]),choose(sessions[1]),choose(sessions[0])];await tick();assert.equal(requests.length,2);requests[1].resolve();requests[0].resolve();await Promise.all(p);assert.equal(c.route.sessionId,'s-0');assert.equal(c.task.turnActive,true);c.dispose()
})
test('events and idle status arriving during stale hydration do not resurrect completed work',async()=>{
 const {c,sessions,begin,choose,requests,append}=fixture(2,{deferred:true});const [a,b]=sessions;begin(a);begin(b)
 const selected=choose(a);await tick();append(a,'tool/call',{name:'write_file',callId:'x'});append(a,'turn/end',{reason:{kind:'completed'}});c.status?.({agent:{session:a},status:'idle'});append(b,'turn/end',{reason:{kind:'aborted'}});requests[0].resolve();await selected
 assert.equal(c.route.sessionId,a.header.id);assert.equal(c.task.phase,'completed');assert.equal(c.task.turnActive,false);assert.equal(visible(c),true)
 c.event(a,{seq:0,type:'turn/start',data:{turn:1}});assert.equal(c.task.phase,'completed');c.dispose()
})
test('a newer turn during a cold idle read is not cleared by its old running=false',async()=>{
 const {c,sessions,choose,requests,append}=fixture(1,{deferred:true});const a=sessions[0];a.running=false;const p=choose(a);await tick();append(a,'turn/start',{turn:1});append(a,'step/start',{turn:1,step:1});requests[0].resolve();await p;assert.equal(c.task.turnActive,true);c.dispose()
})
test('live responding stream survives repeated selections; mid-attempt join reads discriminants only',async()=>{
 const {c,sessions,begin,choose}=fixture(2);sessions.forEach(s=>begin(s));const [a,b]=sessions;await choose(a);const agent={session:a}
 const chunk={type:'text-delta'};Object.defineProperty(chunk,'text',{get(){throw Error('message content read')}})
 c.assistantFrame({agent,frame:{type:'chunk',attemptId:'already-running',revision:2,index:1,chunk}});assert.equal(c.task.phase,'responding')
 for(let n=0;n<10;n++){await choose(b);await choose(a);assert.equal(c.task.phase,'responding')}
 c.assistantFrame({agent,frame:{type:'chunk',attemptId:'already-running',revision:1,index:0,chunk:{type:'reasoning-delta'}}});assert.equal(c.task.phase,'responding');c.dispose()
})
test('explicit selected subagent hydrates, while unopened child never takes foreground',async()=>{
 const {c,sessions,begin,choose,append}=fixture();const [a,b,child]=sessions;child.header.origin='subagent';child.header.delegationDepth=1;begin(a);begin(child);await choose(a)
 append(child,'tool/call',{name:'write_file',callId:'child'});assert.equal(c.route.sessionId,a.header.id);assert.equal(c.task.activity,'thinking')
 await choose(child);assert.equal(c.task.activity,'editing');append(child,'tool/result',{callId:'child'});assert.equal(c.task.phase,'thinking');await choose(a);append(child,'turn/end',{reason:{kind:'completed'}});assert.equal(c.route.sessionId,a.header.id);assert.equal(c.task.turnActive,true);c.dispose()
})
test('orphaned open history, fork inherited activity, empty session and disposed hydration never fake work',async()=>{
 const {c,sessions,begin,choose}=fixture(3);const [orphan,fork,empty]=sessions;begin(orphan);orphan.running=false;begin(fork);fork.inheritedEventCount=2;fork.running=false;empty.running=false
 for(const s of sessions){await choose(s);assert.equal(c.task.turnActive,false);assert.equal(visible(c),false)}c.dispose()
 const f=fixture(1,{deferred:true});f.begin(f.sessions[0]);const p=f.choose(f.sessions[0]);await tick();f.c.forgetSession(f.sessions[0]);f.requests[0].resolve();await p;assert.equal(f.c.task.phase,'idle');f.c.dispose()
})
test('background late completion, 50-session out-of-order delivery and duplicate sequence remain isolated',async()=>{
 const {c,sessions,begin,choose,append}=fixture(50);sessions.forEach(s=>begin(s));await choose(sessions[0]);const before=c.task
 for(let i=49;i>0;i--){append(sessions[i],'turn/end',{reason:{kind:i%2?'completed':'aborted'}});c.event(sessions[i],{type:'turn/start',seq:0,data:{turn:i+1}})}
 assert.equal(c.route.sessionId,'s-0');assert.equal(c.task,before)
 for(let i=49;i>0;i--){await choose(sessions[i]);assert.equal(c.task.phase,i%2?'completed':'idle');assert.equal(c.stats.steps,i+10)}c.dispose()
})
test('private text and tool arguments/results never enter pending hydration or pet snapshot',async()=>{
 const f=fixture(1,{deferred:true}),s=f.sessions[0];f.begin(s);const p=f.choose(s);await tick()
 const data={name:'read_file',callId:'x'};Object.defineProperty(data,'arguments',{get(){throw Error('arguments read')}});f.append(s,'tool/call',data)
 const text={source:{kind:'user'}};Object.defineProperty(text,'text',{get(){throw Error('text read')}});f.append(s,'user/message',text)
 assert.equal(JSON.stringify(f.c.presentation.hydration.events).includes('arguments'),false);f.requests[0].resolve();await p;assert.equal(f.c.task.activity,'searching');f.c.dispose()
})
test('waiting approval and unanswered user tool hydrate without being flattened to working',async()=>{
 const {c,sessions,begin,choose,append}=fixture(2);const [a,b]=sessions;begin(a);begin(b)
 append(a,'approval/asked',{id:'permission-1'},false);append(b,'tool/call',{name:'ask_user_question',callId:'q'},false)
 for(let i=0;i<20;i++){await choose(i%2?a:b);assert.equal(c.task.phase,'waiting');assert.equal(visible(c),true)}
 await choose(a);append(a,'approval/decided',{id:'permission-1'});assert.equal(c.task.phase,'thinking');c.dispose()
})
test('historical terminal states keep the same signal and pulse through repeated focus/selection',async()=>{
 const {c,sessions,begin,choose,append}=fixture(2);sessions.forEach((s,i)=>{begin(s);append(s,'turn/end',{reason:{kind:i?'error':'completed'}},false)})
 for(const s of sessions){await choose(s);const task=c.task;for(let i=0;i<30;i++){await choose(s);assert.equal(c.task.signal,task.signal);assert.deepEqual(c.task.pulse,task.pulse);assert.equal(c.task.turnActive,false)}}c.dispose()
})
test('reported switch: A emits live frames, already-running B emits nothing after switching',async()=>{
 const {c,sessions,begin,choose}=fixture(2);const [a,b]=sessions;begin(b,false);await choose(a);begin(a,true)
 const agent={session:a};c.assistantFrame({agent,frame:{type:'start',attemptId:'a',revision:1,turn:1,step:1}});c.assistantFrame({agent,frame:{type:'chunk',attemptId:'a',revision:2,index:0,chunk:{type:'text-delta'}}});assert.equal(c.task.phase,'responding');assert.equal(c.stats.steps,10)
 await choose(b,'gpt');assert.equal(c.route.sessionId,b.header.id);assert.equal(c.task.turnActive,true);assert.notEqual(c.task.phase,'idle');assert.equal(c.stats.steps,11);assert.equal(visible(c),true);c.dispose()
})

for(const kind of ['completion','failed-turn','cancel','temporary-error'])test(`initial hydration does not replay an already-published ${kind} pulse`,async()=>{
 const {c,sessions,begin,choose,append,requests}=fixture(1,{deferred:true});const s=sessions[0];begin(s);append(s,'tool/call',{name:'read_file',callId:'old'},false)
 if(kind!=='temporary-error')append(s,'tool/result',{callId:'old'},false)
 else append(s,'tool/call',{name:'write_file',callId:'current'},false)
 const pending=choose(s);await tick()
 if(kind!=='temporary-error')append(s,'turn/end',{reason:{kind:{completion:'completed','failed-turn':'error',cancel:'aborted'}[kind]}})
 else append(s,'tool/result',{callId:'current',error:true})
 const emitted={signal:c.task.signal,pulse:c.task.pulse};assert.equal(emitted.pulse?.kind??null,kind==='completion'?'success':kind==='temporary-error'?'error':null)
 requests[0].resolve();await pending
 assert.equal(c.task.signal,emitted.signal);assert.deepEqual(c.task.pulse,emitted.pulse);assert.equal(c.task.turnActive,kind==='temporary-error');if(kind==='temporary-error'){assert.equal(c.task.activity,'searching');assert.deepEqual(c.task.openTools.map(tool=>tool.id),['old'])}c.dispose()
})
