// --- 규칙 수첩(10쪽)과 만든 사람 화면. 수첩 쪽은 게임에서 처음 만나면 열린다 ---
import { audio } from './audio'
import { load, save } from './storage'
import { RULES, MARKS, LADDER, LADDER_INFO, type RuleId } from './data'

const img = (n: string) => `assets/img/${n}.webp`

interface Page {
  id: string
  title: string
  pic: string
  rule: string // 규칙이나 뜻 한 줄
  easy: string
  real: string
  src: string
}

const RULE_PICS: Record<RuleId, string> = {
  ghost: img('office_a_empty'), spec: img('item_ext_nosticker'), box: img('delivery_school'), collusion: img('build_library'), safety: img('site_a_unsafe'),
}

// 수치는 넣지 않고 공식 자료로 확인한 방향만 쓴다
export const DEX: Page[] = [
  ...(Object.keys(RULES) as RuleId[]).map((id) => ({
    id, title: RULES[id].name, pic: RULE_PICS[id], rule: RULES[id].rule, easy: RULES[id].why, real: RULES[id].action, src: RULES[id].src,
  })),
  { id: 'price', title: '낙찰은 값만 보지 않아요', pic: img('stamp_pass'), rule: '값이 낮은 회사부터 서류를 보고, 기준에 맞는 첫 회사가 일을 따내요(낙찰)',
    easy: '제일 싸게 써낸 회사라도 일을 해낼 수 있는지 먼저 확인해요.',
    real: '적격심사와 종합심사낙찰제는 가격뿐 아니라 일할 능력, 안전, 사회적 책임도 봐요.', src: '정책브리핑 조달청 자료' },
  { id: 'innovation', title: MARKS.innovation.name, pic: MARKS.innovation.img, rule: MARKS.innovation.desc,
    easy: '새 기술로 만든 제품이에요.',
    real: '혁신제품으로 지정되면 조달청이 시범구매로 먼저 사서 공공기관이 써 보게 해요.', src: '2026년 조달청 업무계획' },
  { id: 'green', title: MARKS.green.name, pic: MARKS.green.img, rule: MARKS.green.desc,
    easy: '환경을 생각해 만든 제품이에요.',
    real: '공공기관은 녹색제품을 먼저 사야 해요. 자원 낭비와 환경오염을 막으려고 법으로 정해 두었어요.', src: '녹색제품 구매촉진 법령, 조달청 자료' },
  { id: 'scan', title: '나르미 스캔', pic: 'assets/narumi.webp', rule: '나르미가 수상한 곳을 짚어 줘요',
    easy: '하루에 세 번 쓸 수 있어요. 나르미도 가끔 잘못 보니까 동그라미 친 곳을 기준표와 한 번 더 맞춰 봐요.',
    real: '조달청은 AI 같은 새 기술 제품이 공공기관에 더 쉽게 들어갈 수 있게 도와요.', src: '2026년 조달청 업무계획' },
  { id: 'ladder', title: '성장사다리', pic: img('ladder'), rule: LADDER.join(', '),
    easy: '공정한 심사를 통과한 성실한 회사는 공공시장에서 자라요.',
    real: `${LADDER_INFO[0]}. 이어서 다수공급자계약과 우수조달물품으로 더 큰 시장에 나가고, 해외로도 뻗어 가요.`, src: '2016년 벤처나라 개통 브리핑' },
]

const KEY = 'dex'
const opened = new Set<string>((load(KEY) ?? '').split(',').filter(Boolean))

export function unlock(id: string): boolean {
  if (opened.has(id) || !DEX.some((d) => d.id === id)) return false
  opened.add(id)
  save(KEY, [...opened].join(','))
  return true
}
export function dexCount(): number {
  return DEX.filter((d) => opened.has(d.id)).length
}
export function resetDex(): void {
  opened.clear()
  save(KEY, '')
}

function h(html: string): HTMLElement {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild as HTMLElement
}

export function overlay(root: HTMLElement, title: string, inner: string, cls: string, onClose?: () => void): HTMLElement {
  const el = h(`<div class="overlay ${cls}"><div class="panel sheet">
    <div class="plate"><h2>${title}</h2></div>
    <button class="ibtn close" data-act="close" aria-label="닫기"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg></button>
    <div class="sheet-paper">${inner}</div></div></div>`)
  ;(el.querySelector('[data-act="close"]') as HTMLButtonElement).onclick = () => {
    audio.play('back')
    el.remove()
    onClose?.()
  }
  root.append(el)
  audio.play('open')
  return el
}

// 수첩: 왼쪽 목차, 오른쪽 한 쪽. 열린 쪽만 읽을 수 있다
export function showDex(root: HTMLElement, onClose?: () => void, focus?: string): void {
  const first = focus && opened.has(focus) ? focus : DEX.find((d) => opened.has(d.id))?.id
  const el = overlay(root, `규칙 수첩 <small>${dexCount()} / ${DEX.length}쪽</small>`, `<div class="note">
      <div class="leaf left"><p class="leaf-title">차례</p><ol class="note-index">${DEX.map((d, i) => `<li><button class="note-tab${opened.has(d.id) ? '' : ' locked'}" data-id="${d.id}"><span class="pg">${i + 1}</span>${opened.has(d.id) ? d.title : '아직 빈 쪽'}</button></li>`).join('')}</ol></div>
      <div class="leaf right"><article class="note-page"></article></div>
    </div>`, 'dex', onClose)
  const page = el.querySelector('.note-page') as HTMLElement
  const note = el.querySelector('.note') as HTMLElement
  const index = el.querySelector('.leaf.left') as HTMLElement
  const html = (id?: string) => {
    const d = DEX.find((x) => x.id === id)
    if (!d || !opened.has(d.id)) return `<div class="note-empty"><b>아직 빈 쪽이에요</b><p>게임에서 처음 만나면 나르미가 적어 둬요.</p></div>`
    return `<img src="${d.pic}" alt="" /><h3>${d.title}</h3><p class="n-rule">${d.rule}</p><p>${d.easy}</p>
      <div class="n-real"><b>실제 조달청은</b><p>${d.real}</p><small>출처: ${d.src}</small></div>`
  }
  const fill = (id?: string) => {
    page.innerHTML = html(id)
    page.scrollTop = 0
  }
  let shown: string | undefined
  let turn: HTMLElement | null = null
  const show = (id?: string) => {
    const prev = shown
    shown = id
    el.querySelectorAll('.note-tab').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.id === id))
    // 넘기던 쪽이 있으면 바로 끝낸다
    if (turn) {
      turn.remove()
      turn = null
      fill(prev)
    }
    if (prev === undefined || id === prev || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fill(id)
      return
    }
    // 책장 넘김(style.css 의 .turn): 뒤 차례로 가면 지금 쪽이 들려 왼쪽으로 넘어가며 새 쪽이 드러나고,
    // 앞 차례로 가면 왼쪽에서 새 쪽이 넘어와 지금 쪽을 덮는다. 장의 뒷면은 차례 쪽과 똑같이 그려 왼쪽에 겹칠 때 이음새가 없다.
    // 넘어가는 장은 그림일 뿐이라 inert 로 눌리거나 키보드, 화면 읽기에 잡히지 않게 한다
    audio.play('page')
    const fwd = DEX.findIndex((x) => x.id === id) > DEX.findIndex((x) => x.id === prev)
    const leaf = h(`<div class="turn ${fwd ? 'fwd' : 'bwd'}" inert><div class="face leaf right"><article class="note-page">${fwd ? page.innerHTML : html(id)}</article></div><div class="face back leaf left">${index.innerHTML}</div></div>`)
    note.append(leaf)
    turn = leaf
    if (fwd) fill(id)
    leaf.addEventListener('animationend', () => {
      if (turn !== leaf) return
      if (!fwd) fill(id)
      leaf.remove()
      turn = null
    }, { once: true })
  }
  el.querySelectorAll<HTMLButtonElement>('.note-tab').forEach((b) => (b.onclick = () => show(b.dataset.id)))
  show(first)
}

export function showCredits(root: HTMLElement): void {
  overlay(root, '만든 사람', `<div class="credits">
      <p class="c-lead">2026 조달청 AI 게임 콘텐츠 공모전 출품작 <b>나르미의 입찰 도장</b></p>
      <dl>
        <dt>기획, 개발</dt><dd>출품자 1인</dd>
        <dt>마스코트</dt><dd>조달청 나르미와 달이</dd>
        <dt>생성형 AI 활용</dt>
        <dd>조달청 정책 조사, 기획 검토, 게임 코드: Claude(Anthropic)<br>
          배경과 사진, 아이콘, 로고 그림: Codex 이미지 생성(OpenAI)<br>
          캐릭터 3D 모델: Tripo, 자동 리깅: Meshy(Higgsfield)<br>
          효과음: ElevenLabs Sound Effects(전체 14가지)<br>
          배경음: ElevenLabs Music(Higgsfield)<br>
          캐릭터 동작 키와 렌더: Blender, 사람이 직접 다듬음</dd>
        <dt>정책 자료</dt><dd>대한민국 정책브리핑의 조달청 자료, 국가법령정보센터</dd>
        <dt>글꼴</dt><dd>Pretendard(SIL Open Font License 1.1)</dd>
      </dl>
      <p class="c-note">등장 업체와 금액은 모두 가상이며 실제 기업과 관계가 없습니다. 게임은 실제 조달 절차를 쉽게 줄여 보여 줍니다.
        실제로는 여러 서류와 점수를 함께 보고, 담합은 가격 말고도 여러 증거로 조사합니다. 게임 점수와 우대 마크 점수는 실제 심사 점수와 다릅니다.</p>
      <img class="pps-logo" src="assets/img/pps_logo.webp" alt="조달청" width="500" height="192" />
    </div>`, 'credits-ov')
}
