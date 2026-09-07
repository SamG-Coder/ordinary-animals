"""Re-export one edited asset, or the catalog, without rebuilding any world geometry.
blender -b --python scripts/reexport_asset.py -- desk
blender -b --python scripts/reexport_asset.py -- all
"""
import bpy,sys,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
catalog=json.loads((ROOT/'game-assets'/'asset-catalog.json').read_text())
name=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'all'
names=list(catalog) if name=='all' else [name]
for name in names:
    entry=catalog[name]
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/entry['source']))
    bpy.context.scene.frame_set(1)
    animal=name in ['cat','dog','hamster','rat','fox','rabbit','raccoon','goat']
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'game-assets'/entry['model']),export_format='GLB',export_image_format='WEBP',export_image_quality=86,export_animations=True,export_animation_mode='NLA_TRACKS' if animal else 'SCENE',export_frame_range=False,export_lights=True,export_extras=True)
print('ASSET_REEXPORT_COMPLETE',len(names))
