/** QA only: stand-in for the existing authenticated Codex quota endpoint. */
export const inject=['connection']
export function apply(ctx){ctx.connection.fetch.register({path:'/api/codex-native/quota',methods:['POST'],requestBody:'buffered',fetch:async request=>{const e=await request.json();return Response.json({type:'server-response',rpcId:e.rpcId,result:{ok:true,value:{planType:'pro (模拟数据)',primary:{usedPercent:35,windowDurationMins:300,resetsAt:Math.floor(Date.now()/1000)+7200},secondary:{usedPercent:67,windowDurationMins:10080,resetsAt:Math.floor(Date.now()/1000)+172800}}}})}})}
