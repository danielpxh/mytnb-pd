"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  LoaderCircle,
  LockKeyhole,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  discoverAccounts,
  getAuthSession,
  login,
  logout,
  syncAccount,
  updateSessionDuration,
} from "@/lib/api";

interface AuthContextValue {
  email: string;
  signOut: () => Promise<void>;
  sessionDurationHours: number;
  setSessionDurationHours: (hours: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error("useAuth must be used inside the authenticated app");
  }
  return auth;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);
  const [sessionDurationHours, setSessionDurationHours] = useState(12);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState("");

  const applySession = useCallback(
    (session: Awaited<ReturnType<typeof getAuthSession>>) => {
      setEmail(session.authenticated ? session.email ?? "" : null);
      if (session.authenticated && session.duration_hours) {
        setSessionDurationHours(session.duration_hours);
      }
      setExpiresAt(session.authenticated ? session.expires_at ?? null : null);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    getAuthSession()
      .then((session) => {
        if (active) applySession(session);
      })
      .catch((error: Error) => {
        if (active) setSessionError(error.message);
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [applySession]);

  useEffect(() => {
    if (!email || !expiresAt) return;
    const remaining = new Date(expiresAt).getTime() - Date.now();
    const expireSession = () => {
      queryClient.clear();
      setEmail(null);
      setExpiresAt(null);
      setSessionError("Your session expired. Please sign in again.");
      toast.info("You have been signed out because your session expired.");
    };
    if (remaining <= 0) {
      expireSession();
      return;
    }
    const timer = window.setTimeout(expireSession, remaining);
    return () => window.clearTimeout(timer);
  }, [email, expiresAt, queryClient]);

  const signOut = async () => {
    await logout();
    queryClient.clear();
    setEmail(null);
    setExpiresAt(null);
    setSessionError("");
  };

  const updateSessionDurationSetting = async (hours: number) => {
    const updated = await updateSessionDuration(hours);
    setSessionDurationHours(updated.duration_hours);
    setExpiresAt(updated.expires_at);
  };

  if (checking) {
    return <AppLoading message="Preparing your dashboard…" />;
  }

  if (!email) {
    return (
      <SignIn
        initialError={sessionError}
        onSignedIn={(signedInEmail, sessionDuration, sessionExpiresAt) => {
          queryClient.clear();
          setEmail(signedInEmail);
          setSessionDurationHours(sessionDuration);
          setExpiresAt(sessionExpiresAt);
          setSessionError("");
        }}
        onRetrySession={() => {
          setChecking(true);
          setSessionError("");
          getAuthSession()
            .then(applySession)
            .catch((error: Error) => setSessionError(error.message))
            .finally(() => setChecking(false));
        }}
      />
    );
  }

  return (
    <AuthContext.Provider
      value={{
        email,
        signOut,
        sessionDurationHours,
        setSessionDurationHours: updateSessionDurationSetting,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function SignIn({
  initialError,
  onSignedIn,
  onRetrySession,
}: {
  initialError: string;
  onSignedIn: (
    email: string,
    sessionDuration: number,
    expiresAt: string,
  ) => void;
  onRetrySession: () => void;
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);

  useEffect(() => {
    const savedEmail = window.localStorage.getItem("mytnb-pd-saved-email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const session = await login(email, password);
      if (rememberEmail) {
        window.localStorage.setItem("mytnb-pd-saved-email", email.trim());
      } else {
        window.localStorage.removeItem("mytnb-pd-saved-email");
      }
      setDiscovering(true);
      let discovered: string[] = [];
      try {
        ({ discovered } = await discoverAccounts());
      } catch (reason) {
        toast.error(
          `Signed in, but account discovery failed: ${
            reason instanceof Error ? reason.message : "Try Discover again from the dashboard."
          }`,
        );
      }
      onSignedIn(session.email, session.duration_hours, session.expires_at);
      setDiscovering(false);
      setSubmitting(false);

      if (discovered.length > 0) {
        void Promise.allSettled(
          discovered.map((accountNumber) => syncAccount(accountNumber)),
        ).then(async (syncResults) => {
          const failedSyncs = syncResults.filter(
            (result) => result.status === "rejected",
          ).length;
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["accounts"] }),
            queryClient.invalidateQueries({ queryKey: ["usage"] }),
          ]);
          if (failedSyncs > 0) {
            toast.error(
              `Signed in, but ${failedSyncs} account(s) could not sync. You can retry from Settings.`,
            );
          } else {
            toast.success("Your account data is up to date.");
          }
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-slate-800">
              MyTNB-PD
            </span>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-slate-900">
                Sign in to your account
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Use the email and password you use on the myTNB website.
              </p>
            </div>

            {(initialError || error) && (
              <div
                role="alert"
                className="mb-5 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error || initialError}</span>
              </div>
            )}

            {initialError && !error && (
              <button
                type="button"
                onClick={onRetrySession}
                className="mb-4 text-sm font-medium text-brand-700 hover:text-brand-800"
              >
                Try connecting again
              </button>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  name="username"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  placeholder="you@example.com"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700">
                  Password
                </span>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  placeholder="Your myTNB password"
                />
              </label>

              <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={(event) => setRememberEmail(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  Remember email on this device
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <LockKeyhole className="h-4 w-4" />
                )}
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
              <p>
                Your credentials are sent to this MyTNB-PD backend, used to
                sign in to myTNB, and kept in server memory until your selected
                sign-out time (up to 24 hours). The app never saves your
                password. Your browser may offer to save it in its own password
                manager; only the email can be remembered on this device.
                Restarting the backend signs you out.
              </p>
              <p>
                MyTNB-PD is unofficial. myTNB sign-in requires a Malaysian IP
                address.
              </p>
            </div>
          </section>
        </div>
      </main>
      {discovering && <AppLoading message="Finding your myTNB accounts…" />}
    </>
  );
}

function AppLoading({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-slate-50 px-6"
    >
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/25">
          <Zap className="h-7 w-7 text-white" />
        </div>
        <p className="text-lg font-semibold text-slate-900">MyTNB-PD</p>
        <div className="mx-auto my-4 h-1.5 w-48 overflow-hidden rounded-full bg-brand-100">
          <div className="h-full w-2/5 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-brand-600" />
        </div>
        <p className="text-sm text-slate-500">{message}</p>
        <span className="sr-only">Please wait</span>
      </div>
    </div>
  );
}
