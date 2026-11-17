// --- 빌드 결과(dist/index.html)를 file:// 로 열어 Chrome과 Edge에서 자동 점검한다 ---
// 확인: 콘솔 오류 0, 그림 로딩, 소리 디코딩과 재생 상태, 타이머, 자동 일시정지와 복귀, 세로 화면 안내, 화면 맞춤
import { chromium } from 'playwright-core'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const url = pathToFileURL(path.resolve(here, '../dist/index.html')).href
const outDir = path.resolve(here, 'out')
mkdirSync(outDir, { recursive: true })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const check = (browser, name, ok, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} [${browser}] ${name}${detail ? ' : ' + detail : ''}`)
}

for (const channel of ['chrome', 'msedge']) {
  const browser = await chromium.launch({ channel, headless: true })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  // 튜토리얼은 본 것으로 두고 브리핑과 시범 카드부터 점검한다(튜토리얼은 playtest 가 본다)
  await page.addInitScript(() => localStorage.setItem('tut', '1'))
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('requestfailed', (r) => errors.push('requestfailed ' + r.url()))

  await page.goto(url)
  await page.waitForFunction(() => window.__qa && window.__qa.boot === 'ready', null, { timeout: 15000 })
  const failed = await page.evaluate(() => window.__qa.failedImages)
  check(channel, '그림 로딩', failed.length === 0, failed.join(', '))
  const fontOk = await page.evaluate(() => document.fonts.check('700 40px Pretendard') && document.fonts.check('900 40px Pretendard'))
  check(channel, 'Pretendard 글꼴 적용', fontOk)
  // 화면을 한 번 눌러 소리를 켜고 타이틀로 간다
  await page.waitForFunction(() => window.__qa.scene === 'tap', null, { timeout: 15000 })
  await page.mouse.click(960, 540)
  await page.waitForFunction(() => window.__qa.scene === 'title')
  await wait(1500) // 간판 등장 움직임이 끝난 뒤 찍는다
  await page.screenshot({ path: path.join(outDir, `${channel}-title.png`) })
  const imgs = await page.evaluate(() => [...document.images].map((i) => [i.getAttribute('src'), i.naturalWidth]))
  check(channel, '타이틀 그림 표시', imgs.length > 0 && imgs.every(([, w]) => w > 0), JSON.stringify(imgs))
  const ta = await page.evaluate(() => window.__qa.audio())
  check(channel, '타이틀 배경음 재생', ta.bgm === 'title', JSON.stringify(ta))

  // 메뉴 간판은 살짝 흔들리므로 안정 대기 없이 누른다
  await page.click('[data-act="start"]', { force: true })
  await page.waitForFunction(() => window.__qa.scene === 'play')
  await wait(300)
  const a = await page.evaluate(() => window.__qa.audio())
  check(channel, '소리 디코딩과 플레이 배경음', a.state === 'running' && a.decoded === 14 && a.bgm === 'play', JSON.stringify(a))

  // 브리핑과 시범 카드 동안은 하루 시간이 멈춘다. 시범 카드 두 장(통과, 정밀 확인)을 넘긴 뒤 잰다
  const phase = () => page.evaluate(() => window.__qa.play && window.__qa.play.phase)
  await page.waitForFunction(() => window.__qa.play && window.__qa.play.phase === 'brief', null, { timeout: 10000 })
  const tb = await page.evaluate(() => window.__qa.timeLeft)
  await wait(600)
  check(channel, '브리핑 동안 시간 멈춤', (await page.evaluate(() => window.__qa.timeLeft)) === tb)
  await page.click('.brief [data-act="go"]', { force: true })
  for (const key of ['ArrowRight', 'ArrowLeft']) {
    await page.waitForFunction(() => window.__qa.play && window.__qa.play.phase === 'guide', null, { timeout: 10000 })
    await page.keyboard.press(key)
    await page.waitForFunction(() => window.__qa.play.phase !== 'guide', null, { timeout: 5000 })
  }
  await page.waitForFunction(() => window.__qa.play.phase === 'card', null, { timeout: 8000 })
  check(channel, '시범 카드 두 장 뒤 심사 시작', (await phase()) === 'card')
  await page.waitForTimeout(400)
  await page.click('[data-act="scan"]', { timeout: 3000, force: true }).catch(() => {})
  await page.waitForTimeout(300)
  check(channel, '마우스로 스캔 버튼 누르기', await page.evaluate(() => window.__qa.play.scanned))
  // 화면 숫자는 10초 이상이면 정수라 짧은 간격의 변화가 안 보이므로 남은 시간(ms) 값을 직접 읽는다
  const t = async () => page.evaluate(() => window.__qa.timeLeft)
  const t0 = await t()
  await wait(600)
  const t1 = await t()
  check(channel, '타이머 흐름', t1 < t0, `${t0} => ${t1}`)
  await page.screenshot({ path: path.join(outDir, `${channel}-play.png`) })

  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  const scene = await page.evaluate(() => window.__qa.scene)
  const p0 = await t()
  await wait(600)
  const p1 = await t()
  check(channel, '창 비활성 시 자동 일시정지', scene === 'pause' && p0 === p1, `${scene} ${p0} => ${p1}`)
  await page.screenshot({ path: path.join(outDir, `${channel}-pause.png`) })

  await page.click('.pause [data-act="resume"]', { force: true })
  const r0 = await t()
  await wait(600)
  check(channel, '계속하기 뒤 타이머 재개', (await t()) < r0)

  await page.setViewportSize({ width: 800, height: 1200 })
  await wait(300)
  const noticeShown = await page.evaluate(() => !document.getElementById('rotate-notice').hidden)
  const q0 = await t()
  await wait(600)
  check(channel, '세로 화면 안내와 타이머 정지', noticeShown && (await t()) === q0)

  await page.setViewportSize({ width: 1366, height: 768 })
  await wait(300)
  const box = await page.evaluate(() => {
    const r = document.getElementById('stage').getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height, hidden: document.getElementById('rotate-notice').hidden }
  })
  const fits = box.hidden && box.x >= -0.5 && box.y >= -0.5 && box.x + box.w <= 1366.5 && box.y + box.h <= 768.5 && box.w > 1360
  check(channel, '1366x768 화면 맞춤', fits, JSON.stringify(box))
  const s0 = await t()
  await wait(600)
  check(channel, '가로로 돌아온 뒤 타이머 재개', (await t()) < s0)

  check(channel, '콘솔 오류 0', errors.length === 0, errors.join(' | '))
  await browser.close()
}

console.log(failures === 0 ? '\n전체 통과' : `\n실패 ${failures}건`)
process.exit(failures === 0 ? 0 : 1)
