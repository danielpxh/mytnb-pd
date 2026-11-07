from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import select, and_
from sqlmodel.ext.asyncio.session import AsyncSession
from pydantic import BaseModel

from ..auth import MyTnbCredentials, require_credentials
from ..database import get_session
from ..models import DailyUsage, MonthlyBill

router = APIRouter(prefix="/usage", tags=["usage"])


class DailyUsageOut(BaseModel):
    date: str
    usage_kwh: float
    cost_myr: float


class MonthlyBillOut(BaseModel):
    year: int
    month: int
    usage_kwh: float
    usage_available: bool
    amount_myr: float
    billing_no: str
    due_date: Optional[str]
    is_paid: bool
    payment_status: str


@router.get("/daily/{account_number}", response_model=list[DailyUsageOut])
async def get_daily(
    account_number: str,
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    session: AsyncSession = Depends(get_session),
    credentials: MyTnbCredentials = Depends(require_credentials),
):
    filters = [
        DailyUsage.account_number == account_number,
        DailyUsage.owner_email == credentials.email,
    ]
    if start:
        filters.append(DailyUsage.usage_date >= start)
    if end:
        filters.append(DailyUsage.usage_date <= end)

    rows = (await session.exec(select(DailyUsage).where(and_(*filters)).order_by(DailyUsage.usage_date))).all()
    return [DailyUsageOut(date=r.usage_date.isoformat(), usage_kwh=r.usage_kwh, cost_myr=r.cost_myr) for r in rows]


@router.get("/monthly/{account_number}", response_model=list[MonthlyBillOut])
async def get_monthly(
    account_number: str,
    session: AsyncSession = Depends(get_session),
    credentials: MyTnbCredentials = Depends(require_credentials),
):
    rows = (
        await session.exec(
            select(MonthlyBill)
            .where(
                MonthlyBill.account_number == account_number,
                MonthlyBill.owner_email == credentials.email,
            )
            .order_by(MonthlyBill.year, MonthlyBill.month)
        )
    ).all()
    return [
        MonthlyBillOut(
            year=r.year,
            month=r.month,
            usage_kwh=r.usage_kwh,
            usage_available=r.usage_available,
            amount_myr=r.amount_myr,
            billing_no=r.billing_no,
            due_date=r.due_date.isoformat() if r.due_date else None,
            is_paid=r.is_paid,
            payment_status=r.payment_status,
        )
        for r in rows
    ]


@router.get("/summary/{account_number}")
async def get_summary(
    account_number: str,
    session: AsyncSession = Depends(get_session),
    credentials: MyTnbCredentials = Depends(require_credentials),
):
    """Latest month bill + 30-day daily total for the dashboard hero card."""
    bills = (
        await session.exec(
            select(MonthlyBill)
            .where(
                MonthlyBill.account_number == account_number,
                MonthlyBill.owner_email == credentials.email,
            )
            .order_by(MonthlyBill.year.desc(), MonthlyBill.month.desc())  # type: ignore[attr-defined]
        )
    ).all()

    latest_bill = bills[0] if bills else None

    daily_rows = (
        await session.exec(
            select(DailyUsage)
            .where(
                DailyUsage.account_number == account_number,
                DailyUsage.owner_email == credentials.email,
            )
            .order_by(DailyUsage.usage_date.desc())  # type: ignore[attr-defined]
            .limit(30)
        )
    ).all()

    return {
        "latest_bill": {
            "year": latest_bill.year,
            "month": latest_bill.month,
            "usage_kwh": latest_bill.usage_kwh,
            "usage_available": latest_bill.usage_available,
            "amount_myr": latest_bill.amount_myr,
            "is_paid": latest_bill.is_paid,
            "payment_status": latest_bill.payment_status,
            "due_date": latest_bill.due_date.isoformat() if latest_bill and latest_bill.due_date else None,
        } if latest_bill else None,
        "last_30_days": {
            "total_kwh": sum(r.usage_kwh for r in daily_rows),
            "total_myr": sum(r.cost_myr for r in daily_rows),
            "days": len(daily_rows),
        },
        "daily_available": len(daily_rows) > 0,
    }