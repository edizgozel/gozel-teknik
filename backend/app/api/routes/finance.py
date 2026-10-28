from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.routes.services import get_service_or_404
from app.audit import log_action
from app.database import get_db
from app.finance_schemas import (
    ChargesUpdate,
    FinanceOut,
    PaymentCreate,
    PaymentOut,
    RefundCreate,
    RefundOut,
)
from app.models import (
    Customer,
    Payment,
    Refund,
    ServiceCharge,
    ServiceRecord,
)

router = APIRouter(prefix="/services", tags=["finance"])
payments_router = APIRouter(prefix="/payments", tags=["finance"])

VALID_METHODS = {"cash", "transfer", "card", "other"}


def line_total(line: ServiceCharge) -> int:
    return line.quantity * line.unit_price_kurus


def valid_payments(db: Session, service_id: int) -> list[Payment]:
    return db.scalars(
        select(Payment).where(
            Payment.service_id == service_id, Payment.status == "valid"
        )
    ).unique().all()


def refunded_total(db: Session, payment_id: int) -> int:
    return sum(
        r.amount_kurus
        for r in db.scalars(select(Refund).where(Refund.payment_id == payment_id))
    )


def compute_finance(db: Session, service: ServiceRecord) -> dict:
    charges = db.scalars(
        select(ServiceCharge)
        .where(ServiceCharge.service_id == service.id)
        .order_by(ServiceCharge.id)
    ).unique().all()

    labor = sum(line_total(c) for c in charges if c.charge_type == "labor")
    extra = sum(line_total(c) for c in charges if c.charge_type == "extra")
    discount = sum(line_total(c) for c in charges if c.charge_type == "discount")
    parts = sum(
        (u.sale_price_kurus or 0) * u.quantity
        for u in service.part_usages
        if u.reversed_by_movement_id is None
    )
    grand = labor + extra + parts - discount
    if grand < 0:
        raise HTTPException(status_code=400, detail="Genel toplam negatif olamaz")

    payments = valid_payments(db, service.id)
    paid = sum(p.amount_kurus for p in payments) - sum(
        refunded_total(db, p.id) for p in payments
    )
    balance = max(grand - paid, 0)

    if grand == 0:
        status = "no_charge"
    elif paid == 0:
        status = "unpaid"
    elif paid < grand:
        status = "partially_paid"
    else:
        status = "paid"

    return {
        "labor_total": labor,
        "parts_total": parts,
        "extra_total": extra,
        "discount_total": discount,
        "grand_total": grand,
        "paid_total": paid,
        "balance": balance,
        "payment_status": status,
        "charges": charges,
        "payments": [
            {
                "id": p.id,
                "payment_no": p.payment_no,
                "amount_kurus": p.amount_kurus,
                "method": p.method,
                "status": p.status,
                "refunded_kurus": refunded_total(db, p.id),
                "note": p.note,
                "created_at": p.created_at,
            }
            for p in db.scalars(
                select(Payment)
                .where(Payment.service_id == service.id)
                .order_by(Payment.id)
            ).unique().all()
        ],
    }


def generate_payment_no(db: Session) -> str:
    last = db.scalar(select(Payment.payment_no).order_by(Payment.id.desc()).limit(1))
    next_seq = int(last.split("-")[1]) + 1 if last else 1
    return f"T-{next_seq:05d}"


def serialize_payment(db: Session, p: Payment) -> dict:
    service = db.get(ServiceRecord, p.service_id)
    return {
        c.name: getattr(p, c.name) for c in p.__table__.columns if c.name != "service_id"
    } | {
        "service_id": p.service_id,
        "service_no": service.service_no,
        "customer_name": service.customer.name,
        "refunded_kurus": refunded_total(db, p.id),
    }


@router.get("/{service_id}/finance", response_model=FinanceOut)
def get_finance(service_id: int, db: Session = Depends(get_db)):
    service = get_service_or_404(db, service_id)
    return compute_finance(db, service)


@router.put("/{service_id}/charges", response_model=FinanceOut)
def update_charges(service_id: int, payload: ChargesUpdate, db: Session = Depends(get_db)):
    service = get_service_or_404(db, service_id)

    labor_extra = sum(
        l.quantity * l.unit_price_kurus for l in payload.lines if l.charge_type != "discount"
    )
    parts = sum(
        (u.sale_price_kurus or 0) * u.quantity
        for u in service.part_usages
        if u.reversed_by_movement_id is None
    )
    discount = sum(
        l.quantity * l.unit_price_kurus for l in payload.lines if l.charge_type == "discount"
    )
    if labor_extra + parts - discount < 0:
        raise HTTPException(
            status_code=422,
            detail="İndirim, hizmet ve parça toplamını aşamaz",
        )

    for existing in list(service.charges):
        db.delete(existing)
    for line in payload.lines:
        db.add(
            ServiceCharge(
                service_id=service.id,
                charge_type=line.charge_type,
                description=line.description,
                quantity=line.quantity,
                unit_price_kurus=line.unit_price_kurus,
            )
        )
    log_action(db, "service.charges", "service", service.id, f"Servis ücretleri güncellendi ({service.service_no}); {len(payload.lines)} kalem")
    db.commit()
    return compute_finance(db, service)


@router.post("/{service_id}/payments", response_model=FinanceOut, status_code=201)
def add_payment(service_id: int, payload: PaymentCreate, db: Session = Depends(get_db)):
    service = get_service_or_404(db, service_id)
    if payload.method not in VALID_METHODS:
        raise HTTPException(status_code=422, detail="Geçersiz ödeme yöntemi")

    finance = compute_finance(db, service)
    if payload.amount_kurus > finance["balance"]:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Tahsilat kalan borcu aşamaz (kalan: "
                f"{finance['balance'] / 100:.2f} TL)"
            ),
        )

    recent = db.scalars(
        select(Payment)
        .where(
            Payment.service_id == service_id,
            Payment.amount_kurus == payload.amount_kurus,
            Payment.status == "valid",
        )
        .order_by(Payment.id.desc())
        .limit(1)
    ).first()
    utc_now = datetime.utcnow()
    if recent and utc_now - recent.recorded_at < timedelta(seconds=2):
        raise HTTPException(
            status_code=409, detail="Aynı tahsilat az önce kaydedildi; çift kayıt engellendi"
        )

    payment = Payment(
        payment_no=generate_payment_no(db),
        service_id=service_id,
        amount_kurus=payload.amount_kurus,
        method=payload.method,
        note=payload.note,
    )
    payment.recorded_at = datetime.utcnow()
    if payload.occurred_at:
        payment.created_at = payload.occurred_at
    db.add(payment)
    log_action(db, "payment.create", "payment", None, f"Tahsilat oluşturuldu ({service.service_no}): {payload.amount_kurus/100:.2f} TL")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Tahsilat kaydedilemedi")
    return compute_finance(db, service)


@payments_router.get("", response_model=list[PaymentOut])
def list_payments(
    q: str | None = None,
    method: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(Payment).order_by(Payment.id.desc())
    payments = db.scalars(stmt).unique().all()
    out = [serialize_payment(db, p) for p in payments]
    if q:
        needle = q.strip().lower()
        out = [
            o
            for o in out
            if needle in o["payment_no"].lower()
            or needle in o["service_no"].lower()
            or needle in o["customer_name"].lower()
        ]
    if method:
        out = [o for o in out if o["method"] == method]
    if date_from:
        out = [o for o in out if o["created_at"] >= date_from]
    if date_to:
        out = [o for o in out if o["created_at"] <= date_to]
    return out


@payments_router.post("/{payment_id}/cancel", response_model=PaymentOut)
def cancel_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(status_code=404, detail="Tahsilat bulunamadı")
    if payment.status != "valid":
        raise HTTPException(status_code=400, detail="Bu tahsilat zaten geçerli değil")
    if refunded_total(db, payment_id) > 0:
        raise HTTPException(
            status_code=400, detail="İadesi bulunan tahsilat iptal edilemez"
        )
    payment.status = "cancelled"
    log_action(db, "payment.cancel", "payment", payment.id, f"Tahsilat iptal edildi ({payment.payment_no})")
    db.commit()
    return serialize_payment(db, payment)


@payments_router.post("/{payment_id}/refunds", response_model=PaymentOut)
def refund_payment(payment_id: int, payload: RefundCreate, db: Session = Depends(get_db)):
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(status_code=404, detail="Tahsilat bulunamadı")
    if payment.status != "valid":
        raise HTTPException(status_code=400, detail="Geçersiz tahsilata iade yapılamaz")
    refundable = payment.amount_kurus - refunded_total(db, payment_id)
    if payload.amount_kurus > refundable:
        raise HTTPException(
            status_code=400,
            detail=f"İade, iade edilebilir tutarı aşamaz (en fazla {refundable / 100:.2f} TL)",
        )
    refund = Refund(payment_id=payment_id, amount_kurus=payload.amount_kurus, note=payload.note)
    db.add(refund)
    log_action(db, "payment.refund", "payment", payment_id, f"İade kaydedildi ({payment.payment_no}): {payload.amount_kurus/100:.2f} TL")
    db.commit()
    db.refresh(refund)
    return serialize_payment(db, payment)


@payments_router.get("/{payment_id}/refunds", response_model=list[RefundOut])
def list_refunds(payment_id: int, db: Session = Depends(get_db)):
    if db.get(Payment, payment_id) is None:
        raise HTTPException(status_code=404, detail="Tahsilat bulunamadı")
    return db.scalars(
        select(Refund).where(Refund.payment_id == payment_id).order_by(Refund.id)
    ).unique().all()


@router.get("/{service_id}/payments/{payment_id}/refunds", response_model=list[RefundOut])
def list_service_payment_refunds(
    service_id: int, payment_id: int, db: Session = Depends(get_db)
):
    return list_refunds(payment_id, db)


@router.get("/{service_id}/documents/{kind}.pdf")
def service_document_pdf(service_id: int, kind: str, db: Session = Depends(get_db)):
    from fastapi.responses import Response

    from app.api.routes.finance import compute_finance as _compute
    from app.pdf import DocPDF, tl, tr_date
    from app.api.routes.settings import get_settings_dict

    business = get_settings_dict(db)
    service = get_service_or_404(db, service_id)
    if kind not in ("kabul", "teslim"):
        raise HTTPException(status_code=404, detail="Belge türü bulunamadı")
    delivery = kind == "teslim"

    pdf = DocPDF(title=f"{service.service_no} servis {kind} belgesi", business=business)
    pdf.banner("SERVİS TESLİM BELGESİ" if delivery else "SERVİS KABUL BELGESİ")
    pdf.ln(1)
    rows = [
        ("Servis Numarası", service.service_no),
        ("Kabul Tarihi", tr_date(service.created_at)),
    ]
    if delivery:
        delivered = service.status in ("delivered", "closed")
        rows.append(("Teslim Tarihi", tr_date(service.updated_at) if delivered else "— (teslim edilmedi)"))
    rows += [
        ("Müşteri", f"{service.customer.name} — {service.customer.phone}"),
        ("Cihaz", f"{service.device.brand} {service.device.model}"),
        ("Seri Numarası", service.device.serial_no),
    ]
    pdf.kv_table(rows)

    if not delivery:
        pdf.kv_table([
            ("Bildirilen Arıza", service.reported_issue),
            ("Fiziksel Durum", service.physical_condition),
            ("Aksesuarlar", service.accessories),
            ("Kabul Notu", service.note),
        ])
    else:
        pdf.ln(2)
        pdf.banner("Teşhis ve Onarım")
        pdf.kv_table([
            ("Bildirilen Arıza", service.reported_issue),
            ("Teşhis", service.diagnosis.diagnosis if service.diagnosis else None),
            ("Tespit Edilen Arıza", service.diagnosis.found_issue if service.diagnosis else None),
            ("Yapılan İşlemler", " | ".join(r.action for r in service.repairs) or None),
        ])
        pdf.ln(2)
        pdf.banner("Kullanılan Parçalar")
        pdf.table(
            ["Parça", "Kod", "Miktar"],
            [[u.part.name, u.part.part_code, f"{u.quantity} {u.part.unit}"] for u in service.part_usages if not u.reversed_by_movement_id],
            [90, 50, 42],
        )
        pdf.ln(2)
        pdf.banner("Ücretlendirme")
        f = _compute(db, service)
        pdf.totals([
            ("İşçilik", tl(f["labor_total"])),
            ("Parçalar", tl(f["parts_total"])),
            ("Ek Hizmetler", tl(f["extra_total"])),
            ("İndirim", "-" + tl(f["discount_total"])),
            ("Genel Toplam", tl(f["grand_total"])),
            ("Tahsil Edilen", tl(f["paid_total"])),
            ("Kalan Borç", tl(f["balance"])),
        ])
        if service.status not in ("delivered", "closed"):
            pdf.ln(2)
            pdf.set_font("seg", "", 8.5)
            pdf.set_text_color(138, 90, 0)
            pdf.multi_cell(0, 5, "Not: Servis henüz teslim edilmedi; bu belge taslaktır ve teslim kaydı oluşturmaz.")

    pdf.ln(14)
    pdf.set_draw_color(150, 145, 141)
    pdf.line(24, pdf.get_y(), 84, pdf.get_y())
    pdf.line(112, pdf.get_y(), 172, pdf.get_y())
    pdf.set_font("seg", "", 9)
    pdf.set_text_color(92, 85, 81)
    pdf.set_xy(24, pdf.get_y() + 1)
    pdf.cell(60, 5, "Müşteri", align="C")
    pdf.set_xy(112, pdf.get_y() + 1)
    pdf.cell(60, 5, "Servis Yetkilisi", align="C")

    filename = f"{service.service_no}-servis-{kind}.pdf"
    return Response(
        content=bytes(pdf.output()),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
