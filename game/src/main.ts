// --- 진입점. 로딩, 타이틀, 플레이 자리, 일시정지 ---
import './style.css'
import { setupStage } from './stage'
import { clock } from './clock'
import { audio } from './audio'
import { preloadImages } from './assets'
import { ICON } from './icons'
import { load, save } from './storage'
import { startGame } from './game'
import { showDex, showCredits } from './dex'
import { installTouchPress } from './press'

const stage = document.getElementById('stage') as HTMLElement
const notice = document.getElementById('rotate-notice') as HTMLElement

// 자동 점검 스크립트가 읽는 상태(게임 동작에는 쓰지 않는다)
const qa = { boot: 'loading', scene: '', failedImages: [] as string[], timeLeft: 0, audio: () => audio.report() }
;(window as unknown as { __qa: typeof qa }).__qa = qa

// 플레이 중에만 자동 일시정지와 일시정지 화면을 쓴다
let inPlay = false
let easyMode = load('easy') === '1'

function h(html: string): HTMLElement {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild as HTMLElement
}

function show(scene: string, el: HTMLElement): void {
  stage.replaceChildren(el)
  qa.scene = scene
}

function btn(el: HTMLElement, act: string): HTMLButtonElement {
  return el.querySelector(`[data-act="${act}"]`) as HTMLButtonElement
}

function showLoading(): HTMLElement {
  const el = h(`<section class="scene loading">
    <p class="mini-logo outline">나르미의 입찰 도장</p>
    <div class="bar"><div class="fill"></div></div>
    <p class="tip">나르미가 오늘의 서류를 챙기고 있어요</p>
  </section>`)
  show('loading', el)
  return el.querySelector('.fill') as HTMLElement
}

// 로고 글자. CSS 외곽선은 모서리가 각지므로 SVG 글자로 둥근 외곽선을 그린다(아래 그림자, 외곽선, 글자 순서)
const LOGO_SVG = (() => {
  const line = (y: number, size: number, body: string, x = 560) =>
    `<text x="${x}" y="${y + 18}" font-size="${size}" fill="#12336b" stroke="#12336b" stroke-width="${size * 0.2}">${body.replace(/ fill="[^"]*"/g, '')}</text>` +
    `<text x="${x}" y="${y}" font-size="${size}" fill="#fff" stroke="#1f4e9e" stroke-width="${size * 0.17}">${body}</text>`
  return `<svg class="logo-svg" viewBox="0 0 1120 430" aria-label="나르미의 입찰 도장">
    <g font-family="Pretendard" font-weight="900" text-anchor="middle" paint-order="stroke" stroke-linejoin="round" letter-spacing="-4">
      ${line(130, 116, '나르미의', 400)}
      ${line(360, 228, '입찰 <tspan fill="#ffd23f">도장</tspan>')}
    </g>
  </svg>`
})()

function showTitle(): void {
  const el = h(`<section class="scene title">
    <img class="bg" src="assets/img/bg_title.webp" alt="" />
    <div class="shade"></div>
    <div class="logo">
      <span class="logo-badge">조달청 AI 게임 공모전 출품작</span>
      ${LOGO_SVG}
    </div>
    <p class="tagline outline">학교와 소방서에 필요한 물건을 공정하게!</p>
    <button class="gbtn start" data-act="start">시작하기</button>
    <button class="toggle easy" data-act="easy" aria-pressed="${easyMode}"><span class="knob"></span>여유 모드 <small>시간이 넉넉해져요</small></button>
    <div class="corner">
      <button class="ibtn blue" data-act="dex" aria-label="정책 도감">${ICON.book}</button>
      <button class="ibtn blue" data-act="credits" aria-label="만든 사람">${ICON.info}</button>
      <button class="ibtn blue" data-act="sound" aria-label="소리"></button>
    </div>
    <img class="mascot narumi" src="assets/narumi.webp" alt="나르미" />
    <img class="mascot dari" src="assets/dari.webp" alt="달이" />
    <p class="footnote">등장 업체와 금액은 모두 가상입니다. 소리가 안 나면 기기의 무음 설정을 확인해 주세요.</p>
  </section>`)
  const sound = btn(el, 'sound')
  const paint = () => {
    sound.innerHTML = audio.muted ? ICON.soundOff : ICON.soundOn
    sound.setAttribute('aria-label', audio.muted ? '소리 켜기' : '소리 끄기')
  }
  paint()
  sound.onclick = () => {
    audio.setMuted(!audio.muted)
    paint()
    audio.play('click')
  }
  const easy = btn(el, 'easy')
  easy.onclick = () => {
    easyMode = !easyMode
    save('easy', easyMode ? '1' : '0')
    easy.setAttribute('aria-pressed', String(easyMode))
    audio.play('click')
  }
  btn(el, 'dex').onclick = () => showDex(el)
  btn(el, 'credits').onclick = () => showCredits(el)
  btn(el, 'start').onclick = async () => {
    await audio.unlock()
    audio.play('stamp')
    showPlay()
  }
  show('title', el)
}

// 플레이 화면은 game.ts 가 그린다. 주소 뒤 ?seed=숫자 로 카드 순서를 고정할 수 있다(자동 점검과 시연용)
function showPlay(): void {
  const params = new URLSearchParams(location.search)
  const demo = params.get('demo') === '1'
  const seed = Number(params.get('seed')) || (demo ? 5 : undefined)
  inPlay = true
  qa.scene = 'play'
  audio.bgmStart()
  startGame({
    demo,
    root: stage,
    easy: easyMode,
    qa: qa as unknown as Record<string, unknown>,
    seed,
    pause: openPause,
    onTitle: () => {
      inPlay = false
      audio.bgmStop()
      showTitle()
    },
  })
}

let pauseEl: HTMLElement | null = null
function openPause(summary: string, onHome: () => void): void {
  if (pauseEl) return
  clock.pause('user')
  audio.bgmHold(true)
  audio.play('click')
  pauseEl = h(`<div class="overlay">
    <div class="panel pause-panel">
      <div class="ribbon outline">일시정지</div>
      <p class="summary">${summary}</p>
      <button class="gbtn green mid" data-act="resume">계속하기</button>
      <button class="gbtn soft sub" data-act="home">타이틀로</button>
      <img class="peek" src="assets/dari.webp" alt="" />
    </div>
  </div>`)
  const close = () => {
    pauseEl?.remove()
    pauseEl = null
    clock.resume('user')
    audio.bgmHold(false)
    if (qa.scene === 'pause') qa.scene = 'play'
  }
  btn(pauseEl, 'resume').onclick = () => {
    audio.play('click')
    close()
  }
  btn(pauseEl, 'home').onclick = () => {
    close()
    onHome()
  }
  stage.appendChild(pauseEl)
  qa.scene = 'pause'
}

function autoPause(): void {
  const pause = stage.querySelector('[data-act="pause"]') as HTMLButtonElement | null
  if (inPlay && !pauseEl && pause) pause.click()
}

document.addEventListener('visibilitychange', () => {
  audio.setHidden(document.hidden)
  if (document.hidden) autoPause()
})
window.addEventListener('blur', autoPause)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') autoPause()
  // 방향키와 스페이스로 페이지가 스크롤되지 않게 막는다
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault()
})

installTouchPress()
setupStage(stage, notice, (portrait) => (portrait ? clock.pause('portrait') : clock.resume('portrait')))

const fill = showLoading()
preloadImages((done, total) => (fill.style.width = `${(done / total) * 100}%`)).then((failed) => {
  qa.failedImages = failed
  qa.boot = 'ready'
  showTitle()
})
