"""Exact-size roof cores and separate edge flashing for modular domestic rooms."""
import ast,bpy,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];MODELS=ROOT/'game-assets/models';catalog={}
for file,names in [('author_blender.py',{'begin','link','empty','cube','cone','tube','text','plane_mesh','ellipsoid','material'}),('detail_assets.py',{'setup'}),('opening_art_pass.py',{'finish'})]:
 tree=ast.parse((ROOT/'scripts'/file).read_text())
 exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),'Roof helpers','exec'))

r=setup('roof-panel-4m')
material('roof',(.055,.062,.069),.85)
cube('Exact four metre metal roof deck',(0,0,0),(4,4,.13),'roof',.003,r)
for i in range(16):cube('Standing metal seam',(-1.875+i*.25,0,.079),(.014,4,.028),'steel',.002,r)
finish('roof-panel-4m')
for width in [2,4]:
 name=f'roof-eave-{width}m';r=setup(name)
 material('weathered-fascia',(.20,.22,.18),.86)
 material('rain-gutter',(.055,.061,.057),.54,metal=.4)
 # -Y is outside. The finished deck and flashing share an edge at Y=0.
 cube('Boarded fascia',(0,-.095,-.035),(width,.18,.20),'weathered-fascia',.005,r)
 cube('Roof edge cap',(0,-.135,.08),(width,.29,.024),'rain-gutter',.003,r)
 vertices=[];faces=[]
 for x in [-width/2,width/2]:
  for i in range(13):
   angle=math.pi+i*math.pi/12;vertices.append((x,-.29+math.cos(angle)*.075,-.06+math.sin(angle)*.075))
 for i in range(12):faces.append((i,i+1,14+i,13+i))
 gutter=plane_mesh('Open half-round gutter',vertices,faces,'rain-gutter',r)
 gutter.modifiers.new('Gutter wall thickness','SOLIDIFY').thickness=.004
 for x in [-width*.38,0,width*.38]:cube('Gutter support clip',(x,-.255,-.06),(.025,.16,.075),'rain-gutter',.005,r)
 finish(name)
for entry in catalog.values():entry['authoring']='scripts/author_roof_modules.py'
(ROOT/'artifacts/roof-modules-catalog.json').write_text(json.dumps(catalog,indent=2))
print('ROOF_MODULES_SAVED',len(catalog),flush=True)
