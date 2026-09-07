"""Separate Blender harbour modules; never a coastline or region scene.

Packed original maps, compact material batches, one small animated water tile.
The file writes only its own assets and artifacts/morrow-quay-catalog.json.
"""
import ast
import bpy
import json
import math
import numpy as np
import random
import sys
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'
SIZE=512
rng=np.random.default_rng(8821)
random.seed(8821)
catalog={}
verification={}
for filename,names in [
    ('author_blender.py',{'begin','link','empty','cube','cone','tube','text','plane_mesh','material'}),
    ('author_countryside.py',{'field','surface'}),
]:
    parsed=ast.parse((ROOT/'scripts'/filename).read_text())
    exec(compile(ast.Module(body=[node for node in parsed.body if isinstance(node,ast.FunctionDef) and node.name in names],type_ignores=[]),filename+' definitions only','exec'))

_cube=cube
_tube=tube
def cube(*args,**kwargs):
    obj=_cube(*args,**kwargs)
    for modifier in obj.modifiers:
        if modifier.type=='BEVEL':modifier.segments=1
    return obj

def tube(*args,**kwargs):
    obj=_tube(*args,**kwargs)
    obj.data.resolution_u=3
    obj.data.bevel_resolution=1
    return obj


def start(name):
    global M
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M={}
    y,x=np.mgrid[0:SIZE,0:SIZE].astype(np.float32)/SIZE
    fine,broad,damp=field(150),field(18),field(5)
    stone_value=.20+.08*broad+.04*fine-.065*damp
    stone=surface('Salt stained quay stone',np.stack([stone_value*.96,stone_value,stone_value*.94],-1),fine*.002+broad*.005,.92)
    rows=np.floor(y*14)
    mortar=((y*14)%1<.06)|((x*5+(rows%2)*.5)%1<.035)
    brick_value=.23+.055*broad+.022*fine-.075*damp
    brick=np.stack([brick_value,brick_value*.75,brick_value*.57],-1)
    brick[mortar]=np.stack([.24+.02*fine[mortar]]*3,-1)
    brick=surface('Harbour damp brickwork',brick,fine*.0015-mortar*.003,.95)
    fibres=np.sin(x*math.tau*40+np.sin(y*8+x*23)*1.6)
    wood_value=.14+.07*broad+.028*fine-.024*fibres-.045*damp
    wood=surface('Salt worn timber grain',np.stack([wood_value*.90,wood_value,wood_value*.86],-1),fibres*.0008+fine*.0007,.86)
    chipped=np.clip((broad-.6)*5,0,1)
    painted=np.stack([.075+.03*fine,.13+.025*fine,.14+.025*fine],-1)
    painted=painted*(1-chipped[:,:,None])+np.stack([wood_value*.95,wood_value*.9,wood_value*.73],-1)*chipped[:,:,None]
    paint=surface('Faded harbour paint',painted,fine*.0006+chipped*.0007,.75)
    glass_value=.12+.032*fine+.055*broad
    streaks=np.sin(x*620+np.sin(y*6+x*25))**18
    glass=surface('Rain smeared office glass',np.stack([glass_value*.78,glass_value,glass_value*1.08],-1),streaks*.00018+fine*.00012,.35)
    # Several ripples follow the same prevailing wind; avoid a regular crossed
    # normal pattern that reads like woven cloth across repeated water tiles.
    ripples=.55*np.sin(math.tau*(9*x+2*y)+broad*2)+.18*np.sin(math.tau*(21*x+5*y)+damp*3)+.10*np.sin(math.tau*(33*x+7*y)+fine)
    water_value=.037+broad*.012+ripples*.0006
    water=surface('Opaque harbour water',np.stack([water_value*.66,water_value*.94,water_value],-1),ripples*.002+fine*.00008,.26,.7)
    water.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=.10
    M.update({'stone':stone,'brick':brick,'wood':wood,'paint':paint,'glass':glass,'water':water})
    for key,color,rough,metal in [
        ('iron',(.038,.046,.044),.68,.32),('rust',(.16,.075,.035),.93,.14),
        ('roof',(.14,.17,.17),.49,.45),('paper',(.56,.56,.46),.93,0),
        ('rope',(.26,.22,.14),.97,0),('black',(.012,.017,.016),.88,0),
        ('red',(.24,.075,.052),.77,0),('warmglass',(.31,.28,.16),.52,0),
    ]:material(key,color,rough,metal=metal)
    return begin(name)


def measured_uvs():
    bpy.context.view_layer.update()
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH' or not obj.data.uv_layers:continue
        name=obj.data.materials[0].name if obj.data.materials else ''
        repeat=.55 if 'timber' in name.lower() else 1.7
        for poly in obj.data.polygons:
            for li in poly.loop_indices:
                v=obj.matrix_world@obj.data.vertices[obj.data.loops[li].vertex_index].co
                uv=(v.x/repeat,v.y/repeat) if abs(poly.normal.z)>.5 else ((v.y if abs(poly.normal.x)>.5 else v.x)/repeat,v.z/repeat)
                obj.data.uv_layers.active.data[li].uv=uv


def batch_static():
    meshes=[o for o in bpy.context.scene.objects if o.type in ['MESH','CURVE','FONT']]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:obj.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    bpy.ops.object.convert(target='MESH')
    groups={}
    for obj in list(bpy.context.scene.objects):
        if obj.type=='MESH':groups.setdefault(obj.data.materials[0].name,[]).append(obj)
    for name,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        obj=bpy.context.object
        matrix=obj.matrix_world.copy();obj.parent=None;obj.matrix_world=matrix
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        obj.name='Authored '+name
    for obj in list(bpy.context.scene.objects):
        if obj.type=='EMPTY':bpy.data.objects.remove(obj,do_unlink=True)


def save(name,colliders=None,animated=False,walkable_top=None):
    if not animated:
        measured_uvs();batch_static()
    bpy.context.scene.frame_set(1)
    bpy.data.orphans_purge(do_recursive=True)
    for image in bpy.data.images:
        if image.users and image.has_data:image.pack()
    bpy.context.scene['authoring']='scripts/author_morrow_quay.py'
    source=ROOT/'assets'/f'{name}.blend'
    model=ROOT/'game-assets/models'/f'{name}.glb'
    bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
    bpy.ops.export_scene.gltf(filepath=str(model),export_format='GLB',export_image_format='WEBP',export_image_quality=91,export_animations=animated,export_animation_mode='SCENE',export_frame_range=True)
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    points=[o.matrix_world@Vector(corner) for o in objects for corner in o.bound_box]
    minimum=[min(p[i] for p in points) for i in range(3)];maximum=[max(p[i] for p in points) for i in range(3)]
    catalog[name]={'source':f'assets/{name}.blend','model':f'models/{name}.glb','authoring':'scripts/author_morrow_quay.py'}
    if colliders:catalog[name]['colliders']=colliders
    if walkable_top is not None:catalog[name]['walkableTop']=walkable_top
    verification[name]={'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects),'materialPrimitives':len(objects),'packedImages':len([im for im in bpy.data.images if im.users and im.has_data]),'blenderMin':minimum,'blenderMax':maximum,'modelBytes':model.stat().st_size,'animated':animated}
    print('MORROW_MODULE',name,json.dumps(verification[name]),flush=True)
    render(name,minimum,maximum)


def render(name,minimum,maximum):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.render.resolution_x=1000;scene.render.resolution_y=800;scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new('Overcast harbour review');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.23,.27,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.55
    scene.view_settings.view_transform='AgX'
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,min(-.015,minimum[2]-.015)))
    mat=bpy.data.materials.new('Review ground only');mat.diffuse_color=(.055,.065,.070,1);bpy.context.object.data.materials.append(mat)
    target=Vector([(a+b)/2 for a,b in zip(minimum,maximum)])
    span=max(b-a for a,b in zip(minimum,maximum))
    data=bpy.data.cameras.new('Review camera');camera=bpy.data.objects.new('Review camera',data);scene.collection.objects.link(camera)
    camera.location=target+Vector((1.05,-1.6,.94)).normalized()*span*1.9
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();data.lens=46;scene.camera=camera
    for title,offset,colour in [('Sky opening',(-.7,-.9,1.2),(.78,.87,1)),('Harbour lamp',(1,.6,.75),(1,.78,.57))]:
        lightdata=bpy.data.lights.new(title,'AREA');lightdata.energy=80*span*span;lightdata.size=span
        lightdata.color=colour;light=bpy.data.objects.new(title,lightdata);scene.collection.objects.link(light)
        light.location=target+Vector(offset)*span;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/f'{name}-blender.png');bpy.ops.render.render(write_still=True)


def window(root,x,y,z,width=1.6,height=1.4):
    cube('Stone window surround',(x,y,z),(width+.22,.16,height+.20),'stone',.015,root)
    cube('Inset wet glass',(x,y-.091,z),(width,.025,height),'glass',.004,root)
    for dx in [-width/2,0,width/2]:cube('Painted sash bar',(x+dx,y-.12,z),(.045,.075,height+.06),'paint',.003,root)
    for dz in [-height/2,0,height/2]:cube('Sash transom',(x,y-.12,z+dz),(width+.08,.075,.045),'paint',.003,root)
    cube('Salt stained sill',(x,y-.21,z-height/2-.08),(width+.30,.42,.11),'stone',.014,root)


def author_harbour_office():
    r=start('harbour-office')
    cube('Damp brick harbour office',(0,0,1.72),(8.4,6.2,3.44),'brick',.025,r)
    for y in [-3.11,3.11]:
        cube('Stone damp course',(0,y,.28),(8.48,.18,.56),'stone',.012,r)
        cube('Timber fascia',(0,y,3.35),(8.62,.15,.18),'paint',.008,r)
    for x in [-2.65,2.65]:window(r,x,-3.16,1.93,1.85,1.52)
    cube('Stone doorway',(0,-3.19,1.28),(1.58,.18,2.56),'stone',.014,r)
    cube('Painted office door',(0,-3.30,1.23),(1.27,.09,2.43),'paint',.01,r)
    cube('Door glazed panel',(0,-3.356,1.81),(.94,.02,.84),'glass',.003,r)
    for x in [-.31,.31]:cube('Raised door panel',(x,-3.366,.69),(.47,.018,.83),'wood',.009,r)
    cube('Brass door handle',(.45,-3.385,1.07),(.035,.06,.19),'rust',.008,r)
    cube('Flush entrance threshold',(0,-3.52,.015),(1.8,.67,.03),'stone',.005,r)
    vertices=[];faces=[]
    for iy in range(9):
        y=-3.45+iy*6.9/8
        for ix in range(97):
            x=-4.48+ix*8.96/96
            vertices.append((x,y,3.78+y*.11+.023*math.cos(ix*math.pi/2)))
    for j in range(8):
        for i in range(96):a=j*97+i;faces.append((a,a+1,a+98,a+97))
    plane_mesh('Corrugated galvanized shed roof',vertices,faces,'roof',r)
    for x in [-4.44,4.44]:tube('Roof edge flashing',[(x,-3.46,3.39),(x,3.46,4.16)],.041,'roof',r)
    tube('Harbour gutter',[(-4.51,-3.48,3.36),(4.51,-3.48,3.36)],.052,'iron',r)
    tube('Downpipe',[(4.10,-3.49,3.38),(4.10,-3.49,.30),(4.25,-3.64,.11)],.037,'iron',r)
    cube('Office sign backing',(0,-3.274,3.02),(5.08,.07,.40),'paint',.006,r)
    text('Harbour office title','COUNTY HARBOUR OFFICE',(0,-3.32,2.91),.234,'paper',parent=r)
    cube('League licence plate',(.98,-3.233,1.52),(.39,.05,.56),'iron',.004,r)
    text('District number','06',(.98,-3.268,1.54),.18,'paper',parent=r)
    text('Liability badge','LIABILITY',(.98,-3.269,1.37),.050,'paper',parent=r)
    cube('Notice backing',(-.99,-3.249,1.65),(.49,.06,.63),'paint',.004,r)
    text('Small warning','NO CHILDCARE',(-.99,-3.286,1.79),.054,'paper',parent=r)
    text('Small warning line','BEYOND THIS POINT',(-.99,-3.286,1.64),.035,'paper',parent=r)
    text('Small warning footer','LEAGUE EXEMPT',(-.99,-3.286,1.47),.045,'paper',parent=r)
    for x in [-4.23,4.23]:
        for y in [-1.65,.1,1.85]:cube('Painted side cladding',(x,y,2.05),(.06,1.69,2.3),'paint',.008,r)
    cone('Vent stack',(2.8,1.65,4.11),.17,.16,1.04,'roof',r,16)
    cone('Vent rain cowl',(2.8,1.65,4.67),.30,.03,.18,'roof',r,16)
    save('harbour-office',[{'x':0,'z':0,'w':8.48,'d':6.3}])


def author_stone_quay4m():
    r=start('stone-quay4m')
    for course in range(3):
        for i in range(5):
            x=-1.60+i*.80
            cube('Quay masonry block',(x,0,-.25-course*.31),(.788,1.80,.296),'stone',.013,r)
    for row in range(2):
        for i in range(5):cube('Broad coping stone',(-1.60+i*.80,-.48+row*.96,-.04),(.79,.945,.14),'stone',.013,r)
    save('stone-quay4m',walkable_top=.03)


def author_timber_pier4m():
    r=start('timber-pier4m')
    for i in range(20):cube('Individual wet pier plank',(-1.9+i*.20,0,-.02),(.196,2.4,.09),'wood',.0025,r)
    for y in [-.89,.89]:cube('Pier underbeam',(0,y,-.145),(4,.15,.19),'paint',.004,r)
    pier_colliders=[]
    for x in [-1.82,1.82]:
        for y in [-1.06,1.06]:
            cone('Tarred pier post',(x,y,.05),.082,.072,1.16,'wood',r,10)
            cone('Dark post cap',(x,y,.65),.085,.079,.04,'iron',r,10)
            pier_colliders.append({'x':x,'z':-y,'w':.17,'d':.17})
    save('timber-pier4m',pier_colliders,walkable_top=.025)


def author_mooring_bollard():
    r=start('mooring-bollard')
    cube('Bollard base',(0,0,.025),(.45,.38,.05),'iron',.024,r)
    cone('Tapered iron bollard',(0,0,.24),.15,.095,.40,'iron',r,16)
    cone('Mooring cap',(0,0,.48),.18,.17,.08,'rust',r,16)
    for x in [-.16,.16]:
        for y in [-.125,.125]:cone('Foundation bolt',(x,y,.060),.025,.025,.023,'rust',r,6)
    for turn in range(3):
        points=[(.12*math.cos(i*math.tau/24),.12*math.sin(i*math.tau/24),.13+turn*.025) for i in range(25)]
        tube('Mooring rope coil',points,.010,'rope',r)
    save('mooring-bollard',[{'x':0,'z':0,'w':.46,'d':.39}])


def author_harbour_water_tile20m():
    r=start('harbour-water-tile20m')
    vertices=[];faces=[];n=24
    for j in range(n+1):
        v=j/n
        for i in range(n+1):
            u=i/n;edge=math.sin(u*math.pi)**2*math.sin(v*math.pi)**2
            vertices.append(((u-.5)*20,(v-.5)*20,.015+.004*edge*math.sin(u*math.tau*2+v*math.tau*3)))
    for j in range(n):
        for i in range(n):
            a=j*(n+1)+i;faces.extend([(a,a+1,a+n+2),(a,a+n+2,a+n+1)])
    water=plane_mesh('Opaque rippling harbour tile',vertices,faces,'water',r,20)
    for p in water.data.polygons:p.use_smooth=True
    water.shape_key_add(name='Basis');wave=water.shape_key_add(name='Slow tide ripple')
    for index,vertex in enumerate(wave.data):
        u=(index%(n+1))/n;v=(index//(n+1))/n;edge=math.sin(u*math.pi)**2*math.sin(v*math.pi)**2
        vertex.co.z=.015+.004*edge*math.cos(u*math.tau*2+v*math.tau*3)
    for frame,value in [(1,0),(61,1),(121,0)]:wave.value=value;wave.keyframe_insert(data_path='value',frame=frame)
    water.data.shape_keys.animation_data.action.name='Harbour water / slow ripples'
    bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=121;bpy.context.scene.render.fps=24
    save('harbour-water-tile20m',animated=True)


def author_moored_dinghy():
    r=start('moored-dinghy')
    vertices=[];faces=[];rings=13;sides=12
    for j in range(rings):
        x=-1.75+j*3.50/(rings-1);width=max(.035,.64*math.sqrt(max(0,1-(x/1.77)**2)))
        for i in range(sides+1):
            a=-math.pi/2+i*math.pi/sides
            vertices.append((x,width*math.sin(a),-.20+.49*abs(math.sin(a))**1.5+abs(x/1.75)**4*.11))
    for j in range(rings-1):
        for i in range(sides):a=j*(sides+1)+i;faces.append((a,a+1,a+sides+2,a+sides+1))
    plane_mesh('Painted clinker hull',vertices,faces,'paint',r)
    plane_mesh('Closed bow stem',vertices[-(sides+1):],[tuple(range(sides+1))],'paint',r)
    inside=[(x,y*.925,z+.038) for x,y,z in vertices]
    plane_mesh('Dinghy inner timber shell',inside,[tuple(reversed(face)) for face in faces],'wood',r)
    for side in [0,sides]:
        points=[vertices[j*(sides+1)+side] for j in range(rings)]
        tube('Dark red gunwale',points,.032,'red',r)
    for x in [-.9,0,.9]:cube('Cross seat',(x,0,.20),(.27,1.00,.08),'wood',.012,r)
    cube('Stern transom',(-1.73,0,.15),(.065,.27,.35),'paint',.012,r)
    for side in [-1,1]:
        oar=empty('Resting wooden oar',(0,side*.26,.29),r);oar.rotation_euler[2]=side*.16
        shaft=cone('Oar shaft',(0,0,0),.018,.018,2.32,'wood',oar,10);shaft.rotation_euler[1]=math.pi/2
        cube('Flattened oar blade',(1.24,0,0),(.43,.125,.022),'wood',.018,oar)
    tube('Bow mooring rope',[(1.73,0,.37),(1.96,-.18,.25),(2.11,-.48,.22),(2.04,-.71,.19)],.012,'rope',r)
    save('moored-dinghy')


def render_layout():
    """Inspection only: assemble source copies in memory, never export a region."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    proposal=json.loads((OUT/'morrow-quay-placements.json').read_text())
    registry=json.loads((ROOT/'game-assets/asset-catalog.json').read_text())
    registry.update(json.loads((OUT/'morrow-quay-catalog.json').read_text()))
    prototypes={}
    for placement in proposal['placements']:
        name=placement['name']
        if name not in prototypes:
            with bpy.data.libraries.load(str(ROOT/registry[name]['source']),link=False) as (src,dst):
                dst.objects=list(src.objects)
            imported=[obj for obj in dst.objects if obj]
            for obj in imported:bpy.context.scene.collection.objects.link(obj)
            bpy.context.view_layer.update()
            prototypes[name]=[(obj,obj.matrix_world.copy()) for obj in imported if obj.type in ['MESH','CURVE','FONT']]
            for obj in imported:bpy.context.scene.collection.objects.unlink(obj)
        x,z,y,angle,scale=(placement.get(key,default) for key,default in [('x',0),('z',0),('y',0),('angle',0),('scale',1)])
        transform=Matrix.Translation((x,-z,y))@Matrix.Rotation(angle,4,'Z')@Matrix.Diagonal((scale,scale,scale,1))
        for prototype,source_matrix in prototypes[name]:
            obj=prototype.copy();obj.data=prototype.data;obj.parent=None
            bpy.context.scene.collection.objects.link(obj)
            obj.matrix_world=transform@source_matrix
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new('Cold coastal overcast');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.25,.28,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.8
    scene.view_settings.view_transform='AgX'
    bpy.ops.mesh.primitive_plane_add(size=400,location=(350,60,-.015))
    ground=bpy.context.object
    mat=bpy.data.materials.new('Review ground');mat.use_nodes=True
    shader=mat.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(.07,.082,.068,1);shader.inputs['Roughness'].default_value=.95
    ground.data.materials.append(mat)
    target=Vector((349,69,0));data=bpy.data.cameras.new('Layout review camera')
    camera=bpy.data.objects.new('Layout review camera',data);scene.collection.objects.link(camera)
    camera.location=(285,-30,87);camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO';data.ortho_scale=152;scene.camera=camera
    lightdata=bpy.data.lights.new('Cloud light','SUN');lightdata.energy=1.7;lightdata.angle=.20
    light=bpy.data.objects.new('Cloud light',lightdata);scene.collection.objects.link(light);light.rotation_euler=(.45,-.6,-.7)
    scene.render.filepath=str(OUT/'morrow-quay-layout-blender.png');bpy.ops.render.render(write_still=True)


if '--layout' in sys.argv:
    render_layout()
    raise SystemExit(0)

only=next((arg.split('=',1)[1] for arg in sys.argv if arg.startswith('--only=')),None)
authors={
    'harbour-office':author_harbour_office,
    'stone-quay4m':author_stone_quay4m,
    'timber-pier4m':author_timber_pier4m,
    'mooring-bollard':author_mooring_bollard,
    'harbour-water-tile20m':author_harbour_water_tile20m,
    'moored-dinghy':author_moored_dinghy,
}
if only and only not in authors:raise ValueError('Unknown individual asset '+only)
for name,author in authors.items():
    if only is None or name==only:author()
if only:
    for filename,values in [('morrow-quay-catalog.json',catalog),('morrow-quay-verification.json',verification)]:
        target=OUT/filename
        previous=json.loads(target.read_text()) if target.exists() else {}
        previous.update(values);target.write_text(json.dumps(previous,indent=2))
else:
    (OUT/'morrow-quay-catalog.json').write_text(json.dumps(catalog,indent=2))
    (OUT/'morrow-quay-verification.json').write_text(json.dumps(verification,indent=2))
print('MORROW_QUAY_ASSETS_COMPLETE',len(catalog),flush=True)
