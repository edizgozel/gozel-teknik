from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

PartCategory = Literal[
    "ekran",
    "batarya",
    "klavye",
    "anakart",
    "sarj_girisi",
    "kablo_flex",
    "fan_sogutma",
    "kasa_parca",
    "vida_seti",
    "diger",
]

PART_UNITS = {"adet", "takim", "metre", "paket"}


class PartBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: PartCategory
    compatible_brand: str | None = Field(default=None, max_length=60)
    compatibility_note: str | None = Field(default=None, max_length=300)
    min_quantity: int = Field(default=0, ge=0)
    unit: str = "adet"
    unit_cost: float | None = Field(default=None, ge=0)
    sale_price_kurus: int | None = Field(default=None, ge=0)
    supplier: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool = True


class PartCreate(PartBase):
    initial_quantity: int = Field(default=0, ge=0)


class PartUpdate(PartBase):
    pass


class PartOut(PartBase):
    id: int
    part_code: str
    quantity: int
    stock_level: Literal["ok", "low", "out"]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StockAdjust(BaseModel):
    movement_type: Literal["initial", "purchase", "increase", "decrease", "count"]
    quantity: int = Field(gt=0)
    note: str | None = Field(default=None, max_length=300)
    occurred_at: datetime | None = None


class StockMovementOut(BaseModel):
    id: int
    part_id: int
    movement_type: str
    quantity: int
    stock_before: int
    stock_after: int
    note: str | None
    service_id: int | None
    original_movement_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PartUsageCreate(BaseModel):
    part_id: int
    quantity: int = Field(gt=0)


class PartUsageOut(BaseModel):
    id: int
    service_id: int
    part_id: int
    part_code: str
    part_name: str
    unit: str
    quantity: int
    movement_id: int
    created_at: datetime

    model_config = {"from_attributes": True}
