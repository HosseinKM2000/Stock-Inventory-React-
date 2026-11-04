"""require unique canonical Iranian mobile numbers

Revision ID: 20261104_0014
Revises: 20261103_0013
"""

from collections import defaultdict
import re

from alembic import op
import sqlalchemy as sa


revision = "20261104_0014"
down_revision = "20261103_0013"
branch_labels = None
depends_on = None

_DIGITS = str.maketrans(
    "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩",
    "01234567890123456789",
)
_MOBILE = re.compile(r"09\d{9}\Z")


def _normalize(value: str) -> str | None:
    normalized = value.strip().translate(_DIGITS)
    if normalized.startswith("+98"):
        normalized = "0" + normalized[3:]
    elif normalized.startswith("0098"):
        normalized = "0" + normalized[4:]
    return normalized if _MOBILE.fullmatch(normalized) else None


def _sample(values: list[int], limit: int = 20) -> str:
    return ",".join(str(value) for value in values[:limit])


def upgrade() -> None:
    connection = op.get_bind()
    rows = connection.execute(
        sa.text("SELECT id, phone FROM users WHERE phone IS NOT NULL ORDER BY id")
    ).mappings().all()

    malformed: list[int] = []
    canonical_by_id: dict[int, str] = {}
    ids_by_canonical: dict[str, list[int]] = defaultdict(list)
    for row in rows:
        canonical = _normalize(row["phone"])
        if canonical is None:
            malformed.append(row["id"])
            continue
        canonical_by_id[row["id"]] = canonical
        ids_by_canonical[canonical].append(row["id"])

    duplicate_groups = [ids for ids in ids_by_canonical.values() if len(ids) > 1]
    if malformed or duplicate_groups:
        parts = ["MOBILE_PHONE_PREFLIGHT"]
        if malformed:
            parts.append(
                f"malformed_count={len(malformed)}:user_ids={_sample(malformed)}"
            )
        if duplicate_groups:
            sampled_ids = [user_id for group in duplicate_groups for user_id in group]
            parts.append(
                f"duplicate_groups={len(duplicate_groups)}:user_ids={_sample(sampled_ids)}"
            )
        raise RuntimeError(";".join(parts))

    for user_id, canonical in canonical_by_id.items():
        connection.execute(
            sa.text("UPDATE users SET phone = :phone WHERE id = :user_id"),
            {"phone": canonical, "user_id": user_id},
        )

    op.create_unique_constraint(
        "uq_users_phone_canonical",
        "users",
        ["phone"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_users_phone_canonical",
        "users",
        type_="unique",
    )
