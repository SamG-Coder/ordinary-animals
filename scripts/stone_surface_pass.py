"""Pack an original weathered stone material into the independent boundary-wall Blender asset."""
import bpy,ast,numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];SIZE=1024;rng=np.random.default_rng(779)
tree=ast.parse((ROOT/'scripts/road_surface_pass.py').read_text());exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='field'],type_ignores=[]),'Noise authoring','exec'))
fine=field(220);coarse=field(12);medium=field(65)
value=.34+.13*coarse+.07*fine+.04*medium
color=np.stack([value*.97,value,value*.93],axis=-1)
height=.0004*fine+.0012*medium+.0015*coarse
normal=np.stack([-(np.roll(height,-1,1)-np.roll(height,1,1))/(.8/SIZE),-(np.roll(height,-1,0)-np.roll(height,1,0))/(.5/SIZE),np.ones_like(height)],axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/stone-wall-4m.blend'))
mat=bpy.data.materials['stone'];nodes=mat.node_tree.nodes;links=mat.node_tree.links;bsdf=nodes.get('Principled BSDF')
for n in list(nodes):
 if n.type not in ['BSDF_PRINCIPLED','OUTPUT_MATERIAL']:nodes.remove(n)
for label,pixels in [('Weathered stone',color),('Stone normal',normal*.5+.5)]:
 im=bpy.data.images.new(label,width=SIZE,height=SIZE,alpha=False)
 if label=='Stone normal':im.colorspace_settings.name='Non-Color'
 im.pixels.foreach_set(np.concatenate([pixels,np.ones((SIZE,SIZE,1),dtype=np.float32)],axis=-1).astype(np.float32).ravel());im.pack()
 n=nodes.new('ShaderNodeTexImage');n.image=im
 if label=='Stone normal':
  conv=nodes.new('ShaderNodeNormalMap');links.new(n.outputs['Color'],conv.inputs['Color']);links.new(conv.outputs['Normal'],bsdf.inputs['Normal'])
 else:links.new(n.outputs['Color'],bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value=.91
for o in bpy.context.scene.objects:
 if o.type!='MESH' or not o.data.uv_layers:continue
 for p in o.data.polygons:
  for li in p.loop_indices:
   v=o.matrix_world@o.data.vertices[o.data.loops[li].vertex_index].co
   if abs(p.normal.z)>.5:uv=(v.x/.4,v.y/.4)
   elif abs(p.normal.x)>.5:uv=(v.y/.4,v.z/.25)
   else:uv=(v.x/.4,v.z/.25)
   o.data.uv_layers.active.data[li].uv=uv
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/stone-wall-4m.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'game-assets/models/stone-wall-4m.glb'),export_format='GLB',export_image_format='WEBP',export_image_quality=93,export_animations=False)
print('STONE_SURFACE_COMPLETE')
