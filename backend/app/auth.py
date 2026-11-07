"""Short-lived in-memory sessions for browser sign-ins."""
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import secrets

from fastapi import HTTPException, Request

SESSION_COOKIE = "mytnb_pd_session"
DEFAULT_SESSION_HOURS = 12
ALLOWED_SESSION_HOURS = (1, 6, 12, 24)


@dataclass(frozen=True)
class MyTnbCredentials:
    email: str
    password: str = field(repr=False)


@dataclass(frozen=True)
class _Session:
    credentials: MyTnbCredentials
    expires_at: datetime
    duration_hours: int


_sessions: dict[str, _Session] = {}


def create_session(
    credentials: MyTnbCredentials,
    duration_hours: int = DEFAULT_SESSION_HOURS,
) -> str:
    if duration_hours not in ALLOWED_SESSION_HOURS:
        raise ValueError("Unsupported session duration.")

    now = datetime.now(timezone.utc)
    expired = [token for token, session in _sessions.items() if session.expires_at <= now]
    for token in expired:
        del _sessions[token]

    token = secrets.token_urlsafe(32)
    _sessions[token] = _Session(
        credentials,
        now + timedelta(hours=duration_hours),
        duration_hours,
    )
    return token


def update_session_duration(token: str | None, duration_hours: int) -> _Session | None:
    if duration_hours not in ALLOWED_SESSION_HOURS:
        raise ValueError("Unsupported session duration.")
    if not token:
        return None

    session = _sessions.get(token)
    if session is None:
        return None
    now = datetime.now(timezone.utc)
    if session.expires_at <= now:
        del _sessions[token]
        return None

    updated = _Session(
        session.credentials,
        now + timedelta(hours=duration_hours),
        duration_hours,
    )
    _sessions[token] = updated
    return updated


def delete_session(token: str | None) -> None:
    if token:
        _sessions.pop(token, None)


def get_credentials(token: str | None) -> MyTnbCredentials | None:
    session = get_session(token)
    return session.credentials if session else None


def get_session(token: str | None) -> _Session | None:
    if not token:
        return None

    session = _sessions.get(token)
    if session is None:
        return None
    if session.expires_at <= datetime.now(timezone.utc):
        del _sessions[token]
        return None
    return session


def active_session_credentials() -> tuple[MyTnbCredentials, ...]:
    now = datetime.now(timezone.utc)
    credentials = []
    expired = []
    seen_emails = set()
    for token, session in _sessions.items():
        if session.expires_at <= now:
            expired.append(token)
            continue
        email = session.credentials.email.casefold()
        if email not in seen_emails:
            credentials.append(session.credentials)
            seen_emails.add(email)
    for token in expired:
        del _sessions[token]
    return tuple(credentials)


def require_credentials(request: Request) -> MyTnbCredentials:
    credentials = get_credentials(request.cookies.get(SESSION_COOKIE))
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Sign in with your myTNB account to continue.",
        )
    return credentials
