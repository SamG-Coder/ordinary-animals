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
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/field-paper.blend'))
assert any(o.type=='MESH' for o in bpy.context.scene.objects),'interface paper: missing editable surface'
paper_images=[im for im in bpy.data.images if im.users and im.source=='FILE']
assert paper_images and all(im.packed_file or im.packed_files for im in paper_images),'interface paper: texture not packed'
(ROOT/'docs'/'asset-audit.json').write_text(json.dumps({'assetCount':len(report),'assets':report,'interfaceSources':[{'source':'assets/field-paper.blend','texture':'src/ui/field-paper.png','packedImages':len(paper_images)}]},indent=2))
print('SOURCE_AUDIT_PASSED',len(report),flush=True)
