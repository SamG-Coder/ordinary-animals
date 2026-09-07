"""Five separate Blender-authored North Drain civic and stormwater modules.

Packed original PBR maps, editable per-asset sources, exported per-asset GLBs.
No assembled district geometry and no shared catalog mutation.
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
catalog = {}
SIZE = 1024
rng = np.random.default_rng(4107)
random.seed(4107)
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
grain, wear, damp = field(410), field(38), field(7)
row = np.floor(yy * 24)
joint = ((xx * 8 + (row % 2) * .5) % 1 < .040) | ((yy * 24) % 1 < .065)
brick_id = (np.floor(xx * 8 + (row % 2) * .5) % 8 + row * 8).astype(int)
variation = rng.uniform(-.024, .033, 192)[brick_id]
v = .23 + .045 * grain + .035 * wear - .05 * damp + variation
brick = np.stack([v * .88, v * .77, v * .66], axis=-1)
brick[joint] = np.stack([.20 + .024 * grain[joint]] * 3, axis=-1)
brick_height = .0014 * grain + .001 * wear - .0038 * joint
v = .29 + .034 * grain + .07 * wear - .065 * damp
concrete = np.stack([v * .98, v, v * .91], axis=-1)
concrete_height = .0015 * grain + .002 * wear
corrosion = np.clip((wear - .49) * 3.2, 0, 1)
metal = np.stack([.075 + .13 * corrosion + .012 * grain, .115 - .035 * corrosion + .01 * grain, .10 - .046 * corrosion + .01 * grain], axis=-1)
metal_height = .0003 * grain + .0013 * corrosion
rain = np.sin(xx * 700 + np.sin(xx * 41 + yy * 8) * 2) ** 20
v = .17 + .041 * damp + .02 * wear - .019 * rain
glass = np.stack([v * .77, v * .95, v], axis=-1)
glass_height = .00015 * grain + .00025 * rain
water_height = .001 * np.sin(yy * math.tau * 12 + np.sin(xx * math.tau * 2)) + .0009 * wear
water = np.stack([.032 + .009 * damp, .055 + .014 * damp, .046 + .007 * damp], axis=-1)


def palette(name):
    root = setup(name)
    surface('drain-engineering-brick', brick, brick_height, .90)
    surface('drain-weathered-concrete', concrete, concrete_height, .89)
    surface('drain-painted-iron', metal, metal_height, .72)
    surface('drain-window-glass', glass, glass_height, .34)
    surface('drain-murky-water', water, water_height, .18)
    material('drain-black-iron', (.026, .032, .027), .50, metal=.60)
    material('drain-warning-ochre', (.38, .28, .075), .87)
    material('drain-gasket', (.013, .016, .013), .94)
    material('drain-lime', (.34, .36, .33), .92)
    material('drain-label', (.55, .54, .43), .94)
    return root


def save(name, colliders=None, animated=False):
    measured_uvs()
    finish(name, animated)
    if colliders:
        catalog[name]['colliders'] = colliders
    catalog[name]['authoring'] = 'scripts/author_north_drain.py'


def arch_window(root, cx, y, bottom=1.13, spring=3.08, radius=.82):
    vertices = [(cx - radius, y, bottom), (cx + radius, y, bottom)]
    vertices += [(cx + radius * math.cos(i * math.pi / 20), y, spring + radius * math.sin(i * math.pi / 20)) for i in range(21)]
    plane_mesh('Arched industrial glass', vertices, [tuple(range(len(vertices)))], 'drain-window-glass', root)
    for x in [cx - radius, cx, cx + radius]:
        cube('Heavy iron window mullion', (x, y - .044, (bottom + spring) / 2), (.054, .059, spring - bottom), 'drain-painted-iron', .003, root)
    for z in [bottom, 1.80, 2.43, spring]:
        cube('Heavy iron transom', (cx, y - .044, z), (radius * 2 + .08, .059, .052), 'drain-painted-iron', .003, root)
    for angle in np.linspace(0, math.pi, 17):
        x = cx + (radius + .105) * math.cos(angle)
        z = spring + (radius + .105) * math.sin(angle)
        block = cube('Radial arch brick', (float(x), y + .005, float(z)), (.20, .20, .145), 'drain-engineering-brick', .004, root)
        block.rotation_euler[1] = float(-angle)
    tube('Arched iron frame', [(cx + radius * math.cos(i * math.pi / 24), y - .06, spring + radius * math.sin(i * math.pi / 24)) for i in range(25)], .026, 'drain-painted-iron', root)
    for angle in [math.pi / 4, math.pi / 2, math.pi * 3 / 4]:
        straight_tube('Fanlight spoke', (cx, y - .07, spring), (cx + radius * math.cos(angle), y - .07, spring + radius * math.sin(angle)), .017, 'drain-painted-iron', root)
    cube('Projecting stone window sill', (cx, y - .15, bottom - .095), (2.08, .40, .16), 'drain-weathered-concrete', .014, root)


def ring_pipe(root, name, y, length=2.8, radius=.46, x=0, z=.77):
    # Closed annular ends with an actual hollow bore, not a painted black disc.
    verts, faces = [], []
    for end in [-length / 2, length / 2]:
        for rad in [radius, radius - .065]:
            for i in range(40):
                a = i * math.tau / 40
                verts.append((x + rad * math.cos(a), y + end, z + rad * math.sin(a)))
    for i in range(40):
        j = (i + 1) % 40
        faces.extend([(i, j, 80 + j, 80 + i), (40 + i, 120 + i, 120 + j, 40 + j), (i, 40 + i, 40 + j, j), (80 + i, 80 + j, 120 + j, 120 + i)])
    mesh = plane_mesh(name, verts, faces, 'drain-painted-iron', root)
    for polygon in mesh.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    for end in [-length / 2 + .045, length / 2 - .045]:
        bpy.ops.mesh.primitive_torus_add(major_radius=radius + .034, minor_radius=.032, major_segments=40, minor_segments=8, location=(x, y + end, z), rotation=(math.pi / 2, 0, 0))
        link(bpy.context.object, 'Pipe flange rim', 'drain-black-iron', root)
        for i in range(10):
            a = i * math.tau / 10
            bolt = cone('Flange hex bolt', (x + (radius + .027) * math.cos(a), y + end - .035, z + (radius + .027) * math.sin(a)), .021, .021, .10, 'drain-black-iron', root, 6)
            bolt.rotation_euler[0] = math.pi / 2


r = palette('pump-station')
cube('Civic pump hall masonry', (0, 0, 2.36), (12, 8.4, 4.72), 'drain-engineering-brick', .019, r)
cube('Raised damp course', (0, -4.24, .24), (12.08, .15, .48), 'drain-weathered-concrete', .006, r)
cube('Flat roof deck', (0, 0, 4.77), (12.28, 8.65, .14), 'drain-black-iron', .014, r)
for y in [-4.25, 4.25]:
    cube('Brick parapet', (0, y, 4.98), (12.22, .26, .50), 'drain-engineering-brick', .011, r)
    cube('Parapet stone coping', (0, y, 5.25), (12.36, .38, .11), 'drain-weathered-concrete', .015, r)
for x in [-6.01, 6.01]:
    cube('End parapet', (x, 0, 4.98), (.25, 8.40, .5), 'drain-engineering-brick', .009, r)
    cube('End coping', (x, 0, 5.25), (.35, 8.72, .11), 'drain-weathered-concrete', .012, r)
for width, z, h in [(4.1, 5.33, .35), (2.8, 5.62, .25), (1.48, 5.84, .20)]:
    cube('Stepped civic pediment', (0, -4.25, z), (width, .36, h), 'drain-engineering-brick', .009, r)
    cube('Stepped pediment coping', (0, -4.25, z + h / 2 + .045), (width + .17, .49, .09), 'drain-weathered-concrete', .013, r)
for x in [-4.0, 4.0]:
    arch_window(r, x, -4.315)
for x in [-5.72, -2.31, 2.31, 5.72]:
    cube('Projecting brick pilaster', (x, -4.285, 2.30), (.30, .19, 4.30), 'drain-engineering-brick', .008, r)
cube('Central entrance stone surround', (0, -4.31, 1.50), (2.65, .27, 3.0), 'drain-weathered-concrete', .012, r)
cube('Pump hall steel door', (0, -4.47, 1.37), (2.27, .085, 2.74), 'drain-painted-iron', .01, r)
for x in [-.57, .57]:
    cube('Steel door pressed panel', (x, -4.526, 1.03), (.98, .031, 1.77), 'drain-black-iron', .012, r)
    cube('Door wired glass', (x, -4.53, 2.22), (.72, .020, .62), 'drain-window-glass', .004, r)
    for dz in [-.18, 0, .18]:
        cube('Door glass protection', (x, -4.557, 2.22 + dz), (.76, .027, .014), 'drain-black-iron', .003, r)
    cube('Door push bar', (x, -4.603, 1.32), (.86, .05, .055), 'steel', .008, r)
cube('Entrance threshold', (0, -4.49, .035), (2.69, .52, .071), 'drain-weathered-concrete', .015, r)
cube('Civic engraved sign', (0, -4.345, 3.56), (4.26, .16, .84), 'drain-weathered-concrete', .012, r)
text('Station name', 'NORTH DRAIN', (0, -4.43, 3.71), .285, 'drain-black-iron', parent=r)
text('Station service', 'COUNTY WATER SERVICES', (0, -4.431, 3.46), .136, 'drain-black-iron', parent=r)
text('Station age', 'EST. 1912  /  STILL UNDER REVIEW', (0, -4.432, 3.25), .083, 'drain-black-iron', parent=r)
cube('League hygiene plate', (1.65, -4.32, 1.82), (.53, .052, .60), 'drain-warning-ochre', .007, r)
text('League plate top', 'LEAGUE 04', (1.65, -4.352, 1.99), .059, 'drain-black-iron', parent=r)
text('League plate badge', 'HYGIENE', (1.65, -4.354, 1.76), .065, 'drain-black-iron', parent=r)
cube('Notice above door', (0, -4.54, 2.92), (1.85, .04, .17), 'drain-warning-ochre', .003, r)
text('Door warning', 'AUTHORISED MINORS ONLY', (0, -4.565, 2.87), .078, 'drain-black-iron', parent=r)
for x in [-5.78, 5.78]:
    tube('Cast iron downpipe', [(x, -4.47, 5.0), (x, -4.48, 4.66), (x, -4.48, .24), (x, -4.62, .13)], .047, 'drain-painted-iron', r)
# Industrial roof plant changes the skyline without a second building-sized export.
cube('Roof ventilator base', (2.45, 1.12, 5.13), (1.8, 2.0, .59), 'drain-painted-iron', .018, r)
for z in [5.02, 5.10, 5.18, 5.26, 5.34]:
    cube('Ventilator louvre', (2.45, .06, z), (1.60, .15, .031), 'drain-black-iron', .003, r)
cube('Ventilator rain cap', (2.45, 1.12, 5.46), (2.04, 2.24, .09), 'drain-black-iron', .012, r)
for x in [-3.6, -2.35]:
    cone('Pressure relief standpipe', (x, 1.8, 5.45), .17, .17, 1.43, 'drain-painted-iron', r)
    cone('Pressure vent rain hood', (x, 1.8, 6.20), .29, .18, .16, 'drain-painted-iron', r)
for z in np.linspace(.35, 5.04, 15):
    straight_tube('Service ladder rung', (5.12, 4.47, float(z)), (5.75, 4.47, float(z)), .015, 'drain-black-iron', r)
for x in [5.12, 5.75]:
    straight_tube('Service ladder rail', (x, 4.47, .15), (x, 4.47, 5.61), .020, 'drain-black-iron', r)
cube('Side pump manifold enclosure', (-6.69, -1.82, .70), (1.38, 1.21, 1.4), 'drain-painted-iron', .026, r)
tube('Manifold feed pipe', [(-5.93, -1.8, 1.4), (-6.54, -1.8, 1.4), (-7.90, -1.8, .77)], .20, 'drain-painted-iron', r)
save('pump-station', [
    {'x': 0, 'z': 0, 'w': 12.2, 'd': 8.76},
    {'x': -7.04, 'z': 1.82, 'w': 2.12, 'd': 1.3},
])

r = palette('brick-drain-channel-4m')
cube('Channel concrete bed', (0, 0, .004), (4.08, 4, .008), 'drain-weathered-concrete', .002, r)
for side in [-1, 1]:
    cube('Low engineering brick bank', (side * 1.90, 0, .25), (.30, 4, .50), 'drain-engineering-brick', .006, r)
    cube('Bank coping', (side * 1.88, 0, .51), (.42, 4, .085), 'drain-weathered-concrete', .006, r)
    verts = [(side * 1.73, -2, .47), (side * 1.34, -2, .009), (side * 1.34, 2, .009), (side * 1.73, 2, .47)]
    plane_mesh('Sloping concrete invert', verts, [(0, 1, 2, 3) if side < 0 else (3, 2, 1, 0)], 'drain-weathered-concrete', r)
    for y in [-1.94, .04, 1.94]:
        cube('Coping expansion joint', (side * 1.88, y, .555), (.41, .009, .005), 'drain-gasket', 0, r)
verts, faces = [], []
for iy in range(17):
    for ix in range(9):
        x = -1.355 + ix * 2.71 / 8
        y = -2 + iy * .25
        verts.append((x, y, .017 + .0015 * math.sin(y * 11 + x * 4)))
for iy in range(16):
    for ix in range(8):
        a = iy * 9 + ix
        faces.append((a, a + 1, a + 10, a + 9))
water_mesh = plane_mesh('Slow stormwater ripple', verts, faces, 'drain-murky-water', r)
water_mesh.shape_key_add(name='Basis')
ripple = water_mesh.shape_key_add(name='Stormwater drift')
for vertex in ripple.data:
    vertex.co.z += .0017 * math.sin(vertex.co.y * 11 + vertex.co.x * 4 + math.pi)
for frame, value in [(1, 0), (45, 1), (90, 0)]:
    ripple.value = value
    ripple.keyframe_insert(data_path='value', frame=frame)
# A 2.3 m cross-section keeps this shallow civic flume outside both the traffic
# lanes and the battle apron, while its standard repeat remains four metres.
r.scale.x = .55
save('brick-drain-channel-4m', [{'x': -1.88 * .55, 'z': 0, 'w': .45 * .55, 'd': 4}, {'x': 1.88 * .55, 'z': 0, 'w': .45 * .55, 'd': 4}], True)

r = palette('drainage-pipe')
ring_pipe(r, 'Hollow cast iron drain pipe', 0)
for y in [-.87, .87]:
    cube('Concrete pipe sleeper', (0, y, .16), (1.05, .29, .32), 'drain-weathered-concrete', .025, r)
    tube('Pipe support strap', [(math.cos(a) * .49, y, .77 + math.sin(a) * .49) for a in np.linspace(0, math.pi, 17)], .016, 'drain-black-iron', r)
    for x in [-.51, .51]:
        cone('Sleeper anchor bolt', (x, y, .31), .025, .025, .10, 'drain-black-iron', r, 6)
cube('Pipe flow identification', (0, -.93, 1.246), (.30, .34, .013), 'drain-warning-ochre', .003, r)
text('Pipe flow label', 'OUTFALL 04', (0, -.93, 1.258), .044, 'drain-black-iron', (0, 0, 0), r)
save('drainage-pipe', [{'x': 0, 'z': 0, 'w': 1.10, 'd': 2.86}])

r = palette('canal-footbridge')
# This bay substitutes for one channel segment. Its central passage has no banks.
# The near-grade steel deck avoids requiring an unmodelled runtime slope.
cube('Bridge bay concrete invert', (0, 0, .002), (4, 4.20, .004), 'drain-weathered-concrete', .001, r)
cube('Bridge bay water', (0, 0, .011), (3.98, 2.74, .008), 'drain-murky-water', 0, r)
for side in [-1, 1]:
    for end in [-1, 1]:
        cube('Bridge abutment wing', (side * 1.80, end * 1.88, .24), (.39, .46, .48), 'drain-engineering-brick', .012, r)
        cube('Abutment stone cap', (side * 1.78, end * 1.88, .51), (.43, .48, .079), 'drain-weathered-concrete', .009, r)
for y in [-1.95, -1.17, -.39, .39, 1.17, 1.95]:
    cube('Individual steel bridge deck plate', (0, y, .014), (2.73, .773, .012), 'drain-painted-iron', .001, r)
    for x in np.linspace(-1.23, 1.23, 13):
        tread = cube('Raised anti-slip chevron', (float(x), y, .022), (.14, .019, .006), 'drain-black-iron', .001, r)
        tread.rotation_euler[2] = .6 if int((x + 1.23) * 6) % 2 else -.6
for x in [-1.45, 1.45]:
    for y in [-2.20, -1.1, 0, 1.1, 2.20]:
        cube('Bridge railing standard', (x, y, .61), (.050, .050, 1.19), 'drain-painted-iron', .004, r)
        cube('Railing bolted foot', (x, y, .11), (.12, .13, .03), 'drain-black-iron', .004, r)
    for z in [.35, .76, 1.20]:
        cube('Bridge tubular handrail', (x, 0, z), (.041, 4.45, .041), 'drain-painted-iron', .005, r)
for x in [-1.41, 1.41]:
    for y in [-2.18, 2.18]:
        cube('Handrail hazard cuff', (x, y, .90), (.058, .071, .35), 'drain-warning-ochre', .002, r)
cube('Bridge inspection plaque', (1.45, -1.1, .95), (.03, .47, .21), 'drain-label', .004, r)
text('Bridge inspection wording', 'INSPECTED BY AGE 10', (1.426, -1.1, .935), .035, 'drain-black-iron', (math.pi / 2, 0, -math.pi / 2), r)
r.scale.y = .55
save('canal-footbridge', [
    {'x': -1.45, 'z': 0, 'w': .13, 'd': 4.5 * .55},
    {'x': 1.45, 'z': 0, 'w': .13, 'd': 4.5 * .55},
    {'x': -1.80, 'z': -1.88 * .55, 'w': .43, 'd': .49 * .55},
    {'x': 1.80, 'z': -1.88 * .55, 'w': .43, 'd': .49 * .55},
    {'x': -1.80, 'z': 1.88 * .55, 'w': .43, 'd': .49 * .55},
    {'x': 1.80, 'z': 1.88 * .55, 'w': .43, 'd': .49 * .55},
])

r = palette('north-drain-notice')
for x in [-.94, .94]:
    cube('Galvanised warning post', (x, .03, 1.28), (.067, .083, 2.56), 'drain-painted-iron', .005, r)
    cube('Post concrete footing', (x, .03, .06), (.25, .27, .12), 'drain-weathered-concrete', .009, r)
cube('County enamel name board', (0, 0, 2.12), (2.34, .094, .69), 'drain-painted-iron', .012, r)
text('District name', 'NORTH DRAIN', (0, -.055, 2.20), .223, 'drain-label', parent=r)
text('District motto', 'A PLACE TO WASH YOUR HANDS OF', (0, -.056, 1.94), .076, 'drain-label', parent=r)
cube('Drain warning backing', (0, 0, 1.23), (1.90, .082, 1.00), 'drain-warning-ochre', .009, r)
for x in [-.89, .89]:
    cube('Warning border', (x, -.047, 1.23), (.018, .003, .87), 'drain-black-iron', 0, r)
for z in [.79, 1.66]:
    cube('Warning border', (0, -.047, z), (1.79, .003, .018), 'drain-black-iron', 0, r)
text('Warning heading', 'DANGER: OPEN DRAINS', (0, -.049, 1.49), .119, 'drain-black-iron', parent=r)
text('Warning line', 'NO DIVING. NO SWIMMING.', (0, -.051, 1.25), .073, 'drain-black-iron', parent=r)
text('Warning line', 'NO ADULT SUPERVISION.', (0, -.052, 1.07), .077, 'drain-black-iron', parent=r)
text('Warning footer', 'JUNIOR INSPECTION ROUTE', (0, -.053, .87), .072, 'drain-black-iron', parent=r)
for x in [-.86, .86]:
    for z in [.84, 1.60, 1.89, 2.39]:
        bolt = cone('Enamel sign fixing', (x, -.058, z), .013, .013, .012, 'steel', r, 6)
        bolt.rotation_euler[0] = math.pi / 2
save('north-drain-notice', [{'x': 0, 'z': 0, 'w': 2.35, 'd': .30}])

(ARTIFACTS / 'north-drain-catalog.json').write_text(json.dumps(catalog, indent=2))
print('NORTH_DRAIN_ASSETS_COMPLETE', len(catalog), flush=True)
