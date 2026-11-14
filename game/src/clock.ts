// --- 게임 시간. requestAnimationFrame 누적 시간이며 멈춤 사유가 하나라도 있으면 흐르지 않는다 ---
export type PauseReason = 'user' | 'portrait' | 'note'

type TickFn = (dtMs: number) => void

const reasons = new Set<PauseReason>()
const tickers = new Set<TickFn>()
let last = 0

function frame(ts: number): void {
  // 탭 복귀 직후 큰 간격이 한 번에 흐르지 않게 한 프레임 최대 100ms 로 자른다
  const dt = last ? Math.min(ts - last, 100) : 0
  last = ts
  if (reasons.size === 0) tickers.forEach((fn) => fn(dt))
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

export const clock = {
  get paused(): boolean {
    return reasons.size > 0
  },
  pause(reason: PauseReason): void {
    reasons.add(reason)
  },
  resume(reason: PauseReason): void {
    reasons.delete(reason)
  },
  onTick(fn: TickFn): () => void {
    tickers.add(fn)
    return () => tickers.delete(fn)
  },
}
