"""Small, separately editable household assets; all cloth and ceramic geometry is Blender authored."""
import ast, bpy, json, math
import numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; MODELS=ROOT/'game-assets/models';catalog={}
for file,names in [('author_blender.py',{'begin','link','empty','cube','cone','tube','text','plane_mesh','ellipsoid','material'}),('detail_assets.py',{'setup'}),('opening_art_pass.py',{'finish'})]:
 tree=ast.parse((ROOT/'scripts'/file).read_text())
 exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),'Blender helpers','exec'))

def palette(name):
 r=setup(name)
 material('wool-olive',(.17,.18,.12),.94)
 material('wool-rust',(.23,.10,.06),.96)
 material('washed-linen',(.36,.35,.29),.93)
 material('coat-navy',(.032,.047,.061),.86)
 material('tea-ceramic',(.48,.45,.34),.24)
 material('cold-tea',(.052,.023,.009),.14)
 material('breakfast-card',(.31,.23,.12),.90)
 size=512;y,x=np.mgrid[0:size,0:size];rng=np.random.default_rng(730)
 weave=.56+.075*np.sin(x*math.pi/2)*np.sin(y*math.pi/2)+.025*rng.standard_normal((size,size))
 for name in ['wool-olive','wool-rust','washed-linen','coat-navy']:
  m=M[name];base=np.array(m.diffuse_color[:3]);rgba=np.ones((size,size,4),np.float32);rgba[:,:,:3]=base*(.85+weave[:,:,None]*.30)
  im=bpy.data.images.new(name+' woven fibers',size,size,alpha=False);im.pixels.foreach_set(rgba.ravel());im.pack()
  tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;m.node_tree.links.new(tex.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
 return r

def cloth(name,nx,ny,point,mat,parent):
 vertices=[point(i/nx,j/ny) for j in range(ny+1) for i in range(nx+1)]
 faces=[(j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i+1,(j+1)*(nx+1)+i) for j in range(ny) for i in range(nx)]
 o=plane_mesh(name,vertices,faces,mat,parent)
 for polygon in o.data.polygons:
  polygon.use_smooth=True
  for loop in polygon.loop_indices:
   index=o.data.loops[loop].vertex_index;o.data.uv_layers.active.data[loop].uv=((index%(nx+1))/nx,(index//(nx+1))/ny)
 thickness=o.modifiers.new('Fabric thickness','SOLIDIFY');thickness.thickness=.002
 return o

def save(name,animated=False):
 if animated:
  bpy.context.scene.frame_set(1)
  groups={}
  for obj in list(current.objects):
   if obj.type not in {'MESH','CURVE','FONT'} or obj.animation_data:continue
   anchor=obj.parent
   while anchor and anchor.parent and not anchor.animation_data:anchor=anchor.parent
   groups.setdefault((anchor,tuple(obj.data.materials)),[]).append(obj)
  for (anchor,mats),group in groups.items():
   bpy.ops.object.select_all(action='DESELECT')
   for obj in group:obj.select_set(True)
   bpy.context.view_layer.objects.active=group[0];bpy.ops.object.convert(target='MESH')
   if len(group)>1:bpy.ops.object.join()
   obj=bpy.context.object;matrix=obj.matrix_world.copy();obj.parent=anchor;obj.matrix_world=matrix
 finish(name,animated);catalog[name]['authoring']='scripts/author_domestic_details.py'

r=palette('gathered-curtains-2m')
tube('Wooden curtain pole',[(-1.17,0,2.70),(1.17,0,2.70)],.023,'oak',r)
for x in [-1.10,1.10]:
 ellipsoid('Turned pole finial',(x*1.11,0,2.70),(.055,.042,.042),'oak',r)
 tube('Pole bracket',[(x,.14,2.66),(x,0,2.66),(x,0,2.72)],.012,'steel',r)
for side in [-1,1]:
 panel=empty('Gathered curtain '+str(side),(0,0,0),r)
 def point(u,v):
  width=.54-.12*math.sin(v*math.pi)
  x=side*(.66+u*width)
  y=-.055-.055*math.sin(u*math.pi*8+.12*math.sin(v*6))-.018*v
  z=2.62-v*1.77+.025*math.sin(u*5*math.pi)*v**5
  return (x,y,z)
 cloth('Hanging woven linen',32,36,point,'washed-linen',panel)
 for u in np.linspace(.04,.96,9):
  x=side*(.66+float(u)*.54)
  tube('Curtain ring',[(x,math.cos(a)*.031,2.68+math.sin(a)*.031) for a in np.linspace(0,math.tau,13)],.003,'steel',r)
 for frame,angle in [(1,-.002*side),(45,.003*side),(90,-.002*side)]:
  panel.rotation_euler[0]=angle;panel.keyframe_insert('rotation_euler',frame=frame)
save('gathered-curtains-2m',True)

r=palette('sofa-wool-blanket')
def blanket(u,v):
 x=(u-.5)*.72
 y=(v-.5)*.82
 z=.035*math.sin(u*math.pi*7+.5*v)+.014*math.sin(v*17)
 if v>.63:z-=.40*((v-.63)/.37)**1.2
 return (x,y,z)
cloth('Blanket draped over sofa arm',40,40,blanket,'wool-olive',r)
for u in np.linspace(.02,.98,36):
 x,y,z=blanket(float(u),1)
 tube('Wool fringe',[(x,y,z),(x+.005,y+.025,z-.025),(x-.003,y+.043,z-.063)],.0025,'wool-olive',r)
save('sofa-wool-blanket')

r=palette('hall-coat-rack')
cube('Oak hook board',(0,.065,1.92),(1.22,.055,.14),'oak',.009,r)
for x in [-.47,-.16,.16,.47]:tube('Brass coat hook',[(x,.025,1.93),(x,-.025,1.91),(x,-.06,2.00)],.009,'steel',r)
for offset,mat,length in [(-.36,'coat-navy',1.10),(.35,'wool-rust',.76)]:
 def coat(u,v):
  width=.22+.065*math.sin(v*math.pi)
  x=offset+(u-.5)*width*2
  y=-.08-.046*math.sin(u*math.pi*5)-.055*math.sin(v*math.pi)
  return (x,y,1.94-v*length+.02*math.cos(u*9)*v)
 cloth('Work coat hanging from hook',28,34,coat,mat,r)
 for side in [-1,1]:
  sleeve=ellipsoid('Soft coat sleeve',(offset+side*.21,-.08,1.61),(.055,.065,.28),mat,r);sleeve.rotation_euler[1]=side*.13
 for z in [1.72,1.54,1.36]:
  if z>1.94-length:cone('Coat button',(offset,-.149,z),.013,.013,.006,'black',r,8).rotation_euler[0]=math.pi/2
save('hall-coat-rack')

def mug(root,x=0,y=0):
 # An open, thick-walled ceramic vessel; the dark tea is recessed below its rim.
 profile=[(.030,0),(.041,.008),(.045,.092),(.047,.101),(.040,.102),(.038,.091),(.034,.012),(.0,.012)]
 vertices=[]
 for radius,z in profile:
  for i in range(32):
   angle=i*math.tau/32;vertices.append((x+radius*math.cos(angle),y+radius*math.sin(angle),z))
 faces=[]
 for ring in range(len(profile)-1):
  for i in range(32):faces.append((ring*32+i,ring*32+(i+1)%32,(ring+1)*32+(i+1)%32,(ring+1)*32+i))
 o=plane_mesh('Chipped ceramic mug',vertices,faces,'tea-ceramic',root)
 for p in o.data.polygons:p.use_smooth=True
 tube('Mug handle',[(x+.042,y,.084),(x+.076,y,.083),(x+.081,y,.040),(x+.045,y,.030)],.009,'tea-ceramic',root)
 cone('Cold tea surface',(x,y,.078),.038,.038,.001,'cold-tea',root,40)
 for angle in [.25,.55]:
  cube('Small rim chip',(x+.044*math.cos(angle),y+.044*math.sin(angle),.10),(.009,.007,.003),'paper',0,root)

r=palette('unfinished-breakfast')
cube('Place mat',(0,0,.004),(.48,.33,.008),'wool-rust',.007,r)
mug(r,.12,.065)
cone('Breakfast plate',(-.10,-.015,.014),.113,.121,.014,'tea-ceramic',r,40)
cone('Plate inside',(-.10,-.015,.023),.090,.09,.003,'ivory',r,40)
for x,y in [(-.05,.03),(-.08,-.04),(-.15,.02),(-.14,-.07)]:cube('Leftover toast crumbs',(x,y,.03),(.018,.012,.007),'breakfast-card',.003,r)
tube('Teaspoon handle',[(.08,-.08,.017),(.18,-.12,.014)],.004,'steel',r)
ellipsoid('Spoon bowl',(.073,-.077,.018),(.020,.012,.004),'steel',r)
cube('Shift rota',(0,.17,.012),(.20,.10,.003),'paper',0,r)
text('Shift reminder','06:00 - 18:00',(0,.169,.015),.013,'black',(0,0,0),r)
save('unfinished-breakfast')

r=palette('bathroom-towel-rail')
for x in [-.29,.29]:tube('Rail mounting',[(x,.04,1.43),(x,-.075,1.43)],.014,'steel',r)
tube('Towel rail',[(-.30,-.075,1.43),(.30,-.075,1.43)],.014,'steel',r)
def towel(u,v):
 angle=v*math.pi
 x=(u-.5)*.45
 y=-.075-.04*math.sin(angle)-.025*math.sin(u*5*math.pi)*math.sin(angle)
 z=1.43-.62*math.sin(angle)+.008*math.cos(u*12)
 return(x,y,z)
cloth('Hand towel folded on rail',28,36,towel,'washed-linen',r)
save('bathroom-towel-rail')

r=palette('kitchen-pantry-tins')
for x,y,height,label in [(-.13,.03,.21,'TEA'),(.025,.03,.26,'COFFEE'),(.16,.035,.18,'SUGAR')]:
 cone('Old pantry tin',(x,y,height/2),.068,.068,height,'tea-ceramic',r,32)
 cone('Seated tin lid',(x,y,height+.004),.071,.071,.015,'steel',r,32)
 text('Tin label',label,(x,y-.069,height*.49),.021 if len(label)<6 else .016,'black',parent=r)
save('kitchen-pantry-tins')

(ROOT/'artifacts/domestic-details-catalog.json').write_text(json.dumps(catalog,indent=2))
print('DOMESTIC_DETAILS_SAVED',len(catalog),flush=True)
