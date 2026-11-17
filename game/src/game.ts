// --- 판정 루프: 튜토리얼, 하루(브리핑, 시범 카드, 심사, 정산 편지) 세 번, 최종 결과 ---
// 핵심 생각: 정답 기준은 늘 왼쪽 기준표에 있다. 카드의 번호 표와 기준표의 번호 줄을 맞춰 보면 정책을 몰라도 풀린다
import './play.css'
import { clock } from './clock'
import { audio } from './audio'
import { ICON } from './icons'
import { Sprite } from './sprite'
import * as D from './data'
import { unlock, showDex, dexCount, DEX } from './dex'

type Dir = 'pass' | 'check'
type DemoAct = { cap?: string; wait: number; dir: Dir; scan?: number }
type Phase = 'coach' | 'brief' | 'guide' | 'card' | 'judging' | 'feedback' | 'msg' | 'over' | 'result' | 'end'

interface Card {
  id: number
  company: D.Company
  clue: D.Clue
  trap: boolean
  marks: D.MarkId[]
  photo: string
  price?: number
  chip?: number
  item?: string
  boxLogo?: string
  agency: D.AgencyId
  what: string // 편지에 쓰는 물건이나 공사 이름
  guide?: D.Clue // 시범 카드면 가르치는 규칙
  coach?: Dir // 튜토리얼 연습 카드면 바라는 방향
  forced?: boolean // 2일차 강제 스캔 카드(정상 카드, 일부러 틀린 힌트)
  scanned?: Hint
  rejudge?: boolean // 틀린 힌트 장면 뒤 다시 판정(정확도에 세지 않는다)
  demo?: DemoAct
}

interface Notice {
  agency: D.AgencyId
  title: string
  what: string
  img: string
  bidders: Card[]
  idx: number
  state: ('wait' | 'now' | 'won' | 'check')[]
}

interface Hint {
  level: '높음' | '낮음'
  x: number
  y: number
  wrong: boolean
}

export interface GameOptions {
  root: HTMLElement
  easy: boolean
  qa: Record<string, unknown>
  pause: (summary: string, onHome: () => void) => void
  onTitle: () => void
  onTutorialDone?: () => void
  tutorial?: boolean
  seed?: number
  demo?: boolean // 시연 모드: 정해진 카드와 입력으로 시연영상 장면을 그대로 재생한다
}

const CHIP_COLORS = ['#ffd23f', '#7fe3a2', '#8ec9ff', '#ffb3c7', '#c9a8ff', '#ffb27a']
const PHOTO = { x: 20, y: 104, w: 480, h: 380 } // 카드 안 사진 자리

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function won(n: number): string {
  const man = Math.round(n / 10000)
  const eok = Math.floor(man / 10000)
  const rest = man % 10000
  if (eok > 0) return `${eok}억${rest ? ' ' + rest.toLocaleString('ko-KR') + '만' : ''}원`
  return `${man.toLocaleString('ko-KR')}만원`
}

export function startGame(o: GameOptions): () => void {
  const rand = rng(o.seed ?? Math.floor(Math.random() * 1e9))
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rand() * a.length)]
  const shuffle = <T>(a: T[]): T[] => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
  const h = (html: string): HTMLElement => {
    const t = document.createElement('template')
    t.innerHTML = html.trim()
    return t.content.firstElementChild as HTMLElement
  }
  const daySeconds = () => D.STAGE_SECONDS * (o.easy ? 4 / 3 : 1)

  // --- 전체 기록 ---
  const run = {
    stars: [] as number[],
    judged: [] as { clue: D.Clue; correct: boolean }[],
    delivered: { school: 0, fire: 0, health: 0, district: 0 } as Record<D.AgencyId, number>,
    waited: 0,
    missed: [] as D.Clue[],
    score: 0,
    firstScan: true,
    pagesBefore: dexCount(),
  }

  // --- 화면 ---
  const el = h(`<section class="scene play">
    <img class="bg" src="assets/img/bg_game.webp" alt="" />
    <header class="hud">
      <div class="hud-l">
        <span class="chip day"><b class="dno"></b><span class="dtitle"></span></span>
        <span class="chip timer">${ICON.clock}<span class="num">45</span><i class="tbar"><i></i></i></span>
      </div>
      <div class="hud-r">
        <span class="chip score">점수 <b>0</b></span>
        <span class="chip hearts"></span>
        <button class="ibtn" data-act="note" aria-label="규칙 수첩">${ICON.book}</button>
        <button class="ibtn" data-act="pause" aria-label="일시정지">${ICON.pause}</button>
      </div>
    </header>
    <aside class="board panel"></aside>
    <div class="agencies"></div>
    <div class="card-slot"></div>
    <div class="judge-row">
      <button class="btn orange judge" data-act="check">${ICON.left}<span>정밀 확인</span></button>
      <button class="btn scan-btn" data-act="scan">${ICON.lens}<span class="lbl">스캔</span><b class="cnt">3</b></button>
      <button class="btn green judge" data-act="pass"><span>통과</span>${ICON.right}</button>
    </div>
    <div class="narumi-spot"><div class="shadow"></div></div>
    <div class="bubble narumi-bubble" hidden></div>
    <div class="dari-spot"><div class="shadow"></div></div>
    <svg class="links" viewBox="0 0 1920 1080"></svg>
    <div class="toast-layer"></div>
  </section>`)
  o.root.replaceChildren(el)
  const $ = <T extends HTMLElement>(s: string) => el.querySelector(s) as T
  const dayNo = $('.chip.day .dno')
  const dayTitle = $('.chip.day .dtitle')
  const timeChip = $('.chip.timer')
  const timeNum = $('.timer .num')
  const timeBar = $('.timer .tbar i')
  const scoreEl = $('.chip.score b')
  const heartsEl = $('.chip.hearts')
  const agenciesEl = $('.agencies')
  const board = $('.board')
  const slot = $('.card-slot')
  const bubble = $('.narumi-bubble')
  const scanBtn = $<HTMLButtonElement>('.scan-btn')
  const passBtn = $<HTMLButtonElement>('[data-act="pass"]')
  const checkBtn = $<HTMLButtonElement>('[data-act="check"]')
  const noteBtn = $<HTMLButtonElement>('[data-act="note"]')
  const pauseBtn = $<HTMLButtonElement>('[data-act="pause"]')
  const links = el.querySelector('svg.links') as SVGSVGElement
  const toasts = $('.toast-layer')
  const narumi = new Sprite('narumi_idle', 470)
  $('.narumi-spot').append(narumi.el)
  const dari = new Sprite('dari_idle', 272)
  $('.dari-spot').append(dari.el)

  // --- 하루 상태 ---
  let stageIdx = 0
  let def = D.STAGES[0]
  let phase: Phase = 'brief'
  let timeLeft = daySeconds() * 1000
  let cardElapsed = 0
  let hearts = 3
  let scans = 3
  let combo = 0
  let cardNo = 0
  let judgedInStage = 0
  let guides: D.Clue[] = []
  let trapShown = false
  let notice: Notice | null = null
  let card: Card | null = null
  let stageLog: { clue: D.Clue; correct: boolean; card: Card; dir: Dir }[] = []
  let stageDelivered: Record<D.AgencyId, number> = { school: 0, fire: 0, health: 0, district: 0 }
  let stagePost = 0
  // 그날 시작할 때의 전체 기록. 하트를 다 잃고 그날을 다시 할 때 되돌린다
  let dayStart = { score: 0, judged: 0, missed: 0, waited: 0, delivered: { ...run.delivered } }
  let skipGuides = false // 튜토리얼에서 연습한 날은 1일차 시범 카드를 건너뛴다
  let coachWait: ((d: Dir) => void) | null = null
  const timers: { t: number; fn: () => void }[] = []
  const after = (ms: number, fn: () => void) => timers.push({ t: ms, fn })
  const maxHearts = () => (o.easy ? 5 : 3)
  const isGuide = () => card?.guide !== undefined

  const updateQa = () => {
    o.qa.play = {
      stage: def.no, phase, hearts, scans, score: run.score, timeLeft,
      clue: card?.clue ?? null, guide: card?.guide ?? null, coach: card?.coach ?? null, forced: !!card?.forced, scanned: !!card?.scanned,
      hintWrong: !!card?.scanned?.wrong, judged: run.judged.length, correct: run.judged.filter((j) => j.correct).length,
      stars: run.stars.slice(),
    }
  }

  // --- 그리기 ---
  function drawHearts(): void {
    const n = maxHearts()
    heartsEl.innerHTML = Array.from({ length: n }, (_, i) => `<span class="${i < hearts ? '' : 'lost'}">${ICON.heart}</span>`).join('')
    heartsEl.setAttribute('aria-label', `하트 ${hearts}개`)
  }
  function drawScore(): void {
    scoreEl.textContent = run.score.toLocaleString('ko-KR')
  }
  function drawButtons(): void {
    const live = phase === 'card' || phase === 'guide' || phase === 'coach'
    passBtn.disabled = !live || !card
    checkBtn.disabled = !live || !card
    const forcedWait = !!card?.forced && !card.scanned
    ;(scanBtn.querySelector('.cnt') as HTMLElement).textContent = String(scans)
    scanBtn.disabled = !(phase === 'card' && card && !card.scanned && (scans > 0 || forcedWait))
    scanBtn.classList.toggle('blink', forcedWait)
  }
  function drawAgencies(): void {
    agenciesEl.innerHTML = def.agencies
      .map((a) => `<div class="agency chip" data-ag="${a}"><img src="${D.AGENCIES[a].img}" alt="" />${D.AGENCIES[a].name}<b class="cnt">${stageDelivered[a]}</b></div>`)
      .join('') + `<div class="agency chip post"><img src="assets/img/tray_investigate.webp" alt="" />놓친 서류<b class="cnt">${stagePost}</b></div>`
  }
  function findItemByCard(c: Card): D.Item {
    return D.ITEMS.find((i) => i.img === c.item || i.wrong === c.item) ?? D.ITEMS[0]
  }

  // 기준표 한 줄의 "이래야 해요" 그림
  function ruleSample(r: D.RuleId, c: Card | null): string {
    switch (r) {
      case 'ghost': return `<img src="${D.OFFICES_OK[0]}" alt="" />`
      case 'safety': return `<img src="${D.BUILDS[0].safe}" alt="" />`
      case 'spec': {
        const it = c?.item ? findItemByCard(c) : null
        return it ? `<img src="${it.img}" alt="" class="fit" />` : ''
      }
      case 'box': return c ? `<img src="${c.company.logo}" alt="" class="logo" />` : ''
      case 'collusion': return '<span class="mini-chips"><i style="background:#ffd23f">72</i><i style="background:#8ec9ff">75</i></span>'
    }
  }
  function ruleLine(r: D.RuleId, c: Card | null): string {
    if (r === 'spec') {
      const it = c?.item ? findItemByCard(c) : null
      const last = it?.spec ?? it?.name ?? ''
      return it ? `주문한 <b>${it.name}</b>${it.spec ? `(${it.spec})` : ''}${D.josa(last, '과', '와')} 같아야 해요` : D.RULES.spec.rule
    }
    if (r === 'box') return c ? `상자 로고가 계약 회사 <b>${c.company.name}</b>${D.josa(c.company.name, '과', '와')} 같아야 해요` : D.RULES.box.rule
    return D.RULES[r].rule
  }
  function drawBoard(): void {
    const c = card
    const rows = def.board.map((r, i) => `<li data-rule="${r}"><span class="no">${i + 1}</span><p>${ruleLine(r, c)}</p><span class="sample">${ruleSample(r, c)}</span></li>`).join('')
    let lower = ''
    if (def.kind === 'delivery') {
      const it = c?.item ? findItemByCard(c) : null
      lower = it && c ? `<div class="order"><h4>주문서</h4><div class="order-row"><img src="${D.AGENCIES[c.agency].img}" alt="" /><span>${D.AGENCIES[c.agency].name}<br><b>${it.name}</b></span></div>
        <div class="order-row"><img src="${c.company.logo}" alt="" /><span>계약 회사<br><b>${c.company.name}</b></span></div></div>` : ''
    } else if (notice) {
      const n = notice
      lower = `<div class="order"><h4>나라장터 공고</h4><div class="order-row"><img src="${D.AGENCIES[n.agency].img}" alt="" /><span>${D.AGENCIES[n.agency].name}<br><b>${n.title}</b></span></div>
        <p class="rank-title">값이 낮은 회사부터 서류를 봐요</p>
        <ol class="rank">${n.bidders.map((b, i) => `<li class="${n.state[i]}"><i class="pchip" style="background:${CHIP_COLORS[b.chip ?? 0]}">${won(b.price ?? 0)}</i><img src="${b.company.logo}" alt="" /><span>${b.company.name}</span><em>${
          n.state[i] === 'won' ? '낙찰' : n.state[i] === 'check' ? '정밀 확인' : n.state[i] === 'now' ? '심사 중' : ''
        }</em></li>`).join('')}</ol></div>`
    }
    board.innerHTML = `<i class="clip"></i><div class="board-paper"><h3>오늘의 기준표</h3><ol class="rules">${rows}</ol>${lower}</div>`
  }

  // 카드에서 규칙별로 볼 곳(카드 안 좌표)
  function spotOf(r: D.Clue): { x: number; y: number } {
    switch (r) {
      case 'box': return { x: PHOTO.x + 100, y: PHOTO.y + 300 }
      case 'spec': return { x: PHOTO.x + 355, y: PHOTO.y + 285 }
      case 'collusion': return { x: 400, y: 552 }
      case 'safety': return { x: PHOTO.x + 240, y: PHOTO.y + 95 }
      default: return { x: PHOTO.x + 240, y: PHOTO.y + 190 }
    }
  }
  function cardHTML(c: Card): string {
    const marks = c.marks.map((m) => `<img class="mark" src="${D.MARKS[m].img}" alt="${D.MARKS[m].name}" title="${D.MARKS[m].name}" />`).join('')
    let photo = `<img class="photo" src="${c.photo}" alt="" />`
    if (def.kind === 'delivery') {
      photo = `<img class="photo deliv" src="${c.photo}" alt="" /><img class="box-logo" src="${c.boxLogo}" alt="" /><img class="deliv-item" src="${c.item}" alt="" />`
    }
    const tags = def.board.map((r, i) => {
      const p = spotOf(r)
      return `<span class="no tag" style="left:${p.x - 20}px;top:${p.y - 72}px">${i + 1}</span>`
    }).join('')
    const foot = def.kind === 'bid'
      ? `<div class="marks">${marks}</div><i class="pchip big" style="background:${CHIP_COLORS[c.chip ?? 0]}">${won(c.price ?? 0)}</i>`
      : `<div class="marks">${marks}</div><span class="deliv-tag">${D.AGENCIES[c.agency].name} 도착</span>`
    const caption = def.no === 1 ? '업체 사무실' : def.no === 2 ? '도착한 물건' : '지난 공사 현장'
    const tag = c.coach ? '연습' : c.guide !== undefined ? '시범' : ''
    return `<div class="card${tag ? ' is-guide' : ''}"><i class="pclip"></i>
      <div class="card-head"><img src="${c.company.logo}" alt="" /><b>${c.company.name}</b>${tag ? `<span class="guide-tag">${tag}</span>` : ''}</div>
      <div class="card-photo">${photo}<span class="cap">${caption}</span></div>
      <div class="card-foot">${foot}</div>
      ${tags}
      <div class="tint pass"></div><div class="tint check"></div>
    </div>`
  }
  const inner = () => slot.querySelector('.card') as HTMLElement | null

  function ring(x: number, y: number, cls: string, label = ''): void {
    const c = inner()
    if (!c) return
    c.append(h(`<div class="ring ${cls}" style="left:${x}px;top:${y}px">${label ? `<span>${label}</span>` : ''}</div>`))
  }

  // 기준표 줄과 카드의 볼 곳을 점선으로 잇는다(시범 카드와 튜토리얼에서만)
  function linkRule(r: D.Clue, ok: boolean): void {
    links.innerHTML = ''
    const row = board.querySelector(`li[data-rule="${r}"] .no`)
    const c = inner()
    if (!row || !c) return
    const a = pos(row)
    const sp = spotOf(r)
    const cr = pos(c)
    const b = { x: cr.x - 260 + sp.x, y: cr.y - c.offsetHeight / 2 + sp.y }
    const mx = (a.x + b.x) / 2
    links.innerHTML = `<path d="M${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}" class="${ok ? 'ok' : 'bad'}" />
      <g transform="translate(${mx} ${(a.y + b.y) / 2})" class="${ok ? 'ok' : 'bad'}"><circle r="30" />${ok ? '<path d="M-13 1 L-4 10 L13 -9" />' : '<path d="M-11 -11 L11 11 M11 -11 L-11 11" />'}</g>`
  }

  // --- 말풍선과 알림 ---
  let bubbleT = 0
  function say(text: string, ms = 1600): void {
    bubble.innerHTML = text
    bubble.hidden = false
    bubble.classList.remove('pop')
    void bubble.offsetWidth
    bubble.classList.add('pop')
    bubbleT = ms
  }
  function toast(text: string, cls = '', ms = 1300): void {
    const t = h(`<div class="toast ${cls}">${text}</div>`)
    toasts.append(t)
    after(ms, () => t.remove())
  }

  // --- 카드 만들기 ---
  function marksFor(normal: boolean, trap = false): D.MarkId[] {
    const all: D.MarkId[] = ['innovation', 'green']
    if (!normal && !trap) return []
    const k = trap ? 1 : rand() < 0.4 ? (rand() < 0.25 ? 2 : 1) : 0
    return shuffle(all.slice()).slice(0, k)
  }
  function newBidNotice(): Notice {
    const agency = pick(def.agencies)
    const n = 3 + (rand() < 0.5 ? 1 : 0)
    const comps = shuffle(D.COMPANIES.slice()).slice(0, n)
    let clues: D.Clue[] = Array(n).fill('none')
    let title: string
    let what: string
    let image: string
    let base: number
    if (def.no === 1) {
      const it = pick(D.ITEMS)
      title = `${it.name} 구매`
      what = it.name
      image = it.img
      base = (60 + Math.floor(rand() * 240)) * 10000
      let k = 0
      clues = clues.map(() => (k < 2 && rand() < def.suspicious * 1.15 ? (k++, 'ghost') : 'none'))
    } else {
      const b = pick(D.BUILDS)
      title = `${b.name} 공사`
      what = `${b.name} 공사`
      image = b.img
      base = (3 + Math.floor(rand() * 7)) * 1e8 + Math.floor(rand() * 90) * 1e6
      if (rand() < 0.32) {
        clues[0] = 'collusion'
        clues[1] = 'collusion'
      } else {
        let k = 0
        clues = clues.map(() => (k < 2 && rand() < def.suspicious ? (k++, 'safety') : 'none'))
      }
    }
    if (!clues.includes('none')) clues[clues.length - 1] = 'none'
    shuffle(clues)
    const colors = shuffle([0, 1, 2, 3, 4, 5])
    const step = def.no === 1 ? 30000 : 4e6
    const prices = shuffle(Array.from({ length: n }, (_, i) => base - i * step - Math.floor(rand() * 3) * (step / 3)))
    const trapOn = def.no === 3 && daySeconds() * 1000 - timeLeft >= 20000
    const bidders: Card[] = comps.map((company, i) => {
      const clue = clues[i]
      const trap = trapOn && clue !== 'none' && rand() < 0.6
      let photo: string
      if (def.no === 1) photo = clue === 'ghost' ? pick(D.OFFICES_EMPTY) : pick(D.OFFICES_OK)
      else photo = clue === 'safety' ? pick(D.BUILDS).unsafe : pick(D.BUILDS).safe
      return { id: ++cardNo, company, clue, trap, marks: marksFor(clue === 'none', trap), photo, price: prices[i], chip: colors[i], agency, what }
    })
    // 담합 짝은 같은 가격, 같은 색
    const pair = bidders.filter((b) => b.clue === 'collusion')
    if (pair.length === 2) {
      pair[1].price = pair[0].price
      pair[1].chip = pair[0].chip
    }
    bidders.sort((a, b) => (a.price! - b.price!) || a.company.name.localeCompare(b.company.name, 'ko'))
    return { agency, title, what, img: image, bidders, idx: 0, state: bidders.map((_, i) => (i === 0 ? 'now' : 'wait')) }
  }
  function newDelivery(forceNormal: boolean): Card {
    const agency = pick(def.agencies)
    const it = pick(D.ITEMS)
    const company = pick(D.COMPANIES)
    let clue: D.Clue = 'none'
    if (!forceNormal && rand() < def.suspicious) clue = it.wrong && rand() < 0.5 ? 'spec' : 'box'
    let boxLogo = company.logo
    if (clue === 'box') boxLogo = pick(D.COMPANIES.filter((c) => c.group !== company.group)).logo
    const photo = agency === 'school' ? D.DELIVERY.school : D.DELIVERY.health
    return { id: ++cardNo, company, clue, trap: false, marks: marksFor(clue === 'none'), photo, item: clue === 'spec' ? it.wrong : it.img, boxLogo, agency, what: it.name }
  }
  function guideCard(g: D.Clue): Card {
    if (def.kind === 'delivery') {
      const it = D.ITEMS[0]
      const company = D.COMPANIES[4]
      return { id: ++cardNo, company, clue: g, trap: false, marks: [], photo: D.DELIVERY.school, item: g === 'spec' ? it.wrong : it.img,
        boxLogo: g === 'box' ? D.COMPANIES[2].logo : company.logo, agency: 'school', guide: g, what: it.name }
    }
    notice = newBidNotice()
    const c = notice.bidders[0]
    c.clue = g
    c.guide = g
    c.trap = false
    if (g === 'none') { c.marks = ['innovation']; c.photo = D.OFFICES_OK[0] }
    if (g === 'ghost') { c.marks = []; c.photo = D.OFFICES_EMPTY[0] }
    if (g === 'safety') { c.marks = []; c.photo = D.BUILDS[0].unsafe }
    if (g === 'collusion') {
      c.marks = []; c.photo = D.BUILDS[0].safe
      const other = notice.bidders[1]
      other.clue = 'collusion'; other.price = c.price; other.chip = c.chip
    }
    return c
  }

  // --- 카드 보이기 ---
  function present(c: Card): void {
    card = c
    cardElapsed = 0
    links.innerHTML = ''
    slot.innerHTML = cardHTML(c)
    const ic = inner()!
    ic.classList.add('enter')
    bindDrag(ic)
    drawBoard()
    if (c.coach) {
      phase = 'coach'
    } else if (c.guide !== undefined) {
      phase = 'guide'
      const text = c.guide === 'none'
        ? '기준표와 서류가 같아요. 오른쪽으로 밀어 <b>통과</b>!'
        : c.trap ? '우대 마크가 있어도 기준과 다르면 정밀 확인해요' : D.RULES[c.guide as D.RuleId].guide
      say(text, 999999)
      after(500, () => linkRule(c.guide === 'none' ? def.board[0] : c.guide!, c.guide === 'none'))
      if (c.guide !== 'none') ring(spotOf(c.guide).x, spotOf(c.guide).y, 'teach')
    } else {
      phase = 'card'
      if (c.forced) say('이 서류는 스캔해 볼까요?', 999999)
    }
    drawButtons()
    c.marks.forEach((m) => unlock(m))
    if (o.demo && phase === 'card') demoAct(c)
    updateQa()
  }

  // --- 시연 모드 ---
  let demoQ: { card: Card; notice?: Notice }[] = []
  function caption(text: string): void {
    el.querySelector('.demo-cap')?.remove()
    const cap = h(`<div class="demo-cap">${text}</div>`)
    el.append(cap)
    after(2300, () => cap.remove())
  }
  function demoAct(c: Card): void {
    const a = c.demo
    if (!a) return
    if (c.rejudge) {
      after(1300, () => judge('pass'))
      return
    }
    if (a.cap) caption(a.cap)
    if (a.scan !== undefined) after(a.scan, () => scan())
    after(a.wait, () => judge(a.dir))
  }
  function buildDemo(no: number): { card: Card; notice?: Notice }[] {
    const co = (id: string) => D.COMPANIES.find((x) => x.id === id)!
    const it = (id: string) => D.ITEMS.find((x) => x.id === id)!
    const bid = (agency: D.AgencyId, title: string, what: string, image: string, list: [string, D.Clue, string, number, number, D.MarkId[], DemoAct][]) => {
      const bidders: Card[] = list.map(([cid, clue, photo, price, chip, marks, act]) => ({
        id: ++cardNo, company: co(cid), clue, trap: false, marks, photo, price, chip, agency, what, demo: act,
      }))
      const n: Notice = { agency, title, what, img: image, bidders, idx: 0, state: bidders.map(() => 'wait') }
      return bidders.map((card) => ({ card, notice: n }))
    }
    if (no === 1) return [
      ...bid('school', '소화기 구매', '소화기', it('ext').img, [
        ['dog', 'none', D.OFFICES_OK[1], 1280000, 0, ['innovation'], { cap: '기준표와 사무실 사진을 맞춰 봐요', wait: 2200, dir: 'pass' }],
      ]),
      ...bid('fire', '구급상자 구매', '구급상자', it('firstaid').img, [
        ['fox', 'ghost', D.OFFICES_EMPTY[0], 540000, 1, [], { cap: '사무실이 텅 비었어요. 기준과 달라요', wait: 2000, dir: 'check' }],
        ['panda', 'none', D.OFFICES_OK[3], 560000, 3, ['green'], { wait: 1300, dir: 'pass' }],
      ]),
    ]
    if (no === 2) {
      const a: Card = { id: ++cardNo, company: co('rabbit'), clue: 'box', trap: false, marks: [], photo: D.DELIVERY.school, what: '학생 의자',
        item: it('chair').img, boxLogo: co('frog').logo, agency: 'school', demo: { cap: '상자의 회사가 계약 회사와 달라요', wait: 2000, dir: 'check' } }
      const b: Card = { id: ++cardNo, company: co('bear'), clue: 'none', trap: false, marks: [], photo: D.DELIVERY.health, what: '소화기',
        item: it('ext').img, boxLogo: co('bear').logo, agency: 'health', forced: true, demo: { cap: '나르미도 가끔 잘못 봐요', scan: 900, wait: 2500, dir: 'check' } }
      return [{ card: a }, { card: b }]
    }
    return bid('district', '도서관 공사', '도서관 공사', D.BUILDS[0].img, [
      ['turtle', 'collusion', D.BUILDS[1].safe, 720000000, 2, [], { cap: '두 회사 가격이 똑같아요', wait: 2000, dir: 'check' }],
      ['lion', 'collusion', D.BUILDS[2].safe, 720000000, 2, [], { wait: 1100, dir: 'check' }],
      ['hedgehog', 'none', D.BUILDS[0].safe, 750000000, 5, ['green'], { cap: '기준에 맞는 회사가 낙찰!', wait: 1500, dir: 'pass' }],
    ])
  }

  function nextCard(): void {
    if (phase === 'end' || phase === 'result') return
    slot.innerHTML = ''
    links.innerHTML = ''
    if (o.demo) {
      const e = demoQ.shift()
      if (!e) return endStage()
      if (e.notice) {
        notice = e.notice
        notice.idx = notice.bidders.indexOf(e.card)
        notice.state[notice.idx] = 'now'
      }
      return present(e.card)
    }
    if (guides.length) return present(guideCard(guides.shift()!))
    if (timeLeft <= 0) return endStage()
    if (def.no === 3 && !trapShown && daySeconds() * 1000 - timeLeft >= 20000) {
      trapShown = true
      const g = guideCard('safety')
      g.trap = true
      g.marks = ['green']
      return present(g)
    }
    if (def.kind === 'delivery') {
      const forced = judgedInStage === 2 && !stageLog.some((l) => l.card.forced)
      const c = newDelivery(forced)
      c.forced = forced
      return present(c)
    }
    if (!notice || notice.idx >= notice.bidders.length || notice.state.includes('won')) notice = newBidNotice()
    notice.state[notice.idx] = 'now'
    present(notice.bidders[notice.idx])
  }

  // --- 판정 ---
  function judge(dir: Dir): void {
    if (!card || !inner()) return
    if (phase === 'coach') return judgeCoach(dir)
    if (phase === 'guide') return judgeGuide(dir)
    if (phase !== 'card') return
    if (card.forced && !card.scanned) {
      say('먼저 스캔해 볼까요?', 1200)
      return
    }
    const c = card
    const ic = inner()!
    const correct = (c.clue === 'none') === (dir === 'pass')
    phase = 'judging'
    drawButtons()
    stamp(ic, dir)

    // 틀린 AI 힌트를 따라 정밀 확인: 하트는 그대로, 다시 판정
    if (c.forced && c.scanned?.wrong && dir === 'check' && !c.rejudge) {
      if (!o.demo) record(c, false, dir)
      after(500, () => {
        phase = 'msg'
        ring(PHOTO.x + c.scanned!.x, PHOTO.y + c.scanned!.y, 'empty', '문제 없음')
        say('앗, 제가 잘못 봤어요! 동그라미 친 곳은 기준과 같아요. 기준표와 직접 맞춰 봐 주세요.', 999999)
        audio.play('wrong')
        narumi.play('narumi_no')
        const b = h('<button class="btn green again" data-act="again">다시 판정하기</button>')
        el.append(b)
        el.classList.add('rejudge')
        if (o.demo) after(2800, () => b.click())
        b.onclick = () => {
          b.remove()
          el.classList.remove('rejudge')
          audio.play('click')
          c.rejudge = true
          present(c)
          say('이번엔 기준표와 직접 맞춰 봐요', 1500)
        }
      })
      updateQa()
      return
    }
    if (c.forced && c.scanned?.wrong && dir === 'pass' && !c.rejudge) {
      run.score += 200
      toast('나르미가 잘못 본 곳을 찾아냈어요 +200', 'gold', 1800)
    }

    if (!c.rejudge) record(c, correct, dir)
    if (correct) {
      combo++
      let gain = 100
      if (cardElapsed < D.FAST_MS) { gain += 50; toast('빠른 판정 +50', 'fast', 900) }
      if (dir === 'pass' && c.marks.length) { gain += 50 * c.marks.length; toast(`우대 제품 +${50 * c.marks.length}`, 'mark', 1000) }
      run.score += gain
      after(110, () => audio.play('correct'))
      cheer()
      if (combo > 0 && combo % 5 === 0) {
        after(250, () => audio.play('combo'))
        toast(`연속 정답 ${combo}`, 'combo', 1000)
        after(300, () => narumi.play('narumi_happy'))
      } else {
        say(dir === 'pass' ? pick(['좋아요!', '공정하게, 쾅!', '꼼꼼해요!']) : `잡았어요! ${D.RULES[c.clue as D.RuleId].short}`, 1100)
      }
      settle(c, dir)
      after(c.rejudge ? 900 : 800, () => nextCard())
    } else {
      combo = 0
      if (!c.rejudge) loseHeart()
      after(110, () => audio.play('wrong'))
      after(150, () => dari.play('dari_sad'))
      after(200, () => narumi.play('narumi_no'))
      if (dir === 'pass') run.missed.push(c.clue)
      else run.waited++
      after(350, () => explain(c, dir))
    }
    drawScore()
    updateQa()
  }

  // 틀렸을 때: 시간을 멈추고 카드 위 동그라미와 이유를 보여 준다
  function explain(c: Card, dir: Dir): void {
    phase = 'feedback'
    drawButtons()
    const ok = c.clue === 'none'
    const r = ok ? null : D.RULES[c.clue as D.RuleId]
    const idx = def.board.indexOf(c.clue as D.RuleId)
    if (ok) {
      def.board.forEach((rr) => ring(spotOf(rr).x, spotOf(rr).y, 'ok', '같아요'))
    } else {
      ring(spotOf(c.clue).x, spotOf(c.clue).y, 'miss', r!.short)
      board.querySelector(`li[data-rule="${c.clue}"]`)?.classList.add('flash')
    }
    const title = ok ? '이 회사는 기준에 맞았어요' : `${idx + 1}번 기준과 달랐어요`
    const body = ok ? '기준표의 모든 줄과 같으면 통과시켜야 해요. 정밀 확인 때문에 이 회사의 심사가 늦어졌어요.' : `${r!.rule}. ${r!.why}`
    const why = h(`<div class="why panel"><div><h4>${title}</h4><p>${body}</p></div><button class="btn s" data-act="ok">알겠어요</button></div>`)
    el.append(why)
    let done = false
    const go = () => {
      if (done) return
      done = true
      audio.play('click')
      why.remove()
      board.querySelector('.flash')?.classList.remove('flash')
      phase = 'judging'
      settle(c, dir)
      // 하트를 다 잃으면 그날은 끝난다(시연은 계속)
      after(450, () => (hearts === 0 && !o.demo ? gameOver() : nextCard()))
    }
    ;(why.querySelector('[data-act="ok"]') as HTMLButtonElement).onclick = go
    if (o.demo) after(2600, go)
    updateQa()
  }

  // 판정 결과를 공고, 기관 칸, 날아가기에 반영
  function settle(c: Card, dir: Dir): void {
    const ic = inner()
    if (dir === 'pass') {
      if (c.clue === 'none') {
        run.delivered[c.agency]++
        stageDelivered[c.agency]++
        flyTo(c, `.agency[data-ag="${c.agency}"]`)
      } else {
        stagePost++
        flyTo(c, '.agency.post')
      }
      if (notice && def.kind === 'bid') notice.state[notice.idx] = 'won'
    } else if (notice && def.kind === 'bid') {
      notice.state[notice.idx] = 'check'
      notice.idx++
      if (notice.idx >= notice.bidders.length) toast('모든 회사가 정밀 확인 대상이라 공고를 다시 올려요', '', 1300)
    }
    drawBoard()
    if (ic) exitCard(ic, dir)
  }

  function judgeGuide(dir: Dir): void {
    const c = card!
    const want: Dir = c.clue === 'none' ? 'pass' : 'check'
    const ic = inner()!
    if (dir !== want) {
      ic.classList.remove('nudge')
      void ic.offsetWidth
      ic.classList.add('nudge')
      say(want === 'pass' ? '기준과 같아요. 오른쪽으로 밀어 통과시켜요' : '기준과 달라요. 왼쪽으로 밀어 정밀 확인해요', 1800)
      audio.play('click')
      return
    }
    phase = 'judging'
    drawButtons()
    stamp(ic, dir)
    after(110, () => audio.play('correct'))
    say('잘했어요!', 900)
    exitCard(ic, dir)
    links.innerHTML = ''
    notice = null // 시범 카드용 임시 공고는 버린다
    after(900, () => nextCard())
    updateQa()
  }

  function record(c: Card, correct: boolean, dir: Dir): void {
    run.judged.push({ clue: c.clue, correct })
    stageLog.push({ clue: c.clue, correct, card: c, dir })
    judgedInStage++
  }

  function loseHeart(): void {
    hearts = Math.max(0, hearts - 1)
    drawHearts()
    heartsEl.querySelectorAll('span')[hearts]?.classList.add('break')
  }

  function stamp(ic: HTMLElement, dir: Dir): void {
    audio.play('stamp')
    narumi.play('narumi_stamp')
    ic.append(h(`<img class="imprint ${dir}" src="assets/img/${dir === 'pass' ? 'stamp_pass' : 'stamp_check'}.webp" alt="" />`))
  }
  function exitCard(ic: HTMLElement, dir: Dir): void {
    after(320, () => {
      ic.classList.add(dir === 'pass' ? 'out-pass' : 'out-check')
      audio.play('swipe')
    })
  }

  // 무대 좌표(1920x1080)로 요소 가운데 얻기
  function pos(target: Element): { x: number; y: number } {
    const r = target.getBoundingClientRect()
    const s = el.getBoundingClientRect()
    const k = s.width / 1920
    return { x: (r.left + r.width / 2 - s.left) / k, y: (r.top + r.height / 2 - s.top) / k }
  }
  function flyTo(c: Card, sel: string): void {
    const target = el.querySelector(sel)
    const ic = inner()
    if (!target || !ic) return
    const from = pos(ic)
    const to = pos(target)
    const src = def.kind === 'delivery' ? c.item! : notice?.img ?? c.photo
    const f = h(`<img class="flyer" src="${src}" alt="" style="left:${from.x}px;top:${from.y}px" />`)
    el.append(f)
    after(380, () => {
      f.style.transform = `translate(${to.x - from.x}px, ${to.y - from.y}px) scale(0.3)`
      f.style.opacity = '0.2'
    })
    after(1100, () => {
      f.remove()
      drawAgencies()
      el.querySelector(sel)?.classList.add('bump')
    })
  }

  // 맞히면 달이가 폴짝 뛰고 종이 폭죽이 터진다
  function cheer(): void {
    dari.play('dari_cheer')
    const spot = $('.dari-spot')
    const colors = ['#ffcd38', '#2fae5c', '#2f6fd6', '#e5475b', '#ff8a1f']
    const burst = h('<div class="confetti"></div>')
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rand() * 0.4
      const d = 90 + rand() * 70
      const bit = h(`<i style="--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 60}px;--r:${Math.round(rand() * 360)}deg;background:${colors[i % colors.length]}"></i>`)
      burst.append(bit)
    }
    spot.append(burst)
    after(900, () => burst.remove())
  }

  // --- 나르미 스캔 ---
  function scan(): void {
    if (phase !== 'card' || !card || card.scanned) return
    const forcedWait = !!card.forced && !card.scanned
    if (!forcedWait && scans <= 0) return
    if (!forcedWait) scans--
    const c = card
    let wrong = false
    if (c.forced) wrong = true
    else if (def.no === 2 && c.clue === 'none') wrong = rand() < 0.15
    else if (def.no === 3) wrong = c.clue === 'none' ? rand() < 0.15 : rand() < 0.25
    const spot = spotOf(c.clue === 'none' ? def.board[0] : c.clue)
    let hint: Hint
    if (c.clue === 'none' && !wrong) hint = { level: '낮음', x: spot.x - PHOTO.x, y: spot.y - PHOTO.y, wrong }
    else if (c.clue === 'none' && wrong) hint = { level: '높음', x: 90 + rand() * 60, y: 290 + rand() * 40, wrong }
    else if (wrong) hint = { level: '낮음', x: 240, y: 190, wrong }
    else hint = { level: '높음', x: spot.x - PHOTO.x, y: spot.y - PHOTO.y, wrong }
    c.scanned = hint
    if (unlock('scan')) toast('수첩에 나르미 스캔을 적었어요', 'note', 1600)
    audio.play('scan')
    el.classList.add('scanning')
    after(900, () => el.classList.remove('scanning'))
    if (run.firstScan) {
      run.firstScan = false
      toast('나르미도 가끔 잘못 봐요. 기준표와 꼭 맞춰 보세요', 'policy', 2600)
    }
    after(350, () => {
      if (card !== c || !inner()) return
      if (hint.level === '높음') ring(PHOTO.x + hint.x, PHOTO.y + hint.y, 'scan', '수상해요')
      else inner()!.append(h('<div class="scan-tag low">수상한 곳 없음</div>'))
      say(hint.level === '높음' ? '여기가 수상해요!' : '이상 없어 보여요', 1200)
    })
    drawButtons()
    updateQa()
  }

  // --- 끌기 입력 ---
  function bindDrag(ic: HTMLElement): void {
    let x0 = 0
    let dx = 0
    let id = -1
    const k = () => el.getBoundingClientRect().width / 1920
    ic.addEventListener('pointerdown', (e) => {
      if (phase !== 'card' && phase !== 'guide' && phase !== 'coach') return
      id = e.pointerId
      x0 = e.clientX
      dx = 0
      ic.setPointerCapture(id)
      ic.classList.add('dragging')
    })
    ic.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return
      dx = (e.clientX - x0) / k()
      ic.style.transform = `translateX(${dx}px) rotate(${dx / 30}deg)`
      ic.style.setProperty('--pass', String(Math.max(0, Math.min(1, dx / 240))))
      ic.style.setProperty('--check', String(Math.max(0, Math.min(1, -dx / 240))))
    })
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return
      id = -1
      ic.classList.remove('dragging')
      const d = dx
      ic.style.transform = ''
      ic.style.setProperty('--pass', '0')
      ic.style.setProperty('--check', '0')
      if (Math.abs(d) > 200) judge(d > 0 ? 'pass' : 'check')
    }
    ic.addEventListener('pointerup', end)
    ic.addEventListener('pointercancel', end)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || el.querySelector('.overlay')) return
    if (e.key === 'ArrowRight') judge('pass')
    else if (e.key === 'ArrowLeft') judge('check')
    else if (e.key === 's' || e.key === 'S' || e.key === 'ㄴ') scan()
    else if ((e.key === 'Enter' || e.key === ' ') && phase === 'feedback') (el.querySelector('.why [data-act="ok"]') as HTMLButtonElement | null)?.click()
  }
  window.addEventListener('keydown', onKey)
  passBtn.onclick = () => judge('pass')
  checkBtn.onclick = () => judge('check')
  scanBtn.onclick = () => scan()
  noteBtn.onclick = () => {
    clock.pause('note')
    showDex(el, () => clock.resume('note'))
  }
  pauseBtn.onclick = () =>
    o.pause(`${def.no}일차 진행 중, 남은 시간 ${Math.ceil(Math.max(0, timeLeft) / 1000)}초`, () => {
      dispose()
      o.onTitle()
    })

  // --- 시간: 심사 중(card, judging)에만 하루 시간이 흐른다. 브리핑, 시범, 설명, 튜토리얼에서는 멈춘다 ---
  const stop = clock.onTick((dt) => {
    for (let i = timers.length - 1; i >= 0; i--) {
      timers[i].t -= dt
      if (timers[i].t <= 0) timers.splice(i, 1)[0].fn()
    }
    if (bubbleT > 0 && bubbleT < 900000) {
      bubbleT -= dt
      if (bubbleT <= 0) bubble.hidden = true
    }
    const forcedWait = phase === 'card' && !!card?.forced && !card.scanned
    const flowing = (phase === 'card' || (phase === 'judging' && !isGuide())) && !forcedWait && !o.demo
    if (flowing) timeLeft = Math.max(0, timeLeft - dt)
    if (phase === 'card') {
      cardElapsed += dt
      if (timeLeft <= 0 && !o.demo) endStage()
    }
    timeNum.textContent = timeLeft >= 10000 ? String(Math.ceil(timeLeft / 1000)) : (timeLeft / 1000).toFixed(1)
    timeBar.style.transform = `scaleX(${timeLeft / (daySeconds() * 1000)})`
    timeChip.classList.toggle('low', timeLeft < 10000)
    o.qa.timeLeft = timeLeft
    updateQa()
  })

  // --- 튜토리얼: 화면 부분을 하나씩 비추고, 연습 카드 두 장을 직접 밀어 본다. 건너뛰기 가능 ---
  function runCoach(done: () => void): void {
    phase = 'coach'
    drawButtons()
    const layer = h(`<div class="coach"><div class="hole"></div><div class="coach-box panel"><img class="face" src="favicon.png" alt="" /><span class="who">나르미</span><p></p><div class="coach-btns"><button class="btn s" data-act="cnext">다음</button></div></div>
      <button class="btn paper s skip" data-act="skip">건너뛰기</button><div class="hand" hidden></div></div>`)
    el.append(layer)
    const hole = layer.querySelector('.hole') as HTMLElement
    const box = layer.querySelector('.coach-box') as HTMLElement
    const text = box.querySelector('p') as HTMLElement
    const nextB = layer.querySelector('[data-act="cnext"]') as HTMLButtonElement
    const hand = layer.querySelector('.hand') as HTMLElement
    const practice = (good: boolean): Card => {
      notice = {
        agency: 'school', title: '소화기 구매', what: '소화기', img: D.ITEMS[0].img, idx: 0, state: ['now', 'wait'],
        bidders: [
          { id: ++cardNo, company: good ? D.COMPANIES[8] : D.COMPANIES[9], clue: good ? 'none' : 'ghost', trap: false, marks: [], photo: good ? D.OFFICES_OK[1] : D.OFFICES_EMPTY[1], price: 1240000, chip: 0, agency: 'school', what: '소화기', coach: good ? 'pass' : 'check' },
          { id: ++cardNo, company: D.COMPANIES[10], clue: 'none', trap: false, marks: [], photo: D.OFFICES_OK[2], price: 1310000, chip: 2, agency: 'school', what: '소화기' },
        ],
      }
      return notice.bidders[0]
    }
    type Step = { sel?: string; t: string; act?: () => void; wait?: Dir }
    const steps: Step[] = [
      { t: '어서 오세요, 심사관님! 저는 조달청 마스코트 <b>나르미</b>예요. 일하는 법을 알려 드릴게요.' },
      { sel: '.board', t: '왼쪽은 <b>오늘의 기준표</b>예요. 회사 서류가 이 기준과 맞는지만 보면 돼요.', act: () => present(practice(true)) },
      { sel: '.card-slot', t: '가운데는 회사가 낸 <b>서류</b>예요. 노란 번호 <b>1</b>이 기준표 1번 줄과 짝이에요. 사무실 사진이 기준과 같죠?', act: () => linkRule('ghost', true) },
      { sel: '.card-slot', t: '기준과 같으면 카드를 <b>오른쪽</b>으로 밀어 통과! 직접 해 봐요. 아래 통과 버튼을 눌러도 돼요.', wait: 'pass' },
      { sel: '.card-slot', t: '이번 사무실은 텅 비었어요. 기준과 다르면 <b>왼쪽</b>으로 밀어 정밀 확인!', act: () => { present(practice(false)); linkRule('ghost', false) }, wait: 'check' },
      { sel: '.hud-l', t: '하루 심사 시간은 45초예요. 틀려도 시간이 멈추고 이유를 알려 줘요.' },
      { sel: '.hud-r', t: '하트는 실수할 수 있는 횟수예요. 책 버튼은 <b>규칙 수첩</b>이고, 펴는 동안 시간이 멈춰요.' },
      { sel: '.scan-btn', t: '<b>스캔</b>을 누르면 제가 돋보기로 수상한 곳에 동그라미를 쳐 드려요. 하루 세 번 쓸 수 있어요. 저도 가끔 잘못 보니까 기준표와 꼭 맞춰 봐 주세요.' },
      { t: '이제 첫 출근이에요. 하루가 끝나면 심사관님의 판정이 편지로 돌아와요!' },
    ]
    let i = -1
    const finish = () => {
      layer.remove()
      links.innerHTML = ''
      slot.innerHTML = ''
      notice = null
      card = null
      coachWait = null
      skipGuides = true
      o.onTutorialDone?.()
      done()
    }
    const go = () => {
      i++
      if (i >= steps.length) return finish()
      const s = steps[i]
      s.act?.()
      hand.hidden = !s.wait
      hand.className = `hand ${s.wait ?? ''}`
      nextB.hidden = !!s.wait
      nextB.textContent = i === steps.length - 1 ? '시작하기' : '다음'
      text.innerHTML = s.t
      if (s.sel) {
        // 카드는 판정 버튼까지 함께 비춘다
        const t = el.querySelector(s.sel) as HTMLElement
        const a = pos(t)
        const isCard = s.sel === '.card-slot'
        const w = t.offsetWidth + 32
        const hh = isCard ? 820 : t.offsetHeight + 32
        const top = isCard ? 216 : a.y - hh / 2
        Object.assign(hole.style, { left: `${a.x - w / 2}px`, top: `${top}px`, width: `${w}px`, height: `${hh}px`, opacity: '1' })
        // 설명 상자(폭 600)는 비춘 곳과 겹치지 않는 쪽, 화면 안에 둔다
        const bx = isCard ? 1272 : a.x < 960 ? a.x + w / 2 + 40 : a.x - w / 2 - 640
        box.style.left = `${Math.max(32, Math.min(1920 - 632, bx))}px`
        box.style.top = `${isCard ? 240 : Math.min(1080 - 32 - box.offsetHeight, Math.max(140, a.y - 100))}px`
      } else {
        Object.assign(hole.style, { left: '960px', top: '540px', width: '0px', height: '0px', opacity: '0' })
        box.style.left = '660px'
        box.style.top = '400px'
      }
      coachWait = s.wait ? (d: Dir) => {
        if (d !== s.wait) {
          inner()?.classList.remove('nudge')
          void inner()?.offsetWidth
          inner()?.classList.add('nudge')
          text.innerHTML = s.wait === 'pass' ? '기준과 같으니 <b>오른쪽</b>으로 밀어 봐요' : '기준과 다르니 <b>왼쪽</b>으로 밀어 봐요'
          audio.play('click')
          return
        }
        const ic = inner()!
        stamp(ic, d)
        after(110, () => audio.play('correct'))
        exitCard(ic, d)
        links.innerHTML = ''
        coachWait = null
        hand.hidden = true
        after(900, go)
      } : null
      drawButtons()
      updateQa()
    }
    nextB.onclick = () => (audio.play('click'), go())
    ;(layer.querySelector('[data-act="skip"]') as HTMLButtonElement).onclick = () => (audio.play('click'), finish())
    go()
  }
  function judgeCoach(dir: Dir): void {
    coachWait?.(dir)
  }

  // --- 하루 ---
  function startStage(i: number): void {
    stageIdx = i
    def = D.STAGES[i]
    timeLeft = daySeconds() * 1000
    hearts = maxHearts()
    dayStart = { score: run.score, judged: run.judged.length, missed: run.missed.length, waited: run.waited, delivered: { ...run.delivered } }
    scans = 3
    combo = 0
    judgedInStage = 0
    stageLog = []
    stageDelivered = { school: 0, fire: 0, health: 0, district: 0 }
    stagePost = 0
    trapShown = false
    notice = null
    card = null
    slot.innerHTML = ''
    guides = o.demo || (skipGuides && i === 0) ? [] : (i === 0 ? ['none' as D.Clue] : []).concat(def.rules)
    demoQ = o.demo ? buildDemo(def.no) : []
    dayNo.textContent = `${def.no}일차`
    dayTitle.textContent = def.title
    el.dataset.stage = String(def.no)
    drawHearts()
    drawScore()
    drawAgencies()
    drawBoard()
    phase = 'brief'
    drawButtons()
    briefing()
    updateQa()
  }

  // 출근 브리핑: 오늘 하는 일과 새 규칙(맞는 그림과 다른 그림). 규칙은 수첩에 적힌다
  function briefing(): void {
    const pics: Record<D.RuleId, [string, string]> = {
      ghost: [`<img src="${D.OFFICES_OK[0]}" alt="" />`, `<img src="${D.OFFICES_EMPTY[0]}" alt="" />`],
      spec: [`<img class="fit" src="${D.ITEMS[0].img}" alt="" />`, `<img class="fit" src="${D.ITEMS[0].wrong}" alt="" />`],
      box: [`<span class="pair"><img src="${D.COMPANIES[4].logo}" alt="" /><img src="${D.COMPANIES[4].logo}" alt="" /></span>`, `<span class="pair"><img src="${D.COMPANIES[4].logo}" alt="" /><img src="${D.COMPANIES[2].logo}" alt="" /></span>`],
      collusion: ['<span class="mini-chips big"><i style="background:#ffd23f">72억</i><i style="background:#8ec9ff">75억</i></span>', '<span class="mini-chips big"><i style="background:#ffd23f">72억</i><i style="background:#ffd23f">72억</i></span>'],
      safety: [`<img src="${D.BUILDS[0].safe}" alt="" />`, `<img src="${D.BUILDS[0].unsafe}" alt="" />`],
    }
    const extra = def.no === 1 ? `<div class="brief-tip"><b>심사 순서</b> 값이 낮은 회사부터 서류를 보고, 기준에 맞는 첫 회사가 낙찰돼요. 낙찰은 값만 보지 않아요.</div>` : ''
    const rules = def.rules.map((r) => {
      const R = D.RULES[r]
      const n = def.board.indexOf(r) + 1
      return `<div class="brief-rule"><div class="br-head"><span class="no">${n}</span><h4>${R.name}</h4></div><p class="br-rule">${R.rule}</p>
        <div class="br-pics"><figure class="good">${pics[r][0]}<figcaption>${ICON.check}맞아요</figcaption></figure><figure class="bad">${pics[r][1]}<figcaption>달라요</figcaption></figure></div>
        <p class="br-why">${R.why}</p></div>`
    }).join('')
    const ov = h(`<div class="overlay brief"><div class="panel sheet">
      <div class="plate"><h2>${def.no}일차 출근 <small>${def.title}</small></h2></div>
      <div class="sheet-paper"><div class="sheet-body"><div class="br-top"><p class="br-fact">${def.fact}</p><div class="br-ag">${def.agencies.map((a) => `<span><img src="${D.AGENCIES[a].img}" alt="" />${D.AGENCIES[a].name}</span>`).join('')}</div></div>${extra}<p class="br-new">오늘의 새 규칙</p><div class="br-rules n${def.rules.length}">${rules}</div></div>
      <div class="sheet-foot"><button class="btn green" data-act="go">${ICON.play}심사 시작</button></div></div>
    </div></div>`)
    el.append(ov)
    audio.play('open')
    let added = 0
    def.rules.forEach((r) => (added += unlock(r) ? 1 : 0))
    if (def.no === 1 && unlock('price')) added++
    const go = () => {
      audio.play('click')
      ov.remove()
      if (added) toast(`수첩에 새 규칙 ${added}개를 적었어요`, 'note', 1600)
      nextCard()
    }
    ;(ov.querySelector('[data-act="go"]') as HTMLButtonElement).onclick = go
    if (o.demo) after(2200, go)
  }

  function stars(acc: number): number {
    return acc >= 0.95 ? 3 : acc >= 0.85 ? 2 : acc >= 0.7 ? 1 : 0
  }

  // 하루 끝 정산: 별, 전해진 곳, 편지(최대 3통)
  function letters(): D.Letter[] {
    const out: D.Letter[] = []
    const used = new Set<string>()
    const add = (kind: D.LetterKind, l: (typeof stageLog)[number]) => {
      const key = kind + l.clue
      if (used.has(key) || out.length >= 3) return
      used.add(key)
      const L = D.letterFor(kind, l.clue === 'none' ? null : (l.clue as D.RuleId), l.card.company.name, l.card.agency, l.card.what, l.card.marks[0])
      if (!L.fromImg) L.fromImg = l.card.company.logo
      out.push(L)
    }
    stageLog.filter((l) => !l.correct && l.dir === 'pass').forEach((l) => add('missed', l))
    stageLog.filter((l) => !l.correct && l.dir === 'check').slice(0, 1).forEach((l) => add('waited', l))
    stageLog.filter((l) => l.correct && l.dir === 'check').forEach((l) => add('caught', l))
    stageLog.filter((l) => l.correct && l.dir === 'pass').sort((a, b) => b.card.marks.length - a.card.marks.length).slice(0, 1).forEach((l) => add('good', l))
    return out
  }

  function endStage(): void {
    if (phase === 'result' || phase === 'end') return
    phase = 'result'
    slot.innerHTML = ''
    links.innerHTML = ''
    card = null
    bubble.hidden = true
    drawButtons()
    const last = stageIdx === D.STAGES.length - 1
    if (o.demo) {
      run.stars.push(3)
      after(700, () => (last ? finalResult() : startStage(stageIdx + 1)))
      return
    }
    const n = stageLog.length
    const ok = stageLog.filter((l) => l.correct).length
    const acc = n ? ok / n : 0
    const st = stars(acc)
    run.stars.push(st)
    audio.play('fanfare')
    narumi.play('narumi_happy')
    const ls = letters()
    const panel = h(`<div class="overlay result"><div class="panel sheet">
      <div class="plate"><h2>${def.no}일차 퇴근 <small>오늘 온 편지</small></h2></div>
      <div class="sheet-paper"><div class="sheet-body res-body">
        <div class="res-side"><div class="res-left">
          <div class="stars">${[0, 1, 2].map((i) => `<span class="${i < st ? 'on' : ''}">${ICON.star}</span>`).join('')}</div>
          <p class="r-main">맞게 판정 <b>${ok}</b> / ${n}장</p>
          <p class="r-sub">정확도 ${Math.round(acc * 100)}%</p>
          <ul class="r-deliv">${def.agencies.map((a) => `<li><img src="${D.AGENCIES[a].img}" alt="" />${D.AGENCIES[a].name}<b>${stageDelivered[a]}</b></li>`).join('')}</ul>
          <p class="r-star">별 기준은 정확도 70%, 85%, 95%예요</p>
        </div><button class="btn green" data-act="next">${last ? '최종 결과 보기' : '다음 날'}${ICON.right}</button></div>
        <div class="letters">${ls.length ? ls.map((l, i) => `<article class="letter sealed" style="--i:${i}">
            <span class="postage"><img src="${l.fromImg}" alt="" /></span>
            <header><small>보낸 곳</small><b>${l.from}</b></header>
            <p class="body">${l.body}</p><p class="sig">${l.from} 드림</p>
            <p class="lesson"><b>나르미 메모</b> ${l.lesson}</p>
            <i class="envelope"><i class="seal"></i></i></article>`).join('') : '<p class="no-letter">오늘은 온 편지가 없어요.</p>'}</div>
      </div></div>
    </div></div>`)
    el.append(panel)
    // 봉투를 하나씩 연다
    panel.querySelectorAll('.letter').forEach((lt, i) => after(500 + i * 650, () => {
      lt.classList.remove('sealed')
      audio.play('letter')
    }))
    ;(panel.querySelector('[data-act="next"]') as HTMLButtonElement).onclick = () => {
      audio.play('click')
      panel.remove()
      if (last) finalResult()
      else startStage(stageIdx + 1)
    }
    updateQa()
  }

  // 하트를 모두 잃으면: 그날 틀린 규칙을 보여 주고, 그날을 처음부터 다시 하거나 타이틀로 간다
  function gameOver(): void {
    phase = 'over'
    slot.innerHTML = ''
    links.innerHTML = ''
    card = null
    bubble.hidden = true
    drawButtons()
    const n = stageLog.length
    const ok = stageLog.filter((l) => l.correct).length
    const missed = [...new Set(stageLog.filter((l) => !l.correct).map((l) => l.clue))]
    const rows = missed.map((m) => m === 'none'
      ? '<li><b>기준에 맞는 회사</b><span>기준표의 모든 줄과 같으면 통과시켜요.</span></li>'
      : `<li><b>${D.RULES[m as D.RuleId].name}</b><span>${D.RULES[m as D.RuleId].rule}.</span></li>`).join('')
    const ov = h(`<div class="overlay gameover"><div class="panel sheet">
      <div class="plate"><h2>${def.no}일차 심사 중단 <small>하트를 모두 썼어요</small></h2></div>
      <div class="sheet-paper"><div class="sheet-body go-body">
        <div class="res-left"><div class="go-hearts">${Array.from({ length: maxHearts() }, () => `<span>${ICON.heart}</span>`).join('')}</div>
          <p class="r-main">맞게 판정 <b>${ok}</b> / ${n}장</p><p class="r-sub">오늘 심사는 여기까지예요</p></div>
        <div class="go-right"><h4>다시 볼 규칙</h4><ul class="go-rules">${rows}</ul>
          <p class="go-tip">다시 하면 오늘 출근부터 새로 시작해요. 헷갈리면 규칙 수첩을 펴 보세요.</p></div>
      </div>
      <div class="sheet-foot"><button class="btn paper" data-act="home">${ICON.home}타이틀</button><button class="btn paper" data-act="dex">${ICON.book}수첩</button><button class="btn green" data-act="retry">오늘 다시 하기</button></div></div>
    </div></div>`)
    el.append(ov)
    audio.play('open')
    narumi.play('narumi_no')
    dari.play('dari_sad')
    const b = (a: string) => ov.querySelector(`[data-act="${a}"]`) as HTMLButtonElement
    b('dex').onclick = () => showDex(el)
    b('home').onclick = () => {
      audio.play('click')
      dispose()
      o.onTitle()
    }
    b('retry').onclick = () => {
      audio.play('click')
      ov.remove()
      run.score = dayStart.score
      run.judged.length = dayStart.judged
      run.missed.length = dayStart.missed
      run.waited = dayStart.waited
      run.delivered = { ...dayStart.delivered }
      startStage(stageIdx)
    }
    updateQa()
  }

  function finalResult(): void {
    phase = 'end'
    const total = run.judged.length
    const ok = run.judged.filter((j) => j.correct).length
    const acc = total ? ok / total : 0
    const level = acc >= 0.95 ? 3 : acc >= 0.85 ? 2 : acc >= 0.7 ? 1 : 0
    const sum = run.stars.reduce((a, b) => a + b, 0)
    const badge = sum >= 7 ? 3 : sum >= 4 ? 2 : 1
    const parts = (Object.keys(run.delivered) as D.AgencyId[]).filter((a) => run.delivered[a] > 0).map((a) => `${D.AGENCIES[a].name} ${run.delivered[a]}곳`)
    const headline = parts.length ? `사흘 동안 ${parts.join(', ')}에 필요한 것이 공정하게 전해졌어요` : '사흘 심사를 마쳤어요. 다음엔 더 꼼꼼히!'
    const counts = new Map<D.Clue, number>()
    run.missed.forEach((m) => counts.set(m, (counts.get(m) ?? 0) + 1))
    const worst = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] as D.RuleId | undefined
    const policy = worst ? { tag: '다음에는 이 규칙을 꼭 살펴봐요', t: D.RULES[worst].name, d: D.RULES[worst].action } : { tag: '성실한 회사의 다음 칸', t: D.LADDER[level], d: D.LADDER_INFO[level] }
    unlock('ladder')
    // 계단 칸 윗면 가운데(달이 발 위치)와 앞면 이름표 위치. ladder.webp 를 900x600 으로 줄여 잰 값
    const steps = [
      { x: 268, y: 440, lx: 290, ly: 500 }, { x: 377, y: 350, lx: 405, ly: 412 },
      { x: 482, y: 268, lx: 515, ly: 326 }, { x: 565, y: 203, lx: 615, ly: 244 },
    ]
    const s = h(`<section class="scene final">
      <img class="bg" src="assets/img/bg_title.webp" alt="" />
      <h2 class="f-head panel">${headline}</h2>
      <div class="ladder-box panel">
        <img class="ladder" src="assets/img/ladder.webp" alt="" />
        ${D.LADDER.map((n, i) => `<span class="step-label" style="left:${steps[i].lx}px;top:${steps[i].ly}px">${n}</span>`).join('')}
        <div class="climber"></div>
      </div>
      <div class="f-side">
        <div class="badge panel"><p class="b-words">투명, 공정, 신뢰</p><div class="stars">${[0, 1, 2].map((i) => `<span class="${i < badge ? 'on' : ''}">${ICON.star}</span>`).join('')}</div>
          <p class="b-sub">정확도 ${Math.round(acc * 100)}%, 점수 ${run.score.toLocaleString('ko-KR')}, 수첩 ${dexCount()} / ${DEX.length}쪽</p></div>
        <div class="policy panel"><p class="p-tag">${policy.tag}</p><h4>${policy.t}</h4><p>${policy.d}</p></div>
        <div class="f-btns"><button class="btn green" data-act="again">다시 하기</button><button class="btn paper" data-act="dex">${ICON.book}수첩</button><button class="btn paper" data-act="home">${ICON.home}타이틀</button></div>
      </div>
    </section>`)
    o.root.replaceChildren(s)
    const climber = new Sprite('dari_run', 154)
    const cl = s.querySelector('.climber') as HTMLElement
    cl.append(climber.el)
    const place = (k: number) => {
      cl.style.left = `${steps[k].x - climber.width / 2}px`
      cl.style.top = `${steps[k].y - 146}px`
    }
    place(0)
    let at = 0
    const climb = () => {
      if (at >= level) {
        climber.dispose()
        const fin = new Sprite('dari_cheer', 154)
        cl.replaceChildren(fin.el)
        audio.play('fanfare')
        return
      }
      at++
      audio.play('combo')
      place(at)
      setTimeout(climb, 650)
    }
    setTimeout(climb, 900)
    ;(s.querySelector('[data-act="dex"]') as HTMLButtonElement).onclick = () => showDex(s)
    o.qa.final = { acc, level, badge, score: run.score }
    o.qa.scene = 'final'
    ;(s.querySelector('[data-act="again"]') as HTMLButtonElement).onclick = () => {
      audio.play('click')
      dispose()
      startGame({ ...o, tutorial: false })
    }
    ;(s.querySelector('[data-act="home"]') as HTMLButtonElement).onclick = () => {
      audio.play('click')
      dispose()
      o.onTitle()
    }
  }

  function dispose(): void {
    stop()
    narumi.dispose()
    dari.dispose()
    window.removeEventListener('keydown', onKey)
    timers.length = 0
    phase = 'end'
  }

  o.qa.scene = 'play'
  if (o.tutorial) {
    def = D.STAGES[0]
    dayNo.textContent = '연습'
    dayTitle.textContent = '첫 출근 준비'
    drawHearts()
    drawAgencies()
    drawBoard()
    runCoach(() => startStage(0))
  } else startStage(0)
  updateQa()
  return dispose
}
