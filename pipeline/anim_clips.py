# Blender 배경 실행: 가중치를 고친 .blend에 동작 하나를 키로 잡고 투명 배경 연속 그림으로 렌더한다
# 사용: blender -b --python anim_clips.py -- <rig.blend> <clip> <out_dir> <azimuth> <px> [preview]
# 축(실측): 척추와 머리 X+ 앞으로 숙임, 오른팔 Y+ 옆으로 듦, 왼팔 Y- 옆으로 듦, 팔다리 X- 앞으로, 꼬리 X+ 위로, 꼬리 Z 좌우
import bpy, sys, math, os
import numpy as np
from mathutils import Vector, Quaternion, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
blend, clip, out_dir, az, px = argv[0], argv[1], argv[2], float(argv[3]), int(argv[4])
preview = len(argv) > 5 and argv[5] == '1'
bpy.ops.wm.open_mainfile(filepath=blend)
sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
mesh = next(o for o in sc.objects if o.type == 'MESH')
for pb in arm.pose.bones:
    pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
arm.animation_data_create(); arm.animation_data.action = bpy.data.actions.new(clip)
sc.render.fps = 30
WQ = arm.matrix_world.to_quaternion()
AX = {'X': Vector((1, 0, 0)), 'Y': Vector((0, 1, 0)), 'Z': Vector((0, 0, 1))}

def rot(name, f, x=0.0, y=0.0, z=0.0):
    R = Quaternion(AX['Z'], math.radians(z)) @ Quaternion(AX['Y'], math.radians(y)) @ Quaternion(AX['X'], math.radians(x))
    M = WQ @ arm.data.bones[name].matrix_local.to_quaternion()
    pb = arm.pose.bones[name]; pb.rotation_quaternion = M.inverted() @ R @ M
    pb.keyframe_insert('rotation_quaternion', frame=f)

def loc(name, f, dx=0.0, dy=0.0, dz=0.0):
    pb = arm.pose.bones[name]
    M = (arm.matrix_world @ arm.data.bones[name].matrix_local).to_3x3()
    pb.location = M.inverted() @ Vector((dx, dy, dz)); pb.keyframe_insert('location', frame=f)

def squash(f, amt):
    """엉덩이 뼈를 눌러 몸 전체를 살짝 찌그러뜨린다(amt>0 눌림). 발이 뜨지 않게 아래로 내린다"""
    pb = arm.pose.bones['Hips']
    pb.scale = (1 + amt * 0.6, 1 - amt, 1 + amt * 0.6); pb.keyframe_insert('scale', frame=f)

def has(n):
    return n in arm.data.bones

def make_stamp():
    """나르미 오른날개 끝에 붙는 도장: 파란 손잡이, 주황 도장면. 날개 뼈를 따라 움직인다"""
    gi = {g.name: g.index for g in mesh.vertex_groups}
    hv = [mesh.matrix_world @ v.co for v in mesh.data.vertices
          if any(g.group == gi['RightHand'] and g.weight > 0.5 for g in v.groups)]
    tipp = sum(hv, Vector()) / len(hv)
    base_pos = tipp + Vector((-0.03, -0.12, -0.02))
    def mat(n, rgb, r=0.45):
        m = bpy.data.materials.new(n); m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = r
        return m
    parts = []
    bpy.ops.mesh.primitive_cylinder_add(radius=0.085, depth=0.05, location=base_pos); o = bpy.context.object
    o.data.materials.append(mat('stamp_face', (0.95, 0.42, 0.08))); parts.append(o)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.11, location=base_pos + Vector((0, 0, 0.08))); o = bpy.context.object
    o.data.materials.append(mat('stamp_handle', (0.10, 0.28, 0.62))); parts.append(o)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.055, location=base_pos + Vector((0, 0, 0.15))); o = bpy.context.object
    o.data.materials.append(mat('stamp_knob', (0.10, 0.28, 0.62))); parts.append(o)
    bpy.context.view_layer.update()
    bone_world = arm.matrix_world @ arm.pose.bones['RightHand'].matrix
    for o in parts:
        bpy.context.view_layer.objects.active = o; bpy.ops.object.shade_smooth()
        c = o.constraints.new('CHILD_OF'); c.target = arm; c.subtarget = 'RightHand'
        c.inverse_matrix = bone_world.inverted()

def ease(f_end):
    for fc in arm.animation_data.action.fcurves if hasattr(arm.animation_data.action, 'fcurves') else []:
        for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'

def ear_free_head(f, x=0, y=0, z=0):
    rot('Head', f, x, y, z)

# ---------------------------------------------------------------- 동작
if clip == 'narumi_idle':
    L = 48
    for f in range(0, L + 1, 6):
        p = 2 * math.pi * f / L
        loc('Hips', f, dz=0.006 * (1 - math.cos(p)) / 2)
        squash(f, 0.025 * math.sin(p) * 0.5)
        rot('Head', f, x=2.5 * math.sin(p), y=3 * math.sin(p * 0.5 * 2))
        rot('RightArm', f, y=6 * (1 + math.sin(p)) / 2)
        rot('LeftArm', f, y=-6 * (1 + math.sin(p + 0.6)) / 2)
        rot('Tail', f, z=5 * math.sin(p))
    step, loop = 2, True
elif clip == 'narumi_stamp':
    make_stamp()
    L = 26
    K = {  # 프레임: 오른날개 듦(y)과 앞으로(x), 척추 숙임, 머리, 엉덩이 높이, 눌림, 왼날개
        0: (0, 0, 0, 0, 0, 0, 0),
        7: (95, -25, -7, -6, 0.010, -0.03, -20),      # 들어 올리며 뒤로 젖힘(예비 동작)
        10: (100, -30, -9, -8, 0.014, -0.04, -25),    # 꼭대기에서 잠깐 멈춤
        13: (5, -95, 14, 8, -0.018, 0.10, 10),      # 쾅! 앞으로 내려찍음
        15: (6, -92, 12, 7, -0.014, 0.07, 8),
        19: (8, -90, 10, 6, -0.010, 0.02, 6),        # 찍은 채 버팀
        26: (0, 0, 0, 0, 0, 0, 0),
    }
    for f, (ay, ax, sp, hd, hz, sq, la) in K.items():
        rot('RightArm', f, x=ax, y=ay); rot('RightForeArm', f, x=ax * 0.2)
        rot('LeftArm', f, y=la); rot('Spine', f, x=sp); rot('Head', f, x=hd)
        loc('Hips', f, dz=hz); squash(f, sq); rot('Tail', f, x=-sp * 1.2)
    step, loop = 1, False
elif clip == 'narumi_happy':
    L = 24
    K = {0: (0, 0, 0, 0), 5: (-0.01, 0.06, 20, 0), 10: (0.09, -0.04, 80, 8), 13: (0.10, -0.05, 90, 10),
         18: (0.0, 0.08, 40, 0), 21: (0.004, -0.01, 20, 2), 24: (0, 0, 0, 0)}
    for f, (hz, sq, wing, head) in K.items():
        loc('Hips', f, dz=hz); squash(f, sq)
        rot('RightArm', f, y=wing, x=-wing * 0.15); rot('LeftArm', f, y=-wing, x=-wing * 0.15)
        rot('Head', f, x=-head); rot('Tail', f, x=wing * 0.3)
    step, loop = 1, False
elif clip == 'narumi_no':
    L = 30
    for f in range(0, L + 1, 3):
        e = math.sin(math.pi * f / L)
        rot('Head', f, z=22 * e * math.sin(2 * math.pi * f / 10), x=4 * e)
        rot('Spine', f, x=3 * e)
        rot('RightArm', f, y=10 * e); rot('LeftArm', f, y=-10 * e)
    step, loop = 1, False
elif clip == 'dari_idle':
    L = 48
    for f in range(0, L + 1, 6):
        p = 2 * math.pi * f / L
        loc('Hips', f, dz=0.006 * (1 - math.cos(p)) / 2); squash(f, 0.012 * math.sin(p))
        rot('Head', f, y=-4 * math.sin(p), x=2 * math.sin(2 * p))
        rot('Tail', f, z=10 * math.sin(p), x=4 * math.sin(2 * p))
        rot('RightArm', f, x=4 * math.sin(p)); rot('LeftArm', f, x=-4 * math.sin(p))
    step, loop = 2, True
elif clip == 'dari_run':
    L = 12
    for f in range(0, L + 1, 1):
        p = 2 * math.pi * f / L; s = math.sin(p)
        rot('LeftUpLeg', f, x=-35 * s); rot('RightUpLeg', f, x=35 * s)
        if has('LeftLeg'): rot('LeftLeg', f, x=25 * max(0, s))
        if has('RightLeg'): rot('RightLeg', f, x=25 * max(0, -s))
        rot('LeftArm', f, x=40 * s, y=-12); rot('RightArm', f, x=-40 * s, y=12)
        rot('Spine', f, x=7, z=4 * s); rot('Head', f, x=-3 + 2 * math.cos(2 * p), z=-3 * s)
        bounce = abs(math.cos(p))
        loc('Hips', f, dz=0.03 * bounce); squash(f, 0.05 * (0.5 - bounce))
        rot('Tail', f, x=18 + 8 * math.cos(2 * p), z=12 * s)
    step, loop = 1, True
elif clip == 'dari_happy':
    L = 24
    K = {0: (0, 0, 0, 0), 5: (-0.01, 0.06, 10, 0), 10: (0.10, -0.05, 120, 25), 13: (0.11, -0.05, 130, 30),
         18: (0.0, 0.08, 60, 5), 21: (0.004, -0.01, 20, 0), 24: (0, 0, 0, 0)}
    for f, (hz, sq, armup, tail) in K.items():
        loc('Hips', f, dz=hz); squash(f, sq)
        rot('RightArm', f, y=armup * 0.6, x=-armup * 0.4); rot('LeftArm', f, y=-armup * 0.6, x=-armup * 0.4)
        rot('Head', f, x=-armup * 0.05); rot('Tail', f, x=tail)
    step, loop = 1, False
else:
    raise SystemExit('unknown clip ' + clip)

act = arm.animation_data.action
for fc in getattr(act, 'fcurves', []):
    for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'; kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
sc.frame_start, sc.frame_end = 0, L

# ---------------------------------------------------------------- 카메라(캐릭터마다 고정, 쉬는 자세 기준)
co = np.array([mesh.matrix_world @ v.co for v in mesh.data.vertices])
mn, mx = co.min(0), co.max(0); center = Vector((mn + mx) / 2); size = float(max(mx - mn))
engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else 'BLENDER_EEVEE'
sc.render.resolution_x = sc.render.resolution_y = px
sc.render.film_transparent = not preview
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.85, 0.88, 0.93, 1); bg.inputs[1].default_value = 0.6
for name, r, e in [('key', (55, 0, -35), 3.2), ('fill', (65, 0, 140), 1.1), ('rim', (110, 0, 180), 1.5)]:
    ld = bpy.data.lights.new(name, 'SUN'); ld.energy = e
    lo = bpy.data.objects.new(name, ld); lo.rotation_euler = [math.radians(a) for a in r]; sc.collection.objects.link(lo)
cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = size * 1.55
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
el = 6
d = Vector((math.sin(math.radians(az)) * math.cos(math.radians(el)), -math.cos(math.radians(az)) * math.cos(math.radians(el)), math.sin(math.radians(el))))
target = center + Vector((0, 0, size * 0.12))
cam.location = target + d * size * 3; cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()

os.makedirs(out_dir, exist_ok=True)
frames = list(range(0, L if loop else L + 1, step))
for k, f in enumerate(frames):
    sc.frame_set(f); sc.render.filepath = os.path.join(out_dir, f'{k:03d}.png'); bpy.ops.render.render(write_still=True)
print('CLIP', clip, 'frames', len(frames), 'fps', 30 // step, 'loop', loop)
