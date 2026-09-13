"""
Timezone-safe datetime helpers.

The database stores ``TIMESTAMP WITHOUT TIME ZONE`` columns whose values are
interpreted as UTC. To avoid naive/aware ``datetime`` comparison crashes (e.g.
:class:`TypeError: can't compare offset-naive and offset-aware datetimes` on
Python 3.12) and asyncpg tz-mismatch issues, all timestamps written to the DB
or compared against DB values must be naive UTC.
"""
from datetime import datetime, timezone


def utcnow() -> datetime:
    """Return the current UTC time as a naive ``datetime`` (tzinfo stripped).

    Store and compare everything against this value so DB columns and in-process
    time computations always use the same representation.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)