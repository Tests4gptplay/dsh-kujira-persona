/** MiniMax official CLI contract, checked 2026-10-29.
 * https://github.com/MiniMax-AI/cli/blob/main/src/types/api.ts
 * https://github.com/MiniMax-AI/cli/blob/main/src/output/quota-table.ts
 * Explicit subscription-key adapter only; never uses ambiguous *_usage_count.
 */
const origins=['https://api.minimax.io','https://api.minimax.cn']
const percent = v => {if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100)throw new Error('invalid-quota-percent');return v}
const obj=v=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('invalid-schema');return v}
export const minimaxAdapters={
  'minimax-token-plan':{
    label:'MiniMax Token Plan',auth:'coding-plan',requiredFields:['credentialRef'],origins,capabilities:['quota'],evidenceLevel:'vendor-owned-official-cli',docsUrl:'https://github.com/MiniMax-AI/cli/blob/main/src/types/api.ts',
    async read({request,baseURL,route={},now=Date.now()}){
      const url=new URL(baseURL)
      if(url.username||url.password||!origins.includes(url.origin))throw new Error('unsupported-origin')
      const data=obj(await request(url.origin+'/v1/token_plan/remains',{method:'GET',headers:{'Content-Type':'application/json'}}))
      if(data.base_resp!==undefined){const code=obj(data.base_resp).status_code;if(typeof code!=='number')throw new Error('invalid-schema');if(code!==0){const e=new Error('minimax-quota-failed');if(code===1004||code===2049)e.status=403;throw e}}
      if(!Array.isArray(data.model_remains))throw new Error('invalid-schema')
      // Only a matching model bucket establishes scope for the selected model.
      // General/video buckets are not a model-to-bucket mapping contract.
      const selected=data.model_remains.map(obj).filter(x=>x.model_name===route.model)
      if(selected.length!==1)return {metrics:[],unsupported:true}
      const m=selected[0],metrics=[],issues=[]
      if(m.current_interval_status===3&&m.current_weekly_status===3&&m.current_interval_total_count===0&&m.current_weekly_total_count===0)return {metrics:[],notice:'not-in-plan'}
      let unlimited=false
      for(const [prefix,label,endField] of [['current_interval','interval','end_time'],['current_weekly','week','weekly_end_time']]){
        const status=m[prefix+'_status']
        if(status===3){unlimited=true;continue}
        if(status!==undefined&&status!==1&&status!==2)throw new Error('invalid-quota-status')
        const raw=m[prefix+'_remaining_percent']
        if(raw===undefined||raw===null){issues.push('missing-quota-percent');continue}
        let value=percent(raw)
        if(prefix==='current_weekly'&&m.weekly_boost_permille!==undefined&&m.weekly_boost_permille!==null){const b=m.weekly_boost_permille;if(typeof b!=='number'||!Number.isFinite(b)||b<0)throw new Error('invalid-quota-boost');value*=b/1000;if(!Number.isFinite(value))throw new Error('invalid-quota-boost')}
        const metric={kind:'quota',value,unit:'percent',scope:'token-plan',remaining:true,label}
        if(m[endField]!==undefined&&m[endField]!==null){const reset=m[endField];if(!Number.isSafeInteger(reset)||reset<0)throw new Error('invalid-quota-reset');if(reset>0){if(reset<=now){issues.push('expired-quota-window');continue}metric.resetAt=reset}}
        metrics.push(metric)
      }
      if(!metrics.length&&!unlimited)throw new Error('quota-unavailable')
      return {metrics,issues,...(unlimited?{notice:'unlimited-plan'}:{})}
    }
  }
}
