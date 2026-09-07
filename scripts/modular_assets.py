"""Reusable architecture, road, terrain and vegetation assets. Executed by author_blender.py.
World placement belongs to src/world.js. This file never creates a region-sized scene.
"""

root=begin('wall-4m')
cube('Plaster',(0,0,1.5),(4,.18,3),'wall',.005,root)
cube('Skirting',(0,-.108,.10),(4,.055,.20),'ivory',.004,root)
cube('Picture rail',(0,-.105,2.66),(4,.04,.042),'oak',.003,root)
export('wall-4m')
root=begin('wall-door-4m')
for x in [-1.36,1.36]:cube('Wall pier',(x,0,1.5),(1.28,.18,3),'wall',.005,root)
cube('Lintel',(0,0,2.68),(1.44,.18,.64),'wall',.005,root)
for x in [-.76,.76]:cube('Architrave',(x,-.11,1.17),(.09,.06,2.34),'ivory',.003,root)
cube('Architrave top',(0,-.11,2.38),(1.6,.06,.09),'ivory',.003,root)
export('wall-door-4m')
root=begin('wall-window-4m')
for x in [-1.95,1.95]:cube('Pier',(x,0,1.5),(.1,.18,3),'wall',.002,root)
cube('Below window',(0,0,.49),(3.8,.18,.98),'wall',.002,root)
cube('Above window',(0,0,2.8),(3.8,.18,.4),'wall',.002,root)
export('wall-window-4m')
root=begin('floor-4m');cube('Floor',(0,0,-.065),(4,4,.13),'oak',0,root);export('floor-4m')
root=begin('ceiling-4m');cube('Ceiling',(0,0,.065),(4,4,.13),'wall',0,root);export('ceiling-4m')
root=begin('exterior-wall-4m');cube('Brick wall',(0,0,1.5),(4,.16,3),'brick',.003,root);export('exterior-wall-4m')
root=begin('roof-4m')
cube('Roof deck',(0,0,0),(4.3,4.3,.13),'roof',.01,root)
for i in range(17):cube('Standing seam',(-2.05+i*.255,0,.075),(.014,4.3,.025),'steel',.002,root)
export('roof-4m')
root=begin('window-exterior')
cube('Sill',(0,-.12,.92),(1.5,.36,.10),'road',.008,root)
for x in [-.68,.68,0]:cube('Frame',(x,0,1.8),(.065,.10,1.7),'ivory',.007,root)
for z in [1,1.8,2.6]:cube('Frame',(0,0,z),(1.42,.10,.065),'ivory',.007,root)
cube('Glass',(0,.025,1.8),(1.30,.016,1.53),'glass',0,root)
export('window-exterior')
root=begin('porch-step');cube('Step',(0,0,-.04),(2,1,.08),'road',.014,root);export('porch-step')

# Whole houses are small reusable building assets, not merged with terrain or streets.
for name,w,d,h in [('terrace-house',8,7,6),('clinic-building',12,10,4.4),('league-building',14,12,5)]:
    root=begin(name)
    cube('Brick shell',(0,0,h/2),(w,d,h),'brick',.02,root)
    for side in [-1,1]:
        roof=cube('Pitched roof',(side*w*.25,0,h+.68),(w*.59,d+.55,.15),'roof',.01,root);roof.rotation_euler[1]=side*math.radians(26)
    cube('Gutter',(0,-d/2-.18,h-.06),(w+.45,.10,.12),'steel',.005,root)
    for x in [-w/2+.25,w/2-.25]:tube('Downpipe',[(x,-d/2-.16,h),(x,-d/2-.16,.25)],.038,'steel',root)
    for level in range(2 if name=='terrace-house' else 1):
        for x in [-w*.30,w*.30]:
            z=1.9+level*2.7
            cube('Window frame',(x,-d/2-.025,z),(1.45,.10,1.7),'ivory',.007,root)
            cube('Window glass',(x,-d/2-.09,z),(1.30,.017,1.55),'glass',0,root)
            cube('Window transom',(x,-d/2-.105,z),(1.3,.025,.055),'ivory',.003,root)
            cube('Window mullion',(x,-d/2-.105,z),(.055,.025,1.55),'ivory',.003,root)
    cube('Front door',(0,-d/2-.055,1.14),(1.12,.07,2.28),'oak',.015,root)
    cube('Door letterbox',(0,-d/2-.10,1.16),(.26,.025,.065),'steel',.006,root)
    cube('Door lintel',(0,-d/2-.15,2.34),(1.5,.22,.11),'road',.01,root)
    if name!='terrace-house':
        cube('Fascia',(0,-d/2-.13,h-.46),(w-.7,.13,.61),'black',.005,root)
        text('Sign','COUNTY RESEARCH' if name=='clinic-building' else 'COUNTY ANIMAL LEAGUE',(0,-d/2-.205,h-.57),.25,'paper',parent=root)
    export(name)

root=begin('road-straight-12m')
cube('Asphalt',(0,0,-.04),(8,12,.08),'road',0,root)
for x in [-3.75,3.75]:cube('Edge marking',(x,0,.007),(.08,12,.009),'paper',0,root)
for y in [-4,0,4]:cube('Centre dash',(0,y,.012),(.10,2,.008),'paper',0,root)
export('road-straight-12m')
root=begin('road-junction-12m');cube('Junction',(0,0,-.035),(12,12,.07),'road',0,root);export('road-junction-12m')
root=begin('path-2m');cube('Path',(0,0,-.025),(1.6,2,.05),'road',.003,root)
for y in [-.95,0,.95]:cube('Paving joint',(0,y,.002),(1.6,.013,.005),'black',0,root)
export('path-2m')
root=begin('pavement-4m');cube('Pavement',(0,0,.035),(2,4,.07),'road',.006,root)
for y in [-1.5,-.5,.5,1.5]:cube('Slab seam',(0,y,.074),(2,.012,.004),'black',0,root)
cube('Kerb',(-.98,0,.07),(.14,4,.14),'ivory',.01,root);export('pavement-4m')
root=begin('ground-tile-40m')
verts=[];faces=[]
for j in range(11):
    for i in range(11):verts.append((-20+i*4,-20+j*4,-.055))
for j in range(10):
    for i in range(10):a=j*11+i;faces.append((a,a+1,a+12,a+11))
plane_mesh('Soil',verts,faces,'ground',parent=root,uvscale=5);export('ground-tile-40m')
root=begin('ground-mound-40m');verts=[];faces=[]
for j in range(17):
    for i in range(17):
        x=-20+i*2.5;y=-20+j*2.5;z=3*math.sin(math.pi*i/16)*math.sin(math.pi*j/16)+.2*math.sin(x*.4)*math.sin(y*.3)
        verts.append((x,y,z-.055))
for j in range(16):
    for i in range(16):a=j*17+i;faces.append((a,a+1,a+18,a+17))
o=plane_mesh('Low hill',verts,faces,'ground',parent=root,uvscale=5)
for p in o.data.polygons:p.use_smooth=True
export('ground-mound-40m')

for variant in range(3):
    root=begin(f'pine-{variant+1}')
    h=7+variant*1.5
    cone('Trunk',(0,0,h/2),.23,.025,h,'bark',root,12)
    for layer in range(8):
        z=1.6+layer*h*.10;radius=(h-z)*.34
        for branch in range(5):
            a=branch*math.tau/5+layer*.71+variant
            end=Vector((math.cos(a)*radius,math.sin(a)*radius,z+.13))
            tube('Branch',[(0,0,z),tuple(end*.60+Vector((0,0,z*.4))),tuple(end)],.018,'bark',root)
            # Narrow radial sprays, not toy-like foliage spheres or stacked cones.
            for spray in range(4):
                s=(spray+1)/4;centre=end*s+Vector((0,0,z*(1-s)))
                for direction in [-1,1]:
                    tangent=Vector((-math.sin(a),math.cos(a),.12))*radius*.28*direction
                    v=[tuple(centre-Vector((0,0,.05))),tuple(centre+tangent+Vector((0,0,-.20))),tuple(centre+Vector((math.cos(a),math.sin(a),.13))*radius*.34)]
                    plane_mesh('Needle spray',v,[(0,1,2)],'leaf',root)
    export(f'pine-{variant+1}')
root=begin('birch')
cone('Trunk',(0,0,4),.16,.022,8,'ivory',root,12)
for i in range(12):
    a=i*2.4;z=2.2+i*.4;end=(math.cos(a)*1.8,math.sin(a)*1.8,z+.7)
    tube('Bare branch',[(0,0,z),(end[0]*.6,end[1]*.6,z+.3),end],.017,'bark',root)
    for j in range(4):
        p=Vector(end)*(.5+j*.16)+Vector((0,0,z*(.5-j*.16)))
        tube('Twig',[tuple(p),tuple(p+Vector((math.cos(a+.7)*.55,math.sin(a+.7)*.55,.25)))],.005,'bark',root)
export('birch')
root=begin('grass-clump')
for i in range(23):
    a=i*2.4;r=random.uniform(0,.28);x=math.cos(a)*r;y=math.sin(a)*r;h=random.uniform(.2,.62)
    plane_mesh('Blade',[(x-.012,y,0),(x+.012,y,0),(x+math.sin(a)*.10,y+math.cos(a)*.08,h)],[(0,1,2)],'moss',root)
export('grass-clump')
root=begin('rock')
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(0,0,.45));o=link(bpy.context.object,'Rock','road',root);o.scale=(1.3,.85,.65)
for v in o.data.vertices:v.co*=random.uniform(.86,1.13)
export('rock')
root=begin('fence-3m')
for x in [-1.45,1.45]:cube('Post',(x,0,.65),(.09,.10,1.3),'oak',.007,root)
for z in [.40,1.0]:cube('Rail',(0,0,z),(3,.07,.10),'oak',.005,root)
for i in range(17):cube('Picket',(-1.42+i*.177,-.05,.65),(.13,.025,1.1),'oak',.008,root)
export('fence-3m')
root=begin('streetlamp')
cone('Pole',(0,0,2.8),.07,.04,5.6,'steel',root,12)
tube('Swan neck',[(0,0,5.5),(0,-.3,5.9),(0,-.75,5.9)],.04,'steel',root)
cube('Lamp housing',(0,-.75,5.83),(.23,.50,.10),'steel',.025,root);cube('Diffuser',(0,-.75,5.766),(.19,.44,.015),'lamp',.01,root)
export('streetlamp')
root=begin('utility-pole');cone('Pole',(0,0,4),.10,.065,8,'bark',root,12);cube('Cross arm',(0,0,7.3),(1.8,.12,.15),'oak',.01,root);export('utility-pole')
root=begin('wire-span-16m')
for x in [-.65,.65]:tube('Cable',[(x,0,0),(x,8,-.55),(x,16,0)],.009,'black',root)
export('wire-span-16m')
root=begin('rain');plane_mesh('Drop',[(-.006,0,0),(.006,0,0),(.006,0,.23),(-.006,0,.23)],[(0,1,2,3)],'coldglass',root);export('rain')

# Shared collision dimensions refer to each asset's local pivot, in Three.js metres.
for name,boxes in {
 'wall-4m':[{'x':0,'z':0,'w':4,'d':.18}],
 'wall-door-4m':[{'x':-1.36,'z':0,'w':1.28,'d':.18},{'x':1.36,'z':0,'w':1.28,'d':.18}],
 'wall-window-4m':[{'x':0,'z':0,'w':4,'d':.18}],
 'bed':[{'x':0,'z':0,'w':1.65,'d':2.4}],
 'desk':[{'x':0,'z':0,'w':2.8,'d':1.02}],
 'wardrobe':[{'x':0,'z':0,'w':1.05,'d':1.25}],
 'terrace-house':[{'x':0,'z':0,'w':8,'d':7}],
 'clinic-building':[{'x':0,'z':0,'w':12,'d':10}],
 'league-building':[{'x':0,'z':0,'w':14,'d':12}],
}.items():catalog[name]['colliders']=boxes
(OUT/'asset-catalog.json').write_text(json.dumps(catalog,indent=2),encoding='utf-8')
(OUT/'bedroom-layout.json').write_text(json.dumps(room_layout,indent=2),encoding='utf-8')
print('MODULAR_ASSET_LIBRARY_COMPLETE',len(catalog),flush=True)
