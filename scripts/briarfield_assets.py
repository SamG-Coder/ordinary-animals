"""Blender-authored, individually editable Briarfield architecture and garden props.

This authoring pass writes only its own sources/exports and a proposed catalog in
artifacts. District placement remains JavaScript; no regional mesh is authored.
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
ARTIFACTS = ROOT / 'artifacts'
ARTIFACTS.mkdir(exist_ok=True)
catalog = {}
SIZE = 1024
rng = np.random.default_rng(2903)
random.seed(2903)
for file, names in [
    ('author_blender.py', {'begin', 'link', 'empty', 'cube', 'cone', 'tube', 'text', 'plane_mesh', 'ellipsoid', 'material'}),
    ('detail_assets.py', {'setup'}),
    ('opening_art_pass.py', {'finish'}),
    ('road_surface_pass.py', {'field'}),
]:
    tree = ast.parse((ROOT / 'scripts' / file).read_text())
    exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names], type_ignores=[]), 'Blender modeling helpers', 'exec'))

# Original image maps are authored here inside Blender and packed with each source.
# The brick repeat is two metres; separate glass maps retain vertical rain trails.
yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32) / SIZE
grain, middle, stains = field(380), field(32), field(7)
rows = np.floor(yy * 23)
brick_x = (xx * 8 + (rows % 2) * .5) % 1
brick_y = (yy * 23) % 1
mortar = (brick_x < .035) | (brick_y < .06)
brick_ids = (np.floor(xx * 8 + (rows % 2) * .5) % 8 + rows * 8).astype(int)
brick_variation = rng.uniform(-.055, .04, 184)[brick_ids]
brick_value = .29 + grain * .055 + middle * .045 - stains * .055 + brick_variation
brick_pixels = np.stack([brick_value, brick_value * .71, brick_value * .52], axis=-1)
brick_pixels[mortar] = np.stack([.24 + .025 * grain[mortar]] * 3, axis=-1)
brick_height = .0015 * grain + .001 * middle - .0038 * mortar
wood_wave = np.sin(xx * 1000 + np.sin(xx * 57 + yy * 11) * 3)
wood_value = .19 + .012 * wood_wave + .038 * middle + .022 * grain - .04 * stains
wood_pixels = np.stack([wood_value * .73, wood_value, wood_value * .82], axis=-1)
wood_height = .00025 * wood_wave + .0008 * middle
slate_value = .17 + .025 * grain + .05 * middle - .045 * stains
slate_pixels = np.stack([slate_value * .86, slate_value, slate_value * 1.025], axis=-1)
slate_height = .0007 * grain + .0015 * middle
trails = np.sin(xx * 510 + np.sin(yy * 3 + xx * 70) * 2) ** 18
glass_value = .19 + .07 * stains + .045 * middle + .017 * grain - .026 * trails
glass_pixels = np.stack([glass_value * .78, glass_value, glass_value * .91], axis=-1)
glass_height = .0005 * trails + .00018 * grain
glass_roughness = np.clip(.24 + .36 * stains + .16 * trails, .25, .86)
soil_value = .105 + .045 * grain + .028 * middle - .035 * stains
soil_pixels = np.stack([soil_value, soil_value * .72, soil_value * .42], axis=-1)
soil_height = .0016 * grain + .005 * middle


def surface(name, color, height, roughness=.87, repeat=2):
    mat = material(name, (.2, .2, .2), float(roughness) if np.isscalar(roughness) else .5)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    normal = np.stack([
        -(np.roll(height, -1, 1) - np.roll(height, 1, 1)) / (2 * repeat / SIZE),
        -(np.roll(height, -1, 0) - np.roll(height, 1, 0)) / (2 * repeat / SIZE),
        np.ones_like(height),
    ], axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    maps = [('Color', color), ('Normal', normal * .5 + .5)]
    if not np.isscalar(roughness):
        maps.append(('Roughness', np.repeat(roughness[:, :, None], 3, axis=2)))
    for label, pixels in maps:
        im = bpy.data.images.new(name + ' ' + label, width=SIZE, height=SIZE, alpha=False)
        if label != 'Color':
            im.colorspace_settings.name = 'Non-Color'
        rgba = np.concatenate([pixels, np.ones((SIZE, SIZE, 1), dtype=np.float32)], axis=-1)
        im.pixels.foreach_set(rgba.astype(np.float32).ravel())
        im.pack()
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = im
        if label == 'Normal':
            conv = nodes.new('ShaderNodeNormalMap')
            links.new(tex.outputs['Color'], conv.inputs['Color'])
            links.new(conv.outputs['Normal'], shader.inputs['Normal'])
        else:
            links.new(tex.outputs['Color'], shader.inputs['Base Color' if label == 'Color' else 'Roughness'])
    mat['repeat_metres'] = repeat
    return mat


def palette(name):
    root = setup(name)
    surface('briar-brick', brick_pixels, brick_height)
    surface('briar-painted-wood', wood_pixels, wood_height, .78)
    surface('briar-slate', slate_pixels, slate_height, .81)
    surface('briar-dirty-glass', glass_pixels, glass_height, glass_roughness)
    surface('briar-soil', soil_pixels, soil_height, .94)
    material('briar-iron', (.034, .047, .039), .66, metal=.25)
    material('briar-putty', (.24, .29, .23), .85)
    material('briar-lime', (.36, .36, .30), .93)
    material('briar-timber', (.15, .12, .078), .96)
    material('briar-green-leaf', (.062, .10, .045), .89)
    material('briar-dead-leaf', (.10, .067, .029), .97)
    material('briar-terra', (.21, .11, .061), .89)
    material('briar-window-warm', (.31, .22, .11), .76, emission=.5)
    return root


def measured_uvs():
    bpy.context.view_layer.update()
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH' or not obj.data.uv_layers or not obj.data.materials:
            continue
        repeat = obj.data.materials[0].get('repeat_metres')
        if not repeat:
            continue
        for poly in obj.data.polygons:
            for li in poly.loop_indices:
                v = obj.matrix_world @ obj.data.vertices[obj.data.loops[li].vertex_index].co
                uv = (v.x / repeat, v.y / repeat) if abs(poly.normal.z) > .5 else ((v.y if abs(poly.normal.x) > .5 else v.x) / repeat, v.z / repeat)
                obj.data.uv_layers.active.data[li].uv = uv


def save(name, colliders=None, animated=False):
    measured_uvs()
    finish(name, animated)
    if colliders:
        catalog[name]['colliders'] = colliders
    catalog[name]['authoring'] = 'scripts/briarfield_assets.py'


def sash(root, x, y, z, width=1.36, height=1.66, warm=False):
    cube('Recessed stone surround', (x, y, z), (width + .26, .14, height + .23), 'briar-lime', .012, root)
    cube('Window reveal shadow', (x, y - .081, z), (width + .06, .017, height + .04), 'black', .002, root)
    cube('Grimed window', (x, y - .095, z), (width, .023, height), 'briar-window-warm' if warm else 'briar-dirty-glass', .003, root)
    for dx in [-width / 2, 0, width / 2]:
        cube('Sash vertical', (x + dx, y - .13, z), (.045, .075, height + .08), 'briar-painted-wood', .003, root)
    for dz in [-height / 2, 0, height / 2]:
        cube('Sash transom', (x, y - .13, z + dz), (width + .08, .075, .044), 'briar-painted-wood', .003, root)
    cube('Drip sill', (x, y - .24, z - height / 2 - .07), (width + .32, .42, .12), 'briar-lime', .012, root)


def straight_tube(name, a, b, radius, mat, root):
    midpoint = (Vector(a) + Vector(b)) / 2
    length = (Vector(b) - Vector(a)).length
    obj = cone(name, midpoint, radius, radius, length, mat, root, 12)
    obj.rotation_euler = (Vector(b) - Vector(a)).to_track_quat('Z', 'Y').to_euler()
    return obj


r = palette('groundskeeper-lodge')
cube('Lodge masonry', (0, 0, 1.7), (9, 7, 3.4), 'briar-brick', .019, r)
for y, front in [(-3.5, True), (3.5, False)]:
    verts = [(-4.5, y, 3.4), (4.5, y, 3.4), (0, y, 5.56)]
    plane_mesh('Gable masonry', verts, [(0, 1, 2) if front else (2, 1, 0)], 'briar-brick', r)
    cube('Damp course', (0, y, .22), (9.08, .20, .44), 'briar-lime', .006, r)
for side in [-1, 1]:
    roof = cube('Slate roof underlay', (side * 2.25, 0, 4.5), (5.14, 7.66, .13), 'briar-slate', .012, r)
    roof.rotation_euler[1] = side * math.atan2(2.16, 4.5)
    # Rows of real overlapping slate courses break the roof silhouette at the eaves.
    for course in range(12):
        x = side * (.22 + course * .391)
        z = 5.56 - abs(x) * 2.16 / 4.5 + .1
        for tile in range(17):
            y = -3.57 + tile * .445 + (course % 2) * .11
            slate = cube('Overlapping individual slate', (x, y, z), (.49, .437, .028), 'briar-slate', .002, r)
            slate.rotation_euler[1] = side * math.atan2(2.16, 4.5)
    tube('Eaves gutter', [(side * 4.69, -3.78, 3.36), (side * 4.69, 3.76, 3.36)], .049, 'briar-iron', r)
    tube('Downpipe', [(side * 4.38, -3.62, 3.4), (side * 4.38, -3.68, 3.16), (side * 4.38, -3.68, .2), (side * 4.38, -3.84, .13)], .035, 'briar-iron', r)
    straight_tube('Gable bargeboard', (0, -3.86, 5.65), (side * 4.86, -3.86, 3.32), .059, 'briar-painted-wood', r)
cube('Ridge cap', (0, 0, 5.65), (.16, 7.79, .16), 'briar-slate', .045, r)
for x in [-2.7, 2.7]:
    sash(r, x, -3.57, 1.78, 1.65, 1.75, warm=x > 0)
sash(r, 0, -3.54, 4.28, .80, .95)
cube('Recessed entrance', (0, -3.61, 1.26), (1.65, .18, 2.52), 'briar-lime', .012, r)
cube('Paneled keeper door', (0, -3.72, 1.22), (1.31, .10, 2.43), 'briar-painted-wood', .01, r)
for x in [-.30, .30]:
    for z in [.55, 1.18]:
        cube('Recessed door panel', (x, -3.782, z), (.49, .032, .49), 'briar-iron', .011, r)
cube('Door glazed toplight', (0, -3.788, 1.95), (1.03, .015, .63), 'briar-dirty-glass', .003, r)
straight_tube('Old brass handle', (.47, -3.855, 1.04), (.47, -3.855, 1.25), .014, 'steel', r)
cube('Boot scraper', (-.89, -4.04, .18), (.37, .08, .24), 'briar-iron', .004, r)
cube('Entrance threshold', (0, -3.91, .035), (1.87, .72, .075), 'briar-lime', .014, r)
awning = cube('Porch lead roof', (0, -3.94, 2.94), (2.02, 1.19, .08), 'briar-slate', .006, r)
awning.rotation_euler[0] = math.radians(-12)
for x in [-.85, .85]:
    straight_tube('Porch iron bracket', (x, -3.59, 2.33), (x, -4.38, 2.81), .017, 'briar-iron', r)
cube('County office sign', (0, -3.697, 3.17), (3.40, .09, .31), 'briar-painted-wood', .008, r)
text('Lodge sign', 'COUNTY GROUNDS OFFICE', (0, -3.748, 3.09), .159, 'paper', parent=r)
cube('Trespass badge plate', (1.17, -3.61, 1.60), (.52, .05, .62), 'briar-iron', .006, r)
text('League number', 'LEAGUE 03', (1.17, -3.641, 1.76), .055, 'paper', parent=r)
text('Badge title', 'TRESPASS', (1.17, -3.642, 1.54), .055, 'paper', parent=r)
cube('Chimney stack', (2.5, 1.65, 5.19), (.74, .98, 1.58), 'briar-brick', .012, r)
cube('Chimney crown', (2.5, 1.65, 6.01), (.90, 1.1, .13), 'briar-lime', .016, r)
for y in [1.4, 1.88]:
    cone('Chimney pot', (2.5, y, 6.27), .13, .10, .41, 'briar-terra', r)
    cone('Pot opening', (2.5, y, 6.48), .087, .087, .009, 'black', r)
# A garden hose and a real tap anchor the lodge to its caretaker's daily work.
for turn in range(4):
    points = [(3.95 + .24 * math.cos(i * math.tau / 32), -3.68 - turn * .025, .79 + .24 * math.sin(i * math.tau / 32)) for i in range(33)]
    tube('Coiled rubber hose', points, .014, 'briar-iron', r)
tube('Hose tail', [(4.12, -3.77, .61), (4.20, -3.80, .23), (4.26, -4.2, .035)], .014, 'briar-iron', r)
save('groundskeeper-lodge', [{'x': 0, 'z': 0, 'w': 9.12, 'd': 7.18}])

r = palette('weathered-glasshouse')
cube('Brick greenhouse foundation', (0, 0, .27), (8, 12, .54), 'briar-brick', .015, r)
cube('Foundation coping', (0, 0, .565), (8.16, 12.16, .11), 'briar-lime', .012, r)
for side in [-1, 1]:
    x = side * 3.97
    for row in range(9):
        y = -5.34 + row * 1.335
        for level in range(2):
            pane = cube('Opaque weathered glass side', (x, y, 1.12 + level * 1.03), (.028, 1.278, .979), 'briar-dirty-glass', .002, r)
        cube('Cast iron side mullion', (x, y - .66, 1.58), (.065, .05, 2.04), 'briar-painted-wood', .003, r)
    for z in [.63, 1.61, 2.62]:
        cube('Long glazing bar', (x, 0, z), (.071, 12.03, .052), 'briar-painted-wood', .003, r)
    tube('Glasshouse rain gutter', [(side * 4.10, -6.13, 2.62), (side * 4.10, 6.13, 2.62)], .045, 'briar-iron', r)
    for row in range(9):
        y = -5.34 + row * 1.335
        roof = cube('Dirty pitched roof pane', (side * 2, y, 3.47), (4.30, 1.28, .028), 'briar-dirty-glass', .002, r)
        roof.rotation_euler[1] = side * math.atan2(1.7, 4)
    for row in range(10):
        y = -6 + row * 1.335
        straight_tube('Roof iron glazing bar', (side * 4.06, y, 2.65), (0, y, 4.35), .023, 'briar-painted-wood', r)
    straight_tube('Roof purlin', (side * 2, -6.13, 3.50), (side * 2, 6.15, 3.50), .025, 'briar-painted-wood', r)
    tube('Greenhouse downpipe', [(side * 4.10, -5.5, 2.61), (side * 4.14, -5.52, 2.42), (side * 4.14, -5.52, .15)], .032, 'briar-iron', r)
for y in [-6, 6]:
    cube('End glass plane', (0, y, 1.60), (7.94, .028, 2.01), 'briar-dirty-glass', .002, r)
    for x in [-4, -2.66, -1.33, 0, 1.33, 2.66, 4]:
        cube('End vertical glazing bar', (x, y, 1.63), (.062, .08, 2.10), 'briar-painted-wood', .003, r)
    for z in [.64, 1.6, 2.63]:
        cube('End horizontal glazing bar', (0, y, z), (8.02, .075, .059), 'briar-painted-wood', .003, r)
    plane_mesh('Triangular glazed gable', [(-4, y, 2.64), (4, y, 2.64), (0, y, 4.34)], [(0, 1, 2) if y < 0 else (2, 1, 0)], 'briar-dirty-glass', r)
    for x in [-3, -2, -1, 0, 1, 2, 3]:
        straight_tube('Gable glazing divisions', (x, y - .026, 2.64), (x, y - .026, 4.33 - abs(x) * 1.7 / 4), .021, 'briar-painted-wood', r)
    for side in [-1, 1]:
        straight_tube('Gable frame', (side * 4.06, y - .04, 2.61), (0, y - .04, 4.38), .034, 'briar-painted-wood', r)
cube('Glasshouse door frame', (0, -6.08, 1.39), (1.67, .16, 2.64), 'briar-painted-wood', .008, r)
cube('Glasshouse glazed door', (0, -6.18, 1.61), (1.40, .036, 1.85), 'briar-dirty-glass', .003, r)
for z in [.63, 1.35, 2.02, 2.61]:
    cube('Door glazing rail', (0, -6.23, z), (1.51, .045, .057), 'briar-putty', .003, r)
cube('Door central bar', (0, -6.23, 1.61), (.052, .045, 1.94), 'briar-putty', .003, r)
straight_tube('Glasshouse door pull', (.54, -6.31, 1.05), (.54, -6.31, 1.27), .014, 'briar-iron', r)
cube('Propagation house plate', (0, -6.12, 2.91), (2.88, .045, .34), 'briar-iron', .004, r)
text('Propagation house name', 'PROPAGATION HOUSE 03', (0, -6.149, 2.82), .133, 'paper', parent=r)
text('Propagation house warning', 'UNSUPERVISED ACCESS RESTRICTED', (0, -6.268, 2.30), .057, 'paper', parent=r)
cube('Ridge iron cap', (0, 0, 4.39), (.11, 12.33, .095), 'briar-iron', .016, r)
for y in [-5.9, -4.3, -2.7, -1.1, .5, 2.1, 3.7, 5.9]:
    cone('Ridge finial', (0, y, 4.55), .052, .018, .28, 'briar-iron', r, 10)
# A lifted vent is a separate animated hinge, never a duplicated entire building.
vent = empty('Loose ridge vent hinge', (0, 1.2, 4.41), r)
vent.rotation_euler[1] = math.radians(13)
cube('Raised vent opaque pane', (1.02, 0, -.24), (2.15, 1.29, .024), 'briar-dirty-glass', .002, vent)
for y in [-.68, .68]:
    straight_tube('Vent frame', (0, y, 0), (2.05, y, -.5), .024, 'briar-painted-wood', vent)
for frame, value in [(1, 11.5), (45, 13.5), (90, 11.5)]:
    vent.rotation_euler[1] = math.radians(value)
    vent.keyframe_insert(data_path='rotation_euler', frame=frame)
save('weathered-glasshouse', [{'x': 0, 'z': 0, 'w': 8.35, 'd': 12.5}], True)

r = palette('iron-estate-gate')
for side in [-1, 1]:
    x = side * 3.55
    cube('Weathered brick gate pier', (x, 0, 1.17), (.61, .68, 2.34), 'briar-brick', .015, r)
    cube('Pier base', (x, 0, .12), (.78, .85, .24), 'briar-lime', .015, r)
    cube('Pyramidal cap base', (x, 0, 2.39), (.78, .85, .16), 'briar-lime', .021, r)
    cap = cone('Pyramid pier cap', (x, 0, 2.56), .55, 0, .22, 'briar-lime', r, 4)
    cap.rotation_euler[2] = math.pi / 4
    gate = empty('Permanently opened iron gate', (side * 3.24, 0, .03), r)
    # The leaf points away from the approach along Blender +Y / game -Z.
    for y in [.05, 2.78]:
        cube('Gate end standard', (0, y, .95), (.053, .06, 1.82), 'briar-iron', .004, gate)
    for z in [.25, 1.22, 1.75]:
        cube('Gate longitudinal rail', (0, 1.40, z), (.049, 2.8, .057), 'briar-iron', .004, gate)
    for y in np.linspace(.18, 2.65, 17):
        cube('Gate iron upright', (0, float(y), .99), (.023, .026, 1.71), 'briar-iron', .001, gate)
        cone('Spear finial', (0, float(y), 1.9), .038, 0, .15, 'briar-iron', gate, 6)
    for y in [.06, .50, 1.00, 1.50, 2.00, 2.50]:
        points = [(0, y + .18 * math.cos(i * math.tau / 20), .54 + .18 * math.sin(i * math.tau / 20)) for i in range(21)]
        tube('Circular ironwork', points, .009, 'briar-iron', gate)
    for z in [.45, 1.5]:
        straight_tube('Pier gate hinge', (side * 3.25, 0, z), (side * 3.45, 0, z), .026, 'briar-iron', r)
    cube('Pier number plate', (x, -.352, 1.56), (.36, .027, .39), 'briar-iron', .009, r)
    text('Pier number', '03', (x, -.372, 1.48), .18, 'paper', parent=r)
save('iron-estate-gate', [
    {'x': -3.55, 'z': 0, 'w': .80, 'd': .87},
    {'x': 3.55, 'z': 0, 'w': .80, 'd': .87},
    {'x': -3.24, 'z': -1.40, 'w': .13, 'd': 2.82},
    {'x': 3.24, 'z': -1.40, 'w': .13, 'd': 2.82},
])

r = palette('raised-growing-bed')
cube('Loose compost', (0, 0, .22), (2.25, 1.1, .38), 'briar-soil', .08, r)
for z in [.11, .31]:
    for y in [-.61, .61]:
        cube('Weathered bed long plank', (0, y, z), (2.54, .11, .185), 'briar-painted-wood', .008, r)
    for x in [-1.21, 1.21]:
        cube('Weathered bed end plank', (x, 0, z), (.11, 1.22, .185), 'briar-painted-wood', .008, r)
for x in [-1.17, 1.17]:
    for y in [-.56, .56]:
        cube('Bed corner stake', (x, y, .24), (.095, .095, .49), 'briar-timber', .007, r)
        for z in [.12, .31]:
            bolt = cone('Plank carriage bolt', (x, y + math.copysign(.115, y), z), .011, .011, .006, 'rust', r, 8)
            bolt.rotation_euler[0] = math.pi / 2
verts, faces = [], []
for cx in [-.76, 0, .76]:
    for cy in [-.28, .28]:
        for leaf in range(8):
            angle = leaf * math.tau / 8 + random.uniform(-.15, .15)
            length = random.uniform(.25, .39)
            base = len(verts)
            for along in range(7):
                t = along / 6
                width = math.sin(t * math.pi) * .09
                for across in [-1, 0, 1]:
                    radial = t * length
                    z = .405 + math.sin(t * math.pi * .87) * .16 + (1 - abs(across)) * .025 + .016 * math.sin(t * math.pi * 8 + leaf)
                    verts.append((cx + math.cos(angle) * radial - math.sin(angle) * width * across, cy + math.sin(angle) * radial + math.cos(angle) * width * across, z))
            for along in range(6):
                for across in range(2):
                    a = base + along * 3 + across
                    faces.append((a, a + 1, a + 4, a + 3))
crop = plane_mesh('Curling brassica leaves', verts, faces, 'briar-green-leaf', r)
crop.data.materials[0].surface_render_method = 'DITHERED'
for p in crop.data.polygons:
    p.use_smooth = True
crop.shape_key_add(name='Basis')
wind = crop.shape_key_add(name='Light draught')
for vertex in wind.data:
    strength = max(0, vertex.co.z - .40)
    vertex.co.x += math.sin(vertex.co.y * 4 + vertex.co.x) * strength * .12
    vertex.co.z += math.sin(vertex.co.x * 6 + vertex.co.y * 3) * strength * .04
for frame, value in [(1, 0), (45, 1), (90, 0)]:
    wind.value = value
    wind.keyframe_insert(data_path='value', frame=frame)
cube('Plant label stake', (.96, -.39, .65), (.029, .025, .51), 'briar-timber', .002, r)
cube('Plant label face', (.96, -.402, .83), (.36, .028, .14), 'paper', .003, r)
text('Crop label', 'LEAGUE CABBAGE', (.96, -.421, .792), .027, 'black', parent=r)
save('raised-growing-bed', [{'x': 0, 'z': 0, 'w': 2.54, 'd': 1.33}], True)

r = palette('briarfield-grounds-notice')
for x in [-.96, .96]:
    cube('Notice timber post', (x, .07, 1.17), (.12, .15, 2.34), 'briar-painted-wood', .006, r)
cube('Noticeboard backing', (0, 0, 1.62), (2.3, .18, 1.40), 'briar-painted-wood', .012, r)
cube('Noticeboard cork', (0, -.103, 1.53), (2.08, .032, 1.06), 'briar-timber', .004, r)
cap = cube('Noticeboard rain hood', (0, -.028, 2.36), (2.55, .43, .059), 'briar-slate', .007, r)
cap.rotation_euler[0] = -.10
text('Grounds title', 'BRIARFIELD GROUNDS', (0, -.104, 2.15), .16, 'paper', parent=r)
text('Grounds subtitle', 'COUNTY HORTICULTURAL SERVICE', (0, -.108, 2.00), .073, 'paper', parent=r)
for x, title, lines in [
    (-.50, 'FIELDWORK WAIVER', ['APPLICANT AGE: TEN', 'SUPERVISION: OPTIONAL', 'INJURIES: EDUCATIONAL']),
    (.50, 'KEEP OFF THE GRASS', ['UNLESS CHALLENGED', 'BY COUNTY STAFF.', 'THEN FIGHT ON IT.']),
]:
    sheet = empty('Loose paper corner', (x, -.135, 1.52), r)
    cube('Official weathered notice', (0, 0, 0), (.90, .008, .79), 'paper', .001, sheet)
    text('Notice title', title, (0, -.008, .25), .064, 'black', parent=sheet)
    for i, line in enumerate(lines):
        text('Notice wording', line, (0, -.01, .08 - i * .11), .043, 'black', parent=sheet)
    for pinx in [-.36, .36]:
        pin = cone('Notice brass drawing pin', (pinx, -.015, .32), .014, .014, .004, 'steel', sheet, 8)
        pin.rotation_euler[0] = math.pi / 2
    for frame, angle in [(1, -.009), (45, .014), (90, -.009)]:
        sheet.rotation_euler[0] = angle
        sheet.keyframe_insert(data_path='rotation_euler', frame=frame)
text('Notice footer', 'TRESPASS BADGE: REPORT TO THE GROUNDSKEEPER', (0, -.113, .965), .064, 'paper', parent=r)
save('briarfield-grounds-notice', [{'x': 0, 'z': 0, 'w': 2.35, 'd': .28}], True)

(ARTIFACTS / 'briarfield-catalog.json').write_text(json.dumps(catalog, indent=2))
print('BRIARFIELD_ASSETS_COMPLETE', len(catalog), flush=True)
