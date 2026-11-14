// --- 환경 설정 창. 타이틀과 일시정지 양쪽에서 연다. 값은 바로 적용하고 저장한다 ---
import { audio } from './audio'
import { load, save } from './storage'
import { overlay, resetDex } from './dex'

export const prefs = {
  get easy(): boolean {
    return load('easy') === '1'
  },
  set easy(v: boolean) {
    save('easy', v ? '1' : '0')
  },
  get tutorialSeen(): boolean {
    return load('tut') === '1'
  },
  set tutorialSeen(v: boolean) {
    save('tut', v ? '1' : '0')
  },
}

function h(html: string): HTMLElement {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild as HTMLElement
}

const VOLS = [
  ['master', '전체 음량'],
  ['bgm', '배경음'],
  ['sfx', '효과음'],
] as const

export function showSettings(root: HTMLElement, opt: { inGame?: boolean; onClose?: () => void } = {}): void {
  const v = audio.volume
  const rows = VOLS.map(([k, name]) => `<label class="set-row"><span>${name}</span>
      <input type="range" min="0" max="100" step="5" value="${Math.round(v[k] * 100)}" data-vol="${k}" aria-label="${name}" />
      <output>${Math.round(v[k] * 100)}</output></label>`).join('')
  const canFull = !!document.documentElement.requestFullscreen
  const el = overlay(root, '환경 설정', `<div class="sheet-body">
      ${rows}
      <div class="set-line"></div>
      <div class="set-row two"><span>여유 모드</span><div><button class="switch" data-act="easy" aria-pressed="${prefs.easy}" aria-label="여유 모드"></button>
        <p class="hint">${opt.inGame ? '다음 판부터 적용돼요' : '하루 시간이 넉넉해지고 하트가 늘어요'}</p></div></div>
      ${canFull ? `<div class="set-row two"><span>전체 화면</span><button class="switch" data-act="full" aria-pressed="${!!document.fullscreenElement}" aria-label="전체 화면"></button></div>` : ''}
      <div class="set-line"></div>
      <div class="set-btns">
        ${opt.inGame ? '' : '<button class="btn paper s" data-act="tut">튜토리얼 다시 보기</button>'}
        <button class="btn red s" data-act="reset">기록 지우기</button>
      </div>
    </div>`, 'settings', opt.onClose)
  el.querySelectorAll<HTMLInputElement>('input[data-vol]').forEach((inp) => {
    const out = inp.nextElementSibling as HTMLOutputElement
    const paint = () => inp.style.setProperty('--val', `${inp.value}%`)
    paint()
    inp.oninput = () => {
      audio.setVolume(inp.dataset.vol as 'master' | 'bgm' | 'sfx', Number(inp.value) / 100)
      out.textContent = inp.value
      paint()
    }
    // 손을 떼면 효과음으로 크기를 들려 준다
    inp.onchange = () => audio.play('click')
  })
  const easy = el.querySelector('[data-act="easy"]') as HTMLButtonElement
  easy.onclick = () => {
    prefs.easy = !prefs.easy
    easy.setAttribute('aria-pressed', String(prefs.easy))
    audio.play('toggle')
  }
  const full = el.querySelector('[data-act="full"]') as HTMLButtonElement | null
  if (full) {
    full.onclick = async () => {
      audio.play('toggle')
      try {
        if (document.fullscreenElement) await document.exitFullscreen()
        else await document.documentElement.requestFullscreen()
      } catch {
        // 브라우저가 막으면 그대로 둔다
      }
      full.setAttribute('aria-pressed', String(!!document.fullscreenElement))
    }
  }
  const tut = el.querySelector('[data-act="tut"]') as HTMLButtonElement | null
  if (tut) {
    tut.onclick = () => {
      prefs.tutorialSeen = false
      tut.textContent = '다음 시작 때 다시 보여요'
      tut.disabled = true
      audio.play('click')
    }
  }
  ;(el.querySelector('[data-act="reset"]') as HTMLButtonElement).onclick = () => {
    audio.play('click')
    const c = h(`<div class="overlay confirm"><div class="panel sheet">
      <div class="plate"><h2>기록 지우기</h2></div>
      <div class="sheet-paper"><div class="sheet-body"><p>규칙 수첩에 모은 쪽과 튜토리얼 기록을 모두 지울까요? 지운 기록은 되돌릴 수 없어요.</p></div>
      <div class="sheet-foot"><button class="btn paper" data-act="no">그만두기</button><button class="btn red" data-act="yes">지우기</button></div></div>
    </div></div>`)
    audio.play('open')
    ;(c.querySelector('[data-act="no"]') as HTMLButtonElement).onclick = () => (audio.play('back'), c.remove())
    ;(c.querySelector('[data-act="yes"]') as HTMLButtonElement).onclick = () => {
      resetDex()
      prefs.tutorialSeen = false
      audio.play('click')
      c.remove()
    }
    el.append(c)
  }
}
