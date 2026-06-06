import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { GlobalUserRole } from "@pollavar/api-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminHome from "./page";

const session: {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    name: string;
    username: string;
    email: string;
    role: GlobalUserRole;
    created_at: string;
  };
} = {
  token: "token",
  expiresAt: "2099-05-28T01:00:00Z",
  user: {
    id: "admin-id",
    name: "Admin",
    username: "admin",
    email: "admin@example.com",
    role: "superadmin",
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
  ranking_tie_policy: "split_equal",
  created_by: "admin-id",
  created_at: "2026-05-27T01:00:00Z",
  updated_at: "2026-05-27T01:00:00Z",
  current_user_role: "pool_admin",
  permissions: {
    can_manage_pool: true,
    can_manage_payments: true,
    can_manage_prize_rules: true,
    can_manage_scoring_rules: true,
    can_manage_prediction_settings: true,
    can_manage_theme: true,
    can_manage_results: true,
    can_manage_underdog_bonuses: true,
    can_manage_global_predictions: true,
  },
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
  theme_template: {
    logo_url: "",
    banner_url: "",
    mascot_url: "",
    primary_color: "#007A3D",
    secondary_color: "#111827",
    accent_color: "#C8A45D",
  },
  tiebreakers: ["points", "goal_difference", "goals_for"],
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
  advancement_rules: [],
  matches: [
    {
      id: "match-id",
      tournament_id: "fifa-world-cup-2026",
      stage_id: "group-stage",
      stage_name: "Group Stage",
      stage_type: "group",
      stage_round_size: 0,
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
      stage_name: "Group Stage",
      stage_type: "group",
      stage_round_size: 0,
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
    {
      id: "third-place-match",
      tournament_id: "fifa-world-cup-2026",
      stage_id: "third-place",
      stage_name: "Third place",
      stage_type: "placement",
      stage_round_size: 2,
      group_id: "",
      group_name: "",
      match_number: 3,
      home_team: { id: "team-brazil", name: "Brazil", short_name: "BRA", country_code: "BRA" },
      away_team: { id: "team-japan", name: "Japan", short_name: "JPN", country_code: "JPN" },
      home_slot: "BRA",
      away_slot: "JPN",
      starts_at: "2026-07-18T19:00:00Z",
      venue: "Estadio tercer puesto",
      status: "scheduled",
    },
  ],
};

const byeSlotMatch = {
  id: "bye-slot-match",
  tournament_id: "fifa-world-cup-2026",
  stage_id: "round-of-32",
  stage_name: "Round of 32",
  stage_type: "knockout",
  stage_round_size: 32,
  group_id: "",
  group_name: "",
  match_number: 99,
  home_team: null,
  away_team: null,
  home_slot: "Seed #1",
  away_slot: "BYE",
  home_slot_config: { type: "seed", source_id: "seed-1", rank: 1, label: "Seed #1" },
  away_slot_config: { type: "bye", source_id: "bye-1", rank: 1, label: "Clasificado directo" },
  starts_at: "2026-07-01T19:00:00Z",
  venue: "Bye Stadium",
  status: "scheduled",
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

const predictionSnapshot = {
  id: "snapshot-id",
  pool_id: "pool-id",
  match_id: "match-id",
  generated_at: "2026-06-01T20:00:00Z",
  row_count: 2,
  checksum: "abcdef1234567890",
  entries: [
    {
      id: "snapshot-entry-admin",
      snapshot_id: "snapshot-id",
      prediction_id: "prediction-admin",
      user_id: "admin-id",
      participant_name: "Admin",
      has_prediction: true,
      home_score: 2,
      away_score: 1,
      outcome: "home",
      predicted_at: "2026-06-01T12:00:00Z",
      updated_at: "2026-06-01T12:00:00Z",
    },
    {
      id: "snapshot-entry-participant",
      snapshot_id: "snapshot-id",
      prediction_id: "",
      user_id: "participant-id",
      participant_name: "Participante",
      has_prediction: false,
      home_score: null,
      away_score: null,
      outcome: "",
      predicted_at: null,
      updated_at: null,
    },
  ],
};

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

const officialStandings = [
  {
    pool_id: "pool-id",
    tournament_id: "fifa-world-cup-2026",
    stage_id: "group-stage",
    group_id: "group-a",
    team: { id: "team-mexico", name: "Mexico", short_name: "MEX", country_code: "MEX" },
    position: 1,
    reason: "Tabla oficial FIFA",
    updated_by: "admin-id",
    updated_at: "2026-06-02T22:00:00Z",
  },
  {
    pool_id: "pool-id",
    tournament_id: "fifa-world-cup-2026",
    stage_id: "group-stage",
    group_id: "group-a",
    team: { id: "team-canada", name: "Canada", short_name: "CAN", country_code: "CAN" },
    position: 2,
    reason: "Tabla oficial FIFA",
    updated_by: "admin-id",
    updated_at: "2026-06-02T22:00:00Z",
  },
];

const officialStandingAuditLog = {
  id: "official-standing-audit-id",
  pool_id: "pool-id",
  tournament_id: "fifa-world-cup-2026",
  stage_id: "group-stage",
  group_id: "group-a",
  actor_user_id: "admin-id",
  action: "official_standings_replaced",
  previous: [],
  current: officialStandings,
  reason: "Tabla oficial FIFA",
  created_at: "2026-06-02T22:05:00Z",
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
  ranking_tie_policy: "split_equal",
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

const globalPrizePreview = {
  pool_id: "pool-id",
  currency: "COP",
  confirmed_total_cents: 5000000,
  prizes: [
    {
      definition_id: "global-definition-champion",
      code: "global_champion",
      label: "Campeon",
      prize_type: "percentage",
      prize_fixed_amount_cents: 0,
      prize_percentage: 10,
      prize_share_policy: "split_equal",
      estimated_total_cents: 500000,
      result_recorded: true,
      winner_count: 1,
      winners: [
        {
          user_id: "user-id",
          user_name: "Admin",
          username: "admin",
          prediction_id: "global-prediction-champion",
          estimated_amount_cents: 500000,
        },
      ],
    },
  ],
};

const readOnlyPermissions = {
  can_manage_pool: false,
  can_manage_payments: false,
  can_manage_prize_rules: false,
  can_manage_scoring_rules: false,
  can_manage_prediction_settings: false,
  can_manage_theme: false,
  can_manage_results: false,
  can_manage_underdog_bonuses: false,
  can_manage_global_predictions: false,
};

const scoringRules = [
  { code: "exact_score", points: 5, enabled: true },
  { code: "score_difference", points: 2, enabled: true },
  { code: "match_result", points: 3, enabled: true },
  { code: "group_position_exact", points: 2, enabled: true },
  { code: "underdog_bonus", points: 2, enabled: false },
];

const underdogBonuses = [
  {
    id: "bonus-id",
    pool_id: "pool-id",
    match_id: "match-id",
    enabled: true,
    outcome: "away",
    source: "manual",
    home_probability: 70,
    draw_probability: 20,
    away_probability: 10,
    locked_at: null,
    created_at: "2026-06-01T12:00:00Z",
    updated_at: "2026-06-01T12:30:00Z",
  },
];

const predictionSettingsOverrides = [
  {
    id: "override-match",
    pool_id: "pool-id",
    scope_type: "match",
    stage_id: "",
    match_id: "match-result-id",
    prediction_mode: "outcome",
    match_result_scoring_mode: null,
    underdog_bonus_enabled: true,
    underdog_bonus_points: 4,
    created_at: "2026-06-01T12:00:00Z",
    updated_at: "2026-06-01T12:30:00Z",
  },
];

const effectiveMatchPredictionSettings = [
  {
    pool_id: "pool-id",
    match_id: "match-id",
    stage_id: "group-stage",
    prediction_mode: "score_with_outcome",
    match_result_scoring_mode: "exclusive",
    underdog_bonus_enabled: false,
    underdog_bonus_points: 2,
    prediction_mode_source: "pool",
    match_result_scoring_mode_source: "pool",
    underdog_bonus_enabled_source: "pool",
    underdog_bonus_points_source: "pool",
  },
  {
    pool_id: "pool-id",
    match_id: "match-result-id",
    stage_id: "group-stage",
    prediction_mode: "outcome",
    match_result_scoring_mode: "exclusive",
    underdog_bonus_enabled: true,
    underdog_bonus_points: 4,
    prediction_mode_source: "match",
    match_result_scoring_mode_source: "pool",
    underdog_bonus_enabled_source: "match",
    underdog_bonus_points_source: "match",
  },
];

const globalPredictionDefinitions = [
  {
    id: "global-definition-champion",
    pool_id: "pool-id",
    code: "global_champion",
    label: "Campeon",
    value_type: "team",
    enabled: true,
    points_enabled: true,
    prize_enabled: true,
    prize_type: "percentage",
    prize_fixed_amount_cents: 0,
    prize_percentage: 10,
    prize_share_policy: "split_equal",
    points: 10,
    sort_order: 1,
    closes_at: "2020-06-11T00:00:00Z",
    created_at: "2026-05-27T01:00:00Z",
    updated_at: "2026-05-27T01:00:00Z",
  },
  {
    id: "global-definition-yellow-range",
    pool_id: "pool-id",
    code: "global_yellow_cards_range",
    label: "Total amarillas por rango",
    value_type: "number_range",
    enabled: true,
    points_enabled: true,
    prize_enabled: false,
    prize_type: "none",
    prize_fixed_amount_cents: 0,
    prize_percentage: 0,
    prize_share_policy: "split_equal",
    points: 5,
    sort_order: 2,
    closes_at: null,
    created_at: "2026-05-27T01:00:00Z",
    updated_at: "2026-05-27T01:00:00Z",
  },
  {
    id: "global-definition-top-scorer",
    pool_id: "pool-id",
    code: "global_top_scorer",
    label: "Goleador",
    value_type: "player",
    enabled: true,
    points_enabled: true,
    prize_enabled: false,
    prize_type: "none",
    prize_fixed_amount_cents: 0,
    prize_percentage: 0,
    prize_share_policy: "split_equal",
    points: 4,
    sort_order: 3,
    closes_at: "2020-06-11T00:00:00Z",
    created_at: "2026-05-27T01:00:00Z",
    updated_at: "2026-05-27T01:00:00Z",
  },
];

const globalPredictionTemplates = [
  {
    id: "template-best-defense",
    code: "global_best_defense",
    label: "Valla menos vencida",
    value_type: "team",
    sport: "football",
    category: "teams",
    resolution_mode: "manual",
    enabled: true,
    points_enabled: true,
    prize_enabled: false,
    points: 4,
    sort_order: 65,
    default_enabled: false,
    created_at: "2026-06-11T12:00:00Z",
    updated_at: "2026-06-11T12:30:00Z",
  },
];

const globalPredictionResults = [
  {
    id: "global-result-champion",
    pool_id: "pool-id",
    definition_id: "global-definition-champion",
    code: "global_champion",
    value_type: "team",
    value_text: "team-mexico",
    value_number: null,
    range_min: null,
    range_max: null,
    recorded_by: "admin-id",
    recorded_at: "2026-07-20T01:00:00Z",
    created_at: "2026-07-20T01:00:00Z",
    updated_at: "2026-07-20T01:00:00Z",
  },
  {
    id: "global-result-top-scorer",
    pool_id: "pool-id",
    definition_id: "global-definition-top-scorer",
    code: "global_top_scorer",
    value_type: "player",
    value_text: "Kylian Mbappe",
    value_number: null,
    range_min: null,
    range_max: null,
    recorded_by: "admin-id",
    recorded_at: "2026-07-20T01:00:00Z",
    created_at: "2026-07-20T01:00:00Z",
    updated_at: "2026-07-20T01:00:00Z",
  },
];

const globalPredictionAnswerSummary = {
  pool_id: "pool-id",
  definition_id: "global-definition-top-scorer",
  code: "global_top_scorer",
  label: "Goleador",
  value_type: "player",
  result_recorded: true,
  result_value_text: "Kylian Mbappe",
  result_normalized_value: "kylian mbappe",
  answers: [
    {
      value_text: "Kylian Mbappe",
      normalized_value: "kylian mbappe",
      prediction_count: 1,
      approved: true,
    },
    {
      value_text: "Mbappe",
      normalized_value: "mbappe",
      prediction_count: 2,
      approved: false,
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
    const adminNavigation = screen.getByRole("navigation", {
      name: "Secciones de administracion",
    });
    expect(within(adminNavigation).getByRole("link", { name: "Identidad" })).toHaveAttribute(
      "href",
      "#identidad",
    );
    expect(within(adminNavigation).getByRole("link", { name: "Recaudo" })).toHaveAttribute(
      "href",
      "#recaudo",
    );
    expectAdminNavigationTargetsToExist(adminNavigation);
    expect(screen.getByRole("heading", { name: "Resultados oficiales" })).toBeInTheDocument();
    expect(screen.getByText("1 de 3 partidos con marcador final.")).toBeInTheDocument();
    const officialResultsSection = screen
      .getByRole("heading", { name: "Resultados oficiales" })
      .closest("section");
    expect(officialResultsSection).not.toBeNull();
    expect(within(officialResultsSection as HTMLElement).getByText("Con resultado")).toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: "Predicciones globales" })).toBeInTheDocument();
    expect(screen.getByText("3 activas de 3 configuradas.")).toBeInTheDocument();
    expect(screen.getByText("Resultados globales oficiales")).toBeInTheDocument();
    expect(screen.getAllByText("Actual:").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Revisar respuestas de Goleador" }));
    expect(await screen.findByText("Mbappe")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aceptar alias Mbappe" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Alias globales actualizados.");
    });

    fireEvent.click(screen.getByRole("button", { name: "Generar bracket" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Bracket generado.");
    });

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
      "/api/v1/pools/pool-id/payments/participant-id",
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
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/pools/pool-id/global-results/global_top_scorer/aliases",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          alias_values: ["Mbappe"],
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      }),
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/tournaments/fifa-world-cup-2026/brackets/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          stage_id: "custom-knockout",
          stage_name: "Ronda eliminatoria",
          match_id_prefix: "custom-knockout-match",
          match_number_start: 4,
          slots: [
            { type: "ranking_top_n", source_id: "league-top", rank: 1, label: "Seed #1" },
            { type: "ranking_top_n", source_id: "league-top", rank: 2, label: "Seed #2" },
          ],
          from_stage_id: "group-stage",
          from_stage_name: "Fase de grupos",
          rule_id_prefix: "league-top",
          rule_priority_start: 1,
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      }),
    );
  });

  it("filters participants by payment status", async () => {
    storeSession();
    vi.stubGlobal("fetch", vi.fn(adminFetch));

    render(<AdminHome />);

    const revenueSection = (await screen.findByRole("heading", {
      name: "Oficina FC",
    })).closest("section");
    expect(revenueSection).not.toBeNull();
    expect(within(revenueSection as HTMLElement).getByText("@admin")).toBeInTheDocument();
    expect(within(revenueSection as HTMLElement).getByText("@participante")).toBeInTheDocument();

    fireEvent.change(within(revenueSection as HTMLElement).getByLabelText("Filtrar"), {
      target: { value: "pending" },
    });

    expect(within(revenueSection as HTMLElement).queryByText("@admin")).not.toBeInTheDocument();
    expect(within(revenueSection as HTMLElement).getByText("@participante")).toBeInTheDocument();
    expect(
      within(revenueSection as HTMLElement).getByText("1 de 2 participantes"),
    ).toBeInTheDocument();
  });

  it("exports payments as CSV from the admin panel", async () => {
    storeSession();
    const fetcher = vi.fn(adminFetch);
    vi.stubGlobal("fetch", fetcher);
    const click = vi.fn();
    const createObjectURL = vi.fn(() => "blob:payments");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      ...window.URL,
      createObjectURL,
      revokeObjectURL,
    });
    const createElement = vi.spyOn(document, "createElement");
    createElement.mockImplementation((tagName: string) => {
      const element = document.createElementNS("http://www.w3.org/1999/xhtml", tagName);
      if (tagName === "a") {
        Object.defineProperty(element, "click", { value: click });
      }
      return element as HTMLElement;
    });

    render(<AdminHome />);

    const revenueSection = (await screen.findByRole("heading", {
      name: "Oficina FC",
    })).closest("section");
    expect(revenueSection).not.toBeNull();

    fireEvent.click(
      within(revenueSection as HTMLElement).getByRole("button", { name: "Exportar CSV" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Listado de pagos descargado.");
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/pools/pool-id/payments.csv",
      expect.objectContaining({
        method: "GET",
        headers: {
          Authorization: "Bearer token",
        },
      }),
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:payments");
  });

  it("shows configured bye slot labels in official results", async () => {
    storeSession();
    const tournamentWithBye = {
      ...tournament,
      matches: [byeSlotMatch],
    };
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const value = String(url);
      if (value.endsWith("/api/v1/tournaments/fifa-world-cup-2026")) {
        return jsonResponse({ data: tournamentWithBye });
      }
      if (value.endsWith("/api/v1/pools/pool-id/predictions/statuses")) {
        return jsonResponse({ data: [] });
      }
      return adminFetch(url, init);
    });
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    const officialResultsSection = await screen
      .findByRole("heading", { name: "Resultados oficiales" })
      .then((heading) => heading.closest("section"));
    expect(officialResultsSection).not.toBeNull();
    expect(
      rowWithTextIn(officialResultsSection as HTMLElement, "Seed #1 vs Clasificado directo"),
    ).toBeInTheDocument();
    expect(within(officialResultsSection as HTMLElement).queryByText("BYE")).not.toBeInTheDocument();
  });

  it("creates a pool from the admin panel", async () => {
    storeSession();
    const createdPool = {
      ...pool,
      id: "created-pool-id",
      name: "Nueva oficina",
      entry_fee_cents: 7500000,
    };
    let created = false;
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const value = String(url);
      if (value.endsWith("/api/v1/pools") && init?.method === "POST") {
        created = true;
        return jsonResponse({ data: createdPool });
      }
      if (value.endsWith("/api/v1/pools")) {
        return jsonResponse({ data: created ? [pool, createdPool] : [pool] });
      }
      if (value.endsWith("/api/v1/pools/created-pool-id")) {
        return jsonResponse({ data: createdPool });
      }
      if (value.includes("/api/v1/pools/created-pool-id/")) {
        return adminFetch(value.replace("/created-pool-id/", "/pool-id/"), init);
      }
      return adminFetch(url, init);
    });
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    await screen.findByRole("heading", { name: "Oficina FC" });
    const createPoolSection = screen.getByRole("heading", { name: "Crear polla" }).closest("section");
    expect(createPoolSection).not.toBeNull();
    fireEvent.change(within(createPoolSection as HTMLElement).getByLabelText("Nombre"), {
      target: { value: "Nueva oficina" },
    });
    fireEvent.change(within(createPoolSection as HTMLElement).getByLabelText("Entrada"), {
      target: { value: "75000" },
    });
    fireEvent.change(within(createPoolSection as HTMLElement).getByLabelText("Descripcion"), {
      target: { value: "Polla nueva" },
    });
    fireEvent.click(within(createPoolSection as HTMLElement).getByRole("button", { name: "Crear polla" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Polla creada.");
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/pools",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          tournament_slug: "fifa-world-cup-2026",
          name: "Nueva oficina",
          description: "Polla nueva",
          entry_fee_cents: 7500000,
          currency: "COP",
          prediction_close_hours_before: 6,
          theme: {},
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      }),
    );
    expect(screen.getByLabelText("Polla")).toHaveValue("created-pool-id");
  });

  it("rejects malformed bracket slots before generating a bracket", async () => {
    storeSession();
    const fetcher = vi.fn(adminFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    await screen.findByRole("heading", { name: "Oficina FC" });
    fireEvent.change(screen.getByLabelText("Slots"), {
      target: { value: "ranking_top_n,league-top,1,Seed #1\nranking_top_n,league-top,x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generar bracket" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Revisa la configuracion del bracket.");
    });
    expect(fetcher).not.toHaveBeenCalledWith(
      "/api/v1/tournaments/fifa-world-cup-2026/brackets/generate",
      expect.anything(),
    );
  });

  it("keeps global tournament brackets read-only for pool admins without superadmin role", async () => {
    storeSession({ user: { role: "participant" } });
    const fetcher = vi.fn(adminFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    const bracketsSection = (await screen.findByRole("heading", { name: "Brackets" })).closest(
      "section",
    );
    expect(bracketsSection).not.toBeNull();
    expect(within(bracketsSection as HTMLElement).getByText("Solo lectura")).toBeInTheDocument();
    expect(
      within(bracketsSection as HTMLElement).getByRole("button", { name: "Generar bracket" }),
    ).toBeDisabled();
  });

  it("updates generated bracket match slots manually", async () => {
    storeSession();
    const fetcher = vi.fn(adminFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    await screen.findByRole("heading", { name: "Oficina FC" });
    fireEvent.click(screen.getByRole("button", { name: "Generar bracket" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Bracket generado.");
    });

    const bracketsSection = screen.getByRole("heading", { name: "Brackets" }).closest("section");
    expect(bracketsSection).not.toBeNull();
    const generatedRow = within(bracketsSection as HTMLElement)
      .getByText("generated-match-id")
      .closest("tr");
    expect(generatedRow).not.toBeNull();

    const selects = within(generatedRow as HTMLElement).getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "team-mexico" } });
    fireEvent.change(selects[1], { target: { value: "team-canada" } });
    fireEvent.change(within(generatedRow as HTMLElement).getByPlaceholderText("Motivo del ajuste"), {
      target: { value: "correccion manual de semifinales" },
    });
    fireEvent.click(within(generatedRow as HTMLElement).getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Cruce actualizado.");
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/tournaments/fifa-world-cup-2026/matches/generated-match-id/slots",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          home_team_id: "team-mexico",
          away_team_id: "team-canada",
          reason: "correccion manual de semifinales",
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      }),
    );
  });

  it("generates bye slots for a non power of two qualifier count", async () => {
    storeSession();
    const fetcher = vi.fn(adminFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    await screen.findByRole("heading", { name: "Oficina FC" });
    fireEvent.change(screen.getByLabelText("Clasificados"), {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Completar con byes" }));
    fireEvent.click(screen.getByRole("button", { name: "Generar bracket" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Bracket generado.");
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/tournaments/fifa-world-cup-2026/brackets/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          stage_id: "custom-knockout",
          stage_name: "Ronda eliminatoria",
          match_id_prefix: "custom-knockout-match",
          match_number_start: 4,
          slots: [
            { type: "ranking_top_n", source_id: "league-top", rank: 1, label: "Seed #1" },
            { type: "bye", source_id: "bye-2", rank: 2, label: "BYE" },
            { type: "ranking_top_n", source_id: "league-top", rank: 4, label: "Seed #4" },
            { type: "ranking_top_n", source_id: "league-top", rank: 5, label: "Seed #5" },
            { type: "ranking_top_n", source_id: "league-top", rank: 2, label: "Seed #2" },
            { type: "bye", source_id: "bye-1", rank: 1, label: "BYE" },
            { type: "ranking_top_n", source_id: "league-top", rank: 3, label: "Seed #3" },
            { type: "ranking_top_n", source_id: "league-top", rank: 6, label: "Seed #6" },
          ],
          from_stage_id: "group-stage",
          from_stage_name: "Fase de grupos",
          rule_id_prefix: "league-top",
          rule_priority_start: 1,
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
    const resultsSection = screen
      .getByRole("heading", { name: "Resultados oficiales" })
      .closest("section");
    expect(resultsSection).not.toBeNull();
    const existingResultRow = rowWithTextIn(
      resultsSection as HTMLElement,
      "Estados Unidos vs Panama",
    );
    fireEvent.change(within(existingResultRow).getByLabelText("Goles Estados Unidos"), {
      target: { value: "3" },
    });
    fireEvent.change(within(existingResultRow).getByLabelText("Goles Panama"), {
      target: { value: "0" },
    });

    const matchRow = rowWithTextIn(resultsSection as HTMLElement, "Mexico vs Canada");
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
      "/api/v1/pools/pool-id/match-results/match-id",
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
      "/api/v1/pools/pool-id/match-results/match-id/audit-logs",
      expect.objectContaining({
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      }),
    );
  });

  it("generates closed prediction snapshots from the admin results panel", async () => {
    storeSession();
    const fetcher = vi.fn(adminFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    const resultsSection = (await screen.findByRole("heading", {
      name: "Resultados oficiales",
    })).closest("section");
    expect(resultsSection).not.toBeNull();
    const matchRow = rowWithTextIn(resultsSection as HTMLElement, "Mexico vs Canada");

    fireEvent.click(within(matchRow).getByRole("button", { name: "Generar snapshot" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Snapshot de pronosticos generado.",
      );
    });
    expect(within(matchRow).getByText("2 participantes")).toBeInTheDocument();
    expect(within(matchRow).getByText("Checksum abcdef1234")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/pools/pool-id/matches/match-id/prediction-snapshot",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      }),
    );
  });

  it("updates tournament tiebreakers from the admin panel", async () => {
    storeSession();
    const fetcher = vi.fn(adminFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    const tiebreakersSection = await screen
      .findByRole("heading", { name: "Desempates del torneo" })
      .then((heading) => heading.closest("section"));
    expect(tiebreakersSection).not.toBeNull();

    fireEvent.click(
      within(tiebreakersSection as HTMLElement).getAllByRole("button", { name: "Bajar" })[0],
    );
    fireEvent.click(
      within(tiebreakersSection as HTMLElement).getByLabelText(/Goles en contra/),
    );
    fireEvent.click(
      within(tiebreakersSection as HTMLElement).getByRole("button", {
        name: "Guardar desempates",
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Desempates del torneo actualizados.");
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/tournaments/fifa-world-cup-2026/tiebreakers",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          tiebreakers: ["goal_difference", "points", "goals_for", "goals_against"],
        }),
      }),
    );
  });

  it("updates official standings and loads their audit log", async () => {
    storeSession();
    const fetcher = vi.fn(adminFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    expect(await screen.findByRole("heading", { name: "Posiciones oficiales" })).toBeInTheDocument();
    const standingsSection = screen
      .getByRole("heading", { name: "Posiciones oficiales" })
      .closest("section");
    expect(standingsSection).not.toBeNull();

    fireEvent.change(
      within(standingsSection as HTMLElement).getByLabelText("Posicion oficial de Mexico"),
      { target: { value: "2" } },
    );
    fireEvent.change(
      within(standingsSection as HTMLElement).getByLabelText("Posicion oficial de Canada"),
      { target: { value: "1" } },
    );
    fireEvent.change(
      within(standingsSection as HTMLElement).getByLabelText("Motivo o fuente oficial"),
      { target: { value: "Tabla oficial Concacaf" } },
    );
    fireEvent.click(
      within(standingsSection as HTMLElement).getByRole("button", {
        name: "Guardar posiciones",
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Posiciones oficiales actualizadas.");
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/pools/pool-id/official-standings",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          stage_id: "group-stage",
          group_id: "group-a",
          reason: "Tabla oficial Concacaf",
          standings: [
            { team_id: "team-mexico", position: 2 },
            { team_id: "team-canada", position: 1 },
          ],
        }),
      }),
    );

    fireEvent.click(
      within(standingsSection as HTMLElement).getByRole("button", {
        name: "Ver auditoria",
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Historial reciente")).toBeInTheDocument();
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/pools/pool-id/official-standings/audit-logs?stage_id=group-stage&group_id=group-a",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("rejects official standings with skipped positions", async () => {
    storeSession();
    const fetcher = vi.fn(adminFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    const standingsSection = await screen
      .findByRole("heading", { name: "Posiciones oficiales" })
      .then((heading) => heading.closest("section"));
    expect(standingsSection).not.toBeNull();

    fireEvent.change(
      within(standingsSection as HTMLElement).getByLabelText("Posicion oficial de Mexico"),
      { target: { value: "1" } },
    );
    fireEvent.change(
      within(standingsSection as HTMLElement).getByLabelText("Posicion oficial de Canada"),
      { target: { value: "3" } },
    );
    fireEvent.change(
      within(standingsSection as HTMLElement).getByLabelText("Motivo o fuente oficial"),
      { target: { value: "Tabla oficial FIFA" } },
    );
    fireEvent.click(
      within(standingsSection as HTMLElement).getByRole("button", {
        name: "Guardar posiciones",
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Revisa que todas las posiciones oficiales esten completas y sin repetir.",
    );
    expect(fetcher).not.toHaveBeenCalledWith(
      "/api/v1/pools/pool-id/official-standings",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("builds official standing scopes for league stages without configured groups", async () => {
    storeSession();
    const leagueTournament = {
      ...tournament,
      groups: [],
      matches: [
        {
          ...tournament.matches[0],
          stage_id: "league-stage",
          stage_name: "League Stage",
          stage_type: "league",
          group_id: "",
          group_name: "",
        },
      ],
    };
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const value = String(url);
      if (value.endsWith("/api/v1/tournaments/fifa-world-cup-2026")) {
        return jsonResponse({ data: leagueTournament });
      }
      return adminFetch(url, init);
    });
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    const standingsSection = await screen
      .findByRole("heading", { name: "Posiciones oficiales" })
      .then((heading) => heading.closest("section"));
    expect(standingsSection).not.toBeNull();
    expect(within(standingsSection as HTMLElement).getByText("League Stage")).toBeInTheDocument();

    fireEvent.change(
      within(standingsSection as HTMLElement).getByLabelText("Motivo o fuente oficial"),
      { target: { value: "Tabla final liga" } },
    );
    fireEvent.click(
      within(standingsSection as HTMLElement).getByRole("button", {
        name: "Guardar posiciones",
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Posiciones oficiales actualizadas.");
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/pools/pool-id/official-standings",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          stage_id: "league-stage",
          reason: "Tabla final liga",
          standings: [
            { team_id: "team-canada", position: 1 },
            { team_id: "team-mexico", position: 2 },
          ],
        }),
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
      "/api/v1/pools/pool-id/prize-rules",
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
      "/api/v1/pools/pool-id/prediction-settings",
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

  it("updates prediction settings overrides by stage", async () => {
    storeSession();
    const fetcher = vi.fn(adminFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    expect(
      await screen.findByRole("heading", { name: "Overrides de pronostico" }),
    ).toBeInTheDocument();
    const overridesSection = screen
      .getByRole("heading", { name: "Overrides de pronostico" })
      .closest("section");
    expect(overridesSection).not.toBeNull();
    const stageRow = within(overridesSection as HTMLElement)
      .getAllByRole("row")
      .find((row) => within(row).queryByText("Fase de grupos"));
    expect(stageRow).toBeTruthy();
    const placementRow = within(overridesSection as HTMLElement)
      .getAllByRole("row")
      .find((row) => within(row).queryByText("Third place"));
    expect(placementRow).toBeTruthy();
    expect(within(placementRow as HTMLElement).queryByText("Final")).not.toBeInTheDocument();

    fireEvent.change(within(stageRow as HTMLElement).getByLabelText("Modo Fase de grupos"), {
      target: { value: "outcome" },
    });
    fireEvent.change(within(stageRow as HTMLElement).getByLabelText("Puntaje Fase de grupos"), {
      target: { value: "cumulative" },
    });
    fireEvent.change(within(stageRow as HTMLElement).getByLabelText("Bonus Fase de grupos"), {
      target: { value: "enabled" },
    });
    fireEvent.change(
      within(stageRow as HTMLElement).getByLabelText("Puntos bonus Fase de grupos"),
      {
        target: { value: "7" },
      },
    );
    fireEvent.click(
      within(overridesSection as HTMLElement).getByRole("button", {
        name: "Guardar overrides",
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Overrides de pronosticos actualizados.",
      );
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/pools/pool-id/prediction-settings-overrides",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          overrides: [
            {
              scope_type: "match",
              match_id: "match-result-id",
              prediction_mode: "outcome",
              underdog_bonus_enabled: true,
              underdog_bonus_points: 4,
            },
            {
              scope_type: "stage",
              stage_id: "group-stage",
              prediction_mode: "outcome",
              match_result_scoring_mode: "cumulative",
              underdog_bonus_enabled: true,
              underdog_bonus_points: 7,
            },
          ],
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      }),
    );
  });

  it("updates global prediction settings and official global results", async () => {
    storeSession();
    const fetcher = vi.fn(adminFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    expect(await screen.findByRole("heading", { name: "Predicciones globales" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Puntos plantilla Valla menos vencida"), {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar plantilla Valla menos vencida" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Plantilla del catalogo guardada.");
    });

    fireEvent.change(screen.getByLabelText("Plantilla"), {
      target: { value: "global_best_defense" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    fireEvent.click(screen.getByRole("button", { name: "Nueva custom" }));
    expect(screen.getAllByDisplayValue("Valla menos vencida").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Nueva prediccion")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Puntos de Campeon"), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByLabelText("Premio especial Total amarillas por rango"));
    fireEvent.change(screen.getByLabelText("Valor de premio de Total amarillas por rango"), {
      target: { value: "25000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar predicciones globales" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Predicciones globales actualizadas.",
      );
    });

    fireEvent.change(screen.getByLabelText("Resultado oficial Campeon"), {
      target: { value: "team-canada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar resultado Campeon" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Resultado global actualizado.");
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/pools/pool-id/global-prediction-definitions",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          definitions: [
            {
              code: "global_champion",
              label: "Campeon",
              value_type: "team",
              enabled: true,
              points_enabled: true,
              prize_enabled: true,
              prize_type: "percentage",
              prize_fixed_amount_cents: 0,
              prize_percentage: 10,
              prize_share_policy: "split_equal",
              points: 12,
              sort_order: 1,
              closes_at: "2020-06-11T00:00:00.000Z",
            },
            {
              code: "global_yellow_cards_range",
              label: "Total amarillas por rango",
              value_type: "number_range",
              enabled: true,
              points_enabled: true,
              prize_enabled: true,
              prize_type: "fixed",
              prize_fixed_amount_cents: 2500000,
              prize_percentage: 0,
              prize_share_policy: "split_equal",
              points: 5,
              sort_order: 2,
              closes_at: null,
            },
            {
              code: "global_top_scorer",
              label: "Goleador",
              value_type: "player",
              enabled: true,
              points_enabled: true,
              prize_enabled: false,
              prize_type: "none",
              prize_fixed_amount_cents: 0,
              prize_percentage: 0,
              prize_share_policy: "split_equal",
              points: 4,
              sort_order: 3,
              closes_at: "2020-06-11T00:00:00.000Z",
            },
            {
              code: "global_best_defense",
              label: "Valla menos vencida",
              value_type: "team",
              enabled: true,
              points_enabled: true,
              prize_enabled: false,
              prize_type: "none",
              prize_fixed_amount_cents: 0,
              prize_percentage: 0,
              prize_share_policy: "split_equal",
              points: 6,
              sort_order: 65,
              closes_at: null,
            },
            {
              code: "custom_global_1",
              label: "Nueva prediccion",
              value_type: "text",
              enabled: true,
              points_enabled: true,
              prize_enabled: false,
              prize_type: "none",
              prize_fixed_amount_cents: 0,
              prize_percentage: 0,
              prize_share_policy: "split_equal",
              points: 0,
              sort_order: 75,
              closes_at: null,
            },
          ],
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      }),
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/pools/pool-id/global-prediction-templates/global_best_defense",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          label: "Valla menos vencida",
          value_type: "team",
          sport: "football",
          category: "teams",
          resolution_mode: "manual",
          enabled: true,
          points_enabled: true,
          prize_enabled: false,
          points: 6,
          sort_order: 65,
          default_enabled: false,
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      }),
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/pools/pool-id/global-results/global_champion",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          value_text: "team-canada",
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      }),
    );
  }, 10000);

  it("saves a boolean official global result", async () => {
    storeSession();
    const booleanDefinition = {
      id: "global-definition-extra-time",
      pool_id: "pool-id",
      code: "custom_final_extra_time",
      label: "Final con alargue",
      value_type: "boolean",
      enabled: true,
      points_enabled: true,
      prize_enabled: false,
      prize_type: "none",
      prize_fixed_amount_cents: 0,
      prize_percentage: 0,
      prize_share_policy: "split_equal",
      points: 2,
      sort_order: 1,
      closes_at: "2020-06-11T00:00:00Z",
      created_at: "2026-05-27T01:00:00Z",
      updated_at: "2026-05-27T01:00:00Z",
    };
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const value = String(url);
      if (value.endsWith("/api/v1/pools/pool-id/global-prediction-definitions")) {
        return jsonResponse({ data: [booleanDefinition] });
      }
      if (value.endsWith("/api/v1/pools/pool-id/global-results")) {
        return jsonResponse({ data: [] });
      }
      if (
        value.endsWith("/api/v1/pools/pool-id/global-results/custom_final_extra_time") &&
        init?.method === "PUT"
      ) {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        return jsonResponse({
          data: {
            id: "global-result-extra-time",
            pool_id: "pool-id",
            definition_id: "global-definition-extra-time",
            code: "custom_final_extra_time",
            value_type: "boolean",
            value_text: "",
            value_number: body.value_number,
            range_min: null,
            range_max: null,
            recorded_by: "admin-id",
            recorded_at: "2026-07-20T01:00:00Z",
            created_at: "2026-07-20T01:00:00Z",
            updated_at: "2026-07-20T01:00:00Z",
          },
        });
      }
      return adminFetch(url, init);
    });
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    expect(await screen.findByRole("heading", { name: "Predicciones globales" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Resultado oficial Final con alargue"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar resultado Final con alargue" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Resultado global actualizado.");
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/pools/pool-id/global-results/custom_final_extra_time",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          value_number: 1,
        }),
      }),
    );
    expect(screen.getAllByText("Si").length).toBeGreaterThan(0);
  });

  it("keeps saved global definition state when refreshing global prize preview fails", async () => {
    storeSession();
    let globalPrizePreviewRequests = 0;
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const value = String(url);
      if (value.endsWith("/api/v1/pools/pool-id/global-prizes/preview")) {
        globalPrizePreviewRequests += 1;
        if (globalPrizePreviewRequests === 1) {
          return jsonResponse({ data: globalPrizePreview });
        }
        return jsonResponse({ code: "internal_error" }, { status: 500 });
      }
      return adminFetch(url, init);
    });
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    expect(await screen.findByRole("heading", { name: "Predicciones globales" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Puntos de Campeon"), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar predicciones globales" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Predicciones globales actualizadas.",
      );
    });
    expect(screen.getByDisplayValue("12")).toBeInTheDocument();
  });

  it("updates pool visual identity from the admin panel", async () => {
    storeSession();
    const fetcher = vi.fn(adminFetch);
    vi.stubGlobal("fetch", fetcher);

    render(<AdminHome />);

    expect(await screen.findByRole("heading", { name: "Identidad visual" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nombre visible"), {
      target: { value: "Mundialistas" },
    });
    fireEvent.change(screen.getByLabelText("Logo URL"), {
      target: { value: "https://cdn.example.com/new-logo.png" },
    });
    fireEvent.change(screen.getByLabelText("Banner URL"), {
      target: { value: "/assets/new-banner.png" },
    });
    fireEvent.change(screen.getByLabelText("Mascota URL"), {
      target: { value: "https://cdn.example.com/mascot.png" },
    });
    fireEvent.change(screen.getByLabelText("Color principal"), {
      target: { value: "#007A3D" },
    });
    fireEvent.change(screen.getByLabelText("Color secundario"), {
      target: { value: "#101828" },
    });
    fireEvent.change(screen.getByLabelText("Color acento"), {
      target: { value: "#C8A45D" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar identidad" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Identidad visual actualizada.");
    });
    expect(screen.getAllByText("Mundialistas").length).toBeGreaterThan(0);

    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/pools/pool-id/theme",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          display_name: "Mundialistas",
          logo_url: "https://cdn.example.com/new-logo.png",
          banner_url: "/assets/new-banner.png",
          mascot_url: "https://cdn.example.com/mascot.png",
          primary_color: "#007A3D",
          secondary_color: "#101828",
          accent_color: "#C8A45D",
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      }),
    );
  }, 10000);

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
      "/api/v1/pools/pool-id/prize-rules",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("renders a read-only state when the selected pool cannot manage payments", async () => {
    storeSession();
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      const value = String(url);
      if (value.endsWith("/api/v1/tournaments")) {
        return jsonResponse({ data: [tournamentSummary] });
      }
      if (value.endsWith("/api/v1/tournaments/fifa-world-cup-2026")) {
        return jsonResponse({ data: tournament });
      }
      if (value.endsWith("/api/v1/pools")) {
        return jsonResponse({
          data: [{ ...pool, current_user_role: "participant", permissions: readOnlyPermissions }],
        });
      }
      if (value.endsWith("/api/v1/pools/pool-id")) {
        return jsonResponse({
          data: { ...pool, current_user_role: "participant", permissions: readOnlyPermissions },
        });
      }
      if (value.endsWith("/api/v1/pools/pool-id/predictions/statuses")) {
        return jsonResponse({ data: predictionStatuses });
      }
      if (value.endsWith("/api/v1/pools/pool-id/scoring-rules")) {
        return jsonResponse({ data: scoringRules });
      }
      if (value.endsWith("/api/v1/pools/pool-id/underdog-bonuses")) {
        return jsonResponse({ data: underdogBonuses });
      }
      if (value.endsWith("/api/v1/pools/pool-id/global-prediction-definitions")) {
        return jsonResponse({ data: globalPredictionDefinitions });
      }
      if (value.endsWith("/api/v1/pools/pool-id/global-results")) {
        return jsonResponse({ data: globalPredictionResults });
      }
      if (value.endsWith("/api/v1/pools/pool-id/prizes/preview")) {
        return jsonResponse({ data: prizePreview });
      }
      if (value.endsWith("/api/v1/pools/pool-id/ranking")) {
        return jsonResponse({ data: [] });
      }
      if (value.endsWith("/api/v1/pools/pool-id/global-prizes/preview")) {
        return jsonResponse({ data: globalPrizePreview });
      }
      return jsonResponse({ data: [] });
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
      "/api/v1/pools/pool-id/payments",
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

function storeSession(
  overrides: Partial<Omit<typeof session, "user">> & {
    user?: Partial<typeof session.user>;
  } = {},
) {
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
  const expected = compactText(text);
  const row = screen
    .getAllByRole("row")
    .find((item) => rowContainsText(item, text, expected));
  if (!row) {
    throw new Error(`Row with ${text} not found`);
  }
  return row;
}

function rowWithTextIn(container: HTMLElement, text: string) {
  const expected = compactText(text);
  const row = within(container)
    .getAllByRole("row")
    .find((item) => rowContainsText(item, text, expected));
  if (!row) {
    throw new Error(`Row with ${text} not found`);
  }
  return row;
}

function normalizedText(element: HTMLElement) {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

function compactText(value: string) {
  return value.replace(/\s+/g, "");
}

function rowContainsText(row: HTMLElement, text: string, compactExpected: string) {
  const parts = text.split(" vs ");
  if (parts.length === 2) {
    return (
      within(row).queryAllByText(parts[0]).length > 0 &&
      within(row).queryAllByText(parts[1]).length > 0
    );
  }
  return compactText(normalizedText(row)).includes(compactExpected);
}

function expectAdminNavigationTargetsToExist(navigation: HTMLElement) {
  for (const link of within(navigation).getAllByRole("link")) {
    const href = link.getAttribute("href");
    const target = href ? document.querySelector(href) : null;
    expect(target).not.toBeNull();
  }
}

async function adminFetch(url: RequestInfo | URL, init?: RequestInit) {
  const value = String(url);
  if (value.endsWith("/api/v1/tournaments")) {
    return jsonResponse({ data: [tournamentSummary] });
  }
  if (value.endsWith("/api/v1/tournaments/fifa-world-cup-2026")) {
    return jsonResponse({ data: tournament });
  }
  if (value.endsWith("/api/v1/tournaments/fifa-world-cup-2026/brackets/generate")) {
    const body = JSON.parse(String(init?.body));
    return jsonResponse({
      data: {
        matches: [
          {
            id: "generated-match-id",
            tournament_id: "fifa-world-cup-2026",
            stage_id: body.stage_id,
            stage_name: body.stage_name,
            stage_type: "knockout",
            stage_round_size: body.slots.length,
            group_id: "",
            group_name: "",
            match_number: body.match_number_start,
            home_slot: body.slots[0].label,
            away_slot: body.slots[1].label,
            home_slot_config: body.slots[0],
            away_slot_config: body.slots[1],
            starts_at: "0001-01-01T00:00:00Z",
            venue: "",
            status: "scheduled",
          },
        ],
        advancement_rules: [],
      },
    });
  }
  if (
    value.endsWith("/api/v1/tournaments/fifa-world-cup-2026/matches/generated-match-id/slots") &&
    init?.method === "PUT"
  ) {
    const body = JSON.parse(String(init.body)) as {
      home_team_id?: string;
      away_team_id?: string;
      reason: string;
    };
    return jsonResponse({
      data: {
        ...tournament,
        matches: [
          ...tournament.matches,
          {
            id: "generated-match-id",
            tournament_id: "fifa-world-cup-2026",
            stage_id: "custom-knockout",
            stage_name: "Ronda eliminatoria",
            stage_type: "knockout",
            stage_round_size: 2,
            group_id: "",
            group_name: "",
            match_number: 4,
            home_team:
              body.home_team_id === "team-mexico"
                ? { id: "team-mexico", name: "Mexico", short_name: "MEX", country_code: "MEX" }
                : null,
            away_team:
              body.away_team_id === "team-canada"
                ? { id: "team-canada", name: "Canada", short_name: "CAN", country_code: "CAN" }
                : null,
            home_slot: "Seed #1",
            away_slot: "Seed #2",
            home_slot_config: {
              type: "ranking_top_n",
              source_id: "league-top",
              rank: 1,
              label: "Seed #1",
            },
            away_slot_config: {
              type: "ranking_top_n",
              source_id: "league-top",
              rank: 2,
              label: "Seed #2",
            },
            starts_at: "0001-01-01T00:00:00Z",
            venue: "",
            status: "scheduled",
          },
        ],
      },
    });
  }
  if (value.endsWith("/api/v1/pools") && init?.method === "POST") {
    const body = JSON.parse(String(init.body)) as { name: string; entry_fee_cents: number };
    return jsonResponse({
      data: {
        ...pool,
        id: "created-pool-id",
        name: body.name,
        entry_fee_cents: body.entry_fee_cents,
      },
    });
  }
  if (value.endsWith("/api/v1/pools")) {
    return jsonResponse({ data: [pool] });
  }
  if (value.endsWith("/api/v1/pools/pool-id/predictions/statuses")) {
    return jsonResponse({ data: predictionStatuses });
  }
  if (
    value.endsWith("/api/v1/pools/pool-id/matches/match-id/prediction-snapshot") &&
    init?.method === "POST"
  ) {
    return jsonResponse({ data: predictionSnapshot });
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
  if (value.endsWith("/api/v1/pools/pool-id/payments.csv") && init?.method === "GET") {
    return new Response("pool_id,user_id\npool-id,admin-id\n", {
      status: 200,
      headers: { "Content-Type": "text/csv" },
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
  if (value.endsWith("/api/v1/pools/pool-id/scoring-rules") && init?.method === "PUT") {
    const body = JSON.parse(String(init.body)) as { rules: typeof scoringRules };
    return jsonResponse({ data: body.rules });
  }
  if (value.endsWith("/api/v1/pools/pool-id/scoring-rules")) {
    return jsonResponse({ data: scoringRules });
  }
  if (
    value.endsWith("/api/v1/pools/pool-id/prediction-settings-overrides") &&
    init?.method === "PUT"
  ) {
    const body = JSON.parse(String(init.body)) as {
      overrides: Array<{
        scope_type: "stage" | "match";
        stage_id?: string;
        match_id?: string;
        prediction_mode?: string;
        match_result_scoring_mode?: string;
        underdog_bonus_enabled?: boolean;
        underdog_bonus_points?: number;
      }>;
    };
    return jsonResponse({
      data: body.overrides.map((override, index) => ({
        id: `override-${index + 1}`,
        pool_id: "pool-id",
        scope_type: override.scope_type,
        stage_id: override.stage_id ?? "",
        match_id: override.match_id ?? "",
        prediction_mode: override.prediction_mode ?? null,
        match_result_scoring_mode: override.match_result_scoring_mode ?? null,
        underdog_bonus_enabled: override.underdog_bonus_enabled ?? null,
        underdog_bonus_points: override.underdog_bonus_points ?? null,
        created_at: "2026-06-01T12:00:00Z",
        updated_at: "2026-06-01T13:00:00Z",
      })),
    });
  }
  if (value.endsWith("/api/v1/pools/pool-id/prediction-settings-overrides")) {
    return jsonResponse({ data: predictionSettingsOverrides });
  }
  if (value.endsWith("/api/v1/pools/pool-id/match-prediction-settings")) {
    return jsonResponse({ data: effectiveMatchPredictionSettings });
  }
  if (
    value.endsWith("/api/v1/pools/pool-id/global-prediction-templates/global_best_defense") &&
    init?.method === "PUT"
  ) {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    return jsonResponse({
      data: {
        ...globalPredictionTemplates[0],
        label: body.label,
        value_type: body.value_type,
        sport: body.sport,
        category: body.category,
        resolution_mode: body.resolution_mode,
        enabled: body.enabled,
        points_enabled: body.points_enabled,
        prize_enabled: body.prize_enabled,
        points: body.points,
        sort_order: body.sort_order,
        default_enabled: body.default_enabled,
        updated_at: "2026-06-11T13:00:00Z",
      },
    });
  }
  if (
    value.includes("/api/v1/pools/pool-id/global-prediction-templates/catalog_template_") &&
    init?.method === "PUT"
  ) {
    const code = value.split("/").pop() ?? "catalog_template_1";
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    return jsonResponse({
      data: {
        id: `template-${code}`,
        code,
        label: body.label,
        value_type: body.value_type,
        sport: body.sport,
        category: body.category,
        resolution_mode: body.resolution_mode,
        enabled: body.enabled,
        points_enabled: body.points_enabled,
        prize_enabled: body.prize_enabled,
        points: body.points,
        sort_order: body.sort_order,
        default_enabled: body.default_enabled,
        created_at: "2026-06-11T13:00:00Z",
        updated_at: "2026-06-11T13:00:00Z",
      },
    });
  }
  if (value.endsWith("/api/v1/pools/pool-id/global-prediction-templates")) {
    return jsonResponse({ data: globalPredictionTemplates });
  }
  if (
    value.endsWith("/api/v1/pools/pool-id/global-prediction-definitions") &&
    init?.method === "PUT"
  ) {
    const body = JSON.parse(String(init.body)) as {
      definitions: Array<(typeof globalPredictionDefinitions)[number]>;
    };
    return jsonResponse({
      data: body.definitions.map((definition, index) => ({
        ...globalPredictionDefinitions[index],
        ...definition,
        id: globalPredictionDefinitions[index]?.id ?? `global-definition-${index + 1}`,
        pool_id: "pool-id",
        created_at: "2026-05-27T01:00:00Z",
        updated_at: "2026-05-27T02:00:00Z",
      })),
    });
  }
  if (value.endsWith("/api/v1/pools/pool-id/global-prediction-definitions")) {
    return jsonResponse({ data: globalPredictionDefinitions });
  }
  if (
    value.endsWith("/api/v1/pools/pool-id/global-results/global_champion") &&
    init?.method === "PUT"
  ) {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    return jsonResponse({
      data: {
        ...globalPredictionResults[0],
        value_text: body.value_text ?? "",
        value_number: body.value_number ?? null,
        range_min: body.range_min ?? null,
        range_max: body.range_max ?? null,
        recorded_at: "2026-07-20T02:00:00Z",
        updated_at: "2026-07-20T02:00:00Z",
      },
    });
  }
  if (
    value.endsWith("/api/v1/pools/pool-id/global-results/global_top_scorer/answers") &&
    init?.method === "GET"
  ) {
    return jsonResponse({ data: globalPredictionAnswerSummary });
  }
  if (
    value.endsWith("/api/v1/pools/pool-id/global-results/global_top_scorer/aliases") &&
    init?.method === "PUT"
  ) {
    const body = JSON.parse(String(init.body)) as { alias_values: string[] };
    const aliases = new Set(body.alias_values);
    return jsonResponse({
      data: {
        ...globalPredictionAnswerSummary,
        answers: globalPredictionAnswerSummary.answers.map((answer) => ({
          ...answer,
          approved:
            answer.normalized_value === globalPredictionAnswerSummary.result_normalized_value ||
            aliases.has(answer.value_text),
        })),
      },
    });
  }
  if (value.endsWith("/api/v1/pools/pool-id/global-results")) {
    return jsonResponse({ data: globalPredictionResults });
  }
  if (value.endsWith("/api/v1/pools/pool-id/underdog-bonuses/match-id") && init?.method === "PUT") {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    return jsonResponse({
      data: {
        ...underdogBonuses[0],
        enabled: body.enabled,
        outcome: body.outcome,
        home_probability: body.home_probability,
        draw_probability: body.draw_probability,
        away_probability: body.away_probability,
      },
    });
  }
  if (value.endsWith("/api/v1/pools/pool-id/underdog-bonuses")) {
    return jsonResponse({ data: underdogBonuses });
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
  if (value.endsWith("/api/v1/pools/pool-id/theme") && init?.method === "PUT") {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    return jsonResponse({
      data: {
        ...pool,
        theme: {
          ...pool.theme,
          display_name: body.display_name,
          logo_url: body.logo_url,
          banner_url: body.banner_url,
          mascot_url: body.mascot_url,
          primary_color: body.primary_color,
          secondary_color: body.secondary_color,
          accent_color: body.accent_color,
        },
      },
    });
  }
  if (value.endsWith("/api/v1/pools/pool-id/prizes/preview") && init?.method === "GET") {
    return jsonResponse({ data: prizePreview });
  }
  if (value.endsWith("/api/v1/pools/pool-id/global-prizes/preview") && init?.method === "GET") {
    return jsonResponse({ data: globalPrizePreview });
  }
  if (value.endsWith("/api/v1/pools/pool-id/ranking-tiebreakers") && init?.method === "GET") {
    return jsonResponse({ data: [] });
  }
  if (
    value.endsWith("/api/v1/tournaments/fifa-world-cup-2026/tiebreakers") &&
    init?.method === "PUT"
  ) {
    const body = JSON.parse(String(init.body)) as { tiebreakers: typeof tournament.tiebreakers };
    return jsonResponse({
      data: {
        ...tournament,
        tiebreakers: body.tiebreakers,
      },
    });
  }
  if (value.endsWith("/api/v1/pools/pool-id/official-standings") && init?.method === "GET") {
    return jsonResponse({ data: officialStandings });
  }
  if (value.endsWith("/api/v1/pools/pool-id/official-standings") && init?.method === "PUT") {
    const body = JSON.parse(String(init.body)) as {
      stage_id: string;
      group_id: string;
      reason: string;
      standings: Array<{ team_id: string; position: number }>;
    };
    const teamsByID = new Map(tournament.groups.flatMap((group) => group.teams).map((team) => [team.id, team]));
    return jsonResponse({
      data: body.standings.map((standing) => ({
        pool_id: "pool-id",
        tournament_id: "fifa-world-cup-2026",
        stage_id: body.stage_id,
        group_id: body.group_id,
        team: teamsByID.get(standing.team_id),
        position: standing.position,
        reason: body.reason,
        updated_by: "admin-id",
        updated_at: "2026-06-03T22:00:00Z",
      })),
    });
  }
  if (
    value.endsWith(
      "/api/v1/pools/pool-id/official-standings/audit-logs?stage_id=group-stage&group_id=group-a",
    ) &&
    init?.method === "GET"
  ) {
    return jsonResponse({ data: [officialStandingAuditLog] });
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
