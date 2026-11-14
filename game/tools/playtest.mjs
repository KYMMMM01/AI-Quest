// --- 끝까지 자동 플레이 점검(file://, Chrome). 튜토리얼부터 최종 결과까지 새 흐름을 그대로 밟는다 ---
// 확인: 누르면 시작, 튜토리얼 연습 카드 두 장, 브리핑 세 번(시간 멈춤), 시범 카드, 틀렸을 때 이유 상자(시간 멈춤),
//       강제 스캔과 다시 판정, 하루 정산 편지, 최종 결과, 수첩이 채워짐, 콘솔 오류 0
import { chromium } from 'playwright-core'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const seed = process.argv[2] ?? '7'
const url = pathToFileURL(path.resolve(here, '../dist/index.html')).href + `?seed=${seed}`
const outDir = path.resolve(here, 'out/play')
mkdirSync(outDir, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const check = (name, ok, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' : ' + detail : ''}`)
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))
page.on('requestfailed', (r) => errors.push('requestfailed ' + r.url()))
const shot = (n) => page.screenshot({ path: path.join(outDir, `${n}.png`) })
const qa = () => page.evaluate(() => ({ scene: window.__qa.scene, p: window.__qa.play, t: window.__qa.timeLeft }))

await page.goto(url)
await page.waitForFunction(() => window.__qa && window.__qa.scene === 'tap', null, { timeout: 20000 })
await page.mouse.click(960, 540)
await page.waitForFunction(() => window.__qa.scene === 'title')
await wait(1200) // 간판이 내려오는 움직임이 끝난 뒤 누른다
await page.click('[data-act="start"]', { force: true })

// 튜토리얼: 다음 버튼을 누르고, 연습 카드는 바라는 방향으로 민다
let practiced = 0
for (let i = 0; i < 20; i++) {
  await wait(700)
  if (!(await page.$('.coach'))) break
  const s = await qa()
  const next = await page.$('.coach [data-act="cnext"]:not([hidden])')
  if (next) { await next.click({ force: true }); continue }
  if (s.p?.coach) {
    await page.keyboard.press(s.p.coach === 'pass' ? 'ArrowRight' : 'ArrowLeft')
    practiced++
    await wait(900)
  }
}
check('튜토리얼 연습 카드 두 장', practiced === 2, String(practiced))
check('튜토리얼 끝나고 1일차 브리핑', (await qa()).p?.phase === 'brief')

const seen = { brief: 0, briefStill: true, guide: 0, feedback: 0, feedbackStill: true, rejudged: false, results: 0, letters: [] }
const wrongAt = new Set([2, 20, 33]) // 이 번째 판정은 일부러 틀린다
let lastKey = ''
const t0 = Date.now()
while (Date.now() - t0 < 300000) {
  const s = await qa()
  if (s.scene === 'final') break
  const p = s.p
  if (!p) { await wait(100); continue }
  if (p.phase === 'brief') {
    seen.brief++
    const a = s.t
    await wait(500)
    if ((await qa()).t !== a) seen.briefStill = false
    await shot(`brief${p.stage}`)
    await page.click('.brief [data-act="go"]', { force: true })
    await wait(700)
    continue
  }
  if (p.phase === 'guide') {
    const key = `g${p.stage}-${p.guide}`
    if (key !== lastKey) { lastKey = key; seen.guide++; await wait(700); await shot(`guide${p.stage}_${p.guide}`) }
    await page.keyboard.press(p.clue === 'none' ? 'ArrowRight' : 'ArrowLeft')
    await wait(1000)
    continue
  }
  if (p.phase === 'feedback') {
    seen.feedback++
    const a = s.t
    await wait(500)
    if ((await qa()).t !== a) seen.feedbackStill = false
    if (seen.feedback === 1) await shot('feedback')
    await page.click('.why [data-act="ok"]', { force: true })
    await wait(500)
    continue
  }
  if (p.phase === 'msg') {
    await wait(400)
    await shot('ai_msg')
    await page.click('[data-act="again"]', { force: true })
    seen.rejudged = true
    await wait(500)
    continue
  }
  if (p.phase === 'result') {
    seen.results++
    await wait(1000)
    seen.letters.push(await page.$$eval('.letter', (e) => e.length))
    await shot(`result${p.stage}`)
    await page.click('.result [data-act="next"]', { force: true })
    await wait(600)
    continue
  }
  if (p.phase === 'card') {
    if (p.forced && !p.scanned) { await page.click('[data-act="scan"]', { force: true }); await wait(600); continue }
    // 강제 스캔 카드는 틀린 AI 힌트를 일부러 따라 다시 판정 장면을 본다
    if (p.forced && p.hintWrong && !seen.rejudged) { await page.keyboard.press('ArrowLeft'); await wait(900); continue }
    // 하트가 하나 남았을 때는 틀리지 않는다(게임 오버는 gameover-check 가 따로 본다)
    const wrong = wrongAt.has(p.judged) && p.hearts > 1
    if (wrong) wrongAt.delete(p.judged)
    await page.keyboard.press((p.clue === 'none') !== wrong ? 'ArrowRight' : 'ArrowLeft')
    await wait(260)
    continue
  }
  await wait(100)
}
await wait(2500)
await shot('final')
const fin = await page.evaluate(() => window.__qa.final)
check('브리핑 세 번', seen.brief === 3, String(seen.brief))
check('브리핑 동안 시간 멈춤', seen.briefStill)
check('시범 카드(1일차 연습했으면 2, 3일차만)', seen.guide >= 4, String(seen.guide))
check('틀렸을 때 이유 상자', seen.feedback >= 2, String(seen.feedback))
check('이유 상자 동안 시간 멈춤', seen.feedbackStill)
check('강제 스캔 뒤 다시 판정', seen.rejudged)
check('하루 정산 세 번', seen.results === 3, String(seen.results))
check('정산마다 편지', seen.letters.length === 3 && seen.letters.every((n) => n >= 1 && n <= 3), JSON.stringify(seen.letters))
check('최종 결과', !!fin, JSON.stringify(fin))
await page.click('[data-act="dex"]', { force: true })
await wait(400)
const pages = await page.$$eval('.note-tab:not(.locked)', (e) => e.length)
check('수첩이 채워짐', pages >= 9, String(pages))
check('콘솔 오류 0', errors.length === 0, errors.slice(0, 3).join(' | '))
await browser.close()
console.log(failures === 0 ? '\n전체 통과' : `\n실패 ${failures}건`)
process.exit(failures === 0 ? 0 : 1)
