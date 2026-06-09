"use client";

import { PollavarAPIError, createPollavarClient } from "@pollavar/api-client";
import Link from "next/link";
import { type FormEvent, useState } from "react";

export default function AdminForgotPasswordPage() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSaving(true);
    setMessage("");
    try {
      await createPollavarClient().requestPasswordReset({
        identifier: String(formData.get("identifier")),
      });
      setMessage("Si la cuenta existe, generamos un enlace temporal de recuperación.");
      event.currentTarget.reset();
    } catch (error) {
      setMessage(requestResetMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-5 py-8 text-[#0f172a]">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-3xl items-center">
        <form
          aria-label="Recuperar contraseña PollaVAR Admin"
          className="rounded-2xl border border-[#f1f5f9] bg-white p-8 shadow-[0_10px_40px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.04)]"
          onSubmit={requestReset}
        >
          <p className="text-sm font-medium text-[#10B981]">PollaVAR Admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#0f172a]">
            Recuperar contraseña
          </h1>
          <label className="mt-6 grid gap-2 text-sm font-medium text-slate-700">
            <span>Usuario o correo</span>
            <input
              autoComplete="username"
              className="h-11 rounded-md border border-[#e2e8f0] px-3 text-base text-[#0f172a] outline-none transition focus:border-[#22D3EE] focus:ring-2 focus:ring-[#22D3EE]/10"
              name="identifier"
              required
            />
          </label>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              className="rounded-md bg-[#10B981] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving}
              type="submit"
            >
              {saving ? "Enviando" : "Generar enlace"}
            </button>
            <Link className="text-sm font-medium text-[#10B981] hover:text-[#059669]" href="/login">
              Volver al login
            </Link>
          </div>
          {message ? (
            <p className="mt-4 rounded-md border border-zinc-200 bg-[#f1f5f9] px-3 py-2 text-sm text-slate-700" role="status">
              {message}
            </p>
          ) : null}
        </form>
      </section>
    </main>
  );
}

function requestResetMessage(error: unknown) {
  if (error instanceof PollavarAPIError && error.status === 400) {
    return "Ingresa un usuario o correo válido.";
  }
  return "No pudimos generar el enlace de recuperación.";
}
