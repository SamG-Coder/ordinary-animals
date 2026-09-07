import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets'/'ordinary-animals.blend'))
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.resolution_x=400
scene.render.resolution_y=400
scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.8,.86,1,1)
scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.65
scene.view_settings.view_transform='AgX'
bpy.ops.object.camera_add(location=(2.6,-4.5,2.2))
cam=bpy.context.object; cam.rotation_euler=(Vector((0,0,.65))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=1.95
scene.camera=cam
bpy.ops.object.light_add(type='AREA',location=(-3,-4,6))
bpy.context.object.data.energy=420; bpy.context.object.data.shape='DISK'; bpy.context.object.data.size=4
for col in list(bpy.data.collections):
    if col.name!='Collection': col.hide_render=True
out=ROOT/'public'/'portraits'; out.mkdir(exist_ok=True)
for name in ['cat','dog','hamster','pigeon','raccoon','rabbit','fox','tortoise','duck','sheep','goat']:
    col=bpy.data.collections[name]; col.hide_render=False
    root=bpy.data.objects[name]; original=root.location.copy(); root.location=(0,0,0)
    scene.render.filepath=str(out/f'{name}.png')
    bpy.ops.render.render(write_still=True)
    root.location=original; col.hide_render=True
print('PORTRAITS_COMPLETE')
