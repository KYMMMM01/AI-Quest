// 플레이 모습 GIF용 프레임 찍기(시연 참고용). 1단계 안내 카드 뒤 약 9초를 960x540으로 찍는다
import { chromium } from 'playwright-core'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(here, 'out/rec'); mkdirSync(out, { recursive: true })
const b = await chromium.launch({ channel: 'chrome', headless: true })
const page = await b.newPage({ viewport: { width: 960, height: 540 } })
await page.goto(pathToFileURL(path.resolve(here, '../dist/index.html')).href + '?seed=' + (process.argv[2] ?? '5'))
await page.waitForFunction(() => window.__qa && window.__qa.boot === 'ready')
await page.click('[data-act="start"]', { force: true })
for (const k of ['ArrowRight', 'ArrowLeft']) {
  await page.waitForFunction(() => window.__qa.play && window.__qa.play.phase === 'guide', null, { timeout: 15000 })
  await page.waitForTimeout(500); await page.keyboard.press(k)
  await page.waitForFunction(() => window.__qa.play.phase !== 'guide')
}
let n = 0, last = ''
const t0 = Date.now()
while (Date.now() - t0 < 9000) {
  await page.screenshot({ path: path.join(out, `${String(n++).padStart(3, '0')}.png`) })
  const p = await page.evaluate(() => window.__qa.play)
  const key = p.phase + p.judged
  if (p.phase === 'card' && key !== last && Date.now() % 3 !== 9) {
    last = key
    setTimeout(() => page.keyboard.press(p.clue === 'none' ? 'ArrowRight' : 'ArrowLeft').catch(() => {}), 650)
  }
}
await b.close(); console.log('frames', n, 'ms', Date.now() - t0)
