// --- 게임 오버 점검: 1일차에 세 번 틀리면 하트 창이 뜨고 시간이 멈추며, 오늘 다시 하기로 그날 기록이 되돌아가는지 본다 ---
import { chromium } from 'playwright-core'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(here, 'out/gameover'); mkdirSync(out, { recursive: true })
const url = pathToFileURL(path.resolve(here, '../dist/index.html')).href + '?seed=7'
let failures = 0
const check = (n, ok, d = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? ' : ' + d : ''}`) }

const b = await chromium.launch({ channel: 'chrome', headless: true })
for (const [tag, w, h, mobile] of [['pc', 1920, 1080, false], ['p844', 844, 390, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript(() => localStorage.setItem('tut', '1'))
  await page.goto(url)
  await page.waitForFunction(() => window.__qa && window.__qa.scene === 'tap', null, { timeout: 15000 })
  await page.mouse.click(w / 2, h / 2)
  await page.waitForFunction(() => window.__qa.scene === 'title')
  await page.waitForTimeout(1300)
  await page.click('[data-act="start"]', { force: true })
  await page.waitForFunction(() => window.__qa.play && window.__qa.play.phase === 'brief', null, { timeout: 10000 })
  await page.click('.brief [data-act="go"]', { force: true })
  const p = () => page.evaluate(() => window.__qa.play)
  let wrongs = 0
  const t0 = Date.now()
  while (Date.now() - t0 < 60000) {
    const s = await p()
    if (s.phase === 'over') break
    if (s.phase === 'guide') { await page.keyboard.press(s.clue === 'none' ? 'ArrowRight' : 'ArrowLeft'); await page.waitForTimeout(900); continue }
    if (s.phase === 'feedback') { await page.click('.why [data-act="ok"]', { force: true }); await page.waitForTimeout(600); continue }
    // 처음 두 장은 맞혀 점수를 쌓고, 그 뒤로 세 번 틀린다
    if (s.phase === 'card') {
      const wrong = s.judged >= 2
      await page.keyboard.press((s.clue === 'none') !== wrong ? 'ArrowRight' : 'ArrowLeft')
      if (wrong) wrongs++
      await page.waitForTimeout(700)
      continue
    }
    await page.waitForTimeout(100)
  }
  await page.waitForTimeout(500)
  const s1 = await p()
  check(`${tag} 세 번 틀리면 하트 창`, s1.phase === 'over' && wrongs === 3 && s1.hearts === 0 && s1.score > 0, `phase ${s1.phase}, 틀림 ${wrongs}, 하트 ${s1.hearts}, 점수 ${s1.score}`)
  check(`${tag} 하트 창이 보임`, await page.isVisible('.overlay.gameover .sheet'))
  const r = await page.evaluate(() => {
    const s = document.getElementById('stage').getBoundingClientRect(), k = s.width / 1920
    const e = document.querySelector('.gameover .sheet').getBoundingClientRect()
    return { x: (e.left - s.left) / k, y: (e.top - s.top) / k, w: e.width / k, h: e.height / k }
  })
  check(`${tag} 하트 창이 화면 안`, r.x >= 0 && r.y >= 0 && r.x + r.w <= 1920 && r.y + r.h <= 1080, JSON.stringify(r))
  const ta = (await p()).timeLeft
  await page.waitForTimeout(1200)
  check(`${tag} 하트 창에서 시간 멈춤`, (await p()).timeLeft === ta)
  await page.screenshot({ path: path.join(out, `${tag}-gameover.png`) })
  await page.click('.gameover [data-act="retry"]', { force: true })
  await page.waitForTimeout(500)
  const s2 = await p()
  check(`${tag} 오늘 다시 하기는 1일차 브리핑부터`, s2.phase === 'brief' && s2.stage === 1, `phase ${s2.phase}, ${s2.stage}일차`)
  check(`${tag} 그날 기록이 되돌아감`, s2.hearts === 3 && s2.score === 0 && s2.judged === 0 && !(await page.$('.gameover')), `하트 ${s2.hearts}, 점수 ${s2.score}, 판정 ${s2.judged}`)
  check(`${tag} 오류 0`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}
await b.close()
console.log(failures === 0 ? '\n전체 통과' : `\n실패 ${failures}건`)
process.exit(failures ? 1 : 0)
