// --- 게임 데이터: 가상 업체, 품목, 단서, 우대 마크, 단계 설정. 등장 업체와 금액은 모두 가상이다 ---
export type Clue = 'none' | 'ghost' | 'spec' | 'box' | 'collusion' | 'safety'
export type MarkId = 'innovation' | 'green' | 'safety'
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
  wrong?: string // 규격이 다른 물건 그림(2단계 규격 다름 단서)
  spec?: string // 공고판에 적는 규격 한 줄
}

export const ITEMS: Item[] = [
  { id: 'ext', name: '소화기', img: img('item_ext_ok'), wrong: img('item_ext_nosticker'), spec: '초록 점검 스티커 부착' },
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

export const MARKS: Record<MarkId, { name: string; img: string; desc: string }> = {
  innovation: { name: '혁신제품', img: img('mark_innovation'), desc: '새 기술로 만든 제품이에요' },
  green: { name: '녹색제품', img: img('mark_green'), desc: '환경을 생각해 만든 제품이에요' },
  safety: { name: '안전인증', img: img('mark_safety'), desc: '안전 관리 인증을 받은 업체예요' },
}

export const CLUES: Record<Exclude<Clue, 'none'>, { name: string; short: string; action: string; guide: string }> = {
  ghost: {
    name: '유령기업 의심',
    short: '사무실이 비었어요',
    action: '일하는 곳이 없는 회사는 입찰보증금 부과 대상이 될 수 있어요',
    guide: '사무실이 텅 비어 있어요! 왼쪽으로 밀어 정밀 확인을 요청해요',
  },
  spec: {
    name: '규격 다름',
    short: '주문과 달라요',
    action: '다시 납품받고, 반복되면 계약이 해지될 수 있어요',
    guide: '공고판의 주문과 물건이 달라요. 왼쪽으로 밀어 정밀 확인!',
  },
  box: {
    name: '남의 상자',
    short: '상자 회사가 달라요',
    action: '직접 만들기로 한 물건인지 점검하고, 위반이면 계약 해지와 제재를 받아요',
    guide: '상자의 회사 로고가 업체 로고와 달라요. 왼쪽으로 밀어요',
  },
  collusion: {
    name: '담합 징후',
    short: '가격이 똑같아요',
    action: '조달청이 조사해 입찰을 제한하고 부당이득을 환수해요. 심하면 공정위에 고발을 요청해요',
    guide: '다른 업체와 가격이 똑같아요(가격을 미리 맞춤). 왼쪽으로 밀어요',
  },
  safety: {
    name: '안전 소홀 기록',
    short: '안전이 걱정돼요',
    action: '안전 사고 기록이 있으면 심사에서 감점을 받아 낙찰이 어려워져요',
    guide: '지난 공사 현장에 안전모가 없어요. 왼쪽으로 밀어요',
  },
}

export interface StageDef {
  no: 1 | 2 | 3
  title: string
  kind: 'bid' | 'delivery'
  cardTime: number // 카드당 제한 시간(초)
  suspicious: number // 의심 카드 비율
  agencies: AgencyId[]
  fact: string // 단계 소개의 조달청 한 줄 상식(방향만, 수치 없음)
  guides: Clue[] // 단계 시작 때 보여 줄 안내 카드('none'은 조작 안내)
}

export const STAGES: StageDef[] = [
  { no: 1, title: '물품 입찰 서류', kind: 'bid', cardTime: 4, suspicious: 0.2, agencies: ['school', 'fire'],
    fact: '조달청은 나라장터에서 공공기관이 필요한 물건을 대신 사 줘요', guides: ['none', 'ghost'] },
  { no: 2, title: '납품검사', kind: 'delivery', cardTime: 3.5, suspicious: 0.3, agencies: ['school', 'health'],
    fact: '조달청은 납품된 물건이 주문과 같은지 꼼꼼히 점검해요', guides: ['spec', 'box'] },
  { no: 3, title: '시설공사 입찰', kind: 'bid', cardTime: 3, suspicious: 0.35, agencies: ['district'],
    fact: '조달청은 학교와 도서관 같은 공공시설 공사도 맡아요', guides: ['collusion', 'safety'] },
]

export const STAGE_SECONDS = 45
export const LADDER = ['벤처나라', '혁신제품', '우수조달', '해외 진출']
export const LADDER_INFO = [
  '처음 공공시장에 들어온 기업은 벤처나라에서 판로를 열어요',
  '새 기술 제품은 혁신제품으로 지정되면 공공기관이 첫 구매자가 되어 줘요',
  '품질이 검증된 제품은 우수조달물품으로 더 많은 공공기관에 납품해요',
  '공공조달에서 쌓은 실적으로 해외 조달시장에도 진출해요',
]
