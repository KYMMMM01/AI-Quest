# stamp_x.py 의 회색 찰흙 렌더에 색을 입힌다. 초록 고리 도장의 밝기(L*) 범위와 밝기별 채도를 그대로 옮기고 색상(hue)만 바꾼다
# 사용: python pipeline/stamp_recolor.py <회색 렌더.png> <색: ring|red|#rrggbb> <출력 png 또는 webp> [크기]
# 게임에 넣은 것: x.png red game/public/assets/img/stamp_wrong.webp (red 는 게임 빨강 #e5475b 의 색상)
import sys
import numpy as np
from PIL import Image

RING = 'C:/Project/AI-Quest/game/public/assets/img/stamp_pass.webp'


def srgb_to_lab(c):
    c = c / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab_to_srgb(lab):
    fy = (lab[..., 0] + 16) / 116
    fx, fz = fy + lab[..., 1] / 500, fy - lab[..., 2] / 200
    f = np.stack([fx, fy, fz], -1)
    xyz = np.where(f ** 3 > 216 / 24389, f ** 3, (116 * f - 16) / (24389 / 27)) * np.array([0.95047, 1.0, 1.08883])
    m = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])
    c = np.clip(xyz @ m.T, 0, 1)
    c = np.where(c > 0.0031308, 1.055 * c ** (1 / 2.4) - 0.055, 12.92 * c)
    return np.clip(c * 255 + 0.5, 0, 255)


ring = np.array(Image.open(RING).convert('RGBA')).astype(float)
rl = srgb_to_lab(ring[..., :3][ring[..., 3] > 200])
order = np.argsort(rl[:, 0])
ringL = rl[order, 0]
ringC = np.hypot(rl[order, 1], rl[order, 2])
ringH = np.degrees(np.arctan2(rl[:, 2], rl[:, 1])).mean()

src, color, out = sys.argv[1], sys.argv[2], sys.argv[3]
size = int(sys.argv[4]) if len(sys.argv) > 4 else 207
im = np.array(Image.open(src).convert('RGBA')).astype(float)
a = im[..., 3]
g = im[..., :3] @ [0.299, 0.587, 0.114]
m = a > 0
# 회색 렌더의 밝기 범위(2%에서 98%)를 고리 그림의 같은 범위로 곧게 옮긴다(부드러운 명암이 그대로 남는다)
g2, g98 = np.percentile(g[a > 200], [2, 98])
r2, r98 = np.percentile(ringL, [2, 98])
L = np.clip(r2 + (g[m] - g2) / (g98 - g2) * (r98 - r2), ringL[0], ringL[-1])
# 밝기별 채도는 고리 그림에서 가까운 밝기의 평균을 쓴다
bins = np.linspace(ringL[0], ringL[-1], 24)
idx = np.clip(np.digitize(ringL, bins) - 1, 0, 22)
cb = np.array([ringC[idx == k].mean() if (idx == k).any() else np.nan for k in range(23)])
ok = ~np.isnan(cb)
C = np.interp(L, (bins[:-1] + bins[1:])[ok] / 2, cb[ok])
if color == 'ring':
    H = ringH
else:
    hx = color if color.startswith('#') else '#e5475b'
    t = srgb_to_lab(np.array([[int(hx[i:i + 2], 16) for i in (1, 3, 5)]], float))[0]
    H = np.degrees(np.arctan2(t[2], t[1]))
lab = np.stack([L, C * np.cos(np.radians(H)), C * np.sin(np.radians(H))], -1)
rgb = np.zeros_like(im[..., :3])
rgb[m] = lab_to_srgb(lab)
# 렌더 화면은 고리 그림과 같은 207 단위라 자르지 않고 크기만 줄인다
res = Image.fromarray(np.dstack([rgb, a]).astype(np.uint8), 'RGBA').resize((size, size), Image.LANCZOS)
res.save(out, quality=90, method=6)
print(out, res.size, 'hue', round(H, 1), 'ringH', round(ringH, 1))
