"""Background polling — runs sync_account for every account on a schedule."""
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from .auth import MyTnbCredentials, active_session_credentials
from .config import settings
from .database import AsyncSessionLocal
from .services.mytnb import sync_account, discover_accounts

scheduler = AsyncIOScheduler()
logger = logging.getLogger(__name__)


def _scheduled_credentials() -> MyTnbCredentials | None:
    email = settings.mytnb_username
    password = settings.mytnb_password
    if not email or not password:
        return None
    if email.strip().lower() == "your_email@example.com" or password == "your_password":
        return None
    return MyTnbCredentials(email=email, password=password)


async def _poll_all():
    credentials_to_sync = list(active_session_credentials())
    configured = _scheduled_credentials()
    if configured is not None and all(
        configured.email.casefold() != credentials.email.casefold()
        for credentials in credentials_to_sync
    ):
        credentials_to_sync.append(configured)

    for credentials in credentials_to_sync:
        async with AsyncSessionLocal() as session:
            try:
                account_numbers = await discover_accounts(session, credentials)
            except Exception:
                logger.exception("Scheduled account discovery failed")
                continue

            for number in account_numbers:
                try:
                    await sync_account(number, session, credentials)
                    logger.info("Scheduled sync completed for %s", number)
                except Exception:
                    logger.exception("Scheduled sync failed for an account")


def start_scheduler():
    scheduler.add_job(
        _poll_all,
        trigger=IntervalTrigger(hours=settings.poll_interval_hours),
        id="poll_mytnb",
        replace_existing=True,
        misfire_grace_time=300,
    )
    scheduler.start()
    logger.info("Automatic sync enabled; polling every %s hours", settings.poll_interval_hours)


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
