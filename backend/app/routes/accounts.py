from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from httpx import RequestError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from pydantic import BaseModel
from mytnb import MyTNBClient
from mytnb.exceptions import AuthenticationError, GeoBlockedError, MyTNBError

from ..auth import MyTnbCredentials, require_credentials
from ..database import get_session
from ..models import Account
from ..services.mytnb import (
    AccountOwnershipError,
    discover_accounts,
    sync_account,
)

router = APIRouter(prefix="/accounts", tags=["accounts"])


class AccountOut(BaseModel):
    account_number: str
    owner_name: str
    nickname: str
    tariff_type: str
    is_smart_meter: bool
    account_list_is_smart_meter: bool
    last_synced: str | None
    smr_eligibility: str | None = None
    is_tagged_smr: bool | None = None
    bill_owner_over_rule: bool | None = None
    bill_owner_already_opt_in: bool | None = None
    bill_tenant_already_opt_in: bool | None = None
    eligibility_checked_at: str | None = None


def _account_out(account: Account) -> AccountOut:
    return AccountOut(
        account_number=account.account_number,
        owner_name=account.owner_name,
        nickname=account.nickname or account.account_number,
        tariff_type=account.tariff_type,
        is_smart_meter=(
            account.is_tagged_smr
            if account.is_tagged_smr is not None
            else account.is_smart_meter
        ),
        account_list_is_smart_meter=account.is_smart_meter,
        last_synced=account.last_synced.isoformat() if account.last_synced else None,
        smr_eligibility=account.smr_eligibility,
        is_tagged_smr=account.is_tagged_smr,
        bill_owner_over_rule=account.bill_owner_over_rule,
        bill_owner_already_opt_in=account.bill_owner_already_opt_in,
        bill_tenant_already_opt_in=account.bill_tenant_already_opt_in,
        eligibility_checked_at=(
            account.eligibility_checked_at.isoformat()
            if account.eligibility_checked_at
            else None
        ),
    )


@router.get("", response_model=list[AccountOut])
async def list_accounts(
    session: AsyncSession = Depends(get_session),
    credentials: MyTnbCredentials = Depends(require_credentials),
):
    accounts = (
        await session.exec(
            select(Account).where(Account.owner_email == credentials.email)
        )
    ).all()
    return [_account_out(account) for account in accounts]


@router.post("/discover")
async def discover(
    session: AsyncSession = Depends(get_session),
    credentials: MyTnbCredentials = Depends(require_credentials),
):
    """Trigger account discovery from myTNB profile."""
    try:
        numbers = await discover_accounts(session, credentials)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=401,
            detail="Your myTNB sign-in has expired. Please sign in again.",
        ) from exc
    except GeoBlockedError as exc:
        raise HTTPException(
            status_code=403,
            detail="myTNB sign-in is only available from a Malaysian IP address.",
        ) from exc
    return {"discovered": numbers}


@router.post("/{account_number}/sync")
async def sync(
    account_number: str,
    session: AsyncSession = Depends(get_session),
    credentials: MyTnbCredentials = Depends(require_credentials),
):
    """Manually trigger a sync for one account."""
    try:
        result = await sync_account(account_number, session, credentials)
    except AccountOwnershipError as exc:
        raise HTTPException(404, "Account not found") from exc
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=401,
            detail="Your myTNB sign-in has expired. Please sign in again.",
        ) from exc
    except GeoBlockedError as exc:
        raise HTTPException(
            status_code=403,
            detail="myTNB sign-in is only available from a Malaysian IP address.",
        ) from exc
    return result


@router.patch("/{account_number}/nickname")
async def set_nickname(
    account_number: str,
    body: dict,
    session: AsyncSession = Depends(get_session),
    credentials: MyTnbCredentials = Depends(require_credentials),
):
    acct = (
        await session.exec(
            select(Account).where(
                Account.account_number == account_number,
                Account.owner_email == credentials.email,
            )
        )
    ).first()
    if not acct:
        raise HTTPException(404, "Account not found")
    acct.nickname = body.get("nickname", "")
    session.add(acct)
    await session.commit()
    return {"ok": True}


@router.post("/{account_number}/eligibility", response_model=AccountOut)
async def check_eligibility(
    account_number: str,
    session: AsyncSession = Depends(get_session),
    credentials: MyTnbCredentials = Depends(require_credentials),
):
    account = (
        await session.exec(
            select(Account).where(
                Account.account_number == account_number,
                Account.owner_email == credentials.email,
            )
        )
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    try:
        async with await MyTNBClient.login(
            credentials.email,
            credentials.password,
        ) as client:
            linked_accounts = await client.get_customer_accounts()
            linked_account = next(
                (item for item in linked_accounts if item.account_number == account_number),
                None,
            )
            if linked_account is None:
                raise HTTPException(status_code=404, detail="Account not found")
            account.is_smart_meter = linked_account.is_smart_meter

            user_info = client.credentials.user_info
            if user_info is None or not user_info.user_id:
                raise HTTPException(
                    status_code=502,
                    detail="myTNB did not provide the user ID required to check eligibility.",
                )

            smr_statuses = await client.get_smr_accounts([account_number])
            bill_statuses = await client.get_bill_eligibility(
                [account_number],
                user_info.user_id,
            )
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=401,
            detail="Your myTNB sign-in has expired. Please sign in again.",
        ) from exc
    except GeoBlockedError as exc:
        raise HTTPException(
            status_code=403,
            detail="myTNB sign-in is only available from a Malaysian IP address.",
        ) from exc
    except RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not reach myTNB to check eligibility.",
        ) from exc
    except MyTNBError as exc:
        raise HTTPException(
            status_code=502,
            detail="myTNB could not return eligibility information for this account.",
        ) from exc

    smr = next(
        (status for status in smr_statuses if status.contract_account == account_number),
        None,
    )
    bill = next(
        (status for status in bill_statuses if status.ca_no == account_number),
        None,
    )
    account.smr_eligibility = smr.smr_eligibility if smr else None
    account.is_tagged_smr = smr.is_smart_meter if smr else None
    account.bill_owner_over_rule = bill.is_owner_over_rule if bill else None
    account.bill_owner_already_opt_in = (
        bill.is_owner_already_opt_in if bill else None
    )
    account.bill_tenant_already_opt_in = (
        bill.is_tenant_already_opt_in if bill else None
    )
    account.eligibility_checked_at = datetime.now(timezone.utc).replace(tzinfo=None)
    session.add(account)
    await session.commit()
    await session.refresh(account)

    return _account_out(account)
