"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed.");
        return;
      }

      window.location.href = "/";
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setRegisterError("");
    setRegisterSuccess("");
    setIsRegistering(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: registerName,
          email: registerEmail,
          password: registerPassword,
          confirmPassword: registerConfirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setRegisterError(data.error || "Registration failed.");
        return;
      }

      setRegisterSuccess("Account created. You can now sign in.");
      setEmail(registerEmail.trim().toLowerCase());
      setPassword("");
      setRegisterName("");
      setRegisterPassword("");
      setRegisterConfirmPassword("");
    } catch {
      setRegisterError("Registration failed. Please try again.");
    } finally {
      setIsRegistering(false);
    }
  }

  function closeRegisterModal() {
    setIsRegisterOpen(false);
    setRegisterError("");
    setRegisterSuccess("");
    setRegisterName("");
    setRegisterPassword("");
    setRegisterConfirmPassword("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-slate-900">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
            ⌘
          </div>

          <div>
            <h1 className="text-lg font-semibold leading-tight">
              HCA Central Command
            </h1>
            <p className="text-sm text-slate-500">Portfolio operations hub</p>
          </div>
        </div>

        <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
        <p className="mt-1 text-sm text-slate-500">
          Use your HCA Central Command account.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="Password"
            />
          </div>

          {error ? (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            disabled={isLoading}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setIsRegisterOpen(true)}
          className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Register approved account
        </button>

        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
          <p className="font-semibold text-slate-700">Approved registration</p>
          <p className="mt-2">
            Approved users can create their accounts using their approved email
            addresses.
          </p>
          <p className="mt-2">
            Registration is restricted to manually approved emails only.
          </p>
        </div>
      </div>

      {isRegisterOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Register approved account
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Enter your name, approved email address, and password.
                </p>
              </div>

              <button
                type="button"
                onClick={closeRegisterModal}
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleRegister} className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Full name
                </label>
                <input
                  value={registerName}
                  onChange={(event) => setRegisterName(event.target.value)}
                  type="text"
                  autoComplete="name"
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  value={registerEmail}
                  onChange={(event) => setRegisterEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  required
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="approved.email@example.com"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Password
                </label>

                <input
                  value={registerPassword}
                  onChange={(event) => setRegisterPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Confirm password
                </label>

                <input
                  value={registerConfirmPassword}
                  onChange={(event) =>
                    setRegisterConfirmPassword(event.target.value)
                  }
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Re-enter password"
                />
              </div>

              {registerError ? (
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {registerError}
                </div>
              ) : null}

              {registerSuccess ? (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  {registerSuccess}
                </div>
              ) : null}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeRegisterModal}
                  className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  disabled={isRegistering}
                  className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRegistering ? "Creating..." : "Create account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
