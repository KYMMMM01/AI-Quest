# Blender 배경 실행: 뼈마다 영향을 주는 꼭짓점의 범위와, 뼈 하나씩 돌린 시험 자세를 렌더한다
# 사용: blender -b --factory-startup --python weight_probe.py -- <rig.glb> <out_prefix>
import bpy, sys, math
import numpy as np
from mathutils import Vector, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
glb, out = argv[0], argv[1]
if glb.endswith('.blend'):
    bpy.ops.wm.open_mainfile(filepath=glb)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb)
sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
mesh = next(o for o in sc.objects if o.type == 'MESH')
if arm.animation_data: arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
sc.frame_set(0)

co = np.array([mesh.matrix_world @ v.co for v in mesh.data.vertices])
names = [g.name for g in mesh.vertex_groups]
Wt = np.zeros((len(co), len(names)))
for v in mesh.data.vertices:
    for g in v.groups:
        Wt[v.index, g.group] = g.weight
print('VERTS', len(co))
for k, n in enumerate(names):
    m = Wt[:, k] > 0.3
    if m.sum():
        q = co[m]
        print(f'W {n:14s} n={m.sum():6d} x[{q[:,0].min():+.2f},{q[:,0].max():+.2f}] y[{q[:,1].min():+.2f},{q[:,1].max():+.2f}] z[{q[:,2].min():+.2f},{q[:,2].max():+.2f}]')
np.savez(out + '_weights.npz', co=co, W=Wt, names=np.array(names))

W = arm.matrix_world.to_quaternion()
def set_rot(name, axis, deg):
    v = {'X': Vector((1, 0, 0)), 'Y': Vector((0, 1, 0)), 'Z': Vector((0, 0, 1))}[axis]
    M = W @ arm.data.bones[name].matrix_local.to_quaternion()
    arm.pose.bones[name].rotation_quaternion = M.inverted() @ Quaternion(v, math.radians(deg)) @ M

mn = Vector(co.min(0)); mx = Vector(co.max(0)); center = (mn + mx) / 2; size = max(mx - mn)
engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else 'BLENDER_EEVEE'
sc.render.resolution_x = sc.render.resolution_y = 300
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.25, 0.27, 0.3, 1)
ld = bpy.data.lights.new('key', 'SUN'); ld.energy = 3; lo = bpy.data.objects.new('key', ld); lo.rotation_euler = (0.9, 0, 0.5); sc.collection.objects.link(lo)
cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = size * 1.5
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
d = Vector((0, -1, 0.12)).normalized(); cam.location = center + d * size * 3
cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()

tests = [('rest', []), ('RArm_Y+80', [('RightArm', 'Y', 80)]), ('RArm_Y-60', [('RightArm', 'Y', -60)]),
         ('RArm_X+70', [('RightArm', 'X', 70)]), ('RArm_X-70', [('RightArm', 'X', -70)]),
         ('LUpLeg_X+40', [('LeftUpLeg', 'X', 40)]), ('Spine_X+20', [('Spine', 'X', 20)]), ('Head_Z+25', [('Head', 'Z', 25)])]
if 'Tail' in arm.data.bones:
    tests = [t for t in tests if t[0] not in ('RArm_X-70', 'Head_Z+25')] + [('LArm_X+60', [('LeftArm', 'X', 60)]), ('Tail_Z+35', [('Tail', 'Z', 35)])]
for tag, rots in tests:
    for pb in arm.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0)
    for n, a, dgr in rots: set_rot(n, a, dgr)
    bpy.context.view_layer.update()
    sc.render.filepath = f'{out}_{tag}.png'; bpy.ops.render.render(write_still=True)
print('DONE')
