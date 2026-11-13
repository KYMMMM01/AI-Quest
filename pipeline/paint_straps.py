# dari_bag.glb의 빨간 어깨끈을 백팩과 같은 갈색으로. 테두리 번짐은 빨강 비율만큼 섞어 부드럽게 남긴다
import sys, io
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import glbio

W = r'C:/Project/AI-Quest/assets_src/tripo/work/v1/'
GLB = r'C:/Project/AI-Quest/assets_src/tripo/dari_bag.glb'
ORANGE = np.array([252, 152, 0], float)
RED = np.array([147, 42, 4], float)      # 지금 끈 색(꼭짓점 색 중앙값)
BROWN = np.array([118, 58, 30], float)   # 백팩과 같은 갈색

m = np.load(W + 'mesh.npz'); P, UV, I, C = m['P'], m['UV'], m['I'], m['C'].astype(int)
# 끈 꼭짓점: 몸통 높이의 어두운 빨강(머리 줄무늬는 높이로 뺀다)
strap = (P[:, 1] > 0.15) & (P[:, 1] < 0.5) & (C[:, 0] > 90) & (C[:, 0] < 215) & (C[:, 1] < 85) & (C[:, 2] < 60) & (C[:, 0] - C[:, 1] > 60)
print('strap verts', strap.sum(), 'y', P[strap, 1].min().round(3), P[strap, 1].max().round(3))
faces = I[strap[I].any(1)]

j, b = glbio.load(GLB)
tex = np.asarray(glbio.image(j, b, 'basecolor')[0].convert('RGB')).astype(float)
H, Wd = tex.shape[:2]
im = Image.new('L', (Wd, H), 0); dr = ImageDraw.Draw(im)
for t in UV[faces] * [Wd, H]:
    dr.polygon([tuple(p) for p in t], fill=255)
area = ndimage.binary_dilation(np.asarray(im) > 0, iterations=2)

# 주황에서 빨강으로 가는 선 위의 위치(t)를 구해, 빨간 만큼만 갈색으로 바꾼다
px = tex[area]; d = RED - ORANGE
t = np.clip(((px - ORANGE) @ d) / (d @ d), 0, 1)
off = np.linalg.norm(px - (ORANGE + t[:, None] * d), axis=1)   # 선에서 먼 색(흰색, 갈색 백팩 등)은 건드리지 않는다
t[off > 60] = 0
px_new = px + t[:, None] * (BROWN - RED)
tex[area] = np.clip(px_new, 0, 255)
print('changed pixels', int((t > 0.05).sum()))

out = tex.astype(np.uint8)
Image.fromarray(out).save(W + 'basecolor_bag_straps.png')
buf = io.BytesIO(); Image.fromarray(out).save(buf, 'JPEG', quality=95)
glbio.save_with_image(j, b, 'basecolor', buf.getvalue(), GLB)
print('saved', GLB)
