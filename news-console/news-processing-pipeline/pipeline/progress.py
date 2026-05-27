
from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from collections.abc import Callable


@dataclass(slots=True)
class _StageState:
    """Internal counters for the currently active pipeline stage."""

    index: int
    name: str
    total: int
    processed: int = 0


class PipelineProgress:
    """Emits structured progress events for the backend UI and optional webhook forwarding.

    Stages call start_stage, update, and complete_stage so the frontend can show
    per-stage percent complete and messages.
    """

    def __init__(
        self,
        total_stages: int,
        on_event: Callable[[dict[str, Any]], None] | None = None,
    ) -> None:
        """Create a progress tracker for the full pipeline run.

        Args:
            total_stages: Number of stages in this run (3 or 4 if charts enabled).
            on_event: Optional callback invoked for each emitted event (e.g. HTTP progress).
        """
        self.total_stages = total_stages
        self.stage: _StageState | None = None
        self._on_event = on_event

    def _emit(self, payload: dict[str, Any]) -> None:
        """Write one NDJSON line to stdout and invoke the optional callback.

        Callback failures are swallowed so progress transport never aborts the pipeline.
        """
        payload["ts"] = datetime.now(timezone.utc).isoformat()
        sys.stdout.write(json.dumps(payload, ensure_ascii=True) + "\n")
        sys.stdout.flush()
        if self._on_event is not None:
            try:
                self._on_event(dict(payload))
            except Exception:
                pass

    def start_stage(self, stage_index: int, stage_name: str, total: int) -> None:
        """Begin a new stage and reset processed count.

        Args:
            stage_index: 1-based index of this stage in the pipeline.
            stage_name: Human-readable stage label for the UI.
            total: Number of work units (articles, subclusters, etc.) in this stage.
        """
        self.stage = _StageState(index=stage_index, name=stage_name, total=max(total, 1))
        self._emit(
            {
                "event": "stage_start",
                "stageIndex": stage_index,
                "totalStages": self.total_stages,
                "stage": stage_name,
                "processed": 0,
                "total": max(total, 1),
                "percent": 0.0,
            }
        )

    def info(self, message: str) -> None:
        """Emit an informational message tied to the current stage.

        Args:
            message: Short status text (e.g. subcluster created).
        """
        stage = self.stage
        self._emit(
            {
                "event": "stage_info",
                "stageIndex": stage.index if stage else None,
                "stage": stage.name if stage else None,
                "message": message,
            }
        )

    def update(self, processed_increment: int = 1, message: str | None = None) -> None:
        """Advance progress within the active stage.

        Args:
            processed_increment: How many units to add to processed count.
            message: Optional detail appended to the progress event.

        Raises:
            RuntimeError: If start_stage was not called.
        """
        if self.stage is None:
            raise RuntimeError("No active stage. Call start_stage first.")
        self.stage.processed = min(self.stage.total, self.stage.processed + max(0, processed_increment))
        percent = (self.stage.processed / self.stage.total) * 100.0
        payload: dict[str, Any] = {
            "event": "stage_progress",
            "stageIndex": self.stage.index,
            "totalStages": self.total_stages,
            "stage": self.stage.name,
            "processed": self.stage.processed,
            "total": self.stage.total,
            "percent": round(percent, 2),
        }
        if message:
            payload["message"] = message
        self._emit(payload)

    def complete_stage(self, summary: dict[str, Any] | None = None) -> None:
        """Mark the active stage as 100% complete.

        Args:
            summary: Optional stage result dict included in the event.

        Raises:
            RuntimeError: If start_stage was not called.
        """
        if self.stage is None:
            raise RuntimeError("No active stage. Call start_stage first.")
        self.stage.processed = self.stage.total
        payload: dict[str, Any] = {
            "event": "stage_complete",
            "stageIndex": self.stage.index,
            "totalStages": self.total_stages,
            "stage": self.stage.name,
            "processed": self.stage.total,
            "total": self.stage.total,
            "percent": 100.0,
        }
        if summary:
            payload["summary"] = summary
        self._emit(payload)

    def pipeline_complete(self, summary: dict[str, Any]) -> None:
        """Emit a final success event after all stages finish.

        Args:
            summary: Per-stage result dictionaries keyed by stage name.
        """
        self._emit({"event": "pipeline_complete", "summary": summary})

    def pipeline_error(self, stage_name: str | None, error: str) -> None:
        """Emit a failure event when the pipeline aborts.

        Args:
            stage_name: Stage where the error occurred, if known.
            error: Error message string for the UI.
        """
        self._emit(
            {
                "event": "pipeline_error",
                "stage": stage_name,
                "error": error,
            }
        )
