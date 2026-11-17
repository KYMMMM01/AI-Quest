// --- 휴대폰 가로 화면 점검: 작은 화면 설정, 손가락 끌기 판정, 화면 사진(타이틀, 판정, 결과, 도감) ---
import { chromium } from 'playwright-core'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(here, 'out/mobile'); mkdirSync(out, { recursive: true })
const url = pathToFileURL(path.resolve(here, '../dist/index.html')).href + '?seed=7'
let failures = 0
const check = (n, ok, d = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? ' : ' + d : ''}`) }
const b = await chromium.launch({ channel: 'chrome', headless: true })

for (const [tag, w, h] of [['p844', 844, 390], ['p667', 667, 375]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.addInitScript(() => localStorage.setItem('tut', '1'))
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(url)
  await page.waitForFunction(() => window.__qa && window.__qa.scene === 'tap', null, { timeout: 15000 })
  await page.tap('.loading')
  await page.waitForFunction(() => window.__qa.scene === 'title')
  await page.waitForTimeout(1200)
  check(`${tag} 작은 화면 설정 켜짐`, await page.evaluate(() => document.documentElement.classList.contains('compact')))
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(out, `${tag}-title.png`) })
  await page.tap('[data-act="start"]', { force: true })
  await page.waitForFunction(() => window.__qa.play && window.__qa.play.phase === 'brief', null, { timeout: 15000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(out, `${tag}-brief.png`) })
  await page.tap('.brief [data-act="go"]', { force: true })
  await page.waitForFunction(() => window.__qa.play && window.__qa.play.phase === 'guide', null, { timeout: 15000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(out, `${tag}-guide.png`) })

  // 손가락으로 카드를 오른쪽으로 끈다(첫 안내 카드는 통과가 정답)
  const box = await page.locator('.card').boundingBox()
  const cdp = await ctx.newCDPSession(page)
  const x0 = box.x + box.width / 2, y0 = box.y + box.height / 2
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] })
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + i * (w * 0.04), y: y0 }] })
    await page.waitForTimeout(16)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(300)
  const ph = await page.evaluate(() => window.__qa.play.phase)
  check(`${tag} 손가락 끌기로 안내 카드 통과`, ph !== 'guide', ph)
  // 짧게 끌면 판정되지 않고 제자리로 돌아온다
  await page.waitForFunction(() => window.__qa.play.phase === 'guide', null, { timeout: 8000 })
  const box2 = await page.locator('.card').boundingBox()
  const x1 = box2.x + box2.width / 2, y1 = box2.y + box2.height / 2
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 - w * 0.03, y: y1 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(300)
  check(`${tag} 짧게 끌면 판정 안 됨`, (await page.evaluate(() => window.__qa.play.phase)) === 'guide')
  // 판정 버튼 두드리기(두 번째 안내 카드는 정밀 확인). 앞의 끌기와 같은 방식(CDP 터치)으로 두드린다
  const tapCdp = async (sel) => {
    const r = await page.locator(sel).boundingBox()
    const p = { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] })
    await page.waitForTimeout(60)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  await tapCdp('[data-act="check"]')
  await page.waitForTimeout(300)
  const after = await page.evaluate(() => window.__qa.play.phase)
  check(`${tag} 판정 버튼 두드리기`, after === 'judging', after)
  await page.waitForFunction(() => window.__qa.play.phase === 'card', null, { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(out, `${tag}-card.png`) })
  check(`${tag} 카드가 나오면 스캔 버튼이 켜짐`, !(await page.$eval('[data-act="scan"]', (e) => e.disabled)))
  await tapCdp('[data-act="scan"]')
  await page.waitForTimeout(800)
  check(`${tag} 스캔 버튼 두드리기`, await page.evaluate(() => window.__qa.play.scanned))
  await page.screenshot({ path: path.join(out, `${tag}-scan.png`) })
  // 페이지가 밀리거나 확대되지 않았는지
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY, vv: window.visualViewport ? window.visualViewport.scale : 1 }))
  check(`${tag} 화면이 밀리거나 확대되지 않음`, scroll.x === 0 && scroll.y === 0 && scroll.vv === 1, JSON.stringify(scroll))
  check(`${tag} 오류 0`, errors.length === 0, errors.join(' | '))
  if (tag === 'p844') {
    // 결과 화면과 도감도 찍는다(시간을 줄이려고 단계 시간을 끝으로 보낸다)
    await page.evaluate(() => document.querySelector('[data-act="pause"]').click())
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(out, `${tag}-pause.png`) })
    await page.tap('.pause [data-act="home"]', { force: true })
    await page.waitForTimeout(500)
    await page.tap('[data-act="dex"]', { force: true })
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(out, `${tag}-dex.png`) })
    await page.tap('.dex [data-act="close"]', { force: true })
    await page.tap('[data-act="settings"]', { force: true })
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(out, `${tag}-settings.png`) })
  }
  await ctx.close()
}
await b.close()
console.log(failures === 0 ? '\n전체 통과' : `\n실패 ${failures}건`)
process.exit(failures ? 1 : 0)
