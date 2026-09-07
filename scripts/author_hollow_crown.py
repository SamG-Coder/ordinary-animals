"""Separate concrete office, camera mast, barrier and notices authored in Blender."""
import ast,bpy,json,math
import numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];MODELS=ROOT/'game-assets/models';catalog={}
for file,names in [('author_blender.py',{'begin','link','empty','cube','cone','tube','text','plane_mesh','ellipsoid','material'}),('detail_assets.py',{'setup'}),('opening_art_pass.py',{'finish'})]:
 tree=ast.parse((ROOT/'scripts'/file).read_text())
 exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),'Blender library helpers','exec'))

def palette(name):
 r=setup(name)
 material('inspection-concrete',(.34,.35,.32),.93)
 material('inspection-metal',(.052,.064,.061),.48,metal=.55)
 material('inspection-glass',(.046,.088,.092),.23,metal=.3)
 material('inspection-red',(.26,.045,.027),.67)
 material('inspection-enamel',(.55,.55,.44),.53)
 size=512;yy,xx=np.mgrid[0:size,0:size]/size
 rng=np.random.default_rng(147)
 value=.52+.028*rng.standard_normal((size,size))+.025*np.sin(xx*21+np.sin(yy*9))-.02*(yy*8%1<.025)
 value=np.clip(value,0,1)
 pixels=np.empty((size,size,4),np.float32)
 for channel,tint in enumerate([.62,.64,.58]):pixels[:,:,channel]=value*tint
 pixels[:,:,3]=1
 image=bpy.data.images.new('Cast concrete pores and shutter seams',size,size,alpha=False);image.pixels.foreach_set(pixels.ravel());image.pack()
 m=M['inspection-concrete'];bsdf=m.node_tree.nodes.get('Principled BSDF');tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;m.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
 dy,dx=np.gradient(value);normal=np.stack([-dx*1.1,-dy*1.1,np.ones_like(value)],axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
 pixels[:,:,:3]=normal*.5+.5
 image=bpy.data.images.new('Cast concrete normal',size,size,alpha=False);image.colorspace_settings.name='Non-Color';image.pixels.foreach_set(pixels.ravel());image.pack()
 tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;conv=m.node_tree.nodes.new('ShaderNodeNormalMap');conv.inputs['Strength'].default_value=.65;m.node_tree.links.new(tex.outputs['Color'],conv.inputs['Color']);m.node_tree.links.new(conv.outputs['Normal'],bsdf.inputs['Normal'])
 return r
def save(name,colliders,animated=False):
 finish(name,animated);catalog[name]['colliders']=colliders;catalog[name]['authoring']='scripts/author_hollow_crown.py'

r=palette('league-inspection-office')
cube('Concrete foundation',(0,0,.10),(10.6,8.4,.20),'inspection-concrete',.035,r)
cube('Flat roof slab',(0,0,5.75),(10.9,8.65,.28),'inspection-concrete',.025,r)
for x in [-5.15,5.15]:cube('Gable concrete wall',(x,0,2.85),(.30,8.2,5.5),'inspection-concrete',.012,r)
cube('Rear wall',(0,4.0,2.85),(10.4,.30,5.5),'inspection-concrete',.012,r)
for z in [.6,3.0,5.45]:cube('Front concrete spandrel',(0,-4.0,z),(10.4,.30,1.00 if z==.6 else .35),'inspection-concrete',.012,r)
for x in [-5,-2.6,0,2.6,5]:cube('Vertical precast mullion',(x,-4.04,2.85),(.25,.39,5.5),'inspection-concrete',.012,r)
for x in [-3.8,-1.3,1.3,3.8]:
 for z in [1.92,4.22]:
  cube('Recessed office glazing',(x,-3.89,z),(2.12,.06,1.96),'inspection-glass',.006,r)
  for sx in [x-1.10,x+1.10]:cube('Aluminium window jamb',(sx,-3.98,z),(.05,.12,2.06),'inspection-metal',.004,r)
  for height in [z-1,z+1]:cube('Aluminium window transom',(x,-3.98,height),(2.25,.12,.05),'inspection-metal',.004,r)
  cube('Window stone sill',(x,-4.14,z-1.06),(2.30,.53,.09),'inspection-concrete',.008,r)
  for sz in np.linspace(z-.70,z+.7,7):cube('Closed office blind',(x,-3.84,float(sz)),(2.04,.045,.038),'paper',.002,r)
cube('Door dark reveal',(0,-4.24,1.16),(1.66,.32,2.20),'inspection-metal',.009,r)
for x in [-.405,.405]:
 cube('Two leaf entrance',(x,-4.435,1.17),(.79,.055,2.15),'inspection-metal',.008,r)
 cube('Door vision panel',(x,-4.47,1.60),(.57,.014,.90),'inspection-glass',.006,r)
 tube('Public entrance pull',[(x*.33,-4.49,.8),(x*.33,-4.56,.8),(x*.33,-4.56,1.25),(x*.33,-4.49,1.25)],.015,'inspection-enamel',r)
cube('Threshold',(0,-4.47,.025),(1.95,.67,.05),'inspection-concrete',.008,r)
cube('Rain canopy',(0,-4.61,2.64),(4.60,1.55,.18),'inspection-concrete',.018,r)
cube('Official fascia',(0,-4.265,3.23),(8.80,.09,.51),'inspection-metal',.013,r)
text('Department','COUNTY LEAGUE INSPECTION',(0,-4.32,3.23),.31,'paper',parent=r)
text('Applicant entrance','APPLICANTS · AGE 10+',(0,-4.49,2.16),.077,'paper',parent=r)
for x in [-4.96,4.96]:
 tube('Rainwater downpipe',[(x,-4.22,.18),(x,-4.22,5.70),(x,-4.02,5.84)],.042,'inspection-metal',r)
 for z in [.7,2.3,4.1]:cube('Pipe bracket',(x,-4.04,z),(.14,.36,.025),'inspection-metal',.003,r)
cube('Roof plant casing',(2,1.7,6.08),(2.5,1.6,.45),'inspection-metal',.018,r)
for x in np.linspace(1,3,12):cube('Plant grille fin',(float(x),.87,6.06),(.07,.02,.30),'black',.002,r)
save('league-inspection-office',[{'x':0,'z':0,'w':10.6,'d':8.4}])

r=palette('cctv-mast')
cone('Concrete camera footing',(0,0,.20),.25,.20,.40,'inspection-concrete',r,12)
cone('Galvanised surveillance pole',(0,0,2.2),.082,.065,4.4,'inspection-metal',r,12)
cube('Control cabinet',(0,.04,1.1),(.30,.24,.46),'inspection-metal',.012,r)
tube('Camera cable',[(0,.04,1.15),(.11,.04,1.6),(.11,.04,4.10)],.012,'black',r)
head=empty('Camera pan head',(0,0,4.12),r)
cube('Weatherproof camera hood',(0,-.15,0),(.25,.52,.19),'inspection-enamel',.028,head)
cube('Dark lens plate',(0,-.418,-.012),(.20,.02,.135),'black',.010,head)
lens=cone('Surveillance lens',(0,-.435,-.01),.050,.047,.035,'inspection-glass',head,20);lens.rotation_euler[0]=math.pi/2
for frame,angle in [(1,-.40),(45,.38),(90,-.40)]:head.rotation_euler[2]=angle;head.keyframe_insert(data_path='rotation_euler',frame=frame)
cube('Surveillance notice',(0,-.064,2.40),(.56,.025,.44),'inspection-enamel',.009,r)
text('Mast notice','RECORDED',(0,-.081,2.48),.065,'black',parent=r)
text('Mast footnote','NOT SUPERVISED',(0,-.081,2.34),.038,'inspection-red',parent=r)
save('cctv-mast',[{'x':0,'z':0,'w':.5,'d':.5}],True)

r=palette('inspection-barrier')
cube('Barrier machinery',(0,0,.51),(.45,.48,1.02),'inspection-metal',.025,r)
cube('Maintenance access',(0,-.25,.53),(.35,.025,.57),'inspection-enamel',.008,r)
hinge=empty('Raised barrier hinge',(0,0,.96),r);hinge.rotation_euler[1]=-.95
cube('Raised striped boom',(1.50,0,0),(3.05,.12,.11),'inspection-enamel',.014,hinge)
for x in [.3,.9,1.5,2.1,2.7]:cube('Red reflective band',(x,-.064,0),(.22,.004,.109),'inspection-red',0,hinge)
text('Barrier warning','CHILD HEIGHT SENSOR NOT FITTED',(0,-.268,.55),.028,'black',parent=r)
save('inspection-barrier',[{'x':0,'z':0,'w':.5,'d':.55}])

r=palette('inspection-notice')
for x in [-.72,.72]:cube('Notice post',(x,.05,1.18),(.08,.10,2.36),'inspection-metal',.006,r)
cube('Stamped steel information board',(0,0,1.64),(1.85,.10,1.36),'inspection-metal',.013,r)
cube('Approved regulations',(0,-.058,1.64),(1.72,.02,1.23),'inspection-enamel',.006,r)
for i,line in enumerate(['COUNTY LEAGUE','FINAL INSPECTION','','APPLICANT: TEN','GUARDIAN: ABSENT','BADGES: REQUIRED','','WELFARE REVIEW','POSTPONED INDEFINITELY']):
 if not line:continue
 text('Regulation line',line,(0,-.074,2.10-i*.118),.103 if i==0 else .058,'inspection-red' if i in [0,7] else 'black',parent=r)
save('inspection-notice',[{'x':0,'z':0,'w':1.9,'d':.2}])
(ROOT/'artifacts/hollow-crown-catalog.json').write_text(json.dumps(catalog,indent=2))
print('HOLLOW_CROWN_ASSETS_SAVED',len(catalog),flush=True)
