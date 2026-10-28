from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

DeviceType = Literal["bilgisayar", "dizustu", "telefon", "tablet", "diger"]
DEVICE_TYPES = {"bilgisayar", "dizustu", "telefon", "tablet", "diger"}


def normalize_phone(value: str | None) -> str | None:
    if value is None:
        return value
    compact = "".join(ch for ch in value if ch.isdigit() or ch == "+")
    digits = compact.lstrip("+")
    if not (7 <= len(digits) <= 15):
        raise ValueError("Telefon numarası 7-15 basamaklı olmalıdır")
    return compact


class CustomerBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str
    email: EmailStr | None = None
    address: str | None = Field(default=None, max_length=300)
    note: str | None = Field(default=None, max_length=500)

    @field_validator("phone")
    @classmethod
    def check_phone(cls, value: str) -> str:
        return normalize_phone(value)


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(CustomerBase):
    is_active: bool = True


class CustomerOut(CustomerBase):
    id: int
    customer_no: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class DeviceBase(BaseModel):
    customer_id: int | None = None
    type: DeviceType
    brand: str = Field(min_length=1, max_length=60)
    model: str = Field(min_length=1, max_length=60)
    serial_no: str | None = Field(default=None, max_length=80)
    note: str | None = Field(default=None, max_length=500)


class DeviceCreate(DeviceBase):
    pass


class DeviceUpdate(DeviceBase):
    is_active: bool = True


class DeviceOut(DeviceBase):
    id: int
    device_no: str
    is_active: bool
    created_at: datetime
    customer_name: str | None = None

    model_config = {"from_attributes": True}
