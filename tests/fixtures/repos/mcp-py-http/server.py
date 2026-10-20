from mcp.server.fastmcp import FastMCP

mcp = FastMCP("notes", host="0.0.0.0", port=8000)


@mcp.tool()
def add_note(text: str) -> str:
    """Store a note and return its id."""
    return "note-1"


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
