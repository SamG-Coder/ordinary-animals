"""Join anatomical volumes into continuous skinned surfaces and transfer authored clips.
Run inside Blender with -- cat (or -- all). Each asset is refined independently.
"""
import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
ROOT=Path(__file__).resolve().parents[1]
names=['cat','dog','hamster','rat','fox','rabbit','raccoon','goat']
requested=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'cat'
for species in names if requested=='all' else [requested]:
    path=ROOT/'assets'/f'{species}.blend'
    bpy.ops.wm.open_mainfile(filepath=str(path));scene=bpy.context.scene;scene.frame_set(1)
    joints={o.name.split('.')[0]:o for o in scene.objects if o.type=='EMPTY' and o.name.split('.')[0] in ['body','head','tail','frontL','frontR','rearL','rearR']}
    if any(o.type=='ARMATURE' for o in scene.objects):
        print('ALREADY_REFINED',species,flush=True);continue
    if len(joints)!=7:raise RuntimeError(f'{species}: missing authored joints')
    # Sample each original object-animation clip before replacing the transform hierarchy.
    samples={};rest={n:o.matrix_world.copy() for n,o in joints.items()}
    for clip,frames in [('Idle',61),('Walk',25),('Attack',25),('Hit',19),('Faint',40)]:
        for o in joints.values():
            if o.animation_data:
                for track in o.animation_data.nla_tracks:track.mute=track.name!=clip
        frames_data=[]
        for frame in range(1,frames+1,3):
            scene.frame_set(frame);frames_data.append((frame,{n:o.matrix_world.copy() for n,o in joints.items()}))
        samples[clip]=frames_data
    for o in joints.values():
        if o.animation_data:
            for t in o.animation_data.nla_tracks:t.mute=True
    scene.frame_set(1);bpy.context.view_layer.update()
    # Restore the neutral matrices rather than the last active fainting pose.
    for n,o in joints.items():o.matrix_world=rest[n]
    bpy.context.view_layer.update()
    surface_names=['Ribcage','Haunch','Neck','Skull','Muzzle','Upper limb','Lower limb','Paw','Toe','Ear']
    skin_parts=[o for o in scene.objects if o.type=='MESH' and o.name.split('.')[0] in surface_names]
    def owner(obj):
        p=obj.parent
        while p:
            if p in joints.values():return next(n for n,o in joints.items() if o==p)
            p=p.parent
        return 'body'
    cloud=[]
    for o in skin_parts:
        bone=owner(o)
        for v in o.data.vertices:cloud.append((o.matrix_world@v.co,bone))
    tree=KDTree(len(cloud))
    for i,(co,_) in enumerate(cloud):tree.insert(co,i)
    tree.balance()
    # Preserve eye, nose, whisker and horn transforms before clearing the old parents.
    details=[(o,owner(o),o.matrix_world.copy()) for o in scene.objects if o.type in ['MESH','CURVE'] and o not in skin_parts]
    for o in skin_parts:
        matrix=o.matrix_world.copy();o.parent=None;o.matrix_world=matrix
    bpy.ops.object.select_all(action='DESELECT')
    for o in skin_parts:o.select_set(True)
    bpy.context.view_layer.objects.active=skin_parts[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Continuous anatomical skin'
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    # A single continuous surface removes the conspicuous intersecting-ellipsoid joints.
    remesh=skin.modifiers.new('Organic surface','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.002 if species in ['hamster','rat'] else .005;remesh.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth=skin.modifiers.new('Relax anatomical transitions','SMOOTH');smooth.factor=.55;smooth.iterations=5;bpy.ops.object.modifier_apply(modifier=smooth.name)
    decimate=skin.modifiers.new('Game mesh','DECIMATE');decimate.ratio=.55;bpy.ops.object.modifier_apply(modifier=decimate.name)
    for p in skin.data.polygons:p.use_smooth=True
    # UV projection is regenerated on the final surface inside Blender.
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.01);bpy.ops.object.mode_set(mode='OBJECT')
    arm_data=bpy.data.armatures.new('Animal skeleton');rig=bpy.data.objects.new('Animal rig',arm_data);scene.collection.objects.link(rig)
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
    for name,matrix in rest.items():bone=arm_data.edit_bones.new(name);bone.head=matrix.translation;bone.tail=bone.head+Vector((0,.08,0))
    for name in rest:
        if name!='body':arm_data.edit_bones[name].parent=arm_data.edit_bones['body']
    bpy.ops.object.mode_set(mode='OBJECT')
    for name in joints:skin.vertex_groups.new(name=name)
    for v in skin.data.vertices:
        weights={}
        for _,index,distance in tree.find_n(v.co,5):
            name=cloud[index][1];weights[name]=weights.get(name,0)+1/max(.002,distance)**2
        total=sum(weights.values())
        for name,w in weights.items():skin.vertex_groups[name].add([v.index],w/total,'REPLACE')
    deform=skin.modifiers.new('Skeletal deformation','ARMATURE');deform.object=rig;skin.parent=rig
    for o,name,matrix in details:
        o.parent=rig;o.parent_type='BONE';o.parent_bone=name;bpy.context.view_layer.update();o.matrix_world=matrix
    # Transfer the sampled rest-relative transforms to actual pose-bone actions.
    for clip,frames_data in samples.items():
        rig.animation_data_create();rig.animation_data.action=None
        for frame,matrices in frames_data:
            for name in ['body','head','tail','frontL','frontR','rearL','rearR']:
                pb=rig.pose.bones[name];pb.rotation_mode='QUATERNION';pb.matrix=matrices[name];bpy.context.view_layer.update();pb.keyframe_insert(data_path='location',frame=frame);pb.keyframe_insert(data_path='rotation_quaternion',frame=frame);pb.keyframe_insert(data_path='scale',frame=frame)
        action=rig.animation_data.action;action.name=clip;rig.animation_data.action=None;track=rig.animation_data.nla_tracks.new();track.name=clip;track.strips.new(clip,1,action);track.mute=True
    for o in list(joints.values()):bpy.data.objects.remove(o,do_unlink=True)
    for t in rig.animation_data.nla_tracks:t.mute=False
    scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(path))
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'game-assets'/'models'/f'{species}.glb'),export_format='GLB',export_animation_mode='NLA_TRACKS',export_animations=True,export_frame_range=False,export_image_format='WEBP',export_image_quality=86)
    print('REFINED_SKIN',species,len(skin.data.vertices),flush=True)
