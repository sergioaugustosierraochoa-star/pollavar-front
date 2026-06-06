"use client";

import { PollavarAPIError, createPollavarClient, type AuthUser } from "@pollavar/api-client";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

const sessionStorageKey = "pollavar.admin.session";

type AuthSession = {
  token: string;
  expiresAt: string;
  user: AuthUser;
};

export default function AdminProfilePage() {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());
  const [user, setUser] = useState<AuthUser | null>(() => readStoredSession()?.user ?? null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!session) {
      return;
    }

    const client = createPollavarClient();
    void client
      .me(session.token)
      .then((profile) => {
        setUser(profile);
        persistSession({ ...session, user: profile });
      })
      .catch(() => {
        clearStoredSession();
        setSession(null);
        setUser(null);
        setStatus("Tu sesion ya no es valida. Inicia sesion nuevamente.");
      });
  }, [session]);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      setMessage("Inicia sesion para cambiar tu contrasena.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get("currentPassword"));
    const newPassword = String(formData.get("newPassword"));
    const confirmPassword = String(formData.get("confirmPassword"));
    if (newPassword !== confirmPassword) {
      setMessage("La nueva contrasena y la confirmacion no coinciden.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      await createPollavarClient().changePassword(session.token, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      event.currentTarget.reset();
      clearStoredSession();
      setSession(null);
      setUser(null);
      setStatus("Contrasena actualizada. Inicia sesion nuevamente.");
      setMessage("");
    } catch (error) {
      setMessage(passwordErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-5 py-6 text-[#191b1f]">
      <section className="mx-auto grid max-w-4xl gap-5">
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">PollaVAR Admin</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">
              Mi perfil
            </h1>
          </div>
          <Link className="text-sm font-semibold text-emerald-700 hover:text-emerald-800" href="/">
            Volver al panel
          </Link>
        </header>

        {!session && !status ? (
          <p className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
            Inicia sesion para ver tu perfil.
          </p>
        ) : null}

        {status ? (
          <p className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
            {status}
          </p>
        ) : null}

        {user && session ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2">
              <ProfileMetric label="Nombre" value={user.name} />
              <ProfileMetric label="Usuario" value={`@${user.username}`} />
              <ProfileMetric label="Correo" value={user.email} />
              <ProfileMetric label="Rol" value={roleLabel(user.role)} />
              <ProfileMetric label="Sesion expira" value={formatDateTime(session.expiresAt)} />
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-950">Cambiar contrasena</h2>
              <form className="mt-4 grid gap-4" onSubmit={changePassword}>
                <PasswordField label="Contrasena actual" name="currentPassword" />
                <PasswordField label="Nueva contrasena" name="newPassword" />
                <PasswordField label="Confirmar nueva contrasena" name="confirmPassword" />
                <button
                  className="w-fit rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:bg-zinc-400"
                  disabled={saving}
                  type="submit"
                >
                  {saving ? "Guardando" : "Guardar contrasena"}
                </button>
              </form>
              {message ? (
                <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700" role="status">
                  {message}
                </p>
              ) : null}
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-zinc-950">{value || "-"}</p>
    </div>
  );
}

function PasswordField({ label, name }: { label: string; name: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-zinc-700">
      <span>{label}</span>
      <input
        autoComplete={name === "currentPassword" ? "current-password" : "new-password"}
        className="h-11 rounded-md border border-zinc-300 px-3 text-base text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        minLength={8}
        maxLength={128}
        name={name}
        required
        type="password"
      />
    </label>
  );
}

function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }
  const rawSession = window.localStorage.getItem(sessionStorageKey);
  if (!rawSession) {
    return null;
  }
  try {
    const session = JSON.parse(rawSession) as AuthSession;
    if (!session.token || !session.expiresAt || !session.user?.id || Date.parse(session.expiresAt) <= Date.now()) {
      clearStoredSession();
      return null;
    }
    return session;
  } catch {
    clearStoredSession();
    return null;
  }
}

function persistSession(session: AuthSession) {
  window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
}

function clearStoredSession() {
  window.localStorage.removeItem(sessionStorageKey);
}

function roleLabel(role: string) {
  switch (role) {
    case "superadmin":
      return "Superadmin";
    case "pool_admin":
      return "Administrador de polla";
    default:
      return "Participante";
  }
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function passwordErrorMessage(error: unknown) {
  if (error instanceof PollavarAPIError && error.status === 401) {
    return "La contrasena actual no es correcta o la sesion expiro.";
  }
  if (error instanceof PollavarAPIError && error.status === 400) {
    return "La nueva contrasena debe tener entre 8 y 128 caracteres y ser diferente a la actual.";
  }
  return "No pudimos cambiar la contrasena.";
}
