// --- 손가락으로 누르는 버튼 처리 ---
// 첫째, 손가락 끌기를 한 뒤에는 브라우저가 다음 두드리기의 클릭을 만들지 않는 일이 있어, 같은 버튼을 누르고 뗐으면 직접 click() 을 부르고
// 뒤따라오는 진짜 클릭은 한 번 막는다.
// 둘째, 휴대폰에서는 무대가 작게 줄고 손가락이 버튼을 가려 눌림이 안 보인다. 누르는 동안 버튼을 크게 눌린 모양(tpress)으로 두고,
// 누른 자리에 동그라미를 퍼뜨린다. 뗀 뒤에는 잠깐 튕겨 오른 모양(trel)을 보여 준 다음 클릭을 보낸다(style.css).
// 튕김을 보여 주는 동안은 게임 시계를 멈춰 판정 시간과 하루 시간이 마우스와 같게 흐르게 한다 ---
import { clock } from './clock'

const downs = new Map<number, HTMLButtonElement>() // 손가락마다 누른 버튼
let suppress: { t: number } | null = null
let pending = false // 튕김을 보여 주는 동안 다른 누름을 받지 않는다(두 번 눌림 방지)

const buttonOf = (t: EventTarget | null) => (t instanceof Element ? (t.closest('button') as HTMLButtonElement | null) : null)

export function installTouchPress(): void {
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse') return
      const b = buttonOf(e.target)
      if (!b || b.disabled) return
      downs.set(e.pointerId, b)
      if (pending) return
      b.classList.add('tpress')
      const ring = document.createElement('div')
      ring.className = 'tap-ring'
      ring.style.left = `${e.clientX}px`
      ring.style.top = `${e.clientY}px`
      document.body.append(ring)
      setTimeout(() => ring.remove(), 450)
    },
    true,
  )
  document.addEventListener(
    'pointerup',
    (e) => {
      if (e.pointerType === 'mouse') return
      const d = downs.get(e.pointerId)
      downs.delete(e.pointerId)
      if (!d) return
      // 손가락은 누른 버튼에 붙잡혀 있어 e.target 은 늘 그 버튼이다. 뗀 자리로 판단해 버튼 밖으로 밀고 떼면 취소한다.
      // 눌린 모양으로 작아진 만큼과 손가락 떨림은 둘레 12px 로 봐준다
      const r = d.getBoundingClientRect()
      const inside = e.clientX >= r.left - 12 && e.clientX <= r.right + 12 && e.clientY >= r.top - 12 && e.clientY <= r.bottom + 12
      suppress = { t: performance.now() } // 취소한 누름도 브라우저가 뒤따라 만드는 진짜 클릭은 막는다
      if (!inside || d.disabled) {
        d.classList.remove('tpress')
        return
      }
      if (pending) {
        // 앞 누름의 튕김을 보여 주는 중이면 이 누름은 버린다(뒤따르는 진짜 클릭도 위에서 막힌다)
        d.classList.remove('tpress')
        return
      }
      pending = true
      clock.pause('press')
      setTimeout(() => {
        d.classList.replace('tpress', 'trel')
        setTimeout(() => {
          d.classList.remove('trel')
          pending = false
          clock.resume('press')
          if (d.isConnected && !d.disabled) d.click()
        }, 120)
      }, 70)
    },
    true,
  )
  document.addEventListener(
    'pointercancel',
    (e) => {
      downs.get(e.pointerId)?.classList.remove('tpress')
      downs.delete(e.pointerId)
    },
    true,
  )
  document.addEventListener(
    'click',
    (e) => {
      if (!suppress || !e.isTrusted) return
      // 같은 버튼만이 아니라, 누름으로 새로 열린 창의 다른 요소에 떨어지는 뒤늦은 클릭도 막는다
      if (performance.now() - suppress.t < 700) {
        e.stopImmediatePropagation()
        e.preventDefault()
      }
      suppress = null
    },
    true,
  )
}
