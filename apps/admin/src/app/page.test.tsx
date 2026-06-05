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
  prediction_mode: "score_with_outcome",
  match_result_scoring_mode: "exclusive",
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

const tournamentSummary = {
  id: "fifa-world-cup-2026",
  name: "FIFA World Cup 2026",
  slug: "fifa-world-cup-2026",
  sport: "football",
  format_code: "groups_plus_knockout_48_12x4_best8_thirds",
  starts_at: "2026-06-11T00:00:00Z",
  ends_at: "2026-07-19T23:59:59Z",
  group_count: 12,
  team_count: 48,
};

const tournament = {
  ...tournamentSummary,
  groups: [
    {
      id: "group-a",
      name: "A",
      teams: [
        { id: "team-mexico", name: "Mexico", short_name: "MEX", country_code: "MEX" },
        { id: "team-canada", name: "Canada", short_name: "CAN", country_code: "CAN" },
      ],
    },
  ],
  matches: [
    {
      id: "match-id",
      tournament_id: "fifa-world-cup-2026",
      stage_id: "group-stage",
      group_id: "group-a",
      group_name: "A",
      match_number: 1,
      home_team: { id: "team-mexico", name: "Mexico", short_name: "MEX", country_code: "MEX" },
      away_team: { id: "team-canada", name: "Canada", short_name: "CAN", country_code: "CAN" },
      home_slot: "MEX",
      away_slot: "CAN",
      starts_at: "2026-06-01T19:00:00Z",
      venue: "Estadio demo",
      status: "scheduled",
    },
    {
      id: "match-result-id",
      tournament_id: "fifa-world-cup-2026",
      stage_id: "group-stage",
      group_id: "group-a",
      group_name: "A",
      match_number: 2,
      home_team: { id: "team-usa", name: "Estados Unidos", short_name: "USA", country_code: "USA" },
      away_team: { id: "team-panama", name: "Panama", short_name: "PAN", country_code: "PAN" },
      home_slot: "USA",
      away_slot: "PAN",
      starts_at: "2026-06-02T19:00:00Z",
      venue: "Estadio demo",
      status: "scheduled",
    },
  ],
};

const predictionStatuses = [
  {
    match_id: "match-id",
    prediction_id: "",
    status: "closed",
    has_prediction: false,
    closed: true,
    has_official_result: false,
    scored: false,
    points: 0,
    official_result: null,
  },
  {
    match_id: "match-result-id",
    prediction_id: "",
    status: "scored",
    has_prediction: false,
    closed: true,
    has_official_result: true,
    scored: true,
    points: 5,
    official_result: {
      pool_id: "pool-id",
      match_id: "match-result-id",
      home_score: 1,
      away_score: 0,
      result_status: "final",
      recorded_at: "2026-06-02T22:00:00Z",
    },
  },
];

const matchResultAuditLog = {
  id: "audit-id",
  pool_id: "pool-id",
  match_id: "match-id",
  actor_user_id: "admin-id",
  action: "match_result_created",
  previous: null,
  current: {
    home_score: 2,
    away_score: 1,
    result_status: "final",
  },
  created_at: "2026-06-01T22:00:00Z",
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

const prizeRules = [
  {
    id: "prize-rule-1",
    pool_id: "pool-id",
    type: "ranking",
    position: 1,
    percentage: 70,
    fixed_amount_cents: 0,
    currency: "COP",
    description: "Primero",
    created_at: "2026-05-27T01:00:00Z",
  },
  {
    id: "prize-rule-2",
    pool_id: "pool-id",
    type: "ranking",
    position: 2,
    percentage: 30,
    fixed_amount_cents: 0,
    currency: "COP",
    description: "Segundo",
    created_at: "2026-05-27T01:00:00Z",
  },
];

const prizePreview = {
  pool_id: "pool-id",
  currency: "COP",
  confirmed_total_cents: 5000000,
  rules: prizeRules,
  payouts: [
    {
      position: 1,
      percentage: 70,
      estimated_amount_cents: 3500000,
      description: "Primero",
    },
    {
      position: 2,
      percentage: 30,
      estimated_amount_cents: 1500000,
      description: "Segundo",
    },
  ],
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
    expect(screen.getByText("Administracion de polla")).toBeInTheDocument();
    expect(screen.getByLabelText("Polla")).toHaveValue("pool-id");
    expect(screen.getByRole("heading", { name: "Resultados oficiales" })).toBeInTheDocument();
    expect(screen.getByText("1 de 2 partidos con marcador final.")).toBeInTheDocument();
    expect(screen.getByText("Con resultado")).toBeInTheDocument();
    expect(screen.queryByText("Puntuado")).not.toBeInTheDocument();
    expect(screen.getByText("Recaudo habilitado")).toBeInTheDocument();
    expect(screen.getByText("COP 50.000 por entrada")).toBeInTheDocument();
    expect(metricValue("Participantes")).toHaveTextContent("2");
    expect(metricValue("Confirmados")).toHaveTextContent("1");
    expect(metricValue("Pendientes")).toHaveTextContent("1");
    expect(metricValue("Recaudo confirmado")).toHaveTextContent("COP 50.000");
    expect(screen.getByRole("heading", { name: "Premios" })).toBeInTheDocument();
    expect(screen.getByText(/Bolsa confirmada:/)).toHaveTextContent("COP 50.000");
    expect(metricValue("Ganadores")).toHaveTextContent("2");
    expect(metricValue("Total porcentajes")).toHaveTextContent("100%");
    expect(screen.getByText("COP 35.000")).toBeInTheDocument();

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

  it("shows a permission message when payment update is forbidden", async () => {
    storeSession();
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const value = String(url);
      if (
        value.endsWith("/api/v1/pools/pool-id/payments/participant-id") &&
        init?.method === "PUT"
      ) {
        return jsonResponse({ code: "forbidden" }, { status: 403 });
      }
      return adminFetch(url, init);
    });
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    await screen.findByText("@participante");
    const participantRow = rowWithText("@participante");
    fireEvent.click(within(participantRow).getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "No tienes permisos para actualizar pagos.",
      );
    });
    expect(window.localStorage.getItem("pollavar.admin.session")).not.toBeNull();
  });

  it("updates official match results from the admin panel", async () => {
    storeSession();
    const fetcher = vi.fn(adminFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    expect(await screen.findByRole("heading", { name: "Resultados oficiales" })).toBeInTheDocument();
    const existingResultRow = rowWithText("Estados Unidos vs Panama");
    fireEvent.change(within(existingResultRow).getByLabelText("Goles Estados Unidos"), {
      target: { value: "3" },
    });
    fireEvent.change(within(existingResultRow).getByLabelText("Goles Panama"), {
      target: { value: "0" },
    });

    const matchRow = rowWithText("Mexico vs Canada");
    fireEvent.change(within(matchRow).getByLabelText("Goles Mexico"), {
      target: { value: "2" },
    });
    fireEvent.change(within(matchRow).getByLabelText("Goles Canada"), {
      target: { value: "1" },
    });
    fireEvent.click(within(matchRow).getByRole("button", { name: "Guardar resultado" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Resultado oficial actualizado.");
    });
    expect(screen.getByText("Resultado creado")).toBeInTheDocument();
    expect(within(existingResultRow).getByLabelText("Goles Estados Unidos")).toHaveValue(3);
    expect(within(existingResultRow).getByLabelText("Goles Panama")).toHaveValue(0);

    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/pools/pool-id/match-results/match-id",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          home_score: 2,
          away_score: 1,
          result_status: "final",
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      }),
    );
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/pools/pool-id/match-results/match-id/audit-logs",
      expect.objectContaining({
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      }),
    );
  });

  it("updates prize rules from the admin panel", async () => {
    storeSession();
    const fetcher = vi.fn(adminFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    expect(await screen.findByRole("heading", { name: "Premios" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Porcentaje del premio 1"), {
      target: { value: "60" },
    });
    fireEvent.change(screen.getByLabelText("Porcentaje del premio 2"), {
      target: { value: "40" },
    });
    fireEvent.change(screen.getByLabelText("Descripcion del premio 1"), {
      target: { value: "Campeon" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar premios" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Premios actualizados.");
    });

    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/pools/pool-id/prize-rules",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          rules: [
            { position: 1, percentage: 60, description: "Campeon" },
            { position: 2, percentage: 40, description: "Segundo" },
          ],
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      }),
    );
  });

  it("updates prediction settings from the admin panel", async () => {
    storeSession();
    const fetcher = vi.fn(adminFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    expect(await screen.findByRole("heading", { name: "Pronosticos" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Modo de pronostico"), {
      target: { value: "outcome" },
    });
    fireEvent.change(screen.getByLabelText("Puntaje de resultado"), {
      target: { value: "cumulative" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuracion" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Configuracion de pronosticos actualizada.",
      );
    });
    expect(screen.getByText("Local / empate / visitante - Acumulativo")).toBeInTheDocument();

    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/pools/pool-id/prediction-settings",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          prediction_mode: "outcome",
          match_result_scoring_mode: "cumulative",
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      }),
    );
  });

  it("shows a locked message when prediction settings already have activity", async () => {
    storeSession();
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const value = String(url);
      if (value.endsWith("/api/v1/pools/pool-id/prediction-settings") && init?.method === "PUT") {
        return jsonResponse({ code: "prediction_settings_locked" }, { status: 409 });
      }
      return adminFetch(url, init);
    });
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    expect(await screen.findByRole("heading", { name: "Pronosticos" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Modo de pronostico"), {
      target: { value: "outcome" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuracion" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "No pudimos cambiar los modos porque la polla ya tiene pronosticos o resultados.",
      );
    });
  });

  it("keeps unsaved prize rule drafts when payment changes refresh the prize preview", async () => {
    storeSession();
    const fetcher = vi.fn(adminFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    expect(await screen.findByRole("heading", { name: "Premios" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Porcentaje del premio 1"), {
      target: { value: "60" },
    });
    fireEvent.change(screen.getByLabelText("Descripcion del premio 1"), {
      target: { value: "Campeon" },
    });

    const participantRow = rowWithText("@participante");
    fireEvent.click(within(participantRow).getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Pago actualizado.");
    });
    expect(screen.getByLabelText("Porcentaje del premio 1")).toHaveValue("60");
    expect(screen.getByLabelText("Descripcion del premio 1")).toHaveValue("Campeon");
  });

  it("rejects prize rule totals that do not sum exactly to 100 percent at storage precision", async () => {
    storeSession();
    const fetcher = vi.fn(adminFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    expect(await screen.findByRole("heading", { name: "Premios" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Porcentaje del premio 1"), {
      target: { value: "69.999" },
    });
    fireEvent.change(screen.getByLabelText("Porcentaje del premio 2"), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar premios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Revisa los porcentajes de premios. Deben sumar 100%.",
    );
    expect(fetcher).not.toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/pools/pool-id/prize-rules",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("renders a read-only state when the selected pool cannot manage payments", async () => {
    storeSession({ user: { ...session.user, id: "participant-id" } });
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      const value = String(url);
      if (value.endsWith("/api/v1/tournaments")) {
        return jsonResponse({ data: [tournamentSummary] });
      }
      if (value.endsWith("/api/v1/tournaments/fifa-world-cup-2026")) {
        return jsonResponse({ data: tournament });
      }
      if (value.endsWith("/api/v1/pools")) {
        return jsonResponse({ data: [{ ...pool, current_user_role: "participant" }] });
      }
      if (value.endsWith("/api/v1/pools/pool-id")) {
        return jsonResponse({
          data: { ...pool, current_user_role: "participant" },
        });
      }
      if (value.endsWith("/api/v1/pools/pool-id/predictions/statuses")) {
        return jsonResponse({ data: predictionStatuses });
      }
      if (value.endsWith("/api/v1/pools/pool-id/prizes/preview")) {
        return jsonResponse({ data: prizePreview });
      }
      return jsonResponse({ code: "unauthorized" }, { status: 401 });
    });
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    await waitFor(() => {
      expect(screen.getAllByText("Solo lectura").length).toBeGreaterThan(0);
    });
    expect(
      screen.getByText("Esta polla no esta bajo tu administracion de recaudo."),
    ).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: "Confirmar" })) {
      expect(button).toBeDisabled();
    }
    for (const button of screen.getAllByRole("button", { name: "Ver auditoria" })) {
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
      "No pudimos cargar el panel admin.",
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
  if (value.endsWith("/api/v1/tournaments")) {
    return jsonResponse({ data: [tournamentSummary] });
  }
  if (value.endsWith("/api/v1/tournaments/fifa-world-cup-2026")) {
    return jsonResponse({ data: tournament });
  }
  if (value.endsWith("/api/v1/pools")) {
    return jsonResponse({ data: [pool] });
  }
  if (value.endsWith("/api/v1/pools/pool-id/predictions/statuses")) {
    return jsonResponse({ data: predictionStatuses });
  }
  if (value.endsWith("/api/v1/pools/pool-id/match-results/match-id") && init?.method === "PUT") {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    return jsonResponse({
      data: {
        pool_id: "pool-id",
        match_id: "match-id",
        home_score: body.home_score,
        away_score: body.away_score,
        result_status: body.result_status,
        recorded_at: "2026-06-01T22:00:00Z",
      },
    });
  }
  if (
    value.endsWith("/api/v1/pools/pool-id/match-results/match-id/audit-logs") &&
    init?.method === "GET"
  ) {
    return jsonResponse({ data: [matchResultAuditLog] });
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
  if (value.endsWith("/api/v1/pools/pool-id/prize-rules") && init?.method === "PUT") {
    const body = JSON.parse(String(init.body)) as {
      rules: Array<{ position: number; percentage: number; description: string }>;
    };
    return jsonResponse({
      data: body.rules.map((rule, index) => ({
        id: `prize-rule-${index + 1}`,
        pool_id: "pool-id",
        type: "ranking",
        position: rule.position,
        percentage: rule.percentage,
        fixed_amount_cents: 0,
        currency: "COP",
        description: rule.description,
        created_at: "2026-05-27T01:00:00Z",
      })),
    });
  }
  if (value.endsWith("/api/v1/pools/pool-id/prediction-settings") && init?.method === "PUT") {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    return jsonResponse({
      data: {
        ...pool,
        prediction_mode: body.prediction_mode,
        match_result_scoring_mode: body.match_result_scoring_mode,
      },
    });
  }
  if (value.endsWith("/api/v1/pools/pool-id/prizes/preview") && init?.method === "GET") {
    return jsonResponse({ data: prizePreview });
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
