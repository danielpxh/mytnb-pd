import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.auth import MyTnbCredentials
from app.models import Account, DailyUsage, MonthlyBill
from app.services.mytnb import AccountOwnershipError, sync_account


class FakeClient:
    def __init__(
        self,
        account,
        *,
        bill_history=None,
        payment_history=None,
        usage=None,
        amount_due=0,
        due_date=None,
    ):
        self.account = account
        if not hasattr(self.account, "owner_name"):
            self.account.owner_name = "Avery Person"
        self.bill_history = bill_history or []
        self.payment_history = payment_history or []
        self.usage = usage
        self.amount_due = amount_due
        self.due_date = due_date

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_value, traceback):
        return False

    async def get_customer_accounts(self):
        return [self.account]

    async def get_account_due_amount(self, account):
        return SimpleNamespace(
            amount_due=self.amount_due,
            due_date=self.due_date,
        )

    async def get_payment_history(self, account):
        return self.payment_history

    async def get_bill_history(self, account):
        return self.bill_history

    async def get_account_usage_smart(self, account):
        return self.usage


class SyncServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as connection:
            await connection.run_sync(SQLModel.metadata.create_all)
        self.session = AsyncSession(self.engine, expire_on_commit=False)

    async def asyncTearDown(self):
        await self.session.close()
        await self.engine.dispose()

    async def sync_with_client(self, client, credentials):
        with patch(
            "mytnb.MyTNBClient.login",
            new=AsyncMock(return_value=client),
        ):
            return await sync_account(
                client.account.account_number,
                self.session,
                credentials,
            )

    async def test_standard_meter_bill_uses_source_fields_without_fake_usage(self):
        account = SimpleNamespace(
            account_number="220000000001",
            is_smart_meter=False,
            rate_category="Domestic",
            is_paid="true",
        )
        due_date = date(2026, 12, 15)
        client = FakeClient(
            account,
            bill_history=[
                SimpleNamespace(
                    date=date(2026, 11, 1),
                    amount=123.45,
                    billing_no="BILL-001",
                )
            ],
            due_date=due_date,
        )
        credentials = MyTnbCredentials("owner@example.com", "not-persisted")

        await self.sync_with_client(client, credentials)

        bill = (await self.session.exec(select(MonthlyBill))).one()
        stored_account = (await self.session.exec(select(Account))).one()
        self.assertEqual(bill.owner_email, "owner@example.com")
        self.assertEqual(stored_account.owner_name, "Avery Person")
        self.assertEqual(bill.amount_myr, 123.45)
        self.assertEqual(bill.billing_no, "BILL-001")
        self.assertEqual(bill.due_date, due_date)
        self.assertFalse(bill.usage_available)
        self.assertEqual(bill.payment_status, "paid")

    async def test_unknown_payment_data_is_not_reported_as_unpaid(self):
        account = SimpleNamespace(
            account_number="220000000002",
            is_smart_meter=False,
            rate_category="Domestic",
            is_paid="",
        )
        client = FakeClient(
            account,
            bill_history=[
                SimpleNamespace(
                    date=date(2026, 11, 1),
                    amount=50.0,
                    billing_no="",
                )
            ],
            amount_due=None,
        )

        await self.sync_with_client(
            client,
            MyTnbCredentials("owner@example.com", "not-persisted"),
        )

        bill = (await self.session.exec(select(MonthlyBill))).one()
        self.assertEqual(bill.payment_status, "unknown")
        self.assertFalse(bill.is_paid)

    async def test_smart_meter_usage_and_cost_are_refreshed(self):
        account = SimpleNamespace(
            account_number="220000000003",
            is_smart_meter=True,
            rate_category="Domestic",
            is_paid="false",
        )
        daily = SimpleNamespace(
            year="2026",
            month="11",
            day="4",
            consumption_kwh=4.2,
            amount_rm=2.1,
        )
        monthly = SimpleNamespace(
            year="2026",
            month="11",
            usage_kwh=100.0,
            amount_rm=55.0,
            billing_no="BILL-003",
            is_unbilled=False,
        )
        client = FakeClient(
            account,
            usage=SimpleNamespace(
                by_day=[SimpleNamespace(days=[daily])],
                by_month=SimpleNamespace(months=[monthly]),
            ),
            amount_due=25.0,
            due_date=date(2026, 11, 20),
        )
        credentials = MyTnbCredentials("owner@example.com", "not-persisted")

        await self.sync_with_client(client, credentials)
        daily.consumption_kwh = 7.5
        daily.amount_rm = 3.75
        await self.sync_with_client(client, credentials)

        daily_row = (await self.session.exec(select(DailyUsage))).one()
        bill = (await self.session.exec(select(MonthlyBill))).one()
        self.assertEqual(daily_row.usage_kwh, 7.5)
        self.assertEqual(daily_row.cost_myr, 3.75)
        self.assertEqual(
            len((await self.session.exec(select(DailyUsage))).all()),
            1,
        )
        self.assertEqual(bill.payment_status, "unpaid")
        self.assertEqual(bill.due_date, date(2026, 11, 20))
        self.assertTrue(bill.usage_available)

    async def test_smr_tag_allows_usage_sync_when_account_list_flag_is_false(self):
        account = SimpleNamespace(
            account_number="220000000005",
            is_smart_meter=False,
            rate_category="Domestic",
            is_paid="false",
        )
        daily = SimpleNamespace(
            year="2026",
            month="11",
            day="5",
            consumption_kwh=6.4,
            amount_rm=3.2,
        )
        client = FakeClient(
            account,
            usage=SimpleNamespace(
                by_day=[SimpleNamespace(days=[daily])],
                by_month=SimpleNamespace(months=[]),
            ),
        )
        self.session.add(
            Account(
                account_number=account.account_number,
                owner_email="owner@example.com",
                is_smart_meter=False,
                is_tagged_smr=True,
            )
        )
        await self.session.commit()

        await self.sync_with_client(
            client,
            MyTnbCredentials("owner@example.com", "not-persisted"),
        )

        daily_row = (await self.session.exec(select(DailyUsage))).one()
        stored_account = (await self.session.exec(select(Account))).one()
        self.assertEqual(daily_row.usage_kwh, 6.4)
        self.assertFalse(stored_account.is_smart_meter)
        self.assertTrue(stored_account.is_tagged_smr)

    async def test_sync_rejects_an_account_owned_by_another_profile(self):
        account = SimpleNamespace(
            account_number="220000000004",
            is_smart_meter=False,
            rate_category="Domestic",
            is_paid="true",
        )
        client = FakeClient(account)
        await self.sync_with_client(
            client,
            MyTnbCredentials("first@example.com", "not-persisted"),
        )

        with self.assertRaises(AccountOwnershipError):
            await self.sync_with_client(
                client,
                MyTnbCredentials("second@example.com", "not-persisted"),
            )

        stored_account = (await self.session.exec(select(Account))).one()
        self.assertEqual(stored_account.owner_email, "first@example.com")
