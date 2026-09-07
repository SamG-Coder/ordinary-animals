"""Separate Blender-authored road signs, each saved as an editable source/GLB."""
import ast, bpy, json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
MODELS=ROOT/'game-assets/models'
catalog={}
for file,names in [
 ('author_blender.py',{'begin','link','empty','cube','cone','tube','text','plane_mesh','ellipsoid','material'}),
 ('detail_assets.py',{'setup'}),('opening_art_pass.py',{'finish'}),
]:
 tree=ast.parse((ROOT/'scripts'/file).read_text())
 exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),'Blender source helpers','exec'))

destinations=[
 ('wickmere','WICKMERE','COUNTY SCHOOL','CHILDREN CROSSING · UNSUPERVISED'),
 ('ash-end','ASH END','LETTINGS OFFICE','A HOME FOR EVERYONE WHO CAN PAY'),
 ('briarfield','BRIARFIELD','COUNTY GROUNDS','TRESPASS PERMITTED WITH A BADGE'),
 ('north-drain','NORTH DRAIN','PUMPING STATION','DRINKING WATER SOLD SEPARATELY'),
 ('blackwood','BLACKWOOD','RANGER STATION','DO NOT FEED THE APPLICANTS'),
 ('morrow-quay','MORROW QUAY','HARBOUR OFFICE','MINORS PROCEED AT THEIR OWN RISK'),
 ('st-marrow','ST. MARROW','EDUCATION OFFICE','ATTENDANCE EXCUSED UNTIL VICTORY'),
 ('hollow-crown','HOLLOW CROWN','LEAGUE INSPECTION','YOUR CHILD COULD BE OUR NEXT CLAIM'),
]
for slug,title,building,warning in destinations:
 name='waymarker-'+slug
 root=setup(name)
 material('sign-ivory',(.64,.63,.53),.58,metal=.1)
 material('sign-ink',(.018,.031,.029),.65)
 material('warning-ink',(.26,.073,.038),.82)
 material('concrete',(.21,.22,.19),.92)
 for x in [-.66,.66]:
  cube('Weathered timber upright',(x,.065,1.10),(.12,.13,2.20),'oak',.007,root)
  cone('Concrete footing',(x,.065,.09),.14,.12,.18,'concrete',root,10)
 cube('Steel folded sign back',(0,.01,1.80),(1.98,.06,.81),'rust',.028,root)
 cube('Reflective enamel face',(0,-.027,1.80),(1.92,.022,.75),'sign-ivory',.019,root)
 for z in [1.459,2.139]: cube('Printed border',(0,-.04,z),(1.80,.002,.014),'sign-ink',0,root)
 for x in [-.9,.9]: cube('Printed border',(x,-.04,1.799),(.014,.002,.68),'sign-ink',0,root)
 text('Destination',title,(0,-.044,1.94),.138 if len(title)<12 else .116,'sign-ink',parent=root)
 text('Office',building,(0,-.044,1.77),.060,'sign-ink',parent=root)
 text('Direction','COUNTY LEAGUE  >',(0,-.044,1.60),.066,'warning-ink',parent=root)
 cube('Lower regulation plaque',(0,-.015,1.15),(1.85,.046,.24),'council-green',.009,root)
 text('Small print',warning,(0,-.041,1.15),.034,'paper',parent=root)
 for x in [-.79,.79]:
  for z in [1.52,2.08]:
   bolt=cone('Rusted sign bolt',(x,-.049,z),.014,.014,.012,'rust',root,8);bolt.rotation_euler[0]=math.pi/2
 for x,z,w in [(-.77,1.47,.14),(.57,2.12,.19),(-.18,1.46,.08),(.90,1.88,.028)]:
  cube('Flaked enamel',(x,-.042,z),(w,.002,.016),'rust',0,root)
 finish(name)
 catalog[name]['colliders']=[{'x':x,'z':-.065,'w':.28,'d':.28} for x in [-.66,.66]]
 catalog[name]['authoring']='scripts/author_county_waymarkers.py'
(ROOT/'artifacts/county-waymarkers-catalog.json').write_text(json.dumps(catalog,indent=2))
print('COUNTY_WAYMARKERS_SAVED',len(catalog),flush=True)
