"""One fixed phone and two child-sized hands, authored and animated in Blender.

Blender X=right, Z=up, -Y=front exports as glTF X=right, Y=up, +Z=front.
The screen rectangle stays fixed while the thumbs flex by less than a millimetre.
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
current = bpy.data.collections.new('held-phone')
bpy.context.scene.collection.children.link(current)
M, objects = {}, []
helpers = {'link', 'empty', 'cube', 'tube', 'plane_mesh', 'material'}
tree = ast.parse((ROOT / 'scripts/author_blender.py').read_text())
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in helpers], type_ignores=[]), 'Blender model helpers', 'exec'))
root = empty('held-phone')
rng = np.random.default_rng(31711)


def texture(name, low, high, roughness, fabric=False):
    size = 512
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    fine = rng.uniform(-1, 1, (size, size))
    patches = (np.sin(xx * .04 + np.cos(yy * .025)) + np.cos(yy * .029 + np.sin(xx * .032))) * .07
    weave = np.sin(xx * math.pi / 2) * np.cos(yy * math.pi / 2) * (.09 if fabric else .012)
    tone = np.clip(.5 + patches + fine * .085 + weave, 0, 1)
    colors = np.array(low) + (np.array(high) - low) * tone[:, :, None]
    image = bpy.data.images.new(name + ' original color', size, size, alpha=False)
    image.pixels.foreach_set(np.concatenate([colors, np.ones((size, size, 1))], axis=2).astype(np.float32).ravel())
    image.pack()
    dx = (np.roll(tone, -1, 1) - np.roll(tone, 1, 1)) * .12
    dy = (np.roll(tone, -1, 0) - np.roll(tone, 1, 0)) * .12
    vectors = np.stack([-dx, -dy, np.ones_like(dx)], axis=2)
    vectors /= np.linalg.norm(vectors, axis=2)[:, :, None]
    normal = bpy.data.images.new(name + ' original normal', size, size, alpha=False)
    normal.colorspace_settings.name = 'Non-Color'
    normal.pixels.foreach_set(np.concatenate([vectors * .5 + .5, np.ones((size, size, 1))], axis=2).astype(np.float32).ravel())
    normal.pack()
    return material(name, high, roughness, texture=(image, normal))


texture('Child hand skin', (.27, .175, .121), (.435, .316, .227), .79)
texture('Navy gray nightwear', (.028, .043, .062), (.084, .109, .142), .96, True)
texture('Worn phone case', (.006, .009, .012), (.031, .038, .044), .65)
material('Phone frame metal', (.075, .087, .094), .38, metal=.74)
material('Phone display glass', (.012, .022, .025), .42)
material('Phone openings', (.002, .003, .004), .88)
material('Faint palm creases', (.225, .140, .093), .84)
material('Short natural nails', (.34, .239, .177), .68)
material('Cuff seam', (.043, .057, .079), .95)


def round_outline(width, height, radius, steps=8):
    result = []
    for cx, cz, start in [(width / 2 - radius, height / 2 - radius, 0), (-width / 2 + radius, height / 2 - radius, 90), (-width / 2 + radius, -height / 2 + radius, 180), (width / 2 - radius, -height / 2 + radius, 270)]:
        for i in range(steps + 1):
            angle = math.radians(start + i * 90 / steps)
            result.append((cx + math.cos(angle) * radius, cz + math.sin(angle) * radius))
    return result


def rounded_phone(name, width, height, thickness, radius, mat, cy=0):
    outline = round_outline(width, height, radius)
    n = len(outline)
    verts = [(x, cy + y, z) for y in [-thickness / 2, thickness / 2] for x, z in outline]
    faces = [tuple(range(n)), tuple(reversed(range(n, n * 2)))]
    faces += [(i, n + i, n + (i + 1) % n, (i + 1) % n) for i in range(n)]
    obj = plane_mesh(name, verts, faces, mat, root)
    for p in obj.data.polygons:
        for li in p.loop_indices:
            co = obj.data.vertices[obj.data.loops[li].vertex_index].co
            obj.data.uv_layers.active.data[li].uv = (co.x / width + .5, co.z / height + .5)
    bevel = obj.modifiers.new('Soft manufactured edges', 'BEVEL'); bevel.width = .0008; bevel.segments = 3
    obj.modifiers.new('Frame normals', 'WEIGHTED_NORMAL')
    return obj


rounded_phone('Worn smartphone body', .074, .157, .009, .009, 'Worn phone case')
rounded_phone('Inset screen metal lip', .0662, .1392, .0003, .0052, 'Phone frame metal', -.0046)
screen_outline = round_outline(.064, .137, .004)
screen = plane_mesh('Fixed display surface', [(x, -.00495, z) for x, z in screen_outline], [tuple(range(len(screen_outline)))], 'Phone display glass', root)
for p in screen.data.polygons:
    for li in p.loop_indices:
        co = screen.data.vertices[screen.data.loops[li].vertex_index].co
        screen.data.uv_layers.active.data[li].uv = ((co.x + .032) / .064, (co.z + .0685) / .137)
cube('Earpiece grille', (0, -.0048, .074), (.012, .0009, .0015), 'Phone openings', .0006, root)
cube('Power button', (.0374, .0002, .019), (.0015, .0038, .020), 'Phone frame metal', .0006, root)
cube('Volume rocker', (-.0374, .0002, .023), (.0015, .0038, .026), 'Phone frame metal', .0006, root)
cube('Charging port', (0, -.0005, -.0783), (.009, .0032, .0006), 'Phone openings', .0005, root)


def sphere(name, pos, radii, mat, parent=root):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, location=pos)
    obj = link(bpy.context.object, name, mat, parent)
    obj.scale = radii
    for p in obj.data.polygons: p.use_smooth = True
    return obj


sphere('Tiny front camera', (-.013, -.0050, .0738), (.0016, .0004, .0016), 'Phone openings')
sphere('Rear camera lens', (-.025, .0049, .060), (.0045, .0008, .0045), 'Phone openings')


def flesh_tube(name, points, radii, mat, parent=root, sides=16, closed=True):
    verts, faces = [], []
    for j, (point, radius) in enumerate(zip(points, radii)):
        point = Vector(point)
        if j == 0: tangent = Vector(points[1]) - point
        elif j == len(points) - 1: tangent = point - Vector(points[j - 1])
        else: tangent = Vector(points[j + 1]) - Vector(points[j - 1])
        tangent.normalize()
        across = tangent.cross(Vector((0, 1, 0))).normalized()
        forward = tangent.cross(across).normalized()
        for i in range(sides):
            angle = i / sides * math.tau
            co = point + across * math.cos(angle) * radius[0] + forward * math.sin(angle) * radius[1]
            verts.append(tuple(co))
    for j in range(len(points) - 1):
        for i in range(sides): faces.append((j * sides + i, j * sides + (i + 1) % sides, (j + 1) * sides + (i + 1) % sides, (j + 1) * sides + i))
    if closed:
        faces += [tuple(reversed(range(sides))), tuple((len(points) - 1) * sides + i for i in range(sides))]
    obj = plane_mesh(name, verts, faces, mat, parent)
    for p in obj.data.polygons:
        p.use_smooth = True
        for li in p.loop_indices:
            vi = obj.data.loops[li].vertex_index
            obj.data.uv_layers.active.data[li].uv = (vi % sides / sides, vi // sides / max(1, len(points) - 1))
    sub = obj.modifiers.new('Soft anatomical transitions', 'SUBSURF'); sub.levels = 1
    return obj


thumbs = []
for side in [-1, 1]:
    # Child palm breadth~43 mm, fingertips~10 mm: smaller than the adult NPCs.
    palm = empty(('Left' if side < 0 else 'Right') + ' child hand', (side * .056, .007, -.084), root)
    flesh_tube('Small child palm', [(side * .007, .012, -.048), (side * .002, .003, -.025), (0, 0, -.008), (-side * .004, .004, .013), (-side * .006, .009, .026)], [(.014, .010), (.019, .011), (.022, .012), (.021, .011), (.014, .009)], 'Child hand skin', palm, 24, closed=False)
    # Four curled fingers lie behind the phone, with knuckles visible at its edge.
    for i in range(4):
        z = -.008 + i * .012
        flesh_tube('Curled finger ' + str(i), [(side * .003, .010, z), (-side * .009, .021, z + .005), (-side * .026, .026, z + .006), (-side * .033, .012, z + .009)], [(.0056, .0054), (.0058, .0055), (.0050, .0048), (.0040, .0040)], 'Child hand skin', palm, 12)
    thumb = empty(('Left' if side < 0 else 'Right') + ' thumb HeldIdle', (-side * .009, -.004, -.004), palm)
    thumbs.append(thumb)
    flesh_tube('Child thumb', [(0, 0, 0), (-side * .004, -.008, .013), (-side * .006, -.012, .025), (-side * .006, -.012, .036)], [(.008, .007), (.0075, .0065), (.0060, .0055), (.0044, .0045)], 'Child hand skin', thumb, 16)
    nail = sphere('Short thumbnail', (-side * .006, -.0166, .030), (.0030, .0003, .0048), 'Short natural nails', thumb)
    # A subtle flex crease, not an oversized dark cartoon outline.
    crease = tube('Thumb flex crease', [(-side * .002, -.0145, .014), (-side * .006, -.015, .015), (-side * .009, -.013, .014)], .00018, 'Faint palm creases', thumb)
    crease.data.resolution_u = 4; crease.data.bevel_resolution = 1
    flesh_tube('Nightwear wrist cuff', [(side * .010, .017, -.060), (side * .010, .017, -.057), (side * .008, .014, -.046), (side * .008, .014, -.043)], [(.018, .013), (.019, .014), (.018, .013), (.017, .012)], 'Navy gray nightwear', palm, 24, closed=False)
    flesh_tube('Nightwear sleeve', [(side * .033, .035, -.145), (side * .026, .030, -.108), (side * .019, .025, -.083), (side * .011, .018, -.055)], [(.027, .022), (.026, .021), (.024, .019), (.020, .015)], 'Navy gray nightwear', palm, 24, closed=False)
    for i in range(9):
        a = math.tau * i / 9
        pts = [(side * .010 + .019 * math.cos(a), .017 + .014 * math.sin(a), -.057), (side * .008 + .018 * math.cos(a), .014 + .013 * math.sin(a), -.045)]
        rib = tube('Ribbed cuff stitching', pts, .00018, 'Cuff seam', palm)
        rib.data.resolution_u = 2; rib.data.bevel_resolution = 0

bpy.context.scene.render.fps = 24
bpy.context.scene.frame_start, bpy.context.scene.frame_end = 1, 145
for frame, flex in [(1, 0), (37, 1), (73, 0), (109, -1), (145, 0)]:
    for i, thumb in enumerate(thumbs):
        thumb.rotation_euler[1] = flex * .012 * (1 if i else -1)
        thumb.keyframe_insert(data_path='rotation_euler', frame=frame)
bpy.context.scene.frame_set(1)

# Consolidate each rigid animation branch by material; keep the display named
# independently so the runtime can identify its four measured local corners.
groups = {}
for obj in list(current.objects):
    if obj.type not in {'MESH', 'CURVE', 'FONT'} or obj == screen: continue
    ancestor = obj.parent
    while ancestor and ancestor != root and not ancestor.animation_data: ancestor = ancestor.parent
    groups.setdefault((ancestor or root, obj.data.materials[0]), []).append(obj)
for (anchor, mat), group in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in group: obj.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    bpy.ops.object.convert(target='MESH')
    if len(group) > 1: bpy.ops.object.join()
    obj = bpy.context.object
    world = obj.matrix_world.copy(); obj.parent = anchor; obj.matrix_world = world
    obj.name = anchor.name + ' / ' + mat.name
bpy.data.orphans_purge(do_recursive=True)
for image in bpy.data.images:
    if image.users and image.has_data: image.pack()
metadata = {
    'model': 'models/held-phone.glb', 'source': 'assets/held-phone.blend',
    'phoneBody': {'width': .074, 'height': .157, 'thickness': .009},
    'screen': {'node': 'Fixed display surface', 'width': .064, 'height': .137, 'radius': .004, 'center': [0, 0, .00495], 'corners': [[-.032, .0685, .00495], [.032, .0685, .00495], [.032, -.0685, .00495], [-.032, -.0685, .00495]], 'coordinateSystem': 'glTF: X right, Y up, +Z toward viewer', 'normalisedBodyBounds': {'left': .0675675676, 'top': .0636942675, 'right': .9324324324, 'bottom': .9363057325}},
    'hands': {'palmBreadthMetres': .044, 'fingerDiameterMetres': .010, 'animation': 'Thumb-only HeldIdle; phone and screen transforms never animate'},
}
root['screen_corners_gltf'] = json.dumps(metadata['screen']['corners'])
root['phone_width_metres'] = .074
root['authoring'] = 'Blender-authored phone, child hands, original packed surface maps and thumb idle'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/held-phone.blend'), compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'game-assets/models/held-phone.glb'), export_format='GLB', export_image_format='WEBP', export_image_quality=90, export_animations=True, export_animation_mode='SCENE', export_frame_range=True, export_apply=True, export_extras=True)
(ART / 'held-phone-catalog-fragment.json').write_text(json.dumps(metadata, indent=2))

# Render after the source export so the standalone asset contains no review rig.
scene = bpy.context.scene
scene.render.engine = 'CYCLES'; scene.cycles.samples = 48; scene.cycles.use_denoising = True
scene.render.resolution_x = 1000; scene.render.resolution_y = 1200; scene.render.resolution_percentage = 100
scene.world.color = (.065, .080, .10)
scene.view_settings.view_transform = 'AgX'
for name, pos, energy, color, size in [('Cool sky', (-.3, -.4, .4), 5, (.72, .83, 1), .4), ('Warm bounce', (.3, -.2, .1), 2, (1, .82, .64), .3), ('Rim', (.1, .25, .3), 6, (.61, .76, 1), .3)]:
    data = bpy.data.lights.new(name, 'AREA'); data.energy = energy; data.color = color; data.size = size
    obj = bpy.data.objects.new(name, data); scene.collection.objects.link(obj); obj.location = pos
    obj.rotation_euler = (Vector((0, 0, -.03)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
data = bpy.data.cameras.new('Review camera'); cam = bpy.data.objects.new('Review camera', data); scene.collection.objects.link(cam); scene.camera = cam
data.type = 'ORTHO'; data.ortho_scale = .32
for name, pos in [('front', (0, -.6, -.045)), ('angled', (.16, -.6, .08))]:
    cam.location = pos; cam.rotation_euler = (Vector((0, 0, -.045)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(ART / ('held-phone-' + name + '.png'))
    bpy.ops.render.render(write_still=True)
print('HELD_PHONE_AUTHORED', json.dumps(metadata))
