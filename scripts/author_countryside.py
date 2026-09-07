"""Four independent countryside props, authored wholly inside Blender.

No region assembly and no catalog mutation. Each compact static mesh has packed
original image maps and a grounded local pivot. Leaves are actual folded geometry,
not transparent cards. A catalog proposal and isolated Blender renders are output
to artifacts for review. Run: D:/Blender/blender.exe -b --python this_file.py
"""
import bpy
import json
import math
import numpy as np
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts'
OUT.mkdir(exist_ok=True)
SIZE = 512
catalog = {}
verification = {}
random.seed(6719)
rng = np.random.default_rng(6719)


def field(cells):
    grid = rng.random((cells, cells)).astype(np.float32)
    pos = np.arange(SIZE, dtype=np.float32) * cells / SIZE
    ix = pos.astype(int)
    t = pos - ix
    t = t * t * (3 - 2 * t)
    a = grid[ix[:, None] % cells, ix[None, :] % cells]
    b = grid[(ix[:, None] + 1) % cells, ix[None, :] % cells]
    c = grid[ix[:, None] % cells, (ix[None, :] + 1) % cells]
    d = grid[(ix[:, None] + 1) % cells, (ix[None, :] + 1) % cells]
    return (a * (1-t[:, None]) + b*t[:, None]) * (1-t[None, :]) + (c*(1-t[:, None])+d*t[:, None])*t[None, :]


def surface(name, rgb, height, roughness=.9, normal_strength=.55):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*rgb.mean(axis=(0, 1)), 1)
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = roughness
    normal = np.stack([-(np.roll(height, -1, 1)-np.roll(height, 1, 1))*SIZE/2,
                       -(np.roll(height, -1, 0)-np.roll(height, 1, 0))*SIZE/2,
                       np.ones_like(height)], axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    for label, pixels in [('Colour', rgb), ('Normal', normal*.5+.5)]:
        image = bpy.data.images.new(name+' '+label, width=SIZE, height=SIZE, alpha=False)
        if label == 'Normal':
            image.colorspace_settings.name = 'Non-Color'
        image.pixels.foreach_set(np.concatenate([np.clip(pixels, 0, 1), np.ones((SIZE, SIZE, 1))], axis=-1).astype(np.float32).ravel())
        image.pack()
        texture = mat.node_tree.nodes.new('ShaderNodeTexImage')
        texture.image = image
        if label == 'Normal':
            node = mat.node_tree.nodes.new('ShaderNodeNormalMap')
            node.inputs['Strength'].default_value = normal_strength
            mat.node_tree.links.new(texture.outputs['Color'], node.inputs['Color'])
            mat.node_tree.links.new(node.outputs['Normal'], shader.inputs['Normal'])
        else:
            mat.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
    return mat


def palette():
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)/SIZE
    fine, broad, damp = field(180), field(16), field(5)
    fibres = .68*np.sin(xx*math.tau*29 + np.sin(yy*math.tau*.8 + xx*14)*2 + broad*.8) + .32*np.sin(xx*math.tau*67+np.sin(yy*9+xx*18))
    fissure = np.clip((fibres-.38)*2.7,0,1)*np.clip((damp-.14)*2,0,1)
    bark_value = .12 + broad*.065 + fine*.047 - fissure*.028 - damp*.035
    bark = surface('Weathered fibrous bark', np.stack([bark_value*1.10,bark_value*.86,bark_value*.61], -1), fissure*.004+fine*.0015, .94)
    central = np.exp(-((xx-.5)/.013)**2)
    veins = np.exp(-(np.sin((yy*8-np.abs(xx-.5)*4)*math.pi)/.12)**2)*(1-np.abs(xx-.5))
    edge = np.clip((np.abs(xx-.5)-.30)*4,0,1)
    leaf_value = .14 + broad*.12 + fine*.035 - edge*.065
    leaf = surface('Serrated bramble leaf veins', np.stack([leaf_value*.72+edge*.035,leaf_value,leaf_value*.43], -1), (central+veins*.50)*.0007+fine*.00015, .84, .4)
    flower_value = .25+fine*.05+broad*.08
    flower = surface('Faded heather calyx', np.stack([flower_value,flower_value*.63,flower_value*.77], -1), fine*.0003, .93, .35)
    moss_value = .13+fine*.095+broad*.045
    moss = surface('Wet granular moss', np.stack([moss_value*.79,moss_value,moss_value*.40], -1), fine*.003+ broad*.001, .96)
    rings = .5+.5*np.sin(np.sqrt((xx-.5)**2+(yy-.5)**2)*170+broad*1.1)
    wood_value = .26+rings*.047+fine*.045-damp*.075
    wood = surface('Split end grain', np.stack([wood_value,wood_value*.83,wood_value*.56], -1), rings*.0008+fine*.0006, .97)
    dark = bpy.data.materials.new('Wet heartwood shadow')
    dark.diffuse_color = (.032,.028,.022,1)
    dark.use_nodes = True
    dark.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = dark.diffuse_color
    dark.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = .96
    rust = bpy.data.materials.new('Old rusted staples')
    rust.diffuse_color = (.16,.065,.029,1)
    rust.use_nodes = True
    rust.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = rust.diffuse_color
    rust.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = .88
    rust.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value = .18
    return {'bark':bark,'leaf':leaf,'flower':flower,'moss':moss,'wood':wood,'dark':dark,'rust':rust}


class Builder:
    def __init__(self, name):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.name = name
        self.materials = palette()
        self.parts = {}

    def add(self, material, vertices, faces, uvs=None):
        vertices = [tuple(v) for v in vertices]
        if uvs is None:
            uvs = [(v[0]*1.7, v[2]*1.7) for v in vertices]
        dst = self.parts.setdefault(material, [[], [], []])
        offset = len(dst[0])
        dst[0].extend(vertices)
        dst[1].extend(tuple(i+offset for i in face) for face in faces)
        dst[2].extend(uvs)

    def stem(self, points, radius, material='bark', sides=5, taper=.15):
        points = [Vector(p) for p in points]
        vertices, uvs, faces = [], [], []
        for j, p in enumerate(points):
            tangent = (points[min(j+1,len(points)-1)]-points[max(0,j-1)]).normalized()
            axis = tangent.cross(Vector((0,0,1)))
            if axis.length < .1:
                axis = tangent.cross(Vector((0,1,0)))
            axis.normalize()
            cross = tangent.cross(axis).normalized()
            r = radius*(1-(1-taper)*j/(len(points)-1))
            for i in range(sides):
                angle = i*math.tau/sides
                vertices.append(p+r*(math.cos(angle)*axis+math.sin(angle)*cross))
                uvs.append((i/sides,j*.43))
        for j in range(len(points)-1):
            for i in range(sides):
                a=j*sides+i;b=j*sides+(i+1)%sides
                faces.append((a,b,b+sides,a+sides))
        faces.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+i for i in range(sides))])
        self.add(material,vertices,faces,uvs)

    def leaf(self, centre, direction, length, width, material='leaf', serrated=True):
        centre=Vector(centre);long=Vector(direction).normalized()
        across=long.cross(Vector((0,0,1)))
        if across.length<.1:across=Vector((1,0,0))
        across.normalize();normal=across.cross(long).normalized()
        outline=[(0,-.5),(-.23,-.31),(-.52,-.13),(-.39,-.06),(-.50,.10),(-.30,.27),(0,.5),(.30,.27),(.50,.10),(.39,-.06),(.52,-.13),(.23,-.31)] if serrated else [(0,-.5),(-.5,0),(0,.5),(.5,0)]
        vertices=[centre+normal*width*.10]
        vertices.extend(centre+across*x*width+long*y*length-normal*width*.07*abs(y) for x,y in outline)
        self.add(material,vertices,[(0,i+1,(i+1)%len(outline)+1) for i in range(len(outline))],[(.5,.5)]+[(x+.5,y+.5) for x,y in outline])

    def finish(self, size, colliders=None):
        all_points=np.array([v for data in self.parts.values() for v in data[0]])
        low,high=all_points.min(0),all_points.max(0)
        scale=np.array(size)/(high-low)
        centre=(low+high)/2
        objects=[]
        for material,(vertices,faces,uvs) in self.parts.items():
            # Grounded central pivot, with accurate overall dimensions.
            vertices=(np.array(vertices)-np.array([centre[0],centre[1],low[2]]))*scale
            mesh=bpy.data.meshes.new(self.name+' / '+material)
            mesh.from_pydata(vertices.tolist(),[],faces);mesh.update()
            uv=mesh.uv_layers.new(name='UVMap')
            for poly in mesh.polygons:
                poly.use_smooth=material in ['bark','moss','flower']
                for li in poly.loop_indices:uv.data[li].uv=uvs[mesh.loops[li].vertex_index]
            obj=bpy.data.objects.new(self.name+' / '+material,mesh)
            bpy.context.scene.collection.objects.link(obj)
            mesh.materials.append(self.materials[material])
            objects.append(obj)
        bpy.context.scene.unit_settings.system='METRIC'
        bpy.context.scene['authoring']='scripts/author_countryside.py'
        bpy.context.scene['scope']='One independently reusable prop; no region geometry.'
        bpy.context.scene['static_instancing']=True
        bpy.data.orphans_purge(do_recursive=True)
        for im in bpy.data.images:
            if im.users and im.has_data:im.pack()
        source=ROOT/'assets'/f'{self.name}.blend'
        model=ROOT/'game-assets/models'/f'{self.name}.glb'
        bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
        bpy.ops.export_scene.gltf(filepath=str(model),export_format='GLB',export_image_format='WEBP',export_image_quality=91,export_animations=False)
        triangles=sum(sum(len(poly.vertices)-2 for poly in obj.data.polygons) for obj in objects)
        assert triangles<14000, (self.name,triangles)
        catalog[self.name]={'source':f'assets/{self.name}.blend','model':f'models/{self.name}.glb','authoring':'scripts/author_countryside.py'}
        if colliders:catalog[self.name]['colliders']=colliders
        verification[self.name]={'triangles':triangles,'materialPrimitives':len(objects),'packedImages':sum(bool(im.packed_file) for im in bpy.data.images),'dimensions':{'x':size[0],'y':size[2],'z':size[1]},'sourceBytes':source.stat().st_size,'modelBytes':model.stat().st_size,'animations':[],'grounded':True}
        print('COUNTRYSIDE_ASSET',self.name,json.dumps(verification[self.name]),flush=True)
        self.render(objects,size)

    def render(self, objects, size):
        scene=bpy.context.scene
        scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
        scene.render.resolution_x=900;scene.render.resolution_y=780;scene.render.resolution_percentage=100
        scene.world=bpy.data.worlds.new('Review overcast sky');scene.world.use_nodes=True
        scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.29,.31,1)
        scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
        scene.view_settings.view_transform='AgX'
        bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.008))
        ground=bpy.context.object;ground.name='Review ground - not exported'
        mat=bpy.data.materials.new('Review charcoal soil');mat.diffuse_color=(.065,.075,.064,1);ground.data.materials.append(mat)
        target=Vector((0,0,size[2]*.43))
        camera_data=bpy.data.cameras.new('Review camera');camera=bpy.data.objects.new('Review camera',camera_data);scene.collection.objects.link(camera)
        camera.location=target+Vector((1.2,-1.75,1.05)).normalized()*max(size)*2.15
        camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.lens=48;scene.camera=camera
        for name,loc,energy,colour,area in [('Cloud key',(-3,-4,5),650,(.82,.90,1),5),('Dawn rim',(2,3,4),420,(1,.78,.58),3)]:
            data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.color=colour;data.shape='DISK';data.size=area
            light=bpy.data.objects.new(name,data);scene.collection.objects.link(light);light.location=loc;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(OUT/f'{self.name}-blender.png')
        bpy.ops.render.render(write_still=True)


def heather():
    b=Builder('heather-bush')
    for cane in range(31):
        angle=cane*2.399+random.uniform(-.12,.12)
        reach=random.uniform(.27,.87);height=random.uniform(.43,.77)
        points=[(.10*math.cos(angle),.10*math.sin(angle),.01),(.34*reach*math.cos(angle),.34*reach*math.sin(angle),height*.37),(.76*reach*math.cos(angle),.76*reach*math.sin(angle),height*.76),(reach*math.cos(angle),reach*math.sin(angle),height)]
        b.stem(points,.0075,'bark',5)
        for node in range(5):
            t=.24+node*.15
            segment=min(2,int(t*3))
            p=Vector(points[segment]).lerp(Vector(points[segment+1]),t*3-segment)
            for side in [-1,1]:
                direction=Vector((math.cos(angle+side*1.05),math.sin(angle+side*1.05),.32))
                tip=p+direction*(.06+.035*(1-t))
                b.stem([p,tip],.0022,'bark',3)
                for leaf_index in range(4):
                    q=p.lerp(tip,.22+leaf_index*.23)
                    leaf_angle=angle+side*1.05+(-1 if leaf_index%2 else 1)*.94
                    b.leaf(q,(math.cos(leaf_angle),math.sin(leaf_angle),.65),.080,.023,'leaf',False)
                if node>2 and cane%5:
                    # Small angular calyces, grouped along woody terminal shoots.
                    for fl in range(2):
                        q=tip+Vector((.014*math.cos(fl*3+cane),.014*math.sin(fl*3+cane),fl*.018))
                        b.stem([q,q+Vector((0,0,.027))],.0105,'flower',5,.65)
    b.finish((1.8,1.50,.80))


def bramble():
    b=Builder('bramble-hedge3m')
    for cane in range(32):
        x=-1.33+cane*2.66/31+random.uniform(-.06,.06);y=random.uniform(-.31,.31)
        drift=random.uniform(-.44,.44);height=random.uniform(.50,1.28)
        points=[]
        for k in range(8):
            t=k/7
            points.append(Vector((x+math.sin(t*2.5)*drift,y+math.sin(cane*1.9+t*2)*.19,.015+height*math.sin(t*1.85))))
        b.stem(points,.012,'bark',4)
        for k in range(1,8):
            p=points[k];angle=cane*2.399+k*2.1
            direction=Vector((math.cos(angle),math.sin(angle),.30))
            stalk_end=p+direction*.15
            b.stem([p,stalk_end],.0032,'bark',3)
            for leaflet in [-1,0,1]:
                a=angle+leaflet*.72
                long=Vector((math.cos(a),math.sin(a),random.uniform(-.2,.45)))
                centre=stalk_end+long*.045
                b.leaf(centre,long,random.uniform(.19,.28),random.uniform(.10,.15))
            if k<6:
                outward=Vector((math.cos(angle),math.sin(angle),-.4))
                b.add('bark',[p+Vector((0,0,-.014)),p+Vector((0,0,.016)),p+outward*.044],[(0,1,2)])
    b.finish((3,1,1.3),[{'x':0,'z':0,'w':3,'d':1}])


def log():
    b=Builder('mossy-fallen-log3m')
    sides=23;segments=10;vertices=[];faces=[];uv=[]
    for j in range(segments):
        x=-1.47+j*2.94/(segments-1)
        for i in range(sides):
            a=i*math.tau/sides
            radius=.22*(1+.10*math.sin(i*2.2)+.08*math.sin(j*1.7+i))
            split=.045*math.sin(i*4.3) if j in [0,segments-1] else 0
            vertices.append((x+split,radius*math.cos(a),.24+radius*math.sin(a)))
            uv.append((i/sides,j*.39))
    for j in range(segments-1):
        for i in range(sides):
            a=j*sides+i;d=j*sides+(i+1)%sides
            faces.append((a,d,d+sides,a+sides))
    b.add('bark',vertices,faces,uv)
    for end,j in [(-1,0),(1,segments-1)]:
        outer=[Vector(vertices[j*sides+i]) for i in range(sides)]
        inner=[Vector((p.x-end*.02,p.y*.53,.24+(p.z-.24)*.53)) for p in outer]
        b.add('wood',outer+inner,[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)],[(.5+p.y*1.6,.5+(p.z-.24)*1.6) for p in outer+inner])
        cavity=[p-Vector((end*.20,0,0)) for p in inner]
        b.add('dark',inner+cavity,[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]+[tuple(range(sides,2*sides))])
    for x,side in [(-.9,-1),(.27,1),(.92,-1)]:
        start=Vector((x,side*.12,.33));tip=start+Vector((.13,side*.29,.18))
        b.stem([start,tip,tip+Vector((.05,side*.045,-.016))],.056,'bark',8,.55)
    for patch in range(16):
        x=-1.30+patch*.168;y=random.uniform(-.14,.12)
        centre=Vector((x,y,.245+math.sqrt(max(0,.226**2-y*y))))
        vertices=[centre+Vector((0,0,.017))]
        for i in range(9):
            a=i*math.tau/9
            dx=math.cos(a)*random.uniform(.09,.17);dy=math.sin(a)*random.uniform(.06,.12)
            yy=max(-.209,min(.209,y+dy))
            vertices.append(Vector((x+dx,yy,.25+math.sqrt(.226**2-yy**2))))
        b.add('moss',vertices,[(0,i+1,(i+1)%9+1) for i in range(9)])
        for tuft in range(9):
            p=centre+Vector((random.uniform(-.09,.09),random.uniform(-.045,.045),.014))
            b.leaf(p,(random.uniform(-.3,.3),random.uniform(-.3,.3),1),.038,.025,'moss',False)
    b.finish((3,.77,.60),[{'x':0,'z':0,'w':3,'d':.77}])


def post():
    b=Builder('rotten-fence-post')
    outline=[(-.09,-.08),(-.03,-.092),(.082,-.08),(.093,-.015),(.083,.087),(.00,.092),(-.087,.072),(-.097,.01)]
    vertices=[];uv=[]
    for ring,z in enumerate([0,.23,1.04,1.28]):
        for i,(x,y) in enumerate(outline):
            height=z+(random.uniform(-.13,.04) if ring==3 else 0)
            vertices.append((x+ring*.005,y-ring*.011,height))
            uv.append((i/8, z*1.9))
    faces=[(j*8+i,j*8+(i+1)%8,(j+1)*8+(i+1)%8,(j+1)*8+i) for j in range(3) for i in range(8)]
    b.add('bark',vertices,faces,uv)
    b.add('wood',vertices[24:]+[(.007,-.03,1.14)],[(8,i,(i+1)%8) for i in range(8)])
    for side in [-1,1]:
        b.stem([(side*.05,-.067,1.07),(side*.073,-.069,1.37)],.022,'wood',4,.09)
    for z in [.44,.87]:
        b.stem([(-.035,-.093,z-.018),(-.043,-.119,z+.004),(-.021,-.123,z+.031),(.012,-.112,z+.013)],.006,'rust',5,1)
    for patch in range(5):
        z=.035+patch*.055
        b.leaf((-.094,.005,z),(0,0,1),.07,.045,'moss',False)
    b.finish((.21,.24,1.35),[{'x':0,'z':0,'w':.21,'d':.24}])


heather()
bramble()
log()
post()
(OUT/'countryside-catalog.json').write_text(json.dumps(catalog,indent=2))
(OUT/'countryside-verification.json').write_text(json.dumps(verification,indent=2))
print('COUNTRYSIDE_COMPLETE',json.dumps(verification),flush=True)
