# MCP over streamable HTTP, framed by hand because the sandbox has no MCP SDK.
# Ran green in TestSprite's sandbox against a public MCP server (initialize, tools/list over SSE; field test, CLI 0.15.0).
# Before using it, read the target server's protocol version and session behavior; servers differ.
# __AUTH_HEADERS__ carries the project credential: point this only at your own server.
import json
import requests

BASE_URL = "https://mcp-staging.example.com/mcp"   # explicit and public


def rpc(session, method, params=None, id_=1):
    headers = {
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
        **__AUTH_HEADERS__,
    }
    if session:
        headers["Mcp-Session-Id"] = session
    body = {"jsonrpc": "2.0", "method": method}
    if params:
        body["params"] = params
    if id_:
        body["id"] = id_
    r = requests.post(BASE_URL, json=body, headers=headers, timeout=30, stream=True)
    assert r.status_code in (200, 202), f"{method}: HTTP {r.status_code}"
    sid = r.headers.get("Mcp-Session-Id", session)
    if r.headers.get("Content-Type", "").startswith("text/event-stream"):
        for line in r.iter_lines(decode_unicode=True):      # first JSON-RPC response event
            if line.startswith("data:"):
                return sid, json.loads(line[5:])
        raise AssertionError(f"{method}: SSE stream ended without a data event")
    return sid, (r.json() if r.content else None)


def test_initialize_and_list_tools() -> None:
    sid, init = rpc(None, "initialize", {
        "protocolVersion": "2025-06-18",          # set to what the target server speaks
        "capabilities": {},
        "clientInfo": {"name": "testsprite-probe", "version": "0"},
    })
    assert init["result"]["serverInfo"]["name"], "no serverInfo"
    rpc(sid, "notifications/initialized", id_=None)
    _, tools = rpc(sid, "tools/list", id_=2)
    names = {t["name"] for t in tools["result"]["tools"]}
    assert {"search", "fetch"} <= names, f"missing expected tools: {names}"   # replace with the server's real tools


test_initialize_and_list_tools()
