"""Give each independent Blender library file its own visible editing scene."""
import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
catalog=json.loads((ROOT/'game-assets'/'asset-catalog.json').read_text())
for name,entry in catalog.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path=ROOT/entry['source']
    with bpy.data.libraries.load(str(path),link=False) as (src,dst):dst.collections=src.collections
    for col in dst.collections:
        if col:bpy.context.scene.collection.children.link(col)
    bpy.context.scene.frame_set(1)
    staging=ROOT/'assets'/'.finalize';staging.mkdir(exist_ok=True)
    temp=staging/f'{name}.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(temp))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    assert path.resolve().parent==(ROOT/'assets').resolve()
    temp.replace(path)
print('EDITABLE_SOURCES_COMPLETE',len(catalog))
