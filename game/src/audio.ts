// --- 효과음과 배경음. 효과음은 base64 를 fetch 없이 디코딩해 file:// 에서도 재생된다. 시작 버튼을 누를 때 켠다 ---
// 배경음은 audio 태그로 튼다(Higgsfield ElevenLabs Music 생성, 60초 반복)
import { SFX_DATA } from './sfx-data'
import { load, save } from './storage'

let ctx: AudioContext | null = null
const buffers = new Map<string, AudioBuffer>()
let muted = load('muted') === '1'
const bgm = new Audio('assets/audio/bgm_play.mp3')
bgm.loop = true
bgm.volume = 0.32
bgm.preload = 'auto'
let bgmWanted = false // 플레이 중이라 배경음이 나와야 하는 상태
let bgmHeld = false // 일시정지나 탭 숨김으로 잠시 멈춘 상태

function toArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

function syncBgm(): void {
  const on = bgmWanted && !bgmHeld && !muted
  if (on && bgm.paused) void bgm.play().catch(() => {})
  if (!on && !bgm.paused) bgm.pause()
}

export const audio = {
  get muted(): boolean {
    return muted
  },
  setMuted(value: boolean): void {
    muted = value
    save('muted', value ? '1' : '0')
    syncBgm()
  },
  // 사용자 입력 처리기 안에서 불러야 브라우저 자동재생 제한에 걸리지 않는다
  async unlock(): Promise<void> {
    if (!ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const c = new Ctor()
      ctx = c
      await Promise.all(
        Object.entries(SFX_DATA).map(async ([name, b64]) => {
          buffers.set(name, await c.decodeAudioData(toArrayBuffer(b64)))
        }),
      )
    }
    if (ctx.state === 'suspended') await ctx.resume()
  },
  play(name: string): void {
    const buf = buffers.get(name)
    if (muted || !ctx || ctx.state !== 'running' || !buf) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start()
  },
  // 배경음: 처음부터 켜기, 끄기, 잠시 멈추기
  bgmStart(): void {
    bgm.currentTime = 0
    bgmWanted = true
    syncBgm()
  },
  bgmStop(): void {
    bgmWanted = false
    syncBgm()
  },
  bgmHold(hold: boolean): void {
    bgmHeld = hold
    syncBgm()
  },
  setHidden(hidden: boolean): void {
    bgmHeld = hidden
    syncBgm()
    if (!ctx) return
    if (hidden) void ctx.suspend()
    else void ctx.resume()
  },
  report(): { state: string; decoded: number; bgm: boolean } {
    return { state: ctx ? ctx.state : 'none', decoded: buffers.size, bgm: !bgm.paused }
  },
}
