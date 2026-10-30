/** Non-secret query preferences. Keys stay in the Host credential service. */
const safeKey = value => typeof value === 'string' && value.length > 0 && !['__proto__','prototype','constructor'].includes(value)
// Matches DSH dsh-credentials REF_PATTERN (not an extra restriction).
const ref = value => typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) ? value : ''
const fields = ['teamId','projectId','workspaceId','region','billingAccountId','site','currency']
export function usageProfiles(input) {
  const output = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return output
  for (const [provider, raw] of Object.entries(input)) {
    if (!safeKey(provider) || !raw || typeof raw !== 'object') continue
    const item = {adapter: typeof raw.adapter === 'string' && /^[a-z][a-z0-9-]*$/.test(raw.adapter) ? raw.adapter : 'auto'}
    for (const key of ['credentialRef','secretRef','sessionTokenRef']) if (ref(raw[key])) item[key] = ref(raw[key])
    for (const key of fields) if (typeof raw[key] === 'string' && raw[key].length>0 && !/[\x00-\x1f]/.test(raw[key])) item[key] = raw[key]
    output[provider] = item
  }
  return output
}
export function modelPrices(input) {
  const output = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return output
  for (const [route,raw] of Object.entries(input)) {
    if (!safeKey(route) || !raw || typeof raw !== 'object') continue
    const item = {currency: /^[A-Z]{3}$/.test(raw.currency) ? raw.currency : 'USD', source: 'manual'}
    for (const key of ['input','output','cacheRead','cacheWrite']) if(typeof raw[key] === 'number' && Number.isFinite(raw[key]) && raw[key] >= 0) item[key]=raw[key]
    if(typeof raw.date === 'string' && /^\d{4}-\d\d-\d\d$/.test(raw.date)) item.date=raw.date
    if(item.input !== undefined && item.output !== undefined) output[route]=item
  }
  return output
}
