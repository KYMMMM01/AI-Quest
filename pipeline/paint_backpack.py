# 처음 달이 모델(dari.glb)의 등 혹을 백팩 갈색으로 칠한다. 모양과 다른 데이터는 그대로 둔다
import sys, io
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import glbio

W = r'C:/Project/AI-Quest/assets_src/tripo/work/v1/'
SRC = r'C:/Project/AI-Quest/assets_src/tripo/dari.glb'
OUT = r'C:/Project/AI-Quest/assets_src/tripo/dari_bag.glb'
BROWN = np.array([118, 58, 30], float)   # 공식 3D 그림의 끈 색(그늘진 곳과 밝은 곳 사이)

m = np.load(W + 'mesh.npz'); UV, I = m['UV'], m['I']
reg = np.load(W + 'reg_3.npy')            # 등 혹 꼭짓점(꺾이는 테두리까지)
# 혹 표면에 붙어 있지만 이어지지 않은 작은 면(흰 점으로 보임)도 포함: 모든 꼭짓점이 혹 표면 2mm 안이면서
# 테두리에서 3mm 이상 안쪽인 꼭짓점
from scipy.spatial import cKDTree
P = m['P']
near = cKDTree(P[reg]).query(P, distance_upper_bound=0.002)[0] < 0.002
rim = cKDTree(P[~reg & (P[:, 2] < -0.08)]).query(P, distance_upper_bound=0.003)[0] < 0.003
reg = reg | (near & ~rim)
j, b = glbio.load(SRC)
tex = np.asarray(glbio.image(j, b, 'basecolor')[0].convert('RGB')).astype(float)
H, Wd = tex.shape[:2]

def raster(faces):
    im = Image.new('L', (Wd, H), 0); dr = ImageDraw.Draw(im)
    for t in UV[faces] * [Wd, H]:
        dr.polygon([tuple(p) for p in t], fill=255)
    return np.asarray(im) > 0

paint = raster(I[reg[I].all(1)])
# 테두리에 걸친 면은 칠한 영역 안의 작은 구멍(흰 점)을 메울 때만 쓴다
edge = raster(I[reg[I].any(1) & ~reg[I].all(1)])
paint |= edge & ndimage.binary_closing(paint, iterations=3)
cover = raster(I)
paint |= ndimage.binary_dilation(paint, iterations=2) & ~cover   # 섬 가장자리 바깥 번짐 픽셀까지
# 원래 질감의 밝기 차이를 살짝 남긴다(밋밋하게 붙인 느낌을 줄인다)
L = tex[paint].mean(1); k = np.clip(L / np.median(L), 0.85, 1.12)[:, None]
tex[paint] = np.clip(BROWN * k, 0, 255)
print('painted pixels', paint.sum(), 'faces', reg[I].all(1).sum())

out = tex.astype(np.uint8)
Image.fromarray(out).save(W + 'basecolor_bag.png')
buf = io.BytesIO(); Image.fromarray(out).save(buf, 'JPEG', quality=95)
glbio.save_with_image(j, b, 'basecolor', buf.getvalue(), OUT)
print('saved', OUT)
