"""Individual animal anatomy pass. Builds one animal at a time in Blender metres.
Use -- cat to iterate a single starter; -- all authors the eight species independently.
Follow with refine_animals.py and coat_materials.py for skinning and baked materials.
"""
import bpy,ast,math,random,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
source=ast.parse((ROOT/'scripts'/'author_blender.py').read_text())
helpers={'begin','link','empty','cube','cone','tube','text','plane_mesh','ellipsoid','material','clip'}
exec(compile(ast.Module(body=[n for n in ast.walk(source) if isinstance(n,ast.FunctionDef) and n.name in helpers],type_ignores=[]),'Individual animal modeling','exec'))
# body length, shoulder height, half width, head height, head length, head width
specs={
 'cat':(.48,.31,.082,.066,.066,.066),
 'dog':(.70,.52,.125,.100,.10,.085),
 'hamster':(.145,.085,.052,.043,.039,.043),
 'rat':(.23,.075,.038,.028,.041,.028),
 'rabbit':(.32,.23,.088,.064,.066,.059),
 'fox':(.59,.37,.083,.069,.075,.057),
 'raccoon':(.48,.28,.115,.070,.079,.064),
 'goat':(.80,.61,.16,.116,.13,.077),
}
requested=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'all'
for species in specs if requested=='all' else [requested]:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 with bpy.data.libraries.load(str(ROOT/'assets'/'wall-4m.blend'),link=False) as (src,dst):dst.materials=src.materials
 M={m.name:m for m in bpy.data.materials}
 base={'cat':(.16,.15,.125),'dog':(.22,.13,.055),'hamster':(.34,.25,.14),'rat':(.09,.07,.055),'rabbit':(.38,.35,.29),'fox':(.36,.13,.025),'raccoon':(.16,.15,.12),'goat':(.39,.36,.29)}[species]
 material('fur',base,.92);material('paleFur',(.42,.38,.30),.93);material('darkFur',(.027,.023,.02),.92);material('black',(.005,.006,.005),.25);material('eye',(.055,.072,.037),.12);material('innerEar',(.22,.125,.09),.9);material('nose',(.085,.046,.033),.5)
 root=begin(species);body=empty('body',parent=root)
 length,height,width,hh,hl,hw=specs[species]
 small=species in ['hamster','rat'];rabbit=species=='rabbit';goat=species=='goat'
 center=height*(.68 if small else .78);depth=height*(.64 if species=='hamster' else .39 if small or rabbit else .31)
 ellipsoid('Ribcage',(0,-length*.035,center),(width,length*.40,depth),'fur',body)
 ellipsoid('Haunch',(0,length*.28,center*.93),(width*(1.02 if rabbit else .91),length*.25,depth*(1.16 if rabbit else .96)),'fur',body)
 headY=-length*(.42 if small or rabbit else .58);headZ=height*(.86 if small else .98 if rabbit else 1.10 if goat else 1.05)
 ellipsoid('Neck',(0,headY*.70,(center+headZ)/2),(width*.69,length*.19,depth*.93),'fur',body)
 head=empty('head',(0,headY,headZ),body)
 ellipsoid('Skull',(0,0,0),(hw,hl,hh),'fur',head)
 snout={'cat':.029,'dog':.074,'hamster':.013,'rat':.035,'rabbit':.027,'fox':.068,'raccoon':.033,'goat':.066}[species]
 muzzleY=-hl*.80-snout*.40
 ellipsoid('Muzzle',(0,muzzleY,-hh*.31),(hw*.56,snout,hh*(.29 if species in ['cat','hamster','rabbit'] else .38)),'paleFur',head)
 noseY=muzzleY-snout*.93
 ellipsoid('Nose',(0,noseY,-hh*.16),(hw*.21,snout*.18,hh*.13),'nose' if species in ['cat','hamster'] else 'black',head)
 for side in [-1,1]:
  # Eyes lie inside the skull contour instead of sitting on oversized eye-socket spheres.
  eyeX=side*hw*.65;eyeY=-hl*.68;eyeZ=hh*.13
  eyeSize=hw*(.155 if small else .18)
  ellipsoid('Eye',(eyeX,eyeY,eyeZ),(eyeSize,eyeSize*.46,eyeSize*.83),'black' if small else 'eye',head)
  ellipsoid('Pupil',(eyeX,eyeY-eyeSize*.40,eyeZ),(eyeSize*.32,eyeSize*.16,eyeSize*.65),'black',head)
  if species=='dog':
   ear=ellipsoid('Ear',(side*hw*.98,.01,-hh*.43),(hw*.40,hl*.62,hh*.88),'fur',head);ear.rotation_euler[1]=side*.2
  elif species in ['hamster','rat','raccoon']:
   ellipsoid('Ear',(side*hw*.78,hl*.16,hh*.77),(hw*.35,hl*.17,hh*.37),'fur',head)
   ellipsoid('Inner ear',(side*hw*.78,hl*.16-hl*.15,hh*.79),(hw*.22,hl*.035,hh*.24),'innerEar',head)
  elif rabbit:
   ear=ellipsoid('Ear',(side*hw*.59,hl*.20,hh*1.57),(hw*.30,hl*.22,hh*1.29),'fur',head);ear.rotation_euler[1]=side*.16
   ear=ellipsoid('Inner ear',(side*hw*.67,hl*.04,hh*1.70),(hw*.16,hl*.04,hh*.95),'innerEar',head);ear.rotation_euler[1]=side*.16
  elif goat:
   ear=ellipsoid('Ear',(side*hw*1.22,hl*.10,hh*.34),(hw*.81,hl*.23,hh*.23),'fur',head);ear.rotation_euler[1]=side*.25
  else:
   verts=[(side*hw*.35,-hl*.10,hh*.56),(side*hw*1.02,-hl*.06,hh*.52),(side*hw*.79,hl*.11,hh*1.58),(side*hw*.67,hl*.43,hh*.57)]
   plane_mesh('Ear',verts,[(0,1,2),(0,2,3),(1,3,2),(0,3,1)],'fur',head)
   plane_mesh('Inner ear',[(side*hw*.48,-hl*.115,hh*.68),(side*hw*.86,-hl*.07,hh*.65),(side*hw*.77,hl*.07,hh*1.33)],[(0,1,2)],'innerEar',head)
  if species in ['cat','hamster','rat','rabbit','raccoon']:
   for j in range(3):tube('Whisker',[(side*hw*.33,muzzleY-snout*.35,-hh*.26),(side*hw*(1.5+j*.17),muzzleY+snout*.2+j*.004,-hh*.14+j*.006)],.0003 if small else .00045,'paleFur',head)
  if species=='raccoon':
   ellipsoid('Mask',(side*hw*.63,-hl*.635,hh*.12),(hw*.31,hl*.11,hh*.23),'darkFur',head)
 legs=[]
 for front in [True,False]:
  for side in [-1,1]:
   y=-length*.25 if front else length*.28
   pivotZ=height*(.47 if small else .69)
   pivot=empty(('front' if front else 'rear')+('L' if side<0 else 'R'),(side*width*.68,y,pivotZ),body);legs.append(pivot)
   upper=width*(.27 if front else .40);lower=width*(.18 if small else .23)
   ellipsoid('Upper limb',(0,0,-pivotZ*.25),(upper,length*.075,pivotZ*.40),'fur',pivot)
   kneeY=length*(.055 if not front else -.015)
   ellipsoid('Lower limb',(0,kneeY,-pivotZ*.68),(lower,length*.033,pivotZ*.32),'fur',pivot)
   pawY=kneeY-length*.032;pawH=height*.04
   ellipsoid('Paw',(0,pawY,-pivotZ+pawH),(width*.30,length*(.10 if rabbit and not front else .067),pawH),'darkFur' if species in ['fox','goat'] else 'fur',pivot)
   if goat:
    for toe in [-1,1]:ellipsoid('Toe',(toe*width*.12,pawY-length*.03,-pivotZ+pawH),(width*.11,length*.039,pawH),'darkFur',pivot)
 tail=empty('tail',(0,length*.48,center),body)
 if species=='hamster':ellipsoid('Tail',(0,.006,-height*.25),(.012,.013,.01),'paleFur',tail)
 elif rabbit:ellipsoid('Tail',(0,.019,-height*.07),(.035,.045,.039),'paleFur',tail)
 elif species in ['fox','raccoon']:
  for i in range(7):
   t=i/6;radius=width*(.65 if species=='fox' else .52)*math.sin((t*.8+.1)*math.pi)
   ellipsoid('Tail',(0,length*(.06+t*.59),-height*(.05+t*.37)),(radius,length*.10,radius),'paleFur' if species=='fox' and i==6 else 'darkFur' if species=='raccoon' and i%2 else 'fur',tail)
 else:
  tube('Tail',[(0,0,0),(.02,length*.20,-height*.13),(.03,length*(.92 if species=='rat' else .43),-height*.17),(.04,length*(1.0 if species=='rat' else .53),height*.02)],width*(.065 if species=='rat' else .15),'fur',tail)
 if goat:
  for side in [-1,1]:tube('Horn',[(side*hw*.60,.03,hh*.74),(side*hw*.75,.065,hh*1.8),(side*hw*.80,.14,hh*2.0)],.016,'darkFur',head)
  cone('Beard',(0,-hl*.58,-hh*1.0),.006,.027,hh*.65,'paleFur',head)
 for obj in [body,head,tail,*legs]:
  for name,frames,kind in [('Idle',61,'idle'),('Walk',25,'walk'),('Attack',25,'attack'),('Hit',19,'hit'),('Faint',40,'faint')]:
   prior=[(t.name,t.strips[0].action) for t in obj.animation_data.nla_tracks] if obj.animation_data else []
   clip(obj,name,frames,kind)
   for trackname,action in prior:
    track=obj.animation_data.nla_tracks.new();track.name=trackname;track.strips.new(trackname,1,action)
 scene=bpy.context.scene;scene.frame_set(1)
 for image in bpy.data.images:
  if image.has_data:image.pack()
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets'/f'{species}.blend'))
 print('ANATOMY_AUTHORED',species,flush=True)
