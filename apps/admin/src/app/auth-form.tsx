"use client";

import { createPollavarClient } from "@pollavar/api-client";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { persistSession } from "./session";

type AuthMode = "login" | "register";
type SubmitStatus = "idle" | "submitting" | "success" | "error";

type AuthFormProps = {
  appName: string;
  mode: AuthMode;
  storageKey: string;
  alternateHref: string;
  alternateLabel: string;
};

export function AuthForm({
  appName,
  mode,
  alternateHref,
  alternateLabel,
}: AuthFormProps) {
  const isRegister = mode === "register";
  const title = isRegister ? "Crear cuenta" : "Iniciar sesion";
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const client = createPollavarClient();

    try {
      const result = isRegister
        ? await client.register({
            name: String(formData.get("name")),
            username: String(formData.get("username")),
            email: String(formData.get("email")),
            password: String(formData.get("password")),
          })
        : await client.login({
            identifier: String(formData.get("identifier")),
            password: String(formData.get("password")),
          });

      persistSession(result);
      setStatus("success");
      setMessage(`Sesion lista para ${result.user.username}.`);
    } catch {
      setStatus("error");
      setMessage("No pudimos completar la solicitud.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-5 py-8 text-[#191b1f]">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="text-sm font-medium text-emerald-700">{appName}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
            {title}
          </h1>
          <p className="mt-3 max-w-md text-base leading-7 text-zinc-600">
            Accede al panel para preparar pollas, validar recaudo y cargar resultados.
          </p>
        </div>

        <form
          aria-label={`${title} ${appName}`}
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-4">
            {isRegister ? (
              <>
                <Field label="Nombre" name="name" autoComplete="name" />
                <Field label="Usuario" name="username" autoComplete="username" />
                <Field label="Correo" name="email" type="email" autoComplete="email" />
              </>
            ) : (
              <Field label="Usuario o correo" name="identifier" autoComplete="username" />
            )}

            <Field
              label="Contrasena"
              name="password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={status === "submitting"}
              type="submit"
            >
              {status === "submitting" ? "Enviando" : title}
            </button>
            <Link
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
              href={alternateHref}
            >
              {alternateLabel}
            </Link>
          </div>

          {message ? (
            <p
              className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
              role={status === "error" ? "alert" : "status"}
            >
              {message}
            </p>
          ) : null}
        </form>
      </section>
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-zinc-700">
      <span>{label}</span>
      <input
        className="h-11 rounded-md border border-zinc-300 px-3 text-base text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
      />
    </label>
  );
}
