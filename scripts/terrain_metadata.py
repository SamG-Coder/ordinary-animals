"""Export walkable height samples from a regular Blender mesh, never from a second formula."""

def ground_surface(scene):
    obj = next(o for o in scene.objects if o.get('walkable_grid'))
    columns, rows = int(obj['columns']), int(obj['rows'])
    width, depth = float(obj['width']), float(obj['depth'])
    # Blender +Z is up; glTF +Y is up and local +Z corresponds to Blender -Y.
    points = [obj.matrix_world @ v.co for v in obj.data.vertices]
    heights = [None] * ((columns + 1) * (rows + 1))
    grid_indices = []
    for p in points:
        ix = round((p.x / width + .5) * columns)
        iz = round((-p.y / depth + .5) * rows)
        assert 0 <= ix <= columns and 0 <= iz <= rows, 'Surface extends beyond its sample grid'
        assert abs(p.x - (ix / columns - .5) * width) < .0001, 'Use a regular grid for walkable terrain'
        assert abs(-p.y - (iz / rows - .5) * depth) < .0001, 'Use a regular grid for walkable terrain'
        heights[iz * (columns + 1) + ix] = round(float(p.z), 6)
        grid_indices.append(iz * (columns + 1) + ix)
    assert None not in heights, 'Incomplete walkable surface'
    assert all(len(p.vertices) == 3 for p in obj.data.polygons), 'Triangulate the walkable surface explicitly'
    expected = set()
    for j in range(rows):
        for i in range(columns):
            a = j * (columns + 1) + i
            b, c, d = a + 1, a + columns + 1, a + columns + 2
            expected.update([tuple(sorted((a, b, c))), tuple(sorted((b, c, d)))])
    actual = {tuple(sorted(grid_indices[v] for v in p.vertices)) for p in obj.data.polygons}
    assert actual == expected, 'Keep the Blender grid triangle diagonal from b to c'
    return {'width': width, 'depth': depth, 'columns': columns, 'rows': rows,
            'diagonal': 'b-c', 'heights': heights}
