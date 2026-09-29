from pipeline.rail import base_name, build_lines, clip, colour

BOX = (26.0, 127.0, 27.0, 128.0)  # 南、西、北、東


def test_base_name_strips_direction_and_section():
    assert base_name("JR山手線（内回り）") == "JR山手線"
    assert base_name("東海道本線 (上り)") == "東海道本線"
    assert base_name("ゆいレール: 那覇空港 => てだこ浦西") == "ゆいレール"


def test_colour_only_hex():
    assert colour("#80C241") == "#80c241"
    assert colour("f00") == "#ff0000"
    assert colour("green") is None
    assert colour(None) is None


def test_clip_keeps_inside_segments_with_edge_points():
    pts = [(126.5, 26.5), (127.5, 26.5), (127.6, 26.6), (128.5, 26.6)]
    assert clip(pts, BOX) == [[(126.5, 26.5), (127.5, 26.5), (127.6, 26.6), (128.5, 26.6)]]
    assert clip([(120.0, 20.0), (121.0, 20.0)], BOX) == []


def _rel(rid, name, ways, **tags):
    return {
        "type": "relation",
        "id": rid,
        "tags": {"name": name, "route": "monorail", "operator": "沖縄都市モノレール", **tags},
        "members": [
            {
                "type": "way",
                "ref": ref,
                "role": "",
                "geometry": [{"lat": a, "lon": b} for a, b in g],
            }
            for ref, g in ways
        ]
        + [{"type": "node", "ref": 9, "role": "stop"}],
    }


def test_build_lines_merges_directions_and_dedupes_ways():
    way = (1, [(26.2, 127.65), (26.21, 127.66), (26.22, 127.67)])
    data = {
        "elements": [
            _rel(20, "ゆいレール: 那覇空港 => てだこ浦西", [way], colour="#00a0e9"),
            _rel(10, "ゆいレール: てだこ浦西 => 那覇空港", [way]),
        ]
    }
    lines = build_lines(data, BOX)
    assert len(lines) == 1
    line = lines[0]
    assert (line.id, line.name, line.kind, line.colour) == (
        "osm-relation-10",
        "ゆいレール",
        "monorail",
        "#00a0e9",
    )
    assert len(line.coords) == 1 and line.coords[0][0] == [127.65, 26.2]
