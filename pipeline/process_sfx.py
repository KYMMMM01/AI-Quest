# 효과음 정리: 생성 효과음은 앞 무음 자르기, 음량 맞추기, 끝 페이드. 실패한 것은 합성한다.
# 결과: assets_src/sfx/final/*.wav(검수용)와 game/src/sfx-data.ts(base64 mp3, file:// 에서도 재생)
import subprocess, sys, os, base64, io, wave
import numpy as np

FF = r'C:/Users/User/AppData/Roaming/Python/Python313/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v9.0.2.exe'
SRC = r'C:/Project/AI-Quest/assets_src/sfx/'
OUT = SRC + 'final/'
TS = r'C:/Project/AI-Quest/game/src/sfx-data.ts'
SR = 44100
os.makedirs(OUT, exist_ok=True)

def load(f):
    raw = subprocess.run([FF, '-v', 'quiet', '-i', SRC + f, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()

def tidy(x, start_db=-40, max_len=None, peak_db=-3.0, fade=0.04):
    thr = 10 ** (start_db / 20) * np.abs(x).max()
    i = np.argmax(np.abs(x) > thr); x = x[max(0, i - int(0.003 * SR)):]
    if max_len: x = x[:int(max_len * SR)]
    # 끝부분 무음 자르기
    nz = np.where(np.abs(x) > 10 ** (-50 / 20) * np.abs(x).max())[0]; x = x[:nz[-1] + 1]
    f = min(len(x), int(fade * SR)); x[-f:] *= np.linspace(1, 0, f) ** 2
    return x / np.abs(x).max() * 10 ** (peak_db / 20)

def tone(freq, dur, decay=8.0, harm=((1, 1.0), (2, 0.35), (3, 0.12)), attack=0.004):
    t = np.arange(int(dur * SR)) / SR
    y = sum(a * np.sin(2 * np.pi * freq * h * t) for h, a in harm)
    env = np.minimum(t / attack, 1) * np.exp(-decay * t)
    return y * env

def seq(notes, gap):
    total = int((gap * (len(notes) - 1) + max(d for _, d in notes)) * SR) + 1
    y = np.zeros(total)
    for k, (f, d) in enumerate(notes):
        s = tone(f, d); o = int(k * gap * SR); y[o:o + len(s)] += s
    return y

sounds = {}
# 생성 효과음 중 쓸 만한 것
sounds['stamp'] = tidy(load('stamp.mp3'), max_len=0.6, peak_db=-1.5)
sounds['scan'] = tidy(load('scan.mp3'), max_len=1.2, peak_db=-6, fade=0.15)
sounds['click'] = tidy(load('click.mp3'), max_len=0.12, peak_db=-6, fade=0.02)
sounds['combo'] = tidy(load('combo.mp3'), max_len=0.45, peak_db=-5, fade=0.12)
sounds['fanfare'] = tidy(load('fanfare.mp3'), max_len=2.0, peak_db=-3, fade=0.4)
# 합성: 정답(두 음 올라감, 마림바 느낌), 오답(부드럽게 두 음 내려감), 카드 넘김(걸러진 잡음 휙)
sounds['correct'] = tidy(seq([(1046.5, 0.35), (1568.0, 0.5)], 0.09), peak_db=-5)
low = lambda f, d: tone(f, d, decay=6, harm=((1, 1.0), (2, 0.2)))
w = np.zeros(int(0.5 * SR)); a = low(392.0, 0.25); b = low(311.1, 0.35); w[:len(a)] += a; o = int(0.14 * SR); w[o:o + len(b)] += b
sounds['wrong'] = tidy(w, peak_db=-7)
n = int(0.22 * SR); t = np.arange(n) / SR
noise = np.random.default_rng(7).standard_normal(n)
# 저역 통과 필터의 차단 주파수를 올렸다 내리며 휙 소리를 만든다
cut = 800 + 5000 * np.sin(np.pi * t / t[-1]) ** 2; y = np.zeros(n); s = 0.0
for k in range(n):
    alpha = 1 - np.exp(-2 * np.pi * cut[k] / SR); s += alpha * (noise[k] - s); y[k] = s
y *= np.sin(np.pi * t / t[-1]) ** 1.5
sounds['swipe'] = tidy(y, peak_db=-9, fade=0.03)

lines = ['// --- 효과음(base64 mp3). 생성: Higgsfield Mirelo(도장, 스캔, 버튼, 연속 정답, 팡파르), 코드 합성(정답, 오답, 카드 넘김) ---',
         'export const SFX_DATA: Record<string, string> = {']
for name, x in sounds.items():
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    with wave.open(OUT + name + '.wav', 'wb') as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR); wf.writeframes(pcm)
    mp3 = subprocess.run([FF, '-v', 'quiet', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-b:a', '96k', '-f', 'mp3', '-'],
                         input=pcm, capture_output=True).stdout
    lines.append(f"  {name}: '{base64.b64encode(mp3).decode()}',")
    print(f'{name:8s} {len(x)/SR:5.2f}s  mp3 {len(mp3)//1024} KB')
lines.append('}')
open(TS, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print('wrote', TS, os.path.getsize(TS) // 1024, 'KB')
