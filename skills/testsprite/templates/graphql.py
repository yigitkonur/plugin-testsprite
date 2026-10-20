# GraphQL backend test template: one POST per operation.
# Assert on "errors" as well as "data": GraphQL answers many failures with HTTP 200.
import requests

BASE_URL = "https://api-staging.example.com"   # explicit and public


def test_viewer_query() -> None:
    r = requests.post(
        f"{BASE_URL}/graphql",
        json={"query": "query { viewer { id email } }"},
        headers={**__AUTH_HEADERS__},
        timeout=30,
    )
    assert r.status_code == 200, f"expected 200, got {r.status_code}"
    body = r.json()
    assert "errors" not in body, body.get("errors")
    assert body["data"]["viewer"]["id"], "viewer.id missing"


test_viewer_query()   # MUST be called: the file runs top to bottom
