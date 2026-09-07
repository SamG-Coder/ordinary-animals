"""Author the overcast dawn environment in Blender and render its HDR panorama."""
import bpy,math,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8
scene.render.resolution_x=1536;scene.render.resolution_y=768;scene.render.resolution_percentage=100
world=bpy.data.worlds.new('Overcast Wickmere dawn');world.use_nodes=True;scene.world=world
n=world.node_tree.nodes;l=world.node_tree.links;n.clear()
out=n.new('ShaderNodeOutputWorld');bg=n.new('ShaderNodeBackground');l.new(bg.outputs[0],out.inputs[0])
coord=n.new('ShaderNodeTexCoord');sep=n.new('ShaderNodeSeparateXYZ');l.new(coord.outputs['Normal'],sep.inputs[0])
ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=0;ramp.color_ramp.elements[0].color=(.055,.079,.095,1)
ramp.color_ramp.elements[1].position=1;ramp.color_ramp.elements[1].color=(.008,.018,.037,1)
l.new(sep.outputs['Z'],ramp.inputs[0])
noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=3.6;noise.inputs['Detail'].default_value=5;noise.inputs['Roughness'].default_value=.72
l.new(coord.outputs['Normal'],noise.inputs['Vector'])
cloud=n.new('ShaderNodeValToRGB');cloud.color_ramp.elements[0].position=.30;cloud.color_ramp.elements[0].color=(.035,.045,.06,1)
cloud.color_ramp.elements[1].position=.70;cloud.color_ramp.elements[1].color=(.10,.135,.16,1)
l.new(noise.outputs['Fac'],cloud.inputs[0])
mix=n.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.7;l.new(ramp.outputs[0],mix.inputs[1]);l.new(cloud.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],bg.inputs[0]);bg.inputs[1].default_value=2
camera=bpy.data.cameras.new('Panoramic environment camera');camera.type='PANO';camera.panorama_type='EQUIRECTANGULAR'
obj=bpy.data.objects.new('Panoramic environment camera',camera);scene.collection.objects.link(obj);obj.rotation_euler=(math.pi/2,0,0);scene.camera=obj
folder=ROOT/'game-assets'/'lighting';folder.mkdir(exist_ok=True)
scene.render.image_settings.file_format='HDR';scene.render.filepath=str(folder/'dawn.hdr')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets'/'dawn-sky.blend'))
bpy.ops.render.render(write_still=True)
(ROOT/'game-assets'/'world-lighting.json').write_text(json.dumps({'environment':'lighting/dawn.hdr','source':'assets/dawn-sky.blend'},indent=2))
print('BLENDER_SKY_COMPLETE')
