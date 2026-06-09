"use client";

import { PollavarAPIError, createPollavarClient } from "@pollavar/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { persistSession } from "./session";

type AuthMode = "login" | "register";
type SubmitStatus = "idle" | "submitting" | "success" | "error";
type FieldErrors = Partial<Record<"name" | "username" | "email" | "identifier" | "password", string>>;

type AuthFormProps = {
  appName: string;
  mode: AuthMode;
  alternateHref?: string;
  alternateLabel?: string;
};

export function AuthForm({
  appName,
  mode,
  alternateHref,
  alternateLabel,
}: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const title = isRegister ? "Crear cuenta" : "Iniciar sesión";
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const validationErrors = validateAuthFields(formData, isRegister);
    if (Object.keys(validationErrors).length > 0) {
      setStatus("idle");
      setFieldErrors(validationErrors);
      return;
    }

    setStatus("submitting");
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
      router.replace("/");
    } catch (error) {
      setStatus("error");
      setMessage(authErrorMessage(error, isRegister));
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-5 py-8 text-[#0f172a]">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-[#10B981] text-sm font-semibold text-white shadow-sm ring-2 ring-[#22D3EE]/30">
            PV
          </div>
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-3xl font-bold tracking-normal text-[#10B981]">{appName}</h1>
            <span className="rounded-md bg-[#0f172a]/5 px-2 py-1 text-xs font-medium text-slate-600">
              Panel administrativo
            </span>
          </div>
        </div>

        <form
          aria-label={`${title} ${appName}`}
          className="rounded-2xl border border-[#f1f5f9] bg-white p-8 shadow-[0_10px_40px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.04)]"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="mb-7">
            <h2 className="text-xl font-semibold tracking-normal text-[#0f172a]">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Ingresa con tu usuario o correo registrado.
            </p>
          </div>

          {status === "error" && message ? <AuthErrorBanner message={message} /> : null}

          <div className="space-y-5">
            {isRegister ? (
              <>
                <Field
                  label="Nombre"
                  name="name"
                  autoComplete="name"
                  error={fieldErrors.name}
                  onChange={() => clearFieldError("name")}
                  placeholder="Nombre completo"
                />
                <Field
                  label="Usuario"
                  name="username"
                  autoComplete="username"
                  error={fieldErrors.username}
                  onChange={() => clearFieldError("username")}
                  placeholder="usuario"
                />
                <Field
                  label="Correo"
                  name="email"
                  type="email"
                  autoComplete="email"
                  error={fieldErrors.email}
                  onChange={() => clearFieldError("email")}
                  placeholder="correo@ejemplo.com"
                />
              </>
            ) : (
              <Field
                label="Usuario o correo"
                name="identifier"
                autoComplete="username"
                error={fieldErrors.identifier}
                onChange={() => clearFieldError("identifier")}
                placeholder="usuario o correo@ejemplo.com"
              />
            )}

            <Field
              label="Contraseña"
              name="password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              error={fieldErrors.password}
              onChange={() => clearFieldError("password")}
              placeholder="Contraseña"
              action={
                !isRegister ? (
                  <Link className="text-xs text-[#10B981] hover:underline" href="/forgot-password">
                    Olvidé mi contraseña
                  </Link>
                ) : null
              }
            />
          </div>

          <div className="mt-6 grid gap-3">
            <button
              className="w-full rounded-xl bg-[#10B981] px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#059669] hover:shadow-[0_0_24px_rgba(16,185,129,0.35),0_4px_14px_rgba(16,185,129,0.15)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              disabled={status === "submitting"}
              type="submit"
            >
              {status === "submitting" ? "Enviando" : title}
            </button>
            {alternateHref && alternateLabel ? (
              <Link
                className="text-sm font-medium text-[#10B981] hover:text-[#059669]"
                href={alternateHref}
              >
                {alternateLabel}
              </Link>
            ) : null}
          </div>
        </form>
      </section>
    </main>
  );

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
  }
}

function authErrorMessage(error: unknown, isRegister: boolean) {
  if (error instanceof PollavarAPIError && error.code === "invalid_credentials") {
    return "Credenciales inválidas";
  }

  return isRegister
    ? "No pudimos crear la cuenta en este momento. Revisa los datos e intenta nuevamente."
    : "No pudimos iniciar sesión en este momento. Intenta nuevamente en unos segundos.";
}

function AuthErrorBanner({ message }: { message: string }) {
  return (
    <p
      className="mb-5 rounded-xl border border-[#F59E0B]/20 bg-[#F59E0B]/10 px-4 py-2.5 text-sm font-medium text-[#b45309]"
      role="alert"
    >
      {message}
    </p>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  error,
  onChange,
  action,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete: string;
  error?: string;
  onChange?: () => void;
  action?: ReactNode;
  placeholder?: string;
}) {
  const errorID = `${name}-error`;

  return (
    <label className="grid gap-1.5 text-xs font-medium text-[#0f172a]">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {action}
      </span>
      <input
        aria-label={label}
        aria-describedby={error ? errorID : undefined}
        aria-invalid={Boolean(error)}
        className="h-10 rounded-xl border border-[#e2e8f0] bg-white px-3 text-sm text-[#64748b] outline-none transition placeholder:text-[#cbd5e1] focus:border-[#22D3EE] focus:ring-4 focus:ring-[#22D3EE]/10 aria-invalid:border-[#F59E0B]/60 aria-invalid:ring-4 aria-invalid:ring-[#F59E0B]/10"
        name={name}
        placeholder={placeholder}
        type={type}
        autoComplete={autoComplete}
        onChange={onChange}
        suppressHydrationWarning
      />
      {error ? (
        <span className="text-xs font-medium text-[#d97706]" id={errorID}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

function validateAuthFields(formData: FormData, isRegister: boolean): FieldErrors {
  const errors: FieldErrors = {};
  const requiredFields: Array<keyof FieldErrors> = isRegister
    ? ["name", "username", "email", "password"]
    : ["identifier", "password"];

  for (const field of requiredFields) {
    if (!String(formData.get(field) ?? "").trim()) {
      errors[field] = "Completa este campo.";
    }
  }

  return errors;
}
