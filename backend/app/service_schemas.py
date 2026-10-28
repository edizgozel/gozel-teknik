from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

ServiceStatus = Literal[
    "intake",
    "diagnosis",
    "awaiting_parts",
    "repairing",
    "ready",
    "delivered",
    "closed",
    "cancelled",
]


class ServiceCreate(BaseModel):
    customer_id: int
    device_id: int
    reported_issue: str = Field(min_length=1, max_length=1000)
    physical_condition: str | None = Field(default=None, max_length=500)
    accessories: str | None = Field(default=None, max_length=300)
    note: str | None = Field(default=None, max_length=500)
    estimated_delivery: date | None = None


class ServiceStatusUpdate(BaseModel):
    new_status: ServiceStatus
    note: str | None = Field(default=None, max_length=500)


class ServiceHistoryOut(BaseModel):
    id: int
    previous_status: str | None
    new_status: str
    changed_at: datetime
    note: str | None

    model_config = {"from_attributes": True}


class ServiceOut(BaseModel):
    id: int
    service_no: str
    customer_id: int
    device_id: int
    customer_name: str
    customer_phone: str
    device_label: str
    device_type: str
    device_serial: str | None = None
    status: str
    reported_issue: str
    physical_condition: str | None
    accessories: str | None
    note: str | None
    estimated_delivery: date | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ServiceDetailOut(ServiceOut):
    history: list[ServiceHistoryOut]
    diagnosis: "DiagnosisOut | None" = None
    repairs: list[RepairActionOut] = []
    parts: list[dict] = []


class DiagnosisUpdate(BaseModel):
    diagnosis: str | None = Field(default=None, max_length=1000)
    found_issue: str | None = Field(default=None, max_length=1000)
    proposed_solution: str | None = Field(default=None, max_length=1000)
    customer_message: str | None = Field(default=None, max_length=1000)
    internal_note: str | None = Field(default=None, max_length=500)


class RepairActionCreate(BaseModel):
    action: str = Field(min_length=1, max_length=1000)
    note: str | None = Field(default=None, max_length=500)


class RepairActionOut(BaseModel):
    id: int
    service_id: int
    action: str
    note: str | None
    performed_at: datetime

    model_config = {"from_attributes": True}


class DiagnosisOut(BaseModel):
    id: int
    service_id: int
    diagnosis: str | None
    found_issue: str | None
    proposed_solution: str | None
    customer_message: str | None
    internal_note: str | None
    diagnosed_at: datetime

    model_config = {"from_attributes": True}
