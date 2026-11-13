// --- 1920x1080 고정 무대를 화면에 맞춰 늘리고 줄인다. 세로 화면이면 안내를 띄운다 ---
export const STAGE_W = 1920
export const STAGE_H = 1080

export function setupStage(stage: HTMLElement, notice: HTMLElement, onPortrait: (portrait: boolean) => void): void {
  const fit = () => {
    const vv = window.visualViewport
    const w = vv ? vv.width : window.innerWidth
    const h = vv ? vv.height : window.innerHeight
    const s = Math.min(w / STAGE_W, h / STAGE_H)
    stage.style.transform = `translate(${(w - STAGE_W * s) / 2}px, ${(h - STAGE_H * s) / 2}px) scale(${s})`
    // 휴대폰처럼 무대가 0.6배보다 작게 줄면 글자와 버튼을 키우는 작은 화면 설정을 켠다(play.css 의 .compact)
    document.documentElement.classList.toggle('compact', s < 0.6)
    const portrait = h > w
    notice.hidden = !portrait
    onPortrait(portrait)
  }
  new ResizeObserver(fit).observe(document.documentElement)
  window.visualViewport?.addEventListener('resize', fit)
  window.addEventListener('orientationchange', fit)
  fit()
}
