"""Blender ground materials and individual verge assets; no world layout is generated here."""
import bpy,ast,math,random,json,numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];MODELS=ROOT/'game-assets/models';SIZE=2048;rng=np.random.default_rng(331)
catalog=json.loads((ROOT/'game-assets/asset-catalog.json').read_text())
for file,names in [('road_surface_pass.py',{'field'}),('author_blender.py',{'begin','link','empty','cube','cone','tube','text','plane_mesh','ellipsoid','material'}),('detail_assets.py',{'setup'}),('opening_art_pass.py',{'finish'})]:
 tree=ast.parse((ROOT/'scripts'/file).read_text());exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),'Blender ground helpers','exec'))
grain=field(512);stones=field(190);moss=field(9);wet=field(5)
base=.125+.085*grain+.075*stones
color=np.stack([base*(1.0-.23*moss),base*(.80+.22*moss),base*.58],axis=-1)
height=.0015*grain+.0035*stones
normal=np.stack([-(np.roll(height,-1,1)-np.roll(height,1,1))/(10/SIZE),-(np.roll(height,-1,0)-np.roll(height,1,0))/(10/SIZE),np.ones_like(height)],axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
rough=np.clip(.96-.45*wet,.42,.96)
maps={'Soil and moss':color,'Fine ground relief':normal*.5+.5,'Ground wetness':np.repeat(rough[:,:,None],3,axis=2)}
for name in ['ground-tile-40m','ground-mound-40m']:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets'/f'{name}.blend'))
 mat=bpy.data.materials['ground'];nodes=mat.node_tree.nodes;links=mat.node_tree.links;bsdf=nodes.get('Principled BSDF')
 for n in list(nodes):
  if n.type not in ['BSDF_PRINCIPLED','OUTPUT_MATERIAL']:nodes.remove(n)
 for label,pixels in maps.items():
  im=bpy.data.images.new(label,width=SIZE,height=SIZE,alpha=False)
  if label!='Soil and moss':im.colorspace_settings.name='Non-Color'
  im.pixels.foreach_set(np.concatenate([pixels,np.ones((SIZE,SIZE,1),dtype=np.float32)],axis=-1).astype(np.float32).ravel());im.pack()
  n=nodes.new('ShaderNodeTexImage');n.image=im
  if label=='Fine ground relief':
   conv=nodes.new('ShaderNodeNormalMap');links.new(n.outputs['Color'],conv.inputs['Color']);links.new(conv.outputs['Normal'],bsdf.inputs['Normal'])
  else:links.new(n.outputs['Color'],bsdf.inputs['Base Color' if label=='Soil and moss' else 'Roughness'])
 bpy.data.orphans_purge(do_recursive=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets'/f'{name}.blend'),compress=True)
 bpy.ops.export_scene.gltf(filepath=str(MODELS/f'{name}.glb'),export_format='GLB',export_image_format='WEBP',export_image_quality=92,export_animations=False)
 print('GROUND_SURFACE',name,flush=True)
random.seed(317)
def grass(name,count,extent,height,animated):
 r=setup(name)
 for id,color in [('Wet grass',(.052,.076,.021)),('Dry grass',(.12,.112,.048)),('Deep grass',(.026,.047,.020))]:material(id,color,.87)
 verts=[];faces=[];indices=[]
 for i in range(count):
  x=random.uniform(-extent[0],extent[0]);y=random.uniform(-extent[1],extent[1]);a=random.random()*math.tau;h=random.uniform(height[0],height[1]);width=random.uniform(.004,.012);lean=random.uniform(.05,.18);idx=len(verts)
  for t in [0,.5,1]:
   for side in [-1,1]:
    w=width*(1-t)*side;verts.append((x+math.sin(a)*lean*t*t+math.cos(a)*w,y+math.cos(a)*lean*t*t-math.sin(a)*w,h*t))
  faces.extend([(idx,idx+1,idx+3,idx+2),(idx+2,idx+3,idx+5,idx+4),(idx+2,idx+3,idx+1,idx),(idx+4,idx+5,idx+3,idx+2)]);indices.extend([i%3]*4)
 o=plane_mesh('Bent grass blades',verts,faces,'Wet grass',r)
 o.data.materials.append(M['Dry grass']);o.data.materials.append(M['Deep grass'])
 for p,idx in zip(o.data.polygons,indices):p.material_index=idx
 if animated:
  o.shape_key_add(name='Basis');key=o.shape_key_add(name='Wind')
  for v in key.data:v.co.x+=.035*math.sin(v.co.y*4+v.co.x*2)*(v.co.z/height[1])**2
  for frame,value in [(1,0),(45,1),(90,0)]:key.value=value;key.keyframe_insert(data_path='value',frame=frame)
 finish(name,animated)
grass('grass-clump',75,(.3,.25),(.08,.36),False)
grass('verge-grass-2m',420,(1.2,.6),(.08,.28),True)
r=setup('roadside-gravel-2m')
for id,color in [('Chalk stone',(.22,.22,.18)),('Brown flint',(.095,.079,.059)),('Grey grit',(.12,.13,.115))]:material(id,color,.82)
for i in range(100):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(random.uniform(-1.25,1.25),random.uniform(-.45,.45),.002))
 o=link(bpy.context.object,'Loose gravel',['Chalk stone','Brown flint','Grey grit'][i%3],r);s=random.uniform(.008,.035);o.scale=(s,s*random.uniform(.6,1.3),s*.42);o.rotation_euler[2]=random.random()*math.tau
finish('roadside-gravel-2m')
# Reduce the orange, oversized appearance of the existing leaf scatter without changing its module footprint.
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/fallen-leaves.blend'))
for mat in bpy.data.materials:
 if mat.users and mat.name=='leaf-ochre':mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.115,.069,.023,1)
for o in bpy.context.scene.objects:
 if o.type=='MESH' and not o.get('verge_refined'):
  o['verge_refined']=True
  center=sum((v.co for v in o.data.vertices),Vector())/len(o.data.vertices)
  for v in o.data.vertices:v.co=center+(v.co-center)*.70
finish('fallen-leaves')
(ROOT/'game-assets/asset-catalog.json').write_text(json.dumps(catalog,indent=2));print('VERGE_ART_COMPLETE',len(catalog),flush=True)
