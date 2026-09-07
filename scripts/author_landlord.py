"""Author the separate landlord NPC in Blender, preserving Gary's idle hierarchy.

Run: blender -b --python scripts/author_landlord.py
Only the landlord source and GLB are written. Catalog integration is separate.
"""
import ast
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector, noise

ROOT = Path(__file__).resolve().parents[1]
helpers = {"link", "empty", "cube", "cone", "tube", "text", "plane_mesh", "ellipsoid", "material"}
source = ast.parse((ROOT / "scripts/author_blender.py").read_text())
exec(compile(ast.Module(body=[n for n in source.body if isinstance(n, ast.FunctionDef) and n.name in helpers], type_ignores=[]), "Blender geometry helpers only", "exec"))

bpy.ops.wm.open_mainfile(filepath=str(ROOT / "assets/gary.blend"))
current = bpy.data.collections["gary"]
objects = list(current.objects)
M = {m.name: m for m in bpy.data.materials}
root = bpy.data.objects["gary"]
head = next(o for o in current.objects if o.type == "EMPTY" and o.name.split(".")[0] == "head")
inherited_animation = [o.name for o in current.objects if o.animation_data and o.animation_data.action]

for obj in list(current.objects):
    if obj.name.startswith(("Long lab coat", "Tailored coat", "Coat lapel", "Pocket", "Button", "Glasses", "ID card", "Researcher ID", "Shirt")):
        bpy.data.objects.remove(obj, do_unlink=True)


def woven_material(name, low, high, size=256):
    """Original woven wool color and tangent-normal images generated in Blender."""
    heights, colors = [], []
    for y in range(size):
        for x in range(size):
            u, v = x / size, y / size
            fleck = noise.noise(Vector((u * 85, v * 85, 2.4)))
            weave = math.sin(x * math.pi / 2) * math.cos(y * math.pi / 2)
            chevron = math.sin((x + (y if (x // 32) % 2 else -y)) * math.pi / 8)
            h = .5 + .11 * fleck + .12 * weave + .035 * chevron
            heights.append(h)
            colors.extend([low[i] + (high[i] - low[i]) * h for i in range(3)] + [1])
    image = bpy.data.images.new(name + " color", size, size, alpha=False)
    image.pixels.foreach_set(colors)
    image.pack()
    normal = bpy.data.images.new(name + " normal", size, size, alpha=False)
    normal.colorspace_settings.name = "Non-Color"
    pixels = []
    for y in range(size):
        for x in range(size):
            dx = heights[y * size + (x + 1) % size] - heights[y * size + (x - 1) % size]
            dy = heights[((y + 1) % size) * size + x] - heights[((y - 1) % size) * size + x]
            n = Vector((-dx * .45, -dy * .45, 1)).normalized()
            pixels.extend([n.x * .5 + .5, n.y * .5 + .5, n.z * .5 + .5, 1])
    normal.pixels.foreach_set(pixels)
    normal.pack()
    return material(name, high, .87, texture=(image, normal))


woven_material("Landlord brown tweed", (.070, .038, .020), (.205, .129, .071))
woven_material("Landlord charcoal waistcoat", (.035, .038, .037), (.094, .087, .071))
material("Landlord burgundy silk", (.16, .017, .025), .57)
material("Landlord ivory shirt", (.42, .40, .32), .83)
material("Landlord worn leather", (.048, .022, .010), .61)
material("Landlord tarnished brass", (.31, .20, .069), .43, metal=.72)
material("Landlord iron keys", (.17, .18, .17), .48, metal=.78)
material("Landlord gray hair", (.12, .115, .095), .88)
material("Landlord skin", (.34, .25, .19), .8)
material("Landlord skin crease", (.225, .158, .115), .9)
material("Landlord inspection paper", (.54, .51, .41), .95)

for obj in current.objects:
    if obj.name.startswith("Sleeve"):
        obj.data.materials.clear()
        obj.data.materials.append(M["Landlord brown tweed"])
    elif obj.name.startswith("Trouser"):
        obj.data.materials.clear()
        obj.data.materials.append(M["Landlord charcoal waistcoat"])
    elif obj.name.startswith("Boot"):
        obj.data.materials.clear()
        obj.data.materials.append(M["Landlord worn leather"])
    elif obj.name.startswith(("Face", "Nose", "Ear", "Hand", "Finger", "Neck")):
        obj.data.materials.clear()
        obj.data.materials.append(M["Landlord skin"])
    elif obj.name.startswith("Pupil"):
        obj.scale *= .8
    elif obj.name.startswith("Eye") and not obj.name.startswith("Eyebrow"):
        obj.scale.z *= .8
    elif obj.name.startswith("Cheek crease"):
        obj.data.materials.clear()
        obj.data.materials.append(M["Landlord skin crease"])


def coat_surface():
    verts, faces = [], []
    for row in range(25):
        t = row / 24
        z = .63 + t * .83
        radius = .29 - .038 * math.sin(t * math.pi)
        opening = .24 + .48 * t
        for col in range(49):
            angle = -math.pi / 2 + opening + col / 48 * (math.tau - opening * 2)
            r = radius + .005 * math.sin(angle * 17 + t * 3) * (1 - t) + .002 * math.sin(angle * 29)
            verts.append((r * math.cos(angle), r * math.sin(angle) * .69, z))
    for row in range(24):
        for col in range(48):
            a = row * 49 + col
            faces.append((a, a + 1, a + 50, a + 49))
    coat = plane_mesh("Open brown overcoat", verts, faces, "Landlord brown tweed", root)
    for polygon in coat.data.polygons:
        polygon.use_smooth = True
        for li in polygon.loop_indices:
            vi = coat.data.loops[li].vertex_index
            coat.data.uv_layers.active.data[li].uv = (vi % 49 / 48 * 3, vi // 49 / 24 * 3)
    solid = coat.modifiers.new("Tailored wool thickness", "SOLIDIFY")
    solid.thickness = .007
    return coat


coat_surface()
# Layer the waistcoat beneath the opened coat; each panel is a modeled cloth part.
ellipsoid("Ivory shirt chest", (0, -.013, 1.275), (.212, .153, .195), "Landlord ivory shirt", root)
for side in [-1, 1]:
    panel = plane_mesh("Waistcoat front", [(0, -.184, 1.08), (side * .145, -.151, 1.04), (side * .165, -.143, 1.38), (side * .045, -.181, 1.43), (0, -.188, 1.28)], [(0, 1, 2, 3, 4)], "Landlord charcoal waistcoat", root)
    panel.modifiers.new("Waistcoat cloth", "SOLIDIFY").thickness = .006
    lapel = plane_mesh("Notched overcoat lapel", [(side * .077, -.205, 1.08), (side * .194, -.165, 1.38), (side * .167, -.160, 1.45), (side * .105, -.177, 1.37), (side * .075, -.185, 1.34)], [(0, 1, 2, 3, 4)], "Landlord brown tweed", root)
    lapel.modifiers.new("Folded lapel thickness", "SOLIDIFY").thickness = .009
    collar = plane_mesh("Shirt collar", [(side * .01, -.180, 1.44), (side * .07, -.173, 1.46), (side * .075, -.202, 1.385), (side * .027, -.211, 1.402)], [(0, 1, 2, 3)], "Landlord ivory shirt", root)
    collar.modifiers.new("Collar thickness", "SOLIDIFY").thickness = .004
    pocket = cube("Overcoat welt pocket", (side * .19, -.146, .985), (.11, .016, .028), "Landlord brown tweed", .003, root)
    pocket.rotation_euler[1] = -side * .13
    tube("Pocket stitching", [(side * .132, -.158, .982), (side * .238, -.135, .982)], .0011, "Landlord charcoal waistcoat", root)

for z in [1.115, 1.178, 1.24]:
    ellipsoid("Waistcoat brass button", (0, -.197, z), (.008, .005, .008), "Landlord tarnished brass", root)
tie = plane_mesh("Burgundy tie blade", [(-.018, -.207, 1.401), (.018, -.207, 1.401), (.031, -.206, 1.245), (0, -.215, 1.212), (-.031, -.206, 1.245)], [(0, 1, 2, 3, 4)], "Landlord burgundy silk", root)
tie.modifiers.new("Silk thickness", "SOLIDIFY").thickness = .004
knot = plane_mesh("Tie knot", [(-.022, -.205, 1.435), (.022, -.205, 1.435), (.014, -.218, 1.401), (-.014, -.218, 1.401)], [(0, 1, 2, 3)], "Landlord burgundy silk", root)
knot.modifiers.new("Folded silk knot", "SOLIDIFY").thickness = .012
tube("Waistcoat watch chain", [(.018, -.197, 1.13), (.061, -.190, 1.085), (.117, -.172, 1.105)], .0024, "Landlord tarnished brass", root)

# Facial detailing changes the silhouette and age without replacing the idle head.
for side in [-1, 1]:
    ellipsoid("Gray temple", (side * .112, .008, .030), (.016, .055, .078), "Landlord gray hair", head)
    tube("Lower eyelid", [(side * .024, -.124, .017), (side * .043, -.128, .012), (side * .064, -.118, .015)], .002, "Landlord skin", head)
    tube("Under eye fold", [(side * .024, -.122, .007), (side * .046, -.125, .002), (side * .071, -.110, .007)], .0013, "Landlord skin crease", head)
    tube("Frown fold", [(side * .03, -.107, .06), (side * .037, -.109, .088)], .0012, "Landlord skin crease", head)
    tube("Jaw crease", [(side * .027, -.122, -.033), (side * .047, -.113, -.074), (side * .050, -.100, -.09)], .0012, "Landlord skin crease", head)

# Clipboard hangs from the original moving hand, and the heavy keyring follows the other.
arm_right = bpy.data.objects["arm1"]
clipboard = empty("Inspection clipboard", (.12, -.046, -.673), arm_right)
clipboard.rotation_euler[1] = -.13
cube("Leather clipboard", (0, 0, 0), (.232, .022, .316), "Landlord worn leather", .012, clipboard)
cube("Inspection form", (0, -.014, -.006), (.205, .002, .274), "Landlord inspection paper", .002, clipboard)
cube("Clipboard metal clip", (0, -.026, .132), (.077, .014, .028), "Landlord iron keys", .004, clipboard)
text("Inspection title", "PROPERTY", (0, -.019, .101), .020, "black", parent=clipboard)
text("Inspection subtitle", "INSPECTION", (0, -.019, .077), .017, "black", parent=clipboard)
text("Inspection age field", "TENANT AGE: 10", (0, -.019, .037), .011, "black", parent=clipboard)
for row in range(5):
    cube("Inspection rule", (.019, -.018, .005 - row * .025), (.12, .001, .001), "black", 0, clipboard)
    box = plane_mesh("Inspection checkbox", [(-.078, -.018, .011 - row * .025), (-.066, -.018, .011 - row * .025), (-.066, -.018, -.001 - row * .025), (-.078, -.018, -.001 - row * .025)], [(0, 1, 2, 3)], "Landlord iron keys", clipboard)
text("Inspection footer", "DEPOSIT RETAINED", (0, -.019, -.118), .011, "Landlord burgundy silk", parent=clipboard)

arm_left = bpy.data.objects["arm-1"]
keys = empty("Heavy landlord keyring", (-.054, -.028, -.566), arm_left)
ring_points = [(.040 * math.cos(i * math.tau / 24), 0, .040 * math.sin(i * math.tau / 24)) for i in range(25)]
tube("Brass keyring", ring_points, .0038, "Landlord tarnished brass", keys)
for i in range(4):
    x = (i - 1.5) * .021
    key = empty("Property key", (x, -.008 - i * .004, -.032), keys)
    key.rotation_euler[1] = (i - 1.5) * .15
    key_mat = "Landlord tarnished brass" if i % 2 else "Landlord iron keys"
    tube("Key bow", [(.010 * math.cos(j * math.tau / 16), 0, .013 * math.sin(j * math.tau / 16)) for j in range(17)], .0028, key_mat, key)
    length = .065 + i * .012
    cube("Key shaft", (0, 0, -length / 2), (.005, .006, length), key_mat, .001, key)
    for tooth in range(3):
        cube("Key cut", (.006, 0, -length + .005 + tooth * .009), (.014 - tooth * .002, .006, .005), key_mat, .0007, key)
for frame, sway in [(1, -.065), (40, .065), (79, -.065)]:
    keys.rotation_euler[1] = sway
    keys.keyframe_insert(data_path="rotation_euler", frame=frame)

root.name = "landlord"
current.name = "landlord"
bpy.context.scene.frame_set(1)
bpy.context.scene.frame_end = 79
bpy.data.orphans_purge(do_recursive=True)
for image in bpy.data.images:
    if image.users and image.has_data:
        image.pack()
assert all(bpy.data.objects[name].animation_data.action for name in inherited_animation), "Inherited animation missing"
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "assets/landlord.blend"), compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT / "game-assets/models/landlord.glb"), export_format="GLB", export_image_format="WEBP", export_image_quality=86, export_animations=True, export_animation_mode="SCENE", export_frame_range=False, export_lights=True, export_extras=True)
print("LANDLORD_COMPLETE", json.dumps({"model": "models/landlord.glb", "source": "assets/landlord.blend", "objects": len(current.objects), "mesh_objects": sum(o.type == "MESH" for o in current.objects), "animated_objects": [o.name for o in current.objects if o.animation_data and o.animation_data.action], "packed_images": sum(bool(i.packed_file) for i in bpy.data.images if i.users)}))
