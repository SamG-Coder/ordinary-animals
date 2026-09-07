"""Pack used images, discard unused Blender datablocks, and compress editable source files."""
import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
catalog=json.loads((ROOT/'game-assets'/'asset-catalog.json').read_text())
sources=[entry['source'] for entry in catalog.values()]+['assets/dawn-sky.blend']
for relative in sources:
 path=ROOT/relative;bpy.ops.wm.open_mainfile(filepath=str(path))
 bpy.data.orphans_purge(do_recursive=True)
 for im in bpy.data.images:
  if im.has_data and im.users:im.pack()
 bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
print('PACKED_INDEPENDENT_SOURCES',len(sources))
