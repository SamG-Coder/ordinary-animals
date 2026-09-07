"""Bake species-specific fur markings and fine fibre normals in Blender.
Every result is packed into its individual editable .blend and GLB export.
"""
import bpy,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
palettes={
 'cat':((.075,.070,.060),(.155,.145,.12)),
 'dog':((.075,.045,.022),(.29,.17,.075)),
 'hamster':((.19,.115,.046),(.51,.38,.22)),
 'rat':((.045,.037,.031),(.15,.125,.095)),
 'fox':((.19,.051,.014),(.47,.20,.059)),
 'rabbit':((.24,.22,.185),(.54,.51,.43)),
 'raccoon':((.065,.061,.053),(.24,.22,.18)),
 'goat':((.22,.20,.17),(.47,.44,.38)),
}
requested=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'all'
for name in palettes if requested=='all' else [requested]:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets'/f'{name}.blend'))
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=4
 skin=next(o for o in scene.objects if o.name.startswith('Continuous anatomical skin'))
 rig=next(o for o in scene.objects if o.type=='ARMATURE');rig.data.pose_position='REST'
 mat=bpy.data.materials.new(name+' baked coat');mat.use_nodes=True
 skin.data.materials.clear();skin.data.materials.append(mat)
 n=mat.node_tree.nodes;l=mat.node_tree.links;p=n.get('Principled BSDF')
 coord=n.new('ShaderNodeTexCoord');noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=5;noise.inputs['Detail'].default_value=4
 l.new(coord.outputs['Generated'],noise.inputs['Vector'])
 shade=n.new('ShaderNodeValToRGB');shade.color_ramp.elements[0].color=(*palettes[name][0],1);shade.color_ramp.elements[1].color=(*palettes[name][1],1)
 if name=='cat':
  stripes=n.new('ShaderNodeTexWave');stripes.wave_type='BANDS';stripes.bands_direction='Y';stripes.inputs['Scale'].default_value=3;stripes.inputs['Distortion'].default_value=2;stripes.inputs['Detail Scale'].default_value=2
  l.new(coord.outputs['Generated'],stripes.inputs['Vector']);l.new(stripes.outputs['Fac'],shade.inputs[0])
 else:l.new(noise.outputs['Fac'],shade.inputs[0])
 sep=n.new('ShaderNodeSeparateXYZ');l.new(coord.outputs['Generated'],sep.inputs[0])
 belly=n.new('ShaderNodeValToRGB');belly.color_ramp.elements[0].position=.28;belly.color_ramp.elements[0].color=(.55,.55,.55,1);belly.color_ramp.elements[1].position=.63;belly.color_ramp.elements[1].color=(0,0,0,1);l.new(sep.outputs['Z'],belly.inputs[0])
 mix=n.new('ShaderNodeMixRGB');l.new(belly.outputs[0],mix.inputs[0]);l.new(shade.outputs[0],mix.inputs[1]);mix.inputs[2].default_value=(.50,.45,.35,1);l.new(mix.outputs[0],p.inputs['Base Color'])
 fine=n.new('ShaderNodeTexNoise');fine.inputs['Scale'].default_value=240;fine.inputs['Detail'].default_value=2;l.new(coord.outputs['Generated'],fine.inputs['Vector'])
 bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.30;bump.inputs['Distance'].default_value=.004;l.new(fine.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs[0],p.inputs['Normal']);p.inputs['Roughness'].default_value=.91
 bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);bpy.context.view_layer.objects.active=skin
 images=[]
 folder=ROOT/'assets'/'textures';folder.mkdir(exist_ok=True)
 for channel in ['color','normal']:
  im=bpy.data.images.new(f'{name}_coat_{channel}',width=1024,height=1024,alpha=False)
  if channel=='normal':im.colorspace_settings.name='Non-Color'
  node=n.new('ShaderNodeTexImage');node.image=im;n.active=node;node.select=True
  if channel=='color':bpy.ops.object.bake(type='DIFFUSE',pass_filter={'COLOR'},margin=12)
  else:bpy.ops.object.bake(type='NORMAL',margin=12)
  im.filepath_raw=str(folder/f'{name}_{channel}.png');im.file_format='PNG';im.save();im.pack();images.append((node,im))
 l.new(images[0][0].outputs['Color'],p.inputs['Base Color'])
 normal=n.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.7;l.new(images[1][0].outputs['Color'],normal.inputs['Color']);l.new(normal.outputs[0],p.inputs['Normal'])
 rig.data.pose_position='POSE';scene.frame_set(1)
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets'/f'{name}.blend'))
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'game-assets'/'models'/f'{name}.glb'),export_format='GLB',export_image_format='WEBP',export_image_quality=90,export_animation_mode='NLA_TRACKS',export_animations=True,export_frame_range=False)
 print('BAKED_COAT_COMPLETE',name,flush=True)
