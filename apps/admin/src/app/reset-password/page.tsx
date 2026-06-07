"use client";

import { PollavarAPIError, createPollavarClient } from "@pollavar/api-client";
import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";

export default function AdminResetPasswordPage() {
  const token = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return new URLSearchParams(window.location.search).get("token") ?? "";
  }, []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const newPassword = String(formData.get("newPassword"));
    const confirmPassword = String(formData.get("confirmPassword"));
    if (newPassword !== confirmPassword) {
      setMessage("La nueva contrasena y la confirmacion no coinciden.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await createPollavarClient().resetPassword({
        token,
        new_password: newPassword,
      });
      setMessage("Contrasena actualizada. Ya puedes iniciar sesion.");
      event.currentTarget.reset();
    } catch (error) {
      setMessage(resetPasswordMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-5 py-8 text-[#0f172a]">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-3xl items-center">
        <form
          aria-label="Restablecer contrasena PollaVAR Admin"
          className="rounded-2xl border border-[#f1f5f9] bg-white p-8 shadow-[0_10px_40px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.04)]"
          onSubmit={resetPassword}
        >
          <p className="text-sm font-medium text-[#10B981]">PollaVAR Admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#0f172a]">
            Restablecer contrasena
          </h1>
          {!token ? (
            <p className="mt-4 rounded-md border border-zinc-200 bg-[#f1f5f9] px-3 py-2 text-sm text-slate-700" role="alert">
              El enlace de recuperacion no contiene token.
            </p>
          ) : null}
          <div className="mt-6 grid gap-4">
            <PasswordField label="Nueva contrasena" name="newPassword" />
            <PasswordField label="Confirmar nueva contrasena" name="confirmPassword" />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              className="rounded-md bg-[#10B981] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving || !token}
              type="submit"
            >
              {saving ? "Guardando" : "Guardar contrasena"}
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

function PasswordField({ label, name }: { label: string; name: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <input
        autoComplete="new-password"
        className="h-11 rounded-md border border-[#e2e8f0] px-3 text-base text-[#0f172a] outline-none transition focus:border-[#22D3EE] focus:ring-2 focus:ring-[#22D3EE]/10"
        maxLength={128}
        minLength={8}
        name={name}
        required
        type="password"
      />
    </label>
  );
}

function resetPasswordMessage(error: unknown) {
  if (error instanceof PollavarAPIError && error.status === 400) {
    return "La nueva contrasena debe tener entre 8 y 128 caracteres.";
  }
  if (error instanceof PollavarAPIError && error.status === 401) {
    return "El enlace expiro o ya fue utilizado.";
  }
  return "No pudimos actualizar la contrasena.";
}
