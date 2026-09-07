"""Focused Blender source corrections for a hidden lodge title and hard puddles.

Only groundskeeper-lodge and puddle are saved/exported. Existing scene placement,
catalog, collider data, asset IDs, and overall asset bounds remain unchanged.
"""
import ast
import bpy
import hashlib
import json
import math
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SIZE = 512
rng = np.random.default_rng(84311)
tree = ast.parse((ROOT / 'scripts/road_surface_pass.py').read_text())
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'field'], type_ignores=[]), 'Original surface field', 'exec'))
catalog_hash = hashlib.sha256((ROOT / 'game-assets/asset-catalog.json').read_bytes()).hexdigest()
report = {}


def bounds():
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in bpy.context.scene.objects:
        if obj.type not in {'MESH', 'FONT', 'CURVE'}:
            continue
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        points.extend(evaluated.matrix_world @ v.co for v in mesh.vertices)
        evaluated.to_mesh_clear()
    return [[min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]]


def save(name):
    bpy.data.orphans_purge(do_recursive=True)
    for image in bpy.data.images:
        if image.users and image.has_data:
            image.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets' / f'{name}.blend'), compress=True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT / 'game-assets/models' / f'{name}.glb'),
                              export_format='GLB', export_image_format='WEBP', export_image_quality=88,
                              export_animations=False, export_lights=True)
    print('FASCIA_PUDDLE_ASSET_SAVED', name, flush=True)


bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets/groundskeeper-lodge.blend'))
before = bounds()
sign = bpy.data.objects['County office sign']
letters = bpy.data.objects['Lodge sign']
old_positions = {'board': list(sign.location), 'letters': list(letters.location)}
# The upper sill begins at 3.675m; keep the new board below it. Moving the title
# above the closer, tilted canopy makes it visible from a child's approach view.
sign.location.z = 3.48
letters.location.z = 3.40
after = bounds()
assert all(abs(a - b) < 1e-6 for a, b in zip(sum(before, []), sum(after, []))), 'Lodge envelope changed'
report['groundskeeper-lodge'] = {'boundsBefore': before, 'boundsAfter': after,
                                'positionsBefore': old_positions,
                                'positionsAfter': {'board': list(sign.location), 'letters': list(letters.location)}}
save('groundskeeper-lodge')

bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets/puddle.blend'))
before = bounds()
objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
assert len(objects) == 1
water = objects[0]
if 'original_shoreline' in water:
    original = json.loads(water['original_shoreline'])
else:
    original = [list(v.co) for v in water.data.vertices[1:]]
    water['original_shoreline'] = json.dumps(original)
outline = np.asarray(original, dtype=np.float64)[:, :2]
low, high = outline.min(axis=0), outline.max(axis=0)
datum = float(original[0][2])
for _ in range(3):
    following = np.roll(outline, -1, axis=0)
    smooth = np.empty((len(outline) * 2, 2))
    smooth[0::2] = outline * .75 + following * .25
    smooth[1::2] = outline * .25 + following * .75
    outline = smooth
outline = low + (outline - outline.min(axis=0)) / (outline.max(axis=0) - outline.min(axis=0)) * (high - low)
center = outline.mean(axis=0)
vertices = [(*center, datum)] + [(*p, datum) for p in outline]
faces = [(0, i + 1, (i + 1) % len(outline) + 1) for i in range(len(outline))]
mesh = bpy.data.meshes.new('Rounded rainwater shoreline')
mesh.from_pydata(vertices, [], faces)
mesh.update()
uv = mesh.uv_layers.new(name='UVMap')
for polygon in mesh.polygons:
    for li in polygon.loop_indices:
        vertex = mesh.vertices[mesh.loops[li].vertex_index].co
        uv.data[li].uv = ((vertex.x - low[0]) / (high[0] - low[0]), (vertex.y - low[1]) / (high[1] - low[1]))
water.data = mesh

yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
x = low[0] + (xx + .5) / SIZE * (high[0] - low[0])
y = low[1] + (yy + .5) / SIZE * (high[1] - low[1])
distance = np.full((SIZE, SIZE), np.inf, dtype=np.float32)
inside = np.zeros((SIZE, SIZE), dtype=bool)
for p, q in zip(outline, np.roll(outline, -1, axis=0)):
    dx, dy = q - p
    t = np.clip(((x - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy), 0, 1)
    distance = np.minimum(distance, np.hypot(x - p[0] - t * dx, y - p[1] - t * dy))
    crossing = ((p[1] > y) != (q[1] > y)) & (x < (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1] + 1e-20) + p[0])
    inside ^= crossing
shore = np.clip(distance / .08, 0, 1)
shore = shore * shore * (3 - 2 * shore)
fine, broad = field(180), field(7)
alpha = inside * shore * (.40 + .13 * broad)
value = .069 + .009 * fine + .013 * broad
color = np.stack([value * .985, value, value * 1.015], axis=-1)
roughness = np.clip(.14 + .045 * fine - .06 * broad, .09, .19)
relief = .000035 * fine + .00006 * broad
normal = np.stack([
    -(np.roll(relief, -1, 1) - np.roll(relief, 1, 1)) / (2 * (high[0] - low[0]) / SIZE),
    -(np.roll(relief, -1, 0) - np.roll(relief, 1, 0)) / (2 * (high[1] - low[1]) / SIZE),
    np.ones_like(relief),
], axis=-1)
normal /= np.linalg.norm(normal, axis=-1, keepdims=True)

material_name = 'neutral-rainwater-shoreline'
mat = bpy.data.materials.get(material_name) or bpy.data.materials.new(material_name)
mat.use_nodes = True
mat.node_tree.nodes.clear()
mat.surface_render_method = 'DITHERED'
mat.use_transparent_shadow = True
shader = mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
shader.inputs['Metallic'].default_value = .03
output = mat.node_tree.nodes.new('ShaderNodeOutputMaterial')
mat.node_tree.links.new(shader.outputs['BSDF'], output.inputs['Surface'])
for label, pixels in [('Color', color), ('Normal', normal * .5 + .5), ('Roughness', np.repeat(roughness[:, :, None], 3, axis=2))]:
    image_name = f'Rainwater softened shore {label}'
    previous = bpy.data.images.get(image_name)
    if previous and not previous.users:
        bpy.data.images.remove(previous)
    image = bpy.data.images.new(image_name, width=SIZE, height=SIZE, alpha=label == 'Color')
    if label != 'Color':
        image.colorspace_settings.name = 'Non-Color'
    opacity = alpha if label == 'Color' else np.ones_like(alpha)
    rgba = np.concatenate([pixels, opacity[:, :, None]], axis=-1).astype(np.float32)
    image.pixels.foreach_set(rgba.ravel())
    image.pack()
    texture = mat.node_tree.nodes.new('ShaderNodeTexImage')
    texture.image = image
    if label == 'Normal':
        node = mat.node_tree.nodes.new('ShaderNodeNormalMap')
        node.inputs['Strength'].default_value = .5
        mat.node_tree.links.new(texture.outputs['Color'], node.inputs['Color'])
        mat.node_tree.links.new(node.outputs['Normal'], shader.inputs['Normal'])
    else:
        mat.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color' if label == 'Color' else 'Roughness'])
        if label == 'Color':
            mat.node_tree.links.new(texture.outputs['Alpha'], shader.inputs['Alpha'])
mat['authoring'] = 'scripts/refine_fascia_puddle.py'
mat['shore_fade_metres'] = .08
water.data.materials.append(mat)
after = bounds()
assert all(abs(a - b) < 2e-6 for a, b in zip(sum(before, []), sum(after, []))), 'Puddle footprint or height changed'
assert all(abs(v.co.z - datum) < 1e-7 for v in water.data.vertices), 'The water walking datum moved'
report['puddle'] = {'boundsBefore': before, 'boundsAfter': after,
                    'perimeterVertices': len(outline), 'alphaRange': [float(alpha.min()), float(alpha.max())],
                    'shoreFadeMetres': .08, 'meshCount': 1, 'materialCount': 1}
save('puddle')
assert hashlib.sha256((ROOT / 'game-assets/asset-catalog.json').read_bytes()).hexdigest() == catalog_hash
(ROOT / 'artifacts/fascia-puddle-audit.json').write_text(json.dumps(report, indent=2))
print('FASCIA_PUDDLE_PASS', json.dumps(report), flush=True)
