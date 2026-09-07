"""Three independent layered pine trees, authored and textured inside Blender.

The editable sources retain named limbs and needle sprays. Export batches the
same rigid geometry into bark and alpha-tested needle primitives. No scene or
catalog edits. Original packed images; no downloaded textures or runtime meshes.
"""
import bpy
import json
import math
import random
import sys
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'artifacts';ART.mkdir(exist_ok=True)
catalog={};measurements={}
SIZE=1024


def image(name,pixels,normal=False):
    im=bpy.data.images.new(name,width=pixels.shape[1],height=pixels.shape[0],alpha=True)
    if normal:im.colorspace_settings.name='Non-Color'
    im.pixels.foreach_set(pixels.astype(np.float32).ravel());im.pack()
    return im


def bark_material():
    yy,xx=np.mgrid[0:SIZE,0:SIZE].astype(np.float32)/SIZE
    noise=np.random.default_rng(1251).random((SIZE,SIZE)).astype(np.float32)
    waviness=np.sin(yy*29+xx*8)*.003+np.sin(yy*81+xx*19)*.0018
    longitudinal=np.sin((xx+waviness)*math.tau*29)
    fissure=np.clip((longitudinal-.48)*3,0,1)
    plates=.5+.5*np.sin(yy*math.tau*17+np.sin(xx*math.tau*31)*1.2)
    broad=.5+.5*np.sin(xx*math.tau*7+np.sin(yy*math.tau*3))
    gray=.16+noise*.075+broad*.055-fissure*.048-plates*.024
    rgb=np.stack([gray*1.12,gray*.96,gray*.76],-1)
    moss=np.clip((broad-.70)*2.8,0,.35)*(1-yy)
    rgb[:,:,0]-=moss*.026;rgb[:,:,1]+=moss*.011
    colour=image('Pine fissured bark original colour',np.concatenate([rgb,np.ones((SIZE,SIZE,1))],-1))
    height=-fissure*.0025+noise*.0007+plates*.0011
    normal=np.stack([-(np.roll(height,-1,1)-np.roll(height,1,1))*SIZE/2,-(np.roll(height,-1,0)-np.roll(height,1,0))*SIZE/2,np.ones_like(height)],-1)
    normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
    nm=image('Pine fissured bark original normal',np.concatenate([normal*.5+.5,np.ones((SIZE,SIZE,1))],-1),True)
    mat=bpy.data.materials.new('Rain dark fissured pine bark');mat.use_nodes=True
    mat.use_backface_culling=True
    p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.92
    c=mat.node_tree.nodes.new('ShaderNodeTexImage');c.image=colour
    n=mat.node_tree.nodes.new('ShaderNodeTexImage');n.image=nm
    normal_node=mat.node_tree.nodes.new('ShaderNodeNormalMap');normal_node.inputs['Strength'].default_value=.42
    mat.node_tree.links.new(c.outputs['Color'],p.inputs['Base Color']);mat.node_tree.links.new(n.outputs['Color'],normal_node.inputs['Color']);mat.node_tree.links.new(normal_node.outputs['Normal'],p.inputs['Normal'])
    return mat


def needle_material():
    # Paint a dense twig and individual needle pairs into an original RGBA map.
    # An explicit ROUND node exports glTF MASK rather than transparent BLEND.
    rng=random.Random(62021)
    rgb=np.zeros((SIZE,SIZE,3),np.float32);alpha=np.zeros((SIZE,SIZE),np.float32)
    rgb[:]=(.084,.129,.051)
    def stroke(a,b,width,colour):
        ax,ay=a[0]*SIZE,a[1]*SIZE;bx,by=b[0]*SIZE,b[1]*SIZE
        x0=max(0,int(min(ax,bx)-width-2));x1=min(SIZE,int(max(ax,bx)+width+3))
        y0=max(0,int(min(ay,by)-width-2));y1=min(SIZE,int(max(ay,by)+width+3))
        if x1<=x0 or y1<=y0:return
        yy,xx=np.mgrid[y0:y1,x0:x1]
        dx,dy=bx-ax,by-ay
        t=np.clip(((xx-ax)*dx+(yy-ay)*dy)/(dx*dx+dy*dy+1e-9),0,1)
        distance=np.sqrt((xx-ax-dx*t)**2+(yy-ay-dy*t)**2)
        coverage=np.clip(width+.65-distance,0,1)
        use=coverage>alpha[y0:y1,x0:x1]
        rgb[y0:y1,x0:x1][use]=colour
        alpha[y0:y1,x0:x1]=np.maximum(alpha[y0:y1,x0:x1],coverage)
    trunk=[(.49,.065),(.506,.30),(.48,.54),(.513,.76),(.50,.94)]
    for a,b in zip(trunk,trunk[1:]):stroke(a,b,2.4,(.18,.14,.081))
    twigs=[]
    for j in range(5):
        t=.18+j*.13
        for side in [-1,1]:
            reach=(.21*(math.sin(t*math.pi)**.58))*rng.uniform(.78,1.12)
            a=(.50+math.sin(t*13)*.012,t)
            b=(a[0]+side*reach,t+rng.uniform(.08,.13))
            stroke(a,b,1.8,(.144,.135,.069));twigs.append((a,b))
    twigs.append(((.5,.62),(.5,.94)))
    for a,b in twigs:
        direction=np.array(b)-np.array(a);direction/=np.linalg.norm(direction)
        across=np.array([-direction[1],direction[0]])
        for k in range(90):
            t=rng.uniform(.38,1.04);centre=np.array(a)*(1-t)+np.array(b)*t
            centre+=across*rng.uniform(-.012,.012)
            theta=rng.uniform(-1.9,1.9)
            length=rng.uniform(.043,.135)*(1-.15*t)
            end=centre+(direction*math.cos(theta)+across*math.sin(theta))*length
            brightness=rng.uniform(.76,1.40)
            colour=(.107*brightness,.190*brightness,.071*brightness)
            stroke(centre,end,rng.uniform(1.55,2.45),colour)
    texture=image('Original pine twig and paired needles RGBA',np.concatenate([rgb,alpha[:,:,None]],-1))
    mat=bpy.data.materials.new('Layered pine needle cutouts');mat.use_nodes=True
    p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.86
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=texture
    clip=mat.node_tree.nodes.new('ShaderNodeMath');clip.operation='ROUND'
    mat.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color']);mat.node_tree.links.new(tex.outputs['Alpha'],clip.inputs[0]);mat.node_tree.links.new(clip.outputs[0],p.inputs['Alpha'])
    mat.use_backface_culling=False
    return mat,float(np.mean(alpha>=.5))


def mesh_object(name,vertices,faces,uvs,material,parent,smooth=False):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    uv=mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        poly.use_smooth=smooth
        values=[uvs[mesh.loops[li].vertex_index] for li in poly.loop_indices]
        wraps=material.name=='Rain dark fissured pine bark' and max(v[0] for v in values)-min(v[0] for v in values)>.5
        for li,value in zip(poly.loop_indices,values):uv.data[li].uv=(value[0]+(1 if wraps and value[0]<.5 else 0),value[1])
    obj=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(obj);obj.parent=parent;mesh.materials.append(material)
    return obj


def tube(name,points,radii,material,parent,sides=7):
    points=[Vector(p) for p in points];vertices=[];uvs=[];faces=[];distance=0
    for j,p in enumerate(points):
        if j:distance+=(points[j]-points[j-1]).length
        tangent=(points[min(j+1,len(points)-1)]-points[max(0,j-1)]).normalized()
        a=tangent.cross(Vector((0,0,1)))
        if a.length<.1:a=tangent.cross(Vector((0,1,0)))
        a.normalize();b=tangent.cross(a).normalized()
        for i in range(sides):
            angle=i*math.tau/sides
            r=radii[j]*(1+.065*math.sin(i*2.7+j*.71))
            vertices.append(tuple(p+r*(a*math.cos(angle)+b*math.sin(angle))))
            uvs.append((i/sides,distance*.48))
    for j in range(len(points)-1):
        for i in range(sides):
            a=j*sides+i;b=j*sides+(i+1)%sides;faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+i for i in range(sides))])
    return mesh_object(name,vertices,faces,uvs,material,parent,True)


def spray(vertices,faces,uvs,origin,direction,length,width,roll):
    along=Vector(direction).normalized();across=along.cross(Vector((0,0,1)))
    if across.length<.1:across=Vector((1,0,0))
    across.normalize();normal=across.cross(along).normalized()
    across=across*math.cos(roll)+normal*math.sin(roll);normal=across.cross(along).normalized()
    origin=Vector(origin);offset=len(vertices)
    # A shallow folded spray has volume and a changing normal at oblique views.
    for row,t in enumerate([0,1]):
        for side in [-1,0,1]:
            centre=origin+along*(t-.10)*length
            vertices.append(tuple(centre+across*side*width*.5+normal*(1-abs(side))*.048*length))
            uvs.append(((side+1)*.5,t))
    for row in range(1):
        for col in range(2):
            a=offset+row*3+col;faces.append((a,a+1,a+4,a+3))


def author(index,height,spread,crown_start,seed):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    name=f'pine-natural-{index}';rng=random.Random(seed)
    root=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(root)
    bark=bark_material();needle,coverage=needle_material()
    trunk_points=[];trunk_radii=[]
    for j in range(21):
        t=j/20;z=t*(height-.18)
        drift=max(0,t-.19)**1.3
        x=drift*(.12 if index!=2 else -.34)+math.sin(t*8+index)*drift*.10
        y=math.sin(t*4+index*.7)*drift*.14
        trunk_points.append(Vector((x,y,z)))
        trunk_radii.append(.215*(1-t)**1.24+.006)
    trunk=tube('Grounded tapered fissured trunk',trunk_points,trunk_radii,bark,root,16)
    # The collar is broad at ground contact but remains inside the .46 m square.
    for v in trunk.data.vertices:
        if v.co.z<.6:v.co.x=max(-.228,min(.228,v.co.x));v.co.y=max(-.228,min(.228,v.co.y));v.co.z=max(0,v.co.z)
    limb_count=0;spray_count=0
    layers=11 if index<3 else 12
    for layer in range(layers):
        frac=layer/(layers-1)
        z=crown_start+(height-crown_start-.45)*frac+rng.uniform(-.12,.12)
        level=max(0,min(19,z/(height-.18)*20));base=trunk_points[int(level)].lerp(trunk_points[min(20,int(level)+1)],level%1)
        branches=5 if layer<layers-3 else 4
        if index==3 and layer in [0,4]:branches=3
        for branch in range(branches):
            angle=branch*math.tau/branches+layer*2.399+index*.78+rng.uniform(-.18,.18)
            radial=Vector((math.cos(angle),math.sin(angle),0));sideways=Vector((-radial.y,radial.x,0))
            taper=(1-frac)**.72
            length=(.30+spread*taper)*rng.uniform(.72,1.10)
            if index==2:length*=1+.20*math.cos(angle+.5)
            start=base+Vector((0,0,rng.uniform(-.13,.13)))
            droop=(-.30*(1-frac)+.04)*rng.uniform(.65,1.3)
            bend=rng.uniform(-.18,.18)
            pts=[start,start+radial*length*.31+Vector((0,0,droop*.6)),start+radial*length*.69+sideways*bend+Vector((0,0,droop)),start+radial*length+sideways*bend*.6+Vector((0,0,.13+frac*.14))]
            radius=(.043*(1-frac)+.012)*rng.uniform(.8,1.10)
            tube(f'Layer {layer+1:02d} limb {branch+1:02d}',pts,[radius,radius*.72,radius*.39,.006],bark,root,6)
            vertices=[];faces=[];uvs=[]
            secondary=6 if frac<.70 else 5
            for j in range(secondary):
                t=.22+j*(.72/(secondary-1));seg=min(2,int(t*3));p=pts[seg].lerp(pts[seg+1],t*3-seg)
                for side in [-1,1]:
                    outward=(radial*.33+sideways*side*.87).normalized()
                    twig_length=(.28+length*.24)*(1-t*.45)*rng.uniform(.77,1.10)
                    tip=p+outward*twig_length+Vector((0,0,rng.uniform(-.02,.15)))
                    tube(f'Layer {layer+1:02d} limb {branch+1:02d} twig {j*2+(side+1)//2:02d}',[p,p.lerp(tip,.53)+Vector((0,0,-.035)),tip],[radius*.28,radius*.15,.0025],bark,root,3)
                    for q in [.43,1.0]:
                        at=p.lerp(tip,q)
                        d=(outward+radial*rng.uniform(.15,.40)+Vector((0,0,rng.uniform(.07,.45)))).normalized()
                        card_length=rng.uniform(.36,.51)*(1-frac*.22)
                        for roll in [rng.uniform(-.33,.33),math.pi*.5+rng.uniform(-.35,.35)]:
                            spray(vertices,faces,uvs,at,d,card_length,card_length*rng.uniform(.48,.68),roll);spray_count+=1
            for q in [.61,.82,1.02]:
                at=pts[-2].lerp(pts[-1],q)
                for roll in [0,1.4]:
                    spray(vertices,faces,uvs,at,radial+Vector((0,0,.45)),.45*(1-frac*.25),.27,roll);spray_count+=1
            mesh_object(f'Layer {layer+1:02d} limb {branch+1:02d} folded needle sprays',vertices,faces,uvs,needle,root)
            limb_count+=1
    # Broken lower limbs make the stem read as a living forest tree.
    for j in range(6):
        z=.95+j*.22;angle=j*2.399+index;radial=Vector((math.cos(angle),math.sin(angle),0))
        origin=Vector((0,0,z));reach=rng.uniform(.17,.38)
        tube(f'Old snapped branch {j+1}',[origin,origin+radial*reach*.6+Vector((0,0,-.03)),origin+radial*reach+Vector((0,0,.06))],[.018,.012,.005],bark,root,5)
    # Terminal growth stops the crown ending as a bare telephone pole.
    vertices=[];faces=[];uvs=[]
    for j in range(9):
        a=j*2.399;point=trunk_points[-1]-Vector((0,0,.05+j*.045))
        spray(vertices,faces,uvs,point,Vector((math.cos(a)*.30,math.sin(a)*.30,1)),.38,.21,a);spray_count+=1
    mesh_object('Terminal leader needle tufts',vertices,faces,uvs,needle,root)
    # Normalise vertical extent only; trunk pivot and base width remain exact.
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    zmax=max(v.co.z for o in meshes for v in o.data.vertices)
    for o in meshes:
        for v in o.data.vertices:v.co.z*=height/zmax
    root['authoring']='Original Blender pine; editable limbs, paired needle map, layered cutout sprays'
    root['height_metres']=height;root['collision_width_metres']=.46;root['needle_sprays']=spray_count
    root['static_instancing']=True
    bpy.context.scene.unit_settings.system='METRIC'
    bpy.data.orphans_purge(do_recursive=True)
    for im in bpy.data.images:
        if im.users and im.has_data:im.pack()
    points=[v.co for o in meshes for v in o.data.vertices]
    low=[min(v[a] for v in points) for a in range(3)];high=[max(v[a] for v in points) for a in range(3)]
    triangles=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
    source=ROOT/'assets'/f'{name}.blend';model=ROOT/'game-assets/models'/f'{name}.glb'
    bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
    # The source remains individually editable; the GLB has two material batches.
    for mat in [bark,needle]:
        bpy.ops.object.select_all(action='DESELECT')
        group=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials[0]==mat]
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();bpy.context.object.name=name+' / '+mat.name
    bpy.ops.export_scene.gltf(filepath=str(model),export_format='GLB',export_image_format='WEBP',export_image_quality=93,export_animations=False,export_extras=True)
    catalog[name]={'model':f'models/{name}.glb','source':f'assets/{name}.blend','colliders':[{'x':0,'z':0,'w':.46,'d':.46}]}
    measurements[name]={'height':height,'minimum':low,'maximum':high,'triangles':triangles,'sourceMeshes':len(meshes),'exportPrimitives':2,'branchLimbs':limb_count,'needleSprays':spray_count,'needleTextureCoverage':coverage,'packedMaps':3,'modelBytes':model.stat().st_size}
    (ART/f'{name}-catalog-fragment.json').write_text(json.dumps(catalog[name],indent=2))
    print('PINE_ASSET',name,json.dumps(measurements[name]),flush=True)
    if '--skip-review' not in sys.argv:review(name,height,spread)


def review(name,height,spread):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True;scene.cycles.transparent_max_bounces=32
    scene.world=bpy.data.worlds.new('Review overcast sky');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.25,.31,.34,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.70
    scene.view_settings.view_transform='AgX';scene.render.resolution_x=1050;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.014));ground=bpy.context.object;ground.name='Review ground only'
    mat=bpy.data.materials.new('Review forest floor');mat.diffuse_color=(.066,.076,.061,1);ground.data.materials.append(mat)
    for name_light,pos,power,colour,size in [('Overcast key',(-4,-6,11),1700,(.80,.89,1),7),('Cloud rim',(5,4,9),1300,(.77,.86,1),6)]:
        data=bpy.data.lights.new(name_light,'AREA');data.energy=power;data.color=colour;data.shape='DISK';data.size=size
        obj=bpy.data.objects.new(name_light,data);scene.collection.objects.link(obj);obj.location=pos;obj.rotation_euler=(Vector((0,0,height*.5))-obj.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('Review camera');cam=bpy.data.objects.new('Review camera',data);scene.collection.objects.link(cam);scene.camera=cam
    for label,pos,target,lens in [('full',(height*.70,-height*1.75,height*.53),(0,0,height*.50),49),('child-view',(.8,-5.2,1.25),(0,0,height*.40),27),('detail',(.5,-2.9,2.10),(0,0,2.35),50)]:
        cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();data.lens=lens
        scene.render.filepath=str(ART/f'{name}-{label}.png');bpy.ops.render.render(write_still=True)


for args in [(1,7.3,1.95,1.70,12081),(2,8.7,2.28,2.0,12082),(3,10.1,2.63,2.70,12083)]:author(*args)
(ART/'natural-pines-catalog-fragment.json').write_text(json.dumps(catalog,indent=2))
(ART/'natural-pines-measurements.json').write_text(json.dumps(measurements,indent=2))
print('NATURAL_PINES_COMPLETE',json.dumps(catalog),flush=True)
