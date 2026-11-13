# 생성 그림을 게임용으로 자르고 정리한다(원본은 건드리지 않는다)
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = r"C:\Project\AI-Quest\assets_src"
OUT = r"C:\Project\AI-Quest\game\public\assets\img"
os.makedirs(OUT, exist_ok=True)
made = []

def save(im, name, max_w=None, max_h=None):
    if max_w or max_h:
        im = im.copy()
        im.thumbnail((max_w or 10**5, max_h or 10**5), Image.LANCZOS)
    path = os.path.join(OUT, name + ".webp")
    im.save(path, "WEBP", quality=86, method=6)
    made.append((name, im.size, os.path.getsize(path) // 1024))

def split_pair(path, top=0, bottom=None):
    im = Image.open(path).convert("RGB")
    if bottom is None:
        bottom = im.height
    im = im.crop((0, top, im.width, bottom))
    g = np.array(im.convert("L")).astype(int)
    w = im.width
    # 가운데 근처에서 거의 흰 세로 띠를 찾는다
    cols = [x for x in range(int(w * 0.4), int(w * 0.6)) if (g[:, x] > 235).mean() > 0.97]
    l, r = (min(cols), max(cols)) if cols else (w // 2, w // 2)
    return im.crop((0, 0, l, im.height)), im.crop((r + 1, 0, w, im.height))

def clean_alpha(im):
    a = np.array(im.convert("RGBA"))
    al = a[:, :, 3].astype(int)
    al[al < 24] = 0
    al[al >= 200] = 255
    # 작은 점 얼룩 제거
    lab, n = ndimage.label(al > 0)
    sizes = ndimage.sum(np.ones_like(al), lab, range(1, n + 1))
    for i, s in enumerate(sizes, 1):
        if s < 400:
            al[lab == i] = 0
    a[:, :, 3] = al
    a[al == 0, :3] = 0
    return Image.fromarray(a, "RGBA"), lab

def cut_grid(path, cols, rows, names, max_px):
    im, _ = clean_alpha(Image.open(path))
    a = np.array(im)[:, :, 3]
    lab, n = ndimage.label(a > 0)
    objs = ndimage.find_objects(lab)
    cw, ch = im.width / cols, im.height / rows
    cells = {}
    for i, sl in enumerate(objs, 1):
        if sl is None:
            continue
        ys, xs = sl
        cy, cx = (ys.start + ys.stop) / 2, (xs.start + xs.stop) / 2
        key = (int(cy // ch), int(cx // cw))
        cells.setdefault(key, []).append((ys.start, xs.start, ys.stop, xs.stop))
    for idx, name in enumerate(names):
        key = (idx // cols, idx % cols)
        boxes = cells.get(key)
        if not boxes:
            print("MISSING", name, key)
            continue
        y0 = min(b[0] for b in boxes); x0 = min(b[1] for b in boxes)
        y1 = max(b[2] for b in boxes); x1 = max(b[3] for b in boxes)
        pad = 6
        c = im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))
        # 칸마다 따로 맞추면 큰 책상과 작은 책상 크기 차이가 사라지므로 격자 전체에 같은 배율을 쓴다
        k = max_px / max(cw, ch)
        c = c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.LANCZOS)
        save(c, name)

# --- 짝 사진 ---
pairs = [
    ("style_test/style_test_office_pair.png", "office_a_ok", "office_a_empty", 113, 954),
    ("gen/office_pair_b.png", "office_b_ok", "office_b_empty", 0, None),
    ("gen/office_pair_c.png", "office_c_ok", "office_c_empty", 0, None),
    ("gen/delivery_pair.png", "delivery_school", "delivery_health", 0, None),
    ("gen/site_pair_a.png", "site_a_safe", "site_a_unsafe", 0, None),
    ("gen/site_pair_b.png", "site_b_safe", "site_b_unsafe", 0, None),
    ("gen/site_pair_c.png", "site_c_safe", "site_c_unsafe", 0, None),
]
for f, ln, rn, top, bottom in pairs:
    l, r = split_pair(os.path.join(SRC, f), top, bottom)
    save(l, ln, 600); save(r, rn, 600)

save(Image.open(os.path.join(SRC, "gen/office_single_d.png")).convert("RGB"), "office_d_ok", 600)
for n in ["bg_game", "bg_title", "ladder"]:
    save(Image.open(os.path.join(SRC, f"gen/{n}.png")).convert("RGB"), n)

# --- 격자 ---
cut_grid(os.path.join(SRC, "gen/agencies.png"), 2, 2, ["agency_school", "agency_fire", "agency_health", "agency_district"], 384)
cut_grid(os.path.join(SRC, "gen/icons_items.png"), 4, 3,
         ["item_ext_ok", "item_ext_nosticker", "item_chair_blue", "item_chair_pink", "item_desk_big", "item_desk_small",
          "item_firstaid", "item_laptop", "item_purifier", "item_solarlamp", "item_thermometer", "item_bookshelf"], 256)
cut_grid(os.path.join(SRC, "gen/icons_marks.png"), 3, 3,
         ["build_library", "build_playground", "build_bridge", "mark_innovation", "mark_green", "mark_safety",
          "stamp_pass", "stamp_check", "tray_investigate"], 256)
if "--logos" in sys.argv:
    cut_grid(os.path.join(SRC, "gen/logos.png"), 4, 3,
             ["logo_bear", "logo_rabbit", "logo_cat", "logo_dog", "logo_penguin", "logo_fox", "logo_panda", "logo_owl",
              "logo_turtle", "logo_frog", "logo_lion", "logo_hedgehog"], 256)

for m in made:
    print(*m)
print("count", len(made), "total KB", sum(m[2] for m in made))
