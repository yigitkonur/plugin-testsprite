# Teardown test pattern. Create with --category teardown so it runs in the final wave:
#   testsprite test create --type backend --project <project-id> --name "suite fixtures are deleted" \
#     --code-file teardown.py --category teardown
# Do not rely on Auto Cleanup covering CLI-authored tests (unverified). Find what the suite created by a
# unique name prefix instead of by a value handed over from another test (that hand-off is unverified too).
import requests

BASE_URL = "https://api-staging.example.com"   # explicit and public
PREFIX = "testsprite-suite-"                   # every record the suite creates starts with this


def test_delete_suite_fixtures() -> None:
    headers = {**__AUTH_HEADERS__}
    r = requests.get(f"{BASE_URL}/items", params={"q": PREFIX}, headers=headers, timeout=30)
    assert r.status_code == 200, f"list failed: {r.status_code}"
    for item in r.json():
        if not str(item.get("name", "")).startswith(PREFIX):
            continue                           # never delete anything the suite did not create
        d = requests.delete(f"{BASE_URL}/items/{item['id']}", headers=headers, timeout=30)
        assert d.status_code in (200, 204, 404), f"delete {item['id']}: {d.status_code}"   # 404 = already gone


test_delete_suite_fixtures()
