"""A separately editable crossing guard, with inherited Blender idle animation and a new uniform."""
import bpy,ast,math,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
for file,names in [('author_blender.py',{'link','empty','cube','cone','tube','text','plane_mesh','ellipsoid','material'}),('refine_people.py',{'garment','save'})]:
 tree=ast.parse((ROOT/'scripts'/file).read_text());exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),'Character helpers','exec'))
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/gary.blend'))
current=next(c for c in bpy.data.collections if c.name=='gary');objects=list(current.objects);M={m.name:m for m in bpy.data.materials}
root=bpy.data.objects['gary'];head=next(o for o in current.objects if o.type=='EMPTY' and o.name.split('.')[0]=='head')
for o in list(current.objects):
 if any(o.name.startswith(prefix) for prefix in ['Tailored coat','Coat lapel','Pocket','Button','Glasses','ID card','Researcher ID']):bpy.data.objects.remove(o,do_unlink=True)
material('Rainproof navy',(.018,.026,.034),.74);material('Weathered safety vest',(.25,.29,.055),.9);material('Reflective silver',(.48,.51,.49),.31,metal=.15);material('Sign red',(.40,.026,.017),.63)
M['skin'].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.29,.205,.16,1)
for o in current.objects:
 if o.name.startswith(('Sleeve','Shirt','Trouser')):o.data.materials.clear();o.data.materials.append(M['Rainproof navy'])
 if o.name.startswith('Pupil'):o.scale*=.72
 if o.name.startswith('Face'):
  for v in o.data.vertices:
   if v.co.z<0:v.co.x*=1+.19*v.co.z
coat=garment('Waterproof jacket',.91,1.46,'Rainproof navy')
vest=garment('High visibility vest',.99,1.45,'Weathered safety vest');vest.scale.x=1.025;vest.scale.y=1.04
# Reflective tape follows the same curved cloth surface as the vest.
for z0,z1 in [(1.045,1.10),(1.23,1.275)]:
 verts=[];faces=[]
 for z in [z0,z1]:
  t=(z-.99)/.46;radius=(.285-.067*math.sin(t*math.pi)+.015*math.sin(t*math.pi*2))
  for i in range(41):
   a=-math.pi/2+.095+i/40*(math.tau-.19);r=radius+.007*math.sin(a*14+t*2)*(1-t)+.003*math.sin(a*25-t*5)+.004
   verts.append((r*math.cos(a)*1.025,r*math.sin(a)*.67*1.04,z))
 for i in range(40):faces.append((i,i+1,i+42,i+41))
 plane_mesh('Sewn reflective tape',verts,faces,'Reflective silver',root)
for side in [-1,1]:
 tube('Upper eyelid',[(side*.025,-.122,.026),(side*.043,-.128,.032),(side*.061,-.12,.026)],.003,'skin',head)
 tube('Lower eyelid',[(side*.025,-.122,.02),(side*.043,-.127,.017),(side*.061,-.12,.022)],.002,'skin',head)
cap=ellipsoid('Rain cap',(0,.015,.113),(.13,.113,.075),'Rainproof navy',head)
ellipsoid('Cap peak',(0,-.10,.101),(.135,.10,.012),'Rainproof navy',head)
text('Staff label','COUNTY',(-.14,-.182,1.34),.018,'ivory',parent=root)
arm=next(o for o in current.objects if o.name=='arm-1')
cone('Crossing staff',(-.04,-.025,-.27),.014,.014,1.18,'Reflective silver',arm)
sign=cone('Stop sign',(-.04,-.025,.37),.23,.23,.022,'ivory',arm,32);sign.rotation_euler[0]=math.pi/2
ring=cone('Red stop border',(-.04,-.039,.37),.213,.213,.007,'Sign red',arm,32);ring.rotation_euler[0]=math.pi/2
center=cone('Stop sign face',(-.04,-.045,.37),.180,.180,.006,'ivory',arm,32);center.rotation_euler[0]=math.pi/2
text('Stop instruction','STOP',(-.04,-.05,.385),.068,'black',parent=arm)
text('Children crossing','CHILDREN',(-.04,-.05,.32),.025,'black',parent=arm)
root.name='crossing-guard';current.name='crossing-guard'
bpy.data.orphans_purge(do_recursive=True)
for im in bpy.data.images:
 if im.users and im.has_data:im.pack()
save('crossing-guard')
catalog=json.loads((ROOT/'game-assets/asset-catalog.json').read_text());catalog['crossing-guard']={'model':'models/crossing-guard.glb','source':'assets/crossing-guard.blend'}
(ROOT/'game-assets/asset-catalog.json').write_text(json.dumps(catalog,indent=2));print('CROSSING_GUARD_COMPLETE')

