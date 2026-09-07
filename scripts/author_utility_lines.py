"""Two separate Blender roadside utility assets, with packed original PBR maps.

The pole's wire attachment datum is (x, y, z)=(0, 0, 6.1) in Blender.
Its timber trunk sits 0.245 m behind that cross-arm to clear the centre wire.
The span runs along game Z (Blender -Y); runtime only places these exports.
"""
import ast
import bpy
import json
import math
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / 'game-assets/models'
ARTIFACTS = ROOT / 'artifacts'
ARTIFACTS.mkdir(exist_ok=True)
SIZE = 512
rng = np.random.default_rng(71347)
catalog = {}
M = {}
for filename, names in [
    ('author_blender.py', {'begin', 'link', 'empty', 'cube', 'cone', 'text', 'plane_mesh', 'material'}),
    ('road_surface_pass.py', {'field'}),
    ('briarfield_assets.py', {'surface'}),
]:
    tree = ast.parse((ROOT / 'scripts' / filename).read_text())
    exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names], type_ignores=[]), 'Utility helpers', 'exec'))

yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32) / SIZE
fine, middle, stains = field(235), field(35), field(7)
# Elongated fibres and interrupted checks are generated here, not downloaded.
fibres = np.sin(xx * 710 + .8 * np.sin(yy * 16 + xx * 37))
checks = np.clip((np.sin(xx * 239 + .28 * np.sin(yy * 12)) - .955) * 22, 0, 1)
checks *= .28 + .72 * np.clip((middle - .32) * 3, 0, 1)
grain = .15 + .020 * fibres + .047 * fine + .038 * middle - .044 * stains - .043 * checks
wood_color = np.stack([grain * .98, grain * .88, grain * .68], axis=-1)
wood_height = .00048 * fibres + .0004 * fine - .0012 * checks
wood_roughness = np.clip(.84 + .13 * fine - .09 * stains, .7, .98)
rust = np.clip((middle - .48) * 3.8, 0, 1) * stains
iron_value = .12 + .027 * fine + .027 * middle
iron_color = np.stack([iron_value + rust * .10, iron_value + rust * .032, iron_value - rust * .012], axis=-1)
iron_height = .00023 * fine + .00017 * rust
iron_roughness = np.clip(.48 + .25 * rust + .13 * fine, .4, .91)


def start(name):
    global M
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M = {}
    root = begin(name)
    if name == 'utility-pole':
        surface('utility-weathered-timber', wood_color, wood_height, wood_roughness, repeat=2)
        steel = surface('utility-galvanised-iron', iron_color, iron_height, iron_roughness, repeat=.6)
        steel.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value = .68
        ceramic_value = .32 + .025 * fine - .08 * stains
        ceramic_color = np.stack([ceramic_value * .94, ceramic_value, ceramic_value * .90], axis=-1)
        surface('utility-old-porcelain', ceramic_color, .00007 * fine, .24 + .12 * stains, repeat=.5)
        material('utility-stamped-mark', (.021, .026, .023), .81)
    else:
        wire_value = .055 + .009 * fine + .007 * middle
        wire_color = np.stack([wire_value * .94, wire_value, wire_value * 1.04], axis=-1)
        wire = surface('utility-aged-conductor', wire_color, .00003 * fine, .57 + .13 * stains, repeat=.25)
        wire.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value = .52
    return root


def beam(name, a, b, width, material_name, root):
    a, b = Vector(a), Vector(b)
    obj = cube(name, (a + b) / 2, (width, width, (b - a).length), material_name, .003, root)
    obj.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    return obj


def wood_beam_uvs(obj):
    for polygon in obj.data.polygons:
        for li in polygon.loop_indices:
            vertex = obj.data.vertices[obj.data.loops[li].vertex_index].co
            transverse = vertex.y if abs(polygon.normal.z) > .5 else vertex.z
            obj.data.uv_layers.active.data[li].uv = (transverse / .42, vertex.x / 2)


def timber_trunk(root):
    vertices, faces = [], []
    ring_count, sides = 18, 24
    for ring in range(ring_count):
        z = ring * 6.5 / (ring_count - 1)
        radius = .186 - z * .011
        for side in range(sides):
            a = math.tau * side / sides
            r = radius * (1 + .016 * math.sin(a * 7 + ring * .27))
            vertices.append((r * math.cos(a), .245 + r * math.sin(a), z))
    for ring in range(ring_count - 1):
        for side in range(sides):
            nxt = (side + 1) % sides
            faces.append((ring * sides + side, ring * sides + nxt, (ring + 1) * sides + nxt, (ring + 1) * sides + side))
    faces += [tuple(reversed(range(sides))), tuple((ring_count - 1) * sides + s for s in range(sides))]
    obj = plane_mesh('Tapered checked timber pole', vertices, faces, 'utility-weathered-timber', root)
    for polygon in obj.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
        for li in polygon.loop_indices:
            vi = obj.data.loops[li].vertex_index
            vertex = obj.data.vertices[vi].co
            side = vi % sides
            u = side / sides
            if len(polygon.vertices) == 4 and min(v % sides for v in polygon.vertices) == 0 and max(v % sides for v in polygon.vertices) == sides - 1 and side == 0:
                u = 1
            obj.data.uv_layers.active.data[li].uv = (u, vertex.z / 2)
    return obj


def authored_bounds():
    bpy.context.view_layer.update()
    points = []
    graph = bpy.context.evaluated_depsgraph_get()
    for obj in bpy.context.scene.objects:
        if obj.type not in {'MESH', 'CURVE', 'FONT'}:
            continue
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        points.extend(evaluated.matrix_world @ vertex.co for vertex in mesh.vertices)
        evaluated.to_mesh_clear()
    low = [min(v[i] for v in points) for i in range(3)]
    high = [max(v[i] for v in points) for i in range(3)]
    return low, high


def save(name, colliders):
    low, high = authored_bounds()
    for image in bpy.data.images:
        if image.users and image.has_data:
            image.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets' / f'{name}.blend'), compress=True)
    # Keep all source parts editable; only the exported copy merges by material.
    bpy.ops.object.select_all(action='DESELECT')
    visible = [o for o in bpy.context.scene.objects if o.type in {'MESH', 'CURVE', 'FONT'}]
    for obj in visible:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = visible[0]
    bpy.ops.object.convert(target='MESH')
    materials = {}
    for obj in list(bpy.context.scene.objects):
        if obj.type == 'MESH':
            materials.setdefault(obj.data.materials[0].name, []).append(obj)
    for material_name, components in materials.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in components:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = components[0]
        bpy.ops.object.join()
        bpy.context.object.name = material_name
    bpy.ops.export_scene.gltf(filepath=str(MODELS / f'{name}.glb'), export_format='GLB', export_image_format='WEBP', export_image_quality=88, export_animations=False, export_lights=False)
    catalog[name] = {
        'source': f'assets/{name}.blend', 'model': f'models/{name}.glb',
        'authoring': 'scripts/author_utility_lines.py', 'colliders': colliders,
        'footprint': {'minX': low[0], 'maxX': high[0], 'minZ': -high[1], 'maxZ': -low[1]},
        'heightRange': [low[2], high[2]],
        'wireAttachmentHeight': 6.1, 'wireOffsets': [-.9, 0, .9],
    }
    if name == 'overhead-line-24m':
        catalog[name].update({'spanLength': 24, 'wireSag': .35})
    print('UTILITY_ASSET_COMPLETE', name, json.dumps(catalog[name]), flush=True)


r = start('utility-pole')
timber_trunk(r)
arm = cube('Weathered timber cross-arm', (0, 0, 5.78), (2.24, .17, .20), 'utility-weathered-timber', .008, r)
wood_beam_uvs(arm)
for side in [-1, 1]:
    beam('Galvanised diagonal arm brace', (side * .055, .245, 5.24), (side * .76, .01, 5.71), .033, 'utility-galvanised-iron', r)
    cube('Cross-arm mounting cheek', (side * .075, .11, 5.73), (.035, .37, .36), 'utility-galvanised-iron', .004, r)
for z in [5.65, 5.84]:
    bolt = cone('Cross-arm fixing bolt', (0, -.113, z), .025, .025, .052, 'utility-galvanised-iron', r, 6)
    bolt.rotation_euler[0] = math.pi / 2
for x in [-.9, 0, .9]:
    cone('Insulator steel pin', (x, 0, 5.94), .016, .016, .18, 'utility-galvanised-iron', r, 10)
    cone('Porcelain pin insulator core', (x, 0, 6.014), .038, .031, .16, 'utility-old-porcelain', r, 16)
    for z, radius in [(5.95, .073), (5.997, .066), (6.042, .054)]:
        cone('Porcelain weather shed', (x, 0, z), radius, radius * .59, .034, 'utility-old-porcelain', r, 20)
    cone('Conductor saddle', (x, 0, 6.08), .039, .033, .034, 'utility-old-porcelain', r, 16)
    for side in [-1, 1]:
        beam('Conductor clamp lip', (x + side * .021, -.034, 6.094), (x + side * .021, .034, 6.094), .011, 'utility-galvanised-iron', r)
for z in [1.85, 2.8, 3.75, 4.7]:
    for side in [-1, 1]:
        cube('Galvanised maintenance step', (side * .19, .245, z), (.23, .040, .045), 'utility-galvanised-iron', .004, r)
plate = cube('Riveted county utility number plate', (0, .051, 1.6), (.17, .015, .24), 'utility-galvanised-iron', .006, r)
text('Stamped pole number', 'WC\n074', (0, .040, 1.62), .048, 'utility-stamped-mark', parent=r)
for x in [-.064, .064]:
    for z in [1.505, 1.69]:
        rivet = cone('Number plate rivet', (x, .038, z), .006, .006, .009, 'utility-stamped-mark', r, 8)
        rivet.rotation_euler[0] = math.pi / 2
save('utility-pole', [{'x': 0, 'z': -.245, 'w': .42, 'd': .42}])

r = start('overhead-line-24m')
# A true catenary with a=. solve: a*(cosh(12/a)-1)=.35.
lo, hi = 1.0, 2000.0
for _ in range(70):
    a = (lo + hi) / 2
    if a * (math.cosh(12 / a) - 1) > .35:
        lo = a
    else:
        hi = a
a = (lo + hi) / 2
for wire_index, x in enumerate([-.9, 0, .9]):
    vertices, faces = [], []
    count, sides, radius = 49, 6, .006
    for i in range(count):
        t = -12 + i * 24 / (count - 1)
        height = 5.75 + a * (math.cosh(t / a) - 1)
        tangent = Vector((0, -1, math.sinh(t / a))).normalized()
        across = Vector((1, 0, 0))
        normal = tangent.cross(across).normalized()
        center = Vector((x, -t, height))
        for side in range(sides):
            angle = math.tau * side / sides
            vertices.append(tuple(center + radius * (math.cos(angle) * across + math.sin(angle) * normal)))
    for i in range(count - 1):
        for side in range(sides):
            nxt = (side + 1) % sides
            faces.append((i * sides + side, i * sides + nxt, (i + 1) * sides + nxt, (i + 1) * sides + side))
    obj = plane_mesh(f'Catenary conductor {wire_index + 1}', vertices, faces, 'utility-aged-conductor', r)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
        for li in polygon.loop_indices:
            vi = obj.data.loops[li].vertex_index
            obj.data.uv_layers.active.data[li].uv = ((vi % sides) / sides, (vi // sides) / 2)
save('overhead-line-24m', [])
(ARTIFACTS / 'utility-lines-catalog.json').write_text(json.dumps(catalog, indent=2))
print('UTILITY_LINES_SAVED', len(catalog), flush=True)
