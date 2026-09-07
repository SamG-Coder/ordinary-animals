"""Independent county adults from the articulated Groundskeeper anatomy.

Writes separate editable Blender sources/GLBs for sanitation-officer, ranger,
harbourmaster, headteacher and league-inspector. No world edits/browser actions.
"""
import ast
import bpy
import json
import math
import numpy as np
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'artifacts'; ART.mkdir(exist_ok=True)
BASE_HELPERS = {'link', 'empty', 'cube', 'tube', 'text', 'plane_mesh', 'ellipsoid', 'material'}
ANATOMY_HELPERS = {'textured', 'loft', 'seam'}
helpers = ast.parse((ROOT / 'scripts/author_blender.py').read_text())
anatomy = ast.parse((ROOT / 'scripts/author_groundskeeper.py').read_text())
entries = {}


def delete_material_parts(material_name, parent_name=None):
    for obj in list(current.objects):
        if obj.type not in {'MESH', 'CURVE', 'FONT'}: continue
        if parent_name and (not obj.parent or obj.parent.name != parent_name): continue
        if any(m and m.name == material_name for m in obj.data.materials):
            bpy.data.objects.remove(obj, do_unlink=True)


def swap_material(old, new):
    for obj in current.objects:
        if obj.type not in {'MESH', 'CURVE', 'FONT'}: continue
        for i, mat in enumerate(obj.data.materials):
            if mat.name == old: obj.data.materials[i] = M[new]


def name_patch(top, bottom, height=.195):
    text('County role patch', top, (-.09, -.117, height), .011, 'Dirty off white thread', parent=body)
    text('County district patch', bottom, (-.09, -.117, height - .017), .009, 'Dirty off white thread', parent=body)


def lengthen_coat(material_name, hem):
    # Extend the existing continuous shell and its hem instead of laying a
    # second nearly coplanar skirt over it. Pockets stay at hand height.
    for obj in current.objects:
        if obj.type != 'MESH' or obj.parent != body: continue
        if not any(m.name == material_name for m in obj.data.materials): continue
        to_body = body.matrix_world.inverted() @ obj.matrix_world
        from_body = to_body.inverted()
        for vertex in obj.data.vertices:
            point = to_body @ vertex.co
            if point.z < -.12:
                flare = min(1, (-.12 - point.z) / .12)
                point.x *= 1 + flare * .12
                point.y *= 1 + flare * .27
            if point.z < -.25:
                point.z = -.25 + (point.z + .25) * (hem + .25) / (-.315 + .25)
                vertex.co = from_body @ point


def lower_badge(amount):
    # The old badge backing is a disconnected, precisely bounded component
    # inside the consolidated seam mesh; shift it below the naval lapel.
    for obj in current.objects:
        if obj.type != 'MESH' or obj.parent != body: continue
        if not any(m.name == 'Dark seams' for m in obj.data.materials): continue
        to_body = body.matrix_world.inverted() @ obj.matrix_world
        from_body = to_body.inverted()
        for vertex in obj.data.vertices:
            point = to_body @ vertex.co
            if -.143 < point.x < -.037 and -.118 < point.y < -.110 and .168 < point.z < .212:
                point.z -= amount
                vertex.co = from_body @ point


def formal_trousers(cloth):
    for mat in ['Worn trouser twill', 'Rubber with dried mud', 'Dark seams', 'Tarnished fittings']:
        delete_material_parts(mat, root.name)
    material('Polished black shoe leather', (.009, .011, .014), .42)
    for side in [-1, 1]:
        x = side * .091
        loft('Tailored trouser leg', [(.095,.053,.059,x,.005),(.15,.054,.061,x,.005),(.27,.054,.061,x,.004),(.39,.056,.063,x,.004),(.49,.059,.064,x,-.006),(.58,.063,.067,x,.001),(.69,.077,.079,x,.002),(.81,.084,.087,x,.003),(.96,.074,.085,x-side*.013,.008)], cloth, root, sides=40, crease=.010)
        seam('Pressed trouser crease', [(x,-.055,.13),(x,-.061,.34),(x,-.070,.51),(x,-.077,.69)], root, cloth, .0008)
        outline=[(-.043,.068),(.043,.068),(.052,.014),(.050,-.125),(.032,-.171),(-.032,-.171),(-.050,-.125),(-.052,.014)]
        for title, bottom, top, mat in [('Low leather sole',0,.019,'Dark seams'),('Laced Oxford shoe',.019,.073,'Polished black shoe leather')]:
            verts=[(x+vx,y,z) for z in [bottom,top] for vx,y in outline]
            faces=[tuple(reversed(range(8))),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
            shoe=plane_mesh(title,verts,faces,mat,root)
            bevel=shoe.modifiers.new('Rounded shoe edges','BEVEL');bevel.width=.009;bevel.segments=3
        loft('Shoe upper ankle',[(.05,.047,.078,x,-.015),(.084,.040,.049,x,.006),(.11,.037,.041,x,.010)],'Polished black shoe leather',root)
        for yy in [-.04,-.054,-.068]: seam('Oxford crossed lace',[(x-.023,yy,.081),(x+.023,yy-.004,.078)],root,'Dark seams',.0011)


def formal_front(cloth, tie):
    delete_material_parts('Charcoal ribbed wool', body.name)
    material('Aged cream shirt',(.40,.38,.31),.87)
    # Shirt and collar sit above the jacket surface, leaving the neck distinct.
    shirt=plane_mesh('Visible formal shirt', [(-.036,-.116,.330),(.036,-.116,.330),(.021,-.124,.195),(0,-.125,.151),(-.021,-.124,.195)], [(0,1,2,3,4)], 'Aged cream shirt', body)
    shirt.modifiers.new('Shirt fabric thickness','SOLIDIFY').thickness=.001
    for side in [-1,1]:
        plane_mesh('Turned formal collar',[(0,-.084,.343),(side*.042,-.052,.338),(side*.025,-.128,.297)],[(0,1,2)],'Aged cream shirt',body)
        lapel=plane_mesh('Tailored jacket lapel',[(side*.014,-.130,.144),(side*.139,-.106,.241),(side*.075,-.078,.326),(side*.044,-.130,.277)],[(0,1,2,3)],cloth,body)
        lapel.modifiers.new('Lapel sewn edge','SOLIDIFY').thickness=.004
    ellipsoid('Small tie knot',(0,-.125,.314),(.010,.005,.014),tie,body)
    plane_mesh('Hanging formal tie',[(-.006,-.132,.301),(.006,-.132,.301),(.014,-.133,.173),(0,-.134,.157),(-.014,-.133,.173)],[(0,1,2,3,4)],tie,body)


def spectacles():
    material('Old spectacle metal',(.080,.062,.035),.35,metal=.65)
    for side in [-1,1]:
        pts=[]
        for i in range(41):
            angle=i/40*math.tau
            pts.append((side*.030+math.cos(angle)*.023,-.069,.044+math.sin(angle)*.012))
        seam('Fine oval spectacle rim',pts,head,'Old spectacle metal',.00085)
        seam('Spectacle temple arm',[(side*.053,-.066,.046),(side*.066,-.015,.049),(side*.066,.016,.038)],head,'Old spectacle metal',.0008)
    seam('Spectacle bridge',[(-.007,-.068,.046),(0,-.072,.050),(.007,-.068,.046)],head,'Old spectacle metal',.00075)


def short_hair():
    material('Iron gray side parted hair',(.037,.042,.044),.96)
    loft('Short swept hair',[ (.075,.072,.077,0,.014),(.104,.074,.079,0,.012),(.132,.059,.068,0,.013),(.145,.028,.042,0,.012),(.148,.003,.010,0,.012)],'Iron gray side parted hair',head,sides=48)
    for i in range(9):
        x=-.055+i*.010
        seam('Combed hair strand',[(x,-.046,.108),(x+.003,-.009,.137),(x+.004,.026,.136)],head,'Salt gray stubble',.0008)


def card(text_lines, mat='Inspection label paper'):
    # A compact inward-offset card fits within the adult's 0.7 m footprint.
    parent = empty('Hand carried field card', (-.008, -.077, -.307), right_arm)
    parent.rotation_euler[1] = -.08
    cube('Field card backing', (0, 0, 0), (.105, .010, .149), 'Dark seams', .003, parent)
    cube('Field card paper', (0, -.006, 0), (.097, .0015, .140), mat, .001, parent)
    for line, z, size in text_lines:
        text('Printed field card ' + line, line, (0, -.008, z), size, 'Dark seams', parent=parent)


def headwear(kind, cloth):
    if kind == 'helmet':
        loft('Safety helmet shell', [(.082, .082, .091, 0, .004), (.101, .086, .096, 0, .007), (.147, .075, .088, 0, .010), (.180, .042, .057, 0, .010), (.190, .006, .008, 0, .011)], cloth, head, sides=48)
        loft('Hardhat projecting rim', [(.079, .094, .108, 0, -.002), (.086, .094, .108, 0, -.002)], cloth, head, sides=48)
        for x in [-.035, 0, .035]:
            seam('Moulded helmet ridge', [(x, -.077, .122), (x, -.039, .174), (x, .025, .180), (x, .076, .127)], head, cloth, .003)
        cube('Helmet county label', (0, -.094, .111), (.046, .003, .019), 'Reflective gray tape', .002, head)
    elif kind == 'ranger':
        loft('Weatherproof ranger crown', [(.078, .074, .085, 0, .006), (.120, .073, .085, 0, .011), (.167, .060, .073, 0, .011), (.174, .037, .063, 0, .011)], cloth, head, sides=48, crease=.009)
        verts, faces = [], []
        for radius in [1, 1.25, 1.47]:
            for i in range(48):
                a = i / 48 * math.tau
                verts.append((math.cos(a) * .075 * radius, .006 + math.sin(a) * .088 * radius, .078 - (radius - 1) * .022 + .002 * math.cos(a * 2)))
        for row in range(2):
            for i in range(48): faces.append((row * 48 + i, row * 48 + (i + 1) % 48, (row + 1) * 48 + (i + 1) % 48, (row + 1) * 48 + i))
        brim = plane_mesh('Downturned rain hat brim', verts, faces, cloth, head)
        brim.modifiers.new('Felt brim thickness', 'SOLIDIFY').thickness = .004
        loft('Ranger leather hat band', [(.085, .076, .087, 0, .007), (.100, .076, .087, 0, .007)], 'Brown field leather', head)
    else:
        loft('Harbour peaked cap crown', [(.078, .074, .084, 0, .008), (.100, .078, .091, 0, .012), (.127, .092, .100, 0, .017), (.155, .078, .090, 0, .025), (.160, .027, .053, 0, .024)], cloth, head, sides=48)
        loft('Cap black band', [(.075, .076, .087, 0, .008), (.097, .079, .090, 0, .009)], 'Dark seams', head)
        verts, faces = [], []
        for j in range(5):
            t = j / 4
            for i in range(25):
                x = (i / 24 * 2 - 1) * .078
                y = -.057 - t * (.073 * math.sqrt(max(0, 1 - (x / .084) ** 2)))
                verts.append((x, y, .079 - t * .018 + .004 * (x / .078) ** 2))
        for j in range(4):
            for i in range(24):
                a = j * 25 + i; faces.append((a, a + 1, a + 26, a + 25))
        peak = plane_mesh('Weathered peaked cap visor', verts, faces, 'Dark seams', head)
        peak.modifiers.new('Visor thickness', 'SOLIDIFY').thickness = .003
        seam('Cap strap', [(-.065, -.043, .096), (0, -.085, .095), (.065, -.043, .096)], head, 'Tarnished fittings', .002)
        cube('Harbour cap badge', (0, -.093, .115), (.021, .002, .027), 'Tarnished fittings', .002, head)


def finalise(name, target_height):
    # Keep all seven inherited animation channels and consolidate only geometry
    # rigidly attached to the same animated ancestor and material.
    groups = {}
    for obj in list(current.objects):
        if obj.type not in {'MESH', 'CURVE', 'FONT'} or obj.animation_data: continue
        if obj.type == 'FONT': obj.data.resolution_u = 3
        anchor = obj.parent
        while anchor and anchor != root and not anchor.animation_data: anchor = anchor.parent
        groups.setdefault((anchor or root, tuple(obj.data.materials)), []).append(obj)
    for (anchor, mats), group in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in group: obj.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        bpy.ops.object.convert(target='MESH')
        if len(group) > 1: bpy.ops.object.join()
        obj = bpy.context.object; matrix = obj.matrix_world.copy(); obj.parent = anchor; obj.matrix_world = matrix
        obj.name = anchor.name + ' / ' + ' + '.join(m.name for m in mats)
    bpy.context.view_layer.update()
    verts = [o.matrix_world @ v.co for o in current.objects if o.type == 'MESH' for v in o.data.vertices]
    maximum = max(v.z for v in verts)
    root.scale = (target_height / maximum,) * 3
    bpy.context.view_layer.update()
    verts = [o.matrix_world @ v.co for o in current.objects if o.type == 'MESH' for v in o.data.vertices]
    low = [min(v[a] for v in verts) for a in range(3)]; high = [max(v[a] for v in verts) for a in range(3)]
    assert high[0] - low[0] <= .70 and high[1] - low[1] <= .70, (name, low, high)
    for image in bpy.data.images:
        if image.users and image.has_data: image.pack()
    bpy.data.orphans_purge(do_recursive=True)
    root['height_metres'] = target_height
    root['role'] = name
    root['authoring'] = 'Original Blender county adult, adapted articulated anatomy, distinct uniform and packed original maps'
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets' / (name + '.blend')), compress=True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT / 'game-assets/models' / (name + '.glb')), export_format='GLB', export_image_format='WEBP', export_image_quality=90, export_animations=True, export_animation_mode='SCENE', export_frame_range=True, export_apply=True, export_extras=True)
    entry = {'model': 'models/' + name + '.glb', 'source': 'assets/' + name + '.blend'}
    entries[name] = entry
    (ART / (name + '-catalog-fragment.json')).write_text(json.dumps(entry, indent=2))
    (ART / (name + '-source-measurements.json')).write_text(json.dumps({'minimum': low, 'maximum': high, 'dimensions': [high[a] - low[a] for a in range(3)], 'meshes': sum(o.type == 'MESH' for o in current.objects), 'packedImages': sum(bool(i.packed_file) for i in bpy.data.images if i.users)}, indent=2))


def review(name):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 48; scene.cycles.use_denoising = True
    scene.world.color = (.065, .075, .085); scene.view_settings.view_transform = 'AgX'
    scene.render.resolution_x = 900; scene.render.resolution_y = 1100; scene.render.resolution_percentage = 100
    for label, pos, power, color, size in [('Cold sky', (-2, -3, 4), 210, (.72, .83, 1), 3), ('Warm lamp', (2, -1, 2.8), 120, (1, .78, .50), 2), ('Rain rim', (0, 2, 3), 270, (.51, .70, 1), 2)]:
        data = bpy.data.lights.new(label, 'AREA'); data.energy = power; data.color = color; data.shape = 'DISK'; data.size = size
        obj = bpy.data.objects.new(label, data); scene.collection.objects.link(obj); obj.location = pos
        obj.rotation_euler = (Vector((0, 0, 1)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    data = bpy.data.cameras.new('Review camera'); cam = bpy.data.objects.new('Review camera', data); scene.collection.objects.link(cam); scene.camera = cam; data.lens = 68
    for label, pos, look in [('full', (2.2, -4.3, 1.7), (0, 0, .93)), ('child-view', (.05, -2.6, 1.25), (0, 0, 1.45))]:
        cam.location = pos; cam.rotation_euler = (Vector(look) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(ART / (name + '-' + label + '.png')); bpy.ops.render.render(write_still=True)


variants=[('sanitation-officer',1.80,(1.055,1.02,.97)),('ranger',1.82,(.955,1.015,1.015)),('harbourmaster',1.79,(1.075,1.01,.965)),('headteacher',1.78,(.965,1.015,1.02)),('league-inspector',1.84,(1.035,1.025,.98))]
requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
for name, height, face_scale in variants:
    if requested and name not in requested: continue
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets/groundskeeper.blend'))
    current = bpy.data.collections['groundskeeper']; current.name = name
    root = bpy.data.objects['groundskeeper']; root.name = name
    objects = list(current.objects); M = {m.name: m for m in bpy.data.materials}
    rng = np.random.default_rng({'sanitation-officer':32011,'ranger':32012,'harbourmaster':32013,'headteacher':32014,'league-inspector':32015}[name])
    exec(compile(ast.Module(body=[n for n in helpers.body if isinstance(n, ast.FunctionDef) and n.name in BASE_HELPERS], type_ignores=[]), 'Blender helpers', 'exec'))
    exec(compile(ast.Module(body=[n for n in anatomy.body if isinstance(n, ast.FunctionDef) and n.name in ANATOMY_HELPERS], type_ignores=[]), 'Groundskeeper anatomy helpers', 'exec'))
    body = bpy.data.objects['Idle breathing chest']; head = bpy.data.objects['Head watchful idle']
    left_arm = bpy.data.objects['Left forearm idle']; right_arm = bpy.data.objects['Right forearm idle']; keys = bpy.data.objects['Maintenance keyring idle']
    head.scale = face_scale
    delete_material_parts('Charcoal ribbed wool', head.name)
    delete_material_parts('Dirty off white thread', body.name)
    delete_material_parts('Inspection label paper', right_arm.name)
    delete_material_parts('Dark seams', right_arm.name)
    delete_material_parts('Tarnished fittings', keys.name)
    material('Reflective gray tape', (.24, .26, .24), .47, metal=.30)
    material('Brown field leather', (.053, .029, .011), .86)
    material('Instrument screen', (.015, .049, .044), .51)
    if name == 'sanitation-officer':
        textured('Dirty yellow safety fabric', (.17, .19, .041), (.50, .50, .145), .73)
        textured('Deep green rubber waders', (.024, .037, .025), (.065, .089, .049), .66)
        material('Orange hardhat polymer', (.27, .084, .015), .61)
        swap_material('Rain dark olive wax', 'Dirty yellow safety fabric')
        swap_material('Worn trouser twill', 'Deep green rubber waders')
        swap_material('Rubber with dried mud', 'Deep green rubber waders')
        # A longer rain skirt and reflective bands alter the full silhouette.
        lengthen_coat('Dirty yellow safety fabric', -.51)
        for zz, rx, ry in [(.075, .177, .115), (-.345, .200, .140)]:
            loft('Reflective coat band', [(zz, rx, ry, 0, .001), (zz + .038, rx, ry, 0, .001)], 'Reflective gray tape', body, sides=48)
        for side in [-1, 1]:
            shoulder = bpy.data.objects[('Left' if side < 0 else 'Right') + ' shoulder idle']
            loft('Sleeve safety band', [(-.18, .063, .068, side * .016, -.002), (-.14, .064, .069, side * .015, -.002)], 'Reflective gray tape', shoulder)
        name_patch('COUNTY', 'DRAINS')
        headwear('helmet', 'Orange hardhat polymer')
        cube('Drain gas detector', (0, -.014, -.025), (.056, .026, .086), 'Dirty yellow safety fabric', .007, keys)
        cube('Gas detector readout', (0, -.029, -.010), (.034, .003, .019), 'Instrument screen', .002, keys)
        text('Detector warning', 'NO', (0, -.032, -.025), .010, 'Dark seams', parent=keys)
        text('Detector warning detail', 'ENTRY', (0, -.032, -.037), .009, 'Dark seams', parent=keys)
        card([('WORK NOTICE', .049, .011), ('ADULTS', .022, .012), ('DECLINED', .006, .012), ('SEND CHILD', -.033, .010)])
    elif name == 'ranger':
        textured('Faded forest canvas', (.023, .052, .043), (.091, .159, .099), .90)
        textured('Ranger earth trousers', (.055, .049, .032), (.146, .126, .079), .93)
        textured('Rain hat olive felt', (.049, .065, .032), (.13, .15, .069), .96)
        swap_material('Rain dark olive wax', 'Faded forest canvas')
        swap_material('Worn trouser twill', 'Ranger earth trousers')
        name_patch('RANGER', 'BLACKWOOD')
        headwear('ranger', 'Rain hat olive felt')
        # Diagonal map-case strap and high pocket radio, both inside the silhouette.
        seam('Leather field strap', [(-.15, -.090, .265), (-.060, -.118, .110), (.065, -.116, -.08), (.13, -.091, -.26)], body, 'Brown field leather', .010)
        cube('Ranger chest radio', (.107, -.126, .169), (.053, .027, .079), 'Dark seams', .008, body)
        cube('Radio speaker', (.107, -.143, .181), (.037, .003, .036), 'Instrument screen', .002, body)
        seam('Radio aerial', [(.096, -.128, .208), (.089, -.126, .295)], body, 'Dark seams', .0025)
        ellipsoid('Hanging brass compass', (0, -.005, -.009), (.024, .009, .028), 'Tarnished fittings', keys)
        ellipsoid('Compass glass', (0, -.014, -.009), (.019, .002, .022), 'Instrument screen', keys)
        card([('BLACKWOOD', .049, .011), ('BOUNDARY', .028, .012), ('MAP', .012, .018), ('NO SUPERVISION', -.043, .007)])
        # Facial warmth and a slimmer jaw differentiate this adult from the base.
        textured('Ranger weathered skin', (.245, .157, .109), (.395, .284, .204), .81, False)
        swap_material('Weathered skin', 'Ranger weathered skin')
    elif name == 'harbourmaster':
        textured('Harbour navy wool', (.020, .030, .045), (.068, .092, .112), .89)
        textured('Charcoal sailor trousers', (.027, .031, .037), (.087, .096, .097), .92)
        swap_material('Rain dark olive wax', 'Harbour navy wool')
        swap_material('Worn trouser twill', 'Charcoal sailor trousers')
        lower_badge(.17)
        name_patch('HARBOUR', 'MORROW QUAY', .025)
        headwear('cap', 'Harbour navy wool')
        lengthen_coat('Harbour navy wool', -.41)
        for side in [-1, 1]:
            lapel = plane_mesh('Broad naval lapel', [(side * .012, -.123, .058), (side * .144, -.099, .244), (side * .071, -.078, .326), (side * .050, -.112, .239)], [(0, 1, 2, 3)], 'Harbour navy wool', body)
            lapel.modifiers.new('Thick wool lapel', 'SOLIDIFY').thickness = .007
            for zz in [.041, -.055, -.151]: ellipsoid('Peacoat brass button', (side * .067, -.119, zz), (.0070, .0025, .0070), 'Tarnished fittings', body)
        # Older complexion and salt-gray brows, without enlarging the head.
        textured('Harbour weathered skin', (.239, .160, .127), (.367, .276, .218), .84, False)
        swap_material('Weathered skin', 'Harbour weathered skin')
        material('Salt gray stubble', (.061, .066, .063), .98)
        swap_material('Damp lashes and stubble', 'Salt gray stubble')
        for side in [-1, 1]:
            seam('Harbour gray moustache', [(side * .002, -.076, -.021), (side * .010, -.074, -.024), (side * .019, -.068, -.024)], head, 'Salt gray stubble', .0017)
            seam('Harbour eye crease', [(side * .047, -.049, .037), (side * .058, -.041, .034)], head, 'Aged skin crease', .00030)
        cube('Harbour tide recorder', (0, -.010, -.024), (.055, .022, .074), 'Brown field leather', .005, keys)
        cube('Tide recorder screen', (0, -.023, -.016), (.037, .003, .027), 'Instrument screen', .003, keys)
        card([('TIDE TABLE', .049, .011), ('MINORS', .023, .014), ('AT SEA', .003, .014), ('TERMS APPLY', -.037, .010)])
    elif name == 'headteacher':
        textured('Charcoal brown school tweed',(.043,.036,.030),(.143,.126,.102),.94)
        textured('Pressed school trousers',(.034,.032,.030),(.099,.090,.077),.94)
        material('Faded burgundy school tie',(.068,.008,.014),.85)
        material('Salt gray stubble',(.061,.066,.063),.98)
        swap_material('Rain dark olive wax','Charcoal brown school tweed')
        swap_material('Damp lashes and stubble','Salt gray stubble')
        formal_trousers('Pressed school trousers')
        formal_front('Charcoal brown school tweed','Faded burgundy school tie')
        lower_badge(.19);name_patch('HEADTEACHER','ST MARROW',.005)
        short_hair();spectacles()
        cube('Scuffed register case',(0,0,-.049),(.105,.044,.119),'Brown field leather',.006,keys)
        seam('Register case handle',[(-.025,0,.012),(-.025,0,.032),(.025,0,.032),(.025,0,.012)],keys,'Brown field leather',.003)
        text('Case attendance marking','ABSENT',(0,-.024,-.040),.009,'Dirty off white thread',parent=keys)
        card([('ATTENDANCE',.049,.010),('AGE 10',.024,.017),('ABSENT',.001,.013),('AS EXPECTED',-.038,.009)])
    else:
        textured('Rain stained inspection coat',(.022,.026,.031),(.082,.095,.112),.85)
        textured('Pressed inspection trousers',(.017,.020,.024),(.068,.075,.082),.91)
        textured('Inspector felt hat',(.037,.041,.041),(.112,.118,.116),.98)
        material('Black inspection tie',(.007,.010,.015),.72)
        swap_material('Rain dark olive wax','Rain stained inspection coat')
        formal_trousers('Pressed inspection trousers')
        lengthen_coat('Rain stained inspection coat',-.45)
        formal_front('Rain stained inspection coat','Black inspection tie')
        lower_badge(.19);name_patch('INSPECTOR','THE LEAGUE',.005)
        headwear('ranger','Inspector felt hat')
        cube('Inspector identity wallet',(0,-.01,-.025),(.061,.018,.084),'Brown field leather',.004,keys)
        cube('Inspection authority seal',(0,-.021,-.016),(.034,.003,.035),'Tarnished fittings',.002,keys)
        text('Inspector badge ten','10',(0,-.024,-.016),.016,'Dark seams',parent=keys)
        card([('FINAL REVIEW',.049,.010),('CHILD',.025,.014),('FIT FOR DUTY',.004,.010),('STAMP HERE',-.038,.010)])
    finalise(name, height)
    review(name)
    print('COUNTY_ADULT_COMPLETE', name, flush=True)
(ART / 'county-staff-catalog-fragment.json').write_text(json.dumps({name:{'model':'models/'+name+'.glb','source':'assets/'+name+'.blend'} for name,_,_ in variants if (ROOT/'assets'/f'{name}.blend').exists()}, indent=2))
print('COUNTY_STAFF_COMPLETE', json.dumps(entries))
