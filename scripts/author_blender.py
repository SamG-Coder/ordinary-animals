"""All visible world assets, procedural textures and animation are authored in Blender.
Run with Blender 5.2: blender -b --factory-startup --python scripts/author_blender.py
No stock meshes, downloaded textures, or runtime-generated world geometry.
"""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector, noise
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'game-assets'; MODELS=OUT/'models'; TEX=ROOT/'assets'/'textures'
for p in [MODELS,TEX,ROOT/'assets']: p.mkdir(parents=True,exist_ok=True)
random.seed(81)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M={}; current=None; objects=[]; collisions=[]; lights=[]; catalog={}; room_layout=[]

def procedural_image(name,kind,c1,c2,size=1024):
    """Blender's noise basis authors original tiling surface color and tangent normals."""
    image=bpy.data.images.new(name,width=size,height=size,alpha=False)
    values=[]; heights=[]
    for y in range(size):
        for x in range(size):
            u=x/size;v=y/size
            n=noise.fractal(Vector((u*9,v*9,2.7)),1.0,2,4)
            fine=noise.noise(Vector((u*120,v*120,3)))
            if kind=='wood':
                n=.48+.09*math.sin(u*650+noise.noise(Vector((u*14,v*3,1)))*2)+.10*noise.noise(Vector((u*150,v*5,2)))+.05*fine
                seam=1 if (u*6)%1<.015 or ((v*3+int(u*6)*.37)%1)<.013 else 0
                n=n*(1-seam)*.8
            elif kind=='brick':
                row=int(v*10);seam=1 if (v*10)%1<.07 or (u*5+(row%2)*.5)%1<.035 else 0
                n=.45+.14*n+.13*fine-seam*.4
            elif kind=='fabric': n=.5+.10*n+.09*math.sin(u*950)*math.sin(v*950)
            elif kind=='bark':n=.4+.2*math.sin(u*50+noise.noise(Vector((u*8,v*3,1)))*7)+.15*fine
            elif kind=='plaster':n=.52+.04*n+.045*fine
            else:n=.45+.15*n+.12*fine
            n=max(0,min(1,n));heights.append(n)
            values.extend([c1[i]+(c2[i]-c1[i])*n for i in range(3)]+[1])
    image.pixels.foreach_set(values);image.filepath_raw=str(TEX/f'{name}.png');image.file_format='PNG';image.save();image.pack()
    normal=bpy.data.images.new(name+'_normal',width=size,height=size,alpha=False);normal.colorspace_settings.name='Non-Color'
    pixels=[]
    for y in range(size):
        for x in range(size):
            dx=(heights[y*size+(x+1)%size]-heights[y*size+(x-1)%size])*.7
            dy=(heights[((y+1)%size)*size+x]-heights[((y-1)%size)*size+x])*.7
            vec=Vector((-dx,-dy,1)).normalized();pixels.extend([vec.x*.5+.5,vec.y*.5+.5,vec.z*.5+.5,1])
    normal.pixels.foreach_set(pixels);normal.filepath_raw=str(TEX/f'{name}_normal.png');normal.file_format='PNG';normal.save();normal.pack()
    return image,normal

def material(name,color,rough=.8,texture=None,emission=0,metal=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal
    if emission:b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=emission
    if texture:
        im,norm=texture;node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=im;m.node_tree.links.new(node.outputs['Color'],b.inputs['Base Color'])
        n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=norm;conv=m.node_tree.nodes.new('ShaderNodeNormalMap');conv.inputs['Strength'].default_value=.65;m.node_tree.links.new(n.outputs['Color'],conv.inputs['Color']);m.node_tree.links.new(conv.outputs['Normal'],b.inputs['Normal'])
    M[name]=m;return m

for n,kind,c1,c2 in [
 ('oak','wood',(.06,.027,.012),(.32,.22,.12)),('wall','plaster',(.24,.26,.24),(.55,.53,.45)),
 ('road','stone',(.025,.03,.034),(.10,.105,.11)),('ground','stone',(.024,.038,.016),(.15,.18,.085)),
 ('brick','brick',(.045,.037,.033),(.26,.16,.10)),('bark','bark',(.025,.022,.015),(.15,.12,.07)),
 ('cloth','fabric',(.045,.065,.073),(.18,.24,.24)),('fur','fabric',(.10,.077,.045),(.39,.29,.16))]:
    material(n,c2,texture=procedural_image(n,kind,c1,c2))
for n,c,r in [('black',(.008,.01,.012),.55),('steel',(.20,.22,.23),.4),('paper',(.58,.55,.43),.95),('ivory',(.55,.53,.45),.8),('glass',(.022,.057,.07),.18),('moss',(.08,.11,.037),.9),('leaf',(.021,.042,.021),.9),('roof',(.055,.062,.069),.85),('red',(.18,.028,.018),.8),('skin',(.34,.19,.12),.8),('eye',(.042,.052,.023),.16),('paleFur',(.37,.34,.27),.9),('darkFur',(.034,.03,.024),.9)]:material(n,c,r)
material('lamp',(1,.53,.22),emission=3);material('coldglass',(.16,.24,.31),emission=.8);material('led',(.48,.035,.01),emission=2)

def begin(name):
    global current,objects
    current=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(current);objects=[]
    return empty(name)
def link(o,name,mat=None,parent=None):
    o.name=name
    for c in list(o.users_collection):c.objects.unlink(o)
    current.objects.link(o);objects.append(o)
    if mat:o.data.materials.append(M[mat])
    if parent:o.parent=parent
    return o
def empty(name,pos=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None);current.objects.link(o);objects.append(o);o.location=pos;o.parent=parent;return o
def cube(name,pos,scale,mat='oak',bevel=.01,parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=link(bpy.context.object,name,mat,parent);o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:mod=o.modifiers.new('Edge wear','BEVEL');mod.width=bevel;mod.segments=2;o.modifiers.new('Normals','WEIGHTED_NORMAL')
    return o
def ellipsoid(name,pos,scale,mat='fur',parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=pos);o=link(bpy.context.object,name,mat,parent);o.scale=scale
    for p in o.data.polygons:p.use_smooth=True
    return o
def cone(name,pos,r1,r2,depth,mat='steel',parent=None,verts=20):
    bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r2,depth=depth,location=pos);o=link(bpy.context.object,name,mat,parent)
    for p in o.data.polygons:p.use_smooth=True
    return o
def tube(name,points,radius,mat='steel',parent=None):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=2;c.use_fill_caps=True;s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for p,co in zip(s.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c);current.objects.link(o);objects.append(o);c.materials.append(M[mat]);o.parent=parent;return o
def text(name,body,pos,size,mat='paper',rotation=(math.pi/2,0,0),parent=None):
    c=bpy.data.curves.new(name,'FONT');c.body=body;c.size=size;c.extrude=.0007;c.align_x='CENTER'
    o=bpy.data.objects.new(name,c);current.objects.link(o);objects.append(o);o.location=pos;o.rotation_euler=rotation;o.parent=parent;c.materials.append(M[mat]);return o
def light(name,pos,color,power):
    d=bpy.data.lights.new(name,'POINT');d.energy=power;d.color=color;d.shadow_soft_size=.13;o=bpy.data.objects.new(name,d);current.objects.link(o);objects.append(o);o.location=pos;return o
def plane_mesh(name,verts,faces,mat,parent=None,uvscale=1):
    m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update();uv=m.uv_layers.new(name='UVMap')
    for p in m.polygons:
        for li in p.loop_indices:
            v=m.vertices[m.loops[li].vertex_index].co;uv.data[li].uv=(v.x/uvscale,v.y/uvscale)
    o=bpy.data.objects.new(name,m);current.objects.link(o);objects.append(o);m.materials.append(M[mat]);o.parent=parent;return o
def export(name,animated=False):
    bpy.context.scene.frame_set(1);bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=str(MODELS/f'{name}.glb'),export_format='GLB',use_selection=True,export_animations=animated,export_animation_mode='SCENE',export_frame_range=True,export_lights=True,export_extras=True)
    save_source(name)
def save_source(name):
    source=ROOT/'assets'/f'{name}.blend'
    bpy.data.libraries.write(str(source),{current},fake_user=True)
    catalog[name]={'model':f'models/{name}.glb','source':f'assets/{name}.blend'}
def collision(x,z,w,d):collisions.append({'x':x,'z':z,'w':w,'d':d})

# The opening bedroom is authored at real-world scale, in Blender metres.
room=begin('bedroom')
cube('Floor',(0,0,-.07),(8,8,.14),'oak',0)
cube('Ceiling',(0,0,3.05),(8,8,.15),'wall',0)
for x in [-4,4]:cube('Wall',(x,0,1.5),(.18,8,3),'wall',0);collision(x,0,.18,8)
for x,w in [(-2.93,2.14),(2.93,2.14)]:cube('Window wall',(x,4,1.5),(w,.18,3),'wall',0);collision(x,-4,w,.18)
cube('Below window',(0,4,.5),(3.8,.18,1),'wall',0);cube('Above window',(0,4,2.76),(3.8,.18,.5),'wall',0);collision(0,-4,3.8,.18)
for x,w in [(-2.36,3.28),(2.36,3.28)]:cube('Door wall',(x,-4,1.5),(w,.18,3),'wall',0);collision(x,4,w,.18)
cube('Door lintel',(0,-4,2.7),(1.5,.18,.6),'wall',0)
for x in [-3.89,3.89]:cube('Skirting',(x,0,.11),(.055,7.8,.22),'ivory',.005)
for y in [-3.89,3.89]:cube('Skirting',(0,y,.11),(7.8,.055,.22),'ivory',.005)
for x in [-1.84,0,1.84]:cube('Window mullion',(x,3.90,1.8),(.065,.10,1.62),'ivory',.007)
for z in [1.0,1.8,2.6]:cube('Window frame',(0,3.9,z),(3.75,.10,.065),'ivory',.007)
cube('Window sill',(0,3.72,.96),(4,.40,.09),'ivory',.015)
# Slatted blinds and two folded curtains, with vertex-level shape-key animation.
for z in [2.50,2.42,2.34]:cube('Bent blind',(0,3.77,z),(3.65,.13,.035),'ivory',.008)
for side in [-1,1]:
    verts=[];faces=[]
    for iz in range(21):
        for ix in range(15):
            x=side*(1.53+ix/14*.8);z=.42+iz/20*2.25;y=3.56+.095*math.sin(ix/14*math.pi*8)+.025*math.sin(iz*.4)
            verts.append((x,y,z))
    for iz in range(20):
        for ix in range(14):a=iz*15+ix;faces.append((a,a+1,a+16,a+15))
    curtain=plane_mesh('Curtain',verts,faces,'cloth');curtain.shape_key_add(name='Basis');key=curtain.shape_key_add(name='Draught')
    for v in key.data:v.co.y+=.085*(1-v.co.z/3)*math.sin(v.co.x*4+v.co.z)
    for frame,value in [(1,0),(45,1),(90,0)]:key.value=value;key.keyframe_insert(data_path='value',frame=frame)
    for p in curtain.data.polygons:p.use_smooth=True
cube('Bed frame',(2,-.6,.29),(1.55,2.35,.35),'oak',.035);collision(2,.6,1.65,2.4)
cube('Mattress',(2,-.6,.53),(1.5,2.25,.24),'ivory',.09)
for x in [1.25,2.75]:cube('Bed leg',(x,-1.5,.20),(.09,.10,.4),'oak')
cube('Headboard',(2,.60,.83),(1.64,.09,.94),'oak',.025)
cube('Pillow',(2,.18,.72),(1,.51,.19),'ivory',.08)
verts=[];faces=[]
for iy in range(37):
    for ix in range(29):
        x=1.18+ix/28*1.64;y=-1.8+iy/36*1.73;z=.69+.027*math.sin(ix*.8+iy*.35)+.014*math.sin(iy*1.4)
        if ix in [0,28]:z-=.25
        verts.append((x,y,z))
for iy in range(36):
    for ix in range(28):a=iy*29+ix;faces.append((a,a+1,a+30,a+29))
blanket=plane_mesh('Rumpled blanket',verts,faces,'cloth',uvscale=1)
for p in blanket.data.polygons:p.use_smooth=True
cube('Bedside cabinet',(3.30,.2,.36),(.55,.58,.72),'oak',.012)
for z in [.19,.45,.66]:cube('Drawer front',(3.3,-.103,z),(.51,.025,.18),'oak');cone('Pull',(3.3,-.135,z),.018,.018,.07,'steel').rotation_euler[0]=math.pi/2
cone('Bedside lamp base',(3.3,.2,.77),.13,.13,.035,'steel');cone('Lamp stem',(3.3,.2,.98),.014,.014,.40,'steel');cone('Lampshade',(3.3,.2,1.22),.24,.13,.31,'paper');cone('Bulb',(3.3,.2,1.14),.055,.055,.08,'lamp');light('Bedside tungsten',(3.3,.2,1.13),(1,.57,.29),28)
cube('Desk',(-2.15,2.75,.77),(2.8,1.02,.10),'oak',.018);collision(-2.15,-2.75,2.85,1.08)
for x in [-3.43,-.87]:cube('Desk side',(x,2.8,.39),(.12,.90,.75),'oak',.005)
cube('Desk drawers',(-3.0,2.8,.44),(.65,.83,.6),'oak')
for z in [.25,.44,.63]:cube('Drawer face',(-3,2.35,z),(.59,.03,.15),'oak');cube('Handle',(-3,2.30,z),(.17,.028,.016),'steel',.006)
cube('Note',(-1.35,2.6,.835),(.45,.32,.008),'paper',.001)
text('Note heading','YOU ARE TEN.',(-1.35,2.63,.841),.034,'black',(0,0,0))
text('Note footer','GARY IS EXPECTING YOU.',(-1.35,2.53,.841),.018,'black',(0,0,0))
cube('Desk radio',(-2.78,2.82,1.02),(.52,.20,.31),'black',.025)
for i in range(16):cube('Speaker grille',(-2.92+i*.019,2.71,1.02),(.003,.006,.22),'steel',0)
for x in [-2.65,-2.53]:cone('Radio dial',(x,2.69,.96),.032,.032,.029,'steel').rotation_euler[0]=math.pi/2
cube('Radio display',(-2.59,2.709,1.10),(.16,.008,.056),'led',.003)
text('Frequency','88.1',(-2.59,2.696,1.085),.034,'paper')
tube('Radio aerial',[(-2.64,2.85,1.18),(-2.52,2.88,1.72)],.004)
cone('Desk lamp foot',(-.93,3.07,.84),.13,.13,.035,'steel');tube('Desk lamp neck',[(-.93,3.07,.86),(-.93,3.07,1.45),(-1.18,2.97,1.55)],.014)
shade=cone('Desk lamp shade',(-1.18,2.97,1.48),.13,.065,.22,'steel');shade.rotation_euler[1]=-.30
light('Desk task light',(-1.18,2.94,1.30),(1,.70,.39),18)
for i in range(7):
    b=cube('School book',(-2.1+i*.082,3.02,.96),(.06,.31,.28),'red' if i%3 else 'cloth',.003);b.rotation_euler[1]=.07*(i%3-1)
chair=empty('Chair',(-2,1.55,0))
cube('Chair seat',(0,0,.46),(.49,.47,.05),'oak',.025,chair)
for x in [-.2,.2]:
    for y in [-.19,.19]:cube('Chair leg',(x,y,.24),(.035,.035,.47),'steel',.005,chair)
for x in [-.21,.21]:cube('Chair upright',(x,-.19,.74),(.04,.035,.59),'steel',.005,chair)
cube('Chair back',(0,-.19,.85),(.48,.06,.25),'oak',.025,chair)
cube('Wardrobe',(-3.4,-2.6,1.13),(1.05,1.25,2.26),'oak',.012);collision(-3.4,2.6,1.05,1.25)
for y in [-2.88,-2.32]:cube('Wardrobe hinge',(-2.86,y,1.13),(.016,.025,.6),'steel',.003)
cube('Old rug',(-.45,-.4,.012),(2.5,3.3,.023),'cloth',.009)
for i in range(3):
    cube('Moving box',(-3.5,.2+i*.55,.23),(.57,.47,.46),'paper',.01)
    cube('Packing tape',(-3.5,.2+i*.55,.467),(.08,.47,.005),'ivory',0)
cube('Wall calendar',(-3.895,1.3,1.75),(.012,.5,.7),'paper',.002)
for i in range(2):
    shoe=ellipsoid('School shoe',(-.8+i*.28,-2.5,.06),(.1,.22,.07),'black');shoe.rotation_euler[2]=i*.3
bpy.context.scene.frame_end=90
# Export furniture as independent, reusable assets with local pivots.
room_objects=list(objects); room_collection=current
groups={
 'bed':(('Bed frame','Mattress','Bed leg','Headboard','Pillow','Rumpled blanket'),(2,-.6,0)),
 'bedside-table':(('Bedside cabinet','Drawer front','Pull'),(3.3,.2,0)),
 'bedside-lamp':(('Bedside lamp base','Lamp stem','Lampshade','Bulb','Bedside tungsten'),(3.3,.2,.75)),
 'desk':(('Desk','Desk side','Desk drawers','Drawer face','Handle'),(-2.15,2.75,0)),
 'desk-lamp':(('Desk lamp foot','Desk lamp neck','Desk lamp shade','Desk task light'),(-.93,3.07,.82)),
 'letter':(('Note','Note heading','Note footer'),(-1.35,2.6,.83)),
 'radio':(('Desk radio','Speaker grille','Radio dial','Radio display','Frequency','Radio aerial'),(-2.78,2.82,.86)),
 'books':(('School book',),(-2.1,3.02,.82)),
 'chair':(('Chair',),(-2,1.55,0)),
 'wardrobe':(('Wardrobe','Wardrobe hinge'),(-3.4,-2.6,0)),
 'rug':(('Old rug',),(-.45,-.4,0)),
 'storage-boxes':(('Moving box','Packing tape'),(-3.5,.2,0)),
 'calendar':(('Wall calendar',),(-3.895,1.3,1.75)),
 'shoes':(('School shoe',),(-.8,-2.5,0)),
 'curtains':(('Curtain',),(0,3.56,0)),
 'window-interior':(('Window mullion','Window frame','Window sill','Bent blind'),(0,4,0)),
}
used=set()
for asset_name,(names,origin) in groups.items():
    selected=[o for o in room_objects if o.name.split('.')[0] in names]
    selected+=list({child for o in selected for child in o.children_recursive if child not in selected})
    root=begin(asset_name);root.location=origin
    bpy.context.view_layer.update()
    for o in selected:
        if o in used:continue
        matrix=o.matrix_world.copy()
        room_collection.objects.unlink(o);current.objects.link(o);objects.append(o)
        if o.parent not in selected:o.parent=root;o.matrix_world=matrix
        used.add(o)
    root.location=(0,0,0)
    export(asset_name,asset_name=='curtains')
    room_layout.append({'asset':asset_name,'x':origin[0],'y':origin[2],'z':-origin[1]})
# The remaining shell is stored only as an authoring reference. Runtime rooms use wall modules.
current=room_collection;objects=list(current.objects)
door=begin('door');cube('Door leaf',(.7,0,1.14),(1.4,.075,2.28),'oak',.012,door)
for z in [.61,1.67]:cube('Inset door panel',(.7,-.045,z),(1.14,.025,.75),'oak',.012,door)
cone('Door handle',(1.2,-.10,1.02),.03,.03,.11,'steel',door).rotation_euler[0]=math.pi/2
export('door')
torch=begin('torch');cone('Torch grip',(0,0,0),.035,.035,.22,'black',torch);cone('Torch head',(0,0,.16),.064,.038,.10,'steel',torch);cone('Torch glass',(0,0,.217),.058,.058,.01,'lamp',torch);export('torch')
carrier=begin('carrier');cube('Carrier lower',(0,0,.15),(.44,.66,.30),'cloth',.055,carrier);cube('Carrier top',(0,0,.38),(.43,.64,.18),'ivory',.07,carrier)
for x in [-.16,-.08,0,.08,.16]:tube('Carrier bars',[(x,-.34,.08),(x,-.34,.43)],.009,'steel',carrier)
for z in [.13,.28,.40]:tube('Carrier grid',[(-.19,-.34,z),(.19,-.34,z)],.007,'steel',carrier)
tube('Carrier handle',[(-.08,0,.48),(-.08,0,.55),(.08,0,.55),(.08,0,.48)],.018,'black',carrier);export('carrier')

# Articulated natural-proportion animals. Joint transform clips are exported, not runtime fakes.
for species in ['cat','dog','hamster','rat','fox','rabbit','raccoon','goat']:
    root=begin(species);body=empty('body',parent=root)
    small=species in ['hamster','rat'];rabbit=species=='rabbit';dog=species in ['dog','fox'];goat=species=='goat'
    length=.37 if species=='hamster' else .65 if small else .94 if rabbit else 1.3 if dog or goat else .95
    height=.17 if small else .48 if rabbit else .8 if goat else .64 if dog else .50
    width=length*(.31 if species=='hamster' else .19)
    coat='paleFur' if rabbit or goat else 'darkFur' if species=='rat' else 'fur'
    ellipsoid('Ribcage',(0,.02,height*.73),(width,length*.36,height*.29),coat,body)
    ellipsoid('Haunch',(0,length*.28,height*.67),(width*.94,length*.21,height*.28),coat,body)
    neck=ellipsoid('Neck',(0,-length*.30,height*.82),(width*.70,length*.16,height*.28),coat,body)
    head=empty('head',(0,-length*.41,height*.95),body)
    ellipsoid('Skull',(0,0,0),(width*.77,length*.125,height*.20),coat,head)
    snout=.16 if dog or goat else .045 if not small else .03
    ellipsoid('Muzzle',(0,-length*.115-snout,-height*.065),(width*.48,length*.085+snout,height*.08),'paleFur',head)
    ellipsoid('Nose',(0,-length*.19-snout*1.8,-height*.025),(width*.21,.024 if not small else .008,height*.047),'black',head)
    for side in [-1,1]:
        ellipsoid('Eye socket',(side*width*.61,-length*.069,height*.035),(width*.23,length*.037,height*.055),'darkFur',head)
        ellipsoid('Eye',(side*width*.65,-length*.094,height*.045),(width*.115,.012 if not small else .004,height*.033),'eye',head)
        ellipsoid('Eye highlight',(side*width*.66,-length*.103,height*.055),(.003,.002,.003),'ivory',head)
        if species in ['dog']:
            ear=ellipsoid('Ear',(side*width*.83,.006,-height*.04),(width*.24,length*.09,height*.23),'darkFur',head);ear.rotation_euler[1]=side*.13
        elif small:
            ellipsoid('Ear',(side*width*.62,.02,height*.15),(width*.34,.013,height*.12),coat,head)
        else:
            ear=cone('Ear',(side*width*.58,.008,height*(.36 if rabbit else .19)),width*.35,.005,height*(.48 if rabbit else .23),coat,head);ear.rotation_euler[1]=side*.14
        for j in range(3):
            if species in ['cat','hamster','rat','rabbit','raccoon']:
                tube('Whisker',[(side*width*.38,-length*.15,-height*.045),(side*width*1.55,-length*.14+j*.025,-height*.03+j*.006)],.0008,'paleFur',head)
    legs=[]
    for front in [True,False]:
        for side in [-1,1]:
            y=-length*.24 if front else length*.27
            pivot=empty(('front' if front else 'rear')+('L' if side<0 else 'R'),(side*width*.68,y,height*.63),body);legs.append(pivot)
            ellipsoid('Upper limb',(0,0,-height*.14),(width*.31,length*.069,height*.24),coat,pivot)
            ellipsoid('Lower limb',(0,-length*.015,-height*.42),(width*.18,length*.036,height*.20),coat,pivot)
            ellipsoid('Paw',(0,-length*.07,-height*.57),(width*.28,length*.085,height*.055),'darkFur' if species in ['fox','rat'] else coat,pivot)
            for toe in [-1,0,1]:ellipsoid('Toe',(toe*width*.15,-length*.125,-height*.57),(width*.08,length*.025,height*.032),coat,pivot)
    tail=empty('tail',(0,length*.49,height*.65),body)
    if species!='hamster':
        if rabbit:ellipsoid('Tail',(0,.01,0),(.08,.085,.08),'paleFur',tail)
        else:tube('Tail',[(0,0,0),(0,length*.17,-height*.05),(.02,length*.39,-height*.20),(.025,length*.55,-height*.08)],width*(.35 if species in ['fox','raccoon'] else .12),'darkFur' if species=='rat' else coat,tail)
    if goat:
        for side in [-1,1]:tube('Horn',[(side*.10,-.005,.13),(side*.13,.05,.27),(side*.15,.17,.34)],.025,'darkFur',head)
        tube('Beard',[(0,-.16,-.07),(0,-.13,-.24)],.033,'paleFur',head)
    if species=='raccoon':
        for side in [-1,1]:ellipsoid('Mask',(side*width*.60,-length*.078,height*.025),(width*.34,.016,height*.06),'darkFur',head)
    # NLA tracks merge same-named per-joint clips into Idle/Walk/Attack/Hit/Faint.
    def clip(obj,name,frames,kind):
        obj.animation_data_clear();base_loc=obj.location.copy();base_rot=obj.rotation_euler.copy();base_scale=obj.scale.copy()
        for frame in range(1,frames+1,3):
            t=(frame-1)/(frames-1);obj.location=base_loc;obj.rotation_euler=base_rot;obj.scale=base_scale
            if kind=='idle':
                if obj==body:obj.scale.z=1+.012*math.sin(t*math.tau)
                if obj==head:obj.rotation_euler[2]=.055*math.sin(t*math.tau)
                if obj==tail:obj.rotation_euler[2]=.15*math.sin(t*math.tau)
            if kind=='walk':
                if obj in legs:obj.rotation_euler[0]=.40*math.sin(t*math.tau+(0 if legs.index(obj) in [0,3] else math.pi))
                if obj==body:obj.location.z+=.013*math.sin(t*math.tau*2)
                if obj==tail:obj.rotation_euler[2]=.12*math.sin(t*math.tau)
            if kind=='attack':
                hit=math.sin(t*math.pi)**3
                if obj==body:obj.location.y-=length*.55*hit;obj.rotation_euler[0]=-.15*hit
                if obj==head:obj.rotation_euler[0]=.4*hit
                if obj in legs:obj.rotation_euler[0]=-.40*hit
            if kind=='hit' and obj==body:obj.location.y+=length*.16*math.sin(t*math.pi);obj.rotation_euler[2]=.18*math.sin(t*math.pi*3)
            if kind=='faint' and obj==body:obj.rotation_euler[1]=-math.pi/2*min(1,t*2);obj.location.z-=height*.38*min(1,t*2)
            obj.keyframe_insert(data_path='location',frame=frame);obj.keyframe_insert(data_path='rotation_euler',frame=frame);obj.keyframe_insert(data_path='scale',frame=frame)
        action=obj.animation_data.action;action.name=f'{species}_{obj.name}_{name}'
        obj.animation_data.action=None;track=obj.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,1,action);strip.action_frame_end=frames
        obj.location=base_loc;obj.rotation_euler=base_rot;obj.scale=base_scale
        return track
    # Preserve the individual action tracks between animation creation calls.
    for obj in [body,head,tail,*legs]:
        tracks=[]
        for name,frames,kind in [('Idle',61,'idle'),('Walk',25,'walk'),('Attack',25,'attack'),('Hit',19,'hit'),('Faint',40,'faint')]:
            prior=[(t.name,t.strips[0].action) for t in obj.animation_data.nla_tracks] if obj.animation_data else []
            clip(obj,name,frames,kind)
            for trackname,action in prior:
                tr=obj.animation_data.nla_tracks.new();tr.name=trackname;tr.strips.new(trackname,1,action)
    bpy.context.scene.frame_set(1);bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(MODELS/f'{species}.glb'),export_format='GLB',use_selection=True,export_animation_mode='NLA_TRACKS',export_animations=True,export_frame_range=False)
    save_source(species)

# A human at human scale. Coat folds and hands are modeled in Blender.
person=begin('gary')
for side in [-1,1]:
    ellipsoid('Boot',(side*.11,-.07,.075),(.087,.18,.078),'black',person)
    leg=ellipsoid('Trouser',(side*.11,0,.47),(.092,.11,.40),'darkFur',person)
    arm=empty('arm'+str(side),(side*.25,0,1.36),person)
    ellipsoid('Sleeve',(side*.025,0,-.22),(.085,.10,.28),'wall',arm)
    ellipsoid('Hand',(side*.04,-.005,-.50),(.058,.038,.095),'skin',arm)
    for finger in range(4):ellipsoid('Finger',(side*.04+(finger-1.5)*.020,-.007,-.58),(.010,.016,.045),'skin',arm)
    for f,v in [(1,-.035),(40,.035),(79,-.035)]:arm.rotation_euler[0]=v;arm.keyframe_insert(data_path='rotation_euler',frame=f)
coat=cone('Long lab coat',(0,0,1.03),.29,.22,.75,'wall',person,32);coat.scale.y=.63
cube('Shirt',(0,-.15,1.32),(.22,.04,.34),'cloth',.015,person)
for side in [-1,1]:
    lapel=cube('Coat lapel',(side*.105,-.17,1.32),(.09,.035,.34),'ivory',.006,person);lapel.rotation_euler[1]=side*.23
    cube('Pocket',(side*.18,-.17,.99),(.14,.018,.14),'wall',.006,person)
for z in [.92,1.06,1.19]:ellipsoid('Button',(.055,-.186,z),(.012,.008,.012),'black',person)
head=empty('head',(0,0,1.66),person)
ellipsoid('Face',(0,-.02,0),(.12,.105,.17),'skin',head);ellipsoid('Hair',(0,.018,.075),(.126,.108,.105),'darkFur',head)
ellipsoid('Nose',(0,-.124,-.014),(.023,.035,.041),'skin',head)
for side in [-1,1]:
    ellipsoid('Eye',(side*.043,-.119,.023),(.018,.008,.009),'ivory',head);ellipsoid('Pupil',(side*.043,-.126,.023),(.007,.004,.007),'black',head)
    tube('Glasses',[(side*.010,-.134,.035),(side*.045,-.139,.055),(side*.081,-.13,.032),(side*.045,-.14,.006),(side*.010,-.134,.035)],.003,'steel',head)
tube('Mouth',[(-.033,-.111,-.067),(0,-.12,-.070),(.033,-.111,-.067)],.003,'darkFur',head)
for f,v in [(1,-.025),(40,.025),(79,-.025)]:head.rotation_euler[2]=v;head.keyframe_insert(data_path='rotation_euler',frame=f)
bpy.context.scene.frame_end=79;export('gary',True)


exec(compile((ROOT/'scripts'/'modular_assets.py').read_text(encoding='utf-8'), 'modular_assets.py', 'exec'))
