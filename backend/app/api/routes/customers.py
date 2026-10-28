from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import log_action
from app.database import get_db
from app.models import Customer
from app.schemas import CustomerCreate, CustomerOut, CustomerUpdate

router = APIRouter(prefix="/customers", tags=["customers"])


def generate_customer_no(db: Session) -> str:
    last_no = db.scalar(
        select(Customer.customer_no).order_by(Customer.id.desc()).limit(1)
    )
    next_seq = int(last_no.split("-")[1]) + 1 if last_no else 1
    return f"M-{next_seq:05d}"


def get_customer_or_404(db: Session, customer_id: int) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")
    return customer


@router.get("", response_model=list[CustomerOut])
def list_customers(
    q: str | None = None,
    status: str = "all",
    sort: str = Query(default="created_desc"),
    db: Session = Depends(get_db),
):
    stmt = select(Customer)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            Customer.name.ilike(like)
            | Customer.customer_no.ilike(like)
            | Customer.phone.ilike(like)
        )
    if status == "active":
        stmt = stmt.where(Customer.is_active.is_(True))
    elif status == "passive":
        stmt = stmt.where(Customer.is_active.is_(False))
    order_map = {
        "created_desc": Customer.created_at.desc(),
        "name_asc": Customer.name.asc(),
        "name_desc": Customer.name.desc(),
    }
    stmt = stmt.order_by(order_map.get(sort, Customer.created_at.desc()))
    return db.scalars(stmt).all()


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    customer = Customer(
        customer_no=generate_customer_no(db),
        **payload.model_dump(),
    )
    db.add(customer)
    log_action(db, "customer.create", "customer", None, f"Müşteri oluşturuldu: {customer.name}")
    db.commit()
    db.refresh(customer)
    return customer


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    return get_customer_or_404(db, customer_id)


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db)
):
    customer = get_customer_or_404(db, customer_id)
    changed = [f for f, v in payload.model_dump().items() if getattr(customer, f) != v]
    for field, value in payload.model_dump().items():
        setattr(customer, field, value)
    log_action(db, "customer.update", "customer", customer.id, f"Müşteri güncellendi ({customer.customer_no}); alanlar: {', '.join(changed) or 'yok'}")
    db.commit()
    db.refresh(customer)
    return customer
