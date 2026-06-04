import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ParticipantsHome from "./page";

const session = {
  token: "token",
  expiresAt: "2099-05-28T01:00:00Z",
  user: {
    id: "user-id",
    name: "Participante",
    username: "participante",
    email: "participante@example.com",
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
  created_by: "user-id",
  created_at: "2026-05-27T01:00:00Z",
  updated_at: "2026-05-27T01:00:00Z",
  current_user_role: "participant",
  theme: {
    id: "theme-id",
    pool_id: "pool-id",
    display_name: "Oficina FC",
    logo_url: "",
    banner_url: "",
    mascot_url: "",
    primary_color: "#0F766E",
    secondary_color: "#111827",
    accent_color: "#F59E0B",
    created_at: "2026-05-27T01:00:00Z",
    updated_at: "2026-05-27T01:00:00Z",
  },
  participants: [
    {
      id: "participant-id",
      pool_id: "pool-id",
      user_id: "user-id",
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
  format_code: "groups",
  starts_at: "2026-06-11T00:00:00Z",
  ends_at: "2026-07-19T23:59:59Z",
  group_count: 12,
  team_count: 48,
};

const tournament = {
  ...tournamentSummary,
  groups: [],
  matches: [
    {
      id: "match-1",
      tournament_id: "fifa-world-cup-2026",
      stage_id: "group-stage",
      group_id: "group-a",
      group_name: "A",
      match_number: 1,
      home_team: { id: "MEX", name: "Mexico", short_name: "MEX", country_code: "MEX" },
      away_team: {
        id: "RSA",
        name: "South Africa",
        short_name: "RSA",
        country_code: "ZAF",
      },
      home_slot: "MEX",
      away_slot: "RSA",
      starts_at: "2099-06-11T19:00:00Z",
      venue: "Mexico City Stadium",
      status: "scheduled",
    },
    {
      id: "match-2",
      tournament_id: "fifa-world-cup-2026",
      stage_id: "group-stage",
      group_id: "group-b",
      group_name: "B",
      match_number: 2,
      home_team: { id: "CAN", name: "Canada", short_name: "CAN", country_code: "CAN" },
      away_team: {
        id: "BIH",
        name: "Bosnia and Herzegovina",
        short_name: "BIH",
        country_code: "BIH",
      },
      home_slot: "CAN",
      away_slot: "BIH",
      starts_at: "2099-06-12T19:00:00Z",
      venue: "Toronto Stadium",
      status: "scheduled",
    },
  ],
};

const standingsTournament = {
  ...tournamentSummary,
  groups: [],
  matches: [
    {
      id: "standing-match-1",
      tournament_id: "fifa-world-cup-2026",
      stage_id: "regular-season",
      group_id: "",
      group_name: "",
      match_number: 1,
      home_team: { id: "ALP", name: "Alpha", short_name: "ALP", country_code: "ALP" },
      away_team: { id: "BET", name: "Beta", short_name: "BET", country_code: "BET" },
      home_slot: "ALP",
      away_slot: "BET",
      starts_at: "2099-06-11T19:00:00Z",
      venue: "League Stadium",
      status: "scheduled",
    },
    {
      id: "standing-match-2",
      tournament_id: "fifa-world-cup-2026",
      stage_id: "regular-season",
      group_id: "",
      group_name: "",
      match_number: 2,
      home_team: { id: "GAM", name: "Gamma", short_name: "GAM", country_code: "GAM" },
      away_team: { id: "DEL", name: "Delta", short_name: "DEL", country_code: "DEL" },
      home_slot: "GAM",
      away_slot: "DEL",
      starts_at: "2099-06-12T19:00:00Z",
      venue: "League Stadium",
      status: "scheduled",
    },
    {
      id: "standing-match-3",
      tournament_id: "fifa-world-cup-2026",
      stage_id: "regular-season",
      group_id: "",
      group_name: "",
      match_number: 3,
      home_team: { id: "ALP", name: "Alpha", short_name: "ALP", country_code: "ALP" },
      away_team: { id: "GAM", name: "Gamma", short_name: "GAM", country_code: "GAM" },
      home_slot: "ALP",
      away_slot: "GAM",
      starts_at: "2099-06-13T19:00:00Z",
      venue: "League Stadium",
      status: "scheduled",
    },
    {
      id: "standing-match-4",
      tournament_id: "fifa-world-cup-2026",
      stage_id: "regular-season",
      group_id: "",
      group_name: "",
      match_number: 4,
      home_team: { id: "BET", name: "Beta", short_name: "BET", country_code: "BET" },
      away_team: { id: "DEL", name: "Delta", short_name: "DEL", country_code: "DEL" },
      home_slot: "BET",
      away_slot: "DEL",
      starts_at: "2099-06-14T19:00:00Z",
      venue: "League Stadium",
      status: "scheduled",
    },
  ],
};

const summary = {
  total_matches: 2,
  predicted_matches: 1,
  missing_matches: 1,
  open_matches: 2,
  closed_matches: 0,
  scored_matches: 1,
};

const prediction = {
  id: "prediction-id",
  pool_id: "pool-id",
  user_id: "user-id",
  match_id: "match-1",
  home_score: 2,
  away_score: 1,
  created_at: "2026-06-11T12:00:00Z",
  updated_at: "2026-06-11T12:30:00Z",
};

const predictionStatuses = [
  {
    match_id: "match-1",
    prediction_id: "prediction-id",
    status: "scored",
    has_prediction: true,
    closed: true,
    has_official_result: true,
    scored: true,
    points: 5,
    official_result: {
      match_id: "match-1",
      home_score: 2,
      away_score: 1,
      result_status: "final",
      recorded_at: "2026-06-11T22:00:00Z",
    },
  },
  {
    match_id: "match-2",
    prediction_id: "",
    status: "pending",
    has_prediction: false,
    closed: false,
    has_official_result: false,
    scored: false,
    points: 0,
  },
];

const scoringRules = [
  { code: "exact_score", points: 5, enabled: true },
  { code: "match_result", points: 3, enabled: true },
];

const rankingEntries = [
  {
    position: 1,
    user_id: "user-id",
    user_name: "Participante",
    username: "participante",
    points: 8,
    event_count: 2,
    payment_status: "pending",
    prize_eligible: true,
    participant: pool.participants[0],
  },
];

const pointDetails = [
  {
    pool_id: "pool-id",
    user_id: "user-id",
    prediction_id: "prediction-id",
    match_id: "match-1",
    match_number: 1,
    rule_code: "exact_score",
    points: 5,
    explanation: "Marcador exacto acertado",
    created_at: "2026-06-11T22:00:00Z",
  },
];

const standingsPredictions = [
  {
    ...prediction,
    id: "standing-prediction-1",
    match_id: "standing-match-1",
    home_score: 1,
    away_score: 0,
  },
  {
    ...prediction,
    id: "standing-prediction-2",
    match_id: "standing-match-2",
    home_score: 2,
    away_score: 0,
  },
  {
    ...prediction,
    id: "standing-prediction-3",
    match_id: "standing-match-3",
    home_score: 0,
    away_score: 0,
  },
];

const standingOrderPrediction = {
  id: "standing-order-id",
  pool_id: "pool-id",
  user_id: "user-id",
  group_id: "prediction-group-regular-season-general",
  team_ids: ["ALP", "GAM", "BET", "DEL"],
  created_at: "2026-06-11T12:00:00Z",
  updated_at: "2026-06-11T12:30:00Z",
};

const closedStandingsTournament = {
  ...standingsTournament,
  matches: standingsTournament.matches.map((match, index) => ({
    ...match,
    starts_at: `2020-06-${String(11 + index).padStart(2, "0")}T19:00:00Z`,
  })),
};

describe("Participants home", () => {
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders sign-in actions when there is no participant session", async () => {
    render(<ParticipantsHome />);

    expect(await screen.findByText("Entra para completar tus marcadores")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Entrar" })[0]).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getAllByRole("link", { name: "Crear cuenta" })[0]).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("clears a corrupted session and renders the signed-out state", async () => {
    window.localStorage.setItem("pollavar.participants.session", "{");

    render(<ParticipantsHome />);

    expect(await screen.findByText("Entra para completar tus marcadores")).toBeInTheDocument();
    expect(window.localStorage.getItem("pollavar.participants.session")).toBeNull();
  });

  it("clears an expired session and renders the signed-out state", async () => {
    window.localStorage.setItem(
      "pollavar.participants.session",
      JSON.stringify({ ...session, expiresAt: "2020-01-01T00:00:00Z" }),
    );

    render(<ParticipantsHome />);

    expect(await screen.findByText("Entra para completar tus marcadores")).toBeInTheDocument();
    expect(window.localStorage.getItem("pollavar.participants.session")).toBeNull();
  });

  it("loads pools, progress summary and editable match predictions", async () => {
    storeSession();
    const fetcher = vi.fn(dashboardFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<ParticipantsHome />);

    expect(await screen.findByRole("heading", { name: "Oficina FC" })).toBeInTheDocument();
    expect(screen.getByText("FIFA World Cup 2026")).toBeInTheDocument();
    expect(screen.getByText("ABC123")).toBeInTheDocument();
    expect(screen.getByText("6h antes")).toBeInTheDocument();
    expect(screen.getAllByText("Pronosticados").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Faltantes").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1")).toBeInTheDocument();
    expect(screen.getByLabelText("Marcador Canada")).toHaveValue(null);
    expect(screen.getByText("Puntuado")).toBeInTheDocument();
    expect(screen.getByText("+5 pts")).toBeInTheDocument();
    expect(screen.getByText("Resultado 2-1")).toBeInTheDocument();
    expect(screen.getByText("Reglas de puntaje")).toBeInTheDocument();
    expect(screen.getByText("Marcador exacto")).toBeInTheDocument();
    expect(screen.getByText("5 pts")).toBeInTheDocument();
    expect(screen.getByText("Resultado correcto")).toBeInTheDocument();
    expect(screen.getByText("3 pts")).toBeInTheDocument();
    const rankingSection = screen.getByRole("heading", { name: "Ranking general" }).closest("section");
    expect(rankingSection).not.toBeNull();
    expect(within(rankingSection as HTMLElement).getByText("8")).toBeInTheDocument();
    expect(
      within(rankingSection as HTMLElement).getByText(
        "@participante - Pago pendiente - Elegible a premio",
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      within(rankingSection as HTMLElement).getByRole("button", {
        name: "Ver detalle de Participante",
      }),
    );
    await waitFor(() => {
      expect(
        within(rankingSection as HTMLElement).getByText(
          "Marcador exacto - Marcador exacto acertado",
        ),
      ).toBeInTheDocument();
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/pools/pool-id/ranking/user-id/points",
      expect.objectContaining({
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      }),
    );
    const groupA = screen.getByRole("heading", { name: "Grupo A" }).closest("section");
    const groupB = screen.getByRole("heading", { name: "Grupo B" }).closest("section");
    expect(groupA).not.toBeNull();
    expect(groupB).not.toBeNull();
    expect(within(groupA as HTMLElement).getByText("Fase de grupos")).toBeInTheDocument();
    expect(within(groupA as HTMLElement).getByText("1/1")).toBeInTheDocument();
    expect(within(groupB as HTMLElement).getByText("0/1")).toBeInTheDocument();
    const groupATable = within(groupA as HTMLElement).getByRole("table");
    expect(
      within(groupATable).getByRole("row", {
        name: /1 Mexico\s*MEX 1 3 2 1 \+1 Completo/,
      }),
    ).toBeInTheDocument();
    expect(
      within(groupATable).getByRole("row", {
        name: /2 South Africa\s*RSA 1 0 1 2 -1 Completo/,
      }),
    ).toBeInTheDocument();
    expect(within(groupB as HTMLElement).getAllByText("Incompleto")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Actualizar" })).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/pools",
      expect.objectContaining({
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      }),
    );
  });

  it("loads predictions when the status endpoint is not deployed yet", async () => {
    storeSession();
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith("/statuses")) {
        return new Response("404 page not found\n", {
          status: 404,
          headers: {
            "Content-Type": "text/plain",
          },
        });
      }
      return dashboardFetch(url, init);
    });
    vi.stubGlobal("fetch", fetcher);

    render(<ParticipantsHome />);

    expect(await screen.findByRole("heading", { name: "Oficina FC" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1")).toBeInTheDocument();
    expect(screen.getAllByText("Completo").length).toBeGreaterThan(0);
    expect(screen.queryByText("Puntuado")).not.toBeInTheDocument();
  });

  it("loads default scoring rules when the scoring endpoint is not deployed yet", async () => {
    storeSession();
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith("/scoring-rules")) {
        return new Response("404 page not found\n", {
          status: 404,
          headers: {
            "Content-Type": "text/plain",
          },
        });
      }
      return dashboardFetch(url, init);
    });
    vi.stubGlobal("fetch", fetcher);

    render(<ParticipantsHome />);

    expect(await screen.findByRole("heading", { name: "Oficina FC" })).toBeInTheDocument();
    expect(screen.getByText("Reglas de puntaje")).toBeInTheDocument();
    expect(screen.getByText("Marcador exacto")).toBeInTheDocument();
    expect(screen.getByText("5 pts")).toBeInTheDocument();
    expect(screen.getByText("Resultado correcto")).toBeInTheDocument();
    expect(screen.getByText("3 pts")).toBeInTheDocument();
  });

  it("renders suggested standings for league stages with tiebreakers and incomplete teams", async () => {
    storeSession();
    vi.stubGlobal("fetch", vi.fn(standingsFetch));

    render(<ParticipantsHome />);

    expect(await screen.findByRole("heading", { name: "Regular Season" })).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("row", {
        name: /1 Gamma\s*GAM 2 4 2 0 \+2 Completo/,
      }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("row", {
        name: /2 Alpha\s*ALP 2 4 1 0 \+1 Completo/,
      }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("row", {
        name: /3 Beta\s*BET 1 0 0 1 -1 Incompleto/,
      }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("row", {
        name: /4 Delta\s*DEL 1 0 0 2 -2 Incompleto/,
      }),
    ).toBeInTheDocument();
  });

  it("lets the participant reorder and save final standings by group", async () => {
    storeSession();
    const fetcher = vi.fn(standingOrderFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<ParticipantsHome />);

    expect(await screen.findByRole("heading", { name: "Regular Season" })).toBeInTheDocument();
    const section = screen.getByRole("heading", { name: "Regular Season" }).closest("section");
    expect(section).not.toBeNull();

    const moveAlphaUp = within(section as HTMLElement).getByRole("button", {
      name: "Subir Alpha",
    });
    expect(moveAlphaUp).toBeEnabled();

    fireEvent.click(moveAlphaUp);
    fireEvent.click(within(section as HTMLElement).getByRole("button", { name: "Guardar orden" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Orden de posiciones guardado.");
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/pools/pool-id/standing-predictions/prediction-group-regular-season-general",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ team_ids: ["ALP", "GAM", "BET", "DEL"] }),
      }),
    );
  });

  it("disables final standing order changes when the group is closed", async () => {
    storeSession();
    vi.stubGlobal("fetch", vi.fn(closedStandingOrderFetch));

    render(<ParticipantsHome />);

    expect(await screen.findByRole("heading", { name: "Regular Season" })).toBeInTheDocument();
    const section = screen.getByRole("heading", { name: "Regular Season" }).closest("section");
    expect(section).not.toBeNull();

    expect(within(section as HTMLElement).getAllByText("Cerrado").length).toBeGreaterThan(0);
    expect(within(section as HTMLElement).getByRole("button", { name: "Subir Alpha" })).toBeDisabled();
    expect(within(section as HTMLElement).getByRole("button", { name: "Guardar orden" })).toBeDisabled();
  });

  it("refreshes final standing closure state while the dashboard stays open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2099-06-11T12:59:00Z"));
    storeSession({ expiresAt: "2100-01-01T00:00:00Z" });
    vi.stubGlobal("fetch", vi.fn(standingsFetch));

    render(<ParticipantsHome />);

    expect(await screen.findByRole("heading", { name: "Regular Season" })).toBeInTheDocument();
    const section = screen.getByRole("heading", { name: "Regular Season" }).closest("section");
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByText("Abierto")).toBeInTheDocument();

    vi.setSystemTime(new Date("2099-06-11T13:00:00Z"));
    await vi.advanceTimersByTimeAsync(60_000);

    await waitFor(() => {
      expect(within(section as HTMLElement).getAllByText("Cerrado").length).toBeGreaterThan(0);
    });
    expect(within(section as HTMLElement).getByRole("button", { name: "Guardar orden" })).toBeDisabled();
  });

  it("keeps the newest dashboard response when refreshes overlap", async () => {
    storeSession();
    const stalePool = {
      ...pool,
      theme: { ...pool.theme, display_name: "Respuesta vieja" },
    };
    const freshPool = {
      ...pool,
      theme: { ...pool.theme, display_name: "Respuesta nueva" },
    };
    const firstRefresh = deferred<Response>();
    const secondRefresh = deferred<Response>();
    let poolDetailCalls = 0;
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      const value = String(url);
      if (value.endsWith("/api/v1/pools")) {
        return jsonResponse({ data: [pool] });
      }
      if (value.endsWith("/api/v1/tournaments")) {
        return jsonResponse({ data: [tournamentSummary] });
      }
      if (value.endsWith("/api/v1/pools/pool-id")) {
        poolDetailCalls += 1;
        if (poolDetailCalls === 1) {
          return jsonResponse({ data: pool });
        }
        if (poolDetailCalls === 2) {
          return firstRefresh.promise;
        }
        return secondRefresh.promise;
      }
      if (value.endsWith("/summary")) {
        return jsonResponse({ data: summary });
      }
      if (value.endsWith("/statuses")) {
        return jsonResponse({ data: predictionStatuses });
      }
      if (value.endsWith("/ranking")) {
        return jsonResponse({ data: rankingEntries });
      }
      if (value.endsWith("/scoring-rules")) {
        return jsonResponse({ data: scoringRules });
      }
      if (value.endsWith("/standing-predictions")) {
        return jsonResponse({ data: [] });
      }
      if (value.endsWith("/predictions")) {
        return jsonResponse({ data: [prediction] });
      }
      if (value.endsWith("/api/v1/tournaments/fifa-world-cup-2026")) {
        return jsonResponse({ data: tournament });
      }
      return jsonResponse({ code: "not_found" }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetcher);

    render(<ParticipantsHome />);

    expect(await screen.findByRole("heading", { name: "Oficina FC" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() => {
      expect(poolDetailCalls).toBe(2);
    });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    await waitFor(() => {
      expect(poolDetailCalls).toBe(3);
    });

    secondRefresh.resolve(jsonResponse({ data: freshPool }));
    expect(await screen.findByRole("heading", { name: "Respuesta nueva" })).toBeInTheDocument();

    firstRefresh.resolve(jsonResponse({ data: stalePool }));
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Respuesta vieja" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Respuesta nueva" })).toBeInTheDocument();
  });

  it("saves a match prediction and refreshes the participant progress", async () => {
    storeSession();
    const fetcher = vi.fn(dashboardFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<ParticipantsHome />);

    const homeInput = await screen.findByLabelText("Marcador Canada");
    const form = homeInput.closest("form");
    expect(form).not.toBeNull();

    fireEvent.change(homeInput, { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Marcador Bosnia and Herzegovina"), {
      target: { value: "0" },
    });
    fireEvent.click(within(form as HTMLFormElement).getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Pronostico guardado.");
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/pools/pool-id/predictions/match-2",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ home_score: 1, away_score: 0 }),
      }),
    );
  });

  it("shows a validation message before saving incomplete scores", async () => {
    storeSession();
    vi.stubGlobal("fetch", vi.fn(dashboardFetch));

    render(<ParticipantsHome />);

    const homeInput = await screen.findByLabelText("Marcador Canada");
    const form = homeInput.closest("form");
    expect(form).not.toBeNull();

    fireEvent.change(homeInput, { target: { value: "1" } });
    fireEvent.click(within(form as HTMLFormElement).getByRole("button", { name: "Guardar" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Completa ambos marcadores con numeros validos.",
    );
  });

  it("shows an empty state when the participant has no pools", async () => {
    storeSession();
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith("/api/v1/pools")) {
        return jsonResponse({ data: [] });
      }
      return jsonResponse({ data: [] });
    });
    vi.stubGlobal("fetch", fetcher);

    render(<ParticipantsHome />);

    expect(await screen.findByText("Aun no tienes pollas")).toBeInTheDocument();
  });

  it("shows an error state when loading fails", async () => {
    storeSession();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ code: "internal_error" }, { status: 500 })),
    );

    render(<ParticipantsHome />);

    expect(await screen.findByText("No pudimos cargar tu informacion")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("clears the stored session when the API returns unauthorized", async () => {
    storeSession();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ code: "unauthorized" }, { status: 401 })),
    );

    render(<ParticipantsHome />);

    expect(await screen.findByText("Entra para completar tus marcadores")).toBeInTheDocument();
    expect(window.localStorage.getItem("pollavar.participants.session")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("shows a tournament missing state when no tournament matches the pool", async () => {
    storeSession();
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      const value = String(url);
      if (value.endsWith("/api/v1/pools")) {
        return jsonResponse({ data: [pool] });
      }
      if (value.endsWith("/api/v1/tournaments")) {
        return jsonResponse({ data: [] });
      }
      if (value.endsWith("/summary")) {
        return jsonResponse({ data: summary });
      }
      if (value.endsWith("/statuses")) {
        return jsonResponse({ data: [] });
      }
      if (value.endsWith("/ranking")) {
        return jsonResponse({ data: rankingEntries });
      }
      if (value.endsWith("/scoring-rules")) {
        return jsonResponse({ data: scoringRules });
      }
      if (value.endsWith("/standing-predictions")) {
        return jsonResponse({ data: [] });
      }
      if (value.endsWith("/predictions")) {
        return jsonResponse({ data: [] });
      }
      return jsonResponse({ data: pool });
    });
    vi.stubGlobal("fetch", fetcher);

    render(<ParticipantsHome />);

    expect(await screen.findByText("Torneo no disponible")).toBeInTheDocument();
  });
});

function storeSession(overrides: Partial<typeof session> = {}) {
  window.localStorage.setItem(
    "pollavar.participants.session",
    JSON.stringify({ ...session, ...overrides }),
  );
}

async function dashboardFetch(url: RequestInfo | URL, init?: RequestInit) {
  const value = String(url);
  if (value.endsWith("/api/v1/pools")) {
    return jsonResponse({ data: [pool] });
  }
  if (value.endsWith("/api/v1/tournaments")) {
    return jsonResponse({ data: [tournamentSummary] });
  }
  if (value.endsWith("/api/v1/pools/pool-id")) {
    return jsonResponse({ data: pool });
  }
  if (value.endsWith("/summary")) {
    return jsonResponse({ data: summary });
  }
  if (value.endsWith("/statuses")) {
    return jsonResponse({ data: predictionStatuses });
  }
  if (value.endsWith("/ranking")) {
    return jsonResponse({ data: rankingEntries });
  }
  if (value.endsWith("/ranking/user-id/points")) {
    return jsonResponse({ data: pointDetails });
  }
  if (value.endsWith("/scoring-rules")) {
    return jsonResponse({ data: scoringRules });
  }
  if (value.endsWith("/standing-predictions")) {
    return jsonResponse({ data: [] });
  }
  if (init?.method === "PUT" && value.includes("/standing-predictions/")) {
    const body = JSON.parse(String(init.body)) as { team_ids: string[] };
    return jsonResponse({ data: { ...standingOrderPrediction, team_ids: body.team_ids } });
  }
  if (init?.method === "PUT") {
    return jsonResponse({
      data: {
        ...prediction,
        id: "prediction-2",
        match_id: "match-2",
        home_score: 1,
        away_score: 0,
      },
    });
  }
  if (value.endsWith("/predictions")) {
    return jsonResponse({ data: [prediction] });
  }
  if (value.endsWith("/api/v1/tournaments/fifa-world-cup-2026")) {
    return jsonResponse({ data: tournament });
  }
  return jsonResponse({ code: "not_found" }, { status: 404 });
}

async function standingsFetch(url: RequestInfo | URL, init?: RequestInit) {
  const value = String(url);
  if (value.endsWith("/api/v1/pools")) {
    return jsonResponse({ data: [pool] });
  }
  if (value.endsWith("/api/v1/tournaments")) {
    return jsonResponse({ data: [tournamentSummary] });
  }
  if (value.endsWith("/api/v1/pools/pool-id")) {
    return jsonResponse({ data: pool });
  }
  if (value.endsWith("/summary")) {
    return jsonResponse({
      data: {
        ...summary,
        total_matches: 4,
        predicted_matches: 3,
        missing_matches: 1,
      },
    });
  }
  if (value.endsWith("/statuses")) {
    return jsonResponse({ data: [] });
  }
  if (value.endsWith("/ranking")) {
    return jsonResponse({ data: rankingEntries });
  }
  if (value.endsWith("/ranking/user-id/points")) {
    return jsonResponse({ data: pointDetails });
  }
  if (value.endsWith("/scoring-rules")) {
    return jsonResponse({ data: scoringRules });
  }
  if (value.endsWith("/standing-predictions")) {
    return jsonResponse({ data: [] });
  }
  if (init?.method === "PUT" && value.includes("/standing-predictions/")) {
    const body = JSON.parse(String(init.body)) as { team_ids: string[] };
    return jsonResponse({ data: { ...standingOrderPrediction, team_ids: body.team_ids } });
  }
  if (value.endsWith("/predictions")) {
    return jsonResponse({ data: standingsPredictions });
  }
  if (value.endsWith("/api/v1/tournaments/fifa-world-cup-2026")) {
    return jsonResponse({ data: standingsTournament });
  }
  return jsonResponse({ code: "not_found" }, { status: 404 });
}

async function standingOrderFetch(url: RequestInfo | URL, init?: RequestInit) {
  return standingsFetch(url, init);
}

async function closedStandingOrderFetch(url: RequestInfo | URL, init?: RequestInit) {
  const response = await standingsFetch(url, init);
  if (String(url).endsWith("/api/v1/tournaments/fifa-world-cup-2026")) {
    return jsonResponse({ data: closedStandingsTournament });
  }
  return response;
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}
