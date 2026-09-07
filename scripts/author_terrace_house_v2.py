"""A single modest two-storey brick terrace, with original Blender surface maps.

All individual walls, window/door parts, slates and drainage remain editable in
the saved source. Only the exported GLB batches rigid pieces by material.
"""
import ast
import bpy
import json
import math
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'artifacts'; ART.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
current = bpy.data.collections.new('terrace-house-v2'); bpy.context.scene.collection.children.link(current)
M, objects = {}, []
helpers = {'link', 'empty', 'cube', 'tube', 'plane_mesh', 'text', 'material'}
tree = ast.parse((ROOT / 'scripts/author_blender.py').read_text())
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in helpers], type_ignores=[]), 'Blender module helpers', 'exec'))
root = empty('terrace-house-v2')
rng = np.random.default_rng(31904)
SIZE = 1024
yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32) / SIZE
fine = rng.uniform(-1, 1, (SIZE, SIZE)).astype(np.float32)
mottle = (np.sin(xx * math.tau * 7 + np.sin(yy * math.tau * 4)) + np.cos(yy * math.tau * 9 + np.sin(xx * math.tau * 5))) / 2


def surface(name, colors, height, roughness=.86):
    image = bpy.data.images.new(name + ' original albedo', SIZE, SIZE, alpha=False)
    image.pixels.foreach_set(np.concatenate([np.clip(colors, 0, 1), np.ones((SIZE, SIZE, 1))], axis=2).astype(np.float32).ravel()); image.pack()
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * SIZE / 3.6
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * SIZE / 3.6
    n = np.stack([-dx, -dy, np.ones_like(dx)], axis=2); n /= np.linalg.norm(n, axis=2)[:, :, None]
    normal = bpy.data.images.new(name + ' original normal', SIZE, SIZE, alpha=False); normal.colorspace_settings.name = 'Non-Color'
    normal.pixels.foreach_set(np.concatenate([n * .5 + .5, np.ones((SIZE, SIZE, 1))], axis=2).astype(np.float32).ravel()); normal.pack()
    return material(name, (.2, .2, .2), roughness, texture=(image, normal))


# 1.8 m repeats: 225×75 mm courses including mortar, not oversized blocks.
row = np.floor(yy * 24)
bx = (xx * 8 + (row % 2) * .5) % 1
by = yy * 24 % 1
mortar = (bx < .043) | (by < .105)
brick_ids = (np.floor(xx * 8 + (row % 2) * .5) % 8 + row * 8).astype(int)
variation = rng.uniform(-.055, .055, 192)[brick_ids]
brick_value = .235 + variation + .025 * mottle + .012 * fine
brick = np.stack([brick_value, brick_value * .56, brick_value * .34], axis=2)
brick[mortar] = np.stack([.26 + fine[mortar] * .016, .247 + fine[mortar] * .016, .22 + fine[mortar] * .016], axis=1)
surface('Old red stock brick', brick, .0008 * fine + .0013 * mottle - .005 * mortar, .90)
slate_value = .052 + .008 * mottle + .003 * fine + .0025 * np.sin(xx * 780 + np.sin(yy * 31))
surface('Rain worn slate', np.stack([slate_value * .83, slate_value, slate_value * 1.09], axis=2), .0007 * fine + .0012 * mottle, .76)
paint_value = .43 + .025 * mottle + .007 * fine
surface('Weathered window paint', np.stack([paint_value, paint_value * .965, paint_value * .85], axis=2), .00015 * fine + .0004 * mottle, .88)
stone_value = .27 + .025 * mottle + .01 * fine
surface('Cut stone lintels', np.stack([stone_value, stone_value * .98, stone_value * .91], axis=2), .0004 * fine + .0015 * mottle, .92)
material('Dark painted front door', (.019, .048, .042), .71)
material('Wet iron drainage', (.020, .029, .032), .55, metal=.42)
material('Old lead flashing', (.13, .145, .145), .66, metal=.58)
material('Unlit recessed glazing', (.019, .034, .041), .28, metal=.12)
material('Curtain through glass', (.115, .106, .078), .82)
material('Interior darkness', (.004, .006, .007), .99)
# Match the linear-space value of the colour-managed slate image. Large direct
# RGB values here would turn occasional replacement slates into white patches.
material('Dark slate variation', (.0033, .0041, .0045), .83)
material('Light slate variation', (.0058, .0066, .0071), .79)
material('Dull door brass', (.25, .185, .08), .51, metal=.68)
material('Terracotta chimney pot', (.17, .080, .041), .94)


def metre_uv(obj, repeat=1.8):
    if obj.type != 'MESH': return
    if not obj.data.uv_layers: obj.data.uv_layers.new(name='UVMap')
    bpy.context.view_layer.update()
    for polygon in obj.data.polygons:
        n = polygon.normal
        axis = max(range(3), key=lambda a: abs(n[a]))
        axes = [a for a in range(3) if a != axis]
        for li in polygon.loop_indices:
            p = obj.matrix_world @ obj.data.vertices[obj.data.loops[li].vertex_index].co
            obj.data.uv_layers.active.data[li].uv = (p[axes[0]] / repeat, p[axes[1]] / repeat)


def block(name, pos, dims, mat, bevel=.006, parent=root):
    obj = cube(name, pos, dims, mat, bevel, parent)
    metre_uv(obj)
    return obj


WIDTH, DEPTH, EAVES, RIDGE = 7.6, 6.4, 4.80, 6.15
front_y, rear_y = -DEPTH / 2, DEPTH / 2
front_holes = [(-3.08, -2.14, .12, 2.15), (-1.25, .03, .66, 2.13), (1.38, 2.72, .66, 2.13), (-3.0, -1.80, 2.89, 4.32), (-.69, .57, 2.89, 4.32), (1.70, 2.90, 2.89, 4.32)]
rear_holes = [(-2.70, -1.35, .69, 2.15), (.75, 2.55, .69, 2.15), (-2.65, -1.40, 2.90, 4.30), (.82, 2.40, 2.90, 4.30)]


def perforated_wall(name, y, holes):
    xs = sorted(set([-WIDTH / 2, WIDTH / 2] + [v for h in holes for v in h[:2]]))
    zs = sorted(set([.12, EAVES] + [v for h in holes for v in h[2:]]))
    for a, b in zip(xs, xs[1:]):
        for c, d in zip(zs, zs[1:]):
            x, z = (a + b) / 2, (c + d) / 2
            if any(h[0] < x < h[1] and h[2] < z < h[3] for h in holes): continue
            block(name, (x, y, z), (b - a, .24, d - c), 'Old red stock brick', 0)


perforated_wall('Front brick around real openings', front_y + .12, front_holes)
perforated_wall('Rear brick around real openings', rear_y - .12, rear_holes)
for side in [-1, 1]:
    block('Gable end brickwork', (side * (WIDTH / 2 - .12), 0, (EAVES + .12) / 2), (.24, DEPTH - .48, EAVES - .12), 'Old red stock brick', 0)
    gable = plane_mesh('Triangular brick gable', [(side * WIDTH / 2, -DEPTH / 2, EAVES), (side * WIDTH / 2, 0, RIDGE - .08), (side * WIDTH / 2, DEPTH / 2, EAVES)], [(0, 1, 2) if side < 0 else (2, 1, 0)], 'Old red stock brick', root)
    metre_uv(gable)
block('Damp brick foundation', (0, 0, .075), (WIDTH, DEPTH, .15), 'Old red stock brick', .012)


def window(name, rect, wall_y, direction):
    left, right, bottom, top = rect
    x, z = (left + right) / 2, (bottom + top) / 2
    w, h = right - left, top - bottom
    inside = wall_y - direction * .14
    face_y = wall_y + direction * .025
    # Actual wall aperture and 14 cm reveal; dark room backing sits behind glass.
    block(name + ' room backing', (x, inside - direction * .025, z), (w - .025, .02, h - .025), 'Interior darkness', 0)
    block(name + ' glazing', (x, inside, z), (w - .09, .009, h - .08), 'Unlit recessed glazing', .002)
    for side in [-1, 1]:
        block(name + ' masonry reveal', (x + side * (w / 2 - .022), wall_y - direction * .07, z), (.044, .14, h), 'Weathered window paint', .001)
        block(name + ' sash jamb', (x + side * (w / 2 - .048), face_y, z), (.070, .057, h - .035), 'Weathered window paint', .004)
    for zz in [bottom + .036, top - .036]:
        block(name + ' frame rail', (x, face_y, zz), (w - .06, .057, .070), 'Weathered window paint', .004)
    block(name + ' meeting rail', (x, face_y - direction * .008, z + .030), (w - .14, .051, .034), 'Weathered window paint', .003)
    block(name + ' vertical glazing bar', (x, face_y - direction * .012, z), (.028, .042, h - .14), 'Weathered window paint', .002)
    block(name + ' stone lintel', (x, wall_y + direction * .012, top + .065), (w + .20, .30, .13), 'Cut stone lintels', .010)
    sill = block(name + ' sloping stone sill', (x, wall_y + direction * .077, bottom - .039), (w + .19, .35, .085), 'Cut stone lintels', .012)
    sill.rotation_euler.x = direction * -.07
    # Subdued narrow blind slats live behind the window bars, within the reveal.
    for k in range(3):
        block(name + ' dim interior blind', (x, inside + direction * .007, top - .14 - k * .073), (w - .14, .005, .022), 'Curtain through glass', 0)


for i, rect in enumerate(front_holes[1:]): window('Front window ' + str(i + 1), rect, front_y, -1)
for i, rect in enumerate(rear_holes): window('Rear window ' + str(i + 1), rect, rear_y, 1)

door_x = -2.61
block('Recessed front door', (door_x, front_y + .09, 1.13), (.87, .054, 1.98), 'Dark painted front door', .009)
for side in [-1, 1]:
    block('Door masonry reveal', (door_x + side * .455, front_y + .085, 1.13), (.040, .17, 2.04), 'Weathered window paint', .002)
    block('Door casing', (door_x + side * .48, front_y - .022, 1.13), (.064, .052, 2.12), 'Weathered window paint', .004)
block('Door frame head', (door_x, front_y - .022, 2.17), (1.02, .052, .075), 'Weathered window paint', .005)
block('Door head stone', (door_x, front_y + .005, 2.26), (1.18, .28, .13), 'Cut stone lintels', .01)
for side in [-1, 1]:
    for z in [.47, .96]:
        block('Door recessed panel', (door_x + side * .208, front_y + .058, z), (.32, .022, .37), 'Dark painted front door', .006)
    block('Upper door glazing', (door_x + side * .202, front_y + .056, 1.64), (.29, .010, .51), 'Unlit recessed glazing', .004)
block('Brass letter plate', (door_x, front_y + .042, 1.246), (.236, .014, .042), 'Dull door brass', .006)
block('Door handle plate', (door_x + .322, front_y + .040, 1.01), (.041, .012, .10), 'Dull door brass', .006)
handle = tube('Lever door handle', [(door_x + .32, front_y + .023, 1.021), (door_x + .32, front_y -.006, 1.021), (door_x + .255, front_y -.009, 1.021)], .009, 'Dull door brass', root); handle.data.resolution_u = 4; handle.data.bevel_resolution = 1
block('Stone door threshold', (door_x, front_y - .052, .12), (1.07, .30, .085), 'Cut stone lintels', .015)
block('Worn entrance step', (door_x, front_y - .24, .054), (1.22, .44, .108), 'Cut stone lintels', .017)
text('Small house number', '18', (door_x, front_y + .042, 1.958), .057, 'Dull door brass', parent=root)

# Thin, individually authored overlapping slate courses on two pitched slopes.
roof_half = 3.47
roof_width = 8.04
slope = (RIDGE - EAVES) / (DEPTH / 2)
eave_z = RIDGE - roof_half * slope
for side in [-1, 1]:
    roof = plane_mesh('Roof weather deck', [(-roof_width / 2, 0, RIDGE), (roof_width / 2, 0, RIDGE), (roof_width / 2, side * roof_half, eave_z), (-roof_width / 2, side * roof_half, eave_z)], [(0, 1, 2, 3) if side > 0 else (3, 2, 1, 0)], 'Rain worn slate', root)
    metre_uv(roof)
    courses = 17
    for row in range(courses):
        # Work uphill from the eave, so every course overlaps the one below.
        outer = roof_half - row * .201
        inner = max(0, outer - .31)
        x = -roof_width / 2 - (.138 if row % 2 else 0)
        while x < roof_width / 2:
            xa, xb = max(-roof_width / 2, x), min(roof_width / 2, x + .27)
            if xb - xa > .025:
                jitter = float(rng.uniform(-.006, .006))
                za, zb = RIDGE - outer * slope + .014 + jitter, RIDGE - inner * slope + .014 + jitter
                mat = 'Rain worn slate' if rng.random() > .16 else ('Dark slate variation' if rng.random() > .5 else 'Light slate variation')
                v = [(xa, side * outer, za), (xb - .003, side * outer, za), (xb - .003, side * inner, zb), (xa, side * inner, zb)]
                tile = plane_mesh('Overlapping individual slate', v, [(0, 1, 2, 3) if side < 0 else (3, 2, 1, 0)], mat, root)
                metre_uv(tile)
            x += .274
    block('Eaves fascia', (0, side * 3.35, eave_z - .025), (roof_width, .084, .17), 'Weathered window paint', .008)
    # Open half-round gutter with a thin metal wall, running under the roof edge.
    pts = []
    for x in [-roof_width / 2, roof_width / 2]:
        for j in range(17):
            a = math.pi + j / 16 * math.pi
            pts.append((x, side * 3.45 + math.cos(a) * .055, eave_z + math.sin(a) * .055 - .06))
    gutter = plane_mesh('Half round rain gutter', pts, [(j, j + 1, j + 18, j + 17) for j in range(16)], 'Wet iron drainage', root)
    gutter.modifiers.new('Gutter metal thickness', 'SOLIDIFY').thickness = .003
    for x in [-3.7, -2.2, -.7, .8, 2.3, 3.7]:
        block('Gutter hanger', (x, side * 3.43, eave_z - .068), (.026, .115, .018), 'Wet iron drainage', .003)
    pipe_x = -3.57 if side < 0 else 3.57
    pipe = tube('Rain downspout', [(pipe_x, side * 3.46, eave_z - .07), (pipe_x, side * 3.44, 4.38), (pipe_x, side * 3.27, 4.22), (pipe_x, side * 3.27, .25), (pipe_x, side * 3.41, .10)], .038, 'Wet iron drainage', root)
    pipe.data.resolution_u = 5; pipe.data.bevel_resolution = 2
    for z in [.65, 2.15, 3.70]: block('Pipe wall strap', (pipe_x, side * 3.27, z), (.09, .083, .027), 'Wet iron drainage', .003)
for x in np.arange(-3.96, 4.0, .33):
    verts = [(float(xx), math.cos(a) * .102, RIDGE + .02 + math.sin(a) * .102) for xx in [x, min(x + .34, 4.02)] for a in np.linspace(0, math.pi, 13)]
    cap = plane_mesh('Rounded ridge cap', verts, [(j, j + 1, j + 14, j + 13) for j in range(12)], 'Rain worn slate', root)
    cap.modifiers.new('Ridge tile thickness', 'SOLIDIFY').thickness = .012
    metre_uv(cap)
for side in [-1, 1]:
    x = side * 3.87
    for roof_side in [-1, 1]:
        fascia = plane_mesh('Gable bargeboard', [(x, 0, RIDGE + .010), (x, roof_side * roof_half, eave_z), (x, roof_side * roof_half, eave_z - .145), (x, 0, RIDGE - .135)], [(0, 1, 2, 3)], 'Weathered window paint', root)
        fascia.modifiers.new('Bargeboard thickness', 'SOLIDIFY').thickness = .05
        metre_uv(fascia)

# Modest chimney, stepped flashing, terracotta pots with visible dark bores.
block('Brick chimney stack', (2.61, .15, 6.00), (.70, .66, 1.55), 'Old red stock brick', .01)
block('Chimney capstone', (2.61, .15, 6.80), (.82, .77, .12), 'Cut stone lintels', .018)
for x in [2.43, 2.79]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=.100, depth=.31, location=(x, .15, 7.015))
    pot = link(bpy.context.object, 'Terracotta chimney pot', 'Terracotta chimney pot', root)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=.074, depth=.003, location=(x, .15, 7.172))
    link(bpy.context.object, 'Chimney pot dark opening', 'Interior darkness', root)
for side in [-1, 1]:
    lead = plane_mesh('Roof to chimney flashing', [(2.20, .15 + side * .39, 5.99), (3.02, .15 + side * .39, 5.99), (3.10, .15 + side * .56, 5.90), (2.12, .15 + side * .56, 5.90)], [(0, 1, 2, 3)], 'Old lead flashing', root)

bpy.context.view_layer.update()
root['roof_ridge_metres'] = RIDGE
root['eaves_metres'] = EAVES
root['authoring'] = 'Individual masonry, recessed windows, door, slates and drainage, authored in Blender'
root['footprint'] = '7.60 m wide × 6.40 m deep brickwork; entrance step reaches front 3.66 m'
for image in bpy.data.images:
    if image.users and image.has_data: image.pack()
source_meshes = sum(o.type == 'MESH' for o in current.objects)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/terrace-house-v2.blend'), compress=True)

# Batch export only. The saved .blend above preserves every editable component.
groups = {}
for obj in list(current.objects):
    if obj.type not in {'MESH', 'CURVE', 'FONT'}: continue
    if obj.type == 'FONT': obj.data.resolution_u = 3
    groups.setdefault(obj.data.materials[0], []).append(obj)
for mat, group in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in group: obj.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    bpy.ops.object.convert(target='MESH')
    if len(group) > 1: bpy.ops.object.join()
    bpy.context.object.name = 'Terrace / ' + mat.name
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'game-assets/models/terrace-house-v2.glb'), export_format='GLB', export_image_format='WEBP', export_image_quality=88, export_animations=False, export_apply=True, export_extras=True)
entry = {'model': 'models/terrace-house-v2.glb', 'source': 'assets/terrace-house-v2.blend', 'colliders': [{'x': 0, 'z': .21, 'w': 7.60, 'd': 6.98}]}
(ART / 'terrace-house-v2-catalog-fragment.json').write_text(json.dumps(entry, indent=2))

scene = bpy.context.scene; scene.render.engine = 'CYCLES'; scene.cycles.samples = 48; scene.cycles.use_denoising = True
scene.render.resolution_x = 1280; scene.render.resolution_y = 1024; scene.render.resolution_percentage = 100
scene.world.color = (.095, .115, .14); scene.view_settings.view_transform = 'AgX'
for name, pos, energy, color, size in [('Cloudy sky', (-4, -6, 11), 1300, (.72, .84, 1), 7), ('Warm road lamp', (7, -5, 6), 500, (1, .80, .60), 5), ('Roof rim', (0, 7, 11), 1600, (.65, .76, 1), 5)]:
    d = bpy.data.lights.new(name, 'AREA'); d.energy = energy; d.color = color; d.size = size
    o = bpy.data.objects.new(name, d); scene.collection.objects.link(o); o.location = pos; o.rotation_euler = (Vector((0, 0, 3)) - o.location).to_track_quat('-Z', 'Y').to_euler()
d = bpy.data.cameras.new('Review camera'); cam = bpy.data.objects.new('Review camera', d); scene.collection.objects.link(cam); scene.camera = cam; d.lens = 45
for name, pos, look in [('front', (11, -15, 8), (0, 0, 3.25)), ('child-view', (-.8, -10, 1.25), (0, -2, 2.7)), ('rear', (-10, 15, 7), (0, 0, 3))]:
    cam.location = pos; cam.rotation_euler = (Vector(look) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(ART / ('terrace-house-v2-' + name + '.png')); bpy.ops.render.render(write_still=True)
print('TERRACE_HOUSE_V2_AUTHORED', json.dumps({'catalog': entry, 'source_mesh_components': source_meshes, 'roof_ridge': RIDGE, 'eaves': EAVES}))
