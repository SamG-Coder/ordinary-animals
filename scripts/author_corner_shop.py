"""Author separate original Blender corner-shop fixtures and a shopfront.

The inspection-only layout command assembles copies in memory for a PNG. It
never exports a merged building or village, and never changes the shared catalog.
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
rng=np.random.default_rng(6733)
random.seed(6733)
catalog={}
verification={}
for filename,names in [
    ('author_blender.py',{'begin','link','empty','cube','cone','tube','text','plane_mesh','material'}),
    ('author_countryside.py',{'field','surface'}),
    ('author_morrow_quay.py',{'start','measured_uvs','batch_static','render'}),
]:
    parsed=ast.parse((ROOT/'scripts'/filename).read_text())
    definitions=[node for node in parsed.body if isinstance(node,ast.FunctionDef) and node.name in names]
    exec(compile(ast.Module(body=definitions,type_ignores=[]),filename+' definitions only','exec'))

_cube=cube
_tube=tube
_text=text
_start=start
def cube(*args,**kwargs):
    obj=_cube(*args,**kwargs)
    for modifier in obj.modifiers:
        if modifier.type=='BEVEL':modifier.segments=1
    return obj

def tube(*args,**kwargs):
    obj=_tube(*args,**kwargs);obj.data.resolution_u=3;obj.data.bevel_resolution=1
    return obj

def text(*args,**kwargs):
    # Printed lettering is flat, with modest curve resolution. Extruding every
    # price label would waste geometry without improving its appearance.
    obj=_text(*args,**kwargs);obj.data.resolution_u=3;obj.data.extrude=0
    return obj

def start(name):
    root=_start(name)
    for key,color,rough,metal in [
        ('enamel',(.31,.34,.29),.82,.10),('card',(.41,.36,.24),.95,0),
        ('rationgreen',(.12,.19,.12),.86,0),('rationred',(.25,.11,.065),.88,0),
        ('medical',(.48,.49,.38),.78,0),('tin',(.29,.30,.27),.43,.6),
    ]:material(key,color,rough,metal=metal)
    material('display',(.20,.29,.09),.44,emission=.55)
    material('lampglass',(.55,.60,.43),.44,emission=.8)
    mat=material('shopglass',(.13,.19,.18),.19)
    mat.diffuse_color=(.13,.19,.18,.20)
    mat.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.20
    mat.surface_render_method='DITHERED'
    return root

def save(name,colliders=None):
    measured_uvs();batch_static();bpy.context.scene.frame_set(1)
    bpy.data.orphans_purge(do_recursive=True)
    for image in bpy.data.images:
        if image.users and image.has_data:image.pack()
    bpy.context.scene['authoring']='scripts/author_corner_shop.py'
    bpy.context.scene['original_asset']=name
    source=ROOT/'assets'/f'{name}.blend';model=ROOT/'game-assets/models'/f'{name}.glb'
    bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
    bpy.ops.export_scene.gltf(filepath=str(model),export_format='GLB',export_image_format='WEBP',export_image_quality=91,export_animations=False)
    meshes=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
    points=[obj.matrix_world@Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum=[min(point[i] for point in points) for i in range(3)]
    maximum=[max(point[i] for point in points) for i in range(3)]
    catalog[name]={'source':f'assets/{name}.blend','model':f'models/{name}.glb','authoring':'scripts/author_corner_shop.py'}
    if colliders:catalog[name]['colliders']=colliders
    verification[name]={'triangles':sum(sum(len(poly.vertices)-2 for poly in obj.data.polygons) for obj in meshes),'materialPrimitives':len(meshes),'packedImages':len([im for im in bpy.data.images if im.users and im.has_data]),'blenderMin':minimum,'blenderMax':maximum,'modelBytes':model.stat().st_size}
    print('SHOP_MODULE',name,json.dumps(verification[name]),flush=True)
    render(name,minimum,maximum)

def author_shopfront():
    r=start('corner-shopfront8m')
    # The entrance is a real open 1.44m gap from x[-.72,.72], with no threshold.
    for side in [-1,1]:
        x=side*2.36
        cube('Damp brick stall riser',(x,0,.31),(3.28,.22,.62),'brick',.006,r)
        cube('Faded window sill',(x,-.14,.66),(3.28,.20,.09),'paint',.008,r)
        cube('Shopfront glazing',(x,-.012,1.51),(3.10,.018,1.58),'shopglass',0,r)
        for xx in [side*.77,side*3.95]:
            cube('Timber jamb',(xx,-.03,1.5),(.10,.26,3),'paint',.006,r)
        cube('Glazed bay mullion',(x,-.052,1.51),(.065,.09,1.62),'paint',.004,r)
        cube('Bay top rail',(x,-.045,2.34),(3.28,.21,.14),'paint',.006,r)
        for dz in [1.16,1.91]:
            cube('Window cross rail',(x,-.065,dz),(3.18,.075,.055),'paint',.003,r)
        for bx in [side*1.23,side*3.49]:
            cube('Window security bar',(bx,.045,1.53),(.017,.019,1.64),'iron',.001,r)
        # Shop notices are physical paper meshes, leaving most glazing clear.
        cube('Window ration poster',(x+.28,-.071,1.37),(.58,.008,.71),'paper',0,r)
        text('Poster heading','LEAGUE',(x+.28,-.078,1.56),.085,'black',parent=r)
        text('Poster stock','SUPPLIES',(x+.28,-.078,1.43),.075,'black',parent=r)
        text('Poster age','AGES 10+',(x+.28,-.078,1.22),.060,'red',parent=r)
    cube('Shop fascia',(0,-.01,2.71),(8,.32,.58),'paint',.008,r)
    cube('Fascia bottom weather strip',(0,-.22,2.42),(8.12,.15,.045),'iron',.003,r)
    text('Shop name','MERCY GENERAL STORES',(0,-.182,2.73),.315,'paper',parent=r)
    text('Shop tagline','ANIMAL SUPPLIES / COUNTY APPROVED',(0,-.185,2.52),.098,'paper',parent=r)
    cube('Door lintel',(0,-.01,2.365),(1.54,.24,.075),'paint',.005,r)
    tube('Door bell wire',[(-.66,-.14,2.32),(-.61,-.14,2.20)],.007,'iron',r)
    cone('Entrance bell',(-.61,-.14,2.15),.04,.017,.065,'tin',r,12)
    cube('Exterior lamp housing',(-3.42,-.30,2.45),(.30,.21,.11),'iron',.01,r)
    cube('Exterior lamp diffuser',(-3.42,-.33,2.395),(.24,.12,.017),'lampglass',.002,r)
    save('corner-shopfront8m',[{'x':-2.36,'z':0,'w':3.28,'d':.30},{'x':2.36,'z':0,'w':3.28,'d':.30}])

def author_counter():
    r=start('corner-shop-counter')
    cube('Counter carcass',(0,0,.47),(2.8,.78,.94),'paint',.013,r)
    cube('Worn laminate worktop',(0,-.005,.99),(2.91,.89,.06),'enamel',.014,r)
    cube('Recessed kickboard',(0,-.406,.08),(2.72,.028,.16),'black',.002,r)
    for x in [-.92,0,.92]:
        cube('Counter panel',(x,-.397,.52),(.82,.026,.69),'wood',.006,r)
    # A small unattended terminal, sized so a ten-year-old can read it.
    cube('Terminal pedestal',(.67,.03,1.085),(.36,.36,.13),'iron',.012,r)
    screen=cube('Terminal case',(.67,-.02,1.28),(.49,.105,.32),'iron',.012,r)
    screen.rotation_euler[0]=math.radians(12)
    cube('Terminal green display',(.67,-.084,1.305),(.405,.016,.18),'display',.003,r)
    text('Terminal display','PAY HERE',(.67,-.096,1.315),.042,'black',parent=r)
    for x in [.55,.63,.71]:
        for y in [-.19,-.26,-.33]:cube('Payment keypad',(x,y,1.077),(.055,.048,.016),'enamel',.004,r)
    cube('Receipt slot',(.85,-.278,1.081),(.09,.10,.008),'black',0,r)
    receipt=cube('Printed receipt',(.85,-.335,1.09),(.073,.11,.002),'paper',0,r)
    for i in range(5):cube('Receipt ink line',(.85,-.31-i*.012,1.092),(.05,.002,.001),'black',0,r)
    cube('Unattended sign',(0,-.466,.79),(1.54,.018,.24),'paper',.002,r)
    text('Unattended line one','SELF SERVICE / NO ATTENDANT',(0,-.478,.825),.071,'black',parent=r)
    text('Unattended line two','NO GUARDIAN REQUIRED',(0,-.478,.715),.073,'red',parent=r)
    cube('Empty impulse purchase tray',(-.84,0,1.045),(.65,.38,.04),'card',.004,r)
    for x in [-1.05,-.89,-.73]:
        box=cube('Travel ration packet',(x,.015,1.085),(.12,.23,.035),'rationred',.004,r)
        box.rotation_euler[2]=random.uniform(-.10,.10)
    save('corner-shop-counter',[{'x':0,'z':0,'w':2.92,'d':.96}])

def author_shelf():
    r=start('corner-shop-shelf')
    cube('Shelf stained backing',(0,.22,1.04),(1.9,.045,2.08),'wood',.006,r)
    for x in [-.92,.92]:cube('Shelf upright',(x,0,1.04),(.075,.50,2.08),'paint',.008,r)
    for z in [.10,.57,1.04,1.51,2.02]:
        cube('Painted shelf',(0,-.01,z),(1.84,.54,.055),'paint',.006,r)
        cube('Price strip',(0,-.294,z), (1.8,.018,.05),'paper',.002,r)
    # Reusable stock: carrier cartons below, feed tins and folded ration bags above.
    for i,x in enumerate([-.59,0,.59]):
        cube('Flat pack carrier carton',(x,.005,.32),(.50,.41,.37),'card',.005,r)
        text('Carton animal label','CARRIER',(x,-.207,.35),.067,'black',parent=r)
        text('Carton warning','ASSEMBLY BY CHILD',(x,-.208,.22),.031,'black',parent=r)
    for z in [.65,1.12]:
        for i,x in enumerate([-.72,-.43,-.14,.15,.44,.73]):
            if (i+round(z*10))%3:
                cone('Animal feed tin',(x,-.055,z+.115),.106,.106,.23,'tin',r,12)
                cone('Printed tin sleeve',(x,-.055,z+.105),.107,.107,.15,'rationgreen' if i%2 else 'rationred',r,12)
            else:
                box=cube('Folded feed pouch',(x,-.012,z+.145),(.23,.28,.29),'rationgreen',.011,r)
                text('Pouch label','FEED',(x,-.155,z+.17),.045,'paper',parent=r)
    for x in [-.70,-.34,.02,.38,.70]:
        cube('Field medkit carton',(x,.015,1.72),(.28,.36,.32),'medical',.006,r)
        cube('Medkit printed cross upright',(x,-.169,1.74),(.035,.008,.12),'red',0,r)
        cube('Medkit printed cross bar',(x,-.17,1.74),(.12,.008,.035),'red',0,r)
    text('Shelf category','FIELD SUPPLIES',(0,-.304,1.991),.070,'black',parent=r)
    for z in [.078,.548,1.018,1.488]:
        for x in [-.58,0,.58]:text('Shelf price','LEAGUE STOCK',(x,-.307,z),.032,'black',parent=r)
    save('corner-shop-shelf',[{'x':0,'z':.04,'w':1.92,'d':.58}])

def author_pharmacy():
    r=start('corner-shop-pharmacy')
    cube('Cabinet back panel',(0,.155,.58),(1.45,.03,1.16),'enamel',.004,r)
    for x in [-.71,.71]:cube('Cabinet side panel',(x,0,.58),(.03,.34,1.16),'enamel',.004,r)
    for z in [.015,1.145]:cube('Cabinet top and base',(0,0,z),(1.45,.34,.03),'enamel',.004,r)
    cube('Cabinet glass',(0,-.182,.60),(1.30,.018,1.02),'shopglass',0,r)
    for x in [-.70,.70,0]:cube('Medical cabinet frame',(x,-.20,.58),(.04,.08,1.16),'paint',.004,r)
    for z in [.02,1.14]:cube('Medical cabinet rail',(0,-.20,z),(1.44,.08,.045),'paint',.003,r)
    for z in [.35,.74]:cube('Locked shelf',(0,-.05,z),(1.37,.29,.025),'enamel',.002,r)
    for z in [.20,.53,.92]:
        for i,x in enumerate([-.47,-.15,.18,.47]):
            cube('Sterile dressing box',(x,-.035,z),(.24,.23,.18),'medical',.003,r)
            cube('Dressing label',(x,-.159,z),(.16,.008,.10),'paper',0,r)
            cube('Red medical mark',(x,-.165,z),(.015,.005,.060),'red',0,r)
            cube('Red medical crossbar',(x,-.167,z),(.060,.005,.015),'red',0,r)
    cube('Small cabinet latch',(.10,-.25,.60),(.038,.06,.13),'iron',.004,r)
    cube('Cabinet top warning',(0,-.225,1.07),(1.22,.017,.11),'paper',.002,r)
    text('Cabinet warning','ANIMALS ONLY / CHILDREN SEE SCHOOL',(0,-.239,1.047),.042,'black',parent=r)
    save('corner-shop-pharmacy',[{'x':0,'z':0,'w':1.45,'d':.52}])

def author_sign():
    r=start('corner-shop-sign')
    cube('Bent enamel sign',(0,0,.34),(1.05,.028,.68),'enamel',.005,r)
    for x in [-.475,.475]:
        for z in [.045,.635]:
            bolt=cone('Rusty sign screw',(x,-.02,z),.011,.011,.013,'rust',r,8)
            bolt.rotation_euler[0]=math.pi/2
    text('Service sign title','SELF SERVICE',(0,-.020,.49),.102,'black',parent=r)
    text('Service sign age','TEN IS OLD ENOUGH',(0,-.022,.34),.062,'red',parent=r)
    text('Service sign line one','TO MAKE A PURCHASE.',(0,-.022,.23),.052,'black',parent=r)
    text('Service sign line two','APPARENTLY.',(0,-.022,.105),.058,'black',parent=r)
    save('corner-shop-sign')

def render_layout():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    registry=json.loads((ROOT/'game-assets/asset-catalog.json').read_text())
    registry.update(json.loads((OUT/'corner-shop-catalog.json').read_text()))
    layout=json.loads((OUT/'corner-shop-placements.json').read_text())
    cache={}
    for p in layout['placements']:
        if p['name'] in ['roof-4m','ceiling-4m'] and '--cutaway' in sys.argv:continue
        if p['name'] not in cache:
            with bpy.data.libraries.load(str(ROOT/registry[p['name']]['source']),link=False) as (source,target):target.objects=source.objects
            prototypes=[obj for obj in target.objects if obj]
            for obj in prototypes:bpy.context.scene.collection.objects.link(obj)
            bpy.context.view_layer.update()
            cache[p['name']]=[(obj,obj.matrix_world.copy()) for obj in prototypes if obj.type in ['MESH','CURVE','FONT']]
            for obj in prototypes:bpy.context.scene.collection.objects.unlink(obj)
        placement=Matrix.Translation((p['x'],-p['z'],p['y']))@Matrix.Rotation(p['angle'],4,'Z')@Matrix.Scale(p['scale'],4)
        for original,source_matrix in cache[p['name']]:
            obj=original.copy();obj.data=original.data;obj.parent=None;obj.matrix_world=placement@source_matrix
            bpy.context.scene.collection.objects.link(obj)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=40;scene.cycles.use_denoising=True
    scene.render.resolution_x=1400;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new('Dull morning');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.22,.24,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
    scene.view_settings.view_transform='AgX'
    bpy.ops.mesh.primitive_plane_add(size=100,location=(-42,-7,-.014))
    mat=bpy.data.materials.new('Review ground only');mat.diffuse_color=(.068,.077,.065,1);bpy.context.object.data.materials.append(mat)
    for point in layout['metadata']['lights']:
        d=bpy.data.lights.new('Shop fluorescent','AREA');d.energy=110;d.shape='RECTANGLE';d.size=1.5;d.size_y=.30;d.color=(.77,.86,.64)
        obj=bpy.data.objects.new('Shop fluorescent',d);scene.collection.objects.link(obj);obj.location=(point['x'],-point['z'],point['y'])
    data=bpy.data.lights.new('Overcast skylight','AREA');data.energy=2200;data.size=12
    obj=bpy.data.objects.new('Overcast skylight',data);scene.collection.objects.link(obj);obj.location=(-43,-10,12)
    camera_data=bpy.data.cameras.new('Shop review camera');camera=bpy.data.objects.new('Shop review camera',camera_data);scene.collection.objects.link(camera)
    target=Vector((-42,-7,1))
    camera.location=(-33,-21,12) if '--cutaway' in sys.argv else (-31,-22,5.5)
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.lens=42;scene.camera=camera
    suffix='cutaway' if '--cutaway' in sys.argv else 'exterior'
    scene.render.filepath=str(OUT/f'corner-shop-{suffix}-blender.png');bpy.ops.render.render(write_still=True)

if '--layout' in sys.argv:
    render_layout()
else:
    factories={'corner-shopfront8m':author_shopfront,'corner-shop-counter':author_counter,'corner-shop-shelf':author_shelf,'corner-shop-pharmacy':author_pharmacy,'corner-shop-sign':author_sign}
    only=next((arg.split('=',1)[1] for arg in sys.argv if arg.startswith('--only=')),None)
    for name,factory in factories.items():
        if only is None or name==only:factory()
    for filename,values in [('corner-shop-catalog.json',catalog),('corner-shop-verification.json',verification)]:
        target=OUT/filename;existing=json.loads(target.read_text()) if only and target.exists() else {}
        existing.update(values);target.write_text(json.dumps(existing,indent=2))
    print('CORNER_SHOP_ASSETS_COMPLETE',len(catalog),flush=True)
