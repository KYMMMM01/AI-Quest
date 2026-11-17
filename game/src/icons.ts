// --- 화면에 쓰는 단순 아이콘(SVG). 글자 없이 모양만 쓴다 ---
const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

export const ICON = {
  soundOn: svg('<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>'),
  soundOff: svg('<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  pause: svg('<path d="M8 5v14M16 5v14" stroke-width="4"/>'),
  play: svg('<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>'),
  home: svg('<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h12V9.5" fill="currentColor"/>'),
  gear: svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  help: svg('<circle cx="12" cy="12" r="9.5"/><path d="M9.3 9.3a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2 1-1.2 1.9v.6" stroke-width="2.8"/><circle cx="12" cy="17.4" r="1.5" fill="currentColor" stroke="none"/>'),
  lens: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21" stroke-width="3.4"/>'),
  left: svg('<path d="M15 4 7 12l8 8" stroke-width="3.6"/>'),
  right: svg('<path d="M9 4l8 8-8 8" stroke-width="3.6"/>'),
  check: svg('<path d="M4.5 12.5 9.5 17.5 19.5 6.5" stroke-width="3.6"/>'),
  full: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'),
  book: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" fill="currentColor"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" stroke-width="2"/>'),
  info: svg('<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6" stroke-width="3"/><circle cx="12" cy="7.3" r="1.6" fill="currentColor" stroke="none"/>'),
  star:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5L2.6 9.4l6.5-.8z" fill="currentColor" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  heart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.3C1 8.4 3 4.5 6.9 4.5c2.2 0 3.7 1.2 5.1 3 1.4-1.8 2.9-3 5.1-3 3.9 0 5.9 3.9 4.5 7.2C19.5 16.4 12 21 12 21z" fill="currentColor"/></svg>',
}
