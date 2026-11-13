# Blender 배경 실행: 자동 리깅의 잘못된 피부 가중치를 고치고 꼬리 뼈를 넣어 .blend로 저장한다
# 사용: blender -b --factory-startup --python fix_weights.py -- <rig.glb> <tail_mask.npy> <z_lo> <z_hi> <out.blend>
import bpy, sys
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
glb, tail_path, z_lo, z_hi, out = argv[0], argv[1], float(argv[2]), float(argv[3]), argv[4]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
mesh = next(o for o in sc.objects if o.type == 'MESH')
if arm.animation_data: arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
sc.frame_set(0)

co = np.array([mesh.matrix_world @ v.co for v in mesh.data.vertices])
tail = np.load(tail_path)
assert len(tail) == len(co), 'vertex count mismatch'
names = [g.name for g in mesh.vertex_groups]
nv = len(co)
W = np.zeros((nv, len(names)))
for v in mesh.data.vertices:
    for g in v.groups: W[v.index, g.group] = g.weight
hips = names.index('Hips')

# --- 1. 다리 뼈는 다리 높이까지만: z_lo 아래는 그대로, z_hi 위는 엉덩이로, 그 사이는 섞는다 ---
legs = [names.index(n) for n in names if any(k in n for k in ('UpLeg', 'Leg', 'Foot', 'ToeBase'))]
z = co[:, 2]
keep = np.clip((z_hi - z) / (z_hi - z_lo), 0, 1)
moved = W[:, legs].sum(1) * (1 - keep)
W[:, legs] *= keep[:, None]
W[:, hips] += moved

# --- 2. 꼬리: 팔다리 영향을 빼고, 새 꼬리 뼈를 뿌리에서 끝으로 갈수록 더 따르게 한다 ---
tc = co[tail]
hips_head = arm.matrix_world @ arm.data.bones['Hips'].head_local
d = np.linalg.norm(tc - np.array(hips_head), axis=1)
root = tc[d < np.percentile(d, 8)].mean(0)
tip = tc[np.argmax(np.linalg.norm(tc - root, axis=1))]
axis = tip - root; L = np.linalg.norm(axis)
t = np.clip(((co - root) @ axis) / (L * L), 0, 1)
w_tail = np.where(tail, np.clip((t - 0.05) / 0.45, 0, 1) ** 1.5, 0.0)
W[tail] = 0; W[tail, hips] = 1.0
W *= (1 - w_tail)[:, None]
print('tail verts', tail.sum(), 'root', root.round(3), 'tip', tip.round(3), 'len', round(L, 3))

# 꼬리 뼈 만들기(엉덩이의 자식)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
inv = arm.matrix_world.inverted()
eb = arm.data.edit_bones.new('Tail')
eb.head = inv @ Vector(root); eb.tail = inv @ Vector(root + axis * 0.7)
eb.parent = arm.data.edit_bones['Hips']
bpy.ops.object.mode_set(mode='OBJECT')
g_tail = mesh.vertex_groups.new(name='Tail')

# --- 3. 정규화 후 다시 쓴다 ---
s = W.sum(1) + w_tail
W /= np.maximum(s, 1e-8)[:, None]; w_tail /= np.maximum(s, 1e-8)
for k, n in enumerate(names):
    g = mesh.vertex_groups[n]
    g.remove(list(range(nv)))
    idx = np.where(W[:, k] > 1e-4)[0]
    for i in idx:
        g.add([int(i)], float(W[i, k]), 'REPLACE')
for i in np.where(w_tail > 1e-4)[0]:
    g_tail.add([int(i)], float(w_tail[i]), 'REPLACE')
print('legs moved to hips (verts)', int((moved > 0.05).sum()))
bpy.ops.wm.save_as_mainfile(filepath=out)
print('SAVED', out)
