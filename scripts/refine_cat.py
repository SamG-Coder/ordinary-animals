"""Refine the existing cat and repair its source-authored Faint floor contact.

Run: Blender -b --factory-startup --python-exit-code 1 --python scripts/refine_cat.py
The seven-bone rig and four original clips are preserved. Faint keeps its roll
and gains corrected body height plus a small Blender-authored whisker flex.
The anatomical surface is reshaped, tiny muzzle/toe forms are welded, and an
original short-fur tabby atlas is painted from physical surface coordinates.
All textures are packed. Only cat.blend/cat.glb are published by this script.
An already-refined source is left alone; --rebuild uses the local audit backup.
"""
import bpy
import hashlib
import json
import math
import shutil
import sys
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts'
OUT.mkdir(exist_ok=True)
SOURCE = ROOT / 'assets/cat.blend'
MODEL = ROOT / 'game-assets/models/cat.glb'
BACKUP = OUT / 'cat-before-refinement.blend'
VERSION = 1


def fingerprint(rig):
    actions = []
    for action in sorted(bpy.data.actions, key=lambda a: a.name):
        curves = []
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        curves.append([curve.data_path, curve.array_index,
                            [[list(k.co), list(k.handle_left), list(k.handle_right), k.interpolation,
                              k.handle_left_type, k.handle_right_type] for k in curve.keyframe_points]])
        actions.append([action.name, list(action.frame_range), curves])
    data = dict(bones=[[b.name, b.parent.name if b.parent else None, [list(row) for row in b.matrix_local]]
                      for b in rig.data.bones],
                rigMatrix=[list(row) for row in rig.matrix_world], actions=actions,
                tracks=[[t.name, [[s.name, s.action.name, s.frame_start, s.frame_end,
                                    s.action_frame_start, s.action_frame_end, s.scale, s.repeat]
                                   for s in t.strips]] for t in rig.animation_data.nla_tracks])
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest(), data


def bounds(objects):
    points = []
    graph = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        if obj.type not in {'MESH', 'CURVE'}:
            continue
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        points.extend(evaluated.matrix_world @ vertex.co for vertex in mesh.vertices)
        evaluated.to_mesh_clear()
    return [list(map(min, zip(*points))), list(map(max, zip(*points)))]


def smooth(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)


def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def material(name, rgb, roughness):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = roughness
    return mat


def ellipse(name, center, scales, group=None, mat=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scales
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for face in obj.data.polygons:
        face.use_smooth = True
    if group:
        obj.vertex_groups.new(name=group).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    if mat:
        obj.data.materials.append(mat)
    return obj


def curve(name, points, radius, mat):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 12
    data.bevel_depth = radius
    data.bevel_resolution = 1
    data.use_fill_caps = True
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for i, (point, co) in enumerate(zip(spline.bezier_points, points)):
        point.co = co
        point.handle_left_type = point.handle_right_type = 'AUTO'
        point.radius = 1 - .74*i/max(len(points)-1, 1)
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    data.materials.append(mat)
    return obj


def head_parent(obj, rig):
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = 'BONE'
    obj.parent_bone = 'head'
    bpy.context.view_layer.update()
    obj.matrix_world = world


def packed_image(name, rgba, color=True):
    h, w = rgba.shape[:2]
    image = bpy.data.images.new(name, width=w, height=h, alpha=True)
    if not color:
        image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(np.asarray(rgba, dtype=np.float32).ravel())
    image.pack()
    return image


def noise_xyz(x, y, z):
    """Deterministic trilinear value noise; no repeated stripe-like sine grain."""
    ix, iy, iz = np.floor(x), np.floor(y), np.floor(z)
    fx, fy, fz = x-ix, y-iy, z-iz
    fx, fy, fz = fx*fx*(3-2*fx), fy*fy*(3-2*fy), fz*fz*(3-2*fz)
    result = np.zeros_like(x)
    for a in [0, 1]:
        for b in [0, 1]:
            for c in [0, 1]:
                h = np.sin((ix+a)*127.1+(iy+b)*311.7+(iz+c)*74.7)*43758.5453
                result += (h-np.floor(h))*(fx if a else 1-fx)*(fy if b else 1-fy)*(fz if c else 1-fz)
    return result


def coat_fields(position):
    x, y, z = position.T
    # Mackerel tabby: dark spine, broken side bars, leg/tail rings and forehead M.
    cloud = noise_xyz(x*19, y*17, z*22)
    base = np.array([.165, .152, .129]) + (cloud[:, None]-.5)*np.array([.082, .075, .065])
    warp = (noise_xyz(x*88, y*72, z*95)-.5)*2.6
    feather = noise_xyz(x*550, y*530, z*690)-.5
    bars = smooth(.40, .81, np.cos(y*137 + 1.8*np.sin(z*42) + .8*np.sin(y*39+np.abs(x)*63) + warp)+feather*.34)
    body = smooth(-.265, -.205, y) * smooth(.065, .145, z)
    spine = (1-smooth(.008, .025, np.abs(x))) * smooth(.265, .325, z) * body
    marks = np.maximum(bars*body*.91, spine)
    legs = (1-smooth(.14, .205, z)) * smooth(.025, .045, np.abs(x))
    legbars = smooth(.3, .73, np.cos(z*225 + y*15 + x*12)) * smooth(.029, .055, z)
    marks = np.maximum(marks*(1-legs), legbars*legs*.82)
    tail = smooth(.245, .278, y)
    rings = smooth(.28, .65, np.cos((y-.246)*173)+feather*.34)
    marks = np.maximum(marks*(1-tail), np.maximum(rings, smooth(.458, .479, y))*tail)
    head = 1-smooth(-.27, -.235, y)
    forehead = head*smooth(.340, .363, z)
    mshape = np.exp(-((np.abs(x)-(.008 + .56*np.maximum(.372-z, 0)))/.0038)**2)
    outer = np.exp(-((np.abs(x)-(.026+.22*(z-.35)))/.0045)**2)
    marks = np.maximum(marks*(1-head), np.maximum(mshape, outer*.83)*forehead)
    cheeks = head*smooth(.041, .058, np.abs(x))*(1-smooth(.339, .352, z))
    marks = np.maximum(marks, cheeks*smooth(.26, .73, np.cos(z*410+y*92))*.75)
    dark = np.array([.041, .040, .034])
    rgb = base*(1-marks[:, None]) + dark*marks[:, None]
    belly = (1-smooth(.157, .215, z))*(1-smooth(.038, .069, np.abs(x)))*(1-tail)*(1-head)
    chin = head*(1-smooth(.299, .316, z))*(1-smooth(.032, .055, np.abs(x)))
    pads = np.exp(-((np.abs(x)-.015)/.019)**4-((y+.355)/.027)**4-((z-.307)/.016)**4)
    pale = np.maximum(np.maximum(belly*.67, chin*.85), pads*.77)
    rgb = rgb*(1-pale[:, None]) + np.array([.34, .317, .274])*pale[:, None]
    # Broken submillimetre fibres run back along the torso and down the limbs.
    fibre_body = (noise_xyz(x*1850, y*170, z*1650)-.5)*2
    fibre_leg = (noise_xyz(x*1650, y*1450, z*190)-.5)*2
    fibre = fibre_body*(1-legs) + fibre_leg*legs
    fleck = (noise_xyz(x*630, y*160, z*670)-.5)*2
    rgb += (fibre*.043+fleck*.021)[:, None]
    roughness = np.clip(.81 + .055*fibre + .045*fleck + .025*(1-cloud), .66, .93)
    height = fibre*.00015 + fleck*.000035
    return np.clip(rgb, .015, .65), roughness, height


def paint_coat(obj, size=2048):
    """Rasterize this Blender UV atlas, then paint original physical-scale fur."""
    mesh = obj.data
    mesh.calc_loop_triangles()
    uv = mesh.uv_layers.active.data
    positions = np.zeros((size, size, 3), np.float32)
    covered = np.zeros((size, size), bool)
    subpixel_triangles = 0
    coords = np.array([v.co[:] for v in mesh.vertices], np.float32)
    for triangle in mesh.loop_triangles:
        tri = np.array([uv[i].uv[:] for i in triangle.loops]) * (size-1)
        low = np.maximum(np.floor(tri.min(axis=0)).astype(int), 0)
        high = np.minimum(np.ceil(tri.max(axis=0)).astype(int), size-1)
        if np.any(high < low):
            continue
        xx, yy = np.meshgrid(np.arange(low[0], high[0]+1), np.arange(low[1], high[1]+1))
        v0, v1 = tri[1]-tri[0], tri[2]-tri[0]
        denominator = v0[0]*v1[1]-v1[0]*v0[1]
        if abs(denominator) < 1e-8:
            continue
        dx, dy = xx-tri[0, 0], yy-tri[0, 1]
        b = (dx*v1[1]-v1[0]*dy)/denominator
        c = (v0[0]*dy-dx*v0[1])/denominator
        a = 1-b-c
        inside = (a >= -.001)&(b >= -.001)&(c >= -.001)
        if not inside.any():
            # A valid but sub-pixel UV sliver still needs its own surface colour.
            # Otherwise its filtered texel can inherit a nearby dark/bright bar.
            cx, cy = np.clip(np.rint(tri.mean(axis=0)).astype(int), 0, size-1)
            positions[cy, cx] = coords[list(triangle.vertices)].mean(axis=0)
            covered[cy, cx] = True
            subpixel_triangles += 1
            continue
        point = a[..., None]*coords[triangle.vertices[0]] + b[..., None]*coords[triangle.vertices[1]] + c[..., None]*coords[triangle.vertices[2]]
        positions[yy[inside], xx[inside]] = point[inside]
        covered[yy[inside], xx[inside]] = True
    colour = np.ones((size, size, 4), np.float32)
    # Sub-pixel islands must never sample white, even after mip filtering.
    colour[:, :, :3] = (.16, .147, .126)
    rough = np.ones_like(colour)
    normal = np.ones_like(colour)
    normal[:, :, :3] = (.5, .5, 1)
    relief = np.zeros((size, size), np.float32)
    rgb, r, height = coat_fields(positions[covered])
    colour[covered, :3] = rgb
    rough[covered, :3] = r[:, None]
    relief[covered] = height
    dx, dy = np.zeros_like(relief), np.zeros_like(relief)
    for axis, target in [(1, dx), (0, dy)]:
        plus, minus = np.roll(positions, -1, axis), np.roll(positions, 1, axis)
        valid = covered & np.roll(covered, -1, axis) & np.roll(covered, 1, axis)
        step = np.linalg.norm(plus-minus, axis=2)
        valid &= (step > .000001) & (step < .006)
        delta = np.roll(relief, -1, axis)-np.roll(relief, 1, axis)
        target[valid] = np.clip(-delta[valid]/step[valid], -.42, .42)
    ns = np.stack([dx, dy, np.ones_like(dx)], axis=2)
    ns /= np.linalg.norm(ns, axis=2)[:, :, None]
    normal[covered, :3] = ns[covered]*.5+.5
    # Dilation gives each island a 10-pixel gutter without changing its shape.
    painted = covered.copy()
    for _ in range(10):
        prior = painted.copy()
        for axis, offset in [(0, 1), (0, -1), (1, 1), (1, -1)]:
            take = ~painted & np.roll(prior, offset, axis)
            for array in [colour, rough, normal]:
                array[take] = np.roll(array, offset, axis)[take]
            painted[take] = True
    mat = material('Cat · short mackerel-tabby fur', (.2, .18, .15), .78)
    mat['authorship'] = 'Original physical-coordinate tabby markings and directional short fibres, authored in Blender by scripts/refine_cat.py'
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    p = nodes.get('Principled BSDF')
    for label, rgba, color in [('Colour', colour, True), ('Roughness', rough, False), ('Normal', normal, False)]:
        image = packed_image('Cat short fur · '+label, rgba, color)
        node = nodes.new('ShaderNodeTexImage')
        node.label = 'Original packed '+label.lower()+' atlas'
        node.image = image
        if label == 'Normal':
            normal_node = nodes.new('ShaderNodeNormalMap')
            normal_node.inputs['Strength'].default_value = .72
            links.new(node.outputs['Color'], normal_node.inputs['Color'])
            links.new(normal_node.outputs['Normal'], p.inputs['Normal'])
        else:
            links.new(node.outputs['Color'], p.inputs['Base Color' if label == 'Colour' else label])
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.material_index = 0
    return dict(resolution=size, coveredPixels=int(covered.sum()), subpixelTrianglesFilled=subpixel_triangles, maps=3,
                roughnessRange=[float(r.min()), float(r.max())])


def repair_faint(rig, face, floor):
    """Keep the authored sideways roll, but rest on the floor instead of below it."""
    scene = bpy.context.scene
    face.shape_key_add(name='Basis')
    flex = face.shape_key_add(name='Whiskers yield against floor')
    group = face.vertex_groups.get('Ground-flex whiskers')
    for vertex in face.data.vertices:
        if any(g.group == group.index for g in vertex.groups):
            x = vertex.co.x
            flex.data[vertex.index].co.x = math.copysign(min(abs(x), .069+max(abs(x)-.069, 0)*.16), x)
    for frame, value in [(1, 0), (10, .7), (19, 1), (40, 1)]:
        flex.value = value
        flex.keyframe_insert(data_path='value', frame=frame)
    keys = face.data.shape_keys
    flex_action = keys.animation_data.action
    flex_action.name = 'Faint whisker floor compliance'
    keys.animation_data.action = None
    track = keys.animation_data.nla_tracks.new()
    track.name = 'Faint'
    track.strips.new('Faint whisker floor compliance', 1, flex_action)
    rig.data.pose_position = 'POSE'
    for track in rig.animation_data.nla_tracks:
        track.mute = track.name != 'Faint'
    action = next(a for a in bpy.data.actions if a.name == 'Faint')
    faint_strip = next(t for t in rig.animation_data.nla_tracks if t.name == 'Faint').strips[0]
    rig.animation_data.use_nla = False
    rig.animation_data.action = action
    rig.animation_data.action_slot = faint_strip.action_slot
    key_strip = keys.animation_data.nla_tracks[0].strips[0]
    keys.animation_data.use_nla = False
    keys.animation_data.action = flex_action
    keys.animation_data.action_slot = key_strip.action_slot
    curve = next(c for layer in action.layers for strip in layer.strips for bag in strip.channelbags
                 for c in bag.fcurves if c.data_path == 'pose.bones["body"].location' and c.array_index == 2)
    root_heights, original_lowest = [], []
    asset_objects = [obj for obj in scene.objects if obj.type in {'MESH', 'CURVE'}]
    for frame in range(1, 41):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        low = bounds(asset_objects)[0][2]
        original_lowest.append(low)
        margin = .0007*min(1, (frame-1)/3)
        root_heights.append(curve.evaluate(frame)+floor+margin-low)
    curve.keyframe_points.clear()
    for frame, height in enumerate(root_heights, 1):
        point = curve.keyframe_points.insert(frame, height)
        point.interpolation = 'LINEAR'
    curve.update()
    sampled = []
    # Quarter frames catch ground penetration between the authored integer poses.
    for time in np.linspace(1, 40, 157):
        frame = int(time)
        scene.frame_set(frame, subframe=float(time-frame))
        bpy.context.view_layer.update()
        low = bounds(asset_objects)[0][2]
        sampled.append(float(low))
    assert min(sampled) > -.0005, 'Repaired faint still passes through the floor'
    assert sampled[-1] < .002, 'Repaired faint floats above the floor'
    for track in rig.animation_data.nla_tracks:
        track.mute = False
    rig.animation_data.action = None
    rig.animation_data.use_nla = True
    keys.animation_data.action = None
    keys.animation_data.use_nla = True
    scene.frame_set(1)
    return dict(changedChannels=['Faint/body/location.z', 'Faint/whisker floor compliance'],
                preserved='Skeleton, root conventions, all four other clips, and all other Faint skeletal channels',
                originalMinimumZ=float(min(original_lowest)), repairedMinimumZ=float(min(sampled)),
                repairedFinalMinimumZ=sampled[-1], checkedSubframes=len(sampled),
                bodyHeights=root_heights)


def main():
    rebuild = '--rebuild' in sys.argv
    path = BACKUP if rebuild else SOURCE
    if rebuild and not BACKUP.exists():
        raise RuntimeError('No local original-source backup is available for --rebuild')
    bpy.ops.wm.open_mainfile(filepath=str(path))
    scene = bpy.context.scene
    if scene.get('cat_refinement_version') == VERSION:
        print('CAT_REFINEMENT_ALREADY_APPLIED', flush=True)
        return
    if not BACKUP.exists():
        shutil.copy2(SOURCE, BACKUP)
        shutil.copy2(MODEL, OUT/'cat-before-refinement.glb')
    shared_hash = hashlib.sha256((ROOT/'game-assets/asset-catalog.json').read_bytes()).hexdigest()
    rig = next(o for o in scene.objects if o.type == 'ARMATURE')
    before_fingerprint, before_rig = fingerprint(rig)
    scene.frame_set(1)
    rig.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    before_bounds = bounds(list(scene.objects))
    skin = next(o for o in scene.objects if o.name == 'Continuous anatomical skin')
    original_floor = min(v.co.z for v in skin.data.vertices)
    print('CAT_REFINEMENT_BEGIN', before_fingerprint, flush=True)
    # Preserve the old vertex-group influence field while improving the rest shape.
    for vertex in skin.data.vertices:
        x, y, z = vertex.co
        neck = math.exp(-((y+.201)/.064)**2) * math.exp(-((z-.279)/.10)**4)
        torso = float(smooth(-.226, -.145, y))*float(smooth(.11, .16, z))
        waist = math.exp(-((y-.049)/.068)**2)*float(smooth(.12, .17, z))
        nx = x*(1-.40*neck-.10*torso-.09*waist)
        nz = z - .037*neck*float(smooth(.25, .35, z))
        nz -= .030*torso*float(smooth(.21, .33, z))
        nz += .017*waist*(1-float(smooth(.18, .245, z)))
        nz += .035*neck*(1-float(smooth(.23, .28, z)))
        ny = y + .040*neck*(1-float(smooth(.29, .33, z)))
        # A short broad cheek and nose bridge replace the old ball-shaped snout.
        head = 1-float(smooth(-.283, -.236, y))
        nx += math.copysign(.0045, x)*head*math.exp(-((z-.318)/.025)**2)*math.exp(-((y+.327)/.026)**2)
        ny += .010*float(smooth(.321, .369, -y))*head
        if z > .370 and y < -.243:
            nx += math.copysign(.0065, x)*float(smooth(.370, .410, z))
        # Define slimmer front wrists and a slightly forward-planted forepaw.
        front = math.exp(-((y+.123)/.059)**4)*(1-float(smooth(.135, .21, z)))
        ny -= .013*front
        side = -1 if x < 0 else 1
        centre_x = side*.05576
        limb = (1-float(smooth(.12, .19, z)))*float(smooth(.015, .034, abs(x)))
        nx = nx*(1-limb*.13)+(centre_x+(nx-centre_x)*.81)*limb*.13
        # Keep the existing exact foot datum: lift only the upper toe groove.
        if z < .026:
            grooves = sum(math.exp(-((x-(centre_x+offset))/.0016)**2) for offset in [-.011, 0, .011])
            nz -= min(.0023, .0009*grooves)*float(smooth(.006, .015, z))
        vertex.co = (nx, ny, max(original_floor, nz))
    skin.data.update()
    additions = []
    for side in [-1, 1]:
        additions.append(ellipse('Feline whisker pad', (side*.0145, -.350, .307), (.019, .017, .0125), 'head'))
        for front in [True, False]:
            bone = ('front' if front else 'rear') + ('L' if side < 0 else 'R')
            toe_y = -.176 if front else .113
            for j, offset in enumerate([-.016, -.0055, .0055, .016]):
                additions.append(ellipse('Feline toe '+bone, (side*.05576+offset, toe_y+(abs(offset)*.16), .0105),
                                         (.0065, .0090, .0080), bone))
    # A fine voxel weld removes intersecting primitive seams, then transfers the
    # original locally sampled influences back to the same untouched skeleton.
    activate(skin)
    for obj in additions:
        obj.select_set(True)
    bpy.ops.object.join()
    cloud = [(v.co.copy(), [(skin.vertex_groups[g.group].name, g.weight) for g in v.groups]) for v in skin.data.vertices]
    tree = KDTree(len(cloud))
    for i, (co, _) in enumerate(cloud):
        tree.insert(co, i)
    tree.balance()
    for modifier in list(skin.modifiers):
        skin.modifiers.remove(modifier)
    weld = skin.modifiers.new('Fine feline surface weld', 'REMESH')
    weld.mode = 'VOXEL'
    weld.voxel_size = .0025
    weld.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=weld.name)
    relax = skin.modifiers.new('Minimal surface relaxation', 'SMOOTH')
    relax.factor = .19
    relax.iterations = 1
    bpy.ops.object.modifier_apply(modifier=relax.name)
    simplify = skin.modifiers.new('Feline game mesh', 'DECIMATE')
    simplify.ratio = .55
    bpy.ops.object.modifier_apply(modifier=simplify.name)
    new_floor = min(v.co.z for v in skin.data.vertices)
    for vertex in skin.data.vertices:
        # Weld may round away fractions of a millimetre at the soles.
        vertex.co.z += (original_floor-new_floor)*(1-float(smooth(.005, .025, vertex.co.z)))
    skin.vertex_groups.clear()
    for bone in rig.data.bones:
        skin.vertex_groups.new(name=bone.name)
    for vertex in skin.data.vertices:
        weights = {}
        for _, index, distance in tree.find_n(vertex.co, 4):
            influence = 1/max(.0005, distance)**2
            for name, weight in cloud[index][1]:
                weights[name] = weights.get(name, 0)+weight*influence
        total = sum(weights.values())
        for name, weight in weights.items():
            if weight/total > .002:
                skin.vertex_groups[name].add([vertex.index], weight/total, 'REPLACE')
    # Nearest-source transfer can produce abrupt patches where old separate
    # ellipsoids met. Smooth only the influence field over the welded surface.
    weights = np.zeros((len(skin.data.vertices), len(skin.vertex_groups)), np.float32)
    for vertex in skin.data.vertices:
        for group in vertex.groups:
            weights[vertex.index, group.group] = group.weight
    edge = np.array([e.vertices[:] for e in skin.data.edges], np.int32)
    ends = np.concatenate([edge[:, 0], edge[:, 1]])
    neighbours = np.concatenate([edge[:, 1], edge[:, 0]])
    degree = np.bincount(ends, minlength=len(weights)).astype(np.float32)
    factor = np.array([float(smooth(.035, .085, v.co.z))*.6 for v in skin.data.vertices], np.float32)[:, None]
    for _ in range(14):
        nearby = np.zeros_like(weights)
        np.add.at(nearby, ends, weights[neighbours])
        weights = weights*(1-factor)+nearby/np.maximum(degree[:, None], 1)*factor
    weights /= np.maximum(weights.sum(axis=1)[:, None], 1e-8)
    for group in skin.vertex_groups:
        group.remove(list(range(len(skin.data.vertices))))
    for index, row in enumerate(weights):
        kept = np.where(row > .002)[0]
        total = row[kept].sum()
        for group in kept:
            skin.vertex_groups[int(group)].add([index], float(row[group]/total), 'REPLACE')
    deform = skin.modifiers.new('Skeletal deformation', 'ARMATURE')
    deform.object = rig
    # Keep the authored tail controls and bone motion, with a tapered closed tip.
    tail = next(o for o in scene.objects if o.name == 'Tail')
    tail.data.bevel_depth = .0116
    tail.data.use_fill_caps = True
    for spline in tail.data.splines:
        for i, point in enumerate(spline.bezier_points):
            point.radius = [1.05, .91, .68, .25][i]
    world = tail.matrix_world.copy()
    tail.parent = None
    tail.matrix_world = world
    activate(tail)
    bpy.ops.object.convert(target='MESH')
    tail = bpy.context.object
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    tail.vertex_groups.new(name='tail').add(list(range(len(tail.data.vertices))), 1, 'REPLACE')
    tip = ellipse('Rounded tail tip', (.04, .2304+.48*.53, .2418+.31*.02), (.0029, .0029, .0029), 'tail')
    activate(skin)
    tail.select_set(True)
    tip.select_set(True)
    bpy.ops.object.join()
    for face in skin.data.polygons:
        face.use_smooth = True
    # The cap tips stay at the old source height, retaining its gameplay envelope.
    old_top = before_bounds[1][2]
    new_top = max(v.co.z for v in skin.data.vertices)
    for vertex in skin.data.vertices:
        vertex.co.z += (old_top-new_top)*float(smooth(.389, .414, vertex.co.z))
    activate(skin)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.10, island_margin=.008)
    bpy.ops.object.mode_set(mode='OBJECT')
    print('CAT_SURFACE_COMPLETE', len(skin.data.vertices), len(skin.data.polygons), flush=True)
    atlas_info = paint_coat(skin)
    print('CAT_COAT_COMPLETE', atlas_info, flush=True)
    # Replace the bead eyes and button nose with explicitly feline face details.
    for obj in list(scene.objects):
        if obj not in [skin, rig] and obj.type in {'MESH', 'CURVE'}:
            bpy.data.objects.remove(obj, do_unlink=True)
    dark = material('Cat · nose and eyelid edge', (.026, .018, .016), .58)
    inner = material('Cat · shaded inner pinna', (.145, .081, .067), .91)
    whisker = material('Cat · fine silver whisker', (.25, .265, .242), .74)
    eye_mat = material('Cat · olive amber iris', (.20, .24, .105), .29)
    image_size = 256
    vv, uu = np.mgrid[0:image_size, 0:image_size].astype(np.float32)/(image_size-1)*2-1
    rr = np.sqrt(uu*uu+vv*vv)
    angle = np.arctan2(vv, uu)
    iris_fibres = .5+.27*np.sin(angle*91+rr*25)+.14*np.sin(angle*171-rr*48)
    rgba = np.ones((image_size, image_size, 4), np.float32)
    rgba[:, :, :3] = np.array([.18, .195, .083])+iris_fibres[:, :, None]*np.array([.085, .070, .031])
    rim = smooth(.76, .98, rr)
    rgba[:, :, :3] *= 1-rim[:, :, None]*.91
    pupil = (1-smooth(.095, .16, np.abs(uu)/(np.maximum(.07, 1-vv*vv)**.64)))*(1-smooth(.81, .91, np.abs(vv)))
    rgba[:, :, :3] *= 1-pupil[:, :, None]*.985
    eye_image = packed_image('Cat iris · original radial fibres and slit', rgba)
    image_node = eye_mat.node_tree.nodes.new('ShaderNodeTexImage')
    image_node.image = eye_image
    eye_mat.node_tree.links.new(image_node.outputs['Color'], eye_mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    eye_mat.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value = .03
    graph = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(skin, graph)
    details = []
    for side in [-1, 1]:
        x, z = side*.0385, .3425
        hit = bvh.ray_cast(Vector((x, -.5, z)), Vector((0, 1, 0)))[0]
        centre_y = hit.y if hit else -.331
        vertices, uvcoords = [(x, centre_y-.0020, z)], [(.5, .5)]
        segments, rings = 48, 5
        def eye_point(radius, theta):
            local_x = math.cos(theta)*.0170*radius
            local_z = math.sin(theta)*.0095*radius*(.70+.30*abs(math.sin(theta)))
            px, pz = x+local_x, z+local_z+side*local_x*.17
            contact = bvh.ray_cast(Vector((px, -.5, pz)), Vector((0, 1, 0)))[0]
            py = contact.y if contact else centre_y + side*local_x*.30
            return (px, py-.00075-.00125*math.sqrt(max(0, 1-radius*radius)), pz)
        for ring in range(1, rings+1):
            radius = ring/rings
            for i in range(segments):
                theta = i/segments*math.tau
                vertices.append(eye_point(radius, theta))
                uvcoords.append((.5+.5*radius*math.cos(theta), .5+.5*radius*math.sin(theta)))
        faces = [(0, 1+i, 1+(i+1)%segments) for i in range(segments)]
        for ring in range(rings-1):
            a, b = 1+ring*segments, 1+(ring+1)*segments
            faces.extend((a+i, b+i, b+(i+1)%segments, a+(i+1)%segments) for i in range(segments))
        mesh = bpy.data.meshes.new('Feline almond eye surface')
        mesh.from_pydata(vertices, [], faces)
        mesh.materials.append(eye_mat)
        layer = mesh.uv_layers.new(name='Iris UV')
        for face in mesh.polygons:
            face.use_smooth = True
            for li in face.loop_indices:
                layer.data[li].uv = uvcoords[mesh.loops[li].vertex_index]
        eye = bpy.data.objects.new('Almond eye '+str(side), mesh)
        scene.collection.objects.link(eye)
        details.append(eye)
        for start in [0, math.pi]:
            pts = [eye_point(1, start+i/8*math.pi) for i in range(9)]
            details.append(curve('Feline eyelid edge', [(a, b-.00035, c) for a, b, c in pts], .00055, dark))
        # Concave pinna inset lies just inside the widened existing outer ear.
        vertices = [(side*.0345, -.284, .382), (side*.0578, -.282, .380),
                    (side*.0572, -.2732, .410), (side*.0460, -.279, .389)]
        mesh = bpy.data.meshes.new('Concave ear pinna')
        mesh.from_pydata(vertices, [], [(0, 1, 3), (1, 2, 3), (2, 0, 3)])
        mesh.materials.append(inner)
        ear = bpy.data.objects.new('Inner ear '+str(side), mesh)
        scene.collection.objects.link(ear)
        details.append(ear)
        for j in range(4):
            root = (side*(.025+.001*j), -.361+.002*j, .308-.003*j)
            middle = (side*(.063+.003*j), -.365+.008*j, .309+.003*j)
            end = (side*(.102+.006*j), -.343+.009*j, .302+.008*j)
            details.append(curve('Fine mystacial whisker', [root, middle, end], .00021, whisker))
        for j in range(2):
            details.append(curve('Fine supraorbital whisker', [(side*.035, -.319, .360),
                                (side*.049, -.319+j*.008, .381), (side*(.065+j*.009), -.303+j*.014, .397)], .00016, whisker))
        for j in range(3):
            details.append(ellipse('Whisker follicle', (side*(.020+.003*j), -.363+.002*j, .311-.004*j),
                                   (.00072, .00038, .00064), mat=dark))
    # Rounded triangular rhinarium, short philtrum and split upper lip.
    vertices = [(-.0084, -.3690, .317), (.0084, -.3690, .317), (0, -.371, .3068),
                (-.0069, -.364, .316), (.0069, -.364, .316), (0, -.365, .308)]
    mesh = bpy.data.meshes.new('Triangular feline rhinarium')
    mesh.from_pydata(vertices, [], [(0, 2, 1), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)])
    mesh.materials.append(dark)
    nose = bpy.data.objects.new('Feline triangular nose', mesh)
    scene.collection.objects.link(nose)
    activate(nose)
    bevel = nose.modifiers.new('Soft nose corners', 'BEVEL')
    bevel.width = .0012
    bevel.segments = 3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for face in nose.data.polygons:
        face.use_smooth = True
    details.append(nose)
    details.append(curve('Short feline philtrum', [(0, -.3694, .307), (0, -.3684, .3015)], .00063, dark))
    for side in [-1, 1]:
        details.append(curve('Split feline upper lip', [(0, -.3684, .3015), (side*.008, -.3665, .299),
                                                       (side*.018, -.358, .3005)], .00057, dark))
    # Face details share one animated object. Five materials/skin draw calls total.
    for obj in details:
        activate(obj)
        if obj.type == 'CURVE':
            bpy.ops.object.convert(target='MESH')
        if obj.name.startswith('Fine '):
            obj.vertex_groups.new(name='Ground-flex whiskers').add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    meshes = [obj for obj in scene.objects if obj.type == 'MESH' and obj != skin]
    activate(meshes[0])
    for obj in meshes[1:]:
        obj.select_set(True)
    bpy.ops.object.join()
    face = bpy.context.object
    face.name = 'Feline face · eyes nose ears whiskers'
    head_parent(face, rig)
    scene['cat_refinement_version'] = VERSION
    scene['cat_refinement_notes'] = 'Slender neck and wrist transition, short muzzle/whisker pads, almond eyes, separated toes, original mackerel-tabby short fur. Original skeleton and four actions preserved; Faint vertical placement repaired with compliant whiskers.'
    skin['original_ground_contact_m'] = original_floor
    skin['coat_authorship'] = 'Original packed PBR atlas generated in Blender by refine_cat.py; no downloaded imagery or runtime geometry.'
    after_fingerprint, after_rig = fingerprint(rig)
    assert after_fingerprint == before_fingerprint, 'Animation or rig data changed'
    bpy.context.view_layer.update()
    after_bounds = bounds(list(scene.objects))
    assert abs(after_bounds[0][2]-before_bounds[0][2]) < .00015, 'Foot contact changed'
    assert abs(after_bounds[1][2]-before_bounds[1][2]) < .001, 'Overall height changed'
    assert abs(after_bounds[1][1]-before_bounds[1][1]) < .016, 'Tail/gameplay length changed'
    assert abs(after_bounds[0][1]-before_bounds[0][1]) < .016, 'Face/gameplay length changed'
    faint_repair = repair_faint(rig, face, original_floor)
    after_fingerprint, after_rig = fingerprint(rig)
    assert before_rig['bones'] == after_rig['bones'] and before_rig['rigMatrix'] == after_rig['rigMatrix']
    for clip in ['Idle', 'Walk', 'Attack', 'Hit']:
        assert next(a for a in before_rig['actions'] if a[0] == clip) == next(a for a in after_rig['actions'] if a[0] == clip)
    rig.data.pose_position = 'POSE'
    scene.frame_set(1)
    bpy.context.view_layer.update()
    # Remove unused old coating datablocks, while NLA strips keep all actions alive.
    for mat in list(bpy.data.materials):
        if mat.users == 0:
            bpy.data.materials.remove(mat)
    for image in list(bpy.data.images):
        if image.users == 0:
            bpy.data.images.remove(image)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
    bpy.ops.export_scene.gltf(filepath=str(MODEL), export_format='GLB', export_image_format='WEBP',
        export_image_quality=90, export_animation_mode='NLA_TRACKS', export_animations=True,
        export_frame_range=False)
    assert hashlib.sha256((ROOT/'game-assets/asset-catalog.json').read_bytes()).hexdigest() == shared_hash
    audit = dict(beforeRigSHA256=before_fingerprint, afterRigSHA256=after_fingerprint,
                 bones=[b.name for b in rig.data.bones], actions=[a[0] for a in before_rig['actions']],
                 beforeBounds=before_bounds, afterBounds=after_bounds, atlas=atlas_info,
                 skeletonUnchanged=True, fourOtherClipsUnchanged=True, faintRepair=faint_repair,
                 skinVertices=len(skin.data.vertices), skinPolygons=len(skin.data.polygons),
                 modelBytes=MODEL.stat().st_size, blendBytes=SOURCE.stat().st_size,
                 packedImages=[dict(name=i.name, size=list(i.size), packed=bool(i.packed_file)) for i in bpy.data.images])
    (OUT/'cat-refinement-audit.json').write_text(json.dumps(audit, indent=2))
    print('CAT_REFINEMENT_COMPLETE', json.dumps(audit), flush=True)


if __name__ == '__main__':
    main()
