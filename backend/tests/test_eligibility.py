import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.auth import MyTnbCredentials
from app.models import Account
from app.routes.accounts import check_eligibility


class FakeEligibilityClient:
    def __init__(self):
        self.credentials = SimpleNamespace(
            user_info=SimpleNamespace(user_id="user-123"),
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_value, traceback):
        return False

    async def get_customer_accounts(self):
        return [SimpleNamespace(account_number="220000000001")]

    async def get_smr_accounts(self, account_numbers):
        return [
            SimpleNamespace(
                contract_account=account_numbers[0],
                smr_eligibility="Eligible",
                is_smart_meter=True,
            )
        ]

    async def get_bill_eligibility(self, account_numbers, user_id):
        self.checked_user_id = user_id
        return [
            SimpleNamespace(
                ca_no=account_numbers[0],
                is_owner_over_rule=False,
                is_owner_already_opt_in=True,
                is_tenant_already_opt_in=False,
            )
        ]


class EligibilityTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as connection:
            await connection.run_sync(SQLModel.metadata.create_all)
        self.session = AsyncSession(self.engine, expire_on_commit=False)
        self.account = Account(
            account_number="220000000001",
            owner_email="owner@example.com",
        )
        self.session.add(self.account)
        await self.session.commit()

    async def asyncTearDown(self):
        await self.session.close()
        await self.engine.dispose()

    async def test_check_persists_smr_and_bill_rendering_indicators(self):
        client = FakeEligibilityClient()
        credentials = MyTnbCredentials("owner@example.com", "not-persisted")
        with patch(
            "app.routes.accounts.MyTNBClient.login",
            new=AsyncMock(return_value=client),
        ) as login:
            result = await check_eligibility(
                self.account.account_number,
                self.session,
                credentials,
            )

        login.assert_awaited_once_with(credentials.email, credentials.password)
        self.assertEqual(client.checked_user_id, "user-123")
        self.assertEqual(result.smr_eligibility, "Eligible")
        self.assertTrue(result.is_tagged_smr)
        self.assertFalse(result.bill_owner_over_rule)
        self.assertTrue(result.bill_owner_already_opt_in)
        self.assertFalse(result.bill_tenant_already_opt_in)
        self.assertIsNotNone(result.eligibility_checked_at)

    async def test_other_profiles_cannot_check_account_eligibility(self):
        client_login = AsyncMock()
        with patch("app.routes.accounts.MyTNBClient.login", new=client_login):
            with self.assertRaises(HTTPException) as context:
                await check_eligibility(
                    self.account.account_number,
                    self.session,
                    MyTnbCredentials("other@example.com", "not-persisted"),
                )

        self.assertEqual(getattr(context.exception, "status_code", None), 404)
        client_login.assert_not_awaited()
