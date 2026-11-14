// --- 진입점. 로딩과 누르면 시작, 타이틀, 게임 방법, 플레이 자리, 일시정지 ---
import './style.css'
import { setupStage } from './stage'
import { clock } from './clock'
import { audio } from './audio'
import { preloadImages } from './assets'
import { ICON } from './icons'
import { startGame } from './game'
import { showDex, showCredits, overlay } from './dex'
import { showSettings, prefs } from './settings'
import { installTouchPress } from './press'
import { Sprite } from './sprite'
import * as D from './data'

const stage = document.getElementById('stage') as HTMLElement
const notice = document.getElementById('rotate-notice') as HTMLElement

// 자동 점검 스크립트가 읽는 상태(게임 동작에는 쓰지 않는다)
const qa = { boot: 'loading', scene: '', failedImages: [] as string[], timeLeft: 0, audio: () => audio.report() }
;(window as unknown as { __qa: typeof qa }).__qa = qa

let inPlay = false
let titleCast: Sprite[] = []

function h(html: string): HTMLElement {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild as HTMLElement
}
function show(scene: string, el: HTMLElement): void {
  titleCast.forEach((s) => s.dispose())
  titleCast = []
  stage.replaceChildren(el)
  qa.scene = scene
}
function btn(el: HTMLElement, act: string): HTMLButtonElement {
  return el.querySelector(`[data-act="${act}"]`) as HTMLButtonElement
}

function showLoading(): { fill: HTMLElement; ready: () => Promise<void> } {
  const el = h(`<section class="scene loading">
    <p class="mini-logo">나르미의 입찰 도장</p>
    <div class="bar"><div class="fill"></div></div>
    <p class="tip">나르미가 오늘의 서류를 챙기고 있어요</p>
    <p class="note">등장 업체와 금액은 모두 가상입니다. 소리가 나오니 음량을 확인해 주세요.</p>
  </section>`)
  show('loading', el)
  return {
    fill: el.querySelector('.fill') as HTMLElement,
    // 다 불러오면 "화면을 눌러 시작". 이 한 번의 누름으로 소리를 켠다(브라우저 자동재생 제한)
    ready: () => new Promise((done) => {
      ;(el.querySelector('.bar') as HTMLElement).hidden = true
      ;(el.querySelector('.tip') as HTMLElement).outerHTML = '<p class="tap">화면을 눌러 시작하세요</p>'
      qa.scene = 'tap'
      el.addEventListener('pointerdown', async () => {
        await audio.unlock()
        audio.play('click')
        done()
      }, { once: true })
    }),
  }
}

// 로고 글자. 둥근 외곽선은 SVG 로 그린다(외곽선 글자는 로고에만 쓴다)
const LOGO_SVG = `<svg class="logo-svg" viewBox="0 0 1120 430" aria-label="나르미의 입찰 도장">
  <g font-family="Pretendard" font-weight="900" text-anchor="middle" paint-order="stroke" stroke-linejoin="round" letter-spacing="-4">
    <text x="560" y="138" font-size="120" fill="#1e2d4a" stroke="#1e2d4a" stroke-width="22">나르미의</text>
    <text x="560" y="130" font-size="120" fill="#fff" stroke="#1e2d4a" stroke-width="18">나르미의</text>
    <text x="560" y="378" font-size="236" fill="#1e2d4a" stroke="#1e2d4a" stroke-width="40">입찰 도장</text>
    <text x="560" y="366" font-size="236" fill="#2f6fd6" stroke="#1e2d4a" stroke-width="34">입찰 <tspan fill="#ffcd38">도장</tspan></text>
  </g>
</svg>`

function showTitle(): void {
  const el = h(`<section class="scene title">
    <img class="bg" src="assets/img/bg_title.webp" alt="" />
    <div class="hang">
      <div class="chains"><i class="chain" style="left:90px;top:0;height:84px"></i><i class="chain" style="right:90px;top:0;height:84px"></i></div>
      <div class="sign">
        <span class="badge">2026 조달청 AI 게임 콘텐츠 공모전 출품작</span>
        ${LOGO_SVG}
      </div>
      <div class="link-chains" style="position:relative;width:520px;height:0">
        <i class="chain" style="left:50px;top:-8px;height:64px"></i><i class="chain" style="right:50px;top:-8px;height:64px"></i>
      </div>
      <nav class="menu">
        <button class="btn green" data-act="start">${ICON.play}<span>게임 시작</span></button>
        <button class="btn" data-act="how">${ICON.help}<span>게임 방법</span></button>
        <button class="btn" data-act="dex">${ICON.book}<span>규칙 수첩</span></button>
        <button class="btn" data-act="settings">${ICON.gear}<span>환경 설정</span></button>
      </nav>
    </div>
    <div class="corner"><button class="ibtn" data-act="credits" aria-label="만든 사람">${ICON.info}</button></div>
    <div class="cast"><div class="actor narumi"></div><div class="actor dari"></div></div>
    <p class="footnote">등장 업체와 금액은 모두 가상입니다</p>
  </section>`)
  const n = new Sprite('narumi_idle', 470)
  const d = new Sprite('dari_idle', 296)
  ;(el.querySelector('.actor.narumi') as HTMLElement).append(n.el)
  ;(el.querySelector('.actor.dari') as HTMLElement).append(d.el)
  btn(el, 'start').onclick = () => {
    audio.play('stamp')
    showPlay(!prefs.tutorialSeen)
  }
  btn(el, 'how').onclick = () => showHowTo(el)
  btn(el, 'dex').onclick = () => showDex(el)
  btn(el, 'settings').onclick = () => showSettings(el)
  btn(el, 'credits').onclick = () => showCredits(el)
  show('title', el)
  titleCast = [n, d]
  audio.bgm('title')
}

// --- 게임 방법: 어떤 게임인지와 하는 법을 네 장으로. 끝에서 직접 해 보기(튜토리얼)로 이어진다 ---
const HOW = [
  { h: '조달청은 나라 기관의<br>장바구니예요', p: '학교, 소방서, 보건소, 구청이 필요한 물건과 공사를 조달청이 대신 사 줘요. 조달 규모가 한 해 약 225조 원이라서 공정하게 고르는 일이 중요해요(2026년 조달청 업무계획).',
    pic: (Object.keys(D.AGENCIES) as D.AgencyId[]).map((a) => `<img src="${D.AGENCIES[a].img}" alt="" />`).join('') },
  { h: '심사관님은 서류를<br>살피는 일을 해요', p: '회사가 낸 서류를 오늘의 기준표와 맞춰 봐요. 기준과 맞으면 통과, 다르면 정밀 확인으로 한 번 더 살펴봐요. 정책을 몰라도 기준표만 보면 풀 수 있어요.',
    pic: `<img class="big" src="${D.OFFICES_OK[1]}" alt="" /><span class="stack"><img src="assets/img/stamp_pass.webp" alt="" /><img src="assets/img/stamp_check.webp" alt="" /></span>` },
  { h: '하루는 출근, 심사,<br>편지 순서예요', p: '출근하면 새 규칙을 하나씩 배우고, 45초 동안 서류를 심사해요. 퇴근할 때는 심사 결과가 학교나 회사가 보낸 편지로 돌아와요. 사흘을 마치면 성실한 회사가 성장사다리를 올라요.',
    pic: `<img class="big" src="assets/img/ladder.webp" alt="" />` },
  { h: '밀어서 도장 쾅!', p: '카드를 오른쪽으로 밀면 통과, 왼쪽으로 밀면 정밀 확인이에요. 아래 버튼이나 방향키로도 할 수 있어요. 헷갈리면 규칙 수첩을 펼치거나 나르미 스캔을 써 봐요. 수첩을 펴면 시간이 멈춰요.',
    pic: `<img src="assets/img/stamp_check.webp" alt="" /><img class="big" src="${D.OFFICES_EMPTY[0]}" alt="" />` },
]
function showHowTo(root: HTMLElement): void {
  let i = 0
  const el = overlay(root, '게임 방법', `<div class="sheet-body"><div class="how-slide"><div class="how-pic"></div><div class="how-text"><h3></h3><p></p></div></div></div>
    <div class="sheet-foot"><div class="how-dots">${HOW.map(() => '<i></i>').join('')}</div>
      <button class="btn paper" data-act="prev">이전</button><button class="btn" data-act="next">다음</button></div>`, 'howto')
  const paint = () => {
    const s = HOW[i]
    ;(el.querySelector('.how-pic') as HTMLElement).innerHTML = s.pic
    ;(el.querySelector('.how-text h3') as HTMLElement).innerHTML = s.h
    ;(el.querySelector('.how-text p') as HTMLElement).textContent = s.p
    el.querySelectorAll('.how-dots i').forEach((d, k) => d.classList.toggle('on', k === i))
    btn(el, 'prev').disabled = i === 0
    const nx = btn(el, 'next')
    nx.textContent = i === HOW.length - 1 ? '직접 해 보기' : '다음'
    nx.classList.toggle('green', i === HOW.length - 1)
  }
  btn(el, 'prev').onclick = () => (audio.play('back'), (i = Math.max(0, i - 1)), paint())
  btn(el, 'next').onclick = () => {
    audio.play('click')
    if (i < HOW.length - 1) return (i++, paint())
    el.remove()
    showPlay(true)
  }
  paint()
}

// 플레이 화면은 game.ts 가 그린다. 주소 뒤 ?seed=숫자 로 카드 순서를 고정할 수 있다(자동 점검과 시연용)
function showPlay(tutorial: boolean): void {
  const params = new URLSearchParams(location.search)
  const demo = params.get('demo') === '1'
  const seed = Number(params.get('seed')) || (demo ? 5 : undefined)
  inPlay = true
  qa.scene = 'play'
  titleCast.forEach((s) => s.dispose())
  titleCast = []
  audio.bgm('play')
  startGame({
    demo,
    tutorial: tutorial && !demo,
    root: stage,
    easy: prefs.easy,
    qa: qa as unknown as Record<string, unknown>,
    seed,
    pause: openPause,
    onTutorialDone: () => (prefs.tutorialSeen = true),
    onTitle: () => {
      inPlay = false
      showTitle()
    },
  })
}

let pauseEl: HTMLElement | null = null
function openPause(summary: string, onHome: () => void): void {
  if (pauseEl) return
  clock.pause('user')
  audio.bgmHold(true)
  const el = overlay(stage, '일시정지', `<div class="sheet-body">
      <p class="summary">${summary}</p>
      <button class="btn green" data-act="resume">${ICON.play}계속하기</button>
      <button class="btn paper" data-act="set">${ICON.gear}환경 설정</button>
      <button class="btn paper" data-act="home">${ICON.home}타이틀로</button>
    </div>`, 'pause', () => close())
  pauseEl = el
  const close = () => {
    pauseEl?.remove()
    pauseEl = null
    clock.resume('user')
    audio.bgmHold(false)
    if (qa.scene === 'pause') qa.scene = 'play'
  }
  btn(el, 'resume').onclick = () => (audio.play('click'), close())
  btn(el, 'set').onclick = () => showSettings(el, { inGame: true })
  btn(el, 'home').onclick = () => {
    close()
    onHome()
  }
  qa.scene = 'pause'
}

function autoPause(): void {
  const pause = stage.querySelector('[data-act="pause"]') as HTMLButtonElement | null
  if (inPlay && !pauseEl && pause && !pause.disabled) pause.click()
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

// 마우스를 버튼 위에 올리면 작은 소리. 같은 버튼에서는 한 번만
let hovered: Element | null = null
document.addEventListener('pointerover', (e) => {
  if (e.pointerType !== 'mouse') return
  const b = e.target instanceof Element ? e.target.closest('button') : null
  if (b === hovered) return
  hovered = b
  if (b && !(b as HTMLButtonElement).disabled) audio.play('hover')
})

installTouchPress()
setupStage(stage, notice, (portrait) => (portrait ? clock.pause('portrait') : clock.resume('portrait')))

const loading = showLoading()
preloadImages((done, total) => (loading.fill.style.width = `${(done / total) * 100}%`)).then(async (failed) => {
  qa.failedImages = failed
  qa.boot = 'ready'
  await loading.ready()
  showTitle()
})
