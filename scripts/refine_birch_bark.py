"""Replace only the existing birch trunk surface; preserve every source shape.

Original papery colour, horizontal lenticels, grey weathering and roughness are
authored here in Blender and packed. Geometry, curve controls and actions are
fingerprinted before and after; the shared catalog is never written.
"""
import bpy
import hashlib
import json
import math
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT = 1024, 2048
rng = np.random.default_rng(62471)


def geometry_fingerprint():
    values = []
    for obj in sorted(bpy.context.scene.objects, key=lambda o: o.name):
        entry = {'name': obj.name, 'type': obj.type, 'parent': obj.parent.name if obj.parent else None,
                 'matrix': [list(row) for row in obj.matrix_local]}
        if obj.type == 'MESH':
            entry['vertices'] = [list(v.co) for v in obj.data.vertices]
            entry['faces'] = [list(p.vertices) for p in obj.data.polygons]
        elif obj.type == 'CURVE':
            entry['bevel'] = [obj.data.bevel_depth, obj.data.bevel_resolution, obj.data.resolution_u]
            entry['splines'] = [[{'co': list(p.co), 'left': list(p.handle_left), 'right': list(p.handle_right),
                                  'leftType': p.handle_left_type, 'rightType': p.handle_right_type,
                                  'radius': p.radius} for p in spline.bezier_points] for spline in obj.data.splines]
        values.append(entry)
    return hashlib.sha256(json.dumps(values, sort_keys=True).encode()).hexdigest()


def field(columns, rows):
    grid = rng.random((rows, columns)).astype(np.float32)
    px = np.arange(WIDTH, dtype=np.float32) * columns / WIDTH
    py = np.arange(HEIGHT, dtype=np.float32) * rows / HEIGHT
    ix, iy = px.astype(int), py.astype(int)
    fx, fy = px - ix, py - iy
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a = grid[iy[:, None] % rows, ix[None, :] % columns]
    b = grid[(iy[:, None] + 1) % rows, ix[None, :] % columns]
    c = grid[iy[:, None] % rows, (ix[None, :] + 1) % columns]
    d = grid[(iy[:, None] + 1) % rows, (ix[None, :] + 1) % columns]
    return ((a * (1 - fy[:, None]) + b * fy[:, None]) * (1 - fx[None, :]) +
            (c * (1 - fy[:, None]) + d * fy[:, None]) * fx[None, :]).astype(np.float32)


bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets/birch.blend'))
before_geometry = geometry_fingerprint()
before_actions = [(a.name, a.users) for a in bpy.data.actions]
catalog_hash = hashlib.sha256((ROOT / 'game-assets/asset-catalog.json').read_bytes()).hexdigest()
trunks = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj.name.startswith('Trunk')]
assert len(trunks) == 1 and abs(trunks[0].dimensions.z - 8) < 1e-6
trunk = trunks[0]

fine, grain, cloud, weather = field(380, 650), field(57, 119), field(5, 27), field(13, 71)
yy, xx = np.mgrid[0:HEIGHT, 0:WIDTH].astype(np.float32)
height_metres = yy / HEIGHT * 8
scars = np.zeros((HEIGHT, WIDTH), dtype=np.float32)
for i in range(390):
    cx, cy = rng.uniform(0, WIDTH), rng.uniform(8, HEIGHT - 8)
    half_width = rng.uniform(.023, .105) * WIDTH
    half_height = rng.uniform(.003, .013) / 8 * HEIGHT
    if i % 11 == 0:
        half_width *= 1.4
        half_height *= 2.2
    xs = np.arange(math.floor(cx - half_width - 3), math.ceil(cx + half_width + 4))
    ys = np.arange(max(0, math.floor(cy - half_height - 4)), min(HEIGHT, math.ceil(cy + half_height + 5)))
    dx = (xs[None, :] - cx) / half_width
    waviness = .50 * np.sin(dx * 9 + rng.uniform(0, math.tau))
    dy = (ys[:, None] - cy - waviness) / max(half_height, 1)
    mask = np.clip((1 - np.abs(dx) ** 2.4 - np.abs(dy) ** 1.6) * 2.8, 0, 1)
    mask *= .65 + .35 * grain[np.ix_(ys, xs % WIDTH)]
    target = np.ix_(ys, xs % WIDTH)
    scars[target] = np.maximum(scars[target], mask)

# Broad grey paper patches and dirt at the base break the white cylinder effect.
patches = np.clip((weather - .43) * 2.6, 0, 1)
base = np.exp(-height_metres / .48) * (.24 + .45 * cloud)
silver = .40 + .16 * cloud + .06 * fine - .055 * grain - .085 * patches
color = np.stack([silver * 1.025, silver, silver * .935], axis=-1)
color *= (1 - base[:, :, None] * .56)
scar_color = np.stack([.036 + .03 * fine, .043 + .028 * fine, .037 + .027 * fine], axis=-1)
color = color * (1 - scars[:, :, None]) + scar_color * scars[:, :, None]
height_map = .00032 * grain + .00013 * fine - .00135 * scars + .00030 * patches
normal = np.stack([
    -(np.roll(height_map, -1, 1) - np.roll(height_map, 1, 1)) / (2 / WIDTH),
    -(np.roll(height_map, -1, 0) - np.roll(height_map, 1, 0)) / (16 / HEIGHT),
    np.ones_like(height_map),
], axis=-1)
normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
roughness = np.clip(.76 + .11 * grain + .055 * fine + .06 * scars - .05 * patches, .66, .98)

name = 'birch-papery-bark'
mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
mat.use_nodes = True
mat.node_tree.nodes.clear()
shader = mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
output = mat.node_tree.nodes.new('ShaderNodeOutputMaterial')
mat.node_tree.links.new(shader.outputs['BSDF'], output.inputs['Surface'])
mat.diffuse_color = (.46, .45, .42, 1)
mat['authoring'] = 'scripts/refine_birch_bark.py'
mat['surface_description'] = 'Original mottled birch paper bark with horizontal lenticels, 1m circumference by 8m height'
for label, pixels in [
    ('Color', color), ('Normal', normal * .5 + .5),
    ('Roughness', np.repeat(roughness[:, :, None], 3, axis=2)),
]:
    image_name = f'Birch paper bark {label}'
    old = bpy.data.images.get(image_name)
    if old and not old.users:
        bpy.data.images.remove(old)
    image = bpy.data.images.new(image_name, width=WIDTH, height=HEIGHT, alpha=False)
    if label != 'Color':
        image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(np.concatenate([pixels, np.ones((HEIGHT, WIDTH, 1), dtype=np.float32)], axis=-1).astype(np.float32).ravel())
    image.pack()
    texture = mat.node_tree.nodes.new('ShaderNodeTexImage')
    texture.image = image
    if label == 'Normal':
        node = mat.node_tree.nodes.new('ShaderNodeNormalMap')
        node.inputs['Strength'].default_value = .8
        mat.node_tree.links.new(texture.outputs['Color'], node.inputs['Color'])
        mat.node_tree.links.new(node.outputs['Normal'], shader.inputs['Normal'])
    else:
        mat.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color' if label == 'Color' else 'Roughness'])
trunk.data.materials[0] = mat
uv = trunk.data.uv_layers.active or trunk.data.uv_layers.new(name='UVMap')
for polygon in trunk.data.polygons:
    values = []
    for li in polygon.loop_indices:
        vertex = trunk.data.vertices[trunk.data.loops[li].vertex_index].co
        values.append((li, (math.atan2(vertex.y, vertex.x) / math.tau) % 1, (vertex.z + 4) / 8))
    seam = max(u for _, u, _ in values) - min(u for _, u, _ in values) > .5
    for li, u, v in values:
        uv.data[li].uv = (u + (1 if seam and u < .5 else 0), v)

after_geometry = geometry_fingerprint()
assert after_geometry == before_geometry, 'Birch geometry changed during its material pass'
assert before_actions == [(a.name, a.users) for a in bpy.data.actions], 'Birch animation changed'
for image in bpy.data.images:
    if image.users and image.has_data:
        image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/birch.blend'), compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'game-assets/models/birch.glb'), export_format='GLB',
                          export_image_format='WEBP', export_image_quality=88,
                          export_animations=bool(before_actions), export_lights=True)
assert hashlib.sha256((ROOT / 'game-assets/asset-catalog.json').read_bytes()).hexdigest() == catalog_hash
audit = {'asset': 'birch', 'geometryBefore': before_geometry, 'geometryAfter': after_geometry,
         'animationsBefore': before_actions, 'animationsAfter': [(a.name, a.users) for a in bpy.data.actions],
         'trunkHeight': trunk.dimensions.z, 'trunkVertices': len(trunk.data.vertices),
         'trunkMaterial': mat.name, 'mapSize': [WIDTH, HEIGHT], 'horizontalScars': 390,
         'sharedCatalogUnchanged': True}
(ROOT / 'artifacts/birch-bark-audit.json').write_text(json.dumps(audit, indent=2))
print('BIRCH_BARK_PASS', json.dumps(audit), flush=True)
