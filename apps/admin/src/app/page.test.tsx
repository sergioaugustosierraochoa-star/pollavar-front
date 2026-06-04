import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminHome from "./page";

const session = {
  token: "token",
  expiresAt: "2099-05-28T01:00:00Z",
  user: {
    id: "admin-id",
    name: "Admin",
    username: "admin",
    email: "admin@example.com",
    role: "participant",
    created_at: "2026-05-27T01:00:00Z",
  },
};

const pool = {
  id: "pool-id",
  tournament_id: "fifa-world-cup-2026",
  name: "Mundial oficina",
  description: "Polla privada",
  invite_code: "ABC123",
  entry_fee_cents: 5000000,
  currency: "COP",
  collection_responsible_user_id: "collector-id",
  prediction_close_hours_before: 6,
  created_by: "admin-id",
  created_at: "2026-05-27T01:00:00Z",
  updated_at: "2026-05-27T01:00:00Z",
  current_user_role: "pool_admin",
  theme: {
    id: "theme-id",
    pool_id: "pool-id",
    display_name: "Oficina FC",
    logo_url: "https://cdn.example.com/logo.png",
    banner_url: "/assets/banner.png",
    mascot_url: "",
    primary_color: "#0F766E",
    secondary_color: "#111827",
    accent_color: "#F59E0B",
    created_at: "2026-05-27T01:00:00Z",
    updated_at: "2026-05-27T01:00:00Z",
  },
  participants: [
    {
      id: "participant-admin",
      pool_id: "pool-id",
      user_id: "admin-id",
      user_name: "Admin",
      username: "admin",
      role: "pool_admin",
      payment_status: "confirmed",
      prize_eligible: true,
      joined_at: "2026-05-27T01:00:00Z",
    },
    {
      id: "participant-id",
      pool_id: "pool-id",
      user_id: "participant-id",
      user_name: "Participante",
      username: "participante",
      role: "participant",
      payment_status: "pending",
      prize_eligible: true,
      joined_at: "2026-05-27T01:00:00Z",
    },
  ],
};

const confirmedPayment = {
  id: "payment-admin",
  pool_id: "pool-id",
  user_id: "admin-id",
  amount_cents: 5000000,
  currency: "COP",
  payment_method: "cash",
  status: "confirmed",
  reference: "EF-001",
  confirmed_by: "admin-id",
  confirmed_at: "2026-05-27T01:00:00Z",
  created_at: "2026-05-27T01:00:00Z",
  updated_at: "2026-05-27T01:00:00Z",
};

describe("Admin home", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders the signed-out state when there is no admin session", async () => {
    render(<AdminHome />);

    expect(await screen.findByText("Entra para administrar recaudo")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Entrar" })[0]).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getAllByRole("link", { name: "Crear cuenta" })[0]).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("clears a corrupted stored session", async () => {
    window.localStorage.setItem("pollavar.admin.session", "{");

    render(<AdminHome />);

    expect(await screen.findByText("Entra para administrar recaudo")).toBeInTheDocument();
    expect(window.localStorage.getItem("pollavar.admin.session")).toBeNull();
  });

  it("loads pools and updates a participant payment", async () => {
    storeSession();
    const fetcher = vi.fn(adminFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    expect(await screen.findByRole("heading", { name: "Oficina FC" })).toBeInTheDocument();
    expect(screen.getByText("Recaudo manual")).toBeInTheDocument();
    expect(screen.getByLabelText("Polla")).toHaveValue("pool-id");
    expect(screen.getByText("Recaudo habilitado")).toBeInTheDocument();
    expect(screen.getByText("COP 50.000 por entrada")).toBeInTheDocument();
    expect(metricValue("Participantes")).toHaveTextContent("2");
    expect(metricValue("Confirmados")).toHaveTextContent("1");
    expect(metricValue("Pendientes")).toHaveTextContent("1");
    expect(metricValue("Recaudo confirmado")).toHaveTextContent("COP 50.000");

    const participantRow = rowWithText("@participante");
    expect(within(participantRow).getByText("@participante")).toBeInTheDocument();
    expect(within(participantRow).getByText("Pago pendiente")).toBeInTheDocument();
    expect(within(participantRow).getByLabelText("Valor de pago de Participante")).toHaveValue(
      "50000",
    );

    fireEvent.change(within(participantRow).getByLabelText("Metodo de pago de Participante"), {
      target: { value: "bank_transfer" },
    });
    fireEvent.change(within(participantRow).getByLabelText("Referencia de pago de Participante"), {
      target: { value: "TRX-999" },
    });
    fireEvent.click(within(participantRow).getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Pago actualizado.");
    });
    expect(metricValue("Confirmados")).toHaveTextContent("2");
    expect(metricValue("Pendientes")).toHaveTextContent("0");
    expect(metricValue("Recaudo confirmado")).toHaveTextContent("COP 100.000");

    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/pools/pool-id/payments/participant-id",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          amount_cents: 5000000,
          currency: "COP",
          payment_method: "bank_transfer",
          reference: "TRX-999",
          status: "confirmed",
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      }),
    );
  });

  it("renders a read-only state when the selected pool cannot manage payments", async () => {
    storeSession({ user: { ...session.user, id: "participant-id" } });
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      const value = String(url);
      if (value.endsWith("/api/v1/pools")) {
        return jsonResponse({ data: [{ ...pool, current_user_role: "participant" }] });
      }
      if (value.endsWith("/api/v1/pools/pool-id")) {
        return jsonResponse({
          data: { ...pool, current_user_role: "participant" },
        });
      }
      return jsonResponse({ code: "unauthorized" }, { status: 401 });
    });
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    expect(await screen.findByText("Solo lectura")).toBeInTheDocument();
    expect(
      screen.getByText("Esta polla no esta bajo tu administracion de recaudo."),
    ).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: "Confirmar" })) {
      expect(button).toBeDisabled();
    }
    expect(fetcher).not.toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/pools/pool-id/payments",
      expect.anything(),
    );
  });

  it("shows an error when the dashboard request fails", async () => {
    storeSession();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ code: "internal_error" }, { status: 500 })),
    );

    render(<AdminHome />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar el panel de recaudo.",
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});

function storeSession(overrides: Partial<typeof session> = {}) {
  window.localStorage.setItem(
    "pollavar.admin.session",
    JSON.stringify({
      ...session,
      ...overrides,
      user: {
        ...session.user,
        ...overrides.user,
      },
    }),
  );
}

function metricValue(label: string) {
  const metric = screen.getByText(label).closest("div");
  if (!metric) {
    throw new Error(`Metric ${label} not found`);
  }
  return within(metric).getAllByText(/.+/)[1];
}

function rowWithText(text: string) {
  const row = screen
    .getAllByRole("row")
    .find((item) => within(item).queryByText(text));
  if (!row) {
    throw new Error(`Row with ${text} not found`);
  }
  return row;
}

async function adminFetch(url: RequestInfo | URL, init?: RequestInit) {
  const value = String(url);
  if (value.endsWith("/api/v1/pools")) {
    return jsonResponse({ data: [pool] });
  }
  if (value.endsWith("/api/v1/pools/pool-id/payments") && init?.method === "GET") {
    return jsonResponse({
      data: {
        pool_id: "pool-id",
        currency: "COP",
        confirmed_total_cents: 5000000,
        payments: [confirmedPayment],
      },
    });
  }
  if (value.endsWith("/api/v1/pools/pool-id/payments/participant-id") && init?.method === "PUT") {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    return jsonResponse({
      data: {
        id: "payment-participant",
        pool_id: "pool-id",
        user_id: "participant-id",
        amount_cents: body.amount_cents,
        currency: body.currency,
        payment_method: body.payment_method,
        status: body.status,
        reference: body.reference,
        confirmed_by: "admin-id",
        confirmed_at: "2026-05-27T02:00:00Z",
        created_at: "2026-05-27T02:00:00Z",
        updated_at: "2026-05-27T02:00:00Z",
      },
    });
  }
  if (value.endsWith("/api/v1/pools/pool-id")) {
    return jsonResponse({ data: pool });
  }
  return jsonResponse({ code: "not_found" }, { status: 404 });
}

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });
}
