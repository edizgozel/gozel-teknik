from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit import log_action
from app.database import get_db
from app.models import Part, StockMovement
from app.part_schemas import (
    PartCreate,
    PartOut,
    PartUpdate,
    StockAdjust,
    StockMovementOut,
)

router = APIRouter(prefix="/parts", tags=["parts"])

MOVEMENT_SIGNS = {
    "initial": +1,
    "purchase": +1,
    "increase": +1,
    "decrease": -1,
    "count": 0,
}


def generate_part_code(db: Session) -> str:
    last = db.scalar(select(Part.part_code).order_by(Part.id.desc()).limit(1))
    next_seq = int(last.split("-")[1]) + 1 if last else 1
    return f"P-{next_seq:05d}"


def get_part_or_404(db: Session, part_id: int) -> Part:
    part = db.get(Part, part_id)
    if part is None:
        raise HTTPException(status_code=404, detail="Parça bulunamadı")
    return part


def serialize_part(part: Part) -> dict:
    data = {c.name: getattr(part, c.name) for c in part.__table__.columns}
    if data["quantity"] == 0:
        level = "out"
    elif data["quantity"] <= data["min_quantity"]:
        level = "low"
    else:
        level = "ok"
    data["stock_level"] = level
    return data


def apply_movement(
    db: Session, part: Part, movement_type: str, quantity: int, note: str | None, service_id: int | None,
    occurred_at=None,
) -> StockMovement:
    sign = MOVEMENT_SIGNS[movement_type]
    before = part.quantity
    if movement_type == "count":
        if quantity < 0:
            raise HTTPException(status_code=422, detail="Sayım değeri eksi olamaz")
        after = quantity
        delta = quantity - before
    else:
        after = before + sign * quantity
        if after < 0:
            raise HTTPException(
                status_code=400, detail="Stok eksiye düşemez"
            )
        delta = sign * quantity
    if delta == 0 and movement_type != "count":
        raise HTTPException(status_code=422, detail="Sıfır miktarlı hareket olamaz")
    if movement_type == "count" and delta == 0:
        raise HTTPException(status_code=422, detail="Sayım mevcut stokla aynı; hareket gereksiz")

    part.quantity = after
    movement = StockMovement(
        part_id=part.id,
        movement_type=movement_type,
        quantity=quantity,
        stock_before=before,
        stock_after=after,
        note=note,
        service_id=service_id,
    )
    if occurred_at:
        movement.created_at = occurred_at
    db.add(movement)
    db.flush()
    return movement


@router.get("", response_model=list[PartOut])
def list_parts(
    q: str | None = None,
    category: str | None = None,
    stock: str = Query(default="all"),
    status: str = Query(default="active"),
    db: Session = Depends(get_db),
):
    stmt = select(Part)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(Part.part_code.ilike(like) | Part.name.ilike(like))
    if category:
        stmt = stmt.where(Part.category == category)
    if status == "active":
        stmt = stmt.where(Part.is_active.is_(True))
    elif status == "passive":
        stmt = stmt.where(Part.is_active.is_(False))
    if stock == "low":
        stmt = stmt.where(Part.quantity > 0, Part.quantity <= Part.min_quantity)
    elif stock == "out":
        stmt = stmt.where(Part.quantity == 0)
    stmt = stmt.order_by(Part.name.asc())
    parts = db.scalars(stmt).unique().all()
    return [serialize_part(p) for p in parts]


@router.post("", response_model=PartOut, status_code=201)
def create_part(payload: PartCreate, db: Session = Depends(get_db)):
    part = Part(part_code=generate_part_code(db), **payload.model_dump(exclude={"initial_quantity"}))
    db.add(part)
    db.flush()
    if payload.initial_quantity > 0:
        apply_movement(db, part, "initial", payload.initial_quantity, "İlk stok girişi", None)
    log_action(db, "part.create", "part", None, f"Parça oluşturuldu: {part.part_code} {part.name}")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Parça kodu üretilemedi, tekrar deneyin")
    db.refresh(part)
    return serialize_part(part)


@router.get("/{part_id}", response_model=PartOut)
def get_part(part_id: int, db: Session = Depends(get_db)):
    return serialize_part(get_part_or_404(db, part_id))


@router.put("/{part_id}", response_model=PartOut)
def update_part(part_id: int, payload: PartUpdate, db: Session = Depends(get_db)):
    part = get_part_or_404(db, part_id)
    changed = [f for f, v in payload.model_dump().items() if getattr(part, f) != v]
    for field, value in payload.model_dump().items():
        setattr(part, field, value)
    log_action(db, "part.update", "part", part.id, f"Parça güncellendi ({part.part_code}); alanlar: {', '.join(changed) or 'yok'}")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Kayıt güncellenemedi")
    db.refresh(part)
    return serialize_part(part)


@router.get("/{part_id}/movements", response_model=list[StockMovementOut])
def list_movements(part_id: int, db: Session = Depends(get_db)):
    get_part_or_404(db, part_id)
    stmt = (
        select(StockMovement)
        .where(StockMovement.part_id == part_id)
        .order_by(StockMovement.id.desc())
    )
    return db.scalars(stmt).unique().all()


@router.post("/{part_id}/movements", response_model=PartOut)
def add_movement(
    part_id: int, payload: StockAdjust, db: Session = Depends(get_db)
):
    part = get_part_or_404(db, part_id)
    if not part.is_active:
        raise HTTPException(status_code=400, detail="Pasif parçaya stok hareketi eklenemez")
    try:
        apply_movement(db, part, payload.movement_type, payload.quantity, payload.note, None, payload.occurred_at)
        log_action(db, "stock.movement", "part", part.id, f"Stok hareketi ({part.part_code}): {payload.movement_type} {payload.quantity}")
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Stok hareketi kaydedilemedi")
    db.refresh(part)
    return serialize_part(part)
