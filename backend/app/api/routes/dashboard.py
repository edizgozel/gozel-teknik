from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes.finance import compute_finance
from app.database import get_db
from app.models import Part, Payment, ServiceRecord

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
):
    services = db.scalars(select(ServiceRecord)).unique().all()
    by_status: dict[str, int] = {}
    for s in services:
        by_status[s.status] = by_status.get(s.status, 0) + 1

    active_statuses = {"intake", "diagnosis", "awaiting_parts", "repairing", "ready"}
    parts = db.scalars(select(Part)).unique().all()
    low_parts = [
        {
            "code": p.part_code,
            "name": p.name,
            "quantity": p.quantity,
            "min_quantity": p.min_quantity,
            "unit": p.unit,
            "level": "out" if p.quantity == 0 else "low",
        }
        for p in parts
        if p.is_active and p.quantity <= p.min_quantity
    ]

    df = (
        datetime.strptime(date_from, "%Y-%m-%d")
        if date_from
        else datetime.now() - timedelta(days=30)
    )
    dt = (
        datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        if date_to
        else datetime.now()
    )
    payments = db.scalars(select(Payment)).unique().all()
    collected = sum(
        p.amount_kurus
        for p in payments
        if p.status == "valid" and df <= p.created_at <= dt
    )

    unpaid_services = 0
    total_receivable = 0
    for s in services:
        if s.status in ("cancelled",):
            continue
        finance = compute_finance(db, s)
        if finance["payment_status"] in ("unpaid", "partially_paid") and finance["grand_total"] > 0:
            unpaid_services += 1
            total_receivable += finance["balance"]

    recent = sorted(
        (s for s in services if s.status != "cancelled"),
        key=lambda s: s.created_at,
        reverse=True,
    )[:5]

    return {
        "active_services": sum(by_status.get(k, 0) for k in active_statuses),
        "by_status": {
            "intake": by_status.get("intake", 0),
            "diagnosis": by_status.get("diagnosis", 0),
            "awaiting_parts": by_status.get("awaiting_parts", 0),
            "repairing": by_status.get("repairing", 0),
            "ready": by_status.get("ready", 0),
            "delivered": by_status.get("delivered", 0),
            "closed": by_status.get("closed", 0),
            "cancelled": by_status.get("cancelled", 0),
        },
        "low_stock_count": len(low_parts),
        "out_of_stock_count": sum(1 for p in low_parts if p["level"] == "out"),
        "collected_kurus": collected,
        "collection_range": {"from": df.strftime("%Y-%m-%d"), "to": dt.strftime("%Y-%m-%d")},
        "unpaid_services": unpaid_services,
        "total_receivable_kurus": total_receivable,
        "low_stock_parts": low_parts[:10],
        "recent_services": [
            {
                "id": s.id,
                "service_no": s.service_no,
                "customer": s.customer.name,
                "device": f"{s.device.brand} {s.device.model}",
                "status": s.status,
                "created_at": s.created_at.strftime("%d.%m.%Y"),
            }
            for s in recent
        ],
    }


from fastapi import HTTPException

from app.audit import log_action
from app.models import AuditLog

audit_router = APIRouter(prefix="/audit", tags=["audit"])


@audit_router.get("")
def list_audit(
    q: str | None = None,
    action: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(AuditLog).order_by(AuditLog.id.desc())
    logs = db.scalars(stmt).all()
    out = [
        {
            "id": a.id,
            "action": a.action,
            "entity_type": a.entity_type,
            "entity_id": a.entity_id,
            "description": a.description,
            "source": a.source,
            "created_at": a.created_at.strftime("%d.%m.%Y %H:%M:%S"),
        }
        for a in logs
    ]
    if q:
        needle = q.strip().lower()
        out = [o for o in out if needle in o["description"].lower() or needle in o["action"].lower()]
    if action:
        out = [o for o in out if o["action"] == action]
    if date_from:
        out = [o for o in out if o["created_at"] >= datetime.strptime(date_from, "%Y-%m-%d").strftime("%d.%m.%Y %H:%M:%S")]
    if date_to:
        end = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59).strftime("%d.%m.%Y %H:%M:%S")
        out = [o for o in out if o["created_at"] <= end]
    actions = sorted({o["action"] for o in out}) or sorted({o["action"] for o in [
        {"action": a.action} for a in logs
    ]})
    return {"rows": out, "actions": actions}
