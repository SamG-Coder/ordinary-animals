"""Five independent Blender schoolyard assets for St Marrow.

The library contains a school block, separate gates, marked court, cycle shelter
and notice. Geometry and original packed PBR maps are authored here, never at
runtime. District placement and encounter logic live elsewhere.
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
rng = np.random.default_rng(7391)
random.seed(7391)
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
grain, wear, stain = field(410), field(29), field(7)
row = np.floor(yy * 24)
mortar = ((xx * 8 + (row % 2) * .5) % 1 < .04) | ((yy * 24) % 1 < .065)
ids = (np.floor(xx * 8 + (row % 2) * .5) % 8 + row * 8).astype(int)
v = .25 + .028 * grain + .035 * wear - .04 * stain + rng.uniform(-.033, .034, 192)[ids]
brick = np.stack([v, v * .79, v * .67], axis=-1)
brick[mortar] = np.stack([.23 + .018 * grain[mortar]] * 3, axis=-1)
brick_height = .0013 * grain + .001 * wear - .0033 * mortar
v = .36 + .025 * grain + .045 * wear - .047 * stain
concrete = np.stack([v * .94, v, v * .95], axis=-1)
concrete_height = .0007 * grain + .0017 * wear
v = .10 + .052 * grain + .047 * wear - .025 * stain
asphalt = np.stack([v * .94, v, v * .98], axis=-1)
asphalt_height = .0018 * grain + .0011 * wear
glass = np.stack([.12 + .027 * stain, .18 + .03 * stain, .18 + .019 * stain], axis=-1)
glass_height = .00018 * grain


def palette(name):
    root = setup(name)
    surface('marrow-brick', brick, brick_height, .88)
    surface('marrow-concrete', concrete, concrete_height, .9)
    surface('marrow-court-asphalt', asphalt, asphalt_height, .91)
    surface('marrow-old-glass', glass, glass_height, .34)
    material('marrow-iron', (.034, .041, .039), .63, metal=.35)
    material('marrow-oxblood', (.14, .047, .042), .83)
    material('marrow-putty', (.30, .32, .28), .79)
    material('marrow-rubber', (.014, .016, .015), .94)
    material('marrow-chrome', (.25, .29, .27), .26, metal=.80)
    material('marrow-faded-marking', (.39, .42, .34), .97)
    material('marrow-warning', (.40, .29, .08), .87)
    return root


def save(name, colliders=None, animated=False):
    measured_uvs()
    finish(name, animated)
    if colliders:
        catalog[name]['colliders'] = colliders
    catalog[name]['authoring'] = 'scripts/author_st_marrow.py'


def window_bank(root, x, y, z, width=3.56):
    cube('Concrete window reveal', (x, y, z), (width + .17, .15, 2.20), 'marrow-concrete', .009, root)
    cube('Deep sash shadow', (x, y - .091, z), (width + .025, .015, 2.02), 'marrow-iron', .002, root)
    cube('Old school glazing', (x, y - .105, z), (width, .023, 1.98), 'marrow-old-glass', .002, root)
    for dx in [-width / 2, -width / 6, width / 6, width / 2]:
        cube('Steel classroom mullion', (x + dx, y - .139, z), (.044, .058, 2.08), 'marrow-putty', .003, root)
    for dz in [-1.0, .37, 1.0]:
        cube('Steel classroom transom', (x, y - .139, z + dz), (width + .07, .058, .041), 'marrow-putty', .003, root)
    cube('Concrete drip sill', (x, y - .225, z - 1.09), (width + .28, .43, .10), 'marrow-concrete', .011, root)


r = palette('st-marrow-school-block')
cube('Two storey school masonry', (0, 0, 3.60), (14, 8, 7.2), 'marrow-brick', .014, r)
cube('School flat roof slab', (0, 0, 7.26), (14.28, 8.3, .16), 'marrow-iron', .009, r)
for y in [-4.07, 4.07]:
    cube('School parapet', (0, y, 7.46), (14.22, .27, .41), 'marrow-brick', .009, r)
    cube('Parapet coping', (0, y, 7.70), (14.33, .39, .094), 'marrow-concrete', .013, r)
for x in [-7.05, 7.05]:
    cube('Side parapet', (x, 0, 7.45), (.25, 8.08, .42), 'marrow-brick', .007, r)
    cube('Side roof coping', (x, 0, 7.70), (.38, 8.43, .095), 'marrow-concrete', .013, r)
for z in [.28, 3.46, 6.92]:
    cube('Front concrete string course', (0, -4.09, z), (14.13, .18, .25 if z > 1 else .56), 'marrow-concrete', .007, r)
for x in [-4.55, 4.55]:
    for z in [2.02, 5.34]:
        window_bank(r, x, -4.14, z)
for x in [-6.82, -2.28, 2.28, 6.82]:
    cube('School brick pilaster', (x, -4.12, 3.64), (.21, .19, 6.64), 'marrow-brick', .004, r)
cube('Entrance concrete surround', (0, -4.19, 1.48), (3.61, .24, 2.96), 'marrow-concrete', .013, r)
for x in [-.78, .78]:
    cube('School steel entrance door', (x, -4.34, 1.38), (1.49, .067, 2.72), 'marrow-oxblood', .009, r)
    cube('School door wired glass', (x, -4.384, 1.92), (1.12, .018, 1.14), 'marrow-old-glass', .003, r)
    cube('School door crash bar', (x, -4.43, 1.15), (1.25, .055, .057), 'marrow-chrome', .007, r)
    for dx in [-.35, 0, .35]:
        cube('Glazing protective wire', (x + dx, -4.40, 1.92), (.006, .007, 1.13), 'marrow-iron', 0, r)
cube('Low entrance threshold', (0, -4.37, .020), (3.74, .63, .04), 'marrow-concrete', .011, r)
cube('Concrete entrance canopy', (0, -4.63, 3.10), (4.28, 1.24, .17), 'marrow-concrete', .014, r)
for x in [-1.85, 1.85]:
    straight_tube('Canopy suspended tie', (x, -5.12, 3.14), (x, -4.12, 3.78), .018, 'marrow-iron', r)
cube('School name fascia', (0, -4.15, 4.05), (4.25, .11, .75), 'marrow-oxblood', .009, r)
text('School title', 'ST MARROW', (0, -4.215, 4.18), .30, 'paper', parent=r)
text('School category', 'COUNTY COMPREHENSIVE', (0, -4.216, 3.93), .132, 'paper', parent=r)
text('School motto', 'ABSENCE MAKES YOU QUALIFIED', (0, -4.217, 3.75), .078, 'paper', parent=r)
# A stopped school clock is readable architectural storytelling, not a UI overlay.
clock = cone('School clock case', (0, -4.20, 5.66), .69, .69, .16, 'marrow-iron', r, 64)
clock.rotation_euler[0] = math.pi / 2
face = cone('School clock dial', (0, -4.292, 5.66), .622, .622, .014, 'paper', r, 64)
face.rotation_euler[0] = math.pi / 2
for i in range(12):
    a = i * math.tau / 12
    tick = cube('Clock hour marker', (.535 * math.sin(a), -4.308, 5.66 + .535 * math.cos(a)), (.020, .008, .075), 'marrow-iron', .001, r)
    tick.rotation_euler[1] = a
straight_tube('Stopped hour hand', (0, -4.32, 5.66), (.30, -4.32, 5.66), .025, 'marrow-iron', r)
straight_tube('Stopped minute hand', (0, -4.326, 5.66), (.43 * math.sin(math.pi / 6), -4.326, 5.66 + .43 * math.cos(math.pi / 6)), .016, 'marrow-iron', r)
cube('Attendance badge plate', (2.03, -4.20, 1.84), (.51, .05, .64), 'marrow-oxblood', .005, r)
text('Attendance plate number', 'LEAGUE 07', (2.03, -4.232, 2.03), .057, 'paper', parent=r)
text('Attendance plate badge', 'ATTENDANCE', (2.03, -4.234, 1.78), .048, 'paper', parent=r)
for x in [-6.63, 6.63]:
    tube('School rainwater pipe', [(x, -4.32, 7.44), (x, -4.36, 7.03), (x, -4.36, .19), (x, -4.52, .12)], .041, 'marrow-iron', r)
cube('Roof stair housing', (-3.4, 1.45, 7.97), (3.0, 2.7, 1.35), 'marrow-brick', .011, r)
cube('Stair housing cap', (-3.4, 1.45, 8.68), (3.19, 2.92, .13), 'marrow-iron', .009, r)
save('st-marrow-school-block', [{'x': 0, 'z': 0, 'w': 14.22, 'd': 8.47}])

r = palette('school-entrance-gates')
for side in [-1, 1]:
    x = side * 4.25
    cube('School brick gate pier', (x, 0, 1.05), (.57, .61, 2.10), 'marrow-brick', .012, r)
    cube('Stone pier coping', (x, 0, 2.17), (.77, .80, .16), 'marrow-concrete', .021, r)
    gate = empty('Open school gate leaf', (side * 3.89, 0, .015), r)
    for y in [.04, 2.82]:
        cube('Gate end standard', (0, y, 1.02), (.056, .058, 1.98), 'marrow-oxblood', .004, gate)
    for z in [.20, 1.02, 1.93]:
        cube('Gate horizontal rail', (0, 1.42, z), (.044, 2.88, .05), 'marrow-oxblood', .004, gate)
    for y in np.linspace(.20, 2.66, 15):
        cube('Gate round-topped upright', (0, float(y), 1.04), (.025, .028, 1.85), 'marrow-oxblood', .004, gate)
    cube('Gate centre mesh panel', (0, 1.42, 1.27), (.027, 1.30, .68), 'marrow-oxblood', .011, gate)
    cube('School pier enamel plaque', (x, -.316, 1.51), (.42, .025, .43), 'marrow-oxblood', .009, r)
    text('School pier initials', 'SM', (x, -.335, 1.43), .17, 'paper', parent=r)
save('school-entrance-gates', [{'x': -4.25, 'z': 0, 'w': .80, 'd': .83}, {'x': 4.25, 'z': 0, 'w': .80, 'd': .83}, {'x': -3.89, 'z': -1.42, 'w': .11, 'd': 2.94}, {'x': 3.89, 'z': -1.42, 'w': .11, 'd': 2.94}])

r = palette('school-play-court')
cube('Weathered playground asphalt', (0, 0, .007), (12, 8, .014), 'marrow-court-asphalt', .003, r)
for x in [-5.30, 5.30]:
    cube('Court side line', (x, 0, .016), (.060, 6.64, .004), 'marrow-faded-marking', 0, r)
for y in [-3.30, 3.30]:
    cube('Court end line', (0, y, .016), (10.65, .061, .004), 'marrow-faded-marking', 0, r)
cube('Court centre line', (0, 0, .016), (.057, 6.60, .004), 'marrow-faded-marking', 0, r)
verts, faces = [], []
for i in range(65):
    a = i * math.tau / 64
    verts += [(math.cos(a) * .94, math.sin(a) * .94, .019), (math.cos(a) * 1.0, math.sin(a) * 1.0, .019)]
for i in range(64):
    a = i * 2
    faces.append((a, a + 1, a + 3, a + 2))
plane_mesh('Painted centre circle', verts, faces, 'marrow-faded-marking', r)
for side in [-1, 1]:
    for y in [-1.1, 1.1]:
        cube('Goal box line', (side * 4.31, y, .016), (1.98, .057, .004), 'marrow-faded-marking', 0, r)
    cube('Goal box inner line', (side * 3.34, 0, .016), (.057, 2.2, .004), 'marrow-faded-marking', 0, r)
# A small hopscotch strip grounds the battle area in an abandoned school day.
for number in range(1, 9):
    x = -4.60 + (number - 1) * .56
    for dy in [-.30, .30]:
        cube('Hopscotch chalk edge', (x, -3.63 + dy * .6, .020), (.52, .017, .003), 'marrow-faded-marking', 0, r)
    for dx in [-.26, .26]:
        cube('Hopscotch chalk side', (x + dx, -3.63, .020), (.017, .37, .003), 'marrow-faded-marking', 0, r)
    text('Hopscotch number', str(number), (x, -3.69, .023), .15, 'marrow-faded-marking', (0, 0, 0), r)
save('school-play-court')


def bicycle(root, x, y, color):
    # Two real spoked wheels and a diamond frame, modelled as part of the shelter prop.
    bike = empty('Uncollected school bicycle', (x, y, 0), root)
    for cy in [-.64, .64]:
        bpy.ops.mesh.primitive_torus_add(major_radius=.315, minor_radius=.024, major_segments=32, minor_segments=8, location=(0, cy, .35), rotation=(0, math.pi / 2, 0))
        link(bpy.context.object, 'Bicycle tyre', 'marrow-rubber', bike)
        for spoke in range(14):
            a = spoke * math.tau / 14
            straight_tube('Bicycle spoke', (0, cy, .35), (0, cy + math.cos(a) * .295, .35 + math.sin(a) * .295), .0025, 'marrow-chrome', bike)
    a, b, c, d = (0, -.64, .35), (0, -.08, .42), (0, .17, 1.00), (0, .52, .94)
    for start, end in [(a, b), (a, c), (b, c), (b, d), (c, d), (d, (0, .64, .35))]:
        straight_tube('Diamond bicycle frame', start, end, .016, color, bike)
    straight_tube('Bicycle seat tube', c, (0, .15, 1.11), .013, 'marrow-chrome', bike)
    cube('Bicycle saddle', (0, .10, 1.12), (.20, .27, .058), 'marrow-rubber', .035, bike)
    straight_tube('Bicycle handlebar stem', d, (0, .49, 1.14), .017, 'marrow-chrome', bike)
    tube('Bicycle handlebars', [(-.27, .61, 1.14), (-.22, .49, 1.18), (0, .49, 1.14), (.22, .49, 1.18), (.27, .61, 1.14)], .011, 'marrow-chrome', bike)
    for side in [-1, 1]:
        tube('Front fork blade', [(side * .026, .52, .94), (side * .042, .59, .55), (side * .042, .64, .35)], .013, color, bike)
        straight_tube('Bicycle crank arm', (0, -.08, .42), (side * .16, -.08, .39), .010, 'marrow-chrome', bike)
    tube('Front brake cable', [(-.18, .49, 1.17), (-.09, .37, 1.03), (-.045, .43, .88), (-.035, .61, .66)], .003, 'marrow-rubber', bike)
    for sx in [-.16, .16]:
        cube('Bicycle pedal', (sx, -.08, .39), (.17, .07, .028), 'marrow-rubber', .004, bike)
    tube('Bicycle chain', [(0, -.64, .36), (0, -.09, .48), (0, -.03, .42), (0, -.09, .35), (0, -.64, .31), (0, -.64, .36)], .004, 'marrow-iron', bike)


r = palette('school-bike-shelter')
for x in [-2.16, 2.16]:
    for y in [-1.1, 1.1]:
        cube('Cycle shelter steel post', (x, y, 1.20), (.065, .065, 2.40), 'marrow-iron', .005, r)
        cube('Shelter base anchor', (x, y, .038), (.22, .22, .076), 'marrow-concrete', .009, r)
roof = cube('Cycle shelter corrugated roof', (0, 0, 2.45), (4.73, 2.80, .09), 'marrow-old-glass', .008, r)
roof.rotation_euler[0] = .10
for x in np.linspace(-2.29, 2.29, 25):
    straight_tube('Roof corrugation', (float(x), -1.38, 2.36), (float(x), 1.38, 2.64), .014, 'marrow-putty', r)
for x in [-1.4, -.48, .48, 1.4]:
    tube('Bicycle Sheffield stand', [(x, -.69, .03), (x, -.69, .70), (x, -.50, .87), (x, .50, .87), (x, .69, .70), (x, .69, .03)], .022, 'marrow-chrome', r)
for x in [-1.32, .57]:
    bicycle(r, x, 0, 'marrow-oxblood' if x < 0 else 'council-green')
cube('Shelter instruction plate', (0, -1.405, 2.30), (2.64, .045, .26), 'marrow-oxblood', .005, r)
text('Shelter instruction', 'PLEASE COLLECT YOUR CHILD', (0, -1.433, 2.23), .124, 'paper', parent=r)
save('school-bike-shelter', [{'x': 0, 'z': 0, 'w': 4.65, 'd': 2.40}])

r = palette('st-marrow-notice')
for x in [-.81, .81]:
    cube('School notice upright', (x, .04, 1.11), (.076, .09, 2.22), 'marrow-iron', .005, r)
cube('School notice frame', (0, 0, 1.61), (2.07, .15, 1.34), 'marrow-oxblood', .012, r)
cube('School notice backing', (0, -.086, 1.61), (1.88, .025, 1.14), 'marrow-putty', .004, r)
text('School notice name', 'ST MARROW / PARENT INFORMATION', (0, -.105, 2.17), .077, 'paper', parent=r)
for x, title, lines in [
    (-.46, 'ABSENCE POLICY', ['THIRTY DAYS ABSENT?', 'PLEASE REPORT FOR', 'ANIMAL ASSESSMENT.']),
    (.46, 'SAFEGUARDING', ['ALL CONCERNS HAVE', 'BEEN REFERRED TO', 'THE CHILD.']),
]:
    paper = empty('Unsecured school circular', (x, -.106, 1.59), r)
    cube('School circular paper', (0, 0, 0), (.82, .007, .86), 'paper', .001, paper)
    text('Circular title', title, (0, -.008, .28), .071, 'black', parent=paper)
    for index, line in enumerate(lines):
        text('Circular wording', line, (0, -.009, .09 - index * .135), .049, 'black', parent=paper)
    for frame, angle in [(1, -.008), (45, .012), (90, -.008)]:
        paper.rotation_euler[0] = angle
        paper.keyframe_insert(data_path='rotation_euler', frame=frame)
text('Notice footer', 'EDUCATION CONTINUES OUTSIDE', (0, -.105, 1.04), .073, 'paper', parent=r)
save('st-marrow-notice', [{'x': 0, 'z': 0, 'w': 2.1, 'd': .24}], True)

(ROOT / 'artifacts/st-marrow-catalog.json').write_text(json.dumps(catalog, indent=2))
print('ST_MARROW_ASSETS_COMPLETE', len(catalog), flush=True)
