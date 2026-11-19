# 동작 프레임(assets_src/rig/clips2x/<동작>/*.png)을 반으로 줄이고 캐릭터별 공통 범위로 잘라 띠 그림(webp)과 sprite-data.ts 로 묶는다
# 프레임은 2배 크기로 렌더한다(anim_clips.py 의 px 를 나르미 1360, 달이 768). 반으로 줄이면 1배로 렌더한 것보다 가장자리가 또렷하다.
# 2배 칸을 그대로 쓰면 그림 메모리가 4배라 동작이 바뀔 때 화면이 멈칫한다(RTX 5070 에서 최대 0.13초). 렌더 프레임은 약 120MB 라 git 에 올리지 않는다
import glob, os, json
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CLIPS = os.path.join(ROOT, 'assets_src', 'rig', 'clips2x')
OUT = os.path.join(ROOT, 'game', 'public', 'assets', 'sprite')
TS = os.path.join(ROOT, 'game', 'src', 'sprite-data.ts')
META = {'narumi_idle': (15, True), 'narumi_stamp': (30, False), 'narumi_happy': (30, False), 'narumi_no': (30, False),
        'dari_idle': (15, True), 'dari_run': (30, True), 'dari_happy': (30, False), 'dari_sad': (30, False), 'dari_cheer': (30, False)}
# 발이 바닥(그림자)에 붙어 있어야 하는 동작. 렌더에서는 엉덩이 뼈와 함께 발도 오르내리므로,
# 칸마다 맨 아래 불투명 줄이 첫 칸(쉬는 자세)과 같아지도록 옮길 양(칸 픽셀, + 는 아래로)을 foot 으로 적는다(sprite.ts 가 적용)
PLANT = {'narumi_idle', 'dari_idle', 'dari_sad'}


def bottom(im):
    return im.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox()[3]


def half(im):
    return im.resize((im.width // 2, im.height // 2), Image.LANCZOS)

os.makedirs(OUT, exist_ok=True)
info = {}
for ch in ['narumi', 'dari']:
    clips = [c for c in META if c.startswith(ch)]
    frames = {c: [half(Image.open(f).convert('RGBA')) for f in sorted(glob.glob(os.path.join(CLIPS, c, '*.png')))] for c in clips}
    assert all(frames.values()), f'{CLIPS} 에 {ch} 프레임이 없다. anim_clips.py 로 먼저 렌더한다'
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
        if c in PLANT:
            bs = [bottom(im.crop(box)) for im in fs]
            info[c]['foot'] = [bs[0] - b for b in bs]
        print(c, len(fs), w, h, info[c].get('foot', ''))
open(TS, 'w', encoding='utf-8').write('// --- 캐릭터 동작 스프라이트(Blender 렌더, 생성 스크립트가 쓴 파일) ---\nexport const SPRITES = ' + json.dumps(info, ensure_ascii=False, indent=1) + ' as const\n')
