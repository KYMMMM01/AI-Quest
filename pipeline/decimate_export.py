# Blender 배경 실행: GLB를 줄여(약 4만 삼각형) 질감째 다시 내보낸다
# 사용: blender -b --factory-startup --python decimate_export.py -- <in.glb> <out.glb> <target_tris>
import bpy, sys
argv = sys.argv[sys.argv.index('--') + 1:]
src, out, target = argv[0], argv[1], int(argv[2])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
bpy.context.view_layer.objects.active = obj; obj.select_set(True)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=1e-6)   # UV 조각 경계의 같은 위치 꼭짓점을 합쳐 줄일 때 틈이 안 생기게
bpy.ops.object.mode_set(mode='OBJECT')
tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
mod = obj.modifiers.new('dec', 'DECIMATE'); mod.ratio = min(1.0, target / tris)
bpy.ops.object.modifier_apply(modifier='dec')
try:
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
except Exception:
    pass
for p in obj.data.polygons:
    p.use_smooth = True
print('TRIS', tris, '->', sum(len(p.vertices) - 2 for p in obj.data.polygons))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=92)
print('EXPORTED', out)
