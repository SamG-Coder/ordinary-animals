"""Individual Ash End building, boundary and prop sources, authored and packed in Blender.

The Three.js world places these modules; this file never authors a district mesh.
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
catalog = json.loads((ROOT / 'game-assets/asset-catalog.json').read_text())
random.seed(2026)
SIZE = 1024
rng = np.random.default_rng(1409)
for file, names in [
    ('author_blender.py', {'begin', 'link', 'empty', 'cube', 'cone', 'tube', 'text', 'plane_mesh', 'ellipsoid', 'material'}),
    ('detail_assets.py', {'setup'}),
    ('opening_art_pass.py', {'finish'}),
    ('road_surface_pass.py', {'field'}),
]:
    tree = ast.parse((ROOT / 'scripts' / file).read_text())
    exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names], type_ignores=[]), 'Blender helpers', 'exec'))

# Original brick, lime render and paving surface maps at a measured two-metre repeat.
yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32) / SIZE
grain, mottling, damp = field(350), field(24), field(6)
row = np.floor(yy * 16)
bx = (xx * 8 + (row % 2) * .5) % 1
by = (yy * 16) % 1
mortar = (bx < .045) | (by < .055)
brick_id = (np.floor(xx * 8 + (row % 2) * .5) % 8 + row * 8).astype(int)
brick_variation = rng.uniform(-.045, .045, 128)[brick_id]
value = .27 + .045 * grain + .065 * mottling + brick_variation - .065 * damp
brick = np.stack([value, value * .79, value * .63], axis=-1)
brick[mortar] = np.stack([.24 + .04 * grain[mortar]] * 3, axis=-1)
brick_height = .002 * grain + .0015 * mottling - .0035 * mortar
render_value = .40 + .022 * grain + .027 * mottling - .04 * damp
render = np.stack([render_value * .98, render_value, render_value * .93], axis=-1)
stone_height = .0008 * grain + .0018 * mottling


def surface(name, color, height, roughness=.87):
    mat = material(name, (.3, .3, .3), roughness)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    normal = np.stack([
        -(np.roll(height, -1, 1) - np.roll(height, 1, 1)) / (4 / SIZE),
        -(np.roll(height, -1, 0) - np.roll(height, 1, 0)) / (4 / SIZE),
        np.ones_like(height),
    ], axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    for label, pixels in [('Color', color), ('Normal', normal * .5 + .5)]:
        im = bpy.data.images.new(name + ' ' + label, width=SIZE, height=SIZE, alpha=False)
        if label == 'Normal':
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
            links.new(tex.outputs['Color'], shader.inputs['Base Color'])
    return mat


def palette(name):
    root = setup(name)
    surface('estate-brick', brick, brick_height)
    surface('estate-render', render, stone_height)
    material('estate-green', (.043, .080, .063), .68)
    material('estate-iron', (.052, .057, .052), .59, metal=.35)
    material('estate-frame', (.31, .32, .28), .64)
    material('estate-glass', (.026, .035, .031), .22)
    material('estate-curtain', (.22, .20, .15), .94)
    material('estate-warm-window', (.29, .20, .10), .78, emission=.6)
    material('roof', (.064, .073, .068), .84)
    if 'oak' not in M:
        material('oak', (.18, .12, .065), .93)
    return root


def measured_uvs():
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH' or not obj.data.uv_layers:
            continue
        if not obj.data.materials or obj.data.materials[0].name not in ['estate-brick', 'estate-render']:
            continue
        for poly in obj.data.polygons:
            for li in poly.loop_indices:
                v = obj.matrix_world @ obj.data.vertices[obj.data.loops[li].vertex_index].co
                uv = (v.x / 2, v.y / 2) if abs(poly.normal.z) > .5 else ((v.y if abs(poly.normal.x) > .5 else v.x) / 2, v.z / 2)
                obj.data.uv_layers.active.data[li].uv = uv


def save(name, colliders=None, animated=False):
    bpy.context.view_layer.update()
    measured_uvs()
    finish(name, animated)
    if colliders:
        catalog[name]['colliders'] = colliders


def window(root, x, y, z, w=1.35, h=1.65, warm=False, boarded=False):
    cube('Recessed reveal', (x, y, z), (w + .23, .15, h + .21), 'estate-render', .013, root)
    cube('Shadow in recess', (x, y - .083, z), (w + .06, .012, h + .05), 'black', .002, root)
    cube('Window glass', (x, y - .095, z), (w, .015, h), 'estate-warm-window' if warm else 'estate-glass', .004, root)
    for dx in [-w / 2, 0, w / 2]:
        cube('Timber mullion', (x + dx, y - .13, z), (.041, .054, h + .06), 'estate-frame', .003, root)
    for dz in [-h / 2, .18, h / 2]:
        cube('Sash transom', (x, y - .13, z + dz), (w + .07, .054, .04), 'estate-frame', .003, root)
    cube('Projecting sill', (x, y - .23, z - h / 2 - .08), (w + .31, .46, .10), 'estate-render', .014, root)
    if boarded:
        for offset, angle in [(-.24, -.13), (.27, .11)]:
            board = cube('Temporary repair', (x, y - .19, z + offset), (w + .24, .045, .21), 'oak', .003, root)
            board.rotation_euler[1] = angle
    else:
        for dx in [-w * .33, w * .33]:
            cube('Curtain behind sash', (x + dx, y - .107, z), (w * .23, .011, h - .09), 'estate-curtain', .004, root)


r = palette('lettings-office')
cube('Brick office shell', (0, 0, 1.9), (8, 6, 3.8), 'estate-brick', .018, r)
plane_mesh('Front gable', [(-4, -3, 3.8), (4, -3, 3.8), (0, -3, 5.02)], [(0, 1, 2)], 'estate-brick', r)
plane_mesh('Rear gable', [(-4, 3, 3.8), (4, 3, 3.8), (0, 3, 5.02)], [(2, 1, 0)], 'estate-brick', r)
cube('Stone damp course', (0, -3.04, .26), (8.04, .18, .52), 'estate-render', .009, r)
for side in [-1, 1]:
    roof = cube('Slate roof pitch', (side * 2, 0, 4.39), (4.5, 6.6, .13), 'roof', .009, r)
    roof.rotation_euler[1] = side * math.radians(17)
    tube('Cast iron gutter', [(side * 4.15, -3.25, 3.8), (side * 4.15, 3.25, 3.8)], .055, 'estate-iron', r)
cube('Ridge cap', (0, 0, 5.02), (.17, 6.65, .12), 'roof', .02, r)
for x in [-2.6, 2.6]:
    window(r, x, -3.07, 1.85, 1.9, 1.7, warm=x > 0)
    for dz in [.15, .23, .31, .39, .47]:
        cube('Office blind', (x, -3.22, 1.85 + dz), (1.8, .024, .042), 'estate-curtain', .001, r)
cube('Entrance reveal', (0, -3.09, 1.29), (1.72, .23, 2.58), 'estate-render', .012, r)
cube('Office door', (0, -3.23, 1.2), (1.4, .06, 2.4), 'estate-green', .014, r)
cube('Door glass', (0, -3.27, 1.58), (1.03, .017, 1.27), 'estate-glass', .003, r)
cube('Brass door handle', (.49, -3.31, 1.08), (.035, .07, .22), 'steel', .005, r)
cube('Letter slot', (0, -3.275, .55), (.38, .04, .045), 'estate-iron', .004, r)
cube('Shop sign', (0, -3.17, 3.29), (7.8, .22, .65), 'estate-green', .015, r)
text('Lettings name', 'ASH END LETTINGS', (0, -3.287, 3.29), .34, 'paper', parent=r)
text('Office tagline', 'YOUR FUTURE. OUR PROPERTY.', (0, -3.289, 3.07), .095, 'paper', parent=r)
text('Door appointment', 'VIEWINGS BY BATTLE', (0, -3.289, 1.87), .069, 'paper', parent=r)
cube('League office plaque', (1.08, -3.12, 1.6), (.51, .045, .61), 'estate-green', .006, r)
text('League number', 'LEAGUE 02', (1.08, -3.148, 1.77), .057, 'paper', parent=r)
text('League badge', 'DEPOSIT', (1.08, -3.148, 1.55), .061, 'paper', parent=r)
for x in [-3.7, 3.7]:
    tube('Downpipe', [(x, -3.18, 3.86), (x, -3.23, 3.6), (x, -3.23, .23), (x, -3.37, .15)], .038, 'estate-iron', r)
cube('Chimney stack', (2.7, 1.5, 4.78), (.61, .75, 1.53), 'estate-brick', .01, r)
cube('Chimney cap', (2.7, 1.5, 5.56), (.75, .88, .12), 'estate-render', .012, r)
cone('Chimney pot', (2.7, 1.5, 5.8), .12, .105, .4, 'rust', r)
save('lettings-office', [{'x': 0, 'z': 0, 'w': 8.4, 'd': 6.6}])

r = palette('tenement-wing')
cube('Three storey brick shell', (0, 0, 4.5), (12, 7, 9), 'estate-brick', .019, r)
cube('Low stone plinth', (0, -3.55, .25), (12.08, .18, .5), 'estate-render', .011, r)
cube('Flat roof', (0, 0, 9.01), (12.25, 7.24, .15), 'roof', .01, r)
for y in [-3.55, 3.55]:
    cube('Parapet', (0, y, 9.27), (12.25, .24, .53), 'estate-brick', .012, r)
    cube('Parapet coping', (0, y, 9.55), (12.4, .33, .09), 'estate-render', .013, r)
for x in [-6, 6]:
    cube('End parapet', (x, 0, 9.27), (.24, 7.1, .53), 'estate-brick', .009, r)
for level in range(3):
    z = 1.75 + level * 2.9
    for i, x in enumerate([-4.65, -2.05, 2.05, 4.65]):
        window(r, x, -3.54, z, 1.38, 1.75, warm=(i + level) % 5 == 1, boarded=level == 0 and i == 3)
        if level and i in [0, 3]:
            cube('Balcony slab', (x, -4.12, z - 1), (2.10, 1.35, .14), 'estate-render', .014, r)
            for px in np.linspace(x - .99, x + .99, 12):
                cube('Balcony railing', (float(px), -4.74, z - .43), (.02, .026, 1.08), 'estate-iron', .002, r)
            for zrail in [z - .91, z + .10]:
                cube('Balcony handrail', (x, -4.74, zrail), (2.12, .045, .044), 'estate-iron', .004, r)
            for side in [-1, 1]:
                cube('Balcony return', (x + side * 1.02, -4.13, z + .10), (.035, 1.24, .042), 'estate-iron', .003, r)
    cube('Floor string course', (0, -3.57, 2.95 + level * 2.9), (12.1, .17, .11), 'estate-render', .006, r)
cube('Stairwell render', (0, -3.6, 4.51), (1.66, .2, 8.95), 'estate-render', .01, r)
for z in [4.1, 7]:
    window(r, 0, -3.74, z, .83, 1.65)
cube('Communal entry', (0, -3.74, 1.20), (1.31, .08, 2.4), 'estate-green', .006, r)
cube('Entry glass', (0, -3.79, 1.62), (.87, .017, 1.12), 'estate-glass', .003, r)
cube('Entry pull', (.42, -3.86, 1.1), (.025, .05, .23), 'steel', .004, r)
cube('Entry canopy', (0, -4.05, 2.62), (2.15, 1.4, .12), 'estate-render', .012, r)
text('Block number', 'ASH COURT', (0, -4.764, 2.60), .105, 'black', parent=r)
for i in range(6):
    cube('Letterbox', (1.04 + (i % 2) * .27, -3.61, .87 + (i // 2) * .22), (.24, .12, .18), 'estate-iron', .008, r)
    cube('Letter opening', (1.04 + (i % 2) * .27, -3.68, .91 + (i // 2) * .22), (.17, .01, .015), 'black', 0, r)
for x in [-5.7, 5.7]:
    tube('Rainwater pipe', [(x, -3.79, 9.15), (x, -3.8, .2), (x, -3.98, .12)], .043, 'estate-iron', r)
cube('Roof utility housing', (-2.7, 1.1, 9.62), (2.5, 2.7, 1.12), 'estate-brick', .013, r)
cube('Utility cap', (-2.7, 1.1, 10.22), (2.7, 2.9, .11), 'roof', .01, r)
for x in [-4.5, 3.7]:
    cone('Vent stack', (x, 1.7, 9.8), .085, .085, 1.3, 'estate-iron', r)
    cone('Vent cap', (x, 1.7, 10.47), .15, .12, .08, 'estate-iron', r)
save('tenement-wing', [{'x': 0, 'z': 0, 'w': 12.2, 'd': 7.4}, {'x': 0, 'z': 4.02, 'w': 2.15, 'd': 1.45}])

r = palette('estate-railing-3m')
cube('Brick dwarf wall', (0, 0, .22), (3, .28, .44), 'estate-brick', .008, r)
cube('Coping', (0, 0, .46), (3, .36, .08), 'estate-render', .009, r)
for x in [-1.46, 1.46]:
    cube('Iron standard', (x, 0, .9), (.049, .049, .84), 'estate-iron', .003, r)
    cone('Standard finial', (x, 0, 1.34), .042, 0, .1, 'estate-iron', r, 8)
for x in np.linspace(-1.3, 1.3, 19):
    cube('Iron upright', (float(x), 0, .84), (.018, .024, .75), 'estate-iron', .001, r)
for z in [.55, 1.21]:
    cube('Rail', (0, 0, z), (3, .035, .035), 'estate-iron', .002, r)
save('estate-railing-3m', [{'x': 0, 'z': 0, 'w': 3, 'd': .37}])

r = palette('court-paving-4m')
for row in range(8):
    for col in range(8):
        slab = cube('Weathered concrete flag', (-1.75 + col * .5, -1.75 + row * .5, -.012 + random.uniform(-.001, .001)), (.493, .493, .055), 'estate-render', .007, r)
        slab.rotation_euler[2] = random.uniform(-.003, .003)
save('court-paving-4m')

r = palette('estate-notice')
for x in [-.54, .54]:
    cube('Notice post', (x, 0, 1), (.06, .075, 2), 'estate-iron', .005, r)
cube('Notice frame', (0, 0, 1.56), (1.32, .16, 1.19), 'estate-green', .01, r)
cube('Notice backing', (0, -.092, 1.56), (1.2, .016, 1.05), 'estate-curtain', .003, r)
for x, z, title, lines in [
    (-.29, 1.76, 'NO PETS', ['ANIMALS BELONG', 'OUTSIDE.']),
    (.29, 1.66, 'LEAGUE INTAKE', ['MINORS ACCEPTED.', 'GUARANTOR OPTIONAL.']),
    (-.27, 1.22, 'REPAIRS', ['REPORT RECEIVED.', 'REPAIR NOT INCLUDED.']),
]:
    paper = empty('Notice moving in draught', (x, -.11, z), r)
    cube('Paper notice', (0, 0, 0), (.51, .006, .4), 'paper', .001, paper)
    text('Notice headline', title, (0, -.006, .11), .041, 'black', parent=paper)
    for i, line in enumerate(lines):
        text('Notice line', line, (0, -.008, .015 - i * .065), .025, 'black', parent=paper)
    for frame, angle in [(1, -.018), (40, .012), (90, -.018)]:
        paper.rotation_euler[0] = angle
        paper.keyframe_insert(data_path='rotation_euler', frame=frame)
save('estate-notice', [{'x': 0, 'z': 0, 'w': 1.35, 'd': .2}], True)

r = palette('ash-end-sign')
for x in [-1.08, 1.08]:
    cube('Town sign upright', (x, 0, 1.18), (.075, .1, 2.36), 'estate-iron', .005, r)
cube('Town sign', (0, 0, 1.8), (2.5, .12, 1.05), 'estate-green', .013, r)
for x in [-1.16, 1.16]:
    cube('Painted border', (x, -.064, 1.8), (.017, .003, .91), 'paper', 0, r)
for z in [1.35, 2.25]:
    cube('Painted border', (0, -.064, z), (2.34, .003, .017), 'paper', 0, r)
text('District name', 'ASH END', (0, -.068, 1.94), .30, 'paper', parent=r)
text('District motto', 'A PLACE TO PAY FOR', (0, -.069, 1.69), .112, 'paper', parent=r)
text('Office direction', 'DEPOSIT BADGE / LETTINGS OFFICE', (0, -.07, 1.47), .066, 'paper', parent=r)
save('ash-end-sign', [{'x': 0, 'z': 0, 'w': 2.5, 'd': .2}])

(ROOT / 'game-assets/asset-catalog.json').write_text(json.dumps(catalog, indent=2))
print('ASH_END_ASSETS_COMPLETE', len(catalog), flush=True)
