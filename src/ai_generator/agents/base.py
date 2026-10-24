"""Shared helper for structured OpenAI responses."""
from typing import TypeVar

from openai import OpenAI
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


def structured_completion(
    client: OpenAI,
    model: str,
    schema: type[T],
    system_prompt: str,
    user_prompt: str,
) -> T:
    """Request a Pydantic-validated structured response from the configured model."""
    try:
        completion = client.beta.chat.completions.parse(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format=schema,
        )
        if not completion.choices:
            raise RuntimeError("The model returned no choices.")
        parsed = completion.choices[0].message.parsed
        if parsed is None:
            refusal = getattr(completion.choices[0].message, "refusal", None)
            raise RuntimeError(refusal or "The model did not return a parsed response.")
        return parsed
    except Exception as exc:
        raise RuntimeError(f"Structured generation failed for {schema.__name__}: {exc}") from exc
