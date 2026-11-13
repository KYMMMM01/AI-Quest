// --- 정책 도감(10장)과 만든 사람 화면. 도감 카드는 게임에서 처음 만나면 열린다 ---
import { audio } from './audio'
import { load, save } from './storage'

const img = (n: string) => `assets/img/${n}.webp`

interface Entry {
  id: string
  title: string
  pic: string
  easy: string
  real: string
}

// 수치는 넣지 않고 방향만 쓴다(조달청 원문으로 확인한 수치만 화면에 쓴다는 기획서 8장 원칙)
export const DEX: Entry[] = [
  { id: 'ghost', title: '유령기업 의심', pic: img('office_a_empty'),
    easy: '일하는 사무실도 사람도 없이 서류만 있는 회사예요. 낙찰되면 물건을 제대로 만들 수 없어요.',
    real: '일하는 곳이 없는 회사는 입찰보증금 부과 대상이 될 수 있어요.' },
  { id: 'spec', title: '규격 다름', pic: img('item_ext_nosticker'),
    easy: '주문한 것과 다른 물건이 오면 학교나 보건소가 제대로 쓸 수 없어요.',
    real: '납품된 물건을 점검해 규격과 다르면 다시 납품받고, 반복되면 계약이 해지될 수 있어요.' },
  { id: 'box', title: '남의 상자', pic: img('delivery_school'),
    easy: '직접 만들기로 약속한 회사가 남의 물건을 가져오면 안 돼요.',
    real: '계약을 이행할 때 직접 만들었는지 점검해요(직접생산확인은 중소벤처기업부 소관).' },
  { id: 'collusion', title: '담합 징후', pic: img('build_library'),
    easy: '업체끼리 가격을 미리 맞추면 공정한 경쟁이 사라져요.',
    real: '직접 조사해 입찰을 제한하고 부당이득을 환수해요. 심하면 공정위 고발을 요청해요.' },
  { id: 'safety', title: '안전 소홀 기록', pic: img('site_a_unsafe'),
    easy: '안전모 없이 일하는 현장은 사고가 나기 쉬워요.',
    real: '안전 사고 기록이 있는 업체는 심사에서 감점을 받아 낙찰이 어려워져요.' },
  { id: 'innovation', title: '혁신제품', pic: img('mark_innovation'),
    easy: '새로운 기술로 만든 제품이에요.',
    real: '혁신제품으로 지정되면 공공기관이 시범구매로 첫 구매자가 되어 판로를 열어 줘요.' },
  { id: 'green', title: '녹색제품', pic: img('mark_green'),
    easy: '환경을 생각해 만든 제품이에요.',
    real: '공공기관은 녹색제품을 우선 구매해야 해요.' },
  { id: 'safetymark', title: '안전인증', pic: img('mark_safety'),
    easy: '안전 관리 인증을 받은 업체예요.',
    real: '안전보건경영시스템 인증이 있는 업체는 심사에서 가점을 받아요.' },
  { id: 'scan', title: '나르미 스캔', pic: 'assets/narumi.webp',
    easy: '게임 속 연습용 AI예요. 빠르지만 가끔 틀려요.',
    real: '공공조달 업무에 AI 지원을 도입하고 있어요. AI는 돕고, 최종 판단은 사람이 해요.' },
  { id: 'ladder', title: '성장사다리', pic: img('ladder'),
    easy: '공정한 심사를 통과한 성실한 기업은 공공시장에서 자라요.',
    real: '벤처나라, 혁신제품, 우수조달을 거쳐 해외 조달시장 진출까지 성장을 지원해요.' },
]

const KEY = 'dex'
const opened = new Set<string>((load(KEY) ?? '').split(',').filter(Boolean))

export function unlock(id: string): void {
  if (opened.has(id) || !DEX.some((d) => d.id === id)) return
  opened.add(id)
  save(KEY, [...opened].join(','))
}
export function dexCount(): number {
  return DEX.filter((d) => opened.has(d.id)).length
}

function h(html: string): HTMLElement {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild as HTMLElement
}

function overlay(root: HTMLElement, inner: string, cls: string): HTMLElement {
  const el = h(`<div class="overlay ${cls}"><div class="panel book">${inner}<button class="gbtn green mid close" data-act="close">닫기</button></div></div>`)
  ;(el.querySelector('[data-act="close"]') as HTMLButtonElement).onclick = () => {
    audio.play('click')
    el.remove()
  }
  root.append(el)
  audio.play('click')
  return el
}

export function showDex(root: HTMLElement): void {
  const cards = DEX.map((d) =>
    opened.has(d.id)
      ? `<div class="dex-card"><img src="${d.pic}" alt="" /><h4>${d.title}</h4><p>${d.easy}</p><p class="real"><b>실제 조달청은</b> ${d.real}</p></div>`
      : `<div class="dex-card locked"><div class="q">?</div><h4>아직 못 만났어요</h4><p>게임에서 만나면 열려요</p></div>`,
  ).join('')
  const el = overlay(root, `<div class="ribbon outline">정책 도감 ${dexCount()} / ${DEX.length}</div>
    <div class="dex-view"><div class="dex-grid">${cards}</div></div>
    <div class="dex-nav"><button class="ibtn blue small" data-act="prev" aria-label="이전">&lt;</button><span class="dex-page"></span><button class="ibtn blue small" data-act="next" aria-label="다음">&gt;</button></div>
    <p class="book-note">게임 점수와 마크 점수는 실제 심사 점수와 다릅니다. 실제 절차를 쉽게 줄여 보여 줍니다.</p>`, 'dex')
  // 작은 화면에서는 세 장씩 넘겨 본다(큰 화면에서는 넘김 버튼을 숨긴다)
  const grid = el.querySelector('.dex-grid') as HTMLElement
  const pageEl = el.querySelector('.dex-page') as HTMLElement
  const per = 3
  const pages = Math.ceil(DEX.length / per)
  let page = 0
  const go = (d: number) => {
    page = Math.max(0, Math.min(pages - 1, page + d))
    const first = grid.children[0] as HTMLElement
    const step = first.offsetWidth + 24
    grid.style.transform = `translateX(${-page * per * step}px)`
    pageEl.textContent = `${page + 1} / ${pages}`
  }
  ;(el.querySelector('[data-act="prev"]') as HTMLButtonElement).onclick = () => (audio.play('click'), go(-1))
  ;(el.querySelector('[data-act="next"]') as HTMLButtonElement).onclick = () => (audio.play('click'), go(1))
  go(0)
}

export function showCredits(root: HTMLElement): void {
  overlay(root, `<div class="ribbon outline">만든 사람</div>
    <div class="credits">
      <p class="c-lead">2026 조달청 AI 게임 콘텐츠 공모전 출품작 <b>나르미의 입찰 도장</b></p>
      <dl>
        <dt>기획, 개발</dt><dd>출품자 1인</dd>
        <dt>마스코트</dt><dd>조달청 나르미와 달이</dd>
        <dt>생성형 AI 활용</dt>
        <dd>조달청 정책 조사, 기획 검토, 게임 코드: Claude(Anthropic)<br>
          배경과 사진, 아이콘, 로고 그림: Codex 이미지 생성(OpenAI)<br>
          캐릭터 3D 모델: Tripo, 자동 리깅: Meshy(Higgsfield)<br>
          효과음: Mirelo, 배경음: ElevenLabs Music(Higgsfield)<br>
          캐릭터 동작 키와 렌더: Blender, 사람이 직접 다듬음</dd>
        <dt>글꼴</dt><dd>Pretendard(SIL Open Font License 1.1)</dd>
      </dl>
      <p class="c-note">등장 업체와 금액은 모두 가상이며 실제 기업과 관계가 없습니다.
        게임은 실제 조달 절차를 쉽게 줄여 보여 줍니다. 실제로는 여러 서류와 점수를 함께 보고, 담합은 가격 외의 여러 증거로 조사하며,
        입찰보증금과 안전 감점은 금액과 점수로 처리됩니다. 게임 점수는 실제 심사 점수와 다릅니다.</p>
    </div>`, 'credits-ov')
}
