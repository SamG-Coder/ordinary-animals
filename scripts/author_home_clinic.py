"""Individual Blender furniture and room modules for the playable home and clinic.

Only these new .blend/.glb files and an ignored catalog proposal are written.
All floors, walls and props remain separately placeable; no complete room mesh.
"""
import ast
import bpy
import json
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / 'game-assets/models'
catalog = {}
random.seed(3191)
for file, names in [
    ('author_blender.py', {'begin', 'link', 'empty', 'cube', 'cone', 'tube', 'text', 'plane_mesh', 'ellipsoid', 'material'}),
    ('detail_assets.py', {'setup'}),
    ('opening_art_pass.py', {'finish'}),
]:
    tree = ast.parse((ROOT / 'scripts' / file).read_text())
    exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names], type_ignores=[]), 'Blender helpers only', 'exec'))


def palette(name):
    root = setup(name)
    for asset in ['exterior-wall-4m', 'floor-4m', 'roof-4m', 'path-2m', 'bed']:
        with bpy.data.libraries.load(str(ROOT / 'assets' / f'{asset}.blend'), link=False) as (src, dst):
            dst.materials = [n for n in src.materials if not bpy.data.materials.get(n)]
    M.update({m.name: m for m in bpy.data.materials})
    material('old-enamel', (.49, .49, .39), .41)
    material('sink-ceramic', (.53, .57, .51), .30)
    material('home-green', (.072, .10, .078), .69)
    material('home-chrome', (.30, .33, .31), .24, metal=.8)
    material('home-rubber', (.018, .019, .017), .85)
    material('home-stain', (.13, .14, .093), .9)
    material('home-upholstery', (.10, .12, .097), .96, texture=None)
    material('clinic-enamel', (.27, .34, .28), .55)
    material('clinic-glass', (.07, .13, .12), .21)
    material('television-screen', (.015, .045, .025), .45, emission=.25)
    material('television-letters', (.26, .34, .23), .6, emission=.65)
    material('coldglass', (.16, .24, .31), .34, emission=.45)
    material('red', (.18, .028, .018), .8)
    return root


def save(name, colliders=None, animated=False):
    bpy.context.view_layer.update()
    finish(name, animated)
    if colliders:
        catalog[name]['colliders'] = colliders
    catalog[name]['authoring'] = 'scripts/author_home_clinic.py'


def tap(root, x, y, z):
    tube('Chrome mixer swan neck', [(x, y, z), (x, y, z + .25), (x, y - .14, z + .30), (x, y - .22, z + .25)], .016, 'home-chrome', root)
    cone('Mixer mounting', (x, y, z + .015), .044, .035, .035, 'home-chrome', root)
    for dx in [-.11, .11]:
        cone('Tap handle base', (x + dx, y, z + .035), .025, .025, .055, 'home-chrome', root)
        cube('Cross tap handle', (x + dx, y, z + .063), (.07, .013, .012), 'home-chrome', .004, root)


r = palette('room-window-4m')
for x in [-1.5, 1.5]:
    cube('Plaster window pier', (x, 0, 1.5), (1, .18, 3), 'wall', .003, r)
    cube('Exterior brick pier', (x, .14, 1.5), (1, .13, 3), 'brick', .003, r)
for z, h in [(.46, .92), (2.78, .44)]:
    cube('Plaster window wall', (0, 0, z), (2, .18, h), 'wall', .003, r)
    cube('Exterior brick window wall', (0, .14, z), (2, .13, h), 'brick', .003, r)
for x in [-.94, 0, .94]:
    cube('Window sash upright', (x, 0, 1.74), (.06, .11, 1.7), 'ivory', .004, r)
for z in [.94, 1.73, 2.55]:
    cube('Window sash crosspiece', (0, 0, z), (1.94, .11, .057), 'ivory', .004, r)
cube('Overcast window glass', (0, .04, 1.74), (1.84, .016, 1.56), 'coldglass', .001, r)
cube('Interior window sill', (0, -.20, .915), (2.17, .46, .079), 'ivory', .012, r)
cube('Exterior stone sill', (0, .25, .915), (2.14, .34, .08), 'road', .011, r)
for y in [-.107, .235]:
    cube('Skirting board', (0, y, .10), (4, .04, .19), 'ivory', .002, r)
save('room-window-4m', [{'x': 0, 'z': -.07, 'w': 4, 'd': .31}])

r = palette('domestic-tile-floor-4m')
cube('Floor substrate', (0, 0, -.07), (4, 4, .10), 'home-rubber', 0, r)
for iy in range(10):
    for ix in range(10):
        cube('Aged kitchen floor tile', (-1.8 + ix * .4, -1.8 + iy * .4, -.011), (.392, .392, .022), 'old-enamel' if (ix + iy) % 2 else 'home-green', .002, r)
save('domestic-tile-floor-4m')

r = palette('kitchen-counter')
cube('Kitchen cabinet carcass', (0, 0, .435), (2.4, .68, .84), 'oak', .01, r)
cube('Dark kickboard', (0, -.355, .07), (2.33, .08, .14), 'home-rubber', .004, r)
cube('Laminate worktop', (0, 0, .884), (2.47, .73, .058), 'old-enamel', .012, r)
for x in [-.80, 0, .80]:
    cube('Panel cupboard door', (x, -.355, .48), (.75, .035, .65), 'home-green', .012, r)
    cube('Inset cupboard field', (x, -.38, .46), (.62, .02, .50), 'oak', .008, r)
    tube('Cupboard handle', [(x + .23, -.401, .61), (x + .23, -.425, .61), (x + .23, -.425, .74), (x + .23, -.401, .74)], .009, 'home-chrome', r)
cube('Sink rim', (-.52, -.01, .923), (.81, .48, .027), 'home-chrome', .045, r)
cube('Sink recess', (-.52, -.035, .94), (.65, .34, .017), 'home-rubber', .065, r)
cube('Stained basin bottom', (-.52, -.035, .946), (.52, .23, .012), 'home-chrome', .06, r)
cone('Sink drain', (-.52, -.035, .957), .041, .041, .005, 'home-rubber', r)
tap(r, -.52, .235, .925)
cube('Two ring hob plate', (.65, -.015, .934), (.80, .53, .027), 'home-rubber', .012, r)
for x in [.42, .88]:
    cone('Hob enamel ring', (x, -.015, .958), .145, .145, .015, 'home-chrome', r, 24)
    cone('Hob dark burner', (x, -.015, .97), .117, .117, .01, 'home-rubber', r, 24)
    for angle in [0, math.pi / 2]:
        bar = cube('Burner support', (x, -.015, .987), (.30, .018, .016), 'steel', .002, r)
        bar.rotation_euler[2] = angle
for x in [.42, .88]:
    cone('Hob control', (x, -.245, .969), .030, .028, .034, 'home-rubber', r, 12)
save('kitchen-counter', [{'x': 0, 'z': 0, 'w': 2.48, 'd': .76}])

r = palette('kitchen-fridge')
cube('Old fridge body', (0, 0, .965), (.70, .72, 1.86), 'old-enamel', .035, r)
for z, h in [(1.59, .55), (.69, 1.18)]:
    cube('Fridge door', (0, -.383, z), (.68, .067, h), 'sink-ceramic', .028, r)
    tube('Fridge door handle', [(.23, -.429, z - .16), (.23, -.46, z - .16), (.23, -.46, z + .16), (.23, -.429, z + .16)], .012, 'home-chrome', r)
cube('Fridge note', (-.06, -.424, 1.40), (.34, .005, .36), 'paper', .001, r)
text('Fridge note heading', 'LATE SHIFT', (-.06, -.429, 1.47), .041, 'black', parent=r)
text('Fridge note body', 'TEA IN FRIDGE.', (-.06, -.43, 1.39), .026, 'black', parent=r)
text('Fridge note body', 'BACK TOMORROW.', (-.06, -.43, 1.33), .025, 'black', parent=r)
cube('Letter magnet', (-.11, -.435, 1.57), (.066, .022, .044), 'red', .004, r)
for x in [-.25, .25]:
    cube('Fridge foot', (x, .16, .035), (.07, .10, .07), 'home-rubber', .006, r)
save('kitchen-fridge', [{'x': 0, 'z': .02, 'w': .73, 'd': .80}])

r = palette('family-sofa')
cube('Sofa lower frame', (0, 0, .32), (2.28, .95, .42), 'cloth', .105, r)
cube('Sofa sloping back', (0, .35, .75), (2.18, .24, .91), 'cloth', .105, r)
for x in [-1.06, 1.06]:
    cube('Rounded sofa arm', (x, -.015, .65), (.26, 1.02, .65), 'cloth', .115, r)
for x in [-.68, 0, .68]:
    cube('Worn seat cushion', (x, -.10, .57), (.65, .73, .20), 'cloth', .075, r)
    back = cube('Loose back cushion', (x, .23, .92), (.65, .17, .51), 'cloth', .079, r)
    back.rotation_euler[0] = -.12
for x in [-.86, .86]:
    for y in [-.31, .31]:
        cube('Short timber sofa foot', (x, y, .10), (.065, .065, .18), 'oak', .009, r)
throw = cube('Folded wool throw', (.61, -.17, .70), (.48, .66, .035), 'home-green', .02, r)
throw.rotation_euler[2] = .07
for x in [.42, .48, .54, .60, .66, .72, .78]:
    tube('Blanket fringe', [(x, -.50, .707), (x, -.58, .69), (x + .02, -.63, .62)], .003, 'home-green', r)
save('family-sofa', [{'x': 0, 'z': 0, 'w': 2.4, 'd': 1.08}])

r = palette('home-dining-table')
cube('Formica dining top', (0, 0, .754), (1.5, .91, .054), 'old-enamel', .021, r)
for x in [-.63, .63]:
    for y in [-.32, .32]:
        cube('Tapered kitchen table leg', (x, y, .373), (.038, .038, .745), 'oak', .007, r)
cube('Dining apron', (0, 0, .681), (1.30, .72, .10), 'oak', .006, r)
cone('Unwashed plate rim', (.3, 0, .798), .145, .138, .017, 'sink-ceramic', r, 36)
cone('Unwashed plate centre', (.3, 0, .808), .11, .11, .005, 'old-enamel', r, 36)
cube('Brown envelope', (-.37, -.02, .788), (.37, .23, .005), 'paper', .001, r)
text('Envelope heading', 'SCHOOL ABSENCE', (-.37, .02, .793), .024, 'black', (0, 0, 0), r)
text('Envelope footer', 'APPROVED', (-.37, -.07, .793), .024, 'black', (0, 0, 0), r)
save('home-dining-table', [{'x': 0, 'z': 0, 'w': 1.53, 'd': .94}])

r = palette('home-crt-tv')
cube('Television cabinet', (0, 0, .55), (1.04, .62, .86), 'oak', .023, r)
cube('Dark TV fascia', (0, -.33, .63), (.99, .044, .66), 'home-rubber', .019, r)
cube('Rounded CRT glass', (-.09, -.369, .65), (.71, .044, .49), 'television-screen', .085, r)
text('Television channel', 'COUNTY NEWS', (-.09, -.398, .75), .048, 'television-letters', parent=r)
text('Television programme', 'TEN IS OLD ENOUGH', (-.09, -.398, .61), .032, 'television-letters', parent=r)
text('Television strapline', 'PARENTS ASSURED', (-.09, -.398, .51), .027, 'television-letters', parent=r)
scan = cube('Slow television scan', (-.09, -.40, .43), (.60, .001, .005), 'television-letters', 0, r)
for frame, z in [(1, .43), (88, .85), (90, .43)]:
    scan.location.z = z
    scan.keyframe_insert(data_path='location', frame=frame)
for z in [.53, .75]:
    knob = cone('TV rotary tuner', (.38, -.383, z), .045, .045, .022, 'home-chrome', r)
    knob.rotation_euler[0] = math.pi / 2
for z in [.35, .38, .41]:
    cube('TV speaker slot', (.33, -.358, z), (.18, .009, .01), 'home-rubber', .001, r)
for side in [-1, 1]:
    tube('Rabbit ear antenna', [(side * .10, .08, 1.0), (side * .28, .08, 1.24), (side * .43, .08, 1.48)], .003, 'home-chrome', r)
for x in [-.39, .39]:
    cube('TV cabinet foot', (x, 0, .08), (.045, .42, .16), 'oak', .006, r)
save('home-crt-tv', [{'x': 0, 'z': 0, 'w': 1.08, 'd': .80}], True)

r = palette('family-photo')
cube('Timber family picture frame', (0, 0, .30), (.45, .039, .55), 'oak', .008, r)
cube('Aged photograph paper', (0, -.025, .30), (.389, .012, .48), 'paper', .001, r)
material('sepia-photo', (.12, .086, .046), .95)
for x, z, scale in [(-.108, .35, 1), (.10, .35, 1), (0, .23, .60)]:
    ellipsoid('Photographic head silhouette', (x, -.035, z + .083 * scale), (.038 * scale, .0018, .046 * scale), 'sepia-photo', r)
    ellipsoid('Photographic shoulders silhouette', (x, -.035, z - .03 * scale), (.072 * scale, .0018, .090 * scale), 'sepia-photo', r)
text('Photo caption', 'ONE SUMMER OFF', (0, -.043, .089), .026, 'black', parent=r)
support = cube('Photo support leg', (0, .095, .14), (.17, .018, .25), 'oak', .003, r)
support.rotation_euler[0] = .4
save('family-photo')

r = palette('bathroom-basin')
cube('Bathroom pedestal', (0, .08, .37), (.20, .24, .74), 'sink-ceramic', .055, r)
cube('Ceramic basin', (0, 0, .81), (.64, .47, .16), 'sink-ceramic', .060, r)
cube('Basin recess shadow', (0, -.052, .899), (.47, .28, .012), 'home-stain', .08, r)
cube('Basin glazed bottom', (0, -.053, .905), (.39, .21, .013), 'sink-ceramic', .067, r)
cone('Plug hole', (0, -.053, .916), .025, .025, .003, 'home-rubber', r)
tap(r, 0, .14, .90)
cube('Soap bar', (-.24, .10, .918), (.077, .054, .023), 'old-enamel', .007, r)
save('bathroom-basin', [{'x': 0, 'z': 0, 'w': .66, 'd': .50}])

r = palette('bathroom-toilet')
cube('Toilet cistern', (0, .27, .68), (.44, .19, .61), 'sink-ceramic', .045, r)
cube('Cistern lid', (0, .27, 1.002), (.47, .23, .047), 'sink-ceramic', .018, r)
ellipsoid('Toilet bowl', (0, -.12, .38), (.235, .32, .20), 'sink-ceramic', r)
ellipsoid('Toilet pedestal', (0, -.055, .20), (.16, .19, .24), 'sink-ceramic', r)
ellipsoid('Raised toilet seat rim', (0, -.15, .565), (.224, .29, .031), 'old-enamel', r)
ellipsoid('Seat centre opening', (0, -.17, .589), (.151, .205, .008), 'home-stain', r)
cube('Cistern flush lever', (-.16, .155, .84), (.085, .033, .021), 'home-chrome', .006, r)
tube('Supply pipe', [(.19, .27, .4), (.27, .27, .32), (.27, .34, .04)], .014, 'home-chrome', r)
save('bathroom-toilet', [{'x': 0, 'z': 0, 'w': .56, 'd': .83}])

r = palette('bathroom-tub')
cube('Enamel bath body', (0, 0, .33), (.80, 1.75, .57), 'sink-ceramic', .10, r)
cube('Bath interior recess', (0, 0, .634), (.64, 1.52, .018), 'home-stain', .15, r)
cube('Bath interior bottom', (0, 0, .646), (.53, 1.39, .014), 'old-enamel', .14, r)
tap(r, 0, .72, .65)
cone('Bath plug', (0, .49, .659), .032, .032, .005, 'home-rubber', r)
for x in [-.32, .32]:
    for y in [-.61, .61]:
        ellipsoid('Cast iron claw foot', (x, y, .075), (.064, .061, .083), 'home-chrome', r)
cube('Folded bath towel', (.12, -.62, .68), (.38, .35, .031), 'cloth', .019, r)
save('bathroom-tub', [{'x': 0, 'z': 0, 'w': .83, 'd': 1.8}])

r = palette('research-bench')
cube('Laboratory bench top', (0, 0, .92), (2.40, .82, .072), 'home-rubber', .012, r)
for x in [-.78, .78]:
    cube('Bench storage cabinet', (x, 0, .46), (.74, .73, .88), 'clinic-enamel', .010, r)
    for z in [.21, .48, .73]:
        cube('Bench drawer', (x, -.385, z), (.68, .025, .22), 'old-enamel', .006, r)
        cube('Drawer label holder', (x, -.406, z), (.19, .013, .048), 'home-chrome', .003, r)
        cube('Drawer label', (x, -.415, z), (.15, .003, .029), 'paper', .001, r)
cube('Microscope base', (-.38, .08, .99), (.37, .29, .07), 'clinic-enamel', .025, r)
tube('Microscope arm', [(-.38, .20, 1.01), (-.38, .23, 1.32), (-.38, .09, 1.53)], .042, 'clinic-enamel', r)
cube('Microscope stage', (-.38, -.02, 1.20), (.22, .19, .024), 'home-rubber', .005, r)
cone('Microscope objective', (-.38, -.02, 1.31), .037, .021, .16, 'home-chrome', r)
eye = cone('Microscope eyepiece', (-.38, .034, 1.57), .034, .034, .23, 'home-rubber', r)
eye.rotation_euler[0] = -.30
for x, h in [(.18, .24), (.40, .31), (.65, .20)]:
    cone('Specimen jar', (x, .09, .96 + h / 2), .069, .069, h, 'clinic-glass', r)
    cone('Specimen jar lid', (x, .09, .98 + h), .073, .073, .022, 'home-chrome', r)
    cube('Specimen label', (x, .016, 1.06), (.10, .004, .068), 'paper', .001, r)
cube('Research clipboard', (.67, -.15, .972), (.41, .33, .025), 'oak', .003, r)
cube('Research records sheet', (.67, -.15, .990), (.37, .28, .005), 'paper', .001, r)
text('Research heading', 'UNQUALIFIED INTAKE', (.67, -.10, .995), .024, 'black', (0, 0, 0), r)
text('Research footer', 'CONSENT: ASSUMED', (.67, -.20, .995), .024, 'black', (0, 0, 0), r)
save('research-bench', [{'x': 0, 'z': 0, 'w': 2.44, 'd': .86}])

r = palette('starter-pen')
cube('Kennel rubber tray', (0, 0, .015), (1.9, 1.72, .03), 'home-rubber', .035, r)
cube('Kennel back panel', (0, .82, .46), (1.9, .065, .91), 'clinic-enamel', .011, r)
for x in [-.92, .92]:
    cube('Kennel side lower panel', (x, 0, .22), (.055, 1.68, .43), 'clinic-enamel', .008, r)
    for y in [-.78, -.26, .26, .78]:
        cube('Kennel upright', (x, y, .67), (.027, .027, 1.29), 'home-chrome', .003, r)
    for z in [.44, .87, 1.29]:
        cube('Kennel side rail', (x, 0, z), (.028, 1.68, .027), 'home-chrome', .003, r)
cube('Kennel back top rail', (0, .82, 1.29), (1.89, .026, .027), 'home-chrome', .003, r)
for x in [-.60, 0, .60]:
    cube('Kennel back upright', (x, .82, 1.06), (.026, .027, .47), 'home-chrome', .003, r)
cube('Kennel blanket', (.34, .36, .065), (.73, .66, .048), 'cloth', .054, r)
cone('Water bowl', (-.60, .32, .095), .18, .16, .12, 'home-chrome', r)
cone('Bowl water', (-.60, .32, .16), .136, .136, .008, 'clinic-glass', r)
cube('Pen intake plaque', (.71, -.805, .81), (.28, .041, .30), 'paper', .006, r)
text('Pen plaque', 'STARTER', (.71, -.831, .85), .038, 'black', parent=r)
text('Pen warning', 'NOT A TOY', (.71, -.832, .745), .030, 'black', parent=r)
save('starter-pen', [
    {'x': 0, 'z': -.82, 'w': 1.94, 'd': .08},
    {'x': -.92, 'z': 0, 'w': .08, 'd': 1.72},
    {'x': .92, 'z': 0, 'w': .08, 'd': 1.72},
])

r = palette('clinic-entry-sign')
cube('Research fascia', (0, 0, 2.71), (3.8, .16, .48), 'home-green', .012, r)
text('Research sign', 'COUNTY RESEARCH', (0, -.086, 2.74), .21, 'paper', parent=r)
text('Research sign footnote', 'ANIMAL HANDLING / YOUTH PLACEMENTS', (0, -.087, 2.58), .072, 'paper', parent=r)
save('clinic-entry-sign')

r = palette('interior-ceiling-light')
cone('Light ceiling rose', (0, 0, 0), .085, .085, .025, 'ivory', r)
cone('Pendant cable', (0, 0, -.22), .004, .004, .43, 'home-rubber', r, 8)
cone('Pendant enamel shade', (0, 0, -.48), .22, .084, .15, 'old-enamel', r)
ellipsoid('Tungsten bulb', (0, 0, -.56), (.046, .046, .06), 'lamp', r)
# Root scene adds controllable room lights; this reusable asset contains only the fixture.
save('interior-ceiling-light')

(ROOT / 'artifacts/home-clinic-catalog.json').write_text(json.dumps(catalog, indent=2))
print('HOME_CLINIC_ASSETS_COMPLETE', len(catalog), flush=True)
