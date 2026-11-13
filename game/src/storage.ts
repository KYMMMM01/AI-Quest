// --- localStorage 는 file:// 나 사생활 보호 모드에서 막힐 수 있다. 실패하면 이번 실행 동안 메모리에만 기억한다 ---
const memory = new Map<string, string>()

export function load(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return memory.get(key) ?? null
  }
}

export function save(key: string, value: string): void {
  memory.set(key, value)
  try {
    localStorage.setItem(key, value)
  } catch {
    // 메모리 값만 쓴다
  }
}
