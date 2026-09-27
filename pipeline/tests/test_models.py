import json

from pipeline.models import Regions
from pipeline.paths import REGIONS_JSON


def test_regions_json_validates():
    data = json.loads(REGIONS_JSON.read_text(encoding="utf-8"))
    regions = Regions.model_validate(data)
    assert len(regions.regions) == 47
    assert regions.national.name.zh_tw == "全國"
