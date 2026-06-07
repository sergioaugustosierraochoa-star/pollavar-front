import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminLoginPage from "./login/page";
import AdminRegisterPage from "./register/page";

const routerMock = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

const authPayload = {
  data: {
    user: {
      id: "user-id",
      name: "Admin",
      username: "admin",
      email: "admin@example.com",
      role: "participant",
      created_at: "2026-05-27T01:00:00Z",
    },
    token: "token",
    expires_at: "2026-05-28T01:00:00Z",
  },
};

describe("Admin auth form", () => {
  afterEach(() => {
    window.localStorage.clear();
    routerMock.replace.mockClear();
    vi.unstubAllGlobals();
  });

  it("logs in and stores the admin session", async () => {
    const fetcher = vi.fn(async () => jsonResponse(authPayload));
    vi.stubGlobal("fetch", fetcher);
    render(<AdminLoginPage />);

    fireEvent.change(screen.getByLabelText("Usuario o correo"), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Contrasena"), {
      target: { value: "supersecret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesion" }));

    expect(screen.getByRole("button", { name: "Enviando" })).toBeDisabled();
    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/");
    });

    expect(JSON.parse(window.localStorage.getItem("pollavar.admin.session") ?? "{}")).toEqual({
      token: "token",
      expiresAt: "2026-05-28T01:00:00Z",
      user: authPayload.data.user,
    });
    expect(fetcher).toHaveBeenCalledWith("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: "admin@example.com",
        password: "supersecret",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    expect(screen.queryByRole("link", { name: "Crear cuenta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a clear warning when login credentials are invalid", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ code: "invalid_credentials" }, { status: 401 }),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<AdminLoginPage />);

    fireEvent.change(screen.getByLabelText("Usuario o correo"), {
      target: { value: "superadmin" },
    });
    fireEvent.change(screen.getByLabelText("Contrasena"), {
      target: { value: "wrongpass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesion" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Credenciales invalidas",
      );
    });

    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("shows inline validation messages for required login fields", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(<AdminLoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesion" }));

    expect(screen.getByLabelText("Usuario o correo")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Contrasena")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByText("Completa este campo.")).toHaveLength(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("shows an error when register fails", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ code: "user_already_exists" }, { status: 409 }),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<AdminRegisterPage />);

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Admin" },
    });
    fireEvent.change(screen.getByLabelText("Usuario"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Correo"), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Contrasena"), {
      target: { value: "supersecret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "No pudimos crear la cuenta en este momento. Revisa los datos e intenta nuevamente.",
      );
    });

    expect(window.localStorage.getItem("pollavar.admin.session")).toBeNull();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/auth/register",
      {
        method: "POST",
        body: JSON.stringify({
          name: "Admin",
          username: "admin",
          email: "admin@example.com",
          password: "supersecret",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    expect(screen.getByRole("link", { name: "Iniciar sesion" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });
}
