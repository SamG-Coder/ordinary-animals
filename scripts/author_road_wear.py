"""Three independent, flush road detail assets, authored entirely in Blender.

Original albedo, roughness and tangent normal images are packed in every source.
The geometry is limited to 0..18 mm above the local road datum and has no collider.
Use these sparingly over straight road surfaces, away from painted markings.
"""
import ast
import bpy
import json
import math
import numpy as np
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / 'game-assets/models'
catalog = {}
SIZE = 1024
rng = np.random.default_rng(18471)
random.seed(18471)
for file, names in [
    ('author_blender.py', {'begin', 'link', 'empty', 'cube', 'cone', 'text', 'plane_mesh', 'material'}),
    ('detail_assets.py', {'setup'}),
    ('opening_art_pass.py', {'finish'}),
    ('road_surface_pass.py', {'field'}),
    ('briarfield_assets.py', {'surface', 'measured_uvs'}),
]:
    tree = ast.parse((ROOT / 'scripts' / file).read_text())
    exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names], type_ignores=[]), 'Blender helpers only', 'exec'))

yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32) / SIZE
fine, stone, silt, damp = field(490), field(156), field(32), field(6)
aggregate = np.clip((stone - .41) * 2.6, 0, 1)
wet = np.clip((damp - .32) * 2.1, 0, 1)
v = .108 + .081 * aggregate + .028 * fine + .012 * silt - .033 * wet
asphalt_color = np.stack([v * .96, v, v * 1.025], axis=-1)
asphalt_height = .0005 * fine + .00145 * aggregate + .00032 * silt
asphalt_roughness = np.clip(.84 + .10 * fine - .42 * wet, .33, .94)
bitumen_value = .055 + .026 * fine + .018 * silt
bitumen_color = np.stack([bitumen_value * .94, bitumen_value, bitumen_value * 1.03], axis=-1)
bitumen_height = .00016 * fine + .0003 * silt
bitumen_roughness = .42 + .19 * fine - .11 * wet
rust = np.clip((field(17) - .47) * 3.2, 0, 1) * np.clip((field(59) - .28) * 2.0, 0, 1)
scratches = np.clip((np.sin(xx * 940 + .12 * np.sin(yy * 11)) - .95) * 20, 0, 1) * field(4)
iron_value = .13 + .047 * fine + .033 * silt + .045 * scratches
iron_color = np.stack([iron_value + .087 * rust, iron_value + .019 * rust, iron_value * .98 - .034 * rust], axis=-1)
iron_height = .00033 * fine + .00045 * silt - .00029 * rust - .00009 * scratches
iron_roughness = np.clip(.46 + .23 * rust + .11 * silt - .15 * scratches, .29, .86)


def palette(name):
    root = setup(name)
    surface('repair-aggregate', asphalt_color, asphalt_height, asphalt_roughness, repeat=1)
    surface('repair-bitumen', bitumen_color, bitumen_height, bitumen_roughness, repeat=1)
    iron = surface('road-cast-iron', iron_color, iron_height, iron_roughness, repeat=.70)
    iron.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value = .70
    material('tread-polished-edge', (.19, .21, .21), .46, metal=.80)
    material('scar-dark-grit', (.046, .049, .047), .79)
    material('road-keyhole-shadow', (.006, .008, .008), .91)
    return root


def irregular_outline(rx, ry, count=128, exponent=1, phase=0):
    outline = []
    for i in range(count):
        a = i * math.tau / count
        r = 1 + .028 * math.sin(a * 9 + phase) + .021 * math.sin(a * 23 + .2) + .011 * math.sin(a * 43 + .8)
        c, s = math.cos(a), math.sin(a)
        outline.append((math.copysign(abs(c) ** exponent, c) * rx * r, math.copysign(abs(s) ** exponent, s) * ry * r))
    return outline


def shallow_surface(name, outline, rings, root, materials):
    """Concentric sewn mesh: every outer perimeter vertex joins the road datum."""
    count = len(outline)
    vertices = []
    for ring, (fraction, z) in enumerate(rings):
        for i, (x, y) in enumerate(outline):
            wave = 0 if ring == 0 else .0005 * math.sin(i * .64 + ring) + .0004 * math.cos(i * .23 - ring)
            vertices.append((x * fraction, y * fraction, max(0, z + wave)))
    faces, mat_ids = [], []
    for ring in range(len(rings) - 1):
        for i in range(count):
            n = (i + 1) % count
            # Clockwise inner loop gives the outward/upward top-face normal.
            faces.append((ring * count + i, ring * count + n, (ring + 1) * count + n, (ring + 1) * count + i))
            mat_ids.append(0 if ring < 2 else 1)
    centre = len(vertices)
    vertices.append((0, 0, rings[-1][1]))
    for i in range(count):
        faces.append(((len(rings) - 1) * count + i, (len(rings) - 1) * count + (i + 1) % count, centre))
        mat_ids.append(1)
    obj = plane_mesh(name, vertices, faces, materials[0], root)
    obj.data.materials.append(M[materials[1]])
    for poly, mat_id in zip(obj.data.polygons, mat_ids):
        poly.material_index = mat_id
        poly.use_smooth = True
    return obj


def ribbon(name, path, width, z, material_name, root):
    vertices, faces = [], []
    for i, p in enumerate(path):
        before = Vector(path[max(0, i - 1)])
        after = Vector(path[min(len(path) - 1, i + 1)])
        tangent = (after - before).normalized()
        normal = Vector((-tangent.y, tangent.x))
        w = width * (.55 + .45 * math.sin(i * 1.31 + .7) ** 2)
        vertices += [(p[0] + normal.x * w, p[1] + normal.y * w, z), (p[0] - normal.x * w, p[1] - normal.y * w, z)]
    for i in range(len(path) - 1):
        a = i * 2
        faces.append((a, a + 1, a + 3, a + 2))
    return plane_mesh(name, vertices, faces, material_name, root)


def scattered_chips(root, outline, count, z=.009):
    vertices, faces = [], []
    for i in range(count):
        point = outline[random.randrange(len(outline))]
        r = random.uniform(.81, .98)
        x, y = point[0] * r, point[1] * r
        size = random.uniform(.004, .013)
        a = len(vertices)
        angle = random.uniform(0, math.tau)
        for k in range(5):
            t = angle + k * math.tau / 5
            vertices.append((x + size * math.cos(t), y + size * math.sin(t), z + random.uniform(0, .002)))
        vertices.append((x, y, z + random.uniform(.003, .006)))
        for k in range(5):
            faces.append((a + k, a + (k + 1) % 5, a + 5))
    return plane_mesh('Exposed millimetre aggregate chips', vertices, faces, 'repair-aggregate', root)


def save(name):
    measured_uvs()
    bpy.context.view_layer.update()
    coords = []
    dg = bpy.context.evaluated_depsgraph_get()
    for obj in bpy.context.scene.objects:
        if obj.type not in {'MESH', 'FONT', 'CURVE'}:
            continue
        evaluated = obj.evaluated_get(dg)
        mesh = evaluated.to_mesh()
        coords.extend(tuple(evaluated.matrix_world @ v.co) for v in mesh.vertices)
        evaluated.to_mesh_clear()
    minimum = [min(p[i] for p in coords) for i in range(3)]
    maximum = [max(p[i] for p in coords) for i in range(3)]
    assert minimum[2] >= -.00001 and maximum[2] <= .018, (name, minimum, maximum)
    finish(name)
    catalog[name].update({
        'authoring': 'scripts/author_road_wear.py',
        'colliders': [],
        'surfaceDetail': True,
        'heightRange': [minimum[2], maximum[2]],
        'footprint': {'minX': minimum[0], 'maxX': maximum[0], 'minZ': -maximum[1], 'maxZ': -minimum[1]},
    })
    print('ROAD_WEAR_ASSET_COMPLETE', name, minimum, maximum, flush=True)


r = palette('asphalt-repair-2m')
outline = irregular_outline(1.04, .72, exponent=.44, phase=.9)
shallow_surface('Irregular flush asphalt repair', outline, [(1, .0006), (.982, .0014), (.947, .0033), (.91, .0078), (.73, .011), (.45, .010), (.16, .0093)], r, ['repair-bitumen', 'repair-aggregate'])
scattered_chips(r, outline, 72, .008)
for side in [-1, 1]:
    path = [(side * (.42 + i * .082), -.19 + .032 * math.sin(i * 1.8)) for i in range(6)]
    ribbon('Hairline split in old repair', path, .0017, .0121, 'scar-dark-grit', r)
save('asphalt-repair-2m')

r = palette('shallow-road-scar-1m')
outline = irregular_outline(.52, .21, count=112, exponent=.83, phase=2.5)
shallow_surface('Shallow fretted road surface', outline, [(1, .0004), (.97, .003), (.89, .010), (.76, .0065), (.51, .0028), (.21, .0015)], r, ['repair-aggregate', 'repair-bitumen'])
scattered_chips(r, outline, 58, .008)
# The scar branches are open-faced cracks, not tall tubes or a deep obstacle.
for path in [
    [(-.50, .018), (-.59, .04), (-.67, .016), (-.74, .05)],
    [(.45, -.036), (.57, -.073), (.65, -.045), (.75, -.072)],
    [(.23, .18), (.29, .25), (.25, .32), (.30, .38)],
    [(-.23, -.17), (-.28, -.24), (-.26, -.31)],
]:
    ribbon('Branching surface fracture', path, .0032, .0014, 'scar-dark-grit', r)
save('shallow-road-scar-1m')

r = palette('cast-iron-manhole')
outline = irregular_outline(.493, .493, exponent=1, phase=.8)
shallow_surface('Bitumen manhole bedding', outline, [(1, .0004), (.985, .0012), (.96, .0037), (.90, .0045), (.66, .004), (.2, .004)], r, ['repair-bitumen', 'repair-aggregate'])
cone('Dark iron seating well', (0, 0, .0055), .436, .436, .004, 'road-keyhole-shadow', r, 128)
count = 128
verts, faces = [], []
for radius, z in [(.441, .0045), (.431, .011), (.414, .0145), (.400, .0145), (.394, .008)]:
    for i in range(count):
        a = i * math.tau / count
        verts.append((math.cos(a) * radius, math.sin(a) * radius, z))
for ring in range(4):
    for i in range(count):
        n = (i + 1) % count
        faces.append((ring * count + i, ring * count + n, (ring + 1) * count + n, (ring + 1) * count + i))
ring = plane_mesh('Chamfered cast iron frame', verts, faces, 'road-cast-iron', r)
for p in ring.data.polygons:
    p.use_smooth = True
lid = cone('Removable cast iron lid', (0, 0, .009), .388, .388, .006, 'road-cast-iron', r, 128)
for p in lid.data.polygons:
    p.use_smooth = False
for x in [-.276, .276]:
    cutter = cube('Lift key opening cutter', (x, 0, .01), (.045, .082, .06), 'road-keyhole-shadow', 0, r)
    modifier = lid.modifiers.new('Open lifting key slot', 'BOOLEAN')
    modifier.operation = 'DIFFERENCE'
    modifier.object = cutter
    bpy.context.view_layer.objects.active = lid
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    cube('Recessed lifting key darkness', (x, 0, .0048), (.043, .080, .001), 'road-keyhole-shadow', 0, r)
verts, faces = [], []
for iy in range(-7, 8):
    for ix in range(-7, 8):
        x, y = ix * .049, iy * .049
        if math.hypot(x, y) > .35 or (abs(y) < .088 and abs(x) < .29) or (abs(x) > .244 and abs(y) < .062):
            continue
        base = len(verts)
        for z, factor in [(.0122, 1), (.0147, .69)]:
            for dx, dy in [(0, .016), (.0075, 0), (0, -.016), (-.0075, 0)]:
                verts.append((x + dx * factor, y + dy * factor, z))
        faces.append((base + 4, base + 7, base + 6, base + 5))
        for k in range(4):
            n = (k + 1) % 4
            faces.append((base + k, base + n, base + n + 4, base + k + 4))
plane_mesh('Worn cast anti-slip diamonds', verts, faces, 'tread-polished-edge', r)
for wording, y, size in [('SURFACE WATER', .036, .039), ('W.C.C  /  1984', -.045, .027)]:
    lettering = text('Original cast foundry lettering', wording, (0, y, .0124), size, 'tread-polished-edge', (0, 0, 0), r)
    lettering.data.extrude = .00045
save('cast-iron-manhole')

(ROOT / 'artifacts/road-wear-catalog.json').write_text(json.dumps(catalog, indent=2))
print('ROAD_WEAR_KIT_COMPLETE', len(catalog), flush=True)
