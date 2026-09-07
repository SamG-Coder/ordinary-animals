"""Author three reusable landscape sections with packed Blender materials and exact ground samples."""
import ast
import bpy
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from terrain_metadata import ground_surface

catalog = json.loads((ROOT / 'game-assets/asset-catalog.json').read_text())
for name, width, depth, columns, rows, elevation, phase in [
    ('road-bank-24m', 24, 40, 24, 40, 3.0, .4),
    ('meadow-rise-40m', 40, 40, 32, 32, 5.1, 1.1),
    ('moor-ridge-80m', 80, 80, 48, 48, 15.0, 2.7),
]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    with bpy.data.libraries.load(str(ROOT / 'assets/ground-tile-40m.blend'), link=False) as (src, dst):
        dst.materials = ['ground']
    mat = bpy.data.materials['ground']
    mat.name = name + ' soil and moss'
    for im in bpy.data.images:
        if im.has_data and max(im.size) > 1024:
            im.scale(1024, 1024)
            im.pack()
    vertices, faces = [], []
    for j in range(rows + 1):
        v = j / rows
        for i in range(columns + 1):
            u = i / columns
            edge = math.sin(math.pi * u) ** 2 * math.sin(math.pi * v) ** 2
            shaping = .78 + .14 * math.sin(u * 8 + phase) + .10 * math.cos(v * 9 - u * 4 + phase)
            height = elevation * edge * shaping - .055
            vertices.append(((u - .5) * width, -(v - .5) * depth, height))
    for j in range(rows):
        for i in range(columns):
            a = j * (columns + 1) + i
            b, c, d = a + 1, a + columns + 1, a + columns + 2
            faces.extend([(a, c, b), (b, c, d)])
    mesh = bpy.data.meshes.new('Walkable terrain triangles')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv = mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        poly.use_smooth = True
        for li in poly.loop_indices:
            p = mesh.vertices[mesh.loops[li].vertex_index].co
            uv.data[li].uv = (p.x / 10, p.y / 10)
    obj = bpy.data.objects.new('Walkable surface', mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj['walkable_grid'] = True
    obj['columns'], obj['rows'] = columns, rows
    obj['width'], obj['depth'] = width, depth
    obj['triangle_diagonal'] = 'b-c'
    bpy.context.view_layer.update()
    metadata = ground_surface(bpy.context.scene)
    bpy.data.orphans_purge(do_recursive=True)
    for im in bpy.data.images:
        if im.users and im.has_data:
            im.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets' / f'{name}.blend'), compress=True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT / 'game-assets/models' / f'{name}.glb'),
                             export_format='GLB', export_image_format='WEBP', export_image_quality=91,
                             export_animations=False)
    catalog[name] = {'model': f'models/{name}.glb', 'source': f'assets/{name}.blend', 'groundSurface': metadata}
    print('TERRAIN_MODULE', name, len(vertices), len(faces), max(metadata['heights']), flush=True)

(ROOT / 'game-assets/asset-catalog.json').write_text(json.dumps(catalog, indent=2))
print('TERRAIN_MODULES_COMPLETE', len(catalog), flush=True)
