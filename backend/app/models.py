from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_no: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    phone: Mapped[str] = mapped_column(String(32), index=True)
    email: Mapped[str | None] = mapped_column(String(120))
    address: Mapped[str | None] = mapped_column(String(300))
    note: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    devices: Mapped[list["Device"]] = relationship(back_populates="customer")


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    device_no: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"))
    type: Mapped[str] = mapped_column(String(20), index=True)
    brand: Mapped[str] = mapped_column(String(60), index=True)
    model: Mapped[str] = mapped_column(String(60))
    serial_no: Mapped[str | None] = mapped_column(String(80), index=True)
    note: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    customer: Mapped[Customer | None] = relationship(back_populates="devices")


class ServiceRecord(Base):
    __tablename__ = "service_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    service_no: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id"))
    status: Mapped[str] = mapped_column(String(20), default="intake", index=True)
    reported_issue: Mapped[str] = mapped_column(String(1000))
    physical_condition: Mapped[str | None] = mapped_column(String(500))
    accessories: Mapped[str | None] = mapped_column(String(300))
    note: Mapped[str | None] = mapped_column(String(500))
    estimated_delivery: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    customer: Mapped[Customer] = relationship()
    device: Mapped[Device] = relationship()
    history: Mapped[list["ServiceStatusHistory"]] = relationship(
        back_populates="service", order_by="ServiceStatusHistory.id"
    )
    diagnosis: Mapped["ServiceDiagnosis | None"] = relationship(
        back_populates="service", uselist=False
    )
    repairs: Mapped[list["RepairAction"]] = relationship(
        back_populates="service", order_by="RepairAction.id"
    )
    part_usages: Mapped[list["PartUsage"]] = relationship(
        back_populates="service", order_by="PartUsage.id"
    )
    charges: Mapped[list["ServiceCharge"]] = relationship(
        back_populates="service", order_by="ServiceCharge.id"
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="service", order_by="Payment.id"
    )


class ServiceStatusHistory(Base):
    __tablename__ = "service_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    service_id: Mapped[int] = mapped_column(
        ForeignKey("service_records.id"), index=True
    )
    previous_status: Mapped[str | None] = mapped_column(String(20))
    new_status: Mapped[str] = mapped_column(String(20))
    changed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    note: Mapped[str | None] = mapped_column(String(500))

    service: Mapped[ServiceRecord] = relationship(back_populates="history")


class ServiceDiagnosis(Base):
    __tablename__ = "service_diagnoses"

    id: Mapped[int] = mapped_column(primary_key=True)
    service_id: Mapped[int] = mapped_column(
        ForeignKey("service_records.id"), unique=True, index=True
    )
    diagnosis: Mapped[str | None] = mapped_column(String(1000))
    found_issue: Mapped[str | None] = mapped_column(String(1000))
    proposed_solution: Mapped[str | None] = mapped_column(String(1000))
    customer_message: Mapped[str | None] = mapped_column(String(1000))
    internal_note: Mapped[str | None] = mapped_column(String(500))
    diagnosed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    service: Mapped[ServiceRecord] = relationship(back_populates="diagnosis")


class RepairAction(Base):
    __tablename__ = "repair_actions"

    id: Mapped[int] = mapped_column(primary_key=True)
    service_id: Mapped[int] = mapped_column(
        ForeignKey("service_records.id"), index=True
    )
    action: Mapped[str] = mapped_column(String(1000))
    note: Mapped[str | None] = mapped_column(String(500))
    performed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    service: Mapped[ServiceRecord] = relationship(back_populates="repairs")


class Part(Base):
    __tablename__ = "parts"

    id: Mapped[int] = mapped_column(primary_key=True)
    part_code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    category: Mapped[str] = mapped_column(String(40), index=True)
    compatible_brand: Mapped[str | None] = mapped_column(String(60))
    compatibility_note: Mapped[str | None] = mapped_column(String(300))
    quantity: Mapped[int] = mapped_column(default=0)
    min_quantity: Mapped[int] = mapped_column(default=0)
    unit: Mapped[str] = mapped_column(String(12), default="adet")
    unit_cost: Mapped[float | None] = mapped_column()
    supplier: Mapped[str | None] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(String(500))
    sale_price_kurus: Mapped[int | None] = mapped_column()
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    movements: Mapped[list["StockMovement"]] = relationship(
        back_populates="part", order_by="StockMovement.id"
    )
    usages: Mapped[list["PartUsage"]] = relationship(back_populates="part")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    part_id: Mapped[int] = mapped_column(ForeignKey("parts.id"), index=True)
    movement_type: Mapped[str] = mapped_column(String(20), index=True)
    quantity: Mapped[int] = mapped_column()
    stock_before: Mapped[int] = mapped_column()
    stock_after: Mapped[int] = mapped_column()
    note: Mapped[str | None] = mapped_column(String(300))
    service_id: Mapped[int | None] = mapped_column(
        ForeignKey("service_records.id"), index=True
    )
    original_movement_id: Mapped[int | None] = mapped_column(
        ForeignKey("stock_movements.id")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    part: Mapped[Part] = relationship(back_populates="movements")


class PartUsage(Base):
    __tablename__ = "part_usages"

    id: Mapped[int] = mapped_column(primary_key=True)
    service_id: Mapped[int] = mapped_column(
        ForeignKey("service_records.id"), index=True
    )
    part_id: Mapped[int] = mapped_column(ForeignKey("parts.id"), index=True)
    quantity: Mapped[int] = mapped_column()
    movement_id: Mapped[int] = mapped_column(
        ForeignKey("stock_movements.id"), unique=True
    )
    reversed_by_movement_id: Mapped[int | None] = mapped_column(
        ForeignKey("stock_movements.id")
    )
    sale_price_kurus: Mapped[int | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    part: Mapped[Part] = relationship(back_populates="usages")
    service: Mapped[ServiceRecord] = relationship(back_populates="part_usages")


class ServiceCharge(Base):
    __tablename__ = "service_charges"

    id: Mapped[int] = mapped_column(primary_key=True)
    service_id: Mapped[int] = mapped_column(
        ForeignKey("service_records.id"), index=True
    )
    charge_type: Mapped[str] = mapped_column(String(12), index=True)  # labor | extra | discount
    description: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[int] = mapped_column(default=1)
    unit_price_kurus: Mapped[int] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    service: Mapped[ServiceRecord] = relationship(back_populates="charges")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    payment_no: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    service_id: Mapped[int] = mapped_column(
        ForeignKey("service_records.id"), index=True
    )
    amount_kurus: Mapped[int] = mapped_column()
    method: Mapped[str] = mapped_column(String(12))  # cash | transfer | card | other
    status: Mapped[str] = mapped_column(String(12), default="valid", index=True)  # valid | cancelled
    note: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    recorded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    service: Mapped[ServiceRecord] = relationship(back_populates="payments")
    refunds: Mapped[list["Refund"]] = relationship(back_populates="payment")


class Refund(Base):
    __tablename__ = "refunds"

    id: Mapped[int] = mapped_column(primary_key=True)
    payment_id: Mapped[int] = mapped_column(ForeignKey("payments.id"), index=True)
    amount_kurus: Mapped[int] = mapped_column()
    note: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    payment: Mapped[Payment] = relationship(back_populates="refunds")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    action: Mapped[str] = mapped_column(String(40), index=True)
    entity_type: Mapped[str] = mapped_column(String(30), index=True)
    entity_id: Mapped[int | None] = mapped_column(index=True)
    description: Mapped[str] = mapped_column(String(400))
    source: Mapped[str] = mapped_column(String(20), default="app")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), index=True
    )


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    value: Mapped[str] = mapped_column(String(300))
