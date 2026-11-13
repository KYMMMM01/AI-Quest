// --- 그림 미리 불러오기. 모두 디코딩한 뒤에 시작 버튼을 켠다 ---
import { SPRITES } from './sprite-data'
import * as D from './data'

// 게임에서 쓰는 모든 그림. 처음에 다 불러와 판정 중에 그림이 늦게 뜨지 않게 한다
const all = new Set<string>([
  'assets/narumi.webp',
  'assets/dari.webp',
  'assets/img/bg_title.webp',
  'assets/img/bg_game.webp',
  'assets/img/ladder.webp',
  'assets/img/stamp_pass.webp',
  'assets/img/stamp_check.webp',
  'assets/img/tray_investigate.webp',
  ...Object.values(SPRITES).map((s) => s.src),
  ...D.COMPANIES.map((c) => c.logo),
  ...Object.values(D.AGENCIES).map((a) => a.img),
  ...D.ITEMS.flatMap((i) => (i.wrong ? [i.img, i.wrong] : [i.img])),
  ...D.BUILDS.flatMap((b) => [b.img, b.safe, b.unsafe]),
  ...D.OFFICES_OK,
  ...D.OFFICES_EMPTY,
  D.DELIVERY.school,
  D.DELIVERY.health,
  ...Object.values(D.MARKS).map((m) => m.img),
])
export const IMAGES = [...all]

// 실패한 경로 목록을 돌려준다
export async function preloadImages(onProgress: (done: number, total: number) => void): Promise<string[]> {
  let done = 0
  const failed: string[] = []
  // 글꼴도 다 받은 뒤에 첫 화면을 그려 글자가 바뀌어 보이지 않게 한다
  const fonts = Promise.all(['700', '900'].map((w) => document.fonts.load(`${w} 40px Pretendard`))).catch(() => failed.push('font'))
  await Promise.all(
    IMAGES.map(async (src) => {
      const img = new Image()
      img.src = src
      try {
        await img.decode()
      } catch {
        failed.push(src)
      }
      onProgress(++done, IMAGES.length)
    }),
  )
  await fonts
  return failed
}
