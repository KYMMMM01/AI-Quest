// --- 끝까지 자동 플레이 점검(file://, Chrome). 카드 단서를 읽어 대부분 맞게, 일부러 몇 번 틀리게 판정한다 ---
// 확인: 안내 카드, 단서별 카드, 강제 스캔과 다시 판정, 하트 소진과 도움 모드, 단계 결과 3번, 최종 결과, 콘솔 오류 0
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
await page.goto(url)
await page.waitForFunction(() => window.__qa && window.__qa.boot === 'ready', null, { timeout: 20000 })
await page.click('[data-act="start"]', { force: true })

const shots = new Set()
const shot = async (name) => {
  if (shots.has(name)) return
  shots.add(name)
  await page.screenshot({ path: path.join(outDir, `${name}.png`) })
}
const seen = { guide: 0, results: 0, forced: false, rejudged: false, help: false, scanned: false, clues: new Set() }
let lastCardKey = ''
let wrongPlan = { 1: 1, 3: 3 } // 1단계 1번, 3단계 3번 일부러 틀린다(3단계는 하트 소진 확인)
const t0 = Date.now()

while (Date.now() - t0 < 420000) {
  const s = await page.evaluate(() => ({ scene: window.__qa.scene, p: window.__qa.play }))
  if (s.scene === 'final') break
  const p = s.p
  if (!p) { await wait(100); continue }
  if (p.help) seen.help = true
  if (p.phase === 'intro') { await shot(`intro${p.stage}`); await wait(200); continue }
  if (p.phase === 'guide') {
    const key = `g${p.stage}-${p.guide}`
    if (key !== lastCardKey) {
      lastCardKey = key
      seen.guide++
      await wait(450)
      await shot(`guide${p.stage}_${p.guide}`)
      // 한 번은 일부러 반대로 밀어 되돌아오는지 본다
      if (seen.guide === 2) {
        await page.keyboard.press(p.clue === 'none' ? 'ArrowLeft' : 'ArrowRight')
        await wait(500)
        const still = await page.evaluate(() => window.__qa.play.phase)
        check('안내 카드는 틀린 방향이면 넘어가지 않는다', still === 'guide')
      }
      await page.keyboard.press(p.clue === 'none' ? 'ArrowRight' : 'ArrowLeft')
    }
    await wait(150)
    continue
  }
  if (p.phase === 'msg') {
    await wait(400)
    await shot('forced_msg')
    await page.click('[data-act="again"]', { force: true })
    seen.rejudged = true
    await wait(500)
    continue
  }
  if (p.phase === 'result') {
    seen.results++
    await wait(900)
    await shot(`result${p.stage}`)
    await page.click('[data-act="next"]', { force: true })
    await wait(400)
    continue
  }
  if (p.phase !== 'card') { await wait(80); continue }
  const key = `c${p.stage}-${p.judged}-${p.clue}-${p.scanned}`
  if (key === lastCardKey) { await wait(80); continue }
  lastCardKey = key
  await wait(380)
  const fresh = await page.evaluate(() => window.__qa.play)
  if (fresh.phase !== 'card') continue
  if (!seen.clues.has(`${fresh.stage}-${fresh.clue}`)) {
    seen.clues.add(`${fresh.stage}-${fresh.clue}`)
    await shot(`card${fresh.stage}_${fresh.clue}`)
  }
  if (fresh.forced && !fresh.scanned) {
    seen.forced = true
    await shot('forced_wait')
    await page.keyboard.press('s')
    await wait(900)
    await shot('forced_scanned')
    await page.keyboard.press('ArrowLeft') // 틀린 힌트를 따라가 본다
    continue
  }
  if (fresh.stage === 1 && !seen.scanned && fresh.clue !== 'none') {
    seen.scanned = true
    await page.keyboard.press('s')
    await wait(1100)
    await shot('scan_stage1')
  }
  const correct = fresh.clue === 'none' ? 'ArrowRight' : 'ArrowLeft'
  const wrong = correct === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight'
  let k = correct
  if (wrongPlan[fresh.stage] > 0 && !fresh.scanned) { wrongPlan[fresh.stage]--; k = wrong }
  await page.keyboard.press(k)
  if (k === wrong && !shots.has(`wrong${fresh.stage}`)) { await wait(500); await shot(`wrong${fresh.stage}`) }
  else await wait(150)
}

await wait(3500)
await page.screenshot({ path: path.join(outDir, 'final.png') })
const fin = await page.evaluate(() => ({ final: window.__qa.final, play: window.__qa.play }))
check('최종 결과 화면 도착', !!fin.final, JSON.stringify(fin.final))
check('단계 결과 세 번', seen.results === 3, String(seen.results))
check('안내 카드 일곱 장(1단계 2, 2단계 2, 3단계 2와 함정 1)', seen.guide === 7, String(seen.guide))
check('2단계 강제 스캔 장면', seen.forced)
check('틀린 힌트 뒤 다시 판정', seen.rejudged)
check('하트를 다 잃으면 도움 모드', seen.help)
check('별 기록 세 단계', fin.play && fin.play.stars.length === 3, JSON.stringify(fin.play && fin.play.stars))
console.log('본 단서', [...seen.clues].join(' '), '판정', fin.play.judged, '정답', fin.play.correct, '점수', fin.play.score)
check('콘솔 오류 0', errors.length === 0, errors.slice(0, 5).join(' | '))
await browser.close()
console.log(failures === 0 ? '\n전체 통과' : `\n실패 ${failures}건`)
process.exit(failures === 0 ? 0 : 1)
