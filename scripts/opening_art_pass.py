"""Incremental opening-room and street asset work. No region geometry is authored here."""
import bpy,ast,math,random,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];MODELS=ROOT/'game-assets'/'models'
catalog=json.loads((ROOT/'game-assets'/'asset-catalog.json').read_text())
tree=ast.parse((ROOT/'scripts'/'author_blender.py').read_text())
helpers={'begin','link','empty','cube','cone','tube','text','plane_mesh','ellipsoid','material'}
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in helpers],type_ignores=[]),'Modeling helpers','exec'))
tree=ast.parse((ROOT/'scripts'/'detail_assets.py').read_text())
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='setup'],type_ignores=[]),'Material library','exec'))
random.seed(273)
def finish(name,animated=False):
 bpy.context.scene.frame_set(1);bpy.context.scene.frame_end=90
 bpy.data.orphans_purge(do_recursive=True)
 for im in bpy.data.images:
  if im.users and im.has_data:im.pack()
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets'/f'{name}.blend'),compress=True)
 bpy.ops.export_scene.gltf(filepath=str(MODELS/f'{name}.glb'),export_format='GLB',export_image_format='WEBP',export_image_quality=88,export_animations=animated,export_lights=True)
 catalog.setdefault(name,{'source':f'assets/{name}.blend','model':f'models/{name}.glb'})

r=setup('floor-4m')
cube('Subfloor',(0,0,-.065),(4,4,.08),'black',0,r)
for row in range(25):
 x=-2+(row+.5)*.16
 ends=sorted(set([-2,2]+[max(-2,min(2,-2+i*1.31+(row%3)*.43)) for i in range(5)]))
 for a,b in zip(ends,ends[1:]):
  if b-a<.03:continue
  board=cube('Worn oak plank',(x,(a+b)/2,-.021),(.157,b-a-.003,.042),'oak',.0015,r)
  for uv in board.data.uv_layers.active.data:uv.uv.x=uv.uv.x*.14+(row%6)*.166;uv.uv.y*=.7
finish('floor-4m')

r=setup('radiator')
material('aged-enamel',(.45,.43,.37),.48)
cube('Back panel',(0,.035,.40),(1.18,.09,.58),'aged-enamel',.02,r)
for i in range(17):cube('Pressed steel flute',(-.56+i*.07,-.023,.40),(.055,.10,.57),'aged-enamel',.019,r)
for x in [-.59,.59]:
 tube('Heating pipe',[(x,0,.12),(x,0,.05),(x,.14,.05),(x,.14,0)],.014,'steel',r)
 cone('Valve',(x,-.005,.14),.025,.025,.07,'steel',r)
cone('Thermostat',(.64,-.02,.14),.032,.032,.095,'ivory',r).rotation_euler[1]=math.pi/2
finish('radiator')

r=setup('socket')
cube('Bakelite socket',(0,0,0),(.145,.014,.085),'ivory',.007,r)
for x in [-.04,.04]:
 for dx,z in [(-.012,-.012),(.012,-.012),(0,.014)]:cube('Plug slot',(x+dx,-.01,z),(.006,.003,.015),'black',0,r)
for x in [-.062,.062]:cone('Screw',(x,-.01,0),.003,.003,.004,'steel',r).rotation_euler[0]=math.pi/2
finish('socket')

r=setup('books')
material('book-red',(.16,.041,.027),.9);material('book-green',(.036,.078,.063),.9)
for i,title in enumerate(['MATHS','SCIENCE','FIELD NOTES','ANIMALS','GEOGRAPHY','EXERCISES','SAFETY']):
 h=.25+random.random()*.07;x=i*.082
 cube('Pages',(x,0,h/2),(.057,.285,h-.012),'paper',.002,r)
 for dx in [-.033,.033]:cube('Cloth binding',(x+dx,0,h/2),(.006,.31,h),'book-red' if i%2 else 'book-green',.002,r)
 cube('Spine',(x,-.155,h/2),(.07,.01,h),'book-red' if i%2 else 'book-green',.003,r)
 text('Spine title',title,(x,-.162,h*.22),.016,'paper',(math.pi/2,0,math.pi/2),r)
 for z in [.025,h-.025]:cube('Spine rule',(x,-.162,z),(.055,.002,.004),'paper',0,r)
finish('books')

r=setup('storage-boxes')
material('cardboard',(.28,.205,.123),.94);material('tape',(.38,.30,.19),.55)
for i in range(3):
 box=empty('Packed box',(0,i*.55,0),r);box.rotation_euler[2]=[-.025,.012,-.035][i]
 cube('Corrugated cardboard',(0,0,.225),(.57,.47,.45),'cardboard',.004,box)
 for x in [-.143,.143]:cube('Top flap',(x,0,.453),(.279,.466,.004),'cardboard',.002,box)
 cube('Tape seam',(0,0,.458),(.065,.465,.002),'tape',0,box)
 for y in [-.236,.236]:cube('Tape end',(0,y,.39),(.065,.001,.13),'tape',0,box)
 cube('Inventory label',(.286,-.05,.29),(.002,.26,.12),'paper',.001,box)
 text('Inventory',['SCHOOL','WINTER','AGE 10'][i],(.289,-.05,.29),.029,'black',(math.pi/2,0,math.pi/2),box)
 for y in [-.09,-.055,-.02,.015,.05]:cube('Barcode',(.289,y,.257),(.003,.006,.025),'black',0,box)
finish('storage-boxes')

r=setup('hall-table')
cube('Tabletop',(0,0,.78),(1.0,.36,.06),'oak',.014,r)
for x in [-.42,.42]:
 for y in [-.12,.12]:cube('Tapered leg',(x,y,.38),(.037,.037,.76),'oak',.005,r)
cube('Drawer',(0,-.015,.675),(.88,.29,.14),'oak',.005,r)
cone('Drawer pull',(0,-.173,.68),.018,.018,.02,'steel',r).rotation_euler[0]=math.pi/2
for i in range(3):cube('Unopened bill',(-.23+i*.035,-.02,.814+i*.007),(.28,.18,.004),'paper',.001,r)
text('Overdue envelope','FINAL REMINDER',(-.17,-.025,.837),.021,'black',(0,0,0),r)
finish('hall-table')
catalog['hall-table']['colliders']=[{'x':0,'z':0,'w':1,'d':.36}]

r=setup('porch-canopy')
cube('Weathered porch roof',(0,0,2.56),(2.25,1.12,.09),'oak',.015,r)
for x in [-.94,.94]:
 cube('Corbel',(x,.36,2.34),(.09,.37,.40),'oak',.008,r)
 tube('Iron brace',[(x,.39,2.14),(x,-.36,2.52)],.018,'steel',r)
cube('Porch light',(0,.38,2.30),(.15,.12,.18),'lamp',.015,r)
finish('porch-canopy')

# Improve brick scale and append detail to each building's own editable source.
for name,w,d,h in [('terrace-house',8,7,6),('clinic-building',12,10,4.4),('league-building',14,12,5)]:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets'/f'{name}.blend'))
 current=next(c for c in bpy.data.collections if c.name==name);objects=list(current.objects);M={m.name:m for m in bpy.data.materials};r=next(o for o in current.objects if o.name==name)
 for obj in list(current.objects):
  if any(obj.name.startswith(prefix) for prefix in ['Stone window sill','Stone lintel','Window reveal','Chimney stack','Chimney crown','Chimney pot','Doorstep']):bpy.data.objects.remove(obj,do_unlink=True)
 for obj in current.objects:
  if obj.type=='MESH' and obj.data.uv_layers and obj.data.materials and obj.data.materials[0].name=='brick':
   for p in obj.data.polygons:
    for li in p.loop_indices:
     v=obj.matrix_world@obj.data.vertices[obj.data.loops[li].vertex_index].co
     obj.data.uv_layers.active.data[li].uv=((v.y if abs(p.normal.x)>.5 else v.x)/2,v.z/1.4)
 for level in range(2 if name=='terrace-house' else 1):
  for x in [-w*.3,w*.3]:
   z=1.9+level*2.7
   cube('Stone window sill',(x,-d/2-.19,z-.90),(1.67,.32,.095),'road',.013,r)
   cube('Stone lintel',(x,-d/2-.065,z+.9),(1.67,.15,.14),'road',.007,r)
   for offset in [-.78,.78]:cube('Window reveal',(x+offset,-d/2-.06,z),(.11,.12,1.79),'brick',.007,r)
 if name=='terrace-house':
  cube('Chimney stack',(-w*.26,1,h+.80),(.66,.70,1.70),'brick',.01,r)
  cube('Chimney crown',(-w*.26,1,h+1.67),(.79,.82,.13),'road',.01,r)
  for y in [.82,1.2]:cone('Chimney pot',(-w*.26,y,h+1.91),.115,.10,.4,'brick',r)
 cube('Doorstep',(0,-d/2-.32,.055),(1.65,.72,.11),'road',.01,r)
 finish(name)

# Restrained plaster variation; preserve the original baked Blender surface as a detail layer.
for name in ['wall-4m','wall-door-4m','wall-window-4m','ceiling-4m']:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets'/f'{name}.blend'))
 mat=bpy.data.materials.get('wall');nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF')
 if p.inputs['Base Color'].is_linked and not mat.get('opening_plaster_v1'):
  source=p.inputs['Base Color'].links[0].from_socket
  mix=nodes.new('ShaderNodeMixRGB');mix.inputs[0].default_value=.20;mix.inputs[1].default_value=(.30,.31,.285,1);links.new(source,mix.inputs[2]);links.new(mix.outputs[0],p.inputs['Base Color'])
 # Bake the blend into a Blender image because glTF doesn't export arbitrary shader graphs.
  original=next((n.image for n in nodes if n.type=='TEX_IMAGE' and n.image.colorspace_settings.name!='Non-Color'),None)
  if original:
   pixels=list(original.pixels);base=(.30,.31,.285)
   for i in range(0,len(pixels),4):
    for ch in range(3):pixels[i+ch]=pixels[i+ch]*.20+base[ch]*.80
   original.pixels.foreach_set(pixels);original.pack();tex=nodes.new('ShaderNodeTexImage');tex.image=original;links.new(tex.outputs[0],p.inputs['Base Color'])
   mat['opening_plaster_v1']=True
 finish(name)

bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets'/'desk-lamp.blend'))
for o in bpy.context.scene.objects:
 if o.type=='LIGHT' and 'bounce' not in o.name:
  o.data.type='SPOT';o.data.spot_size=1.85;o.data.spot_blend=.72;task=o
if not bpy.data.objects.get('Warm desk bounce'):
 data=bpy.data.lights.new('Warm desk bounce','POINT');data.energy=9;data.color=(1,.64,.33);data.shadow_soft_size=.25
 fill=bpy.data.objects.new('Warm desk bounce',data);bpy.context.scene.collection.objects.link(fill);fill.parent=task.parent;fill.location=task.location+Vector((0,0,.12))
finish('desk-lamp')
(ROOT/'game-assets'/'asset-catalog.json').write_text(json.dumps(catalog,indent=2))
print('OPENING_ART_PASS_COMPLETE',len(catalog),flush=True)
