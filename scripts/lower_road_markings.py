"""Lower only road-straight-12m's paint to 0.2..1.0 mm above its asphalt.

This repeatable Blender source pass preserves horizontal geometry, material slots
and UV coordinates. No roads, terrain or collision data are moved or regenerated.
"""
import bpy
import hashlib
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
NAME = 'road-straight-12m'
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets' / f'{NAME}.blend'))
scene = bpy.context.scene
scene.frame_set(1)
bpy.context.view_layer.update()
asphalt = bpy.data.objects.get('Asphalt')
assert asphalt and asphalt.type == 'MESH', 'Expected the authored Asphalt mesh'
surface = max((asphalt.matrix_world @ v.co).z for v in asphalt.data.vertices)
paint = [obj for obj in scene.objects if obj.type == 'MESH' and obj.name.startswith(('Edge marking', 'Centre dash'))]
assert len(paint) == 5, f'Expected two edge markings and three centre dashes, found {len(paint)}'


def uv_digest(obj):
    values = [[tuple(uv.uv) for uv in layer.data] for layer in obj.data.uv_layers]
    return hashlib.sha256(json.dumps(values).encode()).hexdigest()


report = []
for obj in paint:
    before = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    before_uvs = uv_digest(obj)
    materials = [mat.name for mat in obj.data.materials]
    low, high = min(p.z for p in before), max(p.z for p in before)
    assert high - low > .00001, (obj.name, low, high)
    inverse = obj.matrix_world.inverted()
    for vertex, point in zip(obj.data.vertices, before):
        z = surface + .0002 + ((point.z - low) / (high - low)) * .0008
        vertex.co = inverse @ Vector((point.x, point.y, z))
    obj.data.update()
    bpy.context.view_layer.update()
    after = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    assert all(abs(a.x - b.x) < 1e-6 and abs(a.y - b.y) < 1e-6 for a, b in zip(before, after)), obj.name
    assert uv_digest(obj) == before_uvs, f'{obj.name} UV coordinates changed'
    assert [mat.name for mat in obj.data.materials] == materials
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    z_values = [(evaluated.matrix_world @ vertex.co).z for vertex in mesh.vertices]
    assert min(z_values) >= surface + .00019, f'{obj.name} intersects asphalt'
    assert max(z_values) <= surface + .00101, f'{obj.name} is still raised'
    report.append({'object': obj.name, 'asphaltTop': surface, 'paintBottom': min(z_values), 'paintTop': max(z_values), 'uvHash': before_uvs, 'materials': materials, 'horizontalGeometryUnchanged': True})
    evaluated.to_mesh_clear()
for image in bpy.data.images:
    if image.users and image.has_data:
        image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets' / f'{NAME}.blend'), compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'game-assets/models' / f'{NAME}.glb'), export_format='GLB', export_image_format='WEBP', export_image_quality=95, export_animations=False)
(ROOT / 'artifacts/road-markings-source-audit.json').write_text(json.dumps(report, indent=2))
print('ROAD_MARKINGS_LOWERED', len(report), flush=True)
