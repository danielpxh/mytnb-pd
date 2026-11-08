"""Wraps python-mytnb and persists data to SQLite."""
from datetime import date, datetime, timezone

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..auth import MyTnbCredentials
from ..models import Account, DailyUsage, MonthlyBill, SyncLog


class AccountOwnershipError(Exception):
    """Raised when a signed-in profile does not own the requested account."""


def _owner(credentials: MyTnbCredentials) -> str:
    return credentials.email.strip().casefold()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _paid_status(is_paid: bool | None) -> str:
    if is_paid is None:
        return "unknown"
    return "paid" if is_paid else "unpaid"


def _account_paid_status(is_paid: str | None) -> str:
    if is_paid is None:
        return "unknown"
    normalized = is_paid.strip().casefold()
    if normalized == "true":
        return "paid"
    if normalized == "false":
        return "unpaid"
    return "unknown"


async def _claim_legacy_records(
    session: AsyncSession,
    account_number: str,
    owner_email: str,
) -> None:
    for model in (DailyUsage, MonthlyBill):
        rows = (
            await session.exec(
                select(model).where(
                    model.account_number == account_number,
                    model.owner_email == "",
                )
            )
        ).all()
        for row in rows:
            row.owner_email = owner_email
            session.add(row)


async def sync_account(
    account_number: str,
    session: AsyncSession,
    credentials: MyTnbCredentials,
) -> dict:
    """Fetch latest data from myTNB API and upsert into the DB."""
    from mytnb import MyTNBClient

    owner_email = _owner(credentials)
    log = SyncLog(account_number=account_number, status="running")
    session.add(log)
    await session.commit()

    try:
        async with await MyTNBClient.login(
            credentials.email,
            credentials.password,
        ) as client:
            accounts = await client.get_customer_accounts()
            acct_info = next(
                (a for a in accounts if a.account_number == account_number),
                None,
            )
            if not acct_info:
                raise ValueError(f"Account {account_number} not found in myTNB")

            existing = (
                await session.exec(
                    select(Account).where(Account.account_number == account_number)
                )
            ).first()
            if existing and existing.owner_email not in ("", owner_email):
                raise AccountOwnershipError
            smart_meter_status = (
                existing.is_tagged_smr
                if existing and existing.is_tagged_smr is not None
                else acct_info.is_smart_meter
            )
            if existing:
                existing.owner_email = owner_email
                existing.owner_name = acct_info.owner_name
                existing.is_smart_meter = acct_info.is_smart_meter
                existing.tariff_type = acct_info.rate_category
                existing.last_synced = _utc_now()
                session.add(existing)
            else:
                existing = Account(
                    account_number=account_number,
                    owner_email=owner_email,
                    owner_name=acct_info.owner_name,
                    is_smart_meter=acct_info.is_smart_meter,
                    tariff_type=acct_info.rate_category,
                    last_synced=_utc_now(),
                )
                session.add(existing)

            await _claim_legacy_records(session, account_number, owner_email)
            account_due = await client.get_account_due_amount(acct_info)
            payment_history = await client.get_payment_history(acct_info)
            paid_references = {
                entry.reference_number.strip()
                for entry in payment_history
                if "payment" in entry.history_type.casefold()
                and not entry.is_payment_pending
                and entry.reference_number.strip()
            }
            due_status = (
                _paid_status(account_due.amount_due <= 0)
                if account_due.amount_due is not None
                else _account_paid_status(acct_info.is_paid)
            )
            due_date = account_due.due_date

            if smart_meter_status:
                usage = await client.get_account_usage_smart(acct_info)
                for week in usage.by_day:
                    for entry in week.days:
                        usage_date = date(
                            int(entry.year),
                            int(entry.month),
                            int(entry.day),
                        )
                        daily = (
                            await session.exec(
                                select(DailyUsage).where(
                                    DailyUsage.account_number == account_number,
                                    DailyUsage.owner_email == owner_email,
                                    DailyUsage.usage_date == usage_date,
                                )
                            )
                        ).first()
                        if daily is None:
                            daily = DailyUsage(
                                account_number=account_number,
                                owner_email=owner_email,
                                usage_date=usage_date,
                                usage_kwh=entry.consumption_kwh,
                                cost_myr=entry.amount_rm,
                            )
                        else:
                            daily.usage_kwh = entry.consumption_kwh
                            daily.cost_myr = entry.amount_rm
                        session.add(daily)

                months = usage.by_month.months if usage.by_month else []
                latest_month = max(
                    ((int(bill.year), int(bill.month)) for bill in months),
                    default=None,
                )
                for bill in months:
                    year, month = int(bill.year), int(bill.month)
                    is_latest_bill = (year, month) == latest_month
                    is_unbilled = bool(bill.is_unbilled)
                    payment_status = (
                        "unbilled"
                        if is_unbilled
                        else (
                            "paid"
                            if bill.billing_no.strip() in paid_references
                            else due_status if is_latest_bill else "unknown"
                        )
                    )
                    monthly = (
                        await session.exec(
                            select(MonthlyBill).where(
                                MonthlyBill.account_number == account_number,
                                MonthlyBill.owner_email == owner_email,
                                MonthlyBill.year == year,
                                MonthlyBill.month == month,
                            )
                        )
                    ).first()
                    if monthly is None:
                        monthly = MonthlyBill(
                            account_number=account_number,
                            owner_email=owner_email,
                            year=year,
                            month=month,
                            usage_kwh=bill.usage_kwh,
                            usage_available=True,
                            amount_myr=bill.amount_rm,
                        )
                    monthly.usage_kwh = bill.usage_kwh
                    monthly.usage_available = True
                    monthly.amount_myr = bill.amount_rm
                    monthly.billing_no = bill.billing_no
                    monthly.payment_status = payment_status
                    monthly.is_paid = payment_status == "paid"
                    monthly.due_date = due_date if is_latest_bill else monthly.due_date
                    session.add(monthly)
            else:
                bills = await client.get_bill_history(acct_info)
                dated_bills = [bill for bill in bills if bill.date is not None]
                latest_bill_date = max(
                    (bill.date for bill in dated_bills),
                    default=None,
                )
                for bill in dated_bills:
                    if bill.amount is None:
                        continue
                    is_latest_bill = bill.date == latest_bill_date
                    bill_reference = bill.billing_no.strip()
                    payment_status = (
                        "paid"
                        if bill_reference and bill_reference in paid_references
                        else due_status if is_latest_bill else "unknown"
                    )
                    monthly = (
                        await session.exec(
                            select(MonthlyBill).where(
                                MonthlyBill.account_number == account_number,
                                MonthlyBill.owner_email == owner_email,
                                MonthlyBill.year == bill.date.year,
                                MonthlyBill.month == bill.date.month,
                            )
                        )
                    ).first()
                    if monthly is None:
                        monthly = MonthlyBill(
                            account_number=account_number,
                            owner_email=owner_email,
                            year=bill.date.year,
                            month=bill.date.month,
                            usage_kwh=0,
                            usage_available=False,
                            amount_myr=bill.amount,
                        )
                    monthly.amount_myr = bill.amount
                    monthly.billing_no = bill.billing_no
                    monthly.payment_status = payment_status
                    monthly.is_paid = payment_status == "paid"
                    monthly.due_date = due_date if is_latest_bill else monthly.due_date
                    session.add(monthly)

        log.status = "success"
        log.message = f"Synced daily + bills for {account_number}"
        await session.commit()
        return {"status": "success", "account": account_number}

    except Exception as exc:
        log.status = "error"
        log.message = str(exc)
        await session.commit()
        raise


async def discover_accounts(
    session: AsyncSession,
    credentials: MyTnbCredentials,
) -> list[str]:
    """Log in and return all account numbers on this myTNB profile."""
    from mytnb import MyTNBClient

    owner_email = _owner(credentials)
    async with await MyTNBClient.login(
        credentials.email,
        credentials.password,
    ) as client:
        accounts = await client.get_customer_accounts()
        numbers = [account.account_number for account in accounts]

        for account in accounts:
            exists = (
                await session.exec(
                    select(Account).where(
                        Account.account_number == account.account_number
                    )
                )
            ).first()
            if exists and exists.owner_email not in ("", owner_email):
                continue
            if exists:
                exists.owner_email = owner_email
                exists.owner_name = account.owner_name
                exists.is_smart_meter = account.is_smart_meter
                exists.tariff_type = account.rate_category
                session.add(exists)
            else:
                session.add(
                    Account(
                        account_number=account.account_number,
                        owner_email=owner_email,
                        owner_name=account.owner_name,
                        is_smart_meter=account.is_smart_meter,
                        tariff_type=account.rate_category,
                    )
                )
            await _claim_legacy_records(
                session,
                account.account_number,
                owner_email,
            )

    await session.commit()
    return numbers
