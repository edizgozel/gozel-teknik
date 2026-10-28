from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit import log_action
from app.database import get_db
from app.models import (
    Customer,
    Device,
    Part,
    PartUsage,
    RepairAction,
    ServiceDiagnosis,
    ServiceRecord,
    ServiceStatusHistory,
    StockMovement,
)
from app.part_schemas import PartUsageCreate, PartUsageOut
from app.service_schemas import (
    DiagnosisOut,
    DiagnosisUpdate,
    RepairActionCreate,
    ServiceCreate,
    ServiceDetailOut,
    ServiceOut,
    ServiceStatusUpdate,
)

router = APIRouter(prefix="/services", tags=["services"])

# Bu durumlarda teşhis/onarım kaydı eklenemez veya düzenlenemez
EDITABLE_STATUSES = {"intake", "diagnosis", "awaiting_parts", "repairing", "ready"}

VALID_TRANSITIONS: dict[str, set[str]] = {
    "intake": {"diagnosis", "cancelled"},
    "diagnosis": {"awaiting_parts", "repairing", "ready", "cancelled"},
    "awaiting_parts": {"repairing", "diagnosis", "cancelled"},
    "repairing": {"awaiting_parts", "ready", "cancelled"},
    "ready": {"delivered", "repairing", "cancelled"},
    "delivered": {"closed"},
    "closed": set(),
    "cancelled": set(),
}


def serialize_service(service: ServiceRecord) -> dict:
    device = service.device
    data = {
        c.name: getattr(service, c.name)
        for c in service.__table__.columns
        if c.name not in ("customer_id", "device_id")
    }
    data.update(
        {
            "customer_id": service.customer_id,
            "device_id": service.device_id,
            "customer_name": service.customer.name,
            "customer_phone": service.customer.phone,
            "device_label": f"{device.brand} {device.model}",
            "device_type": device.type,
            "device_serial": device.serial_no,
            "estimated_delivery": service.estimated_delivery,
            "parts": [
                {
                    "id": u.id,
                    "service_id": u.service_id,
                    "part_id": u.part_id,
                    "part_code": u.part.part_code,
                    "part_name": u.part.name,
                    "unit": u.part.unit,
                    "quantity": u.quantity,
                    "movement_id": u.movement_id,
                    "sale_price_kurus": u.sale_price_kurus,
                    "reversed": u.reversed_by_movement_id is not None,
                    "created_at": u.created_at,
                }
                for u in service.part_usages
            ],
        }
    )
    return data


def generate_service_no(db: Session) -> str:
    year = datetime.now().year
    last_no = db.scalar(
        select(ServiceRecord.service_no)
        .where(ServiceRecord.service_no.like(f"GT-{year}-%"))
        .order_by(ServiceRecord.id.desc())
        .limit(1)
    )
    next_seq = int(last_no.split("-")[2]) + 1 if last_no else 1
    return f"GT-{year}-{next_seq:05d}"


def get_service_or_404(db: Session, service_id: int) -> ServiceRecord:
    service = db.get(ServiceRecord, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Servis kaydı bulunamadı")
    return service


@router.get("", response_model=list[ServiceOut])
def list_services(
    q: str | None = None,
    status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    sort: str = Query(default="created_desc"),
    db: Session = Depends(get_db),
):
    stmt = select(ServiceRecord)
    if q:
        like = f"%{q.strip()}%"
        digits = "".join(ch for ch in q if ch.isdigit())
        phone_filter = Customer.phone.ilike(like)
        if len(digits) >= 4:
            phone_filter = phone_filter | Customer.phone.ilike(f"%{digits}%")
        stmt = stmt.where(
            ServiceRecord.service_no.ilike(like)
            | ServiceRecord.customer.has(Customer.name.ilike(like))
            | ServiceRecord.customer.has(phone_filter)
            | ServiceRecord.device.has(Device.brand.ilike(like))
            | ServiceRecord.device.has(Device.model.ilike(like))
        )
    if status:
        stmt = stmt.where(ServiceRecord.status == status)
    if date_from:
        stmt = stmt.where(sa_func.date(ServiceRecord.created_at) >= date_from)
    if date_to:
        stmt = stmt.where(sa_func.date(ServiceRecord.created_at) <= date_to)
    order_map = {
        "created_desc": ServiceRecord.created_at.desc(),
        "created_asc": ServiceRecord.created_at.asc(),
    }
    stmt = stmt.order_by(order_map.get(sort, ServiceRecord.created_at.desc()))
    services = db.scalars(stmt).unique().all()
    return [serialize_service(s) for s in services]


@router.post("", response_model=ServiceDetailOut, status_code=201)
def create_service(payload: ServiceCreate, db: Session = Depends(get_db)):
    customer = db.get(Customer, payload.customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")
    device = db.get(Device, payload.device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Cihaz bulunamadı")
    if device.customer_id != payload.customer_id:
        raise HTTPException(
            status_code=400,
            detail="Seçilen cihaz bu müşteriye ait değil",
        )
    estimated = (
        datetime.combine(payload.estimated_delivery, datetime.min.time())
        if payload.estimated_delivery
        else None
    )

    for attempt in range(5):
        service = ServiceRecord(
            service_no=generate_service_no(db),
            status="intake",
            **payload.model_dump(exclude={"estimated_delivery"}),
            estimated_delivery=estimated,
        )
        service.history.append(
            ServiceStatusHistory(previous_status=None, new_status="intake")
        )
        db.add(service)
        try:
            log_action(db, "service.create", "service", None, f"Servis oluşturuldu: {service.service_no}")
            db.commit()
            db.refresh(service)
            return serialize_service(service) | {
                "history": [h for h in service.history]
            }
        except IntegrityError:
            db.rollback()
    raise HTTPException(status_code=500, detail="Servis numarası üretilemedi")


@router.get("/{service_id}", response_model=ServiceDetailOut)
def get_service(service_id: int, db: Session = Depends(get_db)):
    service = get_service_or_404(db, service_id)
    data = serialize_service(service)
    data["history"] = list(service.history)
    data["diagnosis"] = service.diagnosis
    data["repairs"] = list(service.repairs)
    return data


@router.post("/{service_id}/parts", response_model=ServiceDetailOut, status_code=201)
def use_part(service_id: int, payload: PartUsageCreate, db: Session = Depends(get_db)):
    from datetime import timedelta

    from sqlalchemy import text

    service = get_service_or_404(db, service_id)
    ensure_editable(service)
    part = db.get(Part, payload.part_id)
    if part is None:
        raise HTTPException(status_code=404, detail="Parça bulunamadı")
    if not part.is_active:
        raise HTTPException(status_code=400, detail="Pasif parça serviste kullanılamaz")

    last_usage = db.scalars(
        select(PartUsage)
        .where(
            PartUsage.service_id == service_id,
            PartUsage.part_id == payload.part_id,
            PartUsage.quantity == payload.quantity,
        )
        .order_by(PartUsage.id.desc())
        .limit(1)
    ).first()
    utc_now = datetime.utcnow()
    if last_usage and utc_now - last_usage.created_at < timedelta(seconds=2):
        raise HTTPException(
            status_code=409, detail="Aynı kullanım az önce kaydedildi; çift kayıt engellendi"
        )

    result = db.execute(
        text(
            "UPDATE parts SET quantity = quantity - :qty "
            "WHERE id = :pid AND quantity >= :qty"
        ),
        {"qty": payload.quantity, "pid": part.id},
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=400,
            detail=f"Yetersiz stok: {part.name} (mevcut {part.quantity} {part.unit})",
        )
    db.refresh(part)
    movement = StockMovement(
        part_id=part.id,
        movement_type="service_use",
        quantity=payload.quantity,
        stock_before=part.quantity + payload.quantity,
        stock_after=part.quantity,
        note=f"Servis kullanımı ({service.service_no})",
        service_id=service_id,
    )
    db.add(movement)
    db.flush()
    usage = PartUsage(
        service_id=service_id,
        part_id=part.id,
        quantity=payload.quantity,
        movement_id=movement.id,
        sale_price_kurus=part.sale_price_kurus,
    )
    db.add(usage)
    log_action(db, "service.part_use", "part", part.id, f"Serviste parça kullanıldı ({service.service_no}): {part.name} x{payload.quantity}")
    db.commit()
    db.refresh(service)
    data = serialize_service(service)
    data["history"] = list(service.history)
    data["diagnosis"] = service.diagnosis
    data["repairs"] = list(service.repairs)
    return data


@router.delete("/{service_id}/parts/{usage_id}", response_model=ServiceDetailOut)
def cancel_part_usage(
    service_id: int, usage_id: int, db: Session = Depends(get_db)
):
    from datetime import timedelta

    from sqlalchemy import text

    service = get_service_or_404(db, service_id)
    usage = db.get(PartUsage, usage_id)
    if usage is None or usage.service_id != service_id:
        raise HTTPException(status_code=404, detail="Parça kullanım kaydı bulunamadı")
    original = db.get(StockMovement, usage.movement_id)
    reversal = StockMovement(
        part_id=usage.part_id,
        movement_type="usage_reversal",
        quantity=usage.quantity,
        stock_before=None,
        stock_after=None,
        note=f"Kullanım iptali (kayıt #{usage.id})",
        service_id=service_id,
    )
    result = db.execute(
        text(
            "UPDATE parts SET quantity = quantity + :qty "
            "WHERE id = :pid"
        ),
        {"qty": usage.quantity, "pid": usage.part_id},
    )
    part = db.get(Part, usage.part_id)
    reversal.stock_before = part.quantity - usage.quantity
    reversal.stock_after = part.quantity
    reversal.original_movement_id = original.id if original else None
    db.add(reversal)
    db.flush()
    log_action(db, "service.part_revert", "part", usage.part_id, f"Parça kullanımı iptal edildi ({service.service_no}): kayıt #{usage.id}")
    usage.movement_id = usage.movement_id
    usage.reversed_by_movement_id = reversal.id
    db.commit()
    db.refresh(service)
    data = serialize_service(service)
    data["history"] = list(service.history)
    data["diagnosis"] = service.diagnosis
    data["repairs"] = list(service.repairs)
    return data


@router.get("/{service_id}/parts", response_model=list[PartUsageOut])
def list_service_parts(service_id: int, db: Session = Depends(get_db)):
    get_service_or_404(db, service_id)
    stmt = (
        select(PartUsage)
        .where(PartUsage.service_id == service_id)
        .order_by(PartUsage.id.asc())
    )
    usages = db.scalars(stmt).unique().all()
    out = []
    for u in usages:
        part = db.get(Part, u.part_id)
        d = {
            c.name: getattr(u, c.name) for c in u.__table__.columns
        }
        d["part_code"] = part.part_code
        d["part_name"] = part.name
        d["unit"] = part.unit
        out.append(d)
    return out
    service = get_service_or_404(db, service_id)
    data = serialize_service(service)
    data["history"] = list(service.history)
    data["diagnosis"] = service.diagnosis
    data["repairs"] = list(service.repairs)
    return data


def ensure_editable(service: ServiceRecord) -> None:
    if service.status not in EDITABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Servis {service.status} durumunda; teşhis ve onarım kaydı "
                "eklenemez veya düzenlenemez"
            ),
        )


@router.put("/{service_id}/diagnosis", response_model=DiagnosisOut)
def upsert_diagnosis(
    service_id: int, payload: DiagnosisUpdate, db: Session = Depends(get_db)
):
    service = get_service_or_404(db, service_id)
    ensure_editable(service)
    values = payload.model_dump()
    is_new = service.diagnosis is None
    if is_new and all(v in (None, "") for v in values.values()):
        raise HTTPException(
            status_code=422, detail="Teşhis formu tamamen boş olamaz"
        )
    entry = service.diagnosis
    if entry is None:
        entry = ServiceDiagnosis(service_id=service.id)
        db.add(entry)
    for field, value in values.items():
        setattr(entry, field, value if value not in ("",) else None)
    log_action(db, "service.diagnosis", "service", service.id, f"Teşhis kaydedildi ({service.service_no})")
    db.commit()
    db.refresh(entry)
    return entry


@router.post("/{service_id}/repairs", response_model=ServiceDetailOut, status_code=201)
def add_repair_action(
    service_id: int, payload: RepairActionCreate, db: Session = Depends(get_db)
):
    service = get_service_or_404(db, service_id)
    ensure_editable(service)
    action = RepairAction(service_id=service.id, **payload.model_dump())
    db.add(action)
    log_action(db, "service.repair", "service", service.id, f"Onarım işlemi eklendi ({service.service_no}): {payload.action[:80]}")
    db.commit()
    db.refresh(service)
    data = serialize_service(service)
    data["history"] = list(service.history)
    data["diagnosis"] = service.diagnosis
    data["repairs"] = list(service.repairs)
    return data


@router.post("/{service_id}/status", response_model=ServiceDetailOut)
def update_service_status(
    service_id: int, payload: ServiceStatusUpdate, db: Session = Depends(get_db)
):
    service = get_service_or_404(db, service_id)
    allowed = VALID_TRANSITIONS[service.status]
    if payload.new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Geçersiz durum geçişi: {service.status} → {payload.new_status}",
        )
    history_entry = ServiceStatusHistory(
        previous_status=service.status,
        new_status=payload.new_status,
        note=payload.note,
    )
    service.status = payload.new_status
    log_action(db, "service.status", "service", service.id, f"Servis {service.service_no} durumu: {service.status} → {payload.new_status}")
    service.history.append(history_entry)
    db.add(history_entry)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Durum güncellenemedi")
    db.refresh(service)
    return serialize_service(service) | {"history": list(service.history)}
