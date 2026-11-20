// --- 캐릭터 동작 재생. 띠 그림의 칸을 게임 시간(clock)에 맞춰 넘겨 일시정지에도 함께 멈춘다 ---
// 칸은 로딩 때 미리 펼쳐 둔 그림(ImageBitmap)으로 캔버스에 그린다. 예전처럼 띠 그림을 배경으로 갈아 끼우면,
// 동작이 바뀌는 순간 브라우저가 큰 띠 그림을 다시 펼치느라 한두 프레임 캐릭터가 사라졌다
import { clock } from './clock'
import { SPRITES } from './sprite-data'
import { onStageFit, stageScale } from './stage'

export type ClipName = keyof typeof SPRITES

const frames = new Map<string, ImageBitmap[]>() // 띠 그림 주소마다 칸 그림
const live = new Set<Sprite>() // 화면에 있는 캐릭터. 무대 크기가 바뀌면(시계가 멈춘 일시정지 중에도) 바로 다시 그린다
let queue: Promise<void> = Promise.resolve()
onStageFit(() => live.forEach((s) => s.redraw()))

// 캐릭터 띠 그림이면 칸마다 잘라 펼쳐 두고 true 를 돌려준다(assets.ts 의 미리 받기에서 부른다). 다른 그림이면 false
// 띠 그림은 받기만 기다리고 펼칠 때 한 번만 디코딩한다. 한 장씩 차례로 펼쳐 휴대폰에서도 메모리가 한꺼번에 늘지 않게 한다
export function bake(src: string, img: HTMLImageElement): Promise<boolean> {
  const c = Object.values(SPRITES).find((s) => s.src === src)
  if (!c) return Promise.resolve(false)
  const loaded = new Promise<void>((ok, ng) => {
    if (img.complete && img.naturalWidth) return ok()
    img.onload = () => ok()
    img.onerror = () => ng(new Error(src))
  })
  const job = queue.then(async () => {
    await loaded
    const sheet = await createImageBitmap(img)
    frames.set(src, await Promise.all(Array.from({ length: c.n }, (_, i) => createImageBitmap(sheet, i * c.w, 0, c.w, c.h))))
    sheet.close()
    return true
  })
  queue = job.then(() => {}, () => {})
  return job
}

export class Sprite {
  readonly el: HTMLCanvasElement
  private readonly g: CanvasRenderingContext2D
  private clip: ClipName
  private t = 0
  private shown = -1 // 지금 캔버스에 그려 둔 칸. 같은 칸이면 다시 그리지 않는다
  private px = 0 // 캔버스 한 CSS px 에 드는 실제 화면 픽셀 수(무대 배율 x 기기 배율)
  private onEnd: (() => void) | null = null
  private readonly back: ClipName
  private readonly stop: () => void
  private readonly k: number // 칸 픽셀을 화면 픽셀로 바꾸는 배율(한 캐릭터의 동작은 칸 높이가 모두 같다)

  constructor(idle: ClipName, height: number) {
    this.back = idle
    this.clip = idle
    const c = SPRITES[idle]
    this.k = height / c.h
    this.el = document.createElement('canvas')
    this.el.className = 'sprite'
    this.el.style.height = `${height}px`
    this.el.style.width = `${(height * c.w) / c.h}px`
    this.g = this.el.getContext('2d')!
    this.apply()
    this.stop = clock.onTick((dt) => this.tick(dt))
    live.add(this)
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
    live.delete(this)
  }

  // 무대 크기나 기기 배율이 바뀌었으면 지금 칸을 새 크기로 다시 그린다
  redraw(): void {
    this.frame(Math.max(0, this.shown))
  }

  private apply(): void {
    this.shown = -1
    this.frame(0)
  }

  private frame(i: number): void {
    const c = SPRITES[this.clip]
    // 캔버스 크기를 실제 화면 픽셀에 맞춰, 무대가 크게 줄어드는 휴대폰에서도 테두리가 거칠어지지 않게 고품질로 줄여 그린다
    const px = stageScale() * devicePixelRatio
    if (px !== this.px) {
      this.px = px
      this.el.width = Math.round(parseFloat(this.el.style.width) * px)
      this.el.height = Math.round(parseFloat(this.el.style.height) * px)
      this.shown = -1
    }
    const img = frames.get(c.src)?.[i]
    if (i === this.shown || !img) return // 같은 칸이면 그리지도, 위치를 다시 쓰지도 않는다
    this.shown = i
    // 발이 바닥에 붙어 있어야 하는 동작은 칸마다 적힌 만큼 옮겨 발바닥을 그림자 위에 고정한다(pack_sprites.py 의 foot)
    const off = 'foot' in c ? c.foot[i] : 0
    this.el.style.translate = off ? `0 ${off * this.k}px` : ''
    const g = this.g
    g.clearRect(0, 0, this.el.width, this.el.height)
    g.imageSmoothingQuality = 'high' // 캔버스 크기를 바꾸면 처음 값으로 돌아가므로 그릴 때마다 정한다
    g.drawImage(img, 0, 0, this.el.width, this.el.height)
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
