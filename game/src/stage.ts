// --- 1920x1080 고정 무대를 화면에 맞춰 늘리고 줄인다. 세로 화면이면 안내를 띄운다 ---
export const STAGE_W = 1920
export const STAGE_H = 1080
let scale = 1
const watchers = new Set<() => void>()
// 무대 한 px 이 화면에서 몇 CSS px 인지와, 무대 크기가 바뀔 때 부를 함수(캐릭터 캔버스를 실제 화면 픽셀 크기로 다시 그린다, sprite.ts)
export const stageScale = (): number => scale
export const onStageFit = (fn: () => void): void => void watchers.add(fn)

// 전체 화면과 가로 고정을 요청한다. 손가락을 뗄 때(사용자 조작으로 인정될 때) 불러야 한다.
// 전체 화면을 지원하지 않으면(아이폰 사파리 등) 아무 일도 없다. 가로 고정까지 되면 true.
// 브라우저가 답을 주지 않아도 3초 뒤에는 false 로 끝내서, 안내를 다시 누를 수 있게 한다
export function requestLandscape(): Promise<boolean> {
  const root = document.documentElement
  if (!root.requestFullscreen) return Promise.resolve(false)
  const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
  const tried = (document.fullscreenElement ? Promise.resolve() : root.requestFullscreen({ navigationUI: 'hide' }))
    .then(() => orientation?.lock?.('landscape') ?? Promise.reject())
    .then(() => true, () => false)
  return Promise.race([tried, new Promise<boolean>((done) => setTimeout(() => done(false), 3000))])
}

export function setupStage(stage: HTMLElement, notice: HTMLElement, onPortrait: (portrait: boolean) => void): void {
  // 휴대폰에서 전체 화면과 방향 고정을 쓸 수 있으면 세로 안내를 누르는 것만으로 가로로 바꾼다.
  // 카카오톡 같은 앱 안 브라우저(안드로이드 WebView 는 브라우저 정보에 "; wv)" 가 붙는다)는 함수가 있어도 가로 고정을 받아 주지 않으므로
  // 누르면 바뀐다고 약속하지 않고 처음 안내(가로로 돌려 주세요, 자동 회전)를 그대로 둔다
  const canLock = typeof (screen.orientation as ScreenOrientation & { lock?: unknown })?.lock === 'function'
  const ua = navigator.userAgent
  const inApp = /; wv\)|KAKAOTALK/i.test(ua)
  // 안 돌아갈 때 풀어야 하는 설정 이름. 아이폰과 아이패드(아이패드는 브라우저 정보에 Macintosh 로 나오기도 함)는 제어 센터의 화면 방향 잠금이다
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const hint = ios ? '안 돌아가면 제어 센터에서 화면 방향 잠금을 꺼 주세요' : '안 돌아가면 화면 자동 회전을 켜 주세요'
  const [text, sub] = notice.querySelectorAll('p')
  sub.textContent = hint
  if (matchMedia('(pointer: coarse)').matches && !!document.documentElement.requestFullscreen && canLock && !inApp) {
    text.textContent = '화면을 누르면 가로로 바뀌어요'
    sub.textContent = '휴대폰을 가로로 돌려도 돼요'
    let busy = false // 빠르게 두 번 눌러도 요청은 한 번만
    notice.addEventListener('pointerup', () => {
      if (busy) return
      busy = true
      requestLandscape().then((ok) => {
        busy = false
        if (ok) return
        // 실패하면 처음과 다른 문구로, 직접 돌리는 방법을 알려 준다
        text.textContent = '자동으로 바꾸지 못했어요. 휴대폰을 가로로 돌려 주세요'
        sub.textContent = hint
      })
    })
  }
  const fit = () => {
    const vv = window.visualViewport
    const w = vv ? vv.width : window.innerWidth
    const h = vv ? vv.height : window.innerHeight
    const s = Math.min(w / STAGE_W, h / STAGE_H)
    scale = s
    stage.style.transform = `translate(${(w - STAGE_W * s) / 2}px, ${(h - STAGE_H * s) / 2}px) scale(${s})`
    // 휴대폰처럼 무대가 0.6배보다 작게 줄면 글자와 버튼을 키우는 작은 화면 설정을 켠다(play.css 의 .compact)
    document.documentElement.classList.toggle('compact', s < 0.6)
    watchers.forEach((fn) => fn())
    const portrait = h > w
    notice.hidden = !portrait
    onPortrait(portrait)
  }
  new ResizeObserver(fit).observe(document.documentElement)
  window.visualViewport?.addEventListener('resize', fit)
  window.addEventListener('orientationchange', fit)
  fit()
  // 화면이 16:9 보다 넓으면 남는 양옆에 맨 위 장면의 배경 그림을 흐리게 깐다(style.css 의 #viewport::before).
  // 일시정지나 설정 창은 장면 위에 붙으므로 창이 아니라 마지막 장면의 그림을 쓴다
  const viewport = stage.parentElement as HTMLElement
  new MutationObserver(() => {
    const scenes = stage.querySelectorAll(':scope > .scene')
    const bg = scenes[scenes.length - 1]?.querySelector<HTMLImageElement>(':scope > img.bg')
    viewport.style.setProperty('--side-bg', bg ? `url("${bg.src}")` : 'none')
  }).observe(stage, { childList: true })
}
