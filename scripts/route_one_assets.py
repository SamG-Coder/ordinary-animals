"""A reusable roadside kit and an individual first-district school asset, authored in Blender."""
import bpy,ast,math,random,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];MODELS=ROOT/'game-assets/models'
catalog=json.loads((ROOT/'game-assets/asset-catalog.json').read_text());random.seed(1908)
for file,names in [('author_blender.py',{'begin','link','empty','cube','cone','tube','text','plane_mesh','ellipsoid','material'}),('detail_assets.py',{'setup'}),('opening_art_pass.py',{'finish'})]:
 tree=ast.parse((ROOT/'scripts'/file).read_text());exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),'Blender asset helpers','exec'))
def extra_materials():
 material('bark',(.075,.062,.043),.94);material('leaf',(.026,.050,.021),.96);material('mortar',(.13,.14,.12),.94);material('stone',(.21,.23,.20),.95);material('brick',(.16,.077,.041),.92)

r=setup('stone-wall-4m');extra_materials()
for row in range(5):
 for i in range(9):
  x=-1.78+i*.445+(row%2)*.04;z=.12+row*.225
  o=cube('Fieldstone',(x,random.uniform(-.035,.035),z),(.42+random.uniform(-.04,.02),.39+random.uniform(-.04,.03),.21),'stone',.035,r);o.rotation_euler=(random.uniform(-.04,.04),random.uniform(-.04,.04),random.uniform(-.035,.035))
finish('stone-wall-4m');catalog['stone-wall-4m']['colliders']=[{'x':0,'z':0,'w':4,'d':.45}]

r=setup('bramble-patch');extra_materials();verts=[];faces=[]
for i in range(28):
 x=random.uniform(-.8,.8);y=random.uniform(-.6,.6);h=random.uniform(.35,1.05)
 tube('Bramble stem',[(x,y,0),(x+.10,y+.03,h*.5),(x+.24,y+.13,h)],.004,'bark',r)
 for j in range(5):
  z=h*(.3+j*.13);a=random.random()*math.tau;s=random.uniform(.07,.12);cx=x+.24*z/h;cy=y+.13*z/h
  index=len(verts);verts.extend([(cx,cy,z),(cx+math.cos(a)*s,cy+math.sin(a)*s,z+.045),(cx+math.cos(a+.4)*s*1.7,cy+math.sin(a+.4)*s*1.7,z+.018),(cx+math.cos(a+.9)*s,cy+math.sin(a+.9)*s,z-.018)]);faces.extend([(index,index+1,index+2),(index,index+2,index+3)])
plane_mesh('Leaves',verts,faces,'leaf',r);finish('bramble-patch')

r=setup('route-sign')
for x in [-.6,.6]:cube('Signpost',(x,0,1.15),(.055,.08,2.3),'steel',.004,r)
cube('Direction board',(0,0,1.95),(2,.08,.82),'council-green',.014,r)
text('Route','OLD SCHOOL ROAD',(0,-.05,2.16),.135,'paper',parent=r)
text('Distance','WICKMERE SCHOOL  120 m',(0,-.051,1.92),.095,'paper',parent=r)
text('Warning','LEAGUE INTAKE / FOLLOW THE ROAD',(0,-.051,1.69),.052,'paper',parent=r)
finish('route-sign')

r=setup('pedestrian-crossing')
for i in range(9):cube('Painted stripe',(-3.5+i*.875,0,.044),(.43,2.8,.003),'paper',0,r)
finish('pedestrian-crossing')

r=setup('crossing-beacon');material('amber',(1,.36,.04),.4,emission=2.2)
for i in range(8):cone('Pole section',(0,0,.20+i*.40),.05,.05,.4,'black' if i%2 else 'ivory',r,12)
ellipsoid('Amber globe',(0,0,3.33),(.16,.16,.16),'amber',r)
cone('Cap',(0,0,3.49),.17,.12,.05,'black',r)
finish('crossing-beacon')

r=setup('bus-shelter')
for x in [-1.45,1.45]:
 for y in [-.60,.60]:cube('Steel frame',(x,y,1.2),(.065,.065,2.4),'steel',.005,r)
cube('Shelter roof',(0,0,2.43),(3.12,1.48,.09),'council-green',.022,r)
for x in [-1.45,1.45]:cube('Side panel',(x,.02,1.34),(.018,1.10,1.7),'council-green',.005,r)
cube('Back panel',(0,.60,1.34),(2.85,.02,1.7),'council-green',.005,r)
for y in [-.14,0,.14]:cube('Bench slat',(0,y,.48),(2.40,.115,.044),'oak',.009,r)
for x in [-.95,.95]:cube('Bench foot',(x,0,.24),(.06,.30,.48),'steel',.006,r)
cube('Timetable',(1.42,-.15,1.55),(.01,.34,.49),'paper',.001,r)
text('Shelter title','COUNTY SCHOOL SERVICE',(0,-.744,2.39),.085,'paper',parent=r)
finish('bus-shelter');catalog['bus-shelter']['colliders']=[{'x':0,'z':-.60,'w':3,'d':.08},{'x':-1.45,'z':0,'w':.08,'d':1.3},{'x':1.45,'z':0,'w':.08,'d':1.3}]

r=setup('oak-tree');extra_materials()
cone('Trunk',(0,0,2.7),.28,.11,5.4,'bark',r,16)
ends=[]
for i in range(9):
 a=i*2.399;z=3+i*.36;end=Vector((math.cos(a)*(2.1 if i<6 else 1.3),math.sin(a)*(2.1 if i<6 else 1.3),z+1.7));ends.append(end)
 tube('Main branch',[(0,0,z),tuple(end*.48+Vector((0,0,z*.52))),tuple(end)],.055 if i<5 else .035,'bark',r)
 for j in range(3):
  off=Vector((math.cos(a+j*.7)*.75,math.sin(a+j*.7)*.75,.65));tube('Twig',[tuple(end*.7+Vector((0,0,z*.3))),tuple(end+off)],.014,'bark',r)
verts=[];faces=[]
for i in range(2400):
 center=ends[i%len(ends)];a=random.random()*math.tau;u=random.uniform(-1,1);rad=random.random()**(1/3)*1.35;p=center+Vector((math.cos(a)*math.sqrt(1-u*u)*rad,math.sin(a)*math.sqrt(1-u*u)*rad,u*rad*.7));s=random.uniform(.16,.30);index=len(verts)
 theta=random.random()*math.tau;tilt=random.uniform(-1.2,1.2);uvec=Vector((math.cos(theta),math.sin(theta),math.sin(tilt)))*s;vvec=Vector((-math.sin(theta),math.cos(theta),math.cos(tilt)))*s*.48
 verts.extend([tuple(p-uvec),tuple(p+vvec),tuple(p+uvec),tuple(p-vvec)]);faces.extend([(index,index+1,index+2),(index,index+2,index+3),(index+2,index+1,index),(index+3,index+2,index)])
leaf=plane_mesh('Wind in canopy',verts,faces,'leaf',r);leaf.shape_key_add(name='Basis');key=leaf.shape_key_add(name='Breeze')
for v in key.data:v.co.x+=.09*math.sin(v.co.z*1.7+v.co.y)*max(0,(v.co.z-3)/4)
for frame,value in [(1,0),(45,1),(90,0)]:key.value=value;key.keyframe_insert(data_path='value',frame=frame)
# Consolidate woody pieces into one draw call while preserving the animated foliage mesh.
bpy.ops.object.select_all(action='DESELECT')
wood=[o for o in bpy.context.scene.objects if o.type in ['MESH','CURVE'] and o!=leaf]
for o in wood:o.select_set(True)
bpy.context.view_layer.objects.active=wood[0];bpy.ops.object.convert(target='MESH');bpy.ops.object.join();bpy.context.object.name='Trunk and branches'
finish('oak-tree',True);catalog['oak-tree']['colliders']=[{'x':0,'z':0,'w':.5,'d':.5}]

r=setup('county-school');extra_materials()
cube('School brickwork',(0,0,3.1),(14,12,6.2),'brick',.014,r)
for side in [-1,1]:
 roof=cube('Slate roof',(side*3.5,0,7.12),(7.7,12.55,.16),'council-green',.01,r);roof.rotation_euler[1]=side*math.radians(24)
cube('Stone plinth',(0,-6.04,.29),(14,.20,.58),'stone',.01,r)
cube('Storey course',(0,-6.07,3.3),(14,.16,.16),'stone',.007,r)
for level in range(2):
 for x in [-5.25,-3.15,3.15,5.25]:
  z=1.94+level*2.9
  cube('Window reveal',(x,-6.045,z),(1.4,.12,1.9),'stone',.012,r)
  cube('Dark school window',(x,-6.116,z),(1.24,.03,1.72),'black',.005,r)
  for dx in [-.60,0,.60]:cube('Window mullion',(x+dx,-6.15,z),(.035,.028,1.75),'ivory',.002,r)
  for dz in [-.84,0,.84]:cube('Window transom',(x,-6.15,z+dz),(1.25,.026,.035),'ivory',.002,r)
  cube('Window sill',(x,-6.20,z-.96),(1.55,.37,.10),'stone',.008,r)
cube('Entrance surround',(0,-6.14,1.57),(2.7,.30,3.14),'stone',.012,r)
for x in [-.56,.56]:
 cube('School door',(x,-6.31,1.37),(1.08,.04,2.7),'council-green',.012,r)
 cube('Door glazing',(x,-6.34,1.90),(.72,.02,1.1),'black',.005,r)
 cube('Push plate',(x,-6.36,1.02),(.07,.02,.38),'steel',.006,r)
text('School name','WICKMERE COUNTY SCHOOL',(0,-6.19,3.65),.30,'paper',parent=r)
text('School motto','PREPARING CHILDREN FOR THE OUTSIDE WORLD',(0,-6.2,3.38),.095,'paper',parent=r)
cube('League plaque',(2,-6.18,1.49),(.60,.05,.72),'council-green',.008,r)
text('League designation','LEAGUE 01',(2,-6.212,1.66),.070,'paper',parent=r)
text('School closed','NO CLASSES',(2,-6.212,1.42),.054,'paper',parent=r)
# Brick courses are modeled on the entrance facade; scale is measured in metres.
for row in range(51):
 z=.08+row*.12
 for col in range(51):
  x=-6.9+col*.275+(row%2)*.135
  if abs(x)<1.45 and z<3.3:continue
  if any(abs(x-wx)<.79 and abs(z-(1.94+level*2.9))<1.04 for wx in [-5.25,-3.15,3.15,5.25] for level in range(2)):continue
  cube('Recessed mortar',(x,-6.009,z),(.26,.004,.003),'mortar',0,r)
finish('county-school');catalog['county-school']['colliders']=[{'x':0,'z':0,'w':14,'d':12}]
(ROOT/'game-assets/asset-catalog.json').write_text(json.dumps(catalog,indent=2))
print('ROUTE_ONE_ASSETS_COMPLETE',len(catalog))
