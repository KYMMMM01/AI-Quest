// --- 시연 모드(?demo=1) 점검: 시작부터 최종 결과까지 걸리는 시간, 장면 순서, 콘솔 오류. 도감과 만든 사람 화면도 찍는다 ---
import { chromium } from 'playwright-core'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(here, 'out/demo'); mkdirSync(out, { recursive: true })
const base = pathToFileURL(path.resolve(here, '../dist/index.html')).href
let failures = 0
const check = (n, ok, d = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? ' : ' + d : ''}`) }
const b = await chromium.launch({ channel: 'chrome', headless: true })

// 1. 타이틀의 도감과 만든 사람
{
  const page = await b.newPage({ viewport: { width: 1920, height: 1080 } })
  await page.goto(base)
  await page.waitForFunction(() => window.__qa && window.__qa.scene === 'tap', null, { timeout: 15000 })
  await page.mouse.click(960, 540)
  await page.waitForFunction(() => window.__qa.scene === 'title')
  await page.waitForTimeout(1200)
  await page.click('[data-act="credits"]', { force: true }); await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(out, 'credits.png') })
  check('만든 사람 화면 열림', await page.isVisible('.credits'))
  await page.click('.credits-ov [data-act="close"]', { force: true })
  await page.click('[data-act="dex"]', { force: true }); await page.waitForTimeout(500)
  const locked = await page.$$eval('.note-tab.locked', (e) => e.length)
  await page.screenshot({ path: path.join(out, 'dex_empty.png') })
  check('처음 수첩은 10쪽 모두 빈 쪽', locked === 10, String(locked))
  await page.close()
}

// 2. 시연 모드
const page = await b.newPage({ viewport: { width: 960, height: 540 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto(base + '?demo=1')
await page.waitForFunction(() => window.__qa && window.__qa.scene === 'tap', null, { timeout: 15000 })
await page.mouse.click(480, 270)
await page.waitForFunction(() => window.__qa.scene === 'title')
await page.waitForTimeout(1200)
await page.click('[data-act="start"]', { force: true })
const t0 = Date.now()
const log = []
let last = ''
let n = 0
while (Date.now() - t0 < 90000) {
  await page.screenshot({ path: path.join(out, `f${String(n++).padStart(4, '0')}.png`) })
  const s = await page.evaluate(() => ({ scene: window.__qa.scene, p: window.__qa.play }))
  const key = s.scene === 'final' ? 'final' : `${s.p?.stage}-${s.p?.phase}-${s.p?.clue}`
  if (key !== last) { last = key; log.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${key}`) }
  if (s.scene === 'final') break
}
await page.waitForTimeout(4000)
for (let i = 0; i < 25; i++) await page.screenshot({ path: path.join(out, `f${String(n++).padStart(4, '0')}.png`) })
const total = (Date.now() - t0) / 1000
console.log(log.join('\n'))
const fin = await page.evaluate(() => window.__qa.final)
check('시연이 최종 결과까지 감', !!fin, JSON.stringify(fin))
check('최종 결과는 해외 진출 칸', fin && fin.level === 3)
check('강제 스캔과 다시 판정 장면 포함', log.some((l) => l.includes('2-msg')))
await page.click('[data-act="dex"]', { force: true }); await page.waitForTimeout(500)
const open = await page.$$eval('.note-tab:not(.locked)', (e) => e.length)
await page.screenshot({ path: path.join(out, 'dex_after.png') })
check('시연 뒤 수첩이 채워짐(규칙 5, 낙찰 순서, 혁신, 녹색, 스캔, 성장사다리)', open >= 9, String(open))
check('콘솔 오류 0', errors.length === 0, errors.slice(0, 3).join(' | '))
console.log('frames', n, 'total s', total.toFixed(1))
await b.close()
console.log(failures === 0 ? '\n전체 통과' : `\n실패 ${failures}건`)
process.exit(failures ? 1 : 0)
