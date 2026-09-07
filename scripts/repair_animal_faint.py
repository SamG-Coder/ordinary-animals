"""Repair only Faint's body-height curve using evaluated Blender floor contact.

Blender CLI: blender -b --factory-startup --threads 4 --python-exit-code 1 --python scripts/repair_animal_faint.py -- all
The cat is maintained by its separate refinement script. Meshes, materials, rig,
clip names/durations and the four other clips stay intact. Faint changes are the
body-height curve and whisker folding for hamster, rat and rabbit.
"""
import bpy
import hashlib
import json
import math
import shutil
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ANIMALS = ('dog', 'hamster', 'rat', 'fox', 'rabbit', 'raccoon', 'goat')
OUTPUT = ROOT / 'artifacts' / 'animal-faint-repair'
OUTPUT.mkdir(parents=True, exist_ok=True)
REQUEST = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'all'
NAMES = ANIMALS if REQUEST == 'all' else tuple(REQUEST.split(','))
if any(name not in ANIMALS for name in NAMES):
    raise ValueError('Choose all or one of: ' + ', '.join(ANIMALS))


def channels(action):
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    yield curve


def action_digest(action, omit_height=False):
    records = []
    for curve in channels(action):
        if omit_height and curve.data_path == 'pose.bones["body"].location' and curve.array_index == 2:
            continue
        records.append((curve.data_path, curve.array_index, curve.extrapolation,
                        [(list(point.co), point.interpolation, list(point.handle_left),
                          list(point.handle_right), point.handle_left_type, point.handle_right_type)
                         for point in curve.keyframe_points]))
    return hashlib.sha256(json.dumps(sorted(records)).encode()).hexdigest()


def structure_digest(scene):
    digest = hashlib.sha256()
    for obj in sorted(scene.objects, key=lambda obj: obj.name):
        digest.update(json.dumps([obj.name, obj.type, obj.parent.name if obj.parent else None,
                                  obj.parent_type, obj.parent_bone]).encode())
        if obj.type == 'MESH':
            coords = np.empty(len(obj.data.vertices) * 3, dtype=np.float32)
            obj.data.vertices.foreach_get('co', coords)
            digest.update(coords.tobytes())
            digest.update(json.dumps([list(p.vertices) for p in obj.data.polygons]).encode())
            digest.update(json.dumps([slot.material.name if slot.material else None for slot in obj.material_slots]).encode())
            digest.update(json.dumps([[(group.group, group.weight) for group in vertex.groups]
                                      for vertex in obj.data.vertices]).encode())
        elif obj.type == 'ARMATURE':
            digest.update(json.dumps([(bone.name, bone.parent.name if bone.parent else None,
                                       [list(row) for row in bone.matrix_local])
                                      for bone in obj.data.bones]).encode())
    return digest.hexdigest()


def evaluated_height():
    graph = bpy.context.evaluated_depsgraph_get()
    low, high = math.inf, -math.inf
    skin_low = math.inf
    for obj in bpy.context.scene.objects:
        if obj.type not in {'MESH', 'CURVE', 'FONT'} or obj.hide_render:
            continue
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        if mesh and len(mesh.vertices):
            coords = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
            mesh.vertices.foreach_get('co', coords)
            coords = coords.reshape((-1, 3))
            matrix = evaluated.matrix_world
            heights = coords @ np.array(matrix[2][:3]) + matrix[2][3]
            low, high = min(low, float(heights.min())), max(high, float(heights.max()))
            if obj.name.startswith('Continuous anatomical skin'):
                skin_low = float(heights.min())
        evaluated.to_mesh_clear()
    return {'minZ': low, 'maxZ': high, 'skinMinZ': skin_low}


def set_frame(frame):
    base = math.floor(frame)
    bpy.context.scene.frame_set(base, subframe=frame - base)
    bpy.context.view_layer.update()


for name in NAMES:
    source = ROOT / 'assets' / f'{name}.blend'
    model = ROOT / 'game-assets' / 'models' / f'{name}.glb'
    for path in (source, model):
        backup = OUTPUT / f'{name}.before{path.suffix}'
        if not backup.exists():
            shutil.copy2(path, backup)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.context.scene
    rigs = [obj for obj in scene.objects if obj.type == 'ARMATURE']
    assert len(rigs) == 1, f'{name}: expected one original animal skeleton'
    rig = rigs[0]
    ad = rig.animation_data
    strips = {track.name: track.strips[0] for track in ad.nla_tracks}
    assert set(strips) == {'Idle', 'Walk', 'Attack', 'Hit', 'Faint'}
    original_action = ad.action
    original_slot = ad.action_slot
    original_nla = ad.use_nla
    original_influence = ad.action_influence
    original_blend_type = ad.action_blend_type
    original_pose_mode = rig.data.pose_position
    original_frame = scene.frame_current
    original_pose = {bone.name: bone.matrix_basis.copy() for bone in rig.pose.bones}
    before_actions = {clip: action_digest(strip.action, clip == 'Faint') for clip, strip in strips.items()}
    before_structure = structure_digest(scene)
    before_rest_matrix = rig.matrix_world.copy()

    # The saved NLA strips can have zero influence after export. Bind the exact
    # action and Blender 5 action slot directly, rather than evaluating a muted pose.
    ad.use_nla = False
    ad.action = None
    rig.data.pose_position = 'REST'
    set_frame(1)
    rest = evaluated_height()
    rig.data.pose_position = 'POSE'
    faint = strips['Faint']
    action, slot = faint.action, faint.action_slot
    first, last = float(faint.action_frame_start), float(faint.action_frame_end)
    ad.action = action
    ad.action_slot = slot
    ad.action_influence = 1
    ad.action_blend_type = 'REPLACE'
    folded_whiskers = []
    if name in {'hamster', 'rat', 'rabbit'}:
        # Rigid whiskers would otherwise become the lowest point of the fallen
        # animal and prop its body above the floor. Fold them toward the muzzle
        # only during Faint, using object animation and unchanged curve geometry.
        for obj in scene.objects:
            if not obj.name.startswith('Whisker'):
                continue
            original_scale = obj.scale.copy()
            obj.animation_data_create()
            wad = obj.animation_data
            track = next((track for track in wad.nla_tracks if track.name == 'Faint'), None)
            if track:
                whisker_strip = track.strips[0]
                wad.action = whisker_strip.action
                wad.action_slot = whisker_strip.action_slot
                for curve in channels(wad.action):
                    assert curve.data_path == 'scale' and curve.array_index == 0
                    curve.keyframe_points.clear()
            else:
                assert wad.action is None and not len(wad.nla_tracks)
            wad.use_nla = False
            wad.action_influence = 1
            for frame in range(math.ceil(first), math.floor(last) + 1):
                progress = min(1, (frame - first) / ((last - first) * .5))
                smooth = progress * progress * (3 - 2 * progress)
                obj.scale.x = original_scale.x * (1 - .78 * smooth)
                obj.keyframe_insert(data_path='scale', index=0, frame=frame)
            for curve in channels(wad.action):
                for point in curve.keyframe_points:
                    point.interpolation = 'LINEAR'
                curve.update()
            if track is None:
                whisker_action, whisker_slot = wad.action, wad.action_slot
                whisker_action.name = f'{name} {obj.name} Faint fold'
                wad.action = None
                track = wad.nla_tracks.new()
                track.name = 'Faint'
                whisker_strip = track.strips.new('Faint', int(first), whisker_action)
                whisker_strip.action_slot = whisker_slot
                wad.action = whisker_action
                wad.action_slot = whisker_slot
            folded_whiskers.append((obj, original_scale))
    height_curve = next(curve for curve in channels(action)
                        if curve.data_path == 'pose.bones["body"].location' and curve.array_index == 2)
    # A body location-Z key must move the whole original animal vertically.
    basis = rig.matrix_world.to_3x3() @ rig.data.bones['body'].matrix_local.to_3x3()
    assert abs(basis[0][2]) < 1e-6 and abs(basis[1][2]) < 1e-6 and basis[2][2] > .9999
    sample_frames = sorted(set([first, last] + [float(frame) for frame in range(math.ceil(first), math.floor(last) + 1)]))
    before = []
    keys = []
    target_floor = max(0, rest['minZ']) + .0005
    for frame in sample_frames:
        set_frame(frame)
        bounds = evaluated_height()
        original_z = float(rig.pose.bones['body'].location.z)
        lift = (target_floor - bounds['minZ']) / basis[2][2]
        keys.append((frame, original_z + lift))
        before.append({'frame': frame, **bounds})
    height_curve.keyframe_points.clear()
    for frame, value in keys:
        point = height_curve.keyframe_points.insert(frame, value, options={'FAST'})
        point.interpolation = 'LINEAR'
    height_curve.update()
    def sample_corrected():
        result = []
        for sample in range(int(round((last - first) * 4)) + 1):
            frame = first + sample / 4
            set_frame(frame)
            result.append({'frame': frame, **evaluated_height()})
        return result
    samples = sample_corrected()
    # Rotation between the 24-fps translation keys can place a vertex slightly
    # below its endpoint envelope. Bake the measured subframe guard into Faint.
    interpolation_guard = max(0, .00005 - min(sample['minZ'] for sample in samples))
    if interpolation_guard:
        for point in height_curve.keyframe_points:
            point.co.y += interpolation_guard / basis[2][2]
        height_curve.update()
        samples = sample_corrected()
    assert min(sample['minZ'] for sample in samples) > 0, f'{name}: repaired source still crosses floor'
    assert abs(samples[-1]['minZ'] - target_floor - interpolation_guard) < .00005
    assert rig.matrix_world == before_rest_matrix

    # Restore the scene's neutral state before saving/exporting. The new whisker
    # channels belong only to their Faint NLA tracks; their rest scale stays exact.
    for obj, original_scale in folded_whiskers:
        obj.animation_data.action = None
        obj.animation_data.use_nla = True
        obj.scale = original_scale
    ad.action = original_action
    if original_action:
        ad.action_slot = original_slot
    ad.use_nla = original_nla
    ad.action_influence = original_influence
    ad.action_blend_type = original_blend_type
    rig.data.pose_position = original_pose_mode
    for bone in rig.pose.bones:
        bone.matrix_basis = original_pose[bone.name]
    set_frame(original_frame)
    after_actions = {clip: action_digest(strip.action, clip == 'Faint') for clip, strip in strips.items()}
    assert before_actions == after_actions, f'{name}: unrelated animation channel changed'
    assert structure_digest(scene) == before_structure, f'{name}: original model structure changed'
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    bpy.ops.export_scene.gltf(
        filepath=str(model), export_format='GLB', export_image_format='WEBP',
        export_image_quality=90, export_animations=True,
        export_animation_mode='NLA_TRACKS', export_frame_range=False,
        export_lights=True, export_extras=True,
    )
    record = {'asset': name, 'rest': rest, 'targetFloor': target_floor, 'interpolationGuard': interpolation_guard,
              'durationFrames': [first, last], 'durationSeconds': (last-first) * scene.render.fps_base / scene.render.fps,
              'sceneFps': scene.render.fps / scene.render.fps_base,
              'sourceSampleFps': 4 * scene.render.fps / scene.render.fps_base,
              'modifiedChannels': ['Faint / body / location.z'] + [f'Faint / {obj.name} / scale.x' for obj, _ in folded_whiskers],
              'preservedActionDigests': after_actions, 'structureDigest': before_structure,
              'before': before, 'after': samples,
              'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
              'modelSha256': hashlib.sha256(model.read_bytes()).hexdigest()}
    (OUTPUT / f'{name}.source-check.json').write_text(json.dumps(record, indent=2))
    print('FAINT_REPAIRED', json.dumps({'asset': name, 'sourceMinZ': min(sample['minZ'] for sample in samples),
                                     'final': samples[-1], 'preservedOtherChannels': before_actions == after_actions}), flush=True)
print('FAINT_REPAIR_COMPLETE', len(NAMES), flush=True)
