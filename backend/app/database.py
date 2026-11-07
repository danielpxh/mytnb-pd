from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import inspect, text
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker
from .config import settings

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        await conn.run_sync(_migrate_existing_schema)


def _migrate_existing_schema(connection):
    existing_columns = {
        table: {column["name"] for column in inspect(connection).get_columns(table)}
        for table in ("account", "dailyusage", "monthlybill")
        if inspect(connection).has_table(table)
    }

    migrations = {
        "account": {
            "owner_email": "VARCHAR NOT NULL DEFAULT ''",
            "owner_name": "VARCHAR NOT NULL DEFAULT ''",
            "smr_eligibility": "VARCHAR",
            "is_tagged_smr": "BOOLEAN",
            "bill_owner_over_rule": "BOOLEAN",
            "bill_owner_already_opt_in": "BOOLEAN",
            "bill_tenant_already_opt_in": "BOOLEAN",
            "eligibility_checked_at": "DATETIME",
        },
        "dailyusage": {
            "owner_email": "VARCHAR NOT NULL DEFAULT ''",
        },
        "monthlybill": {
            "owner_email": "VARCHAR NOT NULL DEFAULT ''",
            "billing_no": "VARCHAR NOT NULL DEFAULT ''",
            "usage_available": "BOOLEAN NOT NULL DEFAULT 0",
            "payment_status": "VARCHAR NOT NULL DEFAULT 'unknown'",
        },
    }
    for table, columns in migrations.items():
        if table not in existing_columns:
            continue
        for name, definition in columns.items():
            if name not in existing_columns[table]:
                connection.execute(
                    text(f'ALTER TABLE "{table}" ADD COLUMN "{name}" {definition}')
                )


async def get_session():
    async with AsyncSessionLocal() as session:
        yield session
