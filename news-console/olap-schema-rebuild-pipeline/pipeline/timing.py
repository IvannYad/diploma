"""Wall-clock timing for rebuild pipeline stages persisted to MongoDB."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from pymongo.database import Database


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class PipelineTimingRecorder:
    """Records start/end timestamps and duration for each rebuild stage.

    Build a document with build_document() and persist via save() after the run
    completes or fails.
    """

    def __init__(
        self,
        *,
        pipeline: str,
        process_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Initialize timing for one rebuild run.

        Args:
            pipeline: Pipeline identifier (olap_schema_rebuild).
            process_id: Backend rebuild process id.
            metadata: Extra fields (cluster, subcluster, model, etc.).
        """
        self.pipeline = pipeline
        self.process_id = process_id
        self.metadata = dict(metadata or {})
        self._started_perf = time.perf_counter()
        self.started_at = _utc_now_iso()
        self.stages: list[dict[str, Any]] = []
        self._current: dict[str, Any] | None = None

    @property
    def source(self) -> str:
        return f"{self.pipeline}_pipeline_timing"

    def start_stage(self, name: str, index: int) -> None:
        """Mark the beginning of a stage.

        Args:
            name: Stage name (e.g. validate_schema).
            index: 1-based stage index in this run.
        """
        if self._current is not None:
            self.end_stage(status="interrupted")
        self._current = {
            "name": name,
            "index": index,
            "started_at": _utc_now_iso(),
            "_t0": time.perf_counter(),
        }

    def end_stage(
        self,
        summary: dict[str, Any] | None = None,
        *,
        status: str = "completed",
    ) -> float:
        """Mark the end of the active stage and append it to the stage list.

        Args:
            summary: Optional stage result dict stored on the timing record.
            status: completed, failed, or interrupted.

        Returns:
            Stage duration in seconds, or 0.0 if no stage was active.
        """
        if self._current is None:
            return 0.0
        elapsed = round(time.perf_counter() - self._current["_t0"], 3)
        entry: dict[str, Any] = {
            "name": self._current["name"],
            "index": self._current["index"],
            "started_at": self._current["started_at"],
            "finished_at": _utc_now_iso(),
            "duration_seconds": elapsed,
            "status": status,
        }
        if summary is not None:
            entry["summary"] = summary
        self.stages.append(entry)
        self._current = None
        return elapsed

    def build_document(
        self,
        *,
        status: str,
        error: str | None = None,
        failed_stage: str | None = None,
    ) -> dict[str, Any]:
        """Assemble the MongoDB document for this run.

        Args:
            status: success or failed.
            error: Optional error message when status is failed.
            failed_stage: Name of the stage that failed, if known.

        Returns:
            Document ready for insert or upsert.
        """
        if self._current is not None:
            self.end_stage(status="interrupted")
        doc: dict[str, Any] = {
            "source": self.source,
            "pipeline": self.pipeline,
            "started_at": self.started_at,
            "finished_at": _utc_now_iso(),
            "duration_seconds": round(time.perf_counter() - self._started_perf, 3),
            "status": status,
            "stages": self.stages,
            **self.metadata,
        }
        if self.process_id:
            doc["process_id"] = self.process_id
        if error:
            doc["error"] = error
        if failed_stage:
            doc["failed_stage"] = failed_stage
        return doc

    def save(self, db: Database, collection_name: str, document: dict[str, Any]) -> None:
        """Persist timing document to MongoDB.

        Upserts when process_id is set; otherwise inserts a new document per run.

        Args:
            db: MongoDB database handle.
            collection_name: Target collection name.
            document: Output of build_document().
        """
        if document.get("process_id"):
            db[collection_name].update_one(
                {"source": document["source"], "process_id": document["process_id"]},
                {"$set": document},
                upsert=True,
            )
        else:
            db[collection_name].insert_one(document)
