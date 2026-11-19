# 배경 두 장(타이틀, 심사 화면)을 게임 크기 webp 로 만든다. 원본(assets_src/gen/redesign, 1536x1024)의 고른 색 위에
# AI 4K 확대본(assets_src/gen/upscale, Higgsfield 의 ByteDance 확대)의 가장자리만 얹는다.
# 확대본만 쓰면 넓은 벽에 옅은 얼룩이 생겨서, 가우스 흐림(SIGMA)보다 잘게 바뀌는 부분만 확대본에서 가져온다.
# 1920x1280 으로 맞춘 뒤 위 100px 부터 1080줄을 잘라 game/public/assets/img 에 쓴다
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SIGMA = 2.5


def blur(a):
    return np.asarray(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(SIGMA)), float)


def load(*path):
    return np.asarray(Image.open(os.path.join(ROOT, 'assets_src', 'gen', *path)).convert('RGB').resize((1920, 1280), Image.LANCZOS), float)


for src, out in [('title_a', 'bg_title'), ('play_a', 'bg_game')]:
    base, ai = load('redesign', f'{src}.png'), load('upscale', f'{src}_4k.png')
    mix = blur(base) + (ai - blur(ai))
    im = Image.fromarray(np.clip(mix + 0.5, 0, 255).astype(np.uint8)).crop((0, 100, 1920, 1180))
    im.save(os.path.join(ROOT, 'game', 'public', 'assets', 'img', f'{out}.webp'), 'WEBP', quality=86, method=6)
    print(out, im.size)
