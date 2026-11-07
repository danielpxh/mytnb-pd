from datetime import date, datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Account(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    account_number: str = Field(index=True)
    owner_email: str = Field(index=True)
    owner_name: str = ""
    nickname: str = ""
    tariff_type: str = ""
    is_smart_meter: bool = False
    last_synced: Optional[datetime] = None
    smr_eligibility: Optional[str] = None
    is_tagged_smr: Optional[bool] = None
    bill_owner_over_rule: Optional[bool] = None
    bill_owner_already_opt_in: Optional[bool] = None
    bill_tenant_already_opt_in: Optional[bool] = None
    eligibility_checked_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=_utc_now)


class DailyUsage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    account_number: str = Field(index=True)
    owner_email: str = Field(index=True)
    usage_date: date = Field(index=True)
    usage_kwh: float
    cost_myr: float
    created_at: datetime = Field(default_factory=_utc_now)


class MonthlyBill(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    account_number: str = Field(index=True)
    owner_email: str = Field(index=True)
    year: int
    month: int  # 1–12
    usage_kwh: float
    usage_available: bool = False
    amount_myr: float
    billing_no: str = ""
    due_date: Optional[date] = None
    is_paid: bool = False
    payment_status: str = "unknown"
    created_at: datetime = Field(default_factory=_utc_now)


class SyncLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    account_number: str
    status: str  # "success" | "error"
    message: str = ""
    synced_at: datetime = Field(default_factory=_utc_now)