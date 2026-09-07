"""Author the interface paper surface in Blender and pack its editable material source."""
import bpy,numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];SIZE=1024
bpy.ops.wm.read_factory_settings(use_empty=True)
rng=np.random.default_rng(177);y,x=np.mgrid[0:SIZE,0:SIZE]
grain=rng.random((SIZE,SIZE));fibre=rng.random((SIZE,1))
shade=.88+.035*grain+.012*fibre+.015*np.sin(x*.027+np.sin(y*.007)*2)*np.sin(y*.012)
for cx,cy,radius in [(180,730,230),(850,150,210),(540,540,340)]:
 shade-=.025*np.exp(-((x-cx)**2+(y-cy)**2)/(radius*radius))
rgba=np.stack([shade,shade*.984,shade*.93,np.ones_like(shade)],axis=-1).astype(np.float32)
im=bpy.data.images.new('Worn county stationery',width=SIZE,height=SIZE,alpha=False);im.pixels.foreach_set(rgba.ravel())
folder=ROOT/'src/ui';folder.mkdir(exist_ok=True);im.filepath_raw=str(folder/'field-paper.png');im.file_format='PNG';im.save();im.pack()
bpy.ops.mesh.primitive_plane_add(size=2);plane=bpy.context.object;plane.name='Editable paper surface'
mat=bpy.data.materials.new('County stationery');mat.use_nodes=True;plane.data.materials.append(mat)
node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=im
mat.node_tree.links.new(node.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.96
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/field-paper.blend'),compress=True)
print('FIELD_PAPER_AUTHORED')
