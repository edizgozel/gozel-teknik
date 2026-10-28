from sqlalchemy.orm import Session

from app.models import AuditLog


def log_action(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: int | None,
    description: str,
):
    db.add(
        AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description[:400],
            source="app",
        )
    )
