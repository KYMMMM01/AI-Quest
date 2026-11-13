# Blender 배경 실행: GLB를 불러와 여러 각도로 렌더해 검수용 사진을 만든다
# 사용: blender -b --factory-startup --python render_check.py -- <glb> <out_prefix>
import bpy, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
glb, out = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
mode = argv[2] if len(argv) > 2 else 'full'
if mode in ('clay', 'nonormal'):
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        nt = mat.node_tree
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        for link in list(bsdf.inputs['Normal'].links):
            nt.links.remove(link)             # 노멀 맵을 끊는다
        if mode == 'clay':
            for link in list(bsdf.inputs['Base Color'].links):
                nt.links.remove(link)
            bsdf.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1)
mn = Vector((1e9, 1e9, 1e9)); mx = Vector((-1e9, -1e9, -1e9))
for o in objs:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
center = (mn + mx) / 2; size = max(mx - mn)

sc = bpy.context.scene
engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else ('BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else 'CYCLES')
if sc.render.engine == 'CYCLES':
    sc.cycles.samples = 32
sc.render.resolution_x = sc.render.resolution_y = 800
sc.render.film_transparent = False
world = bpy.data.worlds.new('w'); sc.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.25, 0.27, 0.3, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
for name, rot, energy in [('key', (50, 0, 30), 3.0), ('fill', (60, 0, -140), 1.2)]:
    ld = bpy.data.lights.new(name, 'SUN'); ld.energy = energy
    lo = bpy.data.objects.new(name, ld); lo.rotation_euler = [math.radians(a) for a in rot]
    sc.collection.objects.link(lo)

cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = size * 1.15
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam

# glTF의 +Z 정면은 Blender에서 -Y 방향이 된다. (방위각, 올려보기 각) 목록
views = {'front': (0, 0), 'top_front': (0, 55), 'left': (90, 10), 'back': (180, 15), 'right': (-90, 10), 'top': (0, 89)}
for name, (az, el) in views.items():
    d = Vector((math.sin(math.radians(az)) * math.cos(math.radians(el)),
                -math.cos(math.radians(az)) * math.cos(math.radians(el)),
                math.sin(math.radians(el))))
    cam.location = center + d * size * 3
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = f'{out}_{name}.png'
    bpy.ops.render.render(write_still=True)
print('ENGINE', sc.render.engine)
