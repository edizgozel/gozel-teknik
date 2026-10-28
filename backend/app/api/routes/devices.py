from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes.customers import get_customer_or_404
from app.audit import log_action
from app.database import get_db
from app.models import Customer, Device
from app.schemas import DeviceCreate, DeviceOut, DeviceUpdate

router = APIRouter(prefix="/devices", tags=["devices"])


def generate_device_no(db: Session) -> str:
    last_no = db.scalar(select(Device.device_no).order_by(Device.id.desc()).limit(1))
    next_seq = int(last_no.split("-")[1]) + 1 if last_no else 1
    return f"C-{next_seq:05d}"


def serialize_device(device: Device) -> dict:
    data = {
        c.name: getattr(device, c.name)
        for c in device.__table__.columns
        if c.name != "customer_id"
    }
    data["customer_id"] = device.customer_id
    data["customer_name"] = device.customer.name if device.customer else None
    return data


def get_device_or_404(db: Session, device_id: int) -> Device:
    device = db.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Cihaz bulunamadı")
    return device


@router.get("", response_model=list[DeviceOut])
def list_devices(
    q: str | None = None,
    type: str | None = None,
    status: str = "all",
    customer_id: int | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(Device)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            Device.device_no.ilike(like)
            | Device.brand.ilike(like)
            | Device.model.ilike(like)
            | Device.serial_no.ilike(like)
            | Device.customer.has(Customer.name.ilike(like))
        )
    if type:
        stmt = stmt.where(Device.type == type)
    if customer_id:
        stmt = stmt.where(Device.customer_id == customer_id)
    if status == "active":
        stmt = stmt.where(Device.is_active.is_(True))
    elif status == "passive":
        stmt = stmt.where(Device.is_active.is_(False))
    stmt = stmt.order_by(Device.created_at.desc())
    devices = db.scalars(stmt).unique().all()
    return [serialize_device(d) for d in devices]


@router.post("", response_model=DeviceOut, status_code=201)
def create_device(payload: DeviceCreate, db: Session = Depends(get_db)):
    if payload.customer_id is not None:
        get_customer_or_404(db, payload.customer_id)
    if payload.serial_no:
        existing = db.scalar(
            select(Device).where(
                Device.serial_no == payload.serial_no, Device.is_active.is_(True)
            )
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Seri numarası başka bir cihaza kayıtlı: {existing.device_no}",
            )
    device = Device(device_no=generate_device_no(db), **payload.model_dump())
    db.add(device)
    log_action(db, "device.create", "device", None, f"Cihaz oluşturuldu: {device.device_no} {device.brand} {device.model}")
    db.commit()
    db.refresh(device)
    return serialize_device(device)


@router.get("/{device_id}", response_model=DeviceOut)
def get_device(device_id: int, db: Session = Depends(get_db)):
    return serialize_device(get_device_or_404(db, device_id))


@router.put("/{device_id}", response_model=DeviceOut)
def update_device(
    device_id: int, payload: DeviceUpdate, db: Session = Depends(get_db)
):
    device = get_device_or_404(db, device_id)
    if payload.customer_id is not None:
        get_customer_or_404(db, payload.customer_id)
    if payload.serial_no:
        existing = db.scalar(
            select(Device).where(
                Device.serial_no == payload.serial_no,
                Device.is_active.is_(True),
                Device.id != device_id,
            )
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Seri numarası başka bir cihaza kayıtlı: {existing.device_no}",
            )
    changed = [f for f, v in payload.model_dump().items() if getattr(device, f) != v]
    for field, value in payload.model_dump().items():
        setattr(device, field, value)
    log_action(db, "device.update", "device", device.id, f"Cihaz güncellendi ({device.device_no}); alanlar: {', '.join(changed) or 'yok'}")
    db.commit()
    db.refresh(device)
    return serialize_device(device)
