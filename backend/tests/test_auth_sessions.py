import unittest
from datetime import datetime, timezone

from fastapi import Request, Response

from app.auth import (
    MyTnbCredentials,
    SESSION_COOKIE,
    create_session,
    delete_session,
    get_session,
    update_session_duration,
)
from app.routes.auth import SessionDurationRequest, set_session_duration


class AuthSessionTests(unittest.TestCase):
    def test_duration_can_be_changed_and_session_can_be_deleted(self):
        token = create_session(
            MyTnbCredentials("owner@example.com", "not-persisted"),
            duration_hours=1,
        )
        try:
            session = get_session(token)
            self.assertIsNotNone(session)
            self.assertEqual(session.duration_hours, 1)

            updated = update_session_duration(token, 24)
            self.assertIsNotNone(updated)
            self.assertEqual(updated.duration_hours, 24)
            self.assertGreater(updated.expires_at, datetime.now(timezone.utc))
        finally:
            delete_session(token)

        self.assertIsNone(get_session(token))

    def test_unsupported_duration_is_rejected(self):
        with self.assertRaises(ValueError):
            create_session(
                MyTnbCredentials("owner@example.com", "not-persisted"),
                duration_hours=2,
            )


class AuthSessionRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_duration_update_resets_secure_cookie_expiration(self):
        token = create_session(
            MyTnbCredentials("owner@example.com", "not-persisted"),
        )
        request = Request(
            {
                "type": "http",
                "method": "PATCH",
                "scheme": "https",
                "path": "/api/auth/session/duration",
                "query_string": b"",
                "headers": [
                    (b"cookie", f"{SESSION_COOKIE}={token}".encode()),
                ],
                "server": ("localhost", 443),
                "client": ("localhost", 1),
                "root_path": "",
                "asgi": {"version": "3.0"},
            }
        )
        response = Response()
        try:
            result = await set_session_duration(
                SessionDurationRequest(duration_hours=6),
                request,
                response,
            )
            cookie = response.headers["set-cookie"].lower()

            self.assertEqual(result["duration_hours"], 6)
            self.assertEqual(get_session(token).duration_hours, 6)
            self.assertIn("max-age=21600", cookie)
            self.assertIn("httponly", cookie)
            self.assertIn("secure", cookie)
        finally:
            delete_session(token)
