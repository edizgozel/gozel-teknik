import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Part, Payment, ServiceRecord, StockMovement
from app.api.routes.finance import refunded_total
from app.schemas import DEVICE_TYPES

router = APIRouter(prefix="/reports", tags=["reports"])

PART_CATEGORY_LABELS_TR = {
    "ekran": "Ekran",
    "batarya": "Batarya",
    "klavye": "Klavye",
    "anakart": "Anakart",
    "sarj_girisi": "Şarj Girişi",
    "kablo_flex": "Kablo / Flex",
    "fan_sogutma": "Fan / Soğutma",
    "kasa_parca": "Kasa Parçası",
    "vida_seti": "Vida Seti",
    "diger": "Diğer",
}

STATUS_LABELS_TR = {
    "intake": "Servis kabul edildi",
    "diagnosis": "Arıza teşhisi yapılıyor",
    "awaiting_parts": "Parça bekleniyor",
    "repairing": "Onarım yapılıyor",
    "ready": "Teslimata hazır",
    "delivered": "Müşteriye teslim edildi",
    "closed": "Servis kapatıldı",
    "cancelled": "İptal edildi",
}

METHOD_LABELS_TR = {
    "cash": "Nakit",
    "transfer": "Havale/EFT",
    "card": "Kart",
    "other": "Diğer",
}


def parse_date(value: str | None, end: bool = False) -> datetime | None:
    if not value:
        return None
    dt = datetime.strptime(value, "%Y-%m-%d")
    return dt.replace(hour=23, minute=59, second=59) if end else dt


def csv_response(filename: str, headers: list[str], rows: list[list]) -> StreamingResponse:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    writer.writerows(rows)
    buffer.seek(0)
    data = b"\xef\xbb\xbf" + buffer.getvalue().encode("utf-8")
    return StreamingResponse(
        iter([data]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def service_rows(db: Session, date_from, date_to, status):
    stmt = select(ServiceRecord).order_by(ServiceRecord.created_at.desc())
    services = db.scalars(stmt).unique().all()
    rows = []
    for s in services:
        if date_from and s.created_at < date_from:
            continue
        if date_to and s.created_at > date_to:
            continue
        if status and s.status != status:
            continue
        rows.append(
            {
                "service_no": s.service_no,
                "customer": s.customer.name,
                "device": f"{s.device.brand} {s.device.model}",
                "status": STATUS_LABELS_TR[s.status],
                "created": s.created_at.strftime("%d.%m.%Y %H:%M"),
            }
        )
    return rows


@router.get("/services")
def services_report(
    date_from: str | None = None,
    date_to: str | None = None,
    status: str | None = None,
    format: str = Query(default="json"),
    db: Session = Depends(get_db),
):
    rows = service_rows(db, parse_date(date_from), parse_date(date_to, end=True), status)
    distribution: dict[str, int] = {}
    for row in rows:
        distribution[row["status"]] = distribution.get(row["status"], 0) + 1
    if format == "csv":
        return csv_response(
            "servis-raporu.csv",
            ["Servis No", "Müşteri", "Cihaz", "Durum", "Kabul Tarihi"],
            [[r["service_no"], r["customer"], r["device"], r["status"], r["created"]] for r in rows],
        )
    return {"rows": rows, "total": len(rows), "distribution": distribution}


@router.get("/stock")
def stock_report(
    date_from: str | None = None,
    date_to: str | None = None,
    format: str = Query(default="json"),
    db: Session = Depends(get_db),
):
    parts = db.scalars(select(Part).order_by(Part.name)).unique().all()
    part_rows = [
        {
            "code": p.part_code,
            "name": p.name,
            "category": PART_CATEGORY_LABELS_TR.get(p.category, p.category),
            "quantity": p.quantity,
            "min_quantity": p.min_quantity,
            "level": (
                "Stokta yok" if p.quantity == 0
                else "Düşük stok" if p.quantity <= p.min_quantity
                else "Yeterli"
            ),
            "unit": p.unit,
        }
        for p in parts
    ]
    movements = db.scalars(
        select(StockMovement).order_by(StockMovement.id.desc())
    ).unique().all()
    df, dt = parse_date(date_from), parse_date(date_to, end=True)
    movement_rows = []
    for m in movements:
        if df and m.created_at < df:
            continue
        if dt and m.created_at > dt:
            continue
        part = db.get(Part, m.part_id)
        movement_rows.append(
            {
                "date": m.created_at.strftime("%d.%m.%Y %H:%M"),
                "part": f"{part.part_code} {part.name}",
                "type": m.movement_type,
                "quantity": m.quantity,
                "before": m.stock_before,
                "after": m.stock_after,
            }
        )
    if format == "csv":
        return csv_response(
            "stok-raporu.csv",
            ["Parça Kodu", "Parça", "Kategori", "Stok", "Min.", "Durum", "Birim"],
            [[r["code"], r["name"], r["category"], r["quantity"], r["min_quantity"], r["level"], r["unit"]] for r in part_rows],
        )
    return {"parts": part_rows, "movements": movement_rows, "low_count": sum(1 for r in part_rows if r["level"] == "Düşük stok"), "out_count": sum(1 for r in part_rows if r["level"] == "Stokta yok")}


@router.get("/payments")
def payments_report(
    date_from: str | None = None,
    date_to: str | None = None,
    format: str = Query(default="json"),
    db: Session = Depends(get_db),
):
    df, dt = parse_date(date_from), parse_date(date_to, end=True)
    payments = db.scalars(select(Payment).order_by(Payment.id.desc())).unique().all()
    rows = []
    for p in payments:
        if df and p.created_at < df:
            continue
        if dt and p.created_at > dt:
            continue
        service = db.get(ServiceRecord, p.service_id)
        refunded = refunded_total(db, p.id) if p.status == "valid" else 0
        rows.append(
            {
                "payment_no": p.payment_no,
                "service_no": service.service_no,
                "customer": service.customer.name,
                "amount": p.amount_kurus / 100,
                "method": METHOD_LABELS_TR[p.method],
                "created": p.created_at.strftime("%d.%m.%Y %H:%M"),
                "status": p.status,
                "refunded": refunded / 100,
            }
        )
    if format == "csv":
        return csv_response(
            "tahsilat-raporu.csv",
            ["Tahsilat No", "Servis No", "Müşteri", "Tutar (TL)", "Yöntem", "Tarih", "Durum", "İade (TL)"],
            [
                [r["payment_no"], r["service_no"], r["customer"], f"{r['amount']:.2f}", r["method"], r["created"],
                 "İptal" if r["status"] == "cancelled" else "Geçerli", f"{r['refunded']:.2f}"]
                for r in rows
            ],
        )
    valid = [r for r in rows if r["status"] == "valid"]
    by_method: dict[str, float] = {}
    for r in valid:
        by_method[r["method"]] = by_method.get(r["method"], 0) + r["amount"]
    return {
        "rows": rows,
        "total": sum(r["amount"] for r in valid),
        "refunded_total": sum(r["refunded"] for r in valid),
        "cancelled_count": sum(1 for r in rows if r["status"] == "cancelled"),
        "by_method": by_method,
    }


def _stock_date_range(date_from, date_to):
    return parse_date(date_from), parse_date(date_to, end=True)


@router.get("/services/pdf")
def services_report_pdf(
    date_from: str | None = None, date_to: str | None = None,
    status: str | None = None, db: Session = Depends(get_db),
):
    from fastapi.responses import Response

    from app.pdf import DocPDF, tr_date

    rows = service_rows(db, parse_date(date_from), parse_date(date_to, end=True), status)
    pdf = DocPDF(title="Servis Raporu")
    pdf.banner("SERVİS RAPORU")
    pdf.set_font("seg", "", 9)
    pdf.set_text_color(*[92, 85, 81])
    span = f"{date_from or 'başlangıç'} – {date_to or 'bugün'}"
    pdf.cell(0, 5, f"Dönem: {span}    Oluşturulma: {datetime.now().strftime('%d.%m.%Y %H:%M')}    Kayıt: {len(rows)}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.table(
        ["Servis No", "Müşteri", "Cihaz", "Durum", "Kabul"],
        [[r["service_no"], r["customer"], r["device"], r["status"], r["created"]] for r in rows],
        [30, 45, 45, 40, 22],
    )
    filename = f"servis-raporu-{datetime.now().strftime('%Y%m%d')}.pdf"
    return Response(bytes(pdf.output()), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/stock/pdf")
def stock_report_pdf(
    date_from: str | None = None, date_to: str | None = None,
    db: Session = Depends(get_db),
):
    from fastapi.responses import Response

    from app.pdf import DocPDF, tr_date

    report = stock_report(date_from=date_from, date_to=date_to, db=db)
    pdf = DocPDF(title="Stok Raporu")
    pdf.banner("STOK RAPORU")
    pdf.set_font("seg", "", 9)
    pdf.set_text_color(*[92, 85, 81])
    span = f"{date_from or 'başlangıç'} – {date_to or 'bugün'}"
    pdf.cell(0, 5, f"Dönem: {span}    Oluşturulma: {datetime.now().strftime('%d.%m.%Y %H:%M')}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.table(
        ["Kod", "Parça", "Kategori", "Stok", "Min.", "Durum"],
        [[p["code"], p["name"], p["category"], f'{p["quantity"]} {p["unit"]}', p["min_quantity"], p["level"]] for p in report["parts"]],
        [24, 60, 32, 22, 14, 30],
    )
    pdf.ln(3)
    pdf.banner("Stok Hareketleri (seçili dönem)")
    pdf.table(
        ["Tarih", "Parça", "Tür", "Miktar", "Önce-Sonra"],
        [[m["date"], m["part"], m["type"], m["quantity"], f'{m["before"]}-{m["after"]}'] for m in report["movements"]],
        [32, 70, 30, 20, 30],
    )
    filename = f"stok-raporu-{datetime.now().strftime('%Y%m%d')}.pdf"
    return Response(bytes(pdf.output()), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/payments/pdf")
def payments_report_pdf(
    date_from: str | None = None, date_to: str | None = None,
    db: Session = Depends(get_db),
):
    from fastapi.responses import Response

    from app.pdf import DocPDF, tl

    report = payments_report(date_from=date_from, date_to=date_to, db=db)
    pdf = DocPDF(title="Tahsilat Raporu")
    pdf.banner("TAHSİLAT RAPORU")
    pdf.set_font("seg", "", 9)
    pdf.set_text_color(*[92, 85, 81])
    span = f"{date_from or 'başlangıç'} – {date_to or 'bugün'}"
    pdf.cell(0, 5, f"Dönem: {span}    Oluşturulma: {datetime.now().strftime('%d.%m.%Y %H:%M')}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.table(
        ["Tahsilat No", "Servis", "Müşteri", "Tutar", "Yöntem", "Tarih", "Durum"],
        [[r["payment_no"], r["service_no"], r["customer"], tl(round(r["amount"] * 100)), r["method"], r["created"],
          "İptal" if r["status"] == "cancelled" else "Geçerli"] for r in report["rows"]],
        [26, 26, 42, 22, 24, 26, 16],
    )
    pdf.totals([
        ("Toplam geçerli tahsilat", tl(round(report["total"] * 100))),
        ("Toplam iade", tl(round(report["refunded_total"] * 100))),
        ("İptal işlem sayısı", str(report["cancelled_count"])),
    ])
    filename = f"tahsilat-raporu-{datetime.now().strftime('%Y%m%d')}.pdf"
    return Response(bytes(pdf.output()), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})
