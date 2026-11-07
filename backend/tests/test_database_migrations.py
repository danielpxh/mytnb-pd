import unittest

from sqlalchemy import create_engine, inspect, text

from app.database import _migrate_existing_schema


class DatabaseMigrationTests(unittest.TestCase):
    def test_existing_database_receives_owner_and_bill_metadata_columns(self):
        engine = create_engine("sqlite:///:memory:")
        with engine.begin() as connection:
            connection.execute(
                text("CREATE TABLE account (id INTEGER PRIMARY KEY, account_number VARCHAR)")
            )
            connection.execute(
                text(
                    "CREATE TABLE dailyusage "
                    "(id INTEGER PRIMARY KEY, account_number VARCHAR)"
                )
            )
            connection.execute(
                text(
                    "CREATE TABLE monthlybill "
                    "(id INTEGER PRIMARY KEY, account_number VARCHAR, "
                    "year INTEGER, month INTEGER, usage_kwh FLOAT, "
                    "amount_myr FLOAT, due_date DATE, is_paid BOOLEAN)"
                )
            )

            _migrate_existing_schema(connection)

            columns = {
                table: {
                    column["name"]
                    for column in inspect(connection).get_columns(table)
                }
                for table in ("account", "dailyusage", "monthlybill")
            }

        self.assertIn("owner_email", columns["account"])
        self.assertIn("owner_name", columns["account"])
        self.assertTrue(
            {
                "smr_eligibility",
                "is_tagged_smr",
                "bill_owner_over_rule",
                "bill_owner_already_opt_in",
                "bill_tenant_already_opt_in",
                "eligibility_checked_at",
            }.issubset(columns["account"])
        )
        self.assertIn("owner_email", columns["dailyusage"])
        self.assertTrue(
            {
                "owner_email",
                "billing_no",
                "usage_available",
                "payment_status",
            }.issubset(columns["monthlybill"])
        )
        engine.dispose()
