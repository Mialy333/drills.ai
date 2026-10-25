"""Small MCP v2 server used by the first Drills.ai course lesson."""
import math

from mcp.server import MCPServer

mcp = MCPServer("Drills.ai calculator")


@mcp.tool()
def calculate_total(price: float, quantity: int) -> float:
    """Return a non-negative unit price multiplied by a whole-number quantity."""
    if isinstance(price, bool) or not isinstance(price, (int, float)):
        raise ValueError("price must be a finite, non-negative number")
    if type(quantity) is not int or quantity < 0:
        raise ValueError("quantity must be a non-negative integer")
    try:
        unit_price = float(price)
    except OverflowError as error:
        raise ValueError("price must be a finite, non-negative number") from error
    if not math.isfinite(unit_price) or unit_price < 0:
        raise ValueError("price must be a finite, non-negative number")
    total = unit_price * quantity
    if not math.isfinite(total):
        raise ValueError("total must be finite")
    return total


if __name__ == "__main__":
    mcp.run()
