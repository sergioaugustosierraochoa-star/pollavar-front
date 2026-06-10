"use client";

import { PollavarAPIError, createPollavarClient, type AuthUser } from "@pollavar/api-client";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  clearStoredSession,
  persistSession,
  readStoredSession,
  redirectToLogin,
  type AuthSession,
} from "../session";

export default function ParticipantsProfilePage() {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());
  const [user, setUser] = useState<AuthUser | null>(() => readStoredSession()?.user ?? null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!session) {
      redirectToLogin();
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
        setStatus("Tu sesión ya no es válida. Inicia sesión nuevamente.");
        redirectToLogin();
      });
  }, [session]);

  useEffect(() => {
    if (!userMenuOpen) {
      return;
    }

    function closeMenuOnOutsideInteraction(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && userMenuRef.current?.contains(target)) {
        return;
      }
      setUserMenuOpen(false);
    }

    function closeMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeMenuOnOutsideInteraction);
    document.addEventListener("keydown", closeMenuOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenuOnOutsideInteraction);
      document.removeEventListener("keydown", closeMenuOnEscape);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    if (!status && !message && !profileMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setStatus("");
      setMessage("");
      setProfileMessage("");
    }, 4200);
    return () => window.clearTimeout(timeout);
  }, [message, profileMessage, status]);

  function signOutProfile() {
    setUserMenuOpen(false);
    clearStoredSession();
    setSession(null);
    setUser(null);
    redirectToLogin();
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      setMessage("Inicia sesión para cambiar tu contraseña.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get("currentPassword"));
    const newPassword = String(formData.get("newPassword"));
    const confirmPassword = String(formData.get("confirmPassword"));
    if (newPassword !== confirmPassword) {
      setMessage("La nueva contraseña y la confirmación no coinciden.");
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
      setStatus("Contraseña actualizada. Inicia sesión nuevamente.");
      setMessage("");
      redirectToLogin();
    } catch (error) {
      setMessage(passwordErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      setProfileMessage("Inicia sesión para editar tu perfil.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    setSavingProfile(true);
    setProfileMessage("");
    try {
      const profile = await createPollavarClient().updateProfile(session.token, {
        name: String(formData.get("name")),
        username: String(formData.get("username")),
        email: String(formData.get("email")),
      });
      const nextSession = { ...session, user: profile };
      setSession(nextSession);
      setUser(profile);
      persistSession(nextSession);
      setProfileMessage("Perfil actualizado.");
    } catch (error) {
      setProfileMessage(profileErrorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <header className="border-b border-[#10B981]/35 bg-[#0f172a] text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <Link className="flex min-w-0 items-center gap-3" href="/">
            <span className="truncate text-lg font-semibold tracking-normal text-[#10B981]">
              PollaVAR
            </span>
            <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-white/80">
              Participantes
            </span>
          </Link>
          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                className="flex min-w-0 items-center gap-3 rounded-md px-2 py-1 text-sm font-medium text-white outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                onClick={() => setUserMenuOpen((open) => !open)}
                type="button"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#10B981] text-xs font-semibold text-white">
                  {userInitials(user.name, user.username)}
                </span>
                <span className="hidden max-w-40 truncate sm:block">{user.name}</span>
              </button>
              {userMenuOpen ? (
                <div className="absolute right-0 z-20 mt-3 grid min-w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white py-2 text-sm text-zinc-700 shadow-xl ring-1 ring-zinc-950/5">
                  <button
                    className="flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-100"
                    onClick={signOutProfile}
                    type="button"
                  >
                    <span aria-hidden="true" className="grid size-5 place-items-center">
                      <svg fill="none" height="18" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" width="18">
                        <path d="M12 2v10" />
                        <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
                      </svg>
                    </span>
                    Salir
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>
      <section className="mx-auto grid max-w-3xl gap-5 px-5 py-6">
        <header className="pb-1">
          <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Mi perfil</h1>
        </header>

        {!session && !status ? (
          <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-950/10">
            Inicia sesión para ver tu perfil.
          </p>
        ) : null}

        {status ? (
          <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-950/10">
            {status}
          </p>
        ) : null}

        {user && session ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2">
              <ProfileMetric label="Nombre" value={user.name} />
              <ProfileMetric label="Usuario" value={`@${user.username}`} />
              <ProfileMetric label="Correo" value={user.email} />
              <ProfileMetric label="Sesión expira" value={formatDateTime(session.expiresAt)} />
            </section>

            <section className="overflow-hidden rounded-xl bg-white text-sm shadow-[0_10px_40px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/10">
              <div className="border-b border-slate-200 px-4 py-4">
                <h2 className="text-base font-semibold text-[#0f172a]">Datos básicos</h2>
              </div>
              <form className="grid gap-4 px-4 py-4" onSubmit={updateProfile}>
                <TextField defaultValue={user.name} label="Nombre" name="name" placeholder="Nombre completo" />
                <TextField defaultValue={user.username} label="Usuario" name="username" placeholder="usuario" />
                <TextField defaultValue={user.email} label="Correo" name="email" placeholder="correo@ejemplo.com" type="email" />
                <div className="-mx-4 -mb-4 mt-1 flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-3">
                  <button
                    className="min-h-10 rounded-md bg-[#10B981] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#059669] disabled:opacity-50"
                    disabled={savingProfile}
                    type="submit"
                  >
                    {savingProfile ? "Guardando" : "Guardar perfil"}
                  </button>
                </div>
              </form>
            </section>

            <section className="overflow-hidden rounded-xl bg-white text-sm shadow-[0_10px_40px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/10">
              <div className="border-b border-slate-200 px-4 py-4">
                <h2 className="text-base font-semibold text-[#0f172a]">Cambiar contraseña</h2>
              </div>
              <form className="grid gap-4 px-4 py-4" onSubmit={changePassword}>
                <PasswordField label="Contraseña actual" name="currentPassword" placeholder="Contraseña actual" />
                <PasswordField label="Nueva contraseña" name="newPassword" placeholder="Mínimo 8 caracteres" />
                <PasswordField label="Confirmar nueva contraseña" name="confirmPassword" placeholder="Repite la nueva contraseña" />
                <div className="-mx-4 -mb-4 mt-1 flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-3">
                  <button
                    className="min-h-10 rounded-md bg-[#10B981] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#059669] disabled:opacity-50"
                    disabled={saving}
                    type="submit"
                  >
                    {saving ? "Guardando" : "Guardar contraseña"}
                  </button>
                </div>
              </form>
            </section>
          </>
        ) : null}
      </section>
      <ProfileToastStack
        items={[
          status ? { id: "status", message: status, type: "error" as const } : null,
          profileMessage
            ? { id: "profile", message: profileMessage, type: profileToastType(profileMessage) }
            : null,
          message ? { id: "password", message, type: profileToastType(message) } : null,
        ].filter((item): item is ProfileToastItem => item !== null)}
      />
    </main>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow-[0_10px_40px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/10">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-[#0f172a]">{value || "-"}</p>
    </div>
  );
}

function PasswordField({ label, name, placeholder }: { label: string; name: string; placeholder: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <input
        autoComplete={name === "currentPassword" ? "current-password" : "new-password"}
        className="h-11 rounded-md border border-[#e2e8f0] px-3 text-base text-[#0f172a] outline-none transition focus:border-[#22D3EE] focus:ring-2 focus:ring-[#22D3EE]/10"
        minLength={8}
        maxLength={128}
        name={name}
        placeholder={placeholder}
        required
        type="password"
      />
    </label>
  );
}

function TextField({
  defaultValue,
  label,
  name,
  placeholder,
  type = "text",
}: {
  defaultValue: string;
  label: string;
  name: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <input
        autoComplete={name}
        className="h-11 rounded-md border border-[#e2e8f0] px-3 text-base text-[#0f172a] outline-none transition focus:border-[#22D3EE] focus:ring-2 focus:ring-[#22D3EE]/10"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        required
        type={type}
      />
    </label>
  );
}

function userInitials(name: string, username: string) {
  const source = name.trim() || username.trim();
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || "PV";
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
    return "La contraseña actual no es correcta o la sesión expiró.";
  }
  if (error instanceof PollavarAPIError && error.status === 400) {
    return "La nueva contraseña debe tener entre 8 y 128 caracteres y ser diferente a la actual.";
  }
  return "No pudimos cambiar la contraseña.";
}

function profileErrorMessage(error: unknown) {
  if (error instanceof PollavarAPIError && error.status === 409) {
    return "Ese usuario o correo ya está en uso.";
  }
  if (error instanceof PollavarAPIError && error.status === 400) {
    return "Revisa nombre, usuario y correo.";
  }
  if (error instanceof PollavarAPIError && error.status === 401) {
    return "Tu sesión expiró. Inicia sesión nuevamente.";
  }
  return "No pudimos actualizar el perfil.";
}

type ProfileToastItem = {
  id: string;
  message: string;
  type: "success" | "error";
};

function ProfileToastStack({ items }: { items: ProfileToastItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 grid max-w-sm gap-2" role="status">
      {items.map((item) => (
        <div
          className={`rounded-md border px-4 py-3 text-sm shadow-xl ring-1 ring-slate-950/5 ${
            item.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-orange-200 bg-orange-50 text-orange-900"
          }`}
          key={item.id}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}

function profileToastType(message: string): "success" | "error" {
  const normalized = message.toLowerCase();
  return normalized.includes("actualizad") ? "success" : "error";
}
