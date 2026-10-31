// Public vendor contracts checked 2026-10-29. No credentials or network transport here.
const number = (v, field, {negative = false} = {}) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || (!negative && v < 0)) throw new Error(`Invalid vendor field: ${field}`);
  return v;
};
const object = (v) => { if (!v || typeof v !== 'object' || Array.isArray(v) || v.error) throw new Error('Invalid vendor response'); return v; };
const origin = (baseURL, allowed) => {
  const u = new URL(baseURL);
  if (u.username || u.password || !allowed.includes(u.origin)) throw new Error('Unsupported vendor origin');
  return u.origin;
};
const money = (kind, value, currency, scope, extra = {}) => ({kind, value, currency, scope, ...extra});
const cn = ['https://api.moonshot.cn'];
const or = ['https://openrouter.ai'];
const glm = ['https://open.bigmodel.cn', 'https://api.z.ai'];
const millionPrice = (v, name) => {
  if (typeof v !== 'string' || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v)) throw new Error(`Invalid vendor price: ${name}`);
  return number(Number(v) * 1e6, name);
};
export const vendorAdapters = {
  moonshot: {
    label: 'Moonshot / Kimi', origins: cn, auth: 'inference', capabilities: ['balance'],
    docsUrl: 'https://platform.kimi.com/docs/api/balance',
    async read({request, baseURL}) {
      const root = origin(baseURL, cn);
      const body = object(await request(root + '/v1/users/me/balance'));
      if (body.code !== 0 || body.status !== true) throw new Error('Moonshot balance query failed');
      const d = object(body.data);
      // available_balance is authoritative; negative cash does not subtract voucher funds.
      return {metrics: [money('balance', number(d.available_balance, 'available_balance', {negative:true}), 'CNY', 'account')]};
    }
  },
  'moonshot-admin': {
    label: 'Moonshot / Kimi', origins: cn, auth: 'admin', capabilities: ['balance', 'spend'],
    docsUrl: 'https://platform.kimi.com/docs/admin-api/billing-account',
    async read({request, baseURL}) {
      const d = object(await request(origin(baseURL, cn) + '/v1/admin/organizations/account'));
      const value = (field, negative = false) => {
        const v = number(d[field], field, {negative});
        if (!Number.isSafeInteger(v)) throw new Error('Unsafe monetary integer');
        return v / 100000; // official milli-cent, NOT cents
      };
      return {metrics: [money('balance', value('available_balance', true), 'CNY', 'organization'), money('spend', value('total_consume'), 'CNY', 'organization', {period:'all-time'})]};
    }
  },
  openrouter: {
    label: 'OpenRouter', origins: or, auth: 'inference', capabilities: ['spend', 'pricing'],
    docsUrl: 'https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key',
    async read({request, baseURL, route = {}, now = Date.now()}) {
      const root = origin(baseURL, or);
      const d = object(object(await request(root + '/api/v1/key')).data);
      const metrics = [];
      for (const [field, period] of [['usage','all-time'],['usage_daily','day'],['usage_weekly','week'],['usage_monthly','month']]) {
        if (d[field] !== undefined) metrics.push(money('spend', number(d[field], field), 'USD', 'key', {period, timezone:'UTC'}));
      }
      if (!metrics.length) throw new Error('Missing OpenRouter key usage');
      // limit_remaining is a key spending cap, never account balance.
      const result = {metrics};
      const model = typeof route.model === 'string' ? route.model : '';
      if (model) {
        try {
          const body = object(await request(root + '/api/v1/models'));
          if (!Array.isArray(body.data)) throw new Error('Invalid model catalog');
          const match = body.data.find(x => x?.id === model);
          if (match?.pricing) {
            const p = object(match.pricing);
            const row = {model, currency:'USD', input:millionPrice(p.prompt,'prompt'), output:millionPrice(p.completion,'completion'), source:'api', date:new Date(now).toISOString().slice(0,10)};
            if (p.input_cache_read !== undefined) row.cacheRead = millionPrice(p.input_cache_read,'input_cache_read');
            if (p.input_cache_write !== undefined) row.cacheWrite = millionPrice(p.input_cache_write,'input_cache_write');
            result.prices = [row];
          }
        } catch (e) {
          if (e?.name === 'AbortError') throw e;
          // An independently failed catalog must not erase valid key spend.
          result.pricingUnavailable = true;
        }
      }
      return result;
    }
  },
  'openrouter-management': {
    label: 'OpenRouter', origins: or, auth: 'management', capabilities: ['balance', 'spend'],
    docsUrl: 'https://openrouter.ai/docs/api/api-reference/credits/get-remaining-credits',
    async read({request, baseURL}) {
      const d = object(object(await request(origin(baseURL, or) + '/api/v1/credits')).data);
      const purchased = number(d.total_credits, 'total_credits');
      const spent = number(d.total_usage, 'total_usage');
      return {metrics: [money('balance', purchased - spent, 'USD', 'account'), money('spend', spent, 'USD', 'account', {period:'all-time'})]};
    }
  },
  'glm-coding-plan': {
    label: 'GLM Coding Plan', origins: glm, auth: 'coding-plan', capabilities: ['quota'],
    headers: key => ({Authorization:key}),
    docsUrl: 'https://docs.z.ai/devpack/extension/usage-query-plugin',
    evidenceLevel: 'vendor-owned-official-plugin',
    async read({request, baseURL}) {
      const body = object(await request(origin(baseURL, glm) + '/api/monitor/usage/quota/limit'));
      if (body.success === false || (body.code !== undefined && ![0,200,'0','200'].includes(body.code))) throw new Error('GLM quota query failed');
      const d = object(body.data);
      if (!Array.isArray(d.limits)) throw new Error('Missing GLM quota limits');
      const metrics = d.limits.filter(x => ['TOKENS_LIMIT','TIME_LIMIT'].includes(x?.type)).map(x => ({kind:'quota',value:number(x.percentage,'percentage'),unit:'percent',scope:'coding-plan',remaining:false,period:x.type === 'TOKENS_LIMIT' ? 'five-hours' : 'month',label:x.type === 'TOKENS_LIMIT' ? 'Coding used' : 'MCP used'}));
      if (!metrics.length) throw new Error('No supported GLM quota limit');
      return {metrics};
    }
  }
};
