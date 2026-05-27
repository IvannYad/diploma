from __future__ import annotations

import json
import logging
from typing import Any

from openai import OpenAI

logger = logging.getLogger(__name__)


class LlmClient:
    def __init__(self, api_key: str, model_name: str) -> None:
        self._client = OpenAI(api_key=api_key)
        self._model_name = model_name

    def json_chat(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
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
            return json.loads(content)
        except Exception:
            logger.exception("LLM call failed (model=%s)", self._model_name)
            raise
