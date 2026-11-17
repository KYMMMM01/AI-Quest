// --- 배치 점검: PC 와 휴대폰 가로 두 크기에서 주요 UI 가 서로 겹치거나 화면 밖으로 나가는지, 카드 위아래 간격이 같은지 잰다 ---
// 좌표는 1920x1080 무대 기준으로 바꿔 비교한다
import { chromium } from 'playwright-core'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(here, 'out/layout'); mkdirSync(out, { recursive: true })
const url = pathToFileURL(path.resolve(here, '../dist/index.html')).href + '?seed=7'
let failures = 0
const check = (n, ok, d = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? ' : ' + d : ''}`) }

// 서로 겹치면 안 되는 것들(같은 묶음 안끼리는 비교하지 않는다)
const PLAY = ['.hud-l', '.hud-r', '.board', '.agencies', '.card-slot', '.judge-row', '.narumi-spot .sprite', '.dari-spot .sprite', '.narumi-bubble']
const TITLE = ['.hang', '.corner', '.cast .narumi .sprite', '.cast .dari .sprite']

async function rects(page, sels) {
  return page.evaluate((sels) => {
    const s = document.getElementById('stage').getBoundingClientRect()
    const k = s.width / 1920
    const r = {}
    for (const sel of sels) {
      const e = document.querySelector(sel)
      if (!e || e.hidden || getComputedStyle(e).display === 'none') continue
      const b = e.getBoundingClientRect()
      r[sel] = { x: (b.left - s.left) / k, y: (b.top - s.top) / k, w: b.width / k, h: b.height / k }
    }
    return r
  }, sels)
}
function overlaps(r) {
  const keys = Object.keys(r)
  const bad = []
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const a = r[keys[i]], b = r[keys[j]]
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
    if (ox > 2 && oy > 2) bad.push(`${keys[i]} x ${keys[j]} (${Math.round(ox)}x${Math.round(oy)})`)
  }
  // 타이틀 간판은 화면 위 끝에서 체인으로 매달린 디자인이라 위쪽만 넘쳐도 된다
  const off = keys.filter((k) => r[k].x < -1 || (r[k].y < -1 && k !== '.hang') || r[k].x + r[k].w > 1921 || r[k].y + r[k].h > 1081).map((k) => `${k} 화면 밖`)
  return bad.concat(off)
}

const b = await chromium.launch({ channel: 'chrome', headless: true })
for (const [tag, w, h, mobile] of [['pc', 1920, 1080, false], ['p844', 844, 390, true], ['p667', 667, 375, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile })
  const page = await ctx.newPage()
  await page.addInitScript(() => localStorage.setItem('tut', '1'))
  await page.goto(url)
  await page.waitForFunction(() => window.__qa && window.__qa.scene === 'tap', null, { timeout: 15000 })
  await page.mouse.click(w / 2, h / 2)
  await page.waitForFunction(() => window.__qa.scene === 'title')
  await page.waitForTimeout(1300)
  const tr = await rects(page, TITLE)
  const tb = overlaps(tr)
  check(`${tag} 타이틀 겹침 없음`, tb.length === 0, tb.join(', '))
  await page.click('[data-act="start"]', { force: true })
  await page.waitForFunction(() => window.__qa.play && window.__qa.play.phase === 'brief', null, { timeout: 10000 })
  await page.waitForTimeout(400)
  const sheet = await rects(page, ['.brief .sheet'])
  check(`${tag} 브리핑 창이 화면 안`, overlaps(sheet).length === 0, JSON.stringify(sheet))
  await page.click('.brief [data-act="go"]', { force: true })
  for (const key of ['ArrowRight', 'ArrowLeft']) {
    await page.waitForFunction(() => window.__qa.play.phase === 'guide', null, { timeout: 8000 })
    await page.keyboard.press(key)
    await page.waitForFunction(() => window.__qa.play.phase !== 'guide', null, { timeout: 5000 })
  }
  await page.waitForFunction(() => window.__qa.play.phase === 'card', null, { timeout: 8000 })
  await page.waitForTimeout(500)
  const pr = await rects(page, PLAY)
  const pb = overlaps(pr)
  check(`${tag} 플레이 화면 겹침 없음`, pb.length === 0, pb.join(', '))
  const ag = await rects(page, ['.agencies .agency', '.card', '.judge-row .btn'])
  const top = ag['.card'].y - (ag['.agencies .agency'].y + ag['.agencies .agency'].h)
  const bottom = ag['.judge-row .btn'].y - (ag['.card'].y + ag['.card'].h)
  check(`${tag} 카드 위아래 간격 같음`, Math.abs(top - bottom) <= 1, `위 ${top.toFixed(1)}, 아래 ${bottom.toFixed(1)}`)
  await page.screenshot({ path: path.join(out, `${tag}-play.png`) })
  for (const [act, sel] of [['note', '.dex .sheet'], ['pause', '.pause .sheet']]) {
    await page.click(`[data-act="${act}"]`, { force: true })
    await page.waitForTimeout(400)
    const r = await rects(page, [sel])
    check(`${tag} ${act} 창이 화면 안`, overlaps(r).length === 0, JSON.stringify(r))
    await page.screenshot({ path: path.join(out, `${tag}-${act}.png`) })
    await page.click(`${sel.split(' ')[0]} [data-act="${act === 'pause' ? 'resume' : 'close'}"]`, { force: true })
    await page.waitForTimeout(300)
  }
  await ctx.close()
}
await b.close()
console.log(failures === 0 ? '\n전체 통과' : `\n실패 ${failures}건`)
process.exit(failures ? 1 : 0)
