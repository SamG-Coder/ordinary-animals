"""Original miniature assets. Run: blender -b --python scripts/build_assets.py"""
import bpy, math, random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'models'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
random.seed(18)
M = {}
def material(name, color, roughness=.72):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    M[name] = m
for n,c in {'cream':(.92,.83,.64),'white':(.98,.94,.83),'orange':(.81,.32,.09),'dark':(.055,.045,.044),'pink':(.88,.39,.36),'brown':(.28,.12,.07),'tan':(.67,.37,.15),'blue':(.12,.36,.47),'mint':(.29,.57,.37),'leaf':(.24,.44,.19),'leaflight':(.43,.61,.24),'wood':(.49,.27,.12),'roof':(.75,.25,.12),'plaster':(.94,.78,.5),'glass':(.13,.35,.39),'yellow':(1,.65,.12),'purple':(.54,.34,.55),'skin':(.79,.49,.29),'grey':(.4,.43,.42)}.items(): material(n,c)
current = None
library = []
def link(obj, name, mat, parent=None):
    obj.name = name
    for col in list(obj.users_collection): col.objects.unlink(obj)
    current.objects.link(obj)
    if mat: obj.data.materials.append(M[mat])
    if parent: obj.parent = parent
    return obj
def ball(name, pos, scale, mat, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=pos)
    o=link(bpy.context.object,name,mat,parent); o.scale=scale
    for p in o.data.polygons: p.use_smooth=True
    return o
def cube(name,pos,scale,mat,bevel=.06,parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    o=link(bpy.context.object,name,mat,parent); o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Soft toy edges','BEVEL'); mod.width=bevel; mod.segments=3
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o
def cone(name,pos,r1,r2,depth,mat,parent=None):
    bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=r1,radius2=r2,depth=depth,location=pos)
    o=link(bpy.context.object,name,mat,parent)
    mod=o.modifiers.new('Soft edge','BEVEL'); mod.width=.035; mod.segments=2
    o.modifiers.new('Normals','WEIGHTED_NORMAL')
    return o
def curve(name, pts, radius, mat, parent=None):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.bevel_depth=radius; c.bevel_resolution=3; c.use_fill_caps=True
    s=c.splines.new('BEZIER'); s.bezier_points.add(len(pts)-1)
    for p,co in zip(s.bezier_points,pts): p.co=co; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c); current.objects.link(o); c.materials.append(M[mat]); o.parent=parent
    return o
def empty(name, pos=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None); current.objects.link(o); o.location=pos; o.parent=parent; return o
def begin(name):
    global current
    current=bpy.data.collections.new(name); bpy.context.scene.collection.children.link(current)
    return empty(name)
def animate(obj,axis,amount):
    base=obj.rotation_euler[axis]
    for frame,v in [(1,0),(16,amount),(31,0),(46,-amount),(61,0)]:
        obj.rotation_euler[axis]=base+v; obj.keyframe_insert(data_path='rotation_euler',frame=frame)
def finish(name,root,animated=False):
    bpy.context.scene.frame_set(1)
    bpy.ops.object.select_all(action='DESELECT')
    for o in current.objects: o.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{name}.glb'),export_format='GLB',use_selection=True,export_animations=animated,export_animation_mode='SCENE',export_frame_range=True)
    library.append((name,root,current))

for species in ['cat','dog','hamster','raccoon']:
    root=begin(species)
    color={'cat':'orange','dog':'tan','hamster':'tan','raccoon':'grey'}[species]
    ham=species=='hamster'; dog=species=='dog'; rac=species=='raccoon'
    body=empty('Breathing body',parent=root)
    ball('Soft body',(0,0,.53),(.42,.58 if dog else .4,.43),color,body)
    ball('Cream belly',(0,-.285,.48),(.32,.16,.3),'cream',body)
    head=empty('Expressive head',(0,-.26,.95 if not ham else .75),body)
    ball('Head',(0,0,0),(.42,.34,.36),color,head)
    if rac: ball('Bandit mask',(0,-.27,.02),(.37,.105,.13),'dark',head)
    for x in [-1,1]:
        if ham:
            ball('Round ear',(x*.31,0,.3),(.17,.10,.18),color,head)
            ball('Ear velvet',(x*.31,-.075,.31),(.11,.04,.115),'pink',head)
            ball('Cheek pouch',(x*.24,-.22,-.09),(.2,.17,.19),'cream',head)
        elif dog:
            ear=ball('Floppy ear',(x*.36,.01,-.04),(.14,.17,.36),'brown',head); ear.rotation_euler[1]=x*.25
        else:
            ear=cone('Pointed ear',(x*.27,.025,.34),.18,0,.38,color,head); ear.rotation_euler[1]=x*.22
            cone('Inner ear',(x*.27,-.06,.36),.105,0,.24,'pink',head)
        ball('Eye',(x*.145,-.306,.035),(.052,.032,.074),'dark',head)
        ball('Eye sparkle',(x*.145-.012,-.335,.059),(.014,.01,.02),'white',head)
        ball('Muzzle',(x*.075,-.315,-.1),(.12,.09,.085),'cream',head)
        for y in [-.3,.28]: ball('Paw',(x*.27,y,.15),(.16,.20,.15),'cream' if not rac else 'dark',body)
    ball('Nose',(0,-.405,-.075),(.06,.038,.043),'dark' if dog or rac else 'pink',head)
    curve('Little smile',[(-.085,-.391,-.15),(0,-.406,-.17),(.085,-.391,-.15)],.012,'dark',head)
    if not ham:
        tail=empty('Tail wag',(0,.38,.54),body)
        curve('Curved tail',[(0,0,0),(.12,.32,.1),(.24,.45,.4),(.20,.43,.64)],.09 if not rac else .14,color,tail)
        animate(tail,1,.22)
    if species=='cat':
        for x in [-1,1]:
            for z in [-.055,.02]: curve('Whisker',[(x*.28,-.3,z),(x*.56,-.32,z+.05)],.009,'cream',head)
        for i in [-1,0,1]: ball('Forehead stripe',(i*.12,-.235,.22),(.035,.035,.09),'brown',head)
    if dog:
        ball('Tongue',(0,-.377,-.21),(.065,.035,.10),'pink',head)
        curve('Blue collar',[(-.3,-.18,.72),(0,-.38,.70),(.3,-.18,.72)],.055,'blue',body)
        ball('Brass tag',(0,-.43,.67),(.065,.025,.065),'yellow',body)
    animate(head,1,.055)
    bpy.context.scene.frame_end=61
    finish(species,root,True)

root=begin('pigeon')
ball('Pear body',(0,0,.42),(.29,.4,.36),'grey',root)
ball('Iridescent neck',(0,-.19,.70),(.17,.19,.26),'mint',root)
ball('Head',(0,-.25,.87),(.19,.19,.19),'blue',root)
beak=cone('Beak',(0,-.46,.83),.065,0,.20,'yellow',root); beak.rotation_euler[0]=math.pi/2
for x in [-1,1]:
    ball('Wing',(x*.23,.06,.46),(.09,.3,.22),'blue',root)
    ball('Eye',(x*.15,-.34,.9),(.035,.034,.036),'dark',root)
    curve('Foot',[(x*.13,0,.21),(x*.13,-.03,.045),(x*.13,-.2,.045)],.022,'pink',root)
animate(root,2,.08); finish('pigeon',root,True)

for name in ['player','professor']:
    root=begin(name); prof=name=='professor'
    for x in [-1,1]:
        cube('Shoe',(x*.16,-.05,.10),(.25,.37,.19),'brown',parent=root)
        cube('Leg',(x*.16,0,.37),(.21,.23,.45),'tan' if prof else 'blue',parent=root)
    cube('Jacket',(0,0,.91),(.62,.35,.70),'white' if prof else 'yellow',.12,root)
    for x in [-1,1]:
        arm=cube('Arm',(x*.39,0,.90),(.19,.23,.60),'white' if prof else 'yellow',.08,root); arm.rotation_euler[1]=x*.14
        ball('Hand',(x*.43,-.02,.62),(.10,.10,.13),'skin',root)
    ball('Head',(0,0,1.47),(.29,.25,.32),'skin',root)
    ball('Hair',(0,.035,1.66),(.30,.245,.18),'grey' if prof else 'brown',root)
    ball('Nose',(0,-.26,1.43),(.063,.06,.073),'skin',root)
    for x in [-1,1]:
        ball('Eye',(x*.1,-.23,1.51),(.027,.02,.035),'dark',root)
        if prof: curve('Glasses',[(x*.02,-.252,1.54),(x*.13,-.27,1.58),(x*.2,-.24,1.50),(x*.10,-.27,1.46),(x*.02,-.252,1.54)],.014,'dark',root)
    if prof:
        ball('Mustache',(0,-.24,1.35),(.15,.05,.043),'grey',root)
        cube('Questionable ID',( .16,-.192,1.01),(.15,.025,.18),'yellow',.01,root)
    else:
        ball('Cap',(0,.01,1.72),(.32,.27,.12),'roof',root)
        cube('Cap brim',(0,-.26,1.69),(.42,.26,.055),'roof',.025,root)
        cube('Backpack',(0,.25,.98),(.41,.22,.46),'roof',.10,root)
    finish(name,root)

for name in ['house','garage']:
    root=begin(name); garage=name=='garage'
    cube('Foundation',(0,0,.12),(3.8,3,.24),'cream',.08,root)
    cube('Stucco',(0,0,1.35),(3.5,2.7,2.5),'plaster' if not garage else 'mint',.07,root)
    for side in [-1,1]:
        roof=cube('Terracotta roof',(side*.95,0,2.83),(2.2,3.35,.17),'roof',.04,root); roof.rotation_euler[1]=side*math.radians(28)
        for i in range(11):
            tile=cube('Roof seam',(side*.95,-1.5+i*.30,2.94),(2.23,.045,.03),'orange',.01,root); tile.rotation_euler[1]=side*math.radians(28)
    cube('Door frame',(0,-1.4,.88),(1.06,.13,1.78),'white',.025,root)
    cube('Door',(0,-1.48,.86),(.85,.06,1.64),'wood',.02,root)
    ball('Door handle',(.29,-1.55,.85),(.048,.045,.048),'yellow',root)
    for x in [-1.15,1.15]:
        cube('Window frame',(x,-1.40,1.52),(.78,.13,.92),'white',.03,root)
        cube('Window',(x,-1.49,1.52),(.61,.06,.74),'glass',.01,root)
        cube('Window cross',(x,-1.54,1.52),(.04,.03,.74),'cream',.01,root)
        cube('Window cross',(x,-1.54,1.52),(.61,.03,.04),'cream',.01,root)
        cube('Window box',(x,-1.59,.98),(.92,.34,.23),'wood',.025,root)
        for j in range(4): ball('Planter flower',(x-.3+j*.20,-1.61,1.16),(.13,.13,.14),'leaflight' if j%2 else 'pink',root)
    cube('Chimney',(1.1,.65,3.13),(.44,.48,.94),'cream',.035,root)
    if garage: cube('Blank lab sign',(0,-1.50,2.24),(2.1,.10,.39),'cream',.035,root)
    finish(name,root)

root=begin('tree')
cone('Trunk',(0,0,1),.20,.13,2,'wood',root)
for x,y,z,s in [(0,0,2.4,1.1),(-.55,0,2.1,.78),(.55,.1,2.3,.8),(0,.45,2.1,.9),(0,-.4,2.2,.83)]:
    ball('Sculpted crown',(x,y,z),(s,s*.9,s*.9),'leaflight' if x>0 else 'leaf',root)
finish('tree',root)
root=begin('fence')
for x in [-.8,0,.8]:
    cube('Picket',(x,0,.52),(.16,.14,1),'cream',.04,root)
    cone('Picket cap',(x,0,1.04),.11,0,.15,'cream',root)
for z in [.3,.73]: cube('Rail',(0,.04,z),(1.9,.12,.12),'cream',.025,root)
finish('fence',root)
root=begin('bench')
for y in [-.23,0,.23]: cube('Seat plank',(0,y,.52),(1.6,.17,.11),'wood',.03,root)
for z in [.85,1.08]: cube('Back plank',(0,.32,z),(1.6,.1,.18),'wood',.025,root)
for x in [-.59,.59]:
    cube('Leg',(x,0,.28),(.12,.48,.52),'blue',.035,root)
    cube('Back support',(x,.32,.75),(.10,.10,.82),'blue',.025,root)
finish('bench',root)
root=begin('flowers')
for i in range(7):
    x=random.uniform(-.4,.4); y=random.uniform(-.4,.4); z=random.uniform(.18,.39)
    curve('Stem',[(x,y,0),(x,y,z)],.018,'leaf',root)
    for j in range(5):
        a=j*math.tau/5; ball('Petal',(x+math.cos(a)*.055,y+math.sin(a)*.055,z),(.05,.05,.025),'white' if i%2 else 'pink',root)
    ball('Flower heart',(x,y,z+.015),(.035,.035,.022),'yellow',root)
finish('flowers',root)

for species in ['rabbit','fox','tortoise','duck','sheep','goat']:
    root=begin(species)
    color={'rabbit':'cream','fox':'orange','tortoise':'leaf','duck':'white','sheep':'white','goat':'cream'}[species]
    body=empty('Breathing body',parent=root)
    if species=='tortoise':
        ball('Domed shell',(0,.07,.39),(.50,.61,.34),'leaf',body)
        for x,y in [(0,0),(-.23,0),(.23,0),(0,.28),(0,-.27)]: ball('Shell plate',(x,y,.66 if x==0 and y==0 else .57),(.18,.21,.08),'leaflight',body)
        ball('Head',(0,-.56,.25),(.18,.23,.18),'mint',body)
        for x in [-1,1]:
            for y in [-.3,.35]: ball('Stumpy leg',(x*.38,y,.14),(.15,.18,.14),'mint',body)
            ball('Eye',(x*.105,-.735,.31),(.031,.025,.04),'dark',body)
    elif species=='duck':
        ball('Body',(0,0,.4),(.35,.48,.34),'white',body)
        ball('Green head',(0,-.30,.81),(.24,.24,.26),'leaf',body)
        ball('Bill',(0,-.56,.77),(.18,.17,.065),'yellow',body)
        for x in [-1,1]:
            ball('Wing',(x*.29,.07,.45),(.12,.30,.2),'cream',body)
            ball('Eye',(x*.17,-.45,.89),(.035,.025,.04),'dark',body)
            ball('Webbed foot',(x*.18,-.07,.08),(.14,.20,.045),'orange',body)
    else:
        ball('Body',(0,.04,.57),(.39,.49,.40),color,body)
        if species=='sheep':
            for i in range(22):
                a=i*2.4; z=.4+(i%4)*.14
                ball('Wool curl',(math.cos(a)*.32,math.sin(a)*.39+.06,z),(.20,.22,.2),'white',body)
        head=empty('Head tilt',(0,-.38,.98),body)
        ball('Head',(0,0,0),(.29,.28,.29),'grey' if species=='sheep' else color,head)
        ball('Muzzle',(0,-.25,-.10),(.19,.20 if species=='fox' else .12,.13),'cream',head)
        ball('Nose',(0,-.42 if species=='fox' else -.35,-.065),(.058,.04,.045),'dark',head)
        for x in [-1,1]:
            ball('Eye',(x*.14,-.235,.06),(.036,.025,.052),'dark',head)
            ball('Sparkle',(x*.14-.01,-.258,.077),(.01,.008,.014),'white',head)
            if species=='rabbit':
                ear=ball('Long ear',(x*.16,.015,.42),(.105,.09,.38),'cream',head); ear.rotation_euler[1]=x*.15
                pink=ball('Inner ear',(x*.16,-.065,.43),(.061,.025,.28),'pink',head); pink.rotation_euler[1]=x*.15
            elif species=='fox': cone('Fox ear',(x*.21,.02,.28),.15,0,.34,'orange',head)
            else:
                ball('Side ear',(x*.31,.015,.12),(.19,.10,.085),color,head)
                if species=='goat':
                    horn=cone('Horn',(x*.17,.05,.39),.08,.02,.40,'wood',head); horn.rotation_euler[0]=-.3
                    cone('Goatee',(0,-.18,-.30),.01,.08,.22,'white',head)
            for y in [-.27,.35]: ball('Paw',(x*.26,y,.19),(.125,.17,.18),'grey' if species in ['sheep','goat'] else 'cream',body)
        if species=='fox':
            tail=curve('Magnificent tail',[(0,.38,.52),(.18,.70,.44),(.37,.92,.69)],.17,'orange',body)
            ball('Tail tip',(.37,.92,.71),(.17,.18,.22),'white',body)
        if species=='rabbit': ball('Cotton tail',(0,.48,.51),(.18,.18,.18),'white',body)
        animate(head,1,.06)
    animate(body,2,.035)
    finish(species,root,True)

# Arrange the editable library for convenient inspection in Blender.
for i,(name,root,col) in enumerate(library): root.location=(i%5*5,i//5*5,0)
bpy.context.scene.frame_set(1)
bpy.context.scene.world.color=(.3,.3,.3)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets'/'ordinary-animals.blend'))
print('ASSET_BUILD_COMPLETE', len(library))
