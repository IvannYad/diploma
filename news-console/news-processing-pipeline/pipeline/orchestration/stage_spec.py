
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable


@dataclass(frozen=True, slots=True)
class StageSpec:
    """Describes one pipeline stage: name, runner callable, and whether it needs LlmClient.

    Used by the orchestrator to invoke stages in order with the correct arguments.
    """

    name: str
    runner: Callable[..., dict[str, Any]]
    needs_llm: bool
