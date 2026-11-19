# 틀렸을 때 찍는 가위표 도장(stamp_wrong.webp)의 회색 찰흙 렌더. 색은 stamp_recolor.py 가 초록 고리 도장의 밝기에 맞춰 입힌다
# 사용: blender -b --python pipeline/stamp_x.py -- <out_png> <ring|x> <관 반지름> <빛 세기> <빛 x y z> <주변광> <해상도> <샘플>
# 게임에 넣은 것: -- x.png x 21 2000000 120 1000 800 0.25 620 64 (줄 굵기가 게임 속 약 36px, 지난번 평면 가위표 42px 보다 조금 얇게)
# 빛 자리는 같은 설정의 고리(ring 13)를 원래 고리 그림과 대조해 단면 밝기 차이가 가장 작은 곳으로 골랐다
import bpy, sys
argv = sys.argv[sys.argv.index('--') + 1:]
out, shape, r, energy = argv[0], argv[1], float(argv[2]), float(argv[3])
lx, ly, lz = (float(v) for v in argv[4:7])
amb, res, spp = float(argv[7]), int(argv[8]), int(argv[9])

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = spp
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = res
sc.view_settings.view_transform = 'Standard'

mat = bpy.data.materials.new('clay')
mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.5, 0.5, 0.5, 1)
bsdf.inputs['Roughness'].default_value = 0.65
bsdf.inputs['Specular IOR Level'].default_value = 0.2

# 단위는 고리 그림 픽셀: 바깥 지름 196, 관 두께 26
if shape == 'ring':
    bpy.ops.mesh.primitive_torus_add(major_radius=85, minor_radius=r, major_segments=160, minor_segments=48)
    ob = bpy.context.object
    bpy.ops.object.shade_smooth()
else:
    # 가운데에서 네 끝으로 뻗은 뼈대 선에 Skin 으로 굵기를 입히고 Subdivision 으로 둥글린다(끝도 둥글게 닫힌다).
    # 팔마다 마디를 N 개 둔다. 마디 없이 한 선으로 두면 Subdivision 이 가운데를 혹처럼 부풀린다
    L, N = 80.6, 6
    verts, edges = [(0, 0, 0)], []
    for sx, sy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
        prev = 0
        for k in range(1, N + 1):
            verts.append((sx * L * k / N, sy * L * k / N, 0))
            edges.append((prev, len(verts) - 1))
            prev = len(verts) - 1
    me = bpy.data.meshes.new('x')
    me.from_pydata(verts, edges, [])
    ob = bpy.data.objects.new('x', me)
    sc.collection.objects.link(ob)
    ob.modifiers.new('skin', 'SKIN')
    for v in me.skin_vertices[0].data:
        v.radius = (r, r)
    sub = ob.modifiers.new('sub', 'SUBSURF')
    sub.levels = sub.render_levels = 3
    for p in me.polygons:
        p.use_smooth = True
    ob.modifiers['skin'].use_smooth_shade = True
ob.data.materials.append(mat)

cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 207
cam = bpy.data.objects.new('cam', cam_data)
cam.location = (0, 0, 400)
sc.collection.objects.link(cam)
sc.camera = cam

ld = bpy.data.lights.new('key', 'AREA')
ld.size = 300
ld.energy = energy
key = bpy.data.objects.new('key', ld)
key.location = (lx, ly, lz)
sc.collection.objects.link(key)
tr = key.constraints.new('TRACK_TO')
tr.target = ob
tr.track_axis = 'TRACK_NEGATIVE_Z'
tr.up_axis = 'UP_Y'

w = bpy.data.worlds.new('w')
w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = amb
sc.world = w

sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('saved', out)
