"""Read-only audit: each exported asset has a usable standalone Blender scene and packed images."""
import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
catalog=json.loads((ROOT/'game-assets'/'asset-catalog.json').read_text())
report=[]
for name,entry in catalog.items():
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/entry['source']))
 scene=bpy.context.scene
 meshes=[o for o in scene.objects if o.type in ['MESH','CURVE','FONT']]
 assert meshes,f'{name}: no editable scene geometry'
 images=[im for im in bpy.data.images if im.users and im.source=='FILE']
 for im in images:assert im.packed_file or im.packed_files,f'{name}: unpacked image {im.name}'
 report.append({'asset':name,'source':entry['source'],'model':entry['model'],'editableObjects':len(meshes),'packedImages':len(images),'armatures':sum(o.type=='ARMATURE' for o in scene.objects)})
(ROOT/'docs'/'asset-audit.json').write_text(json.dumps({'assetCount':len(report),'assets':report},indent=2))
print('SOURCE_AUDIT_PASSED',len(report),flush=True)
