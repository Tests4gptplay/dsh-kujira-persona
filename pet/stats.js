import { ui } from './ui-messages.js'
/** Read-only presentation of DSH's existing whole-session projections. */
export const STATS_KEYS = ['sessionStats', 'tokenUsage', 'contextPressure']
export const STATS_EVENTS = new Set([
  'step/end', 'assistant/attempt', 'assistant/message', 'request/context',
  'user/message', 'developer/message', 'system/message', 'tool/result', 'turn/end',
])
const count = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
const compact = value => {
  const scaled = n => String(n >= 100 ? Math.round(n) : Math.round(n * 10) / 10)
  return value < 1000 ? String(value) : value < 1000000 ? scaled(value / 1000) + 'K' : scaled(value / 1000000) + 'M'
}

/** Integer percent normally; keep enough precision not to turn a partial hit into 100%. */
export function cachePercent(read, input) {
  if (!(input > 0)) return null
  if (read === input) return '100'
  const ratio = read / input * 100
  for (let places = 0; places <= 14; places++) {
    const rounded = Number(ratio.toFixed(places))
    if (rounded < 100) return String(rounded)
  }
  return '<100'
}

/** These are display values, never progress, billing estimates, or model control inputs. */
export function workStats(views = {}) {
  const activity = views.sessionStats, usage = views.tokenUsage, pressure = views.contextPressure
  const turns = count(activity?.turns), steps = count(activity?.steps)
  const decodeMs = count(activity?.decodeMs), decodeTokens = count(activity?.decodeTokens)
  const tokensPerSecond = decodeMs > 0 && decodeTokens !== null ? decodeTokens * 1000 / decodeMs : null
  const buckets = [usage?.uncachedInputTokens, usage?.cacheReadTokens, usage?.cacheWriteTokens, usage?.outputTokens].map(count)
  const hasUsage = buckets.every(n => n !== null)
  const input = hasUsage ? buckets[0] + buckets[1] + buckets[2] : null
  const totalTokens = hasUsage ? input + buckets[3] : null
  const cacheHitPercent = hasUsage ? cachePercent(buckets[1], input) : null
  const contextUsedTokens = count(pressure?.projectedTokens ?? pressure?.pressureTokens)
  const contextWindow = count(pressure?.contextWindow)
  const contextPercent = contextUsedTokens !== null && contextWindow > 0
    ? Math.min(100, Math.round(contextUsedTokens / contextWindow * 100)) : null
  const lines = [], linesUi = []
  const activityLine = []
  if (steps > 0 && turns !== null) activityLine.push(`${turns} 轮 ${steps} 步`)
  if (tokensPerSecond !== null) activityLine.push(`${tokensPerSecond >= 10 ? Math.round(tokensPerSecond) : Math.round(tokensPerSecond * 10) / 10} tok/s`)
  if (activityLine.length) {
    lines.push(activityLine.join(' · '))
    const activity=steps>0&&turns!==null?ui('stats.turnsSteps',{turns,steps}):null
    const speed=tokensPerSecond===null?null:tokensPerSecond>=10?Math.round(tokensPerSecond):Math.round(tokensPerSecond*10)/10
    linesUi.push(activity&&speed!==null?ui('stats.activity',{activity,speed}):activity)
  }
  if (totalTokens > 0) {linesUi.push(cacheHitPercent===null?null:ui('stats.cache',{tokens:compact(totalTokens),percent:cacheHitPercent}));lines.push(`${compact(totalTokens)} tok${cacheHitPercent === null ? '' : ` · 缓存命中 ${cacheHitPercent}%`}`)}
  if (contextPercent !== null) {lines.push(`上下文已用 ${contextPercent}%`);linesUi.push(ui('stats.context',{percent:contextPercent}))}
  return lines.length ? { turns, steps, tokensPerSecond, totalTokens, cacheHitPercent,
    contextPercent, contextUsedTokens, contextWindow, lines, linesUi } : null
}
