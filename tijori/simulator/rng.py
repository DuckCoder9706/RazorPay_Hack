from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass

STREAM_NAMES: tuple[str, ...] = ("generator", "mandate", "substrate", "outcome")

def derive_seed(master: int, name: str) -> int:
    digest = hashlib.sha256(f"{master}:{name}".encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big")

@dataclass(slots=True)
class Streams:
    generator: random.Random
    mandate: random.Random
    substrate: random.Random
    outcome: random.Random

def make_streams(seed: int) -> Streams:
    return Streams(**{name: random.Random(derive_seed(seed, name)) for name in STREAM_NAMES})

def uniform(seed: int, *keys: object) -> float:
    payload = f"{seed}:" + ":".join(str(k) for k in keys)
    digest = hashlib.sha256(payload.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") / 2**64
