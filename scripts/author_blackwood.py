"""Separate Blackwood forestry lodge, trail gate, register and mossy culvert.

Blender generates and packs original surface maps and all geometry. This script
never authors a forest-sized object or writes the shared game catalog.
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
rng = np.random.default_rng(5179)
random.seed(5179)
for file, names in [
    ('author_blender.py', {'begin', 'link', 'empty', 'cube', 'cone', 'tube', 'text', 'plane_mesh', 'ellipsoid', 'material'}),
    ('detail_assets.py', {'setup'}),
    ('opening_art_pass.py', {'finish'}),
    ('road_surface_pass.py', {'field'}),
    ('briarfield_assets.py', {'surface', 'measured_uvs', 'straight_tube'}),
]:
    tree = ast.parse((ROOT / 'scripts' / file).read_text())
    exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names], type_ignores=[]), 'Blender helpers only', 'exec'))

yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32) / SIZE
grain, middle, damp = field(420), field(32), field(6)
woodgrain = np.sin(yy * 1250 + np.sin(yy * 55 + xx * 7) * 5)
scratches = np.clip((np.sin(yy * 680 + np.sin(xx * 2) * 4) - .975) * 25, 0, 1)
v = .20 + .028 * middle + .016 * grain + .010 * woodgrain - .045 * damp - .03 * scratches
wood = np.stack([v, v * .96, v * .80], axis=-1)
wood_height = .0003 * woodgrain + .0006 * scratches + .0007 * grain
v = .31 + .042 * grain + .075 * middle - .03 * damp
stone = np.stack([v * .87, v, v * .90], axis=-1)
stone_height = .0011 * grain + .0026 * middle
mossmask = np.clip((damp - .40) * 1.5, 0, 1)
stone *= (1 - mossmask[:, :, None] * .33)
stone[:, :, 1] += mossmask * .023
v = .13 + .03 * grain + .04 * middle - .025 * damp
roof = np.stack([v * .83, v, v * .95], axis=-1)
roof_height = .0006 * grain + .0009 * middle
v = .15 + .022 * middle + .033 * damp
glass = np.stack([v * .82, v, v * 1.04], axis=-1)
glass_height = .00015 * grain


def palette(name):
    root = setup(name)
    surface('blackwood-silvered-timber', wood, wood_height, .92)
    surface('blackwood-mossy-stone', stone, stone_height, .93)
    surface('blackwood-patinated-roof', roof, roof_height, .74)
    surface('blackwood-rain-glass', glass, glass_height, .32)
    material('blackwood-green', (.046, .083, .062), .79)
    material('blackwood-iron', (.024, .036, .030), .55, metal=.35)
    material('blackwood-endgrain', (.23, .18, .105), .94)
    material('blackwood-map-paper', (.43, .44, .33), .97)
    material('blackwood-map-ink', (.06, .12, .09), .93)
    material('blackwood-trail-red', (.20, .052, .031), .88)
    material('blackwood-moss', (.055, .09, .023), .98)
    material('blackwood-creek', (.024, .043, .031), .19)
    return root


def save(name, colliders=None, animated=False):
    measured_uvs()
    finish(name, animated)
    if colliders:
        catalog[name]['colliders'] = colliders
    catalog[name]['authoring'] = 'scripts/author_blackwood.py'


def lodge_window(root, x, y, z, w=1.45, h=1.63):
    cube('Timber window reveal', (x, y, z), (w + .24, .14, h + .24), 'blackwood-silvered-timber', .01, root)
    cube('Deep window recess', (x, y - .089, z), (w + .07, .019, h + .05), 'black', .002, root)
    cube('Rain-marked glass', (x, y - .103, z), (w, .018, h), 'blackwood-rain-glass', .002, root)
    for dx in [-w / 2, 0, w / 2]:
        cube('Painted timber mullion', (x + dx, y - .134, z), (.049, .063, h + .07), 'blackwood-green', .003, root)
    for dz in [-h / 2, 0, h / 2]:
        cube('Painted timber transom', (x, y - .134, z + dz), (w + .07, .063, .045), 'blackwood-green', .003, root)
    cube('Window drip sill', (x, y - .20, z - h / 2 - .08), (w + .31, .40, .10), 'blackwood-silvered-timber', .010, root)
    for side in [-1, 1]:
        sx = x + side * (w / 2 + .37)
        cube('Weathered folding shutter', (sx, y - .04, z), (.45, .068, h + .04), 'blackwood-green', .005, root)
        for dz in np.linspace(-h / 2 + .08, h / 2 - .08, 11):
            cube('Shutter slat', (sx, y - .085, z + float(dz)), (.41, .029, .039), 'blackwood-silvered-timber', .002, root)


r = palette('ranger-lodge')
cube('Lodge insulated shell', (0, 0, 1.96), (10, 8, 3.92), 'blackwood-silvered-timber', .012, r)
cube('Stone lodge plinth', (0, 0, .29), (10.07, 8.08, .58), 'blackwood-mossy-stone', .017, r)
# Each cladding board has a shadow line and staggered joints at real board scale.
for y in [-4.035, 4.035]:
    for row in range(18):
        z = .66 + row * .183
        edges = [-5.0, -1.65, 1.70, 5.0] if row % 2 else [-5.0, -3.32, 0.03, 3.37, 5.0]
        for a, b in zip(edges, edges[1:]):
            cube('Overlapping horizontal weatherboard', ((a + b) / 2, y, z), (b - a - .006, .062, .178), 'blackwood-silvered-timber', .003, r)
for x in [-5.035, 5.035]:
    for row in range(18):
        cube('End elevation weatherboard', (x, 0, .66 + row * .183), (.062, 8, .178), 'blackwood-silvered-timber', .003, r)
for y in [-4.04, 4.04]:
    plane_mesh('Timber gable', [(-5, y, 3.90), (5, y, 3.90), (0, y, 5.72)], [(0, 1, 2) if y < 0 else (2, 1, 0)], 'blackwood-silvered-timber', r)
    for z in np.arange(4.02, 5.65, .18):
        w = max(.18, (5.72 - z) * 10 / 1.82)
        cube('Gable cladding board', (0, y, float(z)), (float(w), .061, .17), 'blackwood-silvered-timber', .003, r)
for side in [-1, 1]:
    roof_pitch = cube('Standing-seam roof pitch', (side * 2.53, 0, 4.83), (5.70, 8.87, .09), 'blackwood-patinated-roof', .007, r)
    roof_pitch.rotation_euler[1] = side * math.atan2(1.82, 5)
    for y in np.linspace(-4.35, 4.35, 19):
        straight_tube('Raised folded roof seam', (0, float(y), 5.78), (side * 5.37, float(y), 3.81), .011, 'blackwood-iron', r)
    tube('Half round rain gutter', [(side * 5.24, -4.43, 3.85), (side * 5.24, 4.43, 3.85)], .047, 'blackwood-iron', r)
    straight_tube('Gable rake trim', (0, -4.46, 5.8), (side * 5.37, -4.46, 3.83), .052, 'blackwood-green', r)
cube('Ridge flashing', (0, 0, 5.78), (.14, 8.91, .11), 'blackwood-iron', .035, r)
for x in [-3.17, 3.17]:
    lodge_window(r, x, -4.11, 2.00)
cube('Entrance timber surround', (0, -4.12, 1.34), (1.77, .18, 2.67), 'blackwood-silvered-timber', .013, r)
cube('Solid ranger door', (0, -4.23, 1.28), (1.46, .07, 2.56), 'blackwood-green', .012, r)
for x in np.linspace(-.61, .61, 7):
    cube('Door timber board', (float(x), -4.279, 1.28), (.19, .023, 2.43), 'blackwood-silvered-timber', .003, r)
cube('Glazed door light', (0, -4.30, 1.98), (.90, .026, .71), 'blackwood-rain-glass', .004, r)
for dz in [1.62, 2.35]:
    cube('Door light frame', (0, -4.326, dz), (.98, .028, .04), 'blackwood-green', .002, r)
straight_tube('Door handle', (.55, -4.347, 1.11), (.55, -4.347, 1.34), .013, 'steel', r)
cube('Lodge threshold', (0, -4.37, .025), (1.96, .63, .05), 'blackwood-mossy-stone', .011, r)
canopy = cube('Cantilevered porch roof', (0, -4.83, 2.99), (4.10, 1.84, .11), 'blackwood-patinated-roof', .008, r)
canopy.rotation_euler[0] = -.10
for x in [-1.79, 1.79]:
    straight_tube('Diagonal porch corbel', (x, -4.10, 2.14), (x, -5.54, 2.88), .050, 'blackwood-silvered-timber', r)
cube('Ranger station sign', (0, -4.14, 3.60), (4.10, .15, .59), 'blackwood-green', .012, r)
text('Ranger station name', 'BLACKWOOD RANGER STATION', (0, -4.224, 3.63), .178, 'paper', parent=r)
text('Ranger station jurisdiction', 'COUNTY WILDERNESS SERVICE', (0, -4.226, 3.43), .096, 'paper', parent=r)
cube('Wilderness badge plate', (1.20, -4.15, 1.76), (.51, .04, .58), 'blackwood-green', .005, r)
text('Badge league number', 'LEAGUE 05', (1.20, -4.175, 1.91), .056, 'paper', parent=r)
text('Badge wilderness', 'WILDERNESS', (1.20, -4.178, 1.68), .047, 'paper', parent=r)
cube('Ranger intake warning', (0, -4.329, 2.22), (.81, .012, .14), 'paper', .002, r)
text('Ranger intake warning', 'MINORS: REPORT ALONE', (0, -4.338, 2.18), .041, 'black', parent=r)
for x in [-4.72, 4.72]:
    tube('Lodge downpipe', [(x, -4.28, 3.86), (x, -4.29, 3.53), (x, -4.29, .20), (x, -4.45, .12)], .034, 'blackwood-iron', r)
cube('Stone chimney stack', (3.18, 1.94, 5.08), (.87, .99, 1.79), 'blackwood-mossy-stone', .016, r)
cube('Chimney crown', (3.18, 1.94, 6.01), (1.02, 1.15, .13), 'blackwood-mossy-stone', .012, r)
cone('Chimney cowl', (3.18, 1.94, 6.31), .16, .13, .48, 'blackwood-iron', r)
cone('Rain hood', (3.18, 1.94, 6.58), .24, .13, .13, 'blackwood-iron', r)
for y in [-2.7, -1.7, -.7, .3, 1.3, 2.3]:
    log = cone('Stacked firewood', (-5.34, y, .28), .10, .09, .48, 'blackwood-endgrain', r, 9)
    log.rotation_euler[1] = math.pi / 2
save('ranger-lodge', [{'x': 0, 'z': 0, 'w': 10.2, 'd': 8.28}, {'x': -5.38, 'z': 0, 'w': .55, 'd': 6.15}])

r = palette('timber-trail-gate')
for x in [-3.73, 3.73]:
    cube('Forestry gate post', (x, 0, 1.42), (.23, .25, 2.84), 'blackwood-silvered-timber', .019, r)
    cap = cone('Pitched post cap', (x, 0, 2.88), .19, 0, .20, 'blackwood-green', r, 4)
    cap.rotation_euler[2] = math.pi / 4
    for z in [.18, .34, 2.41, 2.58]:
        cube('Iron post band', (x, 0, z), (.251, .276, .049), 'blackwood-iron', .003, r)
cube('Trail gateway lintel', (0, 0, 2.64), (7.95, .25, .27), 'blackwood-silvered-timber', .012, r)
cube('Carved trail gateway sign', (0, -.11, 2.84), (3.61, .17, .76), 'blackwood-green', .016, r)
text('Trail gateway name', 'BLACKWOOD', (0, -.205, 2.97), .278, 'paper', parent=r)
text('Trail gateway strapline', 'JUNIOR RANGER ROUTE', (0, -.207, 2.69), .116, 'paper', parent=r)
for side in [-1, 1]:
    gate = empty('Open timber gate leaf', (side * 3.51, 0, 0), r)
    for y in [.05, 2.75]:
        cube('Gate end upright', (0, y, .72), (.10, .12, 1.37), 'blackwood-silvered-timber', .008, gate)
    for z in [.25, .73, 1.21]:
        cube('Forestry gate rail', (0, 1.40, z), (.10, 2.84, .14), 'blackwood-silvered-timber', .007, gate)
    straight_tube('Gate diagonal brace', (0, .13, .28), (0, 2.66, 1.24), .046, 'blackwood-silvered-timber', gate)
    for z in [.29, 1.14]:
        tube('Gate hinge strap', [(side * .13, .08, z), (0, .08, z), (0, .43, z)], .025, 'blackwood-iron', gate)
save('timber-trail-gate', [{'x': -3.73, 'z': 0, 'w': .29, 'd': .30}, {'x': 3.73, 'z': 0, 'w': .29, 'd': .30}, {'x': -3.51, 'z': -1.40, 'w': .16, 'd': 2.87}, {'x': 3.51, 'z': -1.40, 'w': .16, 'd': 2.87}])

r = palette('forest-trailboard')
for x in [-1.01, 1.01]:
    cube('Trailboard hardwood post', (x, .07, 1.17), (.12, .13, 2.34), 'blackwood-silvered-timber', .009, r)
cube('Forest register frame', (0, 0, 1.68), (2.43, .18, 1.48), 'blackwood-green', .011, r)
cube('Faded trail map paper', (0, -.105, 1.65), (2.22, .018, 1.24), 'blackwood-map-paper', .002, r)
cap = cube('Register rain roof', (0, .025, 2.47), (2.69, .47, .09), 'blackwood-patinated-roof', .010, r)
cap.rotation_euler[0] = -.11
text('Forest map title', 'VISITOR RESPONSIBILITY REGISTER', (0, -.117, 2.10), .085, 'blackwood-map-ink', parent=r)
text('Forest map date', 'WILDERNESS SERVICE / ISSUE 10', (0, -.119, 1.98), .050, 'blackwood-map-ink', parent=r)
for i, path in enumerate([
    [(-.83, -.13, 1.24), (-.70, -.13, 1.39), (-.49, -.13, 1.43), (-.23, -.13, 1.72), (.15, -.13, 1.69), (.39, -.13, 1.83)],
    [(-.46, -.13, 1.46), (-.28, -.13, 1.23), (.18, -.13, 1.19), (.69, -.13, 1.41)],
]):
    tube('Printed woodland route', path, .011 if i == 0 else .006, 'blackwood-trail-red' if i == 0 else 'blackwood-map-ink', r)
for i, (x, z, label) in enumerate([(-.81, 1.24, 'YOU'), (-.21, 1.74, 'RANGER'), (.68, 1.42, 'ON YOUR OWN')]):
    marker = cone('Map location dot', (x, -.145, z), .025, .025, .006, 'blackwood-trail-red', r, 16)
    marker.rotation_euler[0] = math.pi / 2
    text('Map location label', label, (x, -.149, z + .068), .048, 'blackwood-map-ink', parent=r)
for x, z in [(-.86, 1.80), (-.72, 1.71), (-.62, 1.86), (.11, 1.45), (.22, 1.46), (.76, 1.77), (.91, 1.70)]:
    plane_mesh('Map conifer glyph', [(x - .03, -.13, z - .04), (x + .03, -.13, z - .04), (x, -.13, z + .045)], [(0, 1, 2)], 'blackwood-map-ink', r)
cube('Responsibility plaque', (0, -.11, .89), (2.15, .04, .32), 'blackwood-green', .005, r)
text('Register disclaimer', 'IF LOST: DESCRIBE IT AS FIELDWORK', (0, -.138, .85), .076, 'paper', parent=r)
notice = empty('Unsecured training waiver', (.73, -.145, 1.60), r)
cube('Waiver paper', (0, 0, 0), (.48, .006, .51), 'paper', .001, notice)
text('Waiver header', 'AGE TEN?', (0, -.007, .14), .060, 'black', parent=notice)
text('Waiver line', 'WELL PREPARED', (0, -.009, .02), .031, 'black', parent=notice)
text('Waiver line', 'BY DEFINITION.', (0, -.009, -.08), .032, 'black', parent=notice)
for frame, a in [(1, -.011), (45, .014), (90, -.011)]:
    notice.rotation_euler[0] = a
    notice.keyframe_insert(data_path='rotation_euler', frame=frame)
save('forest-trailboard', [{'x': 0, 'z': 0, 'w': 2.47, 'd': .28}], True)

r = palette('mossy-stone-culvert')
# Twelve individually editable voussoirs surround a real open arch.
cx, spring, inner, outer = 0, .40, .73, 1.11
for segment in range(12):
    a = segment * math.pi / 12 + .009
    b = (segment + 1) * math.pi / 12 - .009
    verts = []
    for y in [-.44, .44]:
        for rad, angle in [(inner, a), (outer, a), (outer, b), (inner, b)]:
            verts.append((rad * math.cos(angle), y, spring + rad * math.sin(angle)))
    stone_obj = plane_mesh('Individual culvert arch stone', verts, [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], 'blackwood-mossy-stone', r)
    bevel = stone_obj.modifiers.new('Chipped masonry edges', 'BEVEL');bevel.width = .012;bevel.segments = 2
    stone_obj.modifiers.new('Masonry normals', 'WEIGHTED_NORMAL')
for side in [-1, 1]:
    for row in range(4):
        width = .76 + (.15 if row % 2 else 0)
        cube('Wing wall quarry block', (side * 1.23, 0, .14 + row * .29), (width, .92, .28), 'blackwood-mossy-stone', .018, r)
    cube('Wing wall stone cap', (side * 1.23, 0, 1.35), (.93, 1.03, .15), 'blackwood-mossy-stone', .022, r)
for x in [-.56, 0, .56]:
    cube('Top course coping stone', (x, 0, 1.57), (.55, .99, .19), 'blackwood-mossy-stone', .025, r)
cube('Culvert stream bed', (0, 0, .003), (1.45, 3.8, .006), 'blackwood-mossy-stone', .002, r)
cube('Culvert slow water', (0, 0, .013), (1.36, 3.72, .013), 'blackwood-creek', .001, r)
# Irregular thin moss patches sit on the coping; original soil/stone maps carry fine relief.
for patch in range(24):
    x = random.uniform(-1.60, 1.60)
    top = 1.685 if abs(x) < .82 else 1.437
    y = random.uniform(-.43, .43)
    radius = random.uniform(.032, .085)
    verts = [(x, y, top)] + [(x + math.cos(i * math.tau / 7) * radius, y + math.sin(i * math.tau / 7) * radius * random.uniform(.7, 1.2), top - .010) for i in range(7)]
    plane_mesh('Patch of coping moss', verts, [(0, i + 1, (i + 1) % 7 + 1) for i in range(7)], 'blackwood-moss', r)
save('mossy-stone-culvert', [{'x': 0, 'z': 0, 'w': 3.40, 'd': 1.06}])

(ROOT / 'artifacts/blackwood-catalog.json').write_text(json.dumps(catalog, indent=2))
print('BLACKWOOD_ASSETS_COMPLETE', len(catalog), flush=True)
