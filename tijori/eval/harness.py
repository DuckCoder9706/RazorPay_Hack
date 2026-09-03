"""The batch runner (ARCHITECTURE.md §09, §10).

run_batch(seed, n): generate a seeded failure batch, run it through baseline / smart /
oracle on the SAME seed + tables, reconcile, emit calibration, and return the metrics
table. This is the reproducible core the whole submission rests on.

STATUS: interface fixed; orchestration lands across Week 2-3 as the modules it calls fill in.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from tijori.config.constants import DEFAULT_BATCH_SIZE, DEFAULT_SEED
from tijori.eval.metrics import BatchMetrics


@dataclass(slots=True)
class BatchResult:
    seed: int
    n: int
    metrics: dict[str, BatchMetrics] = field(default_factory=dict)  # policy -> metrics
    calibration: list[dict] = field(default_factory=list)


def run_batch(
    seed: int = DEFAULT_SEED, n: int = DEFAULT_BATCH_SIZE, *, db_path: str | None = None
) -> BatchResult:
    """Run one fully-reproducible scored batch. Same (seed, n) -> identical result."""
    raise NotImplementedError("Week 2-3 · T-harness-run_batch")
