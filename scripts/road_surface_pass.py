"""Author tiling aggregate, cracks and wetness maps inside Blender, then pack each road module."""
import bpy, numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SIZE=2048
rng=np.random.default_rng(519)

def field(cells):
    grid=rng.random((cells,cells)).astype(np.float32)
    pos=np.arange(SIZE,dtype=np.float32)*cells/SIZE
    index=pos.astype(int);fraction=pos-index;fraction=fraction*fraction*(3-2*fraction)
    a=grid[index[:,None]%cells,index[None,:]%cells]
    b=grid[(index[:,None]+1)%cells,index[None,:]%cells]
    c=grid[index[:,None]%cells,(index[None,:]+1)%cells]
    d=grid[(index[:,None]+1)%cells,(index[None,:]+1)%cells]
    return ((a*(1-fraction[:,None])+b*fraction[:,None])*(1-fraction[None,:])+(c*(1-fraction[:,None])+d*fraction[:,None])*fraction[None,:]).astype(np.float32)

grain=field(512);pebbles=field(220);weather=field(12);wet=field(5)
wet=np.clip((wet-.30)*2.1,0,1)
cracks=np.zeros((SIZE,SIZE),dtype=np.float32)
# Meandering narrow fractures, drawn with local bounds so no source texture is downloaded.
for _ in range(7):
    x,y=rng.uniform(100,SIZE-100,2);angle=rng.uniform(0,np.pi*2)
    for step in range(28):
        angle+=rng.uniform(-.35,.35);nx=x+np.cos(angle)*22;ny=y+np.sin(angle)*22
        x0=max(0,int(min(x,nx))-5);x1=min(SIZE,int(max(x,nx))+6)
        y0=max(0,int(min(y,ny))-5);y1=min(SIZE,int(max(y,ny))+6)
        if x1<=x0 or y1<=y0:break
        yy,xx=np.mgrid[y0:y1,x0:x1];dx=nx-x;dy=ny-y
        t=np.clip(((xx-x)*dx+(yy-y)*dy)/(dx*dx+dy*dy),0,1)
        distance=np.sqrt((xx-x-t*dx)**2+(yy-y-t*dy)**2)
        cracks[y0:y1,x0:x1]=np.maximum(cracks[y0:y1,x0:x1],np.clip(2.7-distance,0,1))
        x,y=nx,ny

albedo=np.clip(.115+.095*pebbles+.065*grain+.035*weather-.045*wet-.10*cracks,.045,.34)
height=.0017*grain+.0023*pebbles-.0014*cracks
dx=(np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))/(8/SIZE)
dy=(np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))/(8/SIZE)
norm=np.stack([-dx,-dy,np.ones_like(dx)],axis=-1);norm/=np.linalg.norm(norm,axis=-1,keepdims=True)
color=np.stack([albedo*.97,albedo,albedo*1.025],axis=-1)
rough=np.clip(.86-.64*wet+.09*(grain-.5),.19,.91)
maps={'Aggregate color':color,'Aggregate normal':norm*.5+.5,'Uneven wetness':np.repeat(rough[:,:,None],3,axis=2)}

for name in ['road-straight-12m','road-junction-12m']:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets'/f'{name}.blend'))
    mat=bpy.data.materials.get('road');nodes=mat.node_tree.nodes;links=mat.node_tree.links
    bsdf=nodes.get('Principled BSDF')
    for node in list(nodes):
        if node.type not in ['BSDF_PRINCIPLED','OUTPUT_MATERIAL']:nodes.remove(node)
    for label,pixels in maps.items():
        im=bpy.data.images.new(label,width=SIZE,height=SIZE,alpha=False)
        if label!='Aggregate color':im.colorspace_settings.name='Non-Color'
        rgba=np.concatenate([pixels,np.ones((SIZE,SIZE,1),dtype=np.float32)],axis=-1)
        im.pixels.foreach_set(rgba.astype(np.float32).ravel());im.pack()
        node=nodes.new('ShaderNodeTexImage');node.image=im;node.label=label
        if label=='Aggregate normal':
            normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=1
            links.new(node.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
        else:links.new(node.outputs['Color'],bsdf.inputs['Base Color' if label=='Aggregate color' else 'Roughness'])
    bsdf.inputs['Metallic'].default_value=0
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH' and obj.data.uv_layers and obj.data.materials and obj.data.materials[0]==mat:
            for poly in obj.data.polygons:
                for li in poly.loop_indices:
                    v=obj.matrix_world@obj.data.vertices[obj.data.loops[li].vertex_index].co
                    obj.data.uv_layers.active.data[li].uv=(v.x/4,v.y/4)
    bpy.data.orphans_purge(do_recursive=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets'/f'{name}.blend'),compress=True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'game-assets/models'/f'{name}.glb'),export_format='GLB',export_image_format='WEBP',export_image_quality=95,export_animations=False)
    print('ROAD_SURFACE_COMPLETE',name,flush=True)
