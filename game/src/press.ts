// --- 터치 두드리기 보정. 손가락 끌기를 한 뒤에는 브라우저가 다음 두드리기의 클릭을 만들지 않는 일이 있어
// 손가락이나 펜으로 같은 버튼을 누르고 뗐으면 직접 click() 을 부르고, 뒤따라오는 진짜 클릭은 한 번 막는다 ---
let downBtn: HTMLButtonElement | null = null
let suppress: { btn: HTMLButtonElement; t: number } | null = null

const buttonOf = (t: EventTarget | null) => (t instanceof Element ? (t.closest('button') as HTMLButtonElement | null) : null)

export function installTouchPress(): void {
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'mouse') downBtn = buttonOf(e.target)
    },
    true,
  )
  document.addEventListener(
    'pointerup',
    (e) => {
      if (e.pointerType === 'mouse') return
      const b = buttonOf(e.target)
      if (b && b === downBtn && !b.disabled) {
        suppress = { btn: b, t: performance.now() }
        b.click()
      }
      downBtn = null
    },
    true,
  )
  document.addEventListener(
    'click',
    (e) => {
      if (!suppress || !e.isTrusted) return
      if (performance.now() - suppress.t < 700 && buttonOf(e.target) === suppress.btn) {
        e.stopImmediatePropagation()
        e.preventDefault()
      }
      suppress = null
    },
    true,
  )
}
