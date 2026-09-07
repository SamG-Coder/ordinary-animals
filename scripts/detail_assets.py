"""An incremental Blender pass for street furniture and the opening room.
Each prop is saved independently; this script does not build the world.
"""
import bpy, ast, math, random, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
MODELS=ROOT/'game-assets'/'models'
catalog=json.loads((ROOT/'game-assets'/'asset-catalog.json').read_text())
source=ast.parse((ROOT/'scripts'/'author_blender.py').read_text())
helpers={'begin','link','empty','cube','cone','tube','text','plane_mesh','ellipsoid','material'}
exec(compile(ast.Module(body=[n for n in source.body if isinstance(n,ast.FunctionDef) and n.name in helpers],type_ignores=[]),'Blender modeling helpers','exec'))
random.seed(451)
def setup(name):
    global M,objects,current
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for asset in ['wall-4m','carrier','streetlamp','cat']:
        with bpy.data.libraries.load(str(ROOT/'assets'/f'{asset}.blend'),link=False) as (src,dst):
            dst.materials=[n for n in src.materials if not bpy.data.materials.get(n)]
    M={m.name:m for m in bpy.data.materials}
    material('paper',(.58,.55,.43),.95)
    material('council-green',(.045,.075,.061),.7)
    material('rust',(.13,.064,.030),.95)
    material('wet',(.018,.025,.028),.14,metal=.35)
    material('leaf-ochre',(.18,.094,.026),.92)
    return begin(name)
def finish(name,colliders=None,animated=False):
    bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=90
    bpy.context.scene.frame_set(1)
    for im in bpy.data.images:
        if im.has_data:im.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets'/f'{name}.blend'))
    bpy.ops.export_scene.gltf(filepath=str(MODELS/f'{name}.glb'),export_format='GLB',export_image_format='WEBP',export_image_quality=86,export_animations=animated)
    catalog[name]={'model':f'models/{name}.glb','source':f'assets/{name}.blend'}
    if colliders:catalog[name]['colliders']=colliders

r=setup('wheelie-bin')
cube('Tapered bin body',(0,0,.52),(.55,.62,.90),'council-green',.055,r)
cube('Lid',(0,0,.99),(.61,.67,.055),'council-green',.02,r)
cube('Hinge',(0,.31,1),(.49,.065,.065),'black',.01,r)
for x in [-.27,.27]:
    wheel=cone('Rubber wheel',(x,.23,.12),.11,.11,.065,'black',r);wheel.rotation_euler[1]=math.pi/2
for x in [-.18,.18]:cube('Moulding',(x,-.315,.53),(.035,.022,.66),'council-green',.008,r)
text('Collection number','17',(0,-.322,.75),.12,'paper',parent=r)
tube('Handle',[(-.19,.33,.88),(-.19,.40,.88),(.19,.40,.88),(.19,.33,.88)],.022,'black',r)
finish('wheelie-bin',[{'x':0,'z':0,'w':.62,'d':.70}])

r=setup('storm-drain')
cube('Cast iron surround',(0,0,.003),(.8,.46,.025),'rust',.008,r)
cube('Dark opening',(0,0,.018),(.70,.36,.012),'black',0,r)
for x in range(12):cube('Drain grate',(-.32+x*.058,0,.031),(.02,.36,.014),'steel',.002,r)
finish('storm-drain')

r=setup('puddle')
verts=[(0,0,.013)]
for i in range(24):
    a=i*math.tau/24;radius=random.uniform(.75,1.1)
    verts.append((math.cos(a)*radius,math.sin(a)*radius*.58,.013))
plane_mesh('Rainwater',verts,[(0,i+1,(i+1)%24+1) for i in range(24)],'wet',r)
finish('puddle')

r=setup('fallen-leaves')
for i in range(36):
    x=random.uniform(-.9,.9);y=random.uniform(-.65,.65);a=random.random()*math.tau;s=random.uniform(.045,.10)
    verts=[]
    for dx,dy,z in [(0,-1,0),(-.45,-.3,.05),(-.60,.2,0),(0,1,.08),(.6,.2,0),(.45,-.3,.05),(0,0,.12)]:
        verts.append((x+s*(dx*math.cos(a)-dy*math.sin(a)),y+s*(dx*math.sin(a)+dy*math.cos(a)),.018+s*z))
    plane_mesh('Curled leaf',verts,[(6,j,(j+1)%6) for j in range(6)],'leaf-ochre',r)
finish('fallen-leaves')

r=setup('county-sign')
for x in [-.6,.6]:cube('Post',(x,0,.95),(.065,.08,1.9),'steel',.005,r)
cube('Sign board',(0,0,1.65),(1.8,.08,.95),'council-green',.018,r)
for x in [-.85,.85]:cube('Border',(x,-.046,1.65),(.018,.007,.84),'paper',0,r)
for z in [1.25,2.05]:cube('Border',(0,-.046,z),(1.72,.007,.018),'paper',0,r)
text('Town name','WICKMERE',(0,-.052,1.79),.20,'paper',parent=r)
text('Town subtitle','A PLACE TO GROW UP',(0,-.052,1.57),.085,'paper',parent=r)
text('Town warning','CHILDREN: MIND THE WILDLIFE',(0,-.052,1.36),.058,'paper',parent=r)
finish('county-sign',[{'x':0,'z':0,'w':1.8,'d':.15}])

r=setup('notice-board')
cube('Frame',(0,0,1.25),(1.20,.14,1.65),'oak',.016,r)
cube('Backing',(0,-.083,1.25),(1.07,.022,1.5),'council-green',.005,r)
for i,(x,z,angle) in enumerate([(-.25,1.62,-.06),(.25,1.48,.06),(-.23,1.07,.02),(.25,.86,-.04)]):
    paper=empty('Loose notice',(x,-.10,z),r)
    cube('Paper',(0,0,0),(.43,.01,.52),'paper',.001,paper)
    text('Heading',['MISSING CAT','LEAGUE INTAKE','SCHOOL CLOSED','FIELDWORK'][i],(0,-.009,.14),.045,'black',parent=paper)
    text('Notice text',['ANSWERS TO NOTHING','AGES TEN AND UP','FUNDING REALLOCATED','COUNTS AS EDUCATION'][i],(0,-.009,.04),.026,'black',parent=paper)
    for zline in [-.06,-.105,-.15]:cube('Printed line',(0,-.008,zline),(.30,.003,.006),'black',0,paper)
    for f,v in [(1,angle),(45,angle+.015),(90,angle)]:paper.rotation_euler[1]=v;paper.keyframe_insert(data_path='rotation_euler',frame=f)
finish('notice-board',animated=True)

r=setup('school-backpack')
ellipsoid('Canvas bag',(0,0,.32),(.25,.15,.34),'council-green',r)
cube('Front pocket',(0,-.13,.24),(.34,.08,.23),'cloth',.06,r)
tube('Zip',[(-.17,-.18,.34),(0,-.185,.355),(.17,-.18,.34)],.006,'steel',r)
for x in [-.13,.13]:tube('Shoulder strap',[(x,.09,.57),(x,.22,.41),(x,.18,.08)],.021,'black',r)
tube('Carry loop',[(-.06,0,.62),(-.06,0,.70),(.06,0,.70),(.06,0,.62)],.013,'black',r)
text('Name label','AGE 10',(0,-.183,.24),.046,'paper',parent=r)
finish('school-backpack')

r=setup('school-shoes')
for x in [-.13,.13]:
    ellipsoid('Leather shoe',(x,0,.06),(.095,.20,.07),'black',r)
    cube('Sole',(x,0,.02),(.18,.37,.025),'black',.07,r)
    for y in [-.04,.005,.045]:tube('Lace',[(x-.043,y,.108),(x+.045,y+.02,.108)],.003,'paper',r)
finish('school-shoes')

r=setup('calendar');r.rotation_euler[2]=math.pi/2
cube('Calendar paper',(0,0,0),(.5,.012,.7),'paper',.002,r)
text('Month','SEPTEMBER',(0,-.011,.22),.057,'black',parent=r)
text('Weekdays','M   T   W   T   F   S   S',(0,-.011,.135),.022,'black',parent=r)
for day in range(1,31):
    x=((day-1)%7-3)*.06;z=.065-((day-1)//7)*.064
    text('Date',str(day),(x,-.012,z),.026,'black',parent=r)
material('red-ink',(.25,.036,.02),1)
tube('Birthday circle',[(.06*math.cos(a)-.06,-.018,.04*math.sin(a)+.014) for a in [i*math.tau/16 for i in range(17)]],.002,'red-ink',r)
text('Birthday reminder','TEN. ALREADY.',(0,-.012,-.28),.029,'red-ink',parent=r)
finish('calendar')

# Surface edits apply to each independent road export, with Blender-authored UV density.
for name in ['road-straight-12m','road-junction-12m','path-2m','pavement-4m']:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/catalog[name]['source']))
    for mat in bpy.data.materials:
        if mat.name=='road':mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.43
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH' and obj.data.uv_layers and obj.data.materials and obj.data.materials[0].name=='road':
            for p in obj.data.polygons:
                for li in p.loop_indices:
                    v=obj.matrix_world@obj.data.vertices[obj.data.loops[li].vertex_index].co
                    obj.data.uv_layers.active.data[li].uv=(v.x/2,v.y/2)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/catalog[name]['source']))
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'game-assets'/catalog[name]['model']),export_format='GLB',export_image_format='WEBP',export_image_quality=86,export_animations=False)
(ROOT/'game-assets'/'asset-catalog.json').write_text(json.dumps(catalog,indent=2))
print('DETAIL_PASS_COMPLETE',len(catalog),flush=True)
