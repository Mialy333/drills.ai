import asyncio
import math

import pytest
from mcp import Client

from src.learning.mcp_calculator import calculate_total, mcp


def test_calculate_total_contract_and_invalid_inputs():
    assert calculate_total(12.5, 3) == 37.5
    assert calculate_total(12.5, 0) == 0
    assert calculate_total(0, 4) == 0
    assert calculate_total(0.5, 3) == 1.5

    for price in (-0.01, math.nan, math.inf, True):
        with pytest.raises(ValueError):
            calculate_total(price, 1)
    for quantity in (-1, True, 1.5):
        with pytest.raises(ValueError):
            calculate_total(2.0, quantity)


def test_real_mcp_server_discovers_and_calls_tool_in_process():
    async def exercise_client():
        async with Client(mcp, raise_exceptions=True) as client:
            result = await client.list_tools()
            assert any(tool.name == "calculate_total" for tool in result.tools)
            call = await client.call_tool("calculate_total", {"price": 12.5, "quantity": 3})
            assert call.structured_content == {"result": 37.5}

    asyncio.run(exercise_client())
