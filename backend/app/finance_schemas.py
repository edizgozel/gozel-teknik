from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ChargeLine(BaseModel):
    charge_type: Literal["labor", "extra", "discount"]
    description: str = Field(min_length=1, max_length=200)
    quantity: int = Field(default=1, ge=1)
    unit_price_kurus: int = Field(ge=0)


class ChargesUpdate(BaseModel):
    lines: list[ChargeLine]


class ChargeLineOut(ChargeLine):
    id: int
    service_id: int

    model_config = {"from_attributes": True}


class PaymentCreate(BaseModel):
    amount_kurus: int = Field(gt=0)
    method: Literal["cash", "transfer", "card", "other"]
    note: str | None = Field(default=None, max_length=300)
    occurred_at: datetime | None = None


class RefundCreate(BaseModel):
    amount_kurus: int = Field(gt=0)
    note: str | None = Field(default=None, max_length=300)


class RefundOut(BaseModel):
    id: int
    payment_id: int
    amount_kurus: int
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaymentOut(BaseModel):
    id: int
    payment_no: str
    service_id: int
    service_no: str
    customer_name: str
    amount_kurus: int
    method: str
    status: str
    refunded_kurus: int
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FinanceOut(BaseModel):
    labor_total: int
    parts_total: int
    extra_total: int
    discount_total: int
    grand_total: int
    paid_total: int
    balance: int
    payment_status: Literal["unpaid", "partially_paid", "paid", "no_charge"]
    charges: list[ChargeLineOut]
    payments: list[dict]
