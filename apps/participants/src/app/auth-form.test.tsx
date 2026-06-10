import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ParticipantsLoginPage from "./login/page";
import ParticipantsRegisterPage from "./register/page";

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
      name: "Participante",
      username: "participante",
      email: "participante@example.com",
      role: "participant",
      created_at: "2026-05-27T01:00:00Z",
    },
    token: "token",
    expires_at: "2026-05-28T01:00:00Z",
  },
};

describe("Participants auth form", () => {
  afterEach(() => {
    window.localStorage.clear();
    routerMock.replace.mockClear();
    vi.unstubAllGlobals();
  });

  it("logs in and stores the participant session", async () => {
    const fetcher = vi.fn(async () => jsonResponse(authPayload));
    vi.stubGlobal("fetch", fetcher);
    render(<ParticipantsLoginPage />);

    fireEvent.change(screen.getByLabelText("Usuario o correo"), {
      target: { value: "participante@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Contraseña"), {
      target: { value: "supersecret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(screen.getByRole("button", { name: "Enviando" })).toBeDisabled();
    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/");
    });

    expect(
      JSON.parse(window.localStorage.getItem("pollavar.participants.session") ?? "{}"),
    ).toEqual({
      token: "token",
      expiresAt: "2026-05-28T01:00:00Z",
      user: authPayload.data.user,
    });
    expect(fetcher).toHaveBeenCalledWith("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: "participante@example.com",
        password: "supersecret",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    expect(screen.getByRole("link", { name: "Crear cuenta" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("shows an error when register fails", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ code: "user_already_exists" }, { status: 409 }),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<ParticipantsRegisterPage />);

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Participante" },
    });
    fireEvent.change(screen.getByLabelText("Usuario"), {
      target: { value: "participante" },
    });
    fireEvent.change(screen.getByLabelText("Correo"), {
      target: { value: "participante@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Contraseña"), {
      target: { value: "supersecret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Credenciales inválidas");
    });

    expect(window.localStorage.getItem("pollavar.participants.session")).toBeNull();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/auth/register",
      {
        method: "POST",
        body: JSON.stringify({
          name: "Participante",
          username: "participante",
          email: "participante@example.com",
          password: "supersecret",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute(
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
