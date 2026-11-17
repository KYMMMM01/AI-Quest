// --- 게임 데이터: 가상 업체, 품목, 규칙(단서), 우대 마크, 하루 설정, 편지. 등장 업체와 금액은 모두 가상이다 ---
// 정책 문장은 기획/조달청_공식자료조사.md 의 공식 자료(정책브리핑, 국가법령정보센터)로 확인한 것만 쓰고, 수치는 넣지 않는다
export type Clue = 'none' | 'ghost' | 'spec' | 'box' | 'collusion' | 'safety'
export type RuleId = Exclude<Clue, 'none'>
export type MarkId = 'innovation' | 'green'
export type AgencyId = 'school' | 'fire' | 'health' | 'district'

export interface Company {
  id: string
  name: string
  logo: string
  group: string // 바탕색이 비슷한 로고 묶음. 남의 상자 카드에서 같은 묶음끼리는 짝짓지 않는다
}

const img = (n: string) => `assets/img/${n}.webp`

export const COMPANIES: Company[] = [
  { id: 'bear', name: '곰곰산업', logo: img('logo_bear'), group: 'pink' },
  { id: 'owl', name: '부엉전자', logo: img('logo_owl'), group: 'pink' },
  { id: 'frog', name: '개굴상사', logo: img('logo_frog'), group: 'orange' },
  { id: 'penguin', name: '펭펭물산', logo: img('logo_penguin'), group: 'orange' },
  { id: 'rabbit', name: '깡총테크', logo: img('logo_rabbit'), group: 'blue' },
  { id: 'turtle', name: '느림보건설', logo: img('logo_turtle'), group: 'blue' },
  { id: 'lion', name: '어흥기업', logo: img('logo_lion'), group: 'blue' },
  { id: 'cat', name: '야옹공방', logo: img('logo_cat'), group: 'cat' },
  { id: 'dog', name: '멍멍제작소', logo: img('logo_dog'), group: 'dog' },
  { id: 'fox', name: '여우솜씨', logo: img('logo_fox'), group: 'fox' },
  { id: 'panda', name: '판다공업', logo: img('logo_panda'), group: 'panda' },
  { id: 'hedgehog', name: '도치상회', logo: img('logo_hedgehog'), group: 'hedgehog' },
]

export const AGENCIES: Record<AgencyId, { name: string; img: string }> = {
  school: { name: '초등학교', img: img('agency_school') },
  fire: { name: '소방서', img: img('agency_fire') },
  health: { name: '보건소', img: img('agency_health') },
  district: { name: '구청', img: img('agency_district') },
}

export interface Item {
  id: string
  name: string
  img: string
  wrong?: string // 규격이 다른 물건 그림(2일차 규격 규칙)
  spec?: string // 기준표에 적는 규격 한 줄
}

export const ITEMS: Item[] = [
  { id: 'ext', name: '소화기', img: img('item_ext_ok'), wrong: img('item_ext_nosticker'), spec: '초록 점검 스티커' },
  { id: 'chair', name: '학생 의자', img: img('item_chair_blue'), wrong: img('item_chair_pink'), spec: '파란색' },
  { id: 'desk', name: '학생 책상', img: img('item_desk_big'), wrong: img('item_desk_small'), spec: '큰 책상' },
  { id: 'firstaid', name: '구급상자', img: img('item_firstaid') },
  { id: 'laptop', name: '노트북', img: img('item_laptop') },
  { id: 'purifier', name: '공기청정기', img: img('item_purifier') },
  { id: 'thermometer', name: '체온계', img: img('item_thermometer') },
  { id: 'bookshelf', name: '책장', img: img('item_bookshelf') },
  { id: 'solarlamp', name: '태양광 가로등', img: img('item_solarlamp') },
]

export const BUILDS = [
  { id: 'library', name: '도서관', img: img('build_library'), safe: img('site_a_safe'), unsafe: img('site_a_unsafe') },
  { id: 'playground', name: '놀이터', img: img('build_playground'), safe: img('site_b_safe'), unsafe: img('site_b_unsafe') },
  { id: 'bridge', name: '다리', img: img('build_bridge'), safe: img('site_c_safe'), unsafe: img('site_c_unsafe') },
]

export const OFFICES_OK = ['office_a_ok', 'office_b_ok', 'office_c_ok', 'office_d_ok'].map(img)
export const OFFICES_EMPTY = ['office_a_empty', 'office_b_empty', 'office_c_empty'].map(img)
export const DELIVERY = { school: img('delivery_school'), health: img('delivery_health') }

// 우대 마크는 공식 제도인 혁신제품과 녹색제품만 쓴다. 게임 점수일 뿐 실제 심사 가점이 아니다
export const MARKS: Record<MarkId, { name: string; img: string; desc: string }> = {
  innovation: { name: '혁신제품', img: img('mark_innovation'), desc: '나라가 첫 구매자가 되어 주는 새 기술 제품' },
  green: { name: '녹색제품', img: img('mark_green'), desc: '공공기관이 먼저 사야 하는 친환경 제품' },
}

// 규칙 하나 = 수첩 한 쪽. ok 는 기준표의 "이래야 해요" 그림, check 는 카드에서 볼 곳
export interface Rule {
  name: string
  short: string // 틀렸을 때 동그라미 옆 한 줄
  rule: string // 기준표와 수첩의 규칙 문장
  check: string // 카드에서 볼 곳
  why: string // 쉬운 말 이유
  action: string // 실제 조달청은(공식 자료로 확인한 방향)
  src: string // 출처 한 줄
  guide: string // 시범 카드 말풍선
}

export const RULES: Record<RuleId, Rule> = {
  ghost: {
    name: '서류만 있는 회사',
    short: '사무실이 비었어요',
    rule: '실제로 일하는 사무실이 있어야 해요',
    check: '업체 사무실 사진',
    why: '일하는 곳도 사람도 없이 서류만 있는 회사가 뽑히면 물건이 오지 않아요.',
    action: '거짓 서류로 입찰한 회사는 한동안 나라 입찰에 나오지 못하게 막아요. 입찰만 하고 일은 남에게 넘기는 브로커성 입찰도 막고 있어요.',
    src: '국가계약법 시행령 제76조, 2026년 조달청 업무계획',
    guide: '사무실이 텅 비었어요. 기준표와 달라요! 왼쪽으로 밀어 정밀 확인해요',
  },
  spec: {
    name: '주문과 다른 물건',
    short: '주문과 달라요',
    rule: '도착한 물건이 주문서와 같아야 해요',
    check: '도착한 물건',
    why: '주문한 것과 다른 물건이 오면 학교나 보건소가 제대로 쓸 수 없어요.',
    action: '주문과 다른 물건은 불합격이라 바꿔 오게 해요. 불합격이 쌓인 회사는 한동안 나라장터 쇼핑몰에서 팔 수 없어요.',
    src: '조달청 납품검사와 품질관리 보도자료',
    guide: '주문서와 물건이 달라요! 왼쪽으로 밀어 정밀 확인해요',
  },
  box: {
    name: '남이 만든 물건',
    short: '상자 회사가 달라요',
    rule: '상자의 회사가 계약한 회사와 같아야 해요',
    check: '상자에 붙은 로고',
    why: '직접 만들기로 약속한 회사가 남이 만든 완제품을 가져오면 안 돼요.',
    action: '직접 만들기로 해 놓고 남의 완제품을 사다 팔면 입찰에 못 나오게 막고, 그렇게 번 돈을 돌려내게 해요.',
    src: '조달청 직접생산 위반 조사 보도자료(2025년 3월)',
    guide: '상자의 로고가 계약 회사와 달라요! 왼쪽으로 밀어요',
  },
  collusion: {
    name: '가격 미리 맞추기(담합) 징후',
    short: '가격이 똑같아요',
    rule: '다른 회사와 가격이 똑같으면 미리 짰는지 확인해요',
    check: '입찰 가격',
    why: '회사끼리 가격을 미리 맞추면 공정한 경쟁이 사라져요. 정말 짰는지는 조사로 확인해요.',
    action: '담합이 드러나면 입찰에 못 나오게 막고, 심하면 공정거래위원회에 고발을 요청해요. 나라장터는 입찰을 열면 모든 가격을 공개해요.',
    src: '국가계약법 시행령 제76조, 조달청과 공정위 고발요청 협약',
    guide: '두 회사 가격이 똑같아요. 미리 짠 것 같아요! 왼쪽으로 밀어요',
  },
  safety: {
    name: '안전 소홀 기록',
    short: '안전이 걱정돼요',
    rule: '지난 공사 현장이 안전해야 해요(안전모와 난간)',
    check: '지난 공사 현장 사진',
    why: '안전을 소홀히 한 회사가 공사를 맡으면 사고가 날 수 있어요. 안전모 그림은 게임 속 표시예요.',
    action: '중대재해를 낸 회사는 낙찰받기 어렵도록 심사 기준을 강화하고 있어요.',
    src: '2026년 조달청 업무계획',
    guide: '지난 현장에 안전모와 난간이 없어요! 왼쪽으로 밀어요',
  },
}
// 옛 이름 호환(시연 모드와 점검 스크립트)
export const CLUES = RULES

export interface DayDef {
  no: 1 | 2 | 3
  title: string
  kind: 'bid' | 'delivery'
  suspicious: number // 의심 카드 비율
  agencies: AgencyId[]
  fact: string // 브리핑의 조달청 한 줄(공식 자료로 확인)
  rules: RuleId[] // 이날 새로 배우는 규칙(시범 카드를 보여 준다)
  board: RuleId[] // 이날 기준표에 올라가는 규칙
}

export const STAGES: DayDef[] = [
  { no: 1, title: '물품 입찰 서류', kind: 'bid', suspicious: 0.22, agencies: ['school', 'fire'],
    fact: '조달청은 나라장터에서 학교와 소방서 같은 기관이 필요한 물건을 대신 사 줘요',
    rules: ['ghost'], board: ['ghost'] },
  { no: 2, title: '납품검사', kind: 'delivery', suspicious: 0.3, agencies: ['school', 'health'],
    fact: '물건이 도착하면 주문서와 같은지 검사해요. 다르면 불합격이에요',
    rules: ['spec', 'box'], board: ['spec', 'box'] },
  { no: 3, title: '시설공사 입찰', kind: 'bid', suspicious: 0.35, agencies: ['district'],
    fact: '도서관과 다리 같은 공공시설 공사도 조달청이 계약해요. 값만 보지 않고 안전도 봐요',
    rules: ['collusion', 'safety'], board: ['collusion', 'safety'] },
]

export const STAGE_SECONDS = 45
export const FAST_MS = 2000 // 이보다 빨리 맞히면 빠른 판정 점수

// 성장사다리: 2016년 벤처나라 개통 브리핑의 설명(벤처나라, 다수공급자계약과 우수조달제품, 해외시장)
export const LADDER = ['벤처나라', '다수공급자계약', '우수조달물품', '해외 진출']
export const LADDER_INFO = [
  '처음 공공시장에 들어온 회사는 벤처나라에서 첫 판로를 열어요',
  '믿을 만한 회사는 나라장터 쇼핑몰(다수공급자계약)에서 여러 기관에 팔아요',
  '기술과 품질이 좋은 중소기업 제품은 우수조달물품으로 지정받아요',
  '공공조달에서 쌓은 실적으로 다른 나라 정부에도 팔아요',
]

// --- 하루 끝 정산 편지. kind: missed(문제를 통과시킴), caught(문제를 잡음), waited(성실한 회사를 정밀 확인), good(성실한 회사 통과) ---
export type LetterKind = 'missed' | 'caught' | 'waited' | 'good'
export interface Letter {
  from: string
  fromImg: string
  body: string
  lesson: string
}
// 받침이 있으면 앞 조사, 없으면 뒤 조사(예: 이/가, 과/와)
export function josa(word: string, withB: string, without: string): string {
  const c = word.charCodeAt(word.length - 1)
  if (c < 0xac00 || c > 0xd7a3) return withB
  return (c - 0xac00) % 28 ? withB : without
}
const iga = (w: string) => w + josa(w, '이', '가')
const gwa = (w: string) => w + josa(w, '과', '와')

export function letterFor(kind: LetterKind, rule: RuleId | null, company: string, agency: AgencyId, what: string, mark?: MarkId): Letter {
  const ag = AGENCIES[agency]
  const probe = { from: '불공정 조달 조사', fromImg: img('tray_investigate') }
  if (kind === 'waited') {
    return { from: company, fromImg: '', body: `정밀 확인 결과 이상이 없었습니다. 확인을 기다리는 동안 ${what} 납품이 조금 늦어졌습니다. 양해 부탁드립니다.`,
      lesson: '정밀 확인은 탈락이 아니라 서류를 한 번 더 살피는 절차예요. 기준과 맞으면 통과시켜요.' }
  }
  if (kind === 'good') {
    if (mark) {
      return { from: ag.name, fromImg: ag.img, body: `${company}의 ${what}, 잘 받았습니다. ${MARKS[mark].name}이라서 더욱 반가웠습니다.`,
        lesson: mark === 'innovation' ? '혁신제품은 나라가 첫 구매자가 되어 판로를 열어 줘요.' : '공공기관은 녹색제품을 먼저 사야 해요.' }
    }
    return { from: ag.name, fromImg: ag.img, body: `${company}의 ${what}, 잘 받았습니다. 공정하게 심사해 주셔서 감사합니다.`,
      lesson: '값이 낮은 회사부터 서류를 확인해 기준에 맞으면 낙찰돼요.' }
  }
  const r = RULES[rule!]
  if (kind === 'caught') {
    const body: Record<RuleId, string> = {
      ghost: `정밀 확인한 결과 ${company}의 사무실은 실제로 비어 있었습니다. 이 회사는 제외하고 다음 회사를 심사했습니다.`,
      spec: `${company}에서 보낸 ${iga(what)} 주문과 달라 불합격 처리했습니다. 교체 납품을 요청했습니다.`,
      box: `${company}의 상자는 다른 회사가 만든 물건이었습니다. 직접 생산했는지 추가로 조사하겠습니다.`,
      collusion: `${gwa(company)} 입찰 가격이 같았던 회사를 함께 조사하겠습니다.`,
      safety: `${company}의 지난 공사 현장 안전 기록을 다시 살펴보고 있습니다.`,
    }
    return { ...probe, body: body[rule!], lesson: r.action }
  }
  const body: Record<RuleId, string> = {
    ghost: `주문한 ${iga(what)} 도착하지 않았습니다. 확인해 보니 서류만 있고 일하는 곳이 없는 회사였습니다.`,
    spec: `도착한 ${iga(what)} 주문과 달라서 사용할 수 없습니다. 다시 보내 달라고 요청했습니다.`,
    box: `${what} 상자에 다른 회사 이름이 붙어 있었습니다. 직접 만든 물건이 아니었습니다.`,
    collusion: `${iga(company)} 다른 회사와 가격을 미리 맞춘 것 같다는 신고가 접수되었습니다.`,
    safety: `${iga(company)} 맡은 공사 현장에서 안전 문제가 생길까 걱정됩니다.`,
  }
  return { from: ag.name, fromImg: ag.img, body: body[rule!], lesson: `${r.rule}. ${r.action}` }
}
