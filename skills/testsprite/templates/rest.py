# REST backend test template. TestSprite runs this file top to bottom in a sandbox
# (standard library, requests, pytest, numpy, scipy only). Create it with:
#   testsprite test create --type backend --project <project-id> --name "<behavior>" --code-file rest.py
import requests

# Explicit and public. Do not rely on an injected TARGET_URL (unverified).
BASE_URL = "https://api-staging.example.com"


def test_get_item_returns_the_item() -> None:
    # __AUTH_HEADERS__ is injected from the project's credential (project credential / auto-auth).
    r = requests.get(f"{BASE_URL}/items/1", headers={**__AUTH_HEADERS__}, timeout=30)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body["id"] == 1, f"unexpected id: {body.get('id')}"


def test_get_missing_item_is_404() -> None:
    r = requests.get(f"{BASE_URL}/items/does-not-exist", headers={**__AUTH_HEADERS__}, timeout=30)
    assert r.status_code == 404, f"expected 404, got {r.status_code}"


# Every test function MUST be called: the file is executed top to bottom and a
# function that is only defined passes vacuously.
test_get_item_returns_the_item()
test_get_missing_item_is_404()
