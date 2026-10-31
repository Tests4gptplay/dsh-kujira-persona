/** Browser-safe adapter for the Host credential service. No secret storage or reads.
 * Errors are fixed codes: Host errors and submitted values must never reach UI logs.
 */
const REF = /^[A-Za-z_][A-Za-z0-9_]{0,159}$/
const FIELDS = Object.freeze({credentialRef:'CREDENTIAL',secretRef:'SECRET',sessionTokenRef:'SESSION'})
const fail = error => ({ok:false,error})
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const validName = value => typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\x00-\x1f\x7f]/.test(value)

// A stable suffix prevents ordinary sanitized/truncated names from sharing refs.
// This is an identifier checksum, not a credential hash or security primitive.
function segment(value) {
  let hash = 2166136261
  for (let i=0;i<value.length;i++) hash = Math.imul(hash ^ value.charCodeAt(i),16777619) >>> 0
  return value.toUpperCase().replace(/[^A-Z0-9]/g,'_').slice(0,24) + '_' + hash.toString(16).padStart(8,'0').toUpperCase()
}

export function makeQueryCredentialRef(provider, adapter, field='credentialRef') {
  if (!validName(provider) || !validName(adapter) || !Object.hasOwn(FIELDS,field)) return null
  return `KUJIRA_QUERY_${segment(provider)}_${segment(adapter)}_${FIELDS[field]}_KEY`
}

/** Describe only non-secret metadata, including existing user-supplied references. */
export async function describeQueryCredentials(remoteCredentials, refs) {
  if (!Array.isArray(refs) || refs.length > 32 || refs.some(ref => typeof ref !== 'string' || !REF.test(ref))) return fail('invalid-input')
  if (!remoteCredentials || typeof remoteCredentials.describe !== 'function') return fail('unavailable')
  try {
    const unique = [...new Set(refs)]
    const result = await remoteCredentials.describe(unique)
    if (result?.ok !== true || !record(result.value)) return fail('unavailable')
    const value = Object.create(null)
    for (const ref of unique) {
      if (!Object.hasOwn(result.value,ref)) return fail('unavailable')
      const item = result.value[ref]
      if (!record(item) || typeof item.configured !== 'boolean' || typeof item.writable !== 'boolean') return fail('unavailable')
      // Host source strings can include paths. Never forward them to the UI.
      value[ref] = {configured:item.configured,writable:item.writable,source:'unknown'}
    }
    return {ok:true,value}
  } catch { return fail('unavailable') }
}

/** Write only the reference owned by this exact provider/adapter/field combination.
 * A failed/unconfirmed response is NOT proof that the Host did not persist a write.
 * Never retries set. The caller clears its password state after confirmed success.
 */
export async function saveQueryCredential(remoteCredentials, options={}) {
  if (!record(options)) return fail('invalid-input')
  const {provider,adapter,field='credentialRef',value,protectedRefs=[]} = options
  const expected = makeQueryCredentialRef(provider,adapter,field)
  const ref = options.ref ?? expected
  if (!expected || typeof ref !== 'string' || !REF.test(ref) || typeof value !== 'string' || !value.trim() || value.length > 32768 || /[\r\n\x00]/.test(value) || !Array.isArray(protectedRefs) || protectedRefs.some(item=>typeof item !== 'string')) return fail('invalid-input')
  if (protectedRefs.some(item=>item.toUpperCase()===ref.toUpperCase())) return fail('protected-ref')
  if (ref !== expected) return fail('foreign-ref')
  if (!remoteCredentials || typeof remoteCredentials.set !== 'function' || typeof remoteCredentials.describe !== 'function') return fail('unavailable')
  const before = await describeQueryCredentials(remoteCredentials,[ref])
  if (!before.ok || !before.value[ref].writable) return fail('unavailable')
  try {
    const result = await remoteCredentials.set(ref,value)
    if (result?.ok !== true) return fail('write-failed')
  } catch { return fail('write-failed') }
  const after = await describeQueryCredentials(remoteCredentials,[ref])
  if (!after.ok || !after.value[ref].configured) return fail('verification-failed')
  return {ok:true,ref,metadata:after.value[ref]}
}
