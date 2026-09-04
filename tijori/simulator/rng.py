"""Independent, named RNG substreams (reproducibility improvement #1).

Problem this solves: a SINGLE rng threaded through the whole pipeline in a fixed order
means inserting one new draw anywhere shifts every downstream draw — old results become
irreproducible. Instead we derive an independent, deterministically-seeded stream per
concern. Adding a draw in one stream never perturbs the others.

Stream seeds are derived from the master seed via SHA-256 (stable across CPython
versions and OSes — unlike the salted built-in hash()).
"""

from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass

#: One stream per concern. Add here as new concerns appear; existing streams are unaffected.
STREAM_NAMES: tuple[str, ...] = ("generator", "mandate", "substrate", "outcome", "llm")


def derive_seed(master: int, name: str) -> int:
    """Deterministically derive a 64-bit child seed from (master, stream name)."""
    digest = hashlib.sha256(f"{master}:{name}".encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big")


@dataclass(slots=True)
class Streams:
    generator: random.Random   # one-time failure population
    mandate: random.Random     # mandate failure population
    substrate: random.Random   # settlement/bank substrate
    outcome: random.Random     # WORLD retry-outcome draws (Week 2)
    llm: random.Random         # any sampling in narration (kept at temp 0 anyway)


def make_streams(seed: int) -> Streams:
    """Build all named substreams for a master seed. Same seed -> identical streams."""
    return Streams(**{name: random.Random(derive_seed(seed, name)) for name in STREAM_NAMES})


def uniform(seed: int, *keys: object) -> float:
    """A deterministic uniform in [0, 1) keyed by (seed, *keys).

    Used for retry OUTCOME draws so both baseline and smart face the SAME luck for the
    same (payment, attempt): they differ only in which timing/probability they choose,
    never in the underlying draw. This is what makes the beat fair AND reproducible.
    """
    payload = f"{seed}:" + ":".join(str(k) for k in keys)
    digest = hashlib.sha256(payload.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") / 2**64
