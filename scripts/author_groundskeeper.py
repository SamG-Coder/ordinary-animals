"""Author one articulated, rain-worn county Groundskeeper entirely in Blender.

Run: blender -b --factory-startup --python scripts/author_groundskeeper.py
Writes only this character's packed source, GLB and ignored review artifacts.
"""
import ast
import bpy
import json
import math
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'artifacts'
ART.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
M, objects = {}, []
current = bpy.data.collections.new('groundskeeper')
bpy.context.scene.collection.children.link(current)
helpers = {'link', 'empty', 'cube', 'tube', 'text', 'plane_mesh', 'ellipsoid', 'material'}
tree = ast.parse((ROOT / 'scripts/author_blender.py').read_text())
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in helpers], type_ignores=[]), 'Blender modeling helpers', 'exec'))
root = empty('groundskeeper')
rng = np.random.default_rng(31709)


def textured(name, low, high, rough=.8, weave=True, size=512):
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    grain = rng.uniform(-1, 1, (size, size)).astype(np.float32)
    slow = (np.sin(xx * .047 + np.sin(yy * .021)) + np.cos(yy * .057 + np.cos(xx * .039))) / 2
    warp = np.sin(xx * math.pi / 2) * np.cos(yy * math.pi / 2)
    wear = .5 + .14 * slow + .09 * grain + (.10 * warp if weave else 0)
    rgb = np.array(low)[None, None, :] + (np.array(high) - low)[None, None, :] * wear[:, :, None]
    img = bpy.data.images.new(name + ' original color', size, size, alpha=False)
    img.pixels.foreach_set(np.concatenate([rgb, np.ones((size, size, 1))], axis=2).astype(np.float32).ravel())
    img.pack()
    dx = (np.roll(wear, -1, 1) - np.roll(wear, 1, 1)) * .23
    dy = (np.roll(wear, -1, 0) - np.roll(wear, 1, 0)) * .23
    vectors = np.stack([-dx, -dy, np.ones_like(dx)], axis=2)
    vectors /= np.linalg.norm(vectors, axis=2)[:, :, None]
    normal = bpy.data.images.new(name + ' original normal', size, size, alpha=False)
    normal.colorspace_settings.name = 'Non-Color'
    normal.pixels.foreach_set(np.concatenate([vectors * .5 + .5, np.ones((size, size, 1))], axis=2).astype(np.float32).ravel())
    normal.pack()
    mat = material(name, high, rough, texture=(img, normal))
    return mat


textured('Rain dark olive wax', (.028, .038, .025), (.095, .116, .063), .69)
textured('Worn trouser twill', (.055, .052, .042), (.145, .133, .092), .87)
textured('Weathered skin', (.225, .156, .116), (.385, .276, .205), .81, False)
textured('Rubber with dried mud', (.019, .025, .022), (.057, .068, .047), .67, False)
textured('Work glove leather', (.11, .064, .025), (.235, .155, .065), .89, False)
textured('Charcoal ribbed wool', (.017, .021, .020), (.063, .071, .064), .97)
material('Dark seams', (.019, .023, .017), .87)
material('Aged skin crease', (.145, .079, .050), .84)
material('Damp lashes and stubble', (.040, .036, .029), .94)
material('Tired sclera', (.36, .32, .26), .43)
material('Gray green iris', (.034, .050, .044), .31)
material('Pupil', (.004, .006, .005), .20)
material('Dirty off white thread', (.43, .40, .28), .90)
material('Tarnished fittings', (.20, .18, .12), .46, metal=.65)
material('Inspection label paper', (.43, .42, .32), .95)


def loft(name, rings, mat, parent=root, sides=40, crease=.0, closed=True):
    """Elliptical cloth/limb rings: z, x radius, y radius, centre x, centre y."""
    rings = sorted(rings, key=lambda ring: ring[0])
    verts, faces = [], []
    for j, (z, rx, ry, cx, cy) in enumerate(rings):
        for i in range(sides):
            a = i / sides * math.tau
            ripple = 1 + crease * math.sin(a * 9 + j * .77) + crease * .35 * math.sin(a * 17 - j)
            verts.append((cx + rx * math.cos(a) * ripple, cy + ry * math.sin(a) * ripple, z))
    for j in range(len(rings) - 1):
        for i in range(sides):
            ni = (i + 1) % sides
            faces.append((j * sides + i, j * sides + ni, (j + 1) * sides + ni, (j + 1) * sides + i))
    if closed:
        faces += [tuple(reversed(range(sides))), tuple((len(rings) - 1) * sides + i for i in range(sides))]
    obj = plane_mesh(name, verts, faces, mat, parent)
    for polygon in obj.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
        for li in polygon.loop_indices:
            vi = obj.data.loops[li].vertex_index
            obj.data.uv_layers.active.data[li].uv = (vi % sides / sides * 2, vi // sides / (len(rings) - 1) * 3)
    return obj


def seam(name, pts, parent, mat='Dark seams', radius=.0013):
    obj = tube(name, pts, radius, mat, parent)
    obj.data.resolution_u = 3 if len(pts) > 8 else 5
    obj.data.bevel_resolution = 1
    return obj


# Adult proportions: 1.75 m overall, 0.23 m anatomical head and a 0.40 m shoulder span.
# The slight asymmetry is an adult resting his weight on the right boot.
for side in [-1, 1]:
    sx = side * .091
    loft('Creased work trouser leg', [
        (.27, .047, .050, sx, .004), (.35, .052, .055, sx, .004),
        (.43, .058, .061, sx - side * .002, -.001), (.49, .061, .058, sx, -.012),
        (.54, .065, .064, sx + side * .002, -.006), (.64, .077, .080, sx, .002),
        (.76, .084, .087, sx, .003), (.87, .087, .091, sx - side * .012, .004),
        (.96, .074, .085, sx - side * .013, .008),
    ], 'Worn trouser twill', crease=.035)
    # Solid foot and sole with a long squared toe; the shaft follows the calf.
    outline = [(-.048, .074), (.048, .074), (.057, .018), (.055, -.162), (.039, -.194), (-.039, -.194), (-.055, -.162), (-.057, .018)]
    for name, bottom, top, mat, inset in [('Boot tread', .0, .039, 'Dark seams', 1), ('Shaped Wellington foot', .039, .104, 'Rubber with dried mud', .97)]:
        verts = [(sx + x * inset, y, z) for z in [bottom, top] for x, y in outline]
        faces = [tuple(reversed(range(8))), tuple(range(8, 16))] + [(i, (i + 1) % 8, (i + 1) % 8 + 8, i + 8) for i in range(8)]
        shoe = plane_mesh(name, verts, faces, mat, root)
        bevel = shoe.modifiers.new('Rounded rubber edge', 'BEVEL'); bevel.width = .008; bevel.segments = 3
        shoe.modifiers.new('Boot weighted normals', 'WEIGHTED_NORMAL')
    loft('Wellington calf', [(.065, .050, .112, sx, -.028), (.093, .051, .092, sx, -.013), (.12, .051, .067, sx, .005), (.15, .051, .059, sx, .012), (.21, .059, .060, sx, .012), (.32, .064, .067, sx, .015), (.39, .060, .064, sx, .017)], 'Rubber with dried mud', crease=.009)
    loft('Raised boot rim', [(.381, .063, .067, sx, .017), (.400, .064, .069, sx, .017)], 'Dark seams')
    cube('Calf adjustment tab', (sx + side * .061, -.005, .349), (.008, .046, .026), 'Rubber with dried mud', .002, root)
    cube('Boot buckle', (sx + side * .067, -.014, .349), (.004, .021, .018), 'Tarnished fittings', .002, root)
    for z in [.458, .491, .538]:
        seam('Compressed knee cloth', [(sx - .036, -.054, z), (sx, -.069, z + .008), (sx + .032, -.052, z - .003)], root, 'Worn trouser twill', .002)

body = empty('Idle breathing chest', (0, 0, 1.14), root)
loft('Waxed jacket body', [
    (-.315, .170, .100, 0, 0), (-.29, .175, .105, 0, 0), (-.21, .169, .104, 0, 0),
    (-.12, .157, .104, 0, .002), (-.02, .156, .106, 0, .002), (.10, .177, .112, 0, .002),
    (.21, .192, .104, 0, .003), (.265, .192, .091, 0, .009), (.30, .155, .077, 0, .007),
    (.335, .067, .060, 0, .005),
], 'Rain dark olive wax', body, sides=56, crease=.013)
loft('Corduroy collar', [(.303, .079, .070, 0, .004), (.35, .067, .063, 0, .006)], 'Charcoal ribbed wool', body)
loft('Neck', [(.32, .042, .046, 0, .012), (.398, .040, .045, 0, .011)], 'Weathered skin', body)
cube('Jacket covered zip', (0, -.112, .02), (.023, .012, .57), 'Rain dark olive wax', .003, body)
for z in [-.22, -.09, .06, .20]:
    ellipsoid('Dull jacket popper', (0, -.122, z), (.0045, .002, .0045), 'Tarnished fittings', body)
for side in [-1, 1]:
    pocket = cube('Bellowed jacket pocket', (side * .100, -.104, -.186), (.112, .025, .112), 'Rain dark olive wax', .008, body)
    cube('Sloped pocket flap', (side * .100, -.123, -.119), (.118, .018, .029), 'Rain dark olive wax', .005, body)
    seam('Pocket topstitch', [(side * .049, -.134, -.126), (side * .149, -.125, -.126)], body, 'Dark seams', .0008)
    seam('Raglan shoulder seam', [(side * .055, -.058, .315), (side * .150, -.093, .259), (side * .186, -.072, .188)], body)
    seam('Worn jacket hem', [(side * .012, -.108, -.301), (side * .11, -.081, -.303), (side * .16, -.04, -.300)], body, 'Rain dark olive wax', .002)
cube('County stitched patch', (-.090, -.114, .190), (.104, .003, .042), 'Dark seams', .002, body)
text('County uniform lettering', 'COUNTY', (-.09, -.117, .194), .013, 'Dirty off white thread', parent=body)
text('Grounds uniform lettering', 'GROUNDS', (-.09, -.117, .178), .010, 'Dirty off white thread', parent=body)

# One natural articulated arm hangs with the keyring; the other turns a field card.
arms, forearms = [], []
for side in [-1, 1]:
    shoulder = empty(('Left' if side < 0 else 'Right') + ' shoulder idle', (side * .189, .006, .268), body)
    shoulder.rotation_euler[1] = side * -.065
    arms.append(shoulder)
    loft('Waxed upper sleeve', [(.064, .007, .008, -side * .016, 0), (.055, .034, .042, -side * .014, 0), (.032, .059, .064, -side * .006, 0), (0, .070, .075, 0, 0), (-.06, .071, .073, side * .007, 0), (-.16, .062, .066, side * .016, -.002), (-.24, .055, .061, side * .022, -.006), (-.278, .052, .059, side * .024, -.008), (-.300, .049, .056, side * .025, -.009)], 'Rain dark olive wax', shoulder, crease=.014)
    elbow = empty(('Left' if side < 0 else 'Right') + ' forearm idle', (side * .025, -.009, -.276), shoulder)
    elbow.rotation_euler[0] = -.12 if side < 0 else -.27
    forearms.append(elbow)
    loft('Waxed forearm sleeve', [(.016, .038, .041, 0, 0), (0, .051, .057, 0, 0), (-.035, .053, .058, side * .002, -.001), (-.07, .051, .056, side * .004, -.001), (-.12, .047, .053, side * .005, -.003), (-.15, .043, .049, side * .005, -.005), (-.20, .039, .042, side * .005, -.007), (-.23, .036, .038, side * .005, -.009), (-.25, .035, .035, side * .005, -.012)], 'Rain dark olive wax', elbow, crease=.016)
    loft('Wool wrist cuff', [(-.245, .034, .034, side * .005, -.012), (-.275, .031, .030, side * .005, -.012)], 'Charcoal ribbed wool', elbow)
    hand = empty(('Left' if side < 0 else 'Right') + ' gloved hand', (side * .005, -.012, -.277), elbow)
    loft('Anatomical glove palm', [(0, .029, .023, 0, 0), (-.020, .035, .024, 0, -.002), (-.053, .035, .022, 0, -.004), (-.070, .029, .019, 0, -.003)], 'Work glove leather', hand, sides=28)
    for i, length in enumerate([.058, .069, .065, .049]):
        x = (i - 1.5) * .016
        loft('Curved gloved finger', [(-.056, .0080, .0080, x, -.002), (-.078, .0079, .0085, x, -.005), (-.060 - length * .58, .0071, .0076, x, -.014), (-.060 - length, .0060, .0065, x, -.029)], 'Work glove leather', hand, sides=12)
        seam('Glove finger seam', [(x, -.012, -.06), (x, -.015, -.087), (x, -.023, -.109)], hand, 'Work glove leather', .00065)
    thumb = loft('Opposed gloved thumb', [(-.025, .011, .010, -side * .033, -.003), (-.047, .010, .010, -side * .046, -.016), (-.077, .008, .008, -side * .043, -.039)], 'Work glove leather', hand, sides=16)
    seam('Glove back stitch', [(-.018, .024, -.015), (-.016, .021, -.051)], hand, 'Dark seams', .00065)
    seam('Elbow compressed fold', [(-.035, -.042, -.018), (0, -.061, -.008), (.035, -.042, -.014)], elbow, 'Rain dark olive wax', .003)

# Continuous head surface with a jaw, cheek planes, eye sockets and integrated nose.
head = empty('Head watchful idle', (0, .009, .449), body)
profile = [(-.088, .014, .028, .023), (-.075, .039, .058, .047), (-.054, .055, .063, .061), (-.043, .060, .064, .067), (-.036, .062, .066, .069), (-.030, .064, .067, .071), (-.024, .067, .067, .074), (-.010, .074, .070, .078), (.010, .076, .070, .081), (.028, .074, .066, .083), (.047, .071, .064, .083), (.066, .071, .062, .082), (.088, .069, .061, .077), (.111, .061, .052, .065), (.129, .040, .036, .044), (.137, .003, .003, .004)]
verts, faces = [], []
for row, (z, width, front, back) in enumerate(profile):
    for i in range(72):
        a = i / 72 * math.tau
        x = math.cos(a) * width
        sy = math.sin(a)
        y = sy * (front if sy < 0 else back)
        frontal = max(0, -sy) ** 10
        bridge = .021 * math.exp(-((z - .031) / .035) ** 2)
        tip = .025 * math.exp(-((z + .002) / .017) ** 2)
        y -= frontal * (bridge + tip) * math.exp(-(x / .012) ** 2)
        y -= frontal * .008 * math.exp(-((abs(x) - .012) / .006) ** 2 - ((z + .013) / .007) ** 2)
        y += frontal * .008 * math.exp(-((abs(x) - .030) / .017) ** 2 - ((z - .044) / .016) ** 2)
        y -= frontal * .005 * math.exp(-((abs(x) - .030) / .024) ** 2 - ((z - .064) / .010) ** 2)
        y -= frontal * .009 * math.exp(-((abs(x) - .043) / .020) ** 2 - ((z + .006) / .025) ** 2)
        y -= frontal * .006 * math.exp(-((z + .031) / .008) ** 2 - (x / .025) ** 4)
        verts.append((x, y, z))
for j in range(len(profile) - 1):
    for i in range(72):
        faces.append((j * 72 + i, j * 72 + (i + 1) % 72, (j + 1) * 72 + (i + 1) % 72, (j + 1) * 72 + i))
face = plane_mesh('Anatomical head surface', verts, faces, 'Weathered skin', head)
for polygon in face.data.polygons:
    for li in polygon.loop_indices:
        vi = face.data.loops[li].vertex_index
        face.data.uv_layers.active.data[li].uv = (vi % 72 / 72, vi // 72 / (len(profile) - 1))
sub = face.modifiers.new('Smooth facial planes', 'SUBSURF'); sub.levels = 1
for p in face.data.polygons: p.use_smooth = True
for side in [-1, 1]:
    ellipsoid('Small ear pinna', (side * .073, .001, .012), (.012, .017, .027), 'Weathered skin', head)
    seam('Ear concha', [(side * .080, -.009, .026), (side * .084, -.013, .012), (side * .077, -.011, -.004)], head, 'Aged skin crease', .0012)
    ex, ey, ez = side * .030, -.0563, .044
    ellipsoid('Recessed eye', (ex, ey, ez), (.0109, .0051, .0034), 'Tired sclera', head)
    ellipsoid('Small iris', (ex, ey - .0050, ez), (.0031, .0008, .0031), 'Gray green iris', head)
    ellipsoid('Pupil', (ex, ey - .0057, ez), (.00125, .00045, .0017), 'Pupil', head)
    seam('Upper eyelid', [(ex - .011, ey - .0010, ez), (ex - .005, ey - .0053, ez + .0041), (ex + .004, ey - .0055, ez + .0043), (ex + .011, ey - .0010, ez)], head, 'Weathered skin', .0011)
    seam('Lower eyelid', [(ex - .011, ey - .0010, ez), (ex, ey - .005, ez - .0037), (ex + .011, ey - .0010, ez)], head, 'Weathered skin', .0008)
    seam('Natural brow', [(ex - .014, -.057, .061), (ex, -.062, .064), (ex + .013, -.054, .061)], head, 'Damp lashes and stubble', .0011)
    seam('Weathered eye crease', [(ex - .010, -.060, .034), (ex + .004, -.059, .033), (ex + .012, -.055, .034)], head, 'Aged skin crease', .00028)
    seam('Mouth corner fold', [(side * .020, -.068, -.031), (side * .024, -.063, -.036)], head, 'Aged skin crease', .00026)
seam('Closed mouth', [(-.021, -.068, -.030), (-.008, -.074, -.029), (0, -.075, -.030), (.008, -.074, -.029), (.021, -.068, -.030)], head, 'Aged skin crease', .00043)
for z in [.083, .095]:
    seam('Forehead weather line', [(-.034, -.054, z), (0, -.062, z + .003), (.034, -.054, z)], head, 'Aged skin crease', .00032)
# A close-fitting ribbed cap follows an adult cranium rather than enlarging it.
loft('Wool watch cap', [(.091, .075, .080, 0, .007), (.110, .073, .079, 0, .008), (.133, .059, .067, 0, .009), (.154, .031, .039, 0, .008), (.161, .003, .004, 0, .008)], 'Charcoal ribbed wool', head, sides=56, crease=.010)
loft('Turned beanie cuff', [(.078, .075, .080, 0, .007), (.101, .077, .082, 0, .007)], 'Charcoal ribbed wool', head, sides=56, crease=.012)
for i in range(42):
    a = i / 42 * math.tau
    seam('Knitted cap rib', [(.075 * math.cos(a), .007 + .080 * math.sin(a), .080), (.076 * math.cos(a), .007 + .081 * math.sin(a), .103)], head, 'Charcoal ribbed wool', .0007)

# County field card and a proper, small set of maintenance keys.
card = empty('Field inspection card', (.008, -.075, -.282), forearms[1])
card.rotation_euler[1] = -.12
cube('Battered card backing', (0, 0, 0), (.110, .012, .160), 'Dark seams', .003, card)
cube('County instruction card', (0, -.007, 0), (.101, .0015, .150), 'Inspection label paper', .001, card)
for body_text, z, size in [('VOLUNTEERS', .054, .012), ('AGE 10+', .028, .016), ('OWN RISK', -.018, .014), ('COUNTY GROUNDS', -.052, .007)]:
    text('Field card ' + body_text, body_text, (0, -.009, z), size, 'Dark seams', parent=card)
keyring = empty('Maintenance keyring idle', (-.010, -.038, -.370), forearms[0])
ring = [(math.cos(i / 24 * math.tau) * .019, 0, math.sin(i / 24 * math.tau) * .019) for i in range(25)]
seam('Key ring', ring, keyring, 'Tarnished fittings', .002)
for i in range(3):
    x = (i - 1) * .012
    seam('Key bow', [(x + math.cos(j / 16 * math.tau) * .008, -.003 * i, -.022 + math.sin(j / 16 * math.tau) * .009) for j in range(17)], keyring, 'Tarnished fittings', .002)
    cube('Key shaft', (x, -.003 * i, -.052), (.004, .004, .046), 'Tarnished fittings', .0006, keyring)
    for j in range(3): cube('Key teeth', (x + .004, -.003 * i, -.072 + j * .007), (.012 - j * .002, .004, .004), 'Tarnished fittings', .0005, keyring)

scene = bpy.context.scene
scene.render.fps = 24
scene.frame_start, scene.frame_end = 1, 121
for frame, breathe in [(1, 0), (31, 1), (61, 0), (91, -1), (121, 0)]:
    body.location.z = 1.14 + .0025 * breathe
    body.rotation_euler[1] = .006 * breathe
    body.keyframe_insert(data_path='location', frame=frame)
    body.keyframe_insert(data_path='rotation_euler', frame=frame)
    head.rotation_euler = (.012 + .009 * breathe, -.018 * breathe, .026 + .022 * breathe)
    head.keyframe_insert(data_path='rotation_euler', frame=frame)
    for i, arm in enumerate(arms):
        arm.rotation_euler[0] = .006 * breathe * (1 if i else -1)
        arm.keyframe_insert(data_path='rotation_euler', frame=frame)
    for i, elbow in enumerate(forearms):
        elbow.rotation_euler[0] = (-.12 if i == 0 else -.27) + .025 * breathe
        elbow.keyframe_insert(data_path='rotation_euler', frame=frame)
    keyring.rotation_euler[1] = .07 * breathe
    keyring.rotation_euler[2] = .025 * breathe
    keyring.keyframe_insert(data_path='rotation_euler', frame=frame)
scene.frame_set(1)


def consolidate():
    # These groups share one rigid animation ancestor. Apply all authored
    # modifiers before joining, and explicitly export that evaluated result.
    groups = {}
    for obj in list(current.objects):
        if obj.type not in {'MESH', 'CURVE', 'FONT'} or obj.animation_data:
            continue
        if obj.type == 'FONT': obj.data.resolution_u = 3
        if obj.name.startswith(('Waxed upper sleeve', 'Waxed forearm sleeve', 'Waxed jacket body', 'Creased work trouser leg')):
            sub = obj.modifiers.new('Soft cloth transitions', 'SUBSURF'); sub.levels = 1
        parent = obj.parent
        while parent and parent != root and not parent.animation_data:
            parent = parent.parent
        anchor = parent or root
        if len(obj.data.materials) != 1: continue
        groups.setdefault((anchor, obj.data.materials[0]), []).append(obj)
    for (anchor, mat), group in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in group: obj.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        bpy.ops.object.convert(target='MESH')
        if len(group) > 1: bpy.ops.object.join()
        obj = bpy.context.object
        transform = obj.matrix_world.copy()
        obj.parent = anchor
        obj.matrix_world = transform
        obj.name = anchor.name + ' / ' + mat.name


consolidate()
bpy.data.orphans_purge(do_recursive=True)
for image in bpy.data.images:
    if image.users and image.has_data: image.pack()
source_path = ROOT / 'assets/groundskeeper.blend'
model_path = ROOT / 'game-assets/models/groundskeeper.glb'
root['authoring'] = 'Original Blender character with articulated idle and packed original cloth/skin surface maps'
root['height_metres'] = 1.75
root['role'] = 'Briarfield county groundskeeper'
bpy.ops.wm.save_as_mainfile(filepath=str(source_path), compress=True)
bpy.ops.export_scene.gltf(filepath=str(model_path), export_format='GLB', export_image_format='WEBP', export_image_quality=90, export_animations=True, export_animation_mode='SCENE', export_frame_range=True, export_apply=True, export_extras=True)

# Render review belongs to ignored artifacts; no lights or ground are saved in the asset.
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.world.color = (.065, .075, .085)
scene.view_settings.view_transform = 'AgX'
scene.render.resolution_x = 1000
scene.render.resolution_y = 1200
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
def area(name, position, energy, color, size):
    data = bpy.data.lights.new(name, 'AREA'); data.energy = energy; data.color = color; data.shape = 'DISK'; data.size = size
    obj = bpy.data.objects.new(name, data); scene.collection.objects.link(obj); obj.location = position
    obj.rotation_euler = (Vector((0, 0, .95)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
area('Cold sky review key', (-2, -3, 4), 210, (.72, .83, 1), 3)
area('Warm county lamp review', (2, -1, 2.8), 120, (1, .78, .50), 2)
area('Rain rim review', (0, 2, 3), 270, (.51, .70, 1), 2)
camdata = bpy.data.cameras.new('Review camera'); cam = bpy.data.objects.new('Review camera', camdata); scene.collection.objects.link(cam); scene.camera = cam
camdata.lens = 70
for name, pos, target in [('full', (2.2, -4.3, 1.68), (0, 0, .89)), ('face', (.38, -1.22, 1.67), (0, -.005, 1.61)), ('child-view', (0, -2.6, 1.25), (0, 0, 1.42))]:
    cam.location = pos
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(ART / ('groundskeeper-' + name + '.png'))
    bpy.ops.render.render(write_still=True)
print('GROUNDSKEEPER_AUTHORED', json.dumps({'model': 'models/groundskeeper.glb', 'source': 'assets/groundskeeper.blend', 'mesh_objects': sum(o.type == 'MESH' for o in current.objects), 'animated_objects': [o.name for o in current.objects if o.animation_data], 'packed_images': sum(bool(i.packed_file) for i in bpy.data.images if i.users)}))
