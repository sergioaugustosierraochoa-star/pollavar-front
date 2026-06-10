"use client";

import { PollavarAPIError, createPollavarClient } from "@pollavar/api-client";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

export default function ParticipantsForgotPasswordPage() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeout = window.setTimeout(() => setMessage(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [message]);

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
    <main className="min-h-screen bg-[#f8faf9] px-5 py-8 text-[#191b1f]">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-3xl items-center">
        <form
          aria-label="Recuperar contraseña PollaVAR Participantes"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
          onSubmit={requestReset}
        >
          <p className="text-sm font-medium text-emerald-700">PollaVAR Participantes</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
            Recuperar contraseña
          </h1>
          <label className="mt-6 grid gap-2 text-sm font-medium text-zinc-700">
            <span>Usuario o correo</span>
            <input
              autoComplete="username"
              className="h-11 rounded-md border border-zinc-300 px-3 text-base text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              name="identifier"
              required
            />
          </label>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={saving}
              type="submit"
            >
              {saving ? "Enviando" : "Generar enlace"}
            </button>
            <Link className="text-sm font-medium text-emerald-700 hover:text-emerald-800" href="/login">
              Volver al login
            </Link>
          </div>
        </form>
      </section>
      <AuthToast message={message} type={toastType(message)} />
    </main>
  );
}

function requestResetMessage(error: unknown) {
  if (error instanceof PollavarAPIError && error.status === 400) {
    return "Ingresa un usuario o correo válido.";
  }
  return "No pudimos generar el enlace de recuperación.";
}

function AuthToast({ message, type }: { message: string; type: "success" | "error" }) {
  if (!message) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm" role="status">
      <div
        className={`rounded-md border px-4 py-3 text-sm shadow-xl ring-1 ring-slate-950/5 ${
          type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-orange-200 bg-orange-50 text-orange-900"
        }`}
      >
        {message}
      </div>
    </div>
  );
}

function toastType(message: string): "success" | "error" {
  return message.toLowerCase().includes("generamos") ? "success" : "error";
}
