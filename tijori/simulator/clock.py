from __future__ import annotations

from datetime import date, datetime, timedelta

from tijori.config.constants import PAYDAY_DAYS

EPOCH = datetime(2026, 1, 1, 0, 0, 0)

class SimClock:

    def __init__(self, start: datetime = EPOCH) -> None:
        self._t = start

    @property
    def now(self) -> datetime:
        return self._t

    def iso(self) -> str:
        return self._t.isoformat()

    def advance_days(self, days: int) -> "SimClock":
        self._t = self._t + timedelta(days=days)
        return self

    def at(self, when: datetime) -> "SimClock":
        self._t = when
        return self

def next_payday(after: datetime) -> datetime:
    d = after
    for _ in range(40):
        d = d + timedelta(days=1)
        if d.day in PAYDAY_DAYS:
            return d
    return after + timedelta(days=30)

def is_payday(d: date | datetime) -> bool:
    return d.day in PAYDAY_DAYS
