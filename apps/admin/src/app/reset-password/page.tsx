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
    <main className="min-h-screen bg-[#f7f8fb] px-5 py-8 text-[#191b1f]">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-3xl items-center">
        <form
          aria-label="Restablecer contrasena PollaVAR Admin"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
          onSubmit={resetPassword}
        >
          <p className="text-sm font-medium text-emerald-700">PollaVAR Admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
            Restablecer contrasena
          </h1>
          {!token ? (
            <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700" role="alert">
              El enlace de recuperacion no contiene token.
            </p>
          ) : null}
          <div className="mt-6 grid gap-4">
            <PasswordField label="Nueva contrasena" name="newPassword" />
            <PasswordField label="Confirmar nueva contrasena" name="confirmPassword" />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={saving || !token}
              type="submit"
            >
              {saving ? "Guardando" : "Guardar contrasena"}
            </button>
            <Link className="text-sm font-medium text-emerald-700 hover:text-emerald-800" href="/login">
              Volver al login
            </Link>
          </div>
          {message ? (
            <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700" role="status">
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
    <label className="grid gap-2 text-sm font-medium text-zinc-700">
      <span>{label}</span>
      <input
        autoComplete="new-password"
        className="h-11 rounded-md border border-zinc-300 px-3 text-base text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
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
