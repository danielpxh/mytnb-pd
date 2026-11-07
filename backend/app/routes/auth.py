from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, HTTPException, Request, Response
from httpx import RequestError
from mytnb import MyTNBClient
from mytnb.exceptions import AuthenticationError, GeoBlockedError
from pydantic import BaseModel, Field

from ..auth import (
    SESSION_COOKIE,
    DEFAULT_SESSION_HOURS,
    MyTnbCredentials,
    create_session,
    delete_session,
    get_session,
    update_session_duration,
)

router = APIRouter(prefix="/auth", tags=["authentication"])


class LoginRequest(BaseModel):
    email: str = Field(min_length=1, max_length=320)
    password: str = Field(min_length=1, max_length=1024, repr=False)
    duration_hours: Literal[1, 6, 12, 24] = DEFAULT_SESSION_HOURS


class SessionDurationRequest(BaseModel):
    duration_hours: Literal[1, 6, 12, 24]


@router.post("/login")
async def login(body: LoginRequest, response: Response):
    credentials = MyTnbCredentials(
        email=body.email.strip().casefold(),
        password=body.password,
    )
    if not credentials.email:
        raise HTTPException(status_code=422, detail="Enter your myTNB email.")

    try:
        client = await MyTNBClient.login(credentials.email, credentials.password)
        await client.close()
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=401,
            detail="Sign-in failed. Check your myTNB email and password.",
        ) from exc
    except GeoBlockedError as exc:
        raise HTTPException(
            status_code=403,
            detail="myTNB sign-in is only available from a Malaysian IP address.",
        ) from exc
    except RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not reach myTNB. Check your connection and try again.",
        ) from exc

    token = create_session(credentials, body.duration_hours)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=body.duration_hours * 60 * 60,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/api",
    )
    stored_session = get_session(token)
    if stored_session is None:
        raise HTTPException(
            status_code=500,
            detail="Could not create the sign-in session.",
        )
    return {
        "email": credentials.email,
        "duration_hours": stored_session.duration_hours,
        "expires_at": stored_session.expires_at.isoformat(),
    }


@router.get("/session")
async def session(request: Request):
    token = request.cookies.get(SESSION_COOKIE)
    stored_session = get_session(token)
    if stored_session is None:
        return {"authenticated": False}
    return {
        "authenticated": True,
        "email": stored_session.credentials.email,
        "duration_hours": stored_session.duration_hours,
        "expires_at": stored_session.expires_at.isoformat(),
    }


@router.patch("/session/duration")
async def set_session_duration(
    body: SessionDurationRequest,
    request: Request,
    response: Response,
):
    token = request.cookies.get(SESSION_COOKIE)
    updated = update_session_duration(token, body.duration_hours)
    if updated is None or token is None:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")

    remaining = max(
        0,
        int((updated.expires_at - datetime.now(timezone.utc)).total_seconds()),
    )
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=remaining,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/api",
    )
    return {
        "duration_hours": updated.duration_hours,
        "expires_at": updated.expires_at.isoformat(),
    }


@router.post("/logout")
async def logout(request: Request, response: Response):
    delete_session(request.cookies.get(SESSION_COOKIE))
    response.delete_cookie(
        key=SESSION_COOKIE,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/api",
    )
    return {"ok": True}
