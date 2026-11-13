// --- 판정 루프: 단계 진행, 공고와 입찰 순위, 카드 판정, 하트, 나르미 스캔, 단계 결과, 최종 결과 ---
import './play.css'
import { clock } from './clock'
import { audio } from './audio'
import { ICON } from './icons'
import { Sprite } from './sprite'
import * as D from './data'
import { unlock, showDex } from './dex'

type Dir = 'pass' | 'check'
type DemoAct = { cap?: string; wait: number; dir: Dir; scan?: number }
type Phase = 'intro' | 'guide' | 'card' | 'judging' | 'msg' | 'result' | 'end'

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
  guide?: D.Clue // 안내 카드면 가르치는 단서
  forced?: boolean // 2단계 강제 스캔 카드(정상 카드, 일부러 틀린 힌트)
  scanned?: Hint
  rejudge?: boolean // 틀린 힌트 장면 뒤 다시 판정(정확도에 세지 않는다)
  demo?: DemoAct
}

interface Notice {
  agency: D.AgencyId
  title: string
  img: string
  spec?: string
  bidders: Card[]
  idx: number
  state: ('wait' | 'now' | 'won' | 'check')[]
}

interface Hint {
  level: '높음' | '보통' | '낮음'
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
  seed?: number
  demo?: boolean // 시연 모드: 정해진 카드와 입력으로 시연영상 장면을 그대로 재생한다
}

const CHIP_COLORS = ['#ffd23f', '#7fe3a2', '#8ec9ff', '#ffb3c7', '#c9a8ff', '#ffb27a']
const PHOTO = { x: 20, y: 112, w: 480, h: 400 }

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

  // --- 전체 기록 ---
  const run = {
    stars: [] as number[],
    judged: [] as { clue: D.Clue; correct: boolean }[],
    delivered: { school: 0, fire: 0, health: 0, district: 0 } as Record<D.AgencyId, number>,
    honest: 0,
    waited: 0,
    postCheck: 0,
    missed: [] as D.Clue[],
    score: 0,
    firstScan: true,
    taught: new Set<D.Clue>(),
  }

  // --- 화면 ---
  const el = h(`<section class="scene play">
    <img class="bg" src="assets/img/bg_game.webp" alt="" />
    <div class="shade"></div>
    <header class="hud">
      <span class="chip stage"><b class="outline"></b><small>입찰 마감 전 1차 확인</small></span>
      <div class="timer-wrap">
        <span class="chip timer">${ICON.clock}<span class="num">45</span></span>
        <span class="timebar"><i></i></span>
      </div>
      <div class="right">
        <span class="chip score">0</span>
        <span class="chip hearts"></span>
        <button class="ibtn small" data-act="pause" aria-label="일시정지">${ICON.pause}</button>
      </div>
    </header>
    <div class="agencies"></div>
    <aside class="board panel"></aside>
    <div class="table">
      <button class="judge check" data-act="check" aria-label="정밀 확인"><img src="assets/img/stamp_check.webp" alt="" /><span>정밀 확인</span></button>
      <div class="card-slot"></div>
      <button class="judge pass" data-act="pass" aria-label="통과"><img src="assets/img/stamp_pass.webp" alt="" /><span>통과</span></button>
    </div>
    <div class="narumi-spot"><div class="bubble" hidden></div></div>
    <button class="scan-btn" data-act="scan"><span class="lens"></span><b>나르미 스캔</b><small></small></button>
    <div class="dari-spot"></div>
    <div class="toast-layer"></div>
  </section>`)
  o.root.replaceChildren(el)
  const $ = <T extends HTMLElement>(s: string) => el.querySelector(s) as T
  const stageChip = $('.chip.stage b')
  const timeNum = $('.timer .num')
  const timeWrap = $('.timer-wrap')
  const timeBar = $('.timebar i')
  const scoreEl = $('.chip.score')
  const heartsEl = $('.chip.hearts')
  const agenciesEl = $('.agencies')
  const board = $('.board')
  const slot = $('.card-slot')
  const bubble = $('.narumi-spot .bubble')
  const scanBtn = $<HTMLButtonElement>('.scan-btn')
  const toasts = $('.toast-layer')
  const narumi = new Sprite('narumi_idle', 470)
  $('.narumi-spot').prepend(narumi.el)
  const dari = new Sprite('dari_idle', 190)
  $('.dari-spot').append(dari.el)

  // --- 단계 상태 ---
  let stageIdx = 0
  let def = D.STAGES[0]
  let phase: Phase = 'intro'
  let timeLeft = D.STAGE_SECONDS * 1000
  let cardLeft = 0
  let cardFreeze = 0
  let cardElapsed = 0
  let guideJudging = false // 안내 카드 판정 연출 중에는 단계 시간이 흐르지 않는다
  let hearts = 3
  let help = false
  let scans = 3
  let combo = 0
  let cardNo = 0
  let judgedInStage = 0
  let guides: D.Clue[] = []
  let trapShown = false
  let notice: Notice | null = null
  let card: Card | null = null
  let cardEl: HTMLElement | null = null
  let stageLog: { clue: D.Clue; correct: boolean; card: Card }[] = []
  let stageDelivered: Record<D.AgencyId, number> = { school: 0, fire: 0, health: 0, district: 0 }
  let stagePost = 0
  const timers: { t: number; fn: () => void }[] = []
  const after = (ms: number, fn: () => void) => timers.push({ t: ms, fn })
  const maxHearts = () => (o.easy ? 5 : 3)
  const cardTime = () => def.cardTime * 1000 * (o.easy || help ? 1.5 : 1)

  const updateQa = () => {
    o.qa.play = {
      stage: def.no, phase, hearts, help, scans, score: run.score, timeLeft,
      clue: card?.clue ?? null, guide: card?.guide ?? null, forced: !!card?.forced, scanned: !!card?.scanned,
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
  function drawScan(): void {
    const forcedWait = !!card?.forced && !card.scanned
    scanBtn.querySelector('small')!.textContent = help ? '무제한' : `${scans}번 남음`
    scanBtn.disabled = !(phase === 'card' && !card?.scanned && (help || scans > 0 || forcedWait))
    scanBtn.classList.toggle('blink', forcedWait)
  }
  function drawAgencies(): void {
    agenciesEl.innerHTML = def.agencies
      .map((a) => `<div class="agency" data-ag="${a}"><img src="${D.AGENCIES[a].img}" alt="" /><b>${D.AGENCIES[a].name}</b><span class="cnt">${stageDelivered[a]}</span></div>`)
      .join('') + `<div class="agency post"><img src="assets/img/tray_investigate.webp" alt="" /><b>사후 점검</b><span class="cnt">${stagePost}</span></div>`
  }
  function drawBoard(): void {
    if (def.kind === 'delivery') {
      const it = card?.item ? findItemByCard(card) : null
      board.innerHTML = `<p class="board-tag">나라장터 납품검사</p>
        <h3>주문한 물건</h3>
        ${it ? `<img class="order-img" src="${it.img}" alt="" /><p class="order-name">${it.name}${it.spec ? `<small>규격: ${it.spec}</small>` : ''}</p>` : ''}
        ${card ? `<div class="order-company"><img src="${card.company.logo}" alt="" /><span>계약 업체<br><b>${card.company.name}</b></span></div>` : ''}
        <p class="board-help">도착한 물건과 상자를 주문과 비교해요</p>`
      return
    }
    if (!notice) {
      board.innerHTML = '<p class="board-tag">나라장터 공고</p>'
      return
    }
    const n = notice
    board.innerHTML = `<p class="board-tag">나라장터 공고</p>
      <div class="notice-head"><img src="${D.AGENCIES[n.agency].img}" alt="" /><div><small>${D.AGENCIES[n.agency].name}</small><h3>${n.title}</h3></div></div>
      <img class="order-img" src="${n.img}" alt="" />
      <p class="rank-title">입찰 가격 낮은 순</p>
      <ol class="rank">${n.bidders
        .map((b, i) => `<li class="${n.state[i]}"><i class="pchip" style="background:${CHIP_COLORS[b.chip ?? 0]}">${won(b.price ?? 0)}</i><img src="${b.company.logo}" alt="" /><span>${b.company.name}</span><em>${
          n.state[i] === 'won' ? '낙찰' : n.state[i] === 'check' ? '확인' : n.state[i] === 'now' ? '심사' : ''
        }</em></li>`)
        .join('')}</ol>`
  }
  function findItemByCard(c: Card): D.Item {
    return D.ITEMS.find((i) => i.img === c.item || i.wrong === c.item) ?? D.ITEMS[0]
  }

  function cardHTML(c: Card): string {
    const marks = c.marks.map((m) => `<img class="mark" src="${D.MARKS[m].img}" alt="${D.MARKS[m].name}" title="${D.MARKS[m].name}" />`).join('')
    let photo = `<img class="photo" src="${c.photo}" alt="" />`
    if (def.kind === 'delivery') {
      photo = `<img class="photo deliv" src="${c.photo}" alt="" />
        <img class="box-logo" src="${c.boxLogo}" alt="" />
        <img class="deliv-item" src="${c.item}" alt="" />`
    }
    const foot = def.kind === 'bid'
      ? `<div class="marks">${marks}</div><i class="pchip big" style="background:${CHIP_COLORS[c.chip ?? 0]}">${won(c.price ?? 0)}</i>`
      : `<div class="marks">${marks}</div><span class="deliv-tag">납품 확인</span>`
    const caption = def.no === 1 ? '업체 사무실' : def.no === 2 ? '도착한 물건' : '지난 공사 현장'
    return `<div class="card${c.guide !== undefined ? ' is-guide' : ''}">
      <div class="card-head"><img src="${c.company.logo}" alt="" /><b>${c.company.name}</b>${c.guide !== undefined ? '<span class="guide-tag">안내</span>' : ''}</div>
      <div class="card-photo">${photo}<span class="cap">${caption}</span></div>
      <div class="card-foot">${foot}</div>
      <div class="card-time"><i></i></div>
      <div class="tint pass"></div><div class="tint check"></div>
    </div>`
  }

  // 단서가 있는 자리(카드 안 좌표)
  function clueSpot(c: Card): { x: number; y: number } {
    switch (c.clue) {
      case 'box': return { x: PHOTO.x + 100, y: PHOTO.y + 315 }
      case 'spec': return { x: PHOTO.x + 355, y: PHOTO.y + 300 }
      case 'collusion': return { x: 390, y: 640 }
      case 'safety': return { x: PHOTO.x + 240, y: PHOTO.y + 95 }
      default: return { x: PHOTO.x + 240, y: PHOTO.y + 200 }
    }
  }
  function ring(x: number, y: number, cls: string, label = ''): void {
    if (!cardEl) return
    const r = h(`<div class="ring ${cls}" style="left:${x}px;top:${y}px">${label ? `<span>${label}</span>` : ''}</div>`)
    cardEl.querySelector('.card')!.append(r)
  }

  // --- 말풍선과 알림 ---
  let bubbleT = 0
  function say(text: string, ms = 1400): void {
    bubble.textContent = text
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
    const all: D.MarkId[] = ['innovation', 'green', 'safety']
    if (!normal && !trap) return []
    const k = trap ? 1 + (rand() < 0.4 ? 1 : 0) : rand() < 0.45 ? (rand() < 0.3 ? 2 : 1) : 0
    return shuffle(all.slice()).slice(0, k)
  }
  function newBidNotice(): Notice {
    const agency = pick(def.agencies)
    const n = 3 + (rand() < 0.5 ? 1 : 0)
    const comps = shuffle(D.COMPANIES.slice()).slice(0, n)
    let clues: D.Clue[] = Array(n).fill('none')
    let title: string
    let image: string
    let base: number
    if (def.no === 1) {
      const it = pick(D.ITEMS)
      title = `${it.name} 구매`
      image = it.img
      base = (60 + Math.floor(rand() * 240)) * 10000
      let k = 0
      clues = clues.map(() => (k < 2 && rand() < def.suspicious * 1.15 ? (k++, 'ghost') : 'none'))
    } else {
      const b = pick(D.BUILDS)
      title = `${b.name} 공사`
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
    const trapOn = def.no === 3 && D.STAGE_SECONDS * 1000 - timeLeft >= 20000
    const bidders: Card[] = comps.map((company, i) => {
      const clue = clues[i]
      const trap = trapOn && clue !== 'none' && rand() < 0.6
      let photo: string
      if (def.no === 1) photo = clue === 'ghost' ? pick(D.OFFICES_EMPTY) : pick(D.OFFICES_OK)
      else photo = clue === 'safety' ? pick(D.BUILDS).unsafe : pick(D.BUILDS).safe
      return { id: ++cardNo, company, clue, trap, marks: marksFor(clue === 'none', trap), photo, price: prices[i], chip: colors[i], agency }
    })
    // 담합 짝은 같은 가격, 같은 색
    const pair = bidders.filter((b) => b.clue === 'collusion')
    if (pair.length === 2) {
      pair[1].price = pair[0].price
      pair[1].chip = pair[0].chip
    }
    bidders.sort((a, b) => (a.price! - b.price!) || a.company.name.localeCompare(b.company.name, 'ko'))
    return { agency, title, img: image, bidders, idx: 0, state: bidders.map((_, i) => (i === 0 ? 'now' : 'wait')) }
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
    return { id: ++cardNo, company, clue, trap: false, marks: marksFor(clue === 'none'), photo, item: clue === 'spec' ? it.wrong : it.img, boxLogo, agency }
  }
  function guideCard(g: D.Clue): Card {
    if (def.kind === 'delivery') {
      const it = D.ITEMS[0]
      const company = D.COMPANIES[4]
      return { id: ++cardNo, company, clue: g, trap: false, marks: [], photo: D.DELIVERY.school, item: g === 'spec' ? it.wrong : it.img,
        boxLogo: g === 'box' ? D.COMPANIES[2].logo : company.logo, agency: 'school', guide: g }
    }
    notice = newBidNotice()
    const c = notice.bidders[0]
    c.clue = g
    c.guide = g
    c.trap = g === 'none' ? false : c.trap
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
    guideJudging = false
    cardElapsed = 0
    cardFreeze = 0
    cardLeft = cardTime()
    slot.innerHTML = cardHTML(c)
    cardEl = slot
    const inner = slot.querySelector('.card') as HTMLElement
    inner.classList.add('enter')
    bindDrag(inner)
    drawBoard()
    if (c.guide !== undefined) {
      phase = 'guide'
      const text = c.guide === 'none'
        ? '오른쪽으로 밀면 통과! 우대 마크가 있으면 점수를 더 받아요'
        : c.trap ? '우대 마크가 있어도 단서가 있으면 정밀 확인이에요' : D.CLUES[c.guide as Exclude<D.Clue, 'none'>].guide
      say(text, 999999)
      if (c.guide !== 'none') ring(clueSpot(c).x, clueSpot(c).y, 'teach')
      inner.classList.add('no-timer')
    } else {
      phase = 'card'
      if (c.forced) say('스캔해 볼까요?', 999999)
    }
    drawScan() // 판정 단계(phase)를 정한 뒤에 버튼 상태를 그린다
    if (c.clue !== 'none') unlock(c.clue)
    c.marks.forEach((m) => unlock(m === 'safety' ? 'safetymark' : m))
    if (o.demo && phase === 'card') {
      cardLeft = Infinity
      inner.classList.add('no-timer')
      demoAct(c)
    }
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
    const bid = (agency: D.AgencyId, title: string, image: string, list: [string, D.Clue, string, number, number, D.MarkId[], DemoAct][]) => {
      const bidders: Card[] = list.map(([cid, clue, photo, price, chip, marks, act]) => ({
        id: ++cardNo, company: co(cid), clue, trap: false, marks, photo, price, chip, agency, demo: act,
      }))
      const n: Notice = { agency, title, img: image, bidders, idx: 0, state: bidders.map(() => 'wait') }
      return bidders.map((card) => ({ card, notice: n }))
    }
    if (no === 1) return [
      ...bid('school', '소화기 구매', it('ext').img, [
        ['dog', 'none', D.OFFICES_OK[1], 1280000, 0, ['innovation'], { cap: '초등학교가 소화기를 주문했어요', wait: 2000, dir: 'pass' }],
        ['cat', 'none', D.OFFICES_OK[2], 1350000, 2, [], { wait: 1000, dir: 'pass' }],
        ['panda', 'none', D.OFFICES_OK[3], 1390000, 4, [], { wait: 1000, dir: 'pass' }],
      ]),
      ...bid('fire', '구급상자 구매', it('firstaid').img, [
        ['fox', 'ghost', D.OFFICES_EMPTY[0], 540000, 1, [], { cap: '사무실이 텅 비었어요', wait: 1800, dir: 'check' }],
        ['panda', 'none', D.OFFICES_OK[3], 560000, 3, ['green'], { wait: 1100, dir: 'pass' }],
      ]),
    ].filter((_, i) => i !== 1 && i !== 2) // 첫 공고는 맨 앞 업체가 낙찰되므로 나머지 두 업체 카드는 나오지 않는다
    if (no === 2) {
      const a: Card = { id: ++cardNo, company: co('rabbit'), clue: 'box', trap: false, marks: [], photo: D.DELIVERY.school,
        item: it('chair').img, boxLogo: co('frog').logo, agency: 'school', demo: { cap: '상자의 회사가 달라요', wait: 1900, dir: 'check' } }
      const b: Card = { id: ++cardNo, company: co('bear'), clue: 'none', trap: false, marks: [], photo: D.DELIVERY.health,
        item: it('ext').img, boxLogo: co('bear').logo, agency: 'health', forced: true, demo: { cap: 'AI 스캔도 틀릴 수 있어요', scan: 900, wait: 2500, dir: 'check' } }
      return [{ card: a }, { card: b }]
    }
    return bid('district', '도서관 공사', D.BUILDS[0].img, [
      ['turtle', 'collusion', D.BUILDS[1].safe, 720000000, 2, [], { cap: '두 업체의 가격이 똑같아요', wait: 2000, dir: 'check' }],
      ['lion', 'collusion', D.BUILDS[2].safe, 720000000, 2, [], { wait: 1000, dir: 'check' }],
      ['hedgehog', 'none', D.BUILDS[0].safe, 750000000, 5, ['safety'], { cap: '성실한 업체가 낙찰!', wait: 1500, dir: 'pass' }],
    ])
  }

  function nextCard(): void {
    if (phase === 'end') return
    slot.innerHTML = ''
    cardEl = null
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
    if (def.no === 3 && !trapShown && D.STAGE_SECONDS * 1000 - timeLeft >= 20000) {
      trapShown = true
      const g = guideCard('safety')
      g.trap = true
      g.marks = ['safety', 'green']
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
  function judge(dir: Dir, timeout = false): void {
    if (!card || !cardEl) return
    if (phase === 'guide') return judgeGuide(dir)
    if (phase !== 'card') return
    if (card.forced && !card.scanned) {
      say('먼저 스캔해 볼까요?', 1200)
      return
    }
    const c = card
    const inner = cardEl.querySelector('.card') as HTMLElement
    const correct = (c.clue === 'none') === (dir === 'pass')
    phase = 'judging'
    stamp(inner, dir)
    let wait = 800

    // 틀린 AI 힌트를 따라 정밀 확인: 하트는 그대로, 다시 판정
    if (c.forced && c.scanned?.wrong && dir === 'check' && !c.rejudge) {
      if (!o.demo) record(c, false)
      after(500, () => {
        phase = 'msg'
        ring(PHOTO.x + c.scanned!.x, PHOTO.y + c.scanned!.y, 'empty', '문제 없음')
        say('동그라미가 가리킨 곳엔 문제가 없었어요. AI도 틀릴 수 있어요. 최종 판단은 사람이 해요!', 999999)
        audio.play('wrong')
        narumi.play('narumi_no')
        const b = h('<button class="gbtn green mid again" data-act="again">다시 판정하기</button>')
        el.append(b)
        if (o.demo) after(2800, () => b.click())
        b.onclick = () => {
          b.remove()
          audio.play('click')
          c.rejudge = true
          const keep = c
          present(keep)
          cardLeft = Infinity
          ;(slot.querySelector('.card') as HTMLElement).classList.add('no-timer')
          say('스스로 판단해 봐요', 1500)
        }
      })
      updateQa()
      return
    }
    if (c.forced && c.scanned?.wrong && dir === 'pass' && !c.rejudge) {
      run.score += 200
      toast('AI 힌트를 확인하고 스스로 판단했어요! +200', 'gold', 1800)
      wait = 1500
    }

    if (correct) {
      combo++
      let gain = 100
      if (cardElapsed < 1500 && !timeout) { gain += 50; toast('빠른 판정 +50', 'fast', 900) }
      if (dir === 'pass' && c.marks.length) { gain += 50 * c.marks.length; toast(`우대! +${50 * c.marks.length}`, 'mark', 1000) }
      run.score += gain
      after(110, () => audio.play('correct'))
      if (combo > 0 && combo % 5 === 0) {
        after(250, () => audio.play('combo'))
        toast(`연속 정답 ${combo}!`, 'combo', 1000)
        after(300, () => narumi.play('narumi_happy'))
      } else {
        say(dir === 'pass' ? pick(['공정하게, 쾅!', '좋아요!', '꼼꼼해요!']) : pick(['꼼꼼히 보면 보여요', '조사팀에 넘길게요']), 1000)
      }
      if (dir === 'check' && c.clue !== 'none' && !run.taught.has(c.clue)) {
        run.taught.add(c.clue)
        toast(`실제 조달청은: ${D.CLUES[c.clue as Exclude<D.Clue, 'none'>].action}`, 'policy', 2300)
        wait = Math.max(wait, 2300)
      }
    } else {
      combo = 0
      if (!c.rejudge) loseHeart()
      after(110, () => audio.play('wrong'))
      after(200, () => narumi.play('narumi_no'))
      ring(clueSpot(c).x, clueSpot(c).y, c.clue === 'none' ? 'ok' : 'miss', c.clue === 'none' ? '이상 없음' : D.CLUES[c.clue as Exclude<D.Clue, 'none'>].short)
      if (timeout) toast('시간 초과! 정밀 확인으로 넘겼어요', 'warn', 1200)
      else if (dir === 'pass') { toast('놓친 서류가 있어요. 사후 점검에서 다시 확인해요', 'warn', 1500); run.missed.push(c.clue) }
      else { toast('성실한 업체가 기다리게 됐어요', 'warn', 1500); run.waited++ }
      wait = 1300
    }
    if (!c.rejudge) record(c, correct && !timeout)

    // 결과: 낙찰과 납품, 사후 점검
    if (dir === 'pass') {
      if (c.clue === 'none') {
        run.delivered[c.agency]++
        stageDelivered[c.agency]++
        run.honest++
        flyTo(c, `.agency[data-ag="${c.agency}"]`)
      } else {
        run.postCheck++
        stagePost++
        flyTo(c, '.agency.post')
      }
      if (notice && def.kind === 'bid') notice.state[notice.idx] = 'won'
    } else if (notice && def.kind === 'bid') {
      notice.state[notice.idx] = 'check'
      notice.idx++
      if (notice.idx >= notice.bidders.length) after(wait - 200, () => toast('모든 업체를 정밀 확인해 유찰됐어요. 다음 공고로!', '', 1300))
    }
    drawBoard()
    drawScore()
    exitCard(inner, dir)
    after(wait, () => nextCard())
    updateQa()
  }

  function judgeGuide(dir: Dir): void {
    const c = card!
    const want: Dir = c.clue === 'none' ? 'pass' : 'check'
    const inner = cardEl!.querySelector('.card') as HTMLElement
    if (dir !== want) {
      inner.classList.remove('nudge')
      void inner.offsetWidth
      inner.classList.add('nudge')
      say(want === 'pass' ? '오른쪽으로 밀어 통과시켜요' : '왼쪽으로 밀어 정밀 확인을 요청해요', 1600)
      audio.play('click')
      return
    }
    phase = 'judging'
    guideJudging = true
    stamp(inner, dir)
    after(110, () => audio.play('correct'))
    say('잘했어요!', 900)
    if (c.clue !== 'none') run.taught.add(c.clue)
    if (c.clue !== 'none') toast(`실제 조달청은: ${D.CLUES[c.clue as Exclude<D.Clue, 'none'>].action}`, 'policy', 2000)
    exitCard(inner, dir)
    notice = null // 안내 카드용 임시 공고는 버린다
    after(c.clue !== 'none' ? 2000 : 900, () => nextCard())
    updateQa()
  }

  function record(c: Card, correct: boolean): void {
    run.judged.push({ clue: c.clue, correct })
    stageLog.push({ clue: c.clue, correct, card: c })
    judgedInStage++
  }

  function loseHeart(): void {
    hearts = Math.max(0, hearts - 1)
    drawHearts()
    const lost = heartsEl.querySelectorAll('span')[hearts]
    lost?.classList.add('break')
    if (hearts === 0 && !help) {
      help = true
      after(600, () => {
        toast('달이가 도와줄게요! 시간이 넉넉해지고 스캔을 마음껏 쓸 수 있어요', 'help', 2200)
        dari.play('dari_happy')
      })
    }
  }

  function stamp(inner: HTMLElement, dir: Dir): void {
    audio.play('stamp')
    narumi.play('narumi_stamp')
    const s = h(`<img class="imprint ${dir}" src="assets/img/${dir === 'pass' ? 'stamp_pass' : 'stamp_check'}.webp" alt="" />`)
    inner.append(s)
    el.classList.remove('shake')
    void el.offsetWidth
    el.classList.add('shake')
  }
  function exitCard(inner: HTMLElement, dir: Dir): void {
    after(380, () => inner.classList.add(dir === 'pass' ? 'out-pass' : 'out-check'))
  }

  // 스테이지 좌표(1920x1080)로 요소 위치 얻기
  function pos(target: Element): { x: number; y: number } {
    const r = target.getBoundingClientRect()
    const s = el.getBoundingClientRect()
    const k = s.width / 1920
    return { x: (r.left + r.width / 2 - s.left) / k, y: (r.top + r.height / 2 - s.top) / k }
  }
  function flyTo(c: Card, sel: string): void {
    const target = el.querySelector(sel)
    if (!target || !cardEl) return
    const from = pos(cardEl)
    const to = pos(target)
    const src = def.kind === 'delivery' ? c.item! : notice?.img ?? c.photo
    const f = h(`<img class="flyer" src="${src}" alt="" style="left:${from.x}px;top:${from.y}px" />`)
    el.append(f)
    after(400, () => {
      f.style.transform = `translate(${to.x - from.x}px, ${to.y - from.y}px) scale(0.35)`
      f.style.opacity = '0.2'
    })
    after(1150, () => {
      f.remove()
      drawAgencies()
      const t = el.querySelector(sel)
      t?.classList.add('bump')
    })
    // 달이가 물건을 들고 달려간다
    dari.play('dari_run')
    after(1100, () => dari.play('dari_idle'))
  }

  // --- 나르미 스캔 ---
  function scan(): void {
    if (phase !== 'card' || !card || card.scanned) return
    const forcedWait = !!card.forced && !card.scanned
    if (!forcedWait && !help && scans <= 0) return
    if (!forcedWait && !help) scans--
    const c = card
    let wrong = false
    if (c.forced) wrong = true
    else if (def.no === 2 && c.clue === 'none') wrong = rand() < 0.15
    else if (def.no === 3) wrong = c.clue === 'none' ? rand() < 0.15 : rand() < 0.25
    const spot = clueSpot(c)
    let hint: Hint
    if (c.clue === 'none' && !wrong) hint = { level: '낮음', x: spot.x - PHOTO.x, y: spot.y - PHOTO.y, wrong }
    else if (c.clue === 'none' && wrong) hint = { level: '높음', x: 90 + rand() * 60, y: 300 + rand() * 50, wrong }
    else if (wrong) hint = { level: '낮음', x: 240, y: 200, wrong }
    else hint = { level: '높음', x: spot.x - PHOTO.x, y: spot.y - PHOTO.y, wrong }
    c.scanned = hint
    unlock('scan')
    audio.play('scan')
    el.classList.add('scanning')
    after(900, () => el.classList.remove('scanning'))
    cardFreeze = 1000
    if (run.firstScan) {
      run.firstScan = false
      cardFreeze = 2600
      toast('게임 속 연습용 AI예요. 실제 조달청 AI는 사람이 최종 확인하는 업무 지원 도구예요', 'policy', 2600)
    }
    after(350, () => {
      if (card !== c || !cardEl) return
      if (hint.level === '높음') ring(PHOTO.x + hint.x, PHOTO.y + hint.y, 'scan', '의심도 높음')
      else {
        const tag = h('<div class="scan-tag low">의심도 낮음</div>')
        cardEl.querySelector('.card')!.append(tag)
      }
      say(hint.level === '높음' ? '여기가 수상해요!' : '이상 없어 보여요', 1200)
    })
    drawScan()
    updateQa()
  }

  // --- 끌기 입력 ---
  function bindDrag(inner: HTMLElement): void {
    let x0 = 0
    let dx = 0
    let id = -1
    const k = () => el.getBoundingClientRect().width / 1920
    inner.addEventListener('pointerdown', (e) => {
      if (phase !== 'card' && phase !== 'guide') return
      id = e.pointerId
      x0 = e.clientX
      dx = 0
      inner.setPointerCapture(id)
      inner.classList.add('dragging')
    })
    inner.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return
      dx = (e.clientX - x0) / k()
      inner.style.transform = `translateX(${dx}px) rotate(${dx / 28}deg)`
      inner.style.setProperty('--pass', String(Math.max(0, Math.min(1, dx / 260))))
      inner.style.setProperty('--check', String(Math.max(0, Math.min(1, -dx / 260))))
    })
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return
      id = -1
      inner.classList.remove('dragging')
      const d = dx
      inner.style.transform = ''
      inner.style.setProperty('--pass', '0')
      inner.style.setProperty('--check', '0')
      if (Math.abs(d) > 288 * 0.75) judge(d > 0 ? 'pass' : 'check')
    }
    inner.addEventListener('pointerup', end)
    inner.addEventListener('pointercancel', end)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return
    if (e.key === 'ArrowRight') judge('pass')
    else if (e.key === 'ArrowLeft') judge('check')
    else if (e.key === 's' || e.key === 'S' || e.key === 'ㄴ') scan()
  }
  window.addEventListener('keydown', onKey)
  ;(el.querySelector('[data-act="pass"]') as HTMLButtonElement).onclick = () => judge('pass')
  ;(el.querySelector('[data-act="check"]') as HTMLButtonElement).onclick = () => judge('check')
  scanBtn.onclick = () => scan()
  ;(el.querySelector('[data-act="pause"]') as HTMLButtonElement).onclick = () =>
    o.pause(`${def.no}단계 진행 중, 남은 시간 ${Math.ceil(Math.max(0, timeLeft) / 1000)}초`, () => {
      dispose()
      o.onTitle()
    })

  // --- 시간 ---
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
    if ((phase === 'card' || (phase === 'judging' && !guideJudging)) && !forcedWait) timeLeft = Math.max(0, timeLeft - dt)
    if (phase === 'card' && !forcedWait) {
      cardElapsed += dt
      if (cardFreeze > 0) cardFreeze -= dt
      else if (cardLeft !== Infinity) {
        cardLeft -= dt
        if (cardLeft <= 0) judge('check', true)
      }
      const bar = slot.querySelector('.card-time i') as HTMLElement | null
      if (bar && cardLeft !== Infinity) bar.style.transform = `scaleX(${Math.max(0, cardLeft / cardTime())})`
      if (timeLeft <= 0 && phase === 'card' && !o.demo) endStage()
    }
    timeNum.textContent = timeLeft >= 10000 ? String(Math.ceil(timeLeft / 1000)) : (timeLeft / 1000).toFixed(1)
    timeBar.style.transform = `scaleX(${timeLeft / (D.STAGE_SECONDS * 1000)})`
    timeWrap.classList.toggle('low', timeLeft < 10000)
    o.qa.timeLeft = timeLeft
    updateQa()
  })

  // --- 단계 ---
  function startStage(i: number): void {
    stageIdx = i
    def = D.STAGES[i]
    timeLeft = D.STAGE_SECONDS * 1000
    hearts = maxHearts()
    help = false
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
    guides = o.demo ? [] : def.guides.slice()
    demoQ = o.demo ? buildDemo(def.no) : []
    stageChip.textContent = `${def.no}단계 ${def.title}`
    el.dataset.stage = String(def.no)
    drawHearts()
    drawScore()
    drawAgencies()
    drawBoard()
    phase = 'intro'
    drawScan()
    const intro = h(`<div class="stage-intro">
      <p class="si-no outline">${def.no}단계</p>
      <h2 class="outline">${def.title}</h2>
      <div class="si-ag">${def.agencies.map((a) => `<span><img src="${D.AGENCIES[a].img}" alt="" />${D.AGENCIES[a].name}</span>`).join('')}</div>
      <p class="si-fact">${def.fact}</p>
    </div>`)
    el.append(intro)
    say(def.no === 1 ? '오늘도 공정하게 심사해 볼까요?' : def.no === 2 ? '이번엔 도착한 물건을 확인해요' : '이번엔 공사 업체를 심사해요', 2600)
    after(o.demo ? 1500 : 2800, () => {
      intro.classList.add('out')
      after(300, () => {
        intro.remove()
        nextCard()
      })
    })
    updateQa()
  }

  function stars(acc: number, helped: boolean): number {
    const s = acc >= 0.96 ? 3 : acc >= 0.9 ? 2 : acc >= 0.8 ? 1 : 0
    return helped ? Math.min(1, s) : s
  }

  function endStage(): void {
    if (phase === 'result' || phase === 'end') return
    phase = 'result'
    if (o.demo) {
      run.stars.push(3)
      slot.innerHTML = ''
      card = null
      bubble.hidden = true
      after(700, () => (stageIdx === D.STAGES.length - 1 ? finalResult() : startStage(stageIdx + 1)))
      return
    }
    slot.innerHTML = ''
    card = null
    bubble.hidden = true
    const n = stageLog.length
    const ok = stageLog.filter((l) => l.correct).length
    const acc = n ? ok / n : 0
    const st = stars(acc, help)
    run.stars.push(st)
    const missed = stageLog.filter((l) => !l.correct && l.card.clue !== 'none').slice(0, 2)
    audio.play('fanfare')
    narumi.play('narumi_happy')
    const last = stageIdx === D.STAGES.length - 1
    const panel = h(`<div class="overlay result-overlay"><div class="panel result-panel">
      <div class="ribbon outline">${def.no}단계 결과</div>
      <div class="stars">${[0, 1, 2].map((i) => `<span class="${i < st ? 'on' : ''}">${ICON.star}</span>`).join('')}</div>
      <p class="r-main">맞게 판정 <b>${ok}</b> / ${n}장 <small>(${Math.round(acc * 100)}%)</small></p>
      <p class="r-deliv">${def.agencies.map((a) => `${D.AGENCIES[a].name} <b>${stageDelivered[a]}</b>곳`).join(', ')}에 필요한 것이 전해졌어요</p>
      <p class="r-note">대부분의 업체는 성실해요. 정밀 확인으로 넘긴 서류는 조사팀이 확인해요.</p>
      ${missed.length ? `<div class="r-missed"><p>이번에 놓친 단서</p>${missed
        .map((m) => `<div class="mcard"><img src="${m.card.photo}" alt="" /><span>${D.CLUES[m.card.clue as Exclude<D.Clue, 'none'>].short}</span></div>`)
        .join('')}</div>` : ''}
      ${help ? '<p class="r-help">달이의 도움을 받아 별은 최대 1개예요</p>' : ''}
      <button class="gbtn green mid" data-act="next">${last ? '최종 결과 보기' : '다음 단계'}</button>
    </div></div>`)
    el.append(panel)
    ;(panel.querySelector('[data-act="next"]') as HTMLButtonElement).onclick = () => {
      audio.play('click')
      panel.remove()
      if (last) finalResult()
      else startStage(stageIdx + 1)
    }
    updateQa()
  }

  function finalResult(): void {
    phase = 'end'
    const total = run.judged.length
    const ok = run.judged.filter((j) => j.correct).length
    const acc = total ? ok / total : 0
    const level = acc >= 0.96 ? 3 : acc >= 0.9 ? 2 : acc >= 0.8 ? 1 : 0
    const sum = run.stars.reduce((a, b) => a + b, 0)
    const badge = sum >= 7 ? 3 : sum >= 4 ? 2 : 1
    const parts = (Object.keys(run.delivered) as D.AgencyId[]).filter((a) => run.delivered[a] > 0).map((a) => `${D.AGENCIES[a].name} ${run.delivered[a]}곳`)
    const headline = parts.length ? `오늘 ${parts.join(', ')}에 필요한 것이 공정하게 전해졌어요` : '오늘도 심사를 마쳤어요. 다음엔 더 꼼꼼히!'
    const counts = new Map<D.Clue, number>()
    run.missed.forEach((m) => counts.set(m, (counts.get(m) ?? 0) + 1))
    const worst = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] as Exclude<D.Clue, 'none'> | undefined
    const policy = worst ? { t: D.CLUES[worst].name, d: D.CLUES[worst].action } : { t: D.LADDER[level], d: D.LADDER_INFO[level] }
    // 계단 칸 윗면 가운데(달이 발 위치)와 앞면 이름표 위치. ladder.webp 를 900x600 으로 줄여 잰 값
    const steps = [
      { x: 268, y: 440, lx: 290, ly: 500 }, { x: 377, y: 350, lx: 405, ly: 412 },
      { x: 482, y: 268, lx: 515, ly: 326 }, { x: 565, y: 203, lx: 615, ly: 244 },
    ]
    const s = h(`<section class="scene final">
      <img class="bg" src="assets/img/bg_title.webp" alt="" />
      <div class="shade"></div>
      <h2 class="f-head outline">${headline}</h2>
      <div class="ladder-box">
        <img class="ladder" src="assets/img/ladder.webp" alt="" />
        ${D.LADDER.map((n, i) => `<span class="step-label s${i}" style="left:${steps[i].lx}px;top:${steps[i].ly}px">${n}</span>`).join('')}
        <div class="climber"></div>
      </div>
      <div class="f-side">
        <div class="badge panel"><p class="b-words">투명, 공정, 신뢰</p><div class="stars">${[0, 1, 2].map((i) => `<span class="${i < badge ? 'on' : ''}">${ICON.star}</span>`).join('')}</div><p class="b-sub">정확도 ${Math.round(acc * 100)}%, 점수 ${run.score.toLocaleString('ko-KR')}</p></div>
        <div class="policy panel"><p class="p-tag">실제 조달청은</p><h4>${policy.t}</h4><p>${policy.d}</p></div>
        ${run.waited ? `<p class="f-wait">성실한 업체 ${run.waited}곳은 확인을 기다려야 했어요</p>` : ''}
        <div class="f-btns"><button class="gbtn mid" data-act="again">다시 하기</button><button class="gbtn soft sub" data-act="dex">정책 도감</button><button class="gbtn soft sub" data-act="home">타이틀로</button></div>
      </div>
    </section>`)
    o.root.replaceChildren(s)
    const climber = new Sprite('dari_run', 120)
    const cl = s.querySelector('.climber') as HTMLElement
    cl.append(climber.el)
    cl.style.left = `${steps[0].x - 47}px`
    cl.style.top = `${steps[0].y - 112}px`
    let at = 0
    const climb = () => {
      if (at >= level) {
        climber.dispose()
        const fin = new Sprite('dari_happy', 130)
        cl.replaceChildren(fin.el)
        audio.play('fanfare')
        return
      }
      at++
      audio.play('combo')
      cl.style.left = `${steps[at].x - 47}px`
      cl.style.top = `${steps[at].y - 112}px`
      setTimeout(climb, 650)
    }
    setTimeout(climb, 900)
    unlock('ladder')
    ;(s.querySelector('[data-act="dex"]') as HTMLButtonElement).onclick = () => showDex(s)
    o.qa.final = { acc, level, badge, score: run.score }
    o.qa.scene = 'final'
    ;(s.querySelector('[data-act="again"]') as HTMLButtonElement).onclick = () => {
      audio.play('click')
      dispose()
      startGame(o)
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
  startStage(0)
  return dispose
}

