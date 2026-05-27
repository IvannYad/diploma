"""OpenAI client wrapper used by LLM-driven pipeline stages."""

from __future__ import annotations

import json
import logging
from typing import Any

from openai import OpenAI

logger = logging.getLogger(__name__)


class LlmClient:
    """Provides JSON-mode chat completions for clustering, schema inference, extraction, and charts.

    Centralizes OpenAI configuration so stages only supply prompts and parse structured responses.
    """

    def __init__(self, api_key: str, model_name: str) -> None:
        """Initialize the OpenAI client for the configured model.

        Args:
            api_key: OpenAI API key.
            model_name: Chat model identifier (e.g. gpt-5.4-mini).
        """
        self._client = OpenAI(api_key=api_key)
        self._model_name = model_name

    def json_chat(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        """Run a chat completion that must return a JSON object.

        Args:
            system_prompt: System role instructions for the model.
            user_prompt: User role payload (articles, schemas, tables, etc.).

        Returns:
            Parsed JSON object from the model response.

        Raises:
            Exception: Propagates API or JSON parse failures after logging.
        """
        logger.debug(
            "LLM call model=%s system=%r user=%r",
            self._model_name,
            system_prompt[:120],
            user_prompt[:200],
        )
        try:
            response = self._client.chat.completions.create(
                model=self._model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content or "{}"
            result = json.loads(content)
            logger.debug("LLM response keys=%s", list(result.keys()) if isinstance(result, dict) else type(result).__name__)
            return result
        except Exception:
            logger.exception("LLM call failed (model=%s)", self._model_name)
            raise
