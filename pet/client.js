window.__ModuleLoader__.load({id:'dsh-kujira-persona',factory:(require)=>{
  const React=require('react'),h=React.createElement
  const {Menu,MenuSurface,MenuItemButton}=require('@deepseek-ai/dsh-client-ui-primitives')
  const {useEffect,useRef,useState,useSyncExternalStore}=React
  let spriteModule,spriteAttempt=0
  async function apply(ctx){
    const uiRuntime=await import('/api/kujira-pet/ui-messages.js')
    const credentialUi=await import('/api/kujira-pet/account-credentials.js')
    const accountOptions=await import('/api/kujira-pet/account-options.js')
    const queryCredentialService=()=>{try{return ctx.get?.('remote.credentials')}catch{return undefined}}
    const locale=ctx.locale
    const clientMessages={
      "zh": {
        "account.guide.openai": "需要具有组织用量/费用读取权限的 Admin API 凭据。下方独立保存；Project ID 可选，留空读取组织范围。本月消费和 Completions 用量不等于余额。",
        "account.guide.anthropic": "需要 Anthropic Admin API 凭据；Workspace ID 可选。显示 API 费用与 Messages 用量，不是 Claude Code 订阅，旧费用端点不含 Priority Tier。",
        "account.guide.mistral": "需要 Enterprise Admin API 凭据。显示组织月度预算剩余，不是充值余额。",
        "account.guide.xai": "需要 Management API 凭据及 Team ID。显示月度模型服务消费；请先按官方指南取得账单读取权限。",
        "account.guide.openrouter-management": "需要 OpenRouter Management Key；普通模型 key 不提供此账户账本接口。显示官方 credits 剩余与累计消费。",
        "account.guide.glm-coding-plan": "个人 Coding Plan 查询凭据；下方独立保存。显示五小时 Coding 与月度 MCP 已用比例。",
        "account.guide.minimax-token-plan": "需要适用模型的 Token Plan 凭据。仅展示响应中与当前模型精确匹配的套餐配额；通用/视频配额不自动套用。",
        "account.guide.volcengine-agent-plan": "仅个人 Ark Agent Plan，使用 AK / SK 与相应查询权限；不是模型 API key，不支持企业席位查询。显示滚动 AFP 配额。",
        "account.guide.deepseek-compatible": "第三方服务须明确提供同源 /user/balance 兼容接口；请先查该服务自己的部署文档。凭据只发往当前已配置来源，不自动发送到其他站点。下方链接仅说明兼容响应格式。",

        "account.setupMethod": "公司与接入方式",
        "account.connectionNumber": "连接 {number}",
        "account.thirdParty": "第三方",
        "account.compatReference": "兼容协议参考（不是第三方部署文档）",
        "account.endpoint": "已配置服务端来源",
        "account.hostEndpoint": "宿主账户服务",
        "account.reuse": "此查询可复用当前模型的 API 凭据；留空即可复用。也可另存独立查询凭据。",
        "account.independent": "此官方接口要求独立管理或套餐查询凭据；模型 API 已连通不代表该权限已接入。",
        "account.secretLabel.key": "独立查询密钥（只写入宿主）",
        "account.secretLabel.credentialRef": "Access Key ID（套餐查询）",
        "account.secretLabel.secretRef": "Secret Access Key（套餐查询）",
        "account.secretLabel.sessionTokenRef": "临时 Session Token（可选）",
        "account.secretConfigured": "已保存独立查询凭据（不显示原值）",
        "account.secretEmpty": "尚未保存；填写后点击“保存查询设置”",
        "account.secretUnavailable": "当前宿主未提供可用的凭据写入服务，暂不支持在此录入；已有可解析引用仍可使用。",
        "account.secretHandling": "新密钥仅经宿主凭据服务保存；Kujira 设置只保存独立引用，不覆盖模型推理密钥。切换配置目标会清空未保存输入。",
        "account.credentialSaveFailed": "独立查询凭据未能保存或确认；未将秘密写入插件设置，请重试。",
        "account.queryFailed": "账户查询失败；请核对查询类型、账户参数及权限。",
        "account.queryNow": "查询账户信息",
        "account.provider": "服务商 / 端口配置",
        "account.model": "模型（仅选择配置目标）",
        "account.targetHelp": "只列已有服务端中需要额外配置的可用查询方案；自动查询与无方案的接入不列出。选择不会改变对话模型。新服务端地址在 DSH 模型设置中配置。",

        "account.choose": "请选择",
        "account.currencyPlaceholder": "例如 CNY 或 USD",
        "account.currency": "账单币种（确认后填写）",
        "account.site.international": "国际站",
        "account.site.china": "中国站",
        "account.site": "账单站点",
        "account.auth.signed": "套餐查询签名权限",
        "account.auth.host": "宿主账户",
        "account.title": "账户与模型价格",
        "account.route": "当前接入／模型",
        "account.adapter": "查询方式",
        "account.auto": "自动匹配",
        "account.none": "不查询",
        "account.capabilities": "可查询",
        "account.noCapabilities": "此接入没有匹配的查询接口",
        "account.reference": "官方参考",
        "account.auth.inference": "模型密钥权限",
        "account.auth.admin": "管理密钥权限",
        "account.auth.management": "服务商账户管理权限",
        "account.auth.coding-plan": "Coding Plan 权限",
        "account.credentialRef": "已有凭据引用名（非密钥，可选）",
        "account.secretRef": "Secret 环境变量名",
        "account.sessionTokenRef": "会话令牌环境变量名",
        "account.teamId": "团队 ID",
        "account.projectId": "项目 ID",
        "account.workspaceId": "工作区 ID",
        "account.region": "区域",
        "account.billingAccountId": "账单账户 ID",
        "account.refPlaceholder": "例如 BILLING_API_KEY",
        "account.idPlaceholder": "填写账户标识",
        "account.refs": "凭据只填写环境变量名；管理接口需相应权限。",
        "account.openaiRefs": "OpenAI 管理查询凭据可在下方独立录入并交给宿主保存；不替换模型推理密钥。",
        "account.save": "保存查询设置",
        "account.saved": "查询设置已保存",
        "account.loading": "正在读取查询方式…",
        "account.retry": "重新读取",
        "account.details": "用量详情",
        "account.cap.balance": "余额",
        "account.cap.spend": "实际支出",
        "account.cap.tokens": "用量",
        "account.cap.quota": "套餐余量",
        "account.cap.pricing": "模型单价",
        "price.title": "模型价格",
        "price.manual": "手动参考单价",
        "price.reference": "官方价格页面（非自动查询）",
        "price.api": "接口价格",
        "price.unit": "每 100 万 tokens",
        "price.currency": "币种",
        "price.input": "输入",
        "price.output": "输出",
        "price.cacheRead": "缓存读取",
        "price.cacheWrite": "缓存写入",
        "price.date": "价格日期",
        "price.save": "保存手动价格",
        "price.clear": "移除手动价格",
        "price.saved": "手动价格已保存",
        "price.cleared": "手动价格已移除",
        "price.optional": "可选",
        "price.estimate": "估算费用",
        "account.saving": "正在保存…",
        "account.invalidRef": "请填写有效的环境变量名，不要填写密钥。",
        "account.invalidId": "请检查账户标识或区域格式。",
        "price.invalid": "输入／输出价格须为非负数字，币种须为三位大写代码。",
        "account.unavailableOption": "不适用于当前接入",
        "account.selectModel": "选择模型后配置账户与价格。",

        "settings.title": "Kujira · 人设与桌宠",
        "settings.nav": "Kujira · 人设",
        "settings.description": "随当前模型切换 AI 角色形象。",
        "pet.enabled": "启用桌宠",
        "pet.visible": "显示桌宠形象",
        "pet.display": "显示位置",
        "pet.display.auto": "自动",
        "pet.display.desktop": "桌面窗口",
        "pet.display.page": "DSH 页面内",
        "pet.scale": "角色大小",
        "pet.bubbleScale": "整个气泡大小",
        "pet.activity": "活动程度",
        "pet.quiet": "安静",
        "pet.normal": "标准",
        "pet.lively": "活泼",
        "bubble.display": "气泡显示",
        "bubble.always": "常驻",
        "bubble.tasks": "仅工作与完成状态",
        "bubble.hidden": "隐藏",
        "pet.reduced": "减少动态",
        "pet.sound": "完成与出错提示音",
        "usage.show": "显示账户用量",
        "stats.show": "显示工作统计",
        "usage.refresh": "账户用量刷新",
        "usage.manual": "仅切换模型／任务结束／手动刷新",
        "usage.minute": "每分钟",
        "usage.fiveMinutes": "每五分钟",
        "pet.reset": "重置桌宠位置",
        "pet.current": "当前形象",
        "usage.refreshNow": "刷新账户用量",
        "usage.credentials": "账户查询设置位于“设置 → Kujira · 人设 → 账户与模型价格”；独立凭据由宿主保存，插件只保存引用。",
        "settings.loading": "正在读取 Kujira 设置…",
        "archives.title": "世界观与人物档案",
        "archives.description": "打开本机文件夹查看各角色资料和记忆；尺寸为文件夹在磁盘上的实际文件大小。",
        "archives.refreshing": "正在统计…",
        "archives.refresh": "刷新文件夹大小",
        "archives.loading": "正在读取档案目录…",
        "archives.help": "修改世界观、人物性格、记忆、模型绑定或档案存放位置，请在 DSH 对话中告诉 AI；这里用于查看与打开目录。",
        "experiments.title": "实验性功能",
        "diary.title": "AI 日记",
        "diary.enabled": "启用 AI 日记",
        "diary.warning": "开启后会产生额外 token 消耗，消耗量不可控、无法预估。",
        "diary.description": "各角色在指定文件夹下拥有独立空间，自主决定何时写日记、写什么以及如何书写。",
        "diary.library": "日记库",
        "diary.set": "设置日记库",
        "diary.open": "打开日记库",
        "diary.saving": "正在保存…",
        "folder.opening": "正在打开…",
        "diary.loading": "正在读取日记设置…",
        "diary.notLoaded": "尚未读取日记设置。",
        "diary.reload": "重新读取日记设置",
        "diary.saved": "日记库已设置。",
        "diary.on": "AI 日记已开启。",
        "diary.off": "AI 日记已关闭。",
        "diary.openRequested": "已请求打开日记库。",
        "sleep.title": "睡眠整理",
        "sleep.enabled": "启用睡眠整理",
        "sleep.description": "仅在所有对话任务都空闲时，使用前台当前选择的同一模型，整理当前角色昨天及更早的日记。新任务开始时停止后台整理。",
        "sleep.warning": "会在后台自动调用 AI，产生额外 token 消耗，消耗量无法预估。",
        "folder.open": "打开文件夹",
        "stats.aria": "会话工作统计",
        "animation.retry": "重试加载动画",
        "menu.close": "全部关闭",
        "menu.dismiss": "关闭提示",
        "menu.hidePet": "隐藏桌宠",
        "menu.showPet": "显示桌宠",
        "menu.hideBubble": "隐藏气泡",
        "menu.showBubble": "显示气泡",
        "menu.sample": "菜单样式",
        "error.hostFallback": "宿主未能完成这次设置，请查看 DSH 日志。",
        "error.hostDisconnected": "无法连接 DSH 宿主，请确认 DSH 仍在运行。",
        "error.hostDenied": "宿主拒绝了请求（HTTP {status}），请重新连接 DSH。",
        "error.hostMissing": "宿主菜单接口不可用（HTTP 404），请重启 DSH 以加载插件。",
        "error.hostFailed": "宿主请求失败（HTTP {status}），请查看 DSH 日志。",
        "usage.reset": "{label}重置：{date}",
        "folder.openAria": "打开{label}文件夹",
        "usage.seconds": "每 {seconds} 秒",
        "archives.total": "档案总计：{size}",
        "archives.all": "所有角色档案（{count}）",
        "animation.aria": "{name} 动画桌宠",
        "task.progress": "{done} / {total} 项"
      },
      "en": {
        "account.guide.openai": "Use an Admin API credential with organization usage/cost access. Store it separately below. Project ID is optional; empty means organization scope. Monthly cost and Completions usage are not balance.",
        "account.guide.anthropic": "Use an Anthropic Admin API credential; Workspace ID is optional. This shows API cost and Messages usage, not Claude Code subscription. The legacy cost endpoint excludes Priority Tier.",
        "account.guide.mistral": "Requires an Enterprise Admin API credential. Shows the remaining monthly organization budget, not prepaid balance.",
        "account.guide.xai": "Requires a Management API credential and Team ID with billing access. Shows monthly model-service spend.",
        "account.guide.openrouter-management": "Requires an OpenRouter Management Key, not the normal model key. Shows remaining account credits and total usage.",
        "account.guide.glm-coding-plan": "Use a personal Coding Plan credential. Shows five-hour Coding and monthly MCP usage percentages.",
        "account.guide.minimax-token-plan": "Use a Token Plan credential for the relevant model. Shows only the quota bucket matching the selected model; general/video buckets are not substituted.",
        "account.guide.volcengine-agent-plan": "Personal Ark Agent Plan only, using AK/SK and query permission, not a model API key. Enterprise seats are not supported. Shows rolling AFP quotas.",
        "account.guide.deepseek-compatible": "The third-party service must provide a same-origin /user/balance-compatible endpoint. Check its own deployment documentation. Credentials go only to the configured origin, never another site automatically. The linked reference describes the response format only.",

        "account.setupMethod": "Company and connection method",
        "account.connectionNumber": "Connection {number}",
        "account.thirdParty": "Third-party",
        "account.compatReference": "Compatibility reference (not third-party deployment docs)",
        "account.endpoint": "Configured endpoint origin",
        "account.hostEndpoint": "Host account service",
        "account.reuse": "This query can reuse the model API credential. Leave references empty to reuse it, or store a separate query credential.",
        "account.independent": "This official interface requires an admin or plan-query credential, separate from a working model API connection.",
        "account.secretLabel.key": "Separate query key (write-only to Host)",
        "account.secretLabel.credentialRef": "Access Key ID (plan query)",
        "account.secretLabel.secretRef": "Secret Access Key (plan query)",
        "account.secretLabel.sessionTokenRef": "Temporary session token (optional)",
        "account.secretConfigured": "Separate query credential saved (value never displayed)",
        "account.secretEmpty": "Not saved; enter a value and save query settings",
        "account.secretUnavailable": "This Host has no available credential-write service; key entry is unavailable. Existing resolvable references can still be used.",
        "account.secretHandling": "New secrets are stored only by the Host credential service. Kujira stores separate references and does not overwrite model keys. Switching targets clears unsaved inputs.",
        "account.credentialSaveFailed": "Could not save or confirm the query credential. No secret was written into plugin settings. Retry.",
        "account.queryFailed": "Account query failed; check query type, account parameters and permissions.",
        "account.queryNow": "Query account info",
        "account.provider": "Provider / endpoint profile",
        "account.model": "Model (configuration target only)",
        "account.targetHelp": "Only available query methods needing extra setup are listed. Automatic accounts and unsupported methods are omitted. Selection does not change the conversation model. Add endpoints in DSH Models settings.",

        "account.choose": "Select",
        "account.currencyPlaceholder": "For example, CNY or USD",
        "account.currency": "Billing currency (confirm before entering)",
        "account.site.international": "International",
        "account.site.china": "China",
        "account.site": "Billing site",
        "account.auth.signed": "Signed plan-query permissions",
        "account.auth.host": "Host account",
        "account.title": "Account & model pricing",
        "account.route": "Current provider / model",
        "account.adapter": "Query method",
        "account.auto": "Automatic",
        "account.none": "No query",
        "account.capabilities": "Queryable",
        "account.noCapabilities": "No matching query API for this provider",
        "account.reference": "Official reference",
        "account.auth.inference": "Model-key permissions",
        "account.auth.admin": "Admin-key permissions",
        "account.auth.management": "Provider management permissions",
        "account.auth.coding-plan": "Coding Plan permissions",
        "account.credentialRef": "Existing credential reference (not a key; optional)",
        "account.secretRef": "Secret environment variable",
        "account.sessionTokenRef": "Session token environment variable",
        "account.teamId": "Team ID",
        "account.projectId": "Project ID",
        "account.workspaceId": "Workspace ID",
        "account.region": "Region",
        "account.billingAccountId": "Billing account ID",
        "account.refPlaceholder": "For example, BILLING_API_KEY",
        "account.idPlaceholder": "Enter account identifier",
        "account.refs": "Credentials: environment variable names only; management APIs need matching permissions.",
        "account.openaiRefs": "Enter an independent OpenAI admin query credential below; the Host stores it separately from model keys.",
        "account.save": "Save query settings",
        "account.saved": "Query settings saved",
        "account.loading": "Loading query methods…",
        "account.retry": "Reload",
        "account.details": "Usage details",
        "account.cap.balance": "Balance",
        "account.cap.spend": "Actual spend",
        "account.cap.tokens": "Usage",
        "account.cap.quota": "Plan allowance",
        "account.cap.pricing": "Model prices",
        "price.title": "Model pricing",
        "price.manual": "Manual reference prices",
        "price.reference": "Official prices (reference page, not an automatic query)",
        "price.api": "API prices",
        "price.unit": "Per 1M tokens",
        "price.currency": "Currency",
        "price.input": "Input",
        "price.output": "Output",
        "price.cacheRead": "Cache read",
        "price.cacheWrite": "Cache write",
        "price.date": "Price date",
        "price.save": "Save manual prices",
        "price.clear": "Remove manual prices",
        "price.saved": "Manual prices saved",
        "price.cleared": "Manual prices removed",
        "price.optional": "Optional",
        "price.estimate": "Estimated cost",
        "account.saving": "Saving…",
        "account.invalidRef": "Enter valid environment variable names, not secret values.",
        "account.invalidId": "Check the account identifier or region format.",
        "price.invalid": "Input/output rates must be nonnegative numbers; currency must be a three-letter uppercase code.",
        "account.unavailableOption": "Not available for this provider",
        "account.selectModel": "Select a model to configure account queries and prices.",

        "settings.title": "Kujira · Personas & Pet",
        "settings.nav": "Kujira · Personas",
        "settings.description": "The AI character follows the selected model.",
        "pet.enabled": "Enable pet",
        "pet.visible": "Show pet character",
        "pet.display": "Display location",
        "pet.display.auto": "Automatic",
        "pet.display.desktop": "Desktop window",
        "pet.display.page": "Inside DSH",
        "pet.scale": "Character size",
        "pet.bubbleScale": "Bubble size",
        "pet.activity": "Activity level",
        "pet.quiet": "Quiet",
        "pet.normal": "Normal",
        "pet.lively": "Lively",
        "bubble.display": "Bubble display",
        "bubble.always": "Always",
        "bubble.tasks": "Working and completed states only",
        "bubble.hidden": "Hidden",
        "pet.reduced": "Reduce motion",
        "pet.sound": "Completion and error sounds",
        "usage.show": "Show account usage",
        "stats.show": "Show work statistics",
        "usage.refresh": "Account usage refresh",
        "usage.manual": "On model change, task completion, or manual refresh",
        "usage.minute": "Every minute",
        "usage.fiveMinutes": "Every five minutes",
        "pet.reset": "Reset pet position",
        "pet.current": "Current character",
        "usage.refreshNow": "Refresh account usage",
        "usage.credentials": "Account queries are configured under Settings → Kujira · Personas → Account & model pricing; the Host stores credentials and the plugin stores references.",
        "settings.loading": "Loading Kujira settings…",
        "archives.title": "World & Character Profiles",
        "archives.description": "Open local folders to view character profiles and memories. Sizes reflect files on disk.",
        "archives.refreshing": "Calculating…",
        "archives.refresh": "Refresh folder sizes",
        "archives.loading": "Loading profile folders…",
        "archives.help": "To change the world, personalities, memories, model bindings, or profile locations, tell the AI in DSH chat. Use this section to view and open folders.",
        "experiments.title": "Experimental Features",
        "diary.title": "AI Diary",
        "diary.enabled": "Enable AI diary",
        "diary.warning": "Enabling this uses additional tokens. Usage is uncontrolled and cannot be estimated.",
        "diary.description": "Each character has a separate space in the selected folder and decides when, what, and how to write.",
        "diary.library": "Diary library",
        "diary.set": "Set diary library",
        "diary.open": "Open diary library",
        "diary.saving": "Saving…",
        "folder.opening": "Opening…",
        "diary.loading": "Loading diary settings…",
        "diary.notLoaded": "Diary settings have not loaded.",
        "diary.reload": "Reload diary settings",
        "diary.saved": "Diary library set.",
        "diary.on": "AI diary enabled.",
        "diary.off": "AI diary disabled.",
        "diary.openRequested": "Requested to open the diary library.",
        "sleep.title": "Sleep Consolidation",
        "sleep.enabled": "Enable sleep consolidation",
        "sleep.description": "When all conversation tasks are idle, the currently selected model organizes the current character's diaries from yesterday and earlier. Background consolidation stops when a new task starts.",
        "sleep.warning": "Automatically calls AI in the background and uses additional tokens. Usage cannot be estimated.",
        "folder.open": "Open folder",
        "stats.aria": "Session work statistics",
        "animation.retry": "Retry loading animation",
        "menu.close": "Close all",
        "menu.dismiss": "Dismiss",
        "menu.hidePet": "Hide pet",
        "menu.showPet": "Show pet",
        "menu.hideBubble": "Hide bubble",
        "menu.showBubble": "Show bubble",
        "menu.sample": "Menu style",
        "error.hostFallback": "The host could not apply this setting. Check the DSH logs.",
        "error.hostDisconnected": "Cannot connect to the DSH host. Check that DSH is still running.",
        "error.hostDenied": "The host rejected the request (HTTP {status}). Reconnect to DSH.",
        "error.hostMissing": "The host menu endpoint is unavailable (HTTP 404). Restart DSH to load the plugin.",
        "error.hostFailed": "The host request failed (HTTP {status}). Check the DSH logs.",
        "usage.reset": "{label} resets: {date}",
        "folder.openAria": "Open {label} folder",
        "usage.seconds": "Every {seconds} seconds",
        "archives.total": "Total profile size: {size}",
        "archives.all": "All character profiles ({count})",
        "animation.aria": "{name} animated pet",
        "task.progress": "{done} / {total} items"
      }
    }
    ctx.effect(()=>locale.register('kujira.ui',clientMessages))
    const t=locale.bind('kujira.ui')
    const uiError=(key,params)=>Object.assign(new Error(t(key,params)),{ui:{key,params}})
    const presentUi=(descriptor,fallback)=>uiRuntime?.renderUi(descriptor,locale.getSnapshot().active)??fallback
    const errorText=error=>error?.ui?presentUi(error.ui,clientMessages.zh[error.ui.key]?t(error.ui.key,error.ui.params):error.message):error?.message??String(error??'')
    const useLocale=()=>useSyncExternalStore(fn=>locale.subscribe(fn),()=>locale.getSnapshot(),()=>locale.getSnapshot())

    let snapshot=null,stream=null,disposed=false,connectionGeneration=0,firstStreamState=true,selectedSessionReady=null,clearSelection=()=>{},syncMenuTheme=()=>{},syncNativeLocale=()=>{},menuThemeSample=null
    const listeners=new Set()
    const adopt=next=>{if(!disposed&&(!snapshot||next.revision>=snapshot.revision)){snapshot=next;for(const fn of listeners)fn()}}
    const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)}
    const get=()=>snapshot
    const call=async(endpoint,payload={})=>{
      const generation=connectionGeneration;let r
      try{r=await ctx.connection.rpc.call('/api','kujira-pet/'+endpoint,payload)}catch(error){
        const status=/HTTP (\d{3})/.exec(error?.message??'')?.[1]
        throw status==='401'||status==='403'?uiError('error.hostDenied',{status}):status==='404'?uiError('error.hostMissing'):status?uiError('error.hostFailed',{status}):uiError('error.hostDisconnected')
      }
      if(!r.ok)throw r.error?.message?Object.assign(new Error(r.error.message),{ui:r.error.ui}):uiError('error.hostFallback')
      if(generation===connectionGeneration&&typeof r.value?.revision==='number'){
        const latest=snapshot&&snapshot.revision>r.value.revision?snapshot:r.value,sessionId=String(payload.sessionId??'')
        if(endpoint==='select'&&r.value.route.sessionId===sessionId&&latest.route.sessionId===sessionId){
          selectedSessionReady={sessionId,revision:r.value.revision}
          // Readiness is local state too: notify with a new reference even if SSE
          // already supplied a newer server revision. Never roll that state back.
          adopt({...latest})
        }else adopt(r.value)
      }return r.value
    }
    const usePet=()=>{useLocale();const state=useSyncExternalStore(subscribe,get,get);return uiRuntime?uiRuntime.projectUiState(state,locale.getSnapshot().active):state}
    ctx.effect(()=>locale.register('kujira.backend',uiRuntime.UI_MESSAGES))
    void call('state').catch(()=>{})
    stream=new EventSource('/api/kujira-pet/events')
    stream.onopen=()=>{connectionGeneration++;firstStreamState=true;selectedSessionReady=null}
    stream.onmessage=event=>{try{const state=JSON.parse(event.data),first=firstStreamState;if(first){snapshot=null;firstStreamState=false}adopt(state);if(first){clearSelection();syncMenuTheme();syncNativeLocale()}}catch{}}
    // Only the foreground client selects the desktop window's display language.
    // Page UI stays local to its own official locale service.
    syncNativeLocale=()=>{if(!disposed&&document.visibilityState!=='hidden'&&document.hasFocus())void call('ui-locale',{locale:locale.getSnapshot().active}).catch(()=>{})}
    const offNativeLocale=locale.subscribe(syncNativeLocale)
    window.addEventListener('focus',syncNativeLocale);document.addEventListener('visibilitychange',syncNativeLocale)
    syncNativeLocale()
    ctx.effect(()=>()=>{offNativeLocale();window.removeEventListener('focus',syncNativeLocale);document.removeEventListener('visibilitychange',syncNativeLocale)})
    const css=`
      .kujira-card{border:1px solid #b8c7d344;border-radius:14px;padding:18px;display:grid;gap:14px;background:var(--surface-color,transparent);font-size:14px}
      .kujira-row{display:flex;align-items:center;justify-content:space-between;gap:18px}.kujira-row input[type=range]{width:145px}
      .kujira-row select,.kujira-card button{border:1px solid #a2aab755;border-radius:8px;padding:6px 10px;background:var(--surface-color,transparent);color:inherit}
      /* Native option popups do not reliably inherit the select colors. Use active Host aliases, not OS preference. */
      .kujira-row select,.kujira-row select option{color-scheme:inherit;background-color:var(--dsw-alias-bg-base,Canvas);color:var(--dsw-alias-label-primary,CanvasText)}
      .kujira-small{font-size:12px;opacity:.7;line-height:1.6}.kujira-bubble{padding:13px 16px;border-radius:18px 18px 4px 18px;background:#fffdf8;color:#293849;box-shadow:0 5px 23px #26344924;border:1px solid #e6ded3;line-height:1.55;font:13px/1.55 system-ui,"Microsoft YaHei",sans-serif;min-width:190px;max-width:245px;pointer-events:auto}
      .kujira-bubble strong{font-size:15px}.kujira-usage{margin-top:8px;padding-top:7px;border-top:1px solid #e8e1d7;color:#526579;font-size:12px}.kujira-pet canvas{display:block;width:100%;user-select:none;-webkit-user-drag:none;touch-action:none}
      .kujira-bubble button{background:none;border:0;color:#64748b;padding:0 2px;cursor:pointer}
      .kujira-settings{display:grid;gap:15px;min-width:0;padding:2px 0 16px}.kujira-card{min-width:0}
      .kujira-card h3{font-size:16px;margin:0}.kujira-card h4{font-size:14px;margin:0}
      .kujira-settings .kujira-row{flex-wrap:wrap;gap:8px}.kujira-settings .kujira-row select{max-width:100%}
      .kujira-account-fields{display:grid;gap:10px;margin-top:12px;min-width:0}.kujira-price-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}.kujira-account-route{overflow-wrap:anywhere}.kujira-account summary{cursor:pointer}.kujira-account a{color:inherit}
      .kujira-folder{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid #a2aab733}
      .kujira-folder:first-child{border-top:0}.kujira-folder-info{min-width:0;flex:1}.kujira-folder-info small{display:block;font-size:11px;opacity:.65;overflow-wrap:anywhere;margin-top:3px}
      .kujira-folder button{flex-shrink:0}.kujira-folder-list{max-height:270px;overflow-y:auto;border-radius:8px}
      .kujira-folder-summary{font-size:13px;font-variant-numeric:tabular-nums}.kujira-muted{opacity:.7}
      .kujira-diary-item{display:grid;gap:14px;min-width:0}
      .kujira-diary-warning{font-size:13px;line-height:1.6;margin:0}
      .kujira-diary-directory{display:grid;gap:7px;min-width:0}.kujira-diary-directory input{box-sizing:border-box;width:100%;min-width:0;border:1px solid var(--dsw-alias-border-l2,#a2aab755);border-radius:8px;padding:8px 10px;background:var(--surface-color,transparent);color:inherit;font:inherit}
      .kujira-diary-actions{display:flex;flex-wrap:wrap;gap:8px}.kujira-diary-actions button:disabled{opacity:.55}
      .kujira-diary-directory input:focus-visible{outline:2px solid var(--dsw-alias-label-primary,currentColor);outline-offset:2px}
    `
    const style=document.createElement('style');style.textContent=css;document.head.appendChild(style)
    function Usage({value,detailed=false}){useLocale();if(value)value=uiRuntime.projectUiState({usage:value},locale.getSnapshot().active).usage;return value&&!value.hidden?h('div',{className:'kujira-usage','data-kujira-usage':value.kind},h('div',null,value.title),...(detailed?(value.details??value.lines):value.lines).map((t,i)=>h('div',{key:i},t)),...(value.windows??[]).filter(w=>w.resetAt).map((w,i)=>h('div',{key:'r'+i},t('usage.reset',{label:w.label,date:new Date(w.resetAt).toLocaleString(ctx.locale.getSnapshot().active)})))):null}
    function WorkStats({value}){useLocale();return value?h('div',{className:'kujira-usage','data-kujira-stats':'session','aria-label':t("stats.aria")},...value.lines.map((line,i)=>h('div',{key:i},line))):null}
    function DiarySettings(){useLocale();
      const [settings,setSettings]=useState(null),[directory,setDirectory]=useState(''),[busy,setBusy]=useState('load'),[error,setError]=useState(''),[notice,setNotice]=useState('')
      const mounted=useRef(false),pending=useRef(false)
      const run=async(action,task)=>{
        if(pending.current)return
        pending.current=true;setBusy(action);setError('');setNotice('')
        try{const result=await task();if(mounted.current)return result}
        catch(e){if(mounted.current)setError(e)}
        finally{pending.current=false;if(mounted.current)setBusy('')}
      }
      const load=()=>run('load',async()=>{const value=await call('diary-settings');if(mounted.current){setSettings(value);setDirectory(value.directory)}})
      useEffect(()=>{mounted.current=true;void load();return()=>{mounted.current=false}},[])
      const save=patch=>run('save',async()=>{
        const value=await call('diary-config',patch)
        if(mounted.current){setSettings(value);if(Object.hasOwn(patch,'directory'))setDirectory(value.directory);setNotice(Object.hasOwn(patch,'directory')?'diary.saved':value.enabled?'diary.on':'diary.off')}
      })
      const open=()=>run('open',async()=>{await call('diary-open-folder');if(mounted.current)setNotice('diary.openRequested')})
      const changed=!!settings&&directory.trim()!==settings.directory
      return h('section',{className:'kujira-diary-item','data-kujira-diary-settings':'true','aria-labelledby':'kujira-diary-title','aria-busy':!!busy},
        h('h4',{id:'kujira-diary-title'},t("diary.title")),
        h('label',{className:'kujira-row'},h('span',null,t("diary.enabled")),h('input',{type:'checkbox',checked:settings?.enabled===true,disabled:!!busy||!settings,'aria-label':t("diary.enabled"),'aria-describedby':'kujira-diary-warning',onChange:e=>void save({enabled:e.target.checked})})),
        h('p',{className:'kujira-diary-warning',id:'kujira-diary-warning'},t("diary.warning")),
        h('div',{className:'kujira-small'},t("diary.description")),
        h('label',{className:'kujira-diary-directory'},h('span',null,t("diary.library")),h('input',{type:'text',value:directory,disabled:!!busy||!settings,'aria-label':t("diary.library"),spellCheck:false,onChange:e=>{setDirectory(e.target.value);setNotice('')}})),
        h('div',{className:'kujira-diary-actions'},
          h('button',{type:'button','aria-label':t("diary.set"),disabled:!!busy||!settings||!changed||!directory.trim(),onClick:()=>void save({directory:directory.trim()})},busy==='save'?t("diary.saving"):t("diary.set")),
          h('button',{type:'button','aria-label':t("diary.open"),title:settings?.directory,disabled:!!busy||!settings,onClick:()=>void open()},busy==='open'?t("folder.opening"):t("diary.open"))),
        !settings?h('div',{className:'kujira-small'},busy==='load'?t("diary.loading"):t("diary.notLoaded")):null,
        error?h('div',{role:'alert'},errorText(error)):null,
        !settings&&!busy?h('button',{type:'button',onClick:()=>void load()},t("diary.reload")):null,
        notice?h('div',{className:'kujira-small',role:'status'},t(notice)):null)
    }
    function SleepSettings(){useLocale();
      const [settings,setSettings]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
      const alive=useRef(false),pending=useRef(false)
      useEffect(()=>{alive.current=true;void call('diary-settings').then(value=>{if(alive.current)setSettings(value)}).catch(e=>{if(alive.current)setError(e)});return()=>{alive.current=false}},[])
      const save=async enabled=>{if(pending.current)return;pending.current=true;setBusy(true);setError('');try{const value=await call('diary-config',{sleepEnabled:enabled});if(alive.current)setSettings(value)}catch(e){if(alive.current)setError(e)}finally{pending.current=false;if(alive.current)setBusy(false)}}
      return h('section',{className:'kujira-diary-item','data-kujira-sleep-settings':'true','aria-labelledby':'kujira-sleep-title',style:{borderTop:'1px solid #a2aab733',paddingTop:16}},
        h('h4',{id:'kujira-sleep-title'},t("sleep.title")),
        h('label',{className:'kujira-row'},h('span',null,t("sleep.enabled")),h('input',{type:'checkbox',checked:settings?.sleepEnabled===true,disabled:busy||!settings,'aria-label':t("sleep.enabled"),'aria-describedby':'kujira-sleep-description kujira-sleep-warning',onChange:e=>void save(e.target.checked)})),
        h('div',{className:'kujira-small',id:'kujira-sleep-description'},t("sleep.description")),
        h('p',{className:'kujira-diary-warning',id:'kujira-sleep-warning'},t("sleep.warning")),
        settings?.sleepStatus?.phase==='error'?h('div',{role:'alert'},presentUi(settings.sleepStatus.ui,settings.sleepStatus.message)):null,
        error?h('div',{role:'alert'},errorText(error)):null)
    }
    function AccountSettings({state,method,pricingOnly=false}){useLocale();
      const provider=state.route.provider,model=state.route.model,routeKey=provider+'/'+model
      const [drafts,setDrafts]=useState({}),[credentialState,setCredentialState]=useState({}),[queryResult,setQueryResult]=useState(null)
      const [info,setInfo]=useState(null),[profile,setProfile]=useState({adapter:'auto'}),[price,setPrice]=useState({currency:'USD'}),[busy,setBusy]=useState('load'),[error,setError]=useState(''),[notice,setNotice]=useState('')
      const alive=useRef(true),pending=useRef(false),loadVersion=useRef(0),credentialVersion=useRef(0)
      const load=async()=>{const version=++loadVersion.current;setBusy('load');setError('');try{const value=await call('usage-info',{provider,model});if(alive.current&&version===loadVersion.current&&value.provider===provider&&value.model===model){setInfo(value);setProfile(method&&method!==value.adapter?{adapter:method}:{...(value.profile??{}),adapter:method??value.profile?.adapter??'auto'});setPrice(value.price??{currency:'USD'})}}catch(e){if(alive.current&&version===loadVersion.current)setError(e)}finally{if(alive.current&&version===loadVersion.current)setBusy('')}}
      useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;loadVersion.current++}},[])
      const adapter=info?.adapters.find(item=>item.id===(profile.adapter==='auto'?(Object.hasOwn(info,'autoAdapter')?info.autoAdapter:info.adapter):profile.adapter))
      const refs=['credentialRef','secretRef','sessionTokenRef'],ids=['teamId','projectId','workspaceId','region','billingAccountId','site','currency']
      const fields=Array.from(new Set(['credentialRef',...(adapter?.requiredFields??[]),...(adapter?.optionalFields??[])])).filter(key=>refs.includes(key)||ids.includes(key))
      const supportsSecrets=!pricingOnly&&!!adapter&&!info?.hostAccount
      const secretFields=supportsSecrets?fields.filter(f=>refs.includes(f)):[]
      const credentialScope=info?.profileKey??provider
      const ownedRefFor=field=>credentialUi.makeQueryCredentialRef(credentialScope,adapter?.id??'none',field)
      const refFor=field=>profile[field]??ownedRefFor(field)
      const refreshCredentialState=async(currentProfile=profile)=>{
        const version=++credentialVersion.current
        const names=[...new Set(secretFields.flatMap(field=>[currentProfile[field]??ownedRefFor(field),ownedRefFor(field)]))],result=await credentialUi.describeQueryCredentials(queryCredentialService(),names)
        if(alive.current&&version===credentialVersion.current)setCredentialState(result.ok?result.value:{})
      }
      useEffect(()=>{setDrafts({});setQueryResult(null)},[adapter?.id,credentialScope])
      const profileRefs=refs.map(field=>profile[field]??'').join('\0')
      useEffect(()=>{setCredentialState({});if(supportsSecrets)void refreshCredentialState();return()=>{credentialVersion.current++}},[adapter?.id,credentialScope,profileRefs])
      const runQuery=async()=>{if(pending.current)return;pending.current=true;setBusy('query');setError('');try{const value=await call('account-query',{provider,model});if(alive.current)setQueryResult(value)}catch{if(alive.current)setError(uiError('account.queryFailed'))}finally{pending.current=false;if(alive.current)setBusy('')}}
      const save=async(kind)=>{
        if(pending.current)return
        setError('');setNotice('')
        const nextProfile={adapter:profile.adapter??'auto'},nextPrice={currency:price.currency,source:'manual'}
        if(kind==='profile'){
          for(const key of [...refs,...ids]){const value=String(profile[key]??'').trim();if(!value)continue;if(!(refs.includes(key)?/^[A-Za-z_][A-Za-z0-9_]*$/:key==='currency'?/^[A-Z]{3}$/:key==='site'?/^(china|international)$/:/^[^\x00-\x1f]+$/).test(value)){setError(uiError(refs.includes(key)?'account.invalidRef':'account.invalidId'));return}nextProfile[key]=value}
        }else if(kind==='price'){
          for(const key of ['input','output','cacheRead','cacheWrite']){const value=String(price[key]??'').trim();if(!value){if(key==='input'||key==='output'){setError(uiError('price.invalid'));return}continue}if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)||!Number.isFinite(Number(value))){setError(uiError('price.invalid'));return}nextPrice[key]=Number(value)}
          if(!/^[A-Z]{3}$/.test(nextPrice.currency??'')){setError(uiError('price.invalid'));return}if(price.date)nextPrice.date=price.date
        }
        pending.current=true;setBusy(kind)
        try{
          if(kind==='profile')for(const field of secretFields){
            if(!drafts[field])continue
            const result=await credentialUi.saveQueryCredential(queryCredentialService(),{provider:credentialScope,adapter:adapter.id,field,value:drafts[field],protectedRefs:[info.inferenceCredentialRef].filter(Boolean)})
            if(!result.ok)throw uiError('account.credentialSaveFailed')
            nextProfile[field]=result.ref
            if(alive.current){setDrafts(old=>({...old,[field]:''}));setProfile(old=>({...old,[field]:result.ref}))}
          }
          const config=get()?.config??state.config;let patch;if(kind==='profile')patch={usageProfiles:{...config.usageProfiles,[info.profileKey??provider]:nextProfile}};else{const prices={...config.modelPrices};if(kind==='clear')delete prices[routeKey];else prices[routeKey]=nextPrice;patch={modelPrices:prices}}await call('config',patch);if(kind==='profile'){await refreshCredentialState(nextProfile);try{const fresh=await call('usage-info',{provider,model});if(alive.current&&fresh.provider===provider&&fresh.model===model)setInfo(fresh)}catch{}}if(alive.current){if(kind==='clear')setPrice({currency:'USD'});if(kind==='profile')setQueryResult(null);setNotice(kind==='profile'?'account.saved':kind==='clear'?'price.cleared':'price.saved')}}catch(e){if(alive.current)setError(e)}finally{pending.current=false;if(alive.current)setBusy('')}
      }
      const input=(key,label,value,onChange,props={})=>h('label',{className:'kujira-diary-directory',key},h('span',null,label),h('input',{type:'text',value:value??'',disabled:!!busy,'aria-label':label,spellCheck:false,autoComplete:'off',onChange:e=>{onChange(e.target.value);setNotice('')},...props}))
      const button=(kind,label)=>h('button',{type:'button',disabled:!!busy||!info,onClick:()=>void save(kind)},busy===kind?t('account.saving'):t(label))
      const apiPrice=(queryResult??state.usage)?.prices?.find(item=>item.model===model)
      return h('section',{className:'kujira-card kujira-account',...(pricingOnly?{'data-kujira-model-pricing':true}:{'data-kujira-account-settings':true})},
        h('details',{open:!pricingOnly},h('summary',null,t(pricingOnly?'price.title':'account.title')),
          h('div',{className:'kujira-account-fields'},
            h('div',{className:'kujira-small kujira-account-route'},t('account.route')+': '+provider+' / '+model),
            !info?h('div',{role:'status'},busy==='load'?t('account.loading'):t('account.noCapabilities')):null,
            info?h(React.Fragment,null,
              !pricingOnly?h(React.Fragment,null,
              h('div',{className:'kujira-small'},t('account.endpoint')+': '+(info.origin??t('account.hostEndpoint'))),
              h('div',{className:'kujira-small'},(adapter?.thirdParty?t('account.thirdParty')+' · ':'')+(adapter?.label??'')),
              adapter?h('p',{className:'kujira-small','data-kujira-setup-guide':adapter.id},t('account.guide.'+adapter.id)):null,
              h('div',{className:'kujira-small'},adapter?t('account.capabilities')+': '+adapter.capabilities.map(cap=>t('account.cap.'+cap)).join(' · '):t('account.noCapabilities')),
              adapter?.docsUrl&&/^https:\/\//.test(adapter.docsUrl)?h('a',{href:adapter.docsUrl,target:'_blank',rel:'noopener noreferrer'},t(adapter?.thirdParty?'account.compatReference':'account.reference')):null,
              profile.adapter!=='none'&&adapter&&!info.hostAccount?h(React.Fragment,null,...fields.map(key=>key==='site'?h('label',{className:'kujira-row',key},h('span',null,t('account.site')),h('select',{'aria-label':t('account.site'),value:profile.site??'',disabled:!!busy,onChange:e=>{setProfile({...profile,site:e.target.value});setNotice('')}},h('option',{value:''},t('account.choose')),...['china','international'].map(value=>h('option',{key:value,value},t('account.site.'+value))))):input(key,t('account.'+key),profile[key],value=>setProfile({...profile,[key]:value}),{placeholder:t(refs.includes(key)?'account.refPlaceholder':key==='currency'?'account.currencyPlaceholder':'account.idPlaceholder')})),h('div',{className:'kujira-small'},t(adapter?.auth==='inference'?'account.reuse':'account.independent')),
                ...secretFields.map(field=>h('div',{key:'secret-'+field,className:'kujira-account-secret'},
                  h('label',{className:'kujira-diary-directory'},h('span',null,t(adapter?.auth==='signed'?'account.secretLabel.'+field:'account.secretLabel.key')),h('input',{type:'password','aria-label':t(adapter?.auth==='signed'?'account.secretLabel.'+field:'account.secretLabel.key'),value:drafts[field]??'',autoComplete:'new-password',spellCheck:false,disabled:!!busy||!credentialState[ownedRefFor(field)]?.writable,onChange:e=>setDrafts({...drafts,[field]:e.target.value})})),
                  h('div',{className:'kujira-small',role:'status'},t(credentialState[refFor(field)]?.configured?'account.secretConfigured':credentialState[ownedRefFor(field)]?.writable?'account.secretEmpty':'account.secretUnavailable')))),
                h('div',{className:'kujira-small'},t('account.secretHandling'))):null,
              h('div',{className:'kujira-diary-actions'},button('profile','account.save'),h('button',{type:'button',disabled:!!busy||!adapter||profile.adapter==='none',onClick:()=>void runQuery()},t('account.queryNow'))),
              queryResult?h(Usage,{value:queryResult,detailed:true}):null,
              state.usage?h('details',null,h('summary',null,t('account.details')),h(Usage,{value:state.usage,detailed:true})):null):null,
              pricingOnly?h(React.Fragment,null,h('h4',null,t('price.title')),h('div',{className:'kujira-small'},t('price.manual')+' · '+t('price.unit')),
              info.pricingReference?.kind==='reference-only'&&/^https:\/\//.test(info.pricingReference.url)?h('a',{href:info.pricingReference.url,target:'_blank',rel:'noopener noreferrer'},t('price.reference')):null,
              apiPrice?h('div',{className:'kujira-small'},t('price.api')+': '+apiPrice.currency+' · '+t('price.input')+' '+apiPrice.input+' / '+t('price.output')+' '+apiPrice.output+' · '+t('price.unit')):null,
              h('div',{className:'kujira-price-grid'},...['currency','input','output','cacheRead','cacheWrite','date'].map(key=>input(key,t('price.'+key),price[key],value=>setPrice({...price,[key]:value}),key==='date'?{type:'date'}:key==='currency'?{maxLength:3,placeholder:'USD'}:{inputMode:'decimal',placeholder:key==='input'||key==='output'?'0':t('price.optional')}))),
              h('div',{className:'kujira-diary-actions'},button('price','price.save'),button('clear','price.clear'))):null):null,
            !info&&!busy?h('button',{type:'button',onClick:()=>void load()},t('account.retry')):null,
            error?h('div',{role:'alert'},errorText(error)):null,notice?h('div',{role:'status'},t(notice)):null)))
    }
    function AccountTargetSettings({state}){useLocale();
      const [options,setOptions]=useState([]),[selected,setSelected]=useState(''),[loading,setLoading]=useState(true)
      useEffect(()=>{let active=true,off=()=>{},version=0
        const update=async groups=>{const current=++version;const routes=groups.flatMap(p=>(p.models??[]).map(m=>({provider:p.id,model:m.id})))
          const infos=await Promise.all(routes.map(route=>call('usage-info',route).catch(()=>null)))
          if(!active||current!==version)return
          const next=accountOptions.accountConfigurationOptions(infos);setOptions(next);setSelected(old=>next.some(o=>o.key===old)?old:(next.find(o=>o.provider===state.route.provider)?.key??next[0]?.key??''));setLoading(false)
        }
        try{const service=ctx.get?.('modelDirectories');const directory=state.route.sessionId&&service?.directoryFor(state.route.sessionId)
          if(directory){const refresh=()=>void update(directory.store.getSnapshot().groups??[]);off=directory.store.subscribe(refresh);void directory.load().then(refresh).catch(()=>update([{id:state.route.provider,models:[{id:state.route.model}]}]))}
          else void update([{id:state.route.provider,models:[{id:state.route.model}]}])
        }catch{void update([{id:state.route.provider,models:[{id:state.route.model}]}])}
        return()=>{active=false;version++;off()}
      },[state.route.sessionId,state.route.provider,state.route.model])
      const target=options.find(o=>o.key===selected)
      if(!loading&&!options.length)return null
      return h('section',{'data-kujira-account-setup':true},h('div',{className:'kujira-card'},
        h('label',{className:'kujira-row'},h('span',null,t('account.setupMethod')),h('select',{'aria-label':t('account.setupMethod'),value:selected,disabled:loading,onChange:e=>setSelected(e.target.value)},...options.map(o=>h('option',{key:o.key,value:o.key},(o.thirdParty?t('account.thirdParty')+' · ':'')+o.label+' · '+t('account.auth.'+o.auth)+' · '+o.provider+(o.detail?' · '+o.detail:'')+(o.connectionNumber?' · '+t('account.connectionNumber',{number:o.connectionNumber}):''))))),
        h('div',{className:'kujira-small'},t('account.targetHelp'))),
        target?h(AccountSettings,{key:target.key,method:target.adapter,state:{...state,route:{...state.route,provider:target.provider,model:target.model},usage:target.provider===state.route.provider&&target.model===state.route.model?state.usage:null}}):null)
    }
    function Settings(){useLocale();
      const s=usePet(),[error,setError]=useState(''),[busy,setBusy]=useState(false)
      const [folders,setFolders]=useState(null),[folderError,setFolderError]=useState(''),[folderBusy,setFolderBusy]=useState('')
      const [folderLoading,setFolderLoading]=useState(false)
      const loadFolders=async()=>{setFolderLoading(true);setFolderError('');try{setFolders(await call('folders'))}catch(e){setFolderError(e)}finally{setFolderLoading(false)}}
      useEffect(()=>{let alive=true;void call('folders').then(value=>{if(alive)setFolders(value)}).catch(e=>{if(alive)setFolderError(e)});return()=>{alive=false}},[])
      const openFolder=async id=>{setFolderBusy(id);setFolderError('');try{await call('open-folder',{id});await loadFolders()}catch(e){setFolderError(e)}finally{setFolderBusy('')}}
      const bytes=n=>{if(!Number.isFinite(n))return '—';if(n<1024)return n+' B';const unit=n<1024*1024?'KB':'MB',value=n/(unit==='KB'?1024:1024*1024);return value.toLocaleString(ctx.locale.getSnapshot().active,{maximumFractionDigits:2})+' '+unit}
      const folderRow=item=>h('div',{className:'kujira-folder',key:item.id},
        h('div',{className:'kujira-folder-info'},h('div',null,h('strong',null,presentUi(item.labelUi,item.label)),h('span',{className:'kujira-muted'},' · '+bytes(item.bytes))),h('small',{title:item.path},item.path)),
        h('button',{type:'button',disabled:!!folderBusy,onClick:()=>void openFolder(item.id),'aria-label':t('folder.openAria',{label:presentUi(item.labelUi,item.label)})},folderBusy===item.id?t("folder.opening"):t("folder.open")))
      const visibleCharacters=(folders?.characters??[]).filter(item=>!item.hidden&&item.id!=='role:stella')
      const row=(label,control)=>h('label',{className:'kujira-row',key:label},h('span',null,label),control)
      const write=async patch=>{setBusy(true);setError('');try{await call('config',patch)}catch(e){setError(e)}finally{setBusy(false)}}
      const toggle=(key,label)=>row(label,h('input',{type:'checkbox',checked:s.config[key],'aria-label':label,disabled:busy,onChange:e=>void write({[key]:e.target.checked})}))
      const choice=(key,label,options)=>{const values=key==='refreshSeconds'&&!options.some(([v])=>v===String(s.config[key]))?[...options,[String(s.config[key]),t('usage.seconds',{seconds:s.config[key]})]]:options;return row(label,h('select',{'aria-label':label,value:s.config[key],disabled:busy,onChange:e=>void write({[key]:key==='refreshSeconds'?Number(e.target.value):e.target.value})},...values.map(([v,t])=>h('option',{key:v,value:v},t))))}
      const range=(key,label,min,max)=>row(label,h('span',null,h('input',{'aria-label':label,type:'range',min,max,step:.05,value:s.config[key],onChange:e=>void write({[key]:Number(e.target.value)})}),h('small',{'data-kujira-scale-value':key},' '+s.config[key]+'×')))
      return h('div',{className:'kujira-settings','aria-label':t("settings.title")},
        s?h('section',{className:'kujira-card'},
          h('h3',null,t("settings.title")),
          h('div',{className:'kujira-small'},t("settings.description")),
          toggle('enabled',t("pet.enabled")),toggle('showPet',t("pet.visible")),
          choice('display',t("pet.display"),[['auto',t("pet.display.auto")],['desktop',t("pet.display.desktop")],['page',t("pet.display.page")]]),
          range('scale',t("pet.scale"),.55,1.6),range('bubbleScale',t("pet.bubbleScale"),.8,1.4),
          choice('activity',t("pet.activity"),[['quiet',t("pet.quiet")],['normal',t("pet.normal")],['lively',t("pet.lively")]]),
          choice('bubble',t("bubble.display"),[['always',t("bubble.always")],['tasks',t("bubble.tasks")],['hidden',t("bubble.hidden")]]),
          toggle('reducedMotion',t("pet.reduced")),toggle('sound',t("pet.sound")),toggle('showUsage',t("usage.show")),toggle('showStats',t("stats.show")),
          choice('refreshSeconds',t("usage.refresh"),[['0',t("usage.manual")],['60',t("usage.minute")],['300',t("usage.fiveMinutes")]]),
          h('button',{type:'button',disabled:busy,onClick:()=>void write({x:null,y:null,pageRight:null,pageBottom:null,desktopX:null,desktopY:null})},t("pet.reset")),
          row(t("pet.current"),h('span',null,s.route.name+(s.route.model?' · '+s.route.model:''))),
          s.nativeError?h('div',{role:'status'},s.nativeError):null,
          s.config.enabled&&s.config.showUsage?h(React.Fragment,null,h(Usage,{value:s.usage}),h('button',{type:'button',disabled:busy,onClick:async()=>{setBusy(true);try{await call('refresh')}catch(e){setError(e)}finally{setBusy(false)}}},t("usage.refreshNow"))):null,

          error?h('div',{role:'alert'},errorText(error)):null):h('section',{className:'kujira-card'},t("settings.loading")),
        s?.route.provider&&s?.route.model?h(AccountSettings,{key:'pricing-'+s.route.provider+'/'+s.route.model,state:s,pricingOnly:true}):null,
        h('section',{className:'kujira-card'},
          h('h3',null,t("archives.title")),
          h('div',{className:'kujira-small'},t("archives.description")),
          folders?h('div',{className:'kujira-folder-summary'},h('strong',null,t('archives.total',{size:bytes(folders.totalBytes)})),h('div',{className:'kujira-small'},folders.groups.map(g=>presentUi(g.labelUi,g.label)+' '+bytes(g.bytes)).join(' · '))):null,
          h('button',{type:'button',disabled:folderLoading||!!folderBusy,onClick:()=>void loadFolders()},folderLoading?t("archives.refreshing"):t("archives.refresh")),
          folders?h('div',null,...folders.groups.map(folderRow)):h('div',{className:'kujira-small'},t("archives.loading")),
          folders?h('details',null,h('summary',null,t('archives.all',{count:visibleCharacters.length})),h('div',{className:'kujira-folder-list'},...visibleCharacters.map(folderRow))):null,
          folderError?h('div',{role:'alert'},errorText(folderError)):null,
          h('div',{className:'kujira-small'},t("archives.help"))),
        h('section',{className:'kujira-card','aria-labelledby':'kujira-experiments-title'},h('h3',{id:'kujira-experiments-title'},t("experiments.title")),h(DiarySettings),h(SleepSettings)),
        s?.route.provider&&s?.route.model?h(AccountTargetSettings,{state:s}):null)
    }
    function Sprite({state,controls}){useLocale();
      const canvas=useRef(null),hitSvg=useRef(null),hitPath=useRef(null),renderer=useRef(null),current=useRef(state),[ready,setReady]=useState(false)
      const failed=useRef(false),[retry,setRetry]=useState(0),[loadError,setLoadError]=useState(false)
      current.current=state
      useEffect(()=>{
        let closed=false,view=null;const abort=new AbortController();failed.current=false;setReady(false);setLoadError(false);hitPath.current?.setAttribute('d','')
        const module=spriteModule??=import('/api/kujira-pet/sprite-canvas.js'+(spriteAttempt?'?retry='+spriteAttempt:'')).catch(error=>{spriteModule=null;spriteAttempt++;throw error})
        void Promise.all([module,fetch('/api/kujira-pet/art?id='+encodeURIComponent(state.route.art),{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error('Animation manifest unavailable');return r.json()})]).then(async([runtime,art])=>{
          if(closed)return
          if(!art)throw new Error('Animation manifest unavailable')
          view=new runtime.SpriteCanvas(canvas.current,art.manifest,art.urls,{onHitPath:({path,width,height})=>{if(closed)return;hitSvg.current?.setAttribute('viewBox',`0 0 ${width} ${height}`);hitPath.current?.setAttribute('d',path)}});renderer.current=view;controls.current=view
          view.update(current.current.task,current.current.config,current.current.route.sessionId)
          await view.ready
          if(!closed)setReady(true)
        }).catch(()=>{if(!closed){failed.current=true;setLoadError(true)}view?.dispose();if(renderer.current===view)renderer.current=null;if(controls.current===view)controls.current=null})
        return()=>{closed=true;abort.abort();hitPath.current?.setAttribute('d','');view?.dispose();if(renderer.current===view)renderer.current=null;if(controls.current===view)controls.current=null}
      },[state.route.art,connectionGeneration,retry])
      // Retry a failed load only on a subsequent user/task transition, never on a timer.
      useEffect(()=>{if(failed.current){failed.current=false;setRetry(value=>value+1)}},[state.route.model,state.route.sessionId,state.task.phase,state.task.activity])
      useEffect(()=>renderer.current?.update(state.task,state.config,state.route.sessionId),[state])
      return h('div',{style:{position:'relative',aspectRatio:'320 / 380'}},
        h('canvas',{ref:canvas,width:320,height:380,'aria-label':t('animation.aria',{name:state.route.name}),style:{visibility:ready?'visible':'hidden',pointerEvents:'none'}}),
        h('svg',{ref:hitSvg,'aria-hidden':true,focusable:false,viewBox:'0 0 320 380',preserveAspectRatio:'none',style:{position:'absolute',inset:0,width:'100%',height:'100%',visibility:ready?'visible':'hidden',pointerEvents:'none'}},h('path',{ref:hitPath,fill:'transparent',stroke:'none',style:{pointerEvents:'visibleFill'}})),
        loadError?h('button',{type:'button',style:{pointerEvents:'auto'},onClick:()=>{failed.current=false;setRetry(value=>value+1)}},t("animation.retry")):null)
    }
    function Pet(){useLocale();
      const s=usePet(),[position,setPosition]=useState(null),[leader,setLeader]=useState(!navigator.locks),[viewport,setViewport]=useState(()=>[window.innerWidth,window.innerHeight])
      const root=useRef(null),bubbleElement=useRef(null),[extent,setExtent]=useState({width:190,height:226}),[bubbleSize,setBubbleSize]=useState({width:277,height:100}),[menu,setMenu]=useState(null),[menuError,setMenuError]=useState('')
      const anchorInitialized=useRef(false),drag=useRef(null),controls=useRef(null),previous=useRef('idle'),previousPulse=useRef(null),audio=useRef(null)
      const enabled=!!s?.config.enabled&&s.renderer==='page'
      useEffect(()=>{if(!enabled)return;let release,aborted=false;const abort=new AbortController();if(!navigator.locks){setLeader(true);return()=>setLeader(false)}
      if(navigator.locks)void Promise.resolve().then(()=>navigator.locks.request('kujira-one-page-pet',{signal:abort.signal},async()=>{if(aborted)return;setLeader(true);await new Promise(r=>{release=r});setLeader(false)})).catch(()=>{if(!aborted&&!abort.signal.aborted)setLeader(true)});return()=>{aborted=true;abort.abort();release?.();setLeader(false)}},[enabled])
      useEffect(()=>{const phase=s?.task.phase,pulse=s?.task.pulse,temporaryError=pulse?.kind==='error'&&pulse.id!==previousPulse.current;if(enabled&&s.config.sound&&((previous.current!==phase&&['completed','error'].includes(phase))||temporaryError)){try{const Audio=window.AudioContext??window.webkitAudioContext;const a=audio.current??=new Audio(),o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.onended=()=>{o.disconnect();g.disconnect()};o.frequency.value=phase==='completed'?660:330;g.gain.setValueAtTime(.035,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.15);o.start();o.stop(a.currentTime+.16)}catch{}}previous.current=phase??'idle';previousPulse.current=pulse?.id??null},[s?.task.phase,s?.task.pulse?.id,enabled,s?.config.sound])
      useEffect(()=>{if(!enabled)return;const resize=()=>setViewport([window.innerWidth,window.innerHeight]);resize();window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize)},[enabled])
      const selectionReady=selectedSessionReady
      const savedAnchor=s?.config.pageRight!=null&&s?.config.pageBottom!=null?{right:s.config.pageRight,bottom:s.config.pageBottom}:null
      const anchor=position??savedAnchor
      useEffect(()=>{anchorInitialized.current=false;setPosition(savedAnchor)},[s?.config.x,s?.config.y,s?.config.pageRight,s?.config.pageBottom])
      useEffect(()=>()=>{void audio.current?.close()},[])
      const showPet=s?.config.showPet!==false,bubble=!!s&&s.config.bubble!=='hidden'&&(s.config.bubble==='always'||s.task.phase!=='idle')
      useEffect(()=>{
        if(!enabled||!leader)return
        const measure=()=>{
          if(bubbleElement.current){const el=bubbleElement.current;setBubbleSize(old=>old.width===el.offsetWidth&&old.height===el.offsetHeight?old:{width:el.offsetWidth,height:el.offsetHeight})}
          if(root.current){
            const rect=root.current.getBoundingClientRect();setExtent(old=>old.width===rect.width&&old.height===rect.height?old:{width:rect.width,height:rect.height})
            // Persisted x/y are legacy root top-left coordinates. Once the bubble is
            // measured, keep its visible bottom-right in memory so text cannot move the pet.
            const el=bubbleElement.current
            if(!anchorInitialized.current&&!savedAnchor&&selectionReady?.sessionId&&selectionReady.sessionId===s.route.sessionId&&s.revision>=selectionReady.revision&&s.config.x!=null&&(!bubble||el&&el.offsetWidth===bubbleSize.width&&el.offsetHeight===bubbleSize.height)){
              anchorInitialized.current=true;const next={right:rect.left+rect.width,bottom:rect.top+rect.height};setPosition(next)
              // Use readiness captured by this render, not a newly resolved global value.
              // Empty startup selection has no canonical session layout to migrate.
              // The existing select response completes initial history hydration.
              // Migrate once afterwards, never on subsequent text/size changes.
              void call('config',{pageRight:next.right,pageBottom:next.bottom}).catch(error=>setMenuError(error))
            }
          }
        }
        measure();const observer=new ResizeObserver(measure)
        if(root.current)observer.observe(root.current)
        if(bubbleElement.current)observer.observe(bubbleElement.current)
        return()=>observer.disconnect()
      },[enabled,leader,showPet,bubble,s?.config.scale,s?.config.bubbleScale,s?.config.x,s?.config.y,s?.config.pageRight,s?.config.pageBottom,selectionReady,bubbleSize.width,bubbleSize.height,viewport[0],viewport[1]])
      useEffect(()=>{const d=drag.current;drag.current=null;if(d?.moved&&d.sprite)controls.current?.endDrag();if(!enabled||!leader){setMenu(null);setMenuError('')}},[enabled,leader,showPet,bubble])
      if(!enabled||!leader)return null
      const availableHeight=Math.min(viewport[1],anchor?.bottom??viewport[1])
      const width=190*s.config.scale
      const clamp=p=>({x:Math.max(0,Math.min(p.x,viewport[0]-extent.width)),y:Math.max(0,Math.min(p.y,viewport[1]-extent.height))})
      const pos=anchor?{x:anchor.right-extent.width,y:anchor.bottom-extent.height}:(s.config.x!=null?{x:s.config.x,y:s.config.y??20}:null)
      const down=e=>{if(e.button!==0||drag.current||e.target.closest?.('button'))return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const rect=root.current.getBoundingClientRect();drag.current={pointerId:e.pointerId,x:e.clientX,y:e.clientY,left:rect.left,top:rect.top,moved:false,sprite:e.currentTarget.dataset.kujiraDrag==='sprite'}}
      const move=e=>{const d=drag.current;if(!d||d.pointerId!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(!d.moved&&Math.abs(dx)+Math.abs(dy)>3){d.moved=true;if(d.sprite)controls.current?.startDrag()}if(!d.moved)return;const pos=clamp({x:d.left+dx,y:d.top+dy});d.position=pos;setPosition({right:pos.x+extent.width,bottom:pos.y+extent.height})}
      const finish=(e,cancel=false)=>{const d=drag.current;if(!d||d.pointerId!==e.pointerId)return;drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(d.moved){if(d.sprite)controls.current?.endDrag();if(d.position)void call('config',{...d.position,pageRight:d.position.x+extent.width,pageBottom:d.position.y+extent.height}).catch(error=>setMenuError(error))}else if(!cancel&&d.sprite){const rect=e.currentTarget.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height;controls.current?.interact(y<.45?'head_pat':x>.72&&y>.55?'tail':'poke')}}
      const handlers={onPointerDown:down,onPointerMove:move,onPointerUp:e=>finish(e),onPointerCancel:e=>finish(e,true),onLostPointerCapture:e=>finish(e,true)}
      const writeMenu=async patch=>{setMenu(null);setMenuError('');try{await call('config',patch)}catch(error){setMenuError(error)}}
      const select=id=>{const patch=id==='pet'?{showPet:!showPet}:id==='bubble'?{bubble:s.config.bubble==='hidden'?s.config.bubbleBeforeHidden:'hidden'}:{enabled:false};void writeMenu(patch)}
      return h(React.Fragment,null,
        showPet||bubble?h('div',{ref:root,className:'kujira-pet','data-kujira-pet':'single','data-persona':s.route.persona,'data-phase':s.task.phase,onContextMenu:e=>{e.preventDefault();e.stopPropagation();setMenu({x:e.clientX,y:e.clientY})},style:{position:'fixed',zIndex:900,display:'flex',flexDirection:'column',alignItems:'flex-end',...(anchor?{right:viewport[0]-Math.max(Math.min(extent.width,viewport[0]),Math.min(anchor.right,viewport[0])),bottom:viewport[1]-Math.max(Math.min(extent.height,viewport[1]),Math.min(anchor.bottom,viewport[1]))}:pos?{left:clamp(pos).x,top:clamp(pos).y}:{right:Math.min(22,Math.max(0,viewport[0]-extent.width)),bottom:Math.min(18,Math.max(0,viewport[1]-extent.height))}),pointerEvents:'none'}},
          bubble?h('div',{style:{position:'relative',width:bubbleSize.width*s.config.bubbleScale,height:bubbleSize.height*s.config.bubbleScale}},
            h('div',{ref:bubbleElement,className:'kujira-bubble','data-kujira-drag':'bubble',...handlers,style:{position:'absolute',bottom:0,right:0,transform:'scale('+s.config.bubbleScale+')',transformOrigin:'bottom right',boxSizing:'border-box',minWidth:0,width:277,maxWidth:viewport[0]/s.config.bubbleScale,maxHeight:Math.max(0,(availableHeight-(showPet?width*380/320:0))/s.config.bubbleScale),overflowY:'auto',overflowWrap:'anywhere',cursor:'grab',touchAction:'none'},'aria-live':'polite'},
              h('div',{style:{display:'flex',justifyContent:'space-between',gap:8}},h('strong',null,s.route.name),h('button',{'aria-label':t("menu.close"),onClick:()=>void writeMenu({enabled:false})},'×')),
              h('div',null,s.task.text),s.task.progress?h('div',null,t('task.progress',{done:s.task.progress.done,total:s.task.progress.total})):null,
              s.config.showStats&&s.task.phase!=='idle'?h(WorkStats,{value:s.stats}):null,h(Usage,{value:s.usage}))):null,
          showPet?h('div',{'data-kujira-drag':'sprite',...handlers,style:{width,pointerEvents:'none',cursor:drag.current?'grabbing':'grab',touchAction:'none'}},h(Sprite,{state:s,controls})):null):null,
        menuError?h('div',{role:'alert','data-kujira-menu-error':'',style:{position:'fixed',left:16,bottom:16,zIndex:1200,maxWidth:'min(420px, calc(100vw - 32px))',padding:'12px 16px',borderRadius:12,background:'var(--dsw-alias-bg-base)',color:'var(--dsw-alias-label-primary)',border:'1px solid var(--dsw-alias-border-l1)',pointerEvents:'auto'}},errorText(menuError),h('button',{type:'button',onClick:()=>setMenuError(''),style:{marginLeft:10},'aria-label':t("menu.dismiss")},t("menu.dismiss"))):null,
        h(Menu,{open:!!menu,anchor:null,portal:true,getAnchorRect:()=>new DOMRect(menu?.x??0,menu?.y??0,0,0),items:[{id:'pet',label:showPet?t("menu.hidePet"):t("menu.showPet")},{id:'bubble',label:s.config.bubble==='hidden'?t("menu.showBubble"):t("menu.hideBubble")},{id:'close',label:t("menu.close")}],onSelect:select,onClose:()=>setMenu(null)}))
    }

    // Non-interactive public primitives only: a real Menu would install keyboard handlers.
    function MenuThemeSample(){useLocale();
      const sample=useRef(null)
      useEffect(()=>{const node=sample.current;node.inert=true;menuThemeSample=node;syncMenuTheme();return()=>{if(menuThemeSample===node)menuThemeSample=null}},[])
      return h('div',{ref:sample,'aria-hidden':true,'data-kujira-menu-sample':'',style:{position:'fixed',left:-10000,top:0,visibility:'hidden',pointerEvents:'none'}},
        h(MenuSurface,{style:{visibility:'hidden',padding:4,minWidth:144,boxSizing:'border-box','--dsw-elevation-stroke-color':'var(--dsw-alias-border-l1)',boxShadow:'var(--dsw-elevation-prominent)'}},h(MenuItemButton,{onSelect:()=>{}},t("menu.sample"))))
    }

    // Read the host's resolved public menu tokens after ThemePresenter updates body.
    // WPF adapts the public primitives' resolved geometry and palette, not arbitrary CSS effects.
    ctx.inject(['theme'],scope=>{
      let frame,queued=null,sending=false,closed=false
      const send=async theme=>{queued=theme;if(sending)return;sending=true;try{while(queued&&!closed){const next=queued;queued=null;await call('menu-theme',next).catch(()=>{})}}finally{sending=false}}
      const sync=()=>{if(closed)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
        const surface=menuThemeSample?.querySelector('[data-menu-material]'),item=menuThemeSample?.querySelector('[role=menuitem]');if(!surface||!item)return
        const probe=document.createElement('span'),canvas=document.createElement('canvas');canvas.width=canvas.height=1
        const paint=canvas.getContext('2d');if(!paint)return
        probe.style.cssText='position:fixed;visibility:hidden;pointer-events:none';document.body.appendChild(probe)
        const color=token=>{probe.style.color='var('+token+')';return getComputedStyle(probe).color}
        const solid=(base,overlay)=>{paint.clearRect(0,0,1,1);paint.fillStyle=base;paint.fillRect(0,0,1,1);if(overlay){paint.fillStyle=overlay;paint.fillRect(0,0,1,1)}return '#'+Array.from(paint.getImageData(0,0,1,1).data).slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('')}
        try{
          const surfaceStyle=getComputedStyle(surface),itemStyle=getComputedStyle(item)
          const background=solid(color('--dsw-alias-bg-base'),getComputedStyle(surface.firstElementChild).backgroundColor),foreground=solid(background,itemStyle.color)
          const edges=(style,prefix,suffix='')=>['Top','Right','Bottom','Left'].map(edge=>parseFloat(style[prefix+edge+suffix])||0)
          const radii=el=>{const style=getComputedStyle(el),rect=el.getBoundingClientRect(),length=(value,size)=>parseFloat(value)*(value.endsWith('%')?size/100:1);return ['TopLeft','TopRight','BottomRight','BottomLeft'].map(corner=>{const parts=style['border'+corner+'Radius'].split(' ');return Math.min(length(parts[0],rect.width),length(parts[1]??parts[0],rect.height))})}
          // Official Menu adds 4px inset/min-width 144px to MenuSurface. Its border
          // is the zero-offset elevation hairline, not a CSS border-width.
          const shadows=surfaceStyle.boxShadow.split(/,(?![^()]*\))/),stroke=shadows.map(value=>value.includes('inset')?[]:(value.match(/-?[\d.]+px/g)??[]).map(parseFloat)).find(values=>values.length>=4&&values.slice(0,3).every(value=>value===0))?.[3]??0
          const geometry={surfaceShadow:surfaceStyle.boxShadow,surfaceRadius:radii(surface),surfacePadding:edges(surfaceStyle,'padding'),surfaceBorderWidth:edges(surfaceStyle,'border','Width').map(value=>value+Math.max(0,stroke)),surfaceMinWidth:parseFloat(surfaceStyle.minWidth)||0,itemRadius:radii(item),itemPadding:edges(itemStyle,'padding'),itemMinHeight:parseFloat(itemStyle.minHeight)||0,fontFamily:itemStyle.fontFamily,fontSize:parseFloat(itemStyle.fontSize),fontWeight:itemStyle.fontWeight==='bold'?700:parseFloat(itemStyle.fontWeight)||400,lineHeight:parseFloat(itemStyle.lineHeight)||item.firstElementChild.getBoundingClientRect().height}
          void send({background,foreground,border:solid(background,color('--dsw-alias-border-l1')),hover:solid(background,color('--dsw-alias-interactive-bg-hover')),hoverForeground:foreground,geometry})
        }catch{}finally{probe.remove()}
      })}
      const observer=new MutationObserver(sync);observer.observe(document.body,{attributes:true,attributeFilter:['style','class','data-ds-dark-theme']})
      const styles=new MutationObserver(sync);styles.observe(document.head,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['href','media','disabled']});document.head.addEventListener('load',sync,true)
      const visible=()=>{if(document.visibilityState!=='hidden')sync()}
      syncMenuTheme=sync;sync();scope.on('theme/change',sync);document.addEventListener('visibilitychange',visible)
      scope.effect(()=>()=>{closed=true;queued=null;observer.disconnect();styles.disconnect();document.head.removeEventListener('load',sync,true);cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visible);if(syncMenuTheme===sync)syncMenuTheme=()=>{}})
    })
    ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'kujira-persona',order:85,label:()=>t("settings.nav"),locale:'kujira.ui',inject:()=>({})},Settings))
    ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'kujira-menu-theme-sample',order:0,inject:()=>({})},MenuThemeSample))
    ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'kujira-one-pet',order:900},Pet))
    ctx.inject(['modelDirectories','sessions','remote','remote.session','uiSession'],scope=>{
      const selection=scope.uiSession.adapter.current
      let stopped=false,directory=null,sessionId,offDirectory=()=>{},lastSelect,lastDiary
      const pendingWrites=new Map();let sending=false
      const forget=({key,wire})=>{if(key==='select'){if(lastSelect===wire)lastSelect=undefined}else if(lastDiary===wire)lastDiary=undefined}
      const flush=async()=>{
        if(sending||stopped)return
        sending=true
        try{while(!stopped&&document.visibilityState!=='hidden'&&pendingWrites.size){
          const [key,item]=pendingWrites.entries().next().value;pendingWrites.delete(key)
          if(key==='diary'&&!document.hasFocus()){forget(item);continue}
          try{await call(item.endpoint,item.payload)}catch(error){forget(item);console.warn('Kujira model route update failed:',error)}
        }}finally{sending=false}
      }
      const send=(endpoint,payload,key)=>{
        if(stopped)return
        const wire=JSON.stringify(payload)
        if(key==='select'){if(lastSelect===wire)return;lastSelect=wire}else{if(lastDiary===wire)return;lastDiary=wire}
        pendingWrites.delete(key);pendingWrites.set(key,{endpoint,payload,key,wire});void flush()
      }
      const publish=()=>{
        if(stopped||document.visibilityState==='hidden')return
        // Public extension convention: active UI owners expose only their resolved model field.
        const values=[];let accepting=true,failed=false
        try{scope.emit('ui/foreground-model/query',value=>{if(accepting)values.push(value)})}catch{failed=true}finally{accepting=false}
        if(failed||values.length){
          const value=!failed&&values.length===1?values[0]:null
          const valid=value!==null&&typeof value==='object'&&!Array.isArray(value)&&typeof value.provider==='string'&&value.provider.trim().length>0&&typeof value.model==='string'&&value.model.trim().length>0&&(value.reasoningEffort===undefined||typeof value.reasoningEffort==='string')
          send('select',{provider:valid?value.provider:'',model:valid?value.model:'',sessionId:''},'select')
          if(document.hasFocus())send('diary-front',{},'diary')
          return
        }
        const current=directory?.store.getSnapshot(),route=current?.current
        send('select',sessionId===undefined?{provider:'',model:'',sessionId:''}:{provider:route?.provider??'',model:route?.model??'',sessionId:String(sessionId)},'select')
        if(document.hasFocus())send('diary-front',sessionId===undefined?{}:{provider:route?.provider??'',model:route?.model??'',reasoningEffort:route?.reasoningEffort,sessionId:String(sessionId),ready:current?.status==='ready'&&current?.routable===true,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone},'diary')
      }
      const sync=()=>{
        if(stopped)return
        const selected=selection.getSnapshot().key;let next=null
        if(selected!==undefined)try{next=scope.modelDirectories.directoryFor(selected)}catch{}
        if(selected!==sessionId||next!==directory){offDirectory();sessionId=selected;directory=next;offDirectory=next?.store.subscribe(publish)??(()=>{});if(next)void next.load().catch(()=>{});lastSelect=lastDiary=undefined}
        publish()
      }
      const refresh=()=>{lastSelect=lastDiary=undefined;sync()}
      clearSelection=refresh;const off=selection.subscribe(sync),offField=scope.on('ui/foreground-model/changed',publish);sync();window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh)
      scope.effect(()=>()=>{stopped=true;pendingWrites.clear();if(clearSelection===refresh)clearSelection=()=>{};off();offField();offDirectory();window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)})
    })
    ctx.effect(()=>()=>{disposed=true;stream?.close();listeners.clear();style.remove()})
  }
  return {name:'kujira-pet-client',inject:['slots','connection','sessions','remote','remote.session','locale'],apply}
}})


