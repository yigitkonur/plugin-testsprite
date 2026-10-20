from fastmcp import FastMCP

mcp = FastMCP("weather")


@mcp.tool()
def forecast(city: str) -> str:
    """Return a canned forecast for a city."""
    return f"Sunny in {city}"


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
