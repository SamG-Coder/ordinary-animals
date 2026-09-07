"""Refine the researcher and author a separate school-age rival in Blender."""
import bpy,ast,math,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=ast.parse((ROOT/'scripts'/'author_blender.py').read_text())
helpers={'link','empty','cube','cone','tube','text','plane_mesh','ellipsoid','material'}
exec(compile(ast.Module(body=[n for n in source.body if isinstance(n,ast.FunctionDef) and n.name in helpers],type_ignores=[]),'Character modeling helpers','exec'))
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets'/'gary.blend'))
current=next(c for c in bpy.data.collections if c.name=='gary');objects=list(current.objects);M={m.name:m for m in bpy.data.materials}
root=next(o for o in current.objects if o.name=='gary');head=next(o for o in current.objects if o.type=='EMPTY' and o.name.split('.')[0]=='head')
for obj in list(current.objects):
 if obj.name.startswith('Long lab coat') or obj.name.startswith('Tailored coat'):bpy.data.objects.remove(obj,do_unlink=True)
def garment(name,zmin,zmax,mat):
 verts=[];faces=[]
 for j in range(19):
  t=j/18;z=zmin+(zmax-zmin)*t
  radius=.285-.067*math.sin(t*math.pi)+.015*math.sin(t*math.pi*2)
  for i in range(41):
   a=-math.pi/2+.095+i/40*(math.tau-.19)
   fold=.007*math.sin(a*14+t*2)*(1-t)+.003*math.sin(a*25-t*5)
   verts.append(((radius+fold)*math.cos(a),(radius+fold)*math.sin(a)*.67,z))
 for j in range(18):
  for i in range(40):a=j*41+i;faces.append((a,a+1,a+42,a+41))
 mesh=plane_mesh(name,verts,faces,mat,root)
 for p in mesh.data.polygons:p.use_smooth=True
 solid=mesh.modifiers.new('Fabric thickness','SOLIDIFY');solid.thickness=.006
 return mesh
garment('Tailored coat',.65,1.46,'wall')
ellipsoid('Neck',(0,0,1.49),(.057,.065,.115),'skin',root)
for side in [-1,1]:
 ellipsoid('Ear',(side*.116,-.002,-.008),(.020,.032,.048),'skin',head)
 tube('Eyebrow',[(side*.022,-.125,.049),(side*.045,-.133,.054),(side*.069,-.122,.047)],.005,'darkFur',head)
 tube('Cheek crease',[(side*.076,-.091,-.030),(side*.066,-.104,-.065)],.0012,'darkFur',head)
cube('ID card',(-.15,-.205,1.18),(.095,.006,.13),'paper' if 'paper' in M else 'ivory',.003,root)
text('Researcher ID','GARY',(-.15,-.210,1.20),.020,'black',parent=root)
text('Researcher ID subtitle','RESEARCH',(-.15,-.210,1.17),.012,'black',parent=root)
def save(name):
 bpy.context.scene.frame_set(1)
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets'/f'{name}.blend'),compress=True)
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'game-assets'/'models'/f'{name}.glb'),export_format='GLB',export_image_format='WEBP',export_image_quality=86,export_animations=True,export_animation_mode='SCENE')
save('gary')
for obj in list(current.objects):
 if any(obj.name.startswith(s) for s in ['Tailored coat','Coat lapel','Pocket','Button','Glasses','ID card','Researcher ID','Cheek crease']):bpy.data.objects.remove(obj,do_unlink=True)
material('school-jacket',(.055,.076,.080),.91)
garment('School jacket',.92,1.46,'school-jacket')
for obj in current.objects:
 if obj.name.startswith('Sleeve'):obj.data.materials.clear();obj.data.materials.append(M['school-jacket'])
for x in [-.10,.10]:tube('Hood drawstring',[(x,-.168,1.40),(x,-.184,1.20)],.004,'ivory',root)
for side in [-1,1]:cube('Jacket pocket',(side*.14,-.169,1.07),(.12,.012,.11),'school-jacket',.012,root)
root.scale=(.77,.77,.77);head.scale=(1.06,1.06,1.06);root.name='rival';current.name='rival'
save('rival')
catalog=json.loads((ROOT/'game-assets'/'asset-catalog.json').read_text());catalog['rival']={'model':'models/rival.glb','source':'assets/rival.blend'}
(ROOT/'game-assets'/'asset-catalog.json').write_text(json.dumps(catalog,indent=2))
print('PEOPLE_REFINED')
