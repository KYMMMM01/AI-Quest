// --- 효과음과 배경음. 효과음은 base64 를 fetch 없이 디코딩해 file:// 에서도 재생된다. 첫 버튼을 누를 때 켠다 ---
// 배경음은 audio 태그 두 개(타이틀, 플레이)로 튼다(Higgsfield ElevenLabs Music 생성, 반복 재생)
// 음량은 전체, 배경음, 효과음 세 가지(0에서 1)를 저장한다
import { SFX_DATA } from './sfx-data'
import { load, save } from './storage'

type Track = 'title' | 'play'
type Vol = 'master' | 'bgm' | 'sfx'

let ctx: AudioContext | null = null
let sfxGain: GainNode | null = null
const buffers = new Map<string, AudioBuffer>()
const num = (k: string, d: number) => {
  const v = Number(load(k))
  return load(k) === null || Number.isNaN(v) ? d : Math.max(0, Math.min(1, v))
}
// 처음 켰을 때 소리가 크다는 평에 따라 기본값을 낮췄다(전체 0.6, 배경음 0.5, 효과음 0.7)
const vol: Record<Vol, number> = { master: num('vol_master', 0.6), bgm: num('vol_bgm', 0.5), sfx: num('vol_sfx', 0.7) }
const BGM_BASE = 0.35 // 배경음이 효과음과 말소리를 덮지 않게 낮춘 기본 크기
const tracks: Record<Track, HTMLAudioElement> = {
  title: new Audio('assets/audio/bgm_title.mp3'),
  play: new Audio('assets/audio/bgm_play.mp3'),
}
for (const t of Object.values(tracks)) {
  t.loop = true
  t.preload = 'auto'
}
let want: Track | null = null // 지금 나와야 하는 배경음
let held = false // 일시정지나 탭 숨김으로 잠시 멈춘 상태
let unlocked = false

function toArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

function sync(): void {
  const v = vol.master * vol.bgm * BGM_BASE
  for (const [name, t] of Object.entries(tracks) as [Track, HTMLAudioElement][]) {
    t.volume = v
    const on = unlocked && want === name && !held && v > 0
    if (on && t.paused) void t.play().catch(() => {})
    if (!on && !t.paused) t.pause()
  }
  if (sfxGain) sfxGain.gain.value = vol.master * vol.sfx
}

export const audio = {
  get volume(): Record<Vol, number> {
    return { ...vol }
  },
  setVolume(k: Vol, v: number): void {
    vol[k] = Math.max(0, Math.min(1, v))
    save(`vol_${k}`, String(vol[k]))
    sync()
  },
  // 사용자 입력 처리기 안에서 불러야 브라우저 자동재생 제한에 걸리지 않는다
  async unlock(): Promise<void> {
    unlocked = true
    if (!ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const c = new Ctor()
      ctx = c
      sfxGain = c.createGain()
      sfxGain.connect(c.destination)
      await Promise.all(
        Object.entries(SFX_DATA).map(async ([name, b64]) => {
          buffers.set(name, await c.decodeAudioData(toArrayBuffer(b64)))
        }),
      )
    }
    if (ctx.state === 'suspended') await ctx.resume()
    sync()
  },
  get unlocked(): boolean {
    return unlocked
  },
  play(name: string): void {
    const buf = buffers.get(name)
    if (!ctx || !sfxGain || ctx.state !== 'running' || !buf || vol.master * vol.sfx === 0) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(sfxGain)
    src.start()
  },
  // 배경음 바꾸기. 같은 곡이면 이어서, 다른 곡이면 처음부터
  bgm(track: Track | null): void {
    if (track && track !== want) tracks[track].currentTime = 0
    want = track
    sync()
  },
  bgmHold(hold: boolean): void {
    held = hold
    sync()
  },
  setHidden(hidden: boolean): void {
    held = hidden
    sync()
    if (!ctx) return
    if (hidden) void ctx.suspend()
    else void ctx.resume()
  },
  report(): { state: string; decoded: number; bgm: string | null } {
    const playing = (Object.keys(tracks) as Track[]).find((k) => !tracks[k].paused) ?? null
    return { state: ctx ? ctx.state : 'none', decoded: buffers.size, bgm: playing }
  },
}
