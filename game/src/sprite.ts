// --- 캐릭터 동작 재생. 띠 그림의 칸을 게임 시간(clock)에 맞춰 넘겨 일시정지에도 함께 멈춘다 ---
import { clock } from './clock'
import { SPRITES } from './sprite-data'

export type ClipName = keyof typeof SPRITES

export class Sprite {
  readonly el: HTMLDivElement
  private clip: ClipName
  private t = 0
  private onEnd: (() => void) | null = null
  private readonly back: ClipName
  private readonly stop: () => void

  constructor(idle: ClipName, height: number) {
    this.back = idle
    this.clip = idle
    const c = SPRITES[idle]
    this.el = document.createElement('div')
    this.el.className = 'sprite'
    this.el.style.height = `${height}px`
    this.el.style.width = `${(height * c.w) / c.h}px`
    this.apply()
    this.stop = clock.onTick((dt) => this.tick(dt))
  }

  play(clip: ClipName, onEnd?: () => void): void {
    this.clip = clip
    this.t = 0
    this.onEnd = onEnd ?? null
    this.apply()
  }

  get width(): number {
    return parseFloat(this.el.style.width)
  }

  dispose(): void {
    this.stop()
  }

  private apply(): void {
    const c = SPRITES[this.clip]
    this.el.style.backgroundImage = `url(${c.src})`
    this.el.style.backgroundSize = `${c.n * 100}% 100%`
    this.frame(0)
  }

  private frame(i: number): void {
    const c = SPRITES[this.clip]
    this.el.style.backgroundPosition = `${c.n > 1 ? (i / (c.n - 1)) * 100 : 0}% 0`
  }

  private tick(dt: number): void {
    const c = SPRITES[this.clip]
    this.t += dt
    let i = Math.floor((this.t / 1000) * c.fps)
    if (i >= c.n) {
      if (c.loop) i %= c.n
      else {
        const cb = this.onEnd
        this.onEnd = null
        this.play(this.back)
        cb?.()
        return
      }
    }
    this.frame(i)
  }
}
