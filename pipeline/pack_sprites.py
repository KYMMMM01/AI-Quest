# 동작 프레임(assets_src/rig/clips/<동작>/*.png)을 캐릭터별 공통 범위로 잘라 띠 그림(webp)과 sprite-data.ts 로 묶는다
import glob, os, json
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CLIPS = os.path.join(ROOT, 'assets_src', 'rig', 'clips')
OUT = os.path.join(ROOT, 'game', 'public', 'assets', 'sprite')
TS = os.path.join(ROOT, 'game', 'src', 'sprite-data.ts')
META = {'narumi_idle': (15, True), 'narumi_stamp': (30, False), 'narumi_happy': (30, False), 'narumi_no': (30, False),
        'dari_idle': (15, True), 'dari_run': (30, True), 'dari_happy': (30, False), 'dari_sad': (30, False), 'dari_cheer': (30, False)}

os.makedirs(OUT, exist_ok=True)
info = {}
for ch in ['narumi', 'dari']:
    clips = [c for c in META if c.startswith(ch)]
    frames = {c: [Image.open(f).convert('RGBA') for f in sorted(glob.glob(os.path.join(CLIPS, c, '*.png')))] for c in clips}
    box = None
    for c in clips:
        for im in frames[c]:
            b = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    box = (max(0, box[0] - 4), max(0, box[1] - 4), box[2] + 4, box[3] + 4)
    w, h = box[2] - box[0], box[3] - box[1]
    for c in clips:
        fs = frames[c]
        strip = Image.new('RGBA', (w * len(fs), h))
        for i, im in enumerate(fs):
            strip.paste(im.crop(box), (i * w, 0))
        strip.save(os.path.join(OUT, f'{c}.webp'), 'WEBP', quality=88, method=6)
        fps, loop = META[c]
        info[c] = dict(src=f'assets/sprite/{c}.webp', w=w, h=h, n=len(fs), fps=fps, loop=loop)
        print(c, len(fs), w, h)
open(TS, 'w', encoding='utf-8').write('// --- 캐릭터 동작 스프라이트(Blender 렌더, 생성 스크립트가 쓴 파일) ---\nexport const SPRITES = ' + json.dumps(info, ensure_ascii=False, indent=1) + ' as const\n')
