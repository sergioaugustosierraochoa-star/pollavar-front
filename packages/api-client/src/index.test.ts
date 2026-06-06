import { describe, expect, it, vi } from "vitest";
import {
  PollavarAPIError,
  createPollavarClient,
  serializeAuthSession,
  type AuthResult,
  type GlobalPrediction,
  type GlobalPredictionAnswerSummary,
  type GlobalPredictionDefinition,
  type GlobalPredictionPrizePreview,
  type GlobalPredictionResult,
  type GlobalPredictionTemplate,
  type MatchResultAuditLog,
  type MatchUnderdogBonus,
  type Payment,
  type PaymentCollection,
  type PointEventDetail,
  type Pool,
  type EffectiveMatchPredictionSettings,
  type PredictionSettingsOverride,
  type PredictionMatchStatus,
  type PredictionSnapshot,
  type PredictionSummary,
  type PrizePreview,
  type PrizeRule,
  type RankingEntry,
  type ScoringRule,
  type StandingPrediction,
  type Tournament,
  type TournamentSummary,
} from "./index";

const authResult: AuthResult = {
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
};

const tournamentSummary: TournamentSummary = {
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
  group_count: 12,
  team_count: 48,
};

const tournament: Tournament = {
  ...tournamentSummary,
  groups: [],
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
      home_team: { id: "MEX", name: "Mexico", short_name: "MEX", country_code: "MEX" },
      away_team: {
        id: "RSA",
        name: "South Africa",
        short_name: "RSA",
        country_code: "ZAF",
      },
      home_slot: "MEX",
      away_slot: "RSA",
      starts_at: "2026-06-11T19:00:00Z",
      venue: "Mexico City Stadium",
      status: "scheduled",
    },
  ],
};

const pool: Pool = {
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
  created_by: "user-id",
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
  participants: [],
};

const predictionSummary: PredictionSummary = {
  total_matches: 72,
  predicted_matches: 18,
  missing_matches: 54,
  open_matches: 60,
  closed_matches: 12,
  scored_matches: 0,
};

const predictionStatus: PredictionMatchStatus = {
  match_id: "match-id",
  prediction_id: "prediction-id",
  status: "scored",
  has_prediction: true,
  closed: true,
  has_official_result: true,
  scored: true,
  points: 5,
  official_result: {
    match_id: "match-id",
    home_score: 2,
    away_score: 1,
    result_status: "final",
    recorded_at: "2026-06-11T22:00:00Z",
  },
};

const matchResult = {
  pool_id: "pool-id",
  match_id: "match-id",
  home_score: 2,
  away_score: 1,
  result_status: "final",
  recorded_at: "2026-06-11T22:00:00Z",
};

const matchResultAuditLog: MatchResultAuditLog = {
  id: "audit-id",
  pool_id: "pool-id",
  match_id: "match-id",
  actor_user_id: "admin-id",
  action: "match_result_updated",
  previous: {
    home_score: 1,
    away_score: 1,
    result_status: "final",
  },
  current: {
    home_score: 2,
    away_score: 1,
    result_status: "final",
  },
  created_at: "2026-06-11T22:30:00Z",
};

const predictionSnapshot: PredictionSnapshot = {
  id: "snapshot-id",
  pool_id: "pool-id",
  match_id: "match-id",
  generated_at: "2026-06-11T22:00:00Z",
  row_count: 1,
  checksum: "checksum",
  entries: [
    {
      id: "entry-id",
      snapshot_id: "snapshot-id",
      prediction_id: "prediction-id",
      user_id: "user-id",
      participant_name: "Participante",
      has_prediction: true,
      home_score: 2,
      away_score: 1,
      outcome: "home",
      predicted_at: "2026-06-11T12:00:00Z",
      updated_at: "2026-06-11T12:30:00Z",
    },
  ],
};

const scoringRules: ScoringRule[] = [
  { code: "exact_score", points: 5, enabled: true },
  { code: "score_difference", points: 2, enabled: true },
  { code: "match_result", points: 3, enabled: true },
  { code: "group_position_exact", points: 2, enabled: true },
  { code: "underdog_bonus", points: 2, enabled: false },
];

const matchUnderdogBonus: MatchUnderdogBonus = {
  id: "bonus-id",
  pool_id: "pool-id",
  match_id: "match-id",
  enabled: true,
  outcome: "away",
  source: "manual",
  home_probability: 70.5,
  draw_probability: 20,
  away_probability: 9.5,
  locked_at: null,
  created_at: "2026-06-11T12:00:00Z",
  updated_at: "2026-06-11T12:30:00Z",
};

const predictionSettingsOverride: PredictionSettingsOverride = {
  id: "override-id",
  pool_id: "pool-id",
  scope_type: "stage",
  stage_id: "stage-id",
  match_id: "",
  prediction_mode: "outcome",
  match_result_scoring_mode: "cumulative",
  underdog_bonus_enabled: true,
  underdog_bonus_points: 5,
  created_at: "2026-06-11T12:00:00Z",
  updated_at: "2026-06-11T12:30:00Z",
};

const effectiveMatchPredictionSettings: EffectiveMatchPredictionSettings = {
  pool_id: "pool-id",
  match_id: "match-id",
  stage_id: "stage-id",
  prediction_mode: "outcome",
  match_result_scoring_mode: "cumulative",
  underdog_bonus_enabled: true,
  underdog_bonus_points: 5,
  prediction_mode_source: "stage",
  match_result_scoring_mode_source: "stage",
  underdog_bonus_enabled_source: "stage",
  underdog_bonus_points_source: "stage",
};

const rankingEntry: RankingEntry = {
  position: 1,
  user_id: "user-id",
  user_name: "Admin",
  username: "admin",
  points: 8,
  event_count: 2,
  payment_status: "confirmed",
  prize_eligible: true,
  participant: {
    id: "participant-id",
    pool_id: "pool-id",
    user_id: "user-id",
    user_name: "Admin",
    username: "admin",
    role: "participant",
    payment_status: "confirmed",
    prize_eligible: true,
    joined_at: "2026-05-27T01:00:00Z",
  },
};

const pointEventDetail: PointEventDetail = {
  pool_id: "pool-id",
  user_id: "user-id",
  prediction_id: "prediction-id",
  standing_prediction_id: "",
  global_prediction_id: "",
  match_id: "match-id",
  match_number: 1,
  rule_code: "exact_score",
  points: 5,
  explanation: "Marcador exacto",
  created_at: "2026-06-11T22:00:00Z",
};

const standingPrediction: StandingPrediction = {
  id: "standing-id",
  pool_id: "pool-id",
  user_id: "user-id",
  group_id: "group-a",
  team_ids: ["MEX", "RSA"],
  created_at: "2026-06-11T12:00:00Z",
  updated_at: "2026-06-11T12:30:00Z",
};

const globalPredictionDefinition: GlobalPredictionDefinition = {
  id: "definition-id",
  pool_id: "pool-id",
  code: "global_champion",
  label: "Campeon",
  value_type: "team",
  enabled: true,
  points_enabled: true,
  prize_enabled: false,
  prize_type: "none",
  prize_fixed_amount_cents: 0,
  prize_percentage: 0,
  prize_share_policy: "split_equal",
  points: 10,
  sort_order: 10,
  closes_at: null,
  created_at: "2026-06-11T12:00:00Z",
  updated_at: "2026-06-11T12:30:00Z",
};

const globalPredictionTemplate: GlobalPredictionTemplate = {
  id: "template-id",
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
};

const globalPrediction: GlobalPrediction = {
  id: "global-prediction-id",
  pool_id: "pool-id",
  user_id: "user-id",
  definition_id: "definition-id",
  code: "global_champion",
  value_type: "team",
  value_text: "Colombia",
  value_number: null,
  range_min: null,
  range_max: null,
  created_at: "2026-06-11T12:00:00Z",
  updated_at: "2026-06-11T12:30:00Z",
};

const globalPredictionResult: GlobalPredictionResult = {
  id: "global-result-id",
  pool_id: "pool-id",
  definition_id: "definition-id",
  code: "global_champion",
  value_type: "team",
  value_text: "Colombia",
  value_number: null,
  range_min: null,
  range_max: null,
  recorded_by: "admin-id",
  recorded_at: "2026-07-20T23:00:00Z",
  created_at: "2026-07-20T23:00:00Z",
  updated_at: "2026-07-20T23:00:00Z",
};

const globalPredictionAnswerSummary: GlobalPredictionAnswerSummary = {
  pool_id: "pool-id",
  definition_id: "definition-id",
  code: "global_top_scorer",
  label: "Goleador",
  value_type: "player",
  result_recorded: true,
  result_value_text: "Kylian Mbappe",
  result_normalized_value: "kylianmbappe",
  answers: [
    {
      value_text: "Mbappe",
      normalized_value: "mbappe",
      prediction_count: 2,
      approved: true,
      alias_id: "alias-id",
      target_value_text: "Kylian Mbappe",
      target_normalized_value: "kylianmbappe",
      updated_by: "admin-id",
      updated_at: "2026-07-20T23:10:00Z",
    },
  ],
};

const payment: Payment = {
  id: "payment-id",
  pool_id: "pool-id",
  user_id: "user-id",
  amount_cents: 5000000,
  currency: "COP",
  payment_method: "bank_transfer",
  status: "confirmed",
  reference: "TRX-123",
  confirmed_by: "admin-id",
  confirmed_at: "2026-05-27T01:00:00Z",
  created_at: "2026-05-27T01:00:00Z",
  updated_at: "2026-05-27T01:00:00Z",
};

const paymentCollection: PaymentCollection = {
  pool_id: "pool-id",
  currency: "COP",
  confirmed_total_cents: 5000000,
  payments: [payment],
};

const prizeRules: PrizeRule[] = [
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

const prizePreview: PrizePreview = {
  pool_id: "pool-id",
  currency: "COP",
  confirmed_total_cents: 10000000,
  rules: prizeRules,
  payouts: [
    {
      position: 1,
      percentage: 70,
      estimated_amount_cents: 7000000,
      description: "Primero",
    },
    {
      position: 2,
      percentage: 30,
      estimated_amount_cents: 3000000,
      description: "Segundo",
    },
  ],
};

const globalPrizePreview: GlobalPredictionPrizePreview = {
  pool_id: "pool-id",
  currency: "COP",
  confirmed_total_cents: 10000000,
  prizes: [
    {
      definition_id: "definition-id",
      code: "global_champion",
      label: "Campeon",
      prize_type: "percentage",
      prize_fixed_amount_cents: 0,
      prize_percentage: 10,
      prize_share_policy: "split_equal",
      estimated_total_cents: 1000000,
      result_recorded: true,
      winner_count: 1,
      winners: [
        {
          user_id: "user-id",
          user_name: "Admin",
          username: "admin",
          prediction_id: "global-prediction-id",
          estimated_amount_cents: 1000000,
        },
      ],
    },
  ],
};

describe("createPollavarClient", () => {
  it("registers a user against the configured API URL", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ data: authResult }, { status: 201 }),
    );
    const client = createPollavarClient({
      baseURL: "http://api.local/",
      fetcher,
    });

    const result = await client.register({
      name: "Admin",
      username: "admin",
      email: "admin@example.com",
      password: "supersecret",
    });

    expect(result).toEqual(authResult);
    expect(fetcher).toHaveBeenCalledWith(
      "http://api.local/api/v1/auth/register",
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
  });

  it("logs in using the default API URL from the environment", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://env-api.local");
    const fetcher = vi.fn(async () => jsonResponse({ data: authResult }));
    vi.stubGlobal("fetch", fetcher);
    const client = createPollavarClient();

    const result = await client.login({
      identifier: "admin@example.com",
      password: "supersecret",
    });

    expect(result.token).toBe("token");
    expect(fetcher).toHaveBeenCalledWith(
      "http://env-api.local/api/v1/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          identifier: "admin@example.com",
          password: "supersecret",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses localhost when the environment URL is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const fetcher = vi.fn(async () => jsonResponse({ data: authResult }));
    vi.stubGlobal("fetch", fetcher);
    const client = createPollavarClient();

    await client.login({
      identifier: "admin",
      password: "supersecret",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("loads the authenticated profile with a bearer token", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ data: authResult.user }),
    );
    const client = createPollavarClient({
      baseURL: "http://api.local",
      fetcher,
    });

    const user = await client.me("token");

    expect(user.username).toBe("admin");
    expect(fetcher).toHaveBeenCalledWith("http://api.local/api/v1/auth/me", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      },
    });
  });

  it("loads tournament resources", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith("/api/v1/tournaments")) {
        return jsonResponse({ data: [tournamentSummary] });
      }
      return jsonResponse({ data: tournament });
    });
    const client = createPollavarClient({
      baseURL: "http://api.local/",
      fetcher,
    });

    await expect(client.listTournaments()).resolves.toEqual([tournamentSummary]);
    await expect(client.getTournament("fifa world cup")).resolves.toEqual(tournament);

    expect(fetcher).toHaveBeenNthCalledWith(1, "http://api.local/api/v1/tournaments", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://api.local/api/v1/tournaments/fifa%20world%20cup",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  });

  it("loads pool and prediction resources with bearer auth", async () => {
    const prediction = {
      id: "prediction-id",
      pool_id: "pool-id",
      user_id: "user-id",
      match_id: "match-id",
      has_score: true,
      home_score: 2,
      away_score: 1,
      outcome: "home",
      created_at: "2026-06-11T12:00:00Z",
      updated_at: "2026-06-11T12:30:00Z",
    };
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const value = String(url);
      if (value.endsWith("/api/v1/pools")) {
        return jsonResponse({ data: [pool] });
      }
      if (value.endsWith("/summary")) {
        return jsonResponse({ data: predictionSummary });
      }
      if (value.endsWith("/statuses")) {
        return jsonResponse({ data: [predictionStatus] });
      }
      if (value.endsWith("/prediction-snapshot.csv")) {
        return new Response("snapshot_id,pool_id\nsnapshot-id,pool-id\n", {
          status: 200,
          headers: { "Content-Type": "text/csv" },
        });
      }
      if (value.endsWith("/prediction-snapshot")) {
        return jsonResponse({ data: predictionSnapshot });
      }
      if (value.endsWith("/ranking")) {
        return jsonResponse({ data: [rankingEntry] });
      }
      if (value.endsWith("/ranking/user%20id/points")) {
        return jsonResponse({ data: [pointEventDetail] });
      }
      if (value.endsWith("/scoring-rules") && init?.method === "PUT") {
        return jsonResponse({ data: scoringRules });
      }
      if (value.endsWith("/scoring-rules")) {
        return jsonResponse({ data: scoringRules });
      }
      if (value.endsWith("/prediction-settings") && init?.method === "PUT") {
        return jsonResponse({
          data: {
            ...pool,
            prediction_mode: "outcome",
            match_result_scoring_mode: "cumulative",
          },
        });
      }
      if (value.endsWith("/prediction-settings-overrides") && init?.method === "PUT") {
        return jsonResponse({ data: [predictionSettingsOverride] });
      }
      if (value.endsWith("/prediction-settings-overrides")) {
        return jsonResponse({ data: [predictionSettingsOverride] });
      }
      if (value.endsWith("/match-prediction-settings")) {
        return jsonResponse({ data: [effectiveMatchPredictionSettings] });
      }
      if (value.endsWith("/theme") && init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        return jsonResponse({ data: { ...pool, theme: { ...pool.theme, ...body } } });
      }
      if (value.endsWith("/standing-predictions")) {
        return jsonResponse({ data: [standingPrediction] });
      }
      if (init?.method === "PUT" && value.includes("/standing-predictions/")) {
        return jsonResponse({ data: standingPrediction });
      }
      if (init?.method === "PUT") {
        return jsonResponse({ data: prediction });
      }
      if (value.endsWith("/predictions")) {
        return jsonResponse({ data: [prediction] });
      }
      return jsonResponse({ data: pool });
    });
    const client = createPollavarClient({
      baseURL: "http://api.local",
      fetcher,
    });

    await expect(client.listPools("token")).resolves.toEqual([pool]);
    await expect(client.getPool("token", "pool id")).resolves.toEqual(pool);
    await expect(client.listPredictions("token", "pool id")).resolves.toEqual([
      prediction,
    ]);
    await expect(client.getPredictionSummary("token", "pool id")).resolves.toEqual(
      predictionSummary,
    );
    await expect(client.listPredictionStatuses("token", "pool id")).resolves.toEqual([
      predictionStatus,
    ]);
    await expect(client.getPredictionSnapshot("token", "pool id", "match id")).resolves.toEqual(
      predictionSnapshot,
    );
    await expect(
      client.downloadPredictionSnapshotCSV("token", "pool id", "match id"),
    ).resolves.toContain("snapshot-id");
    await expect(client.listRanking("token", "pool id")).resolves.toEqual([
      rankingEntry,
    ]);
    await expect(client.listPointDetails("token", "pool id", "user id")).resolves.toEqual([
      pointEventDetail,
    ]);
    await expect(client.listScoringRules("token", "pool id")).resolves.toEqual(
      scoringRules,
    );
    await expect(
      client.updateScoringRules("token", "pool id", {
        rules: [
          { code: "exact_score", points: 5, enabled: true },
          { code: "match_result", points: 3, enabled: true },
        ],
      }),
    ).resolves.toEqual(scoringRules);
    await expect(
      client.savePrediction("token", "pool id", "match id", {
        home_score: 2,
        away_score: 1,
      }),
    ).resolves.toEqual(prediction);
    await expect(client.listStandingPredictions("token", "pool id")).resolves.toEqual([
      standingPrediction,
    ]);
    await expect(
      client.saveStandingPrediction("token", "pool id", "group a", {
        team_ids: ["MEX", "RSA"],
      }),
    ).resolves.toEqual(standingPrediction);
    await expect(
      client.updatePredictionSettings("token", "pool id", {
        prediction_mode: "outcome",
        match_result_scoring_mode: "cumulative",
      }),
    ).resolves.toMatchObject({
      prediction_mode: "outcome",
      match_result_scoring_mode: "cumulative",
    });
    await expect(
      client.listPredictionSettingsOverrides("token", "pool id"),
    ).resolves.toEqual([predictionSettingsOverride]);
    await expect(
      client.updatePredictionSettingsOverrides("token", "pool id", {
        overrides: [
          {
            scope_type: "stage",
            stage_id: "stage-id",
            prediction_mode: "outcome",
            match_result_scoring_mode: "cumulative",
            underdog_bonus_enabled: true,
            underdog_bonus_points: 5,
          },
        ],
      }),
    ).resolves.toEqual([predictionSettingsOverride]);
    await expect(
      client.listEffectiveMatchPredictionSettings("token", "pool id"),
    ).resolves.toEqual([effectiveMatchPredictionSettings]);
    await expect(
      client.updatePoolTheme("token", "pool id", {
        display_name: "Mundialistas",
        logo_url: "https://cdn.example.com/logo.png",
        banner_url: "/assets/banner.png",
        mascot_url: "",
        primary_color: "#007A3D",
        secondary_color: "#101828",
        accent_color: "#C8A45D",
      }),
    ).resolves.toMatchObject({
      theme: {
        display_name: "Mundialistas",
        primary_color: "#007A3D",
      },
    });

    expect(fetcher).toHaveBeenNthCalledWith(2, "http://api.local/api/v1/pools/pool%20id", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      },
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      5,
      "http://api.local/api/v1/pools/pool%20id/predictions/statuses",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      6,
      "http://api.local/api/v1/pools/pool%20id/matches/match%20id/prediction-snapshot",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      7,
      "http://api.local/api/v1/pools/pool%20id/matches/match%20id/prediction-snapshot.csv",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      8,
      "http://api.local/api/v1/pools/pool%20id/ranking",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      9,
      "http://api.local/api/v1/pools/pool%20id/ranking/user%20id/points",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      10,
      "http://api.local/api/v1/pools/pool%20id/scoring-rules",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      11,
      "http://api.local/api/v1/pools/pool%20id/scoring-rules",
      {
        method: "PUT",
        body: JSON.stringify({
          rules: [
            { code: "exact_score", points: 5, enabled: true },
            { code: "match_result", points: 3, enabled: true },
          ],
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      12,
      "http://api.local/api/v1/pools/pool%20id/predictions/match%20id",
      {
        method: "PUT",
        body: JSON.stringify({ home_score: 2, away_score: 1 }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      14,
      "http://api.local/api/v1/pools/pool%20id/standing-predictions/group%20a",
      {
        method: "PUT",
        body: JSON.stringify({ team_ids: ["MEX", "RSA"] }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenCalledWith(
      "http://api.local/api/v1/pools/pool%20id/prediction-settings",
      {
        method: "PUT",
        body: JSON.stringify({
          prediction_mode: "outcome",
          match_result_scoring_mode: "cumulative",
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenCalledWith(
      "http://api.local/api/v1/pools/pool%20id/prediction-settings-overrides",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenCalledWith(
      "http://api.local/api/v1/pools/pool%20id/prediction-settings-overrides",
      {
        method: "PUT",
        body: JSON.stringify({
          overrides: [
            {
              scope_type: "stage",
              stage_id: "stage-id",
              prediction_mode: "outcome",
              match_result_scoring_mode: "cumulative",
              underdog_bonus_enabled: true,
              underdog_bonus_points: 5,
            },
          ],
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenCalledWith(
      "http://api.local/api/v1/pools/pool%20id/match-prediction-settings",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenCalledWith("http://api.local/api/v1/pools/pool%20id/theme", {
      method: "PUT",
      body: JSON.stringify({
        display_name: "Mundialistas",
        logo_url: "https://cdn.example.com/logo.png",
        banner_url: "/assets/banner.png",
        mascot_url: "",
        primary_color: "#007A3D",
        secondary_color: "#101828",
        accent_color: "#C8A45D",
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      },
    });
  });

  it("loads and saves global prediction resources", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const value = String(url);
      if (value.endsWith("/global-prediction-templates") && init?.method === "GET") {
        return jsonResponse({ data: [globalPredictionTemplate] });
      }
      if (
        value.endsWith("/global-prediction-templates/global_best_defense") &&
        init?.method === "PUT"
      ) {
        return jsonResponse({ data: globalPredictionTemplate });
      }
      if (value.endsWith("/global-prediction-definitions") && init?.method === "GET") {
        return jsonResponse({ data: [globalPredictionDefinition] });
      }
      if (value.endsWith("/global-prediction-definitions") && init?.method === "PUT") {
        return jsonResponse({ data: [globalPredictionDefinition] });
      }
      if (value.endsWith("/global-predictions") && init?.method === "GET") {
        return jsonResponse({ data: [globalPrediction] });
      }
      if (value.endsWith("/global-predictions/global_champion") && init?.method === "PUT") {
        return jsonResponse({ data: globalPrediction });
      }
      if (value.endsWith("/global-results") && init?.method === "GET") {
        return jsonResponse({ data: [globalPredictionResult] });
      }
      if (value.endsWith("/global-results/global_champion") && init?.method === "PUT") {
        return jsonResponse({ data: globalPredictionResult });
      }
      if (value.endsWith("/global-results/global_top_scorer/answers") && init?.method === "GET") {
        return jsonResponse({ data: globalPredictionAnswerSummary });
      }
      if (value.endsWith("/global-results/global_top_scorer/aliases") && init?.method === "PUT") {
        return jsonResponse({ data: globalPredictionAnswerSummary });
      }
      if (value.endsWith("/global-prizes/preview") && init?.method === "GET") {
        return jsonResponse({ data: globalPrizePreview });
      }
      return jsonResponse({ code: "not_found" }, { status: 404 });
    });
    const client = createPollavarClient({
      baseURL: "http://api.local",
      fetcher,
    });

    await expect(client.listGlobalPredictionTemplates("token", "pool id")).resolves.toEqual([
      globalPredictionTemplate,
    ]);
    await expect(
      client.saveGlobalPredictionTemplate("token", "pool id", "global_best_defense", {
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
      }),
    ).resolves.toEqual(globalPredictionTemplate);
    await expect(client.listGlobalPredictionDefinitions("token", "pool id")).resolves.toEqual([
      globalPredictionDefinition,
    ]);
    await expect(
      client.updateGlobalPredictionDefinitions("token", "pool id", {
        definitions: [
          {
            code: "global_champion",
            label: "Campeon",
            value_type: "team",
            enabled: true,
            points_enabled: true,
            prize_enabled: true,
            prize_type: "fixed",
            prize_fixed_amount_cents: 50000,
            prize_percentage: 0,
            prize_share_policy: "split_equal",
            points: 10,
            sort_order: 10,
            closes_at: null,
          },
        ],
      }),
    ).resolves.toEqual([globalPredictionDefinition]);
    await expect(client.listGlobalPredictions("token", "pool id")).resolves.toEqual([
      globalPrediction,
    ]);
    await expect(
      client.saveGlobalPrediction("token", "pool id", "global_champion", {
        value_text: "Colombia",
      }),
    ).resolves.toEqual(globalPrediction);
    await expect(client.listGlobalPredictionResults("token", "pool id")).resolves.toEqual([
      globalPredictionResult,
    ]);
    await expect(
      client.saveGlobalPredictionResult("token", "pool id", "global_champion", {
        value_text: "Colombia",
      }),
    ).resolves.toEqual(globalPredictionResult);
    await expect(
      client.getGlobalPredictionAnswerSummary("token", "pool id", "global_top_scorer"),
    ).resolves.toEqual(globalPredictionAnswerSummary);
    await expect(
      client.updateGlobalPredictionAliases("token", "pool id", "global_top_scorer", {
        alias_values: ["Mbappe"],
      }),
    ).resolves.toEqual(globalPredictionAnswerSummary);
    await expect(client.getGlobalPredictionPrizePreview("token", "pool id")).resolves.toEqual(
      globalPrizePreview,
    );

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://api.local/api/v1/pools/pool%20id/global-prediction-templates",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://api.local/api/v1/pools/pool%20id/global-prediction-templates/global_best_defense",
      {
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
          points: 4,
          sort_order: 65,
          default_enabled: false,
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "http://api.local/api/v1/pools/pool%20id/global-prediction-definitions",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      "http://api.local/api/v1/pools/pool%20id/global-prediction-definitions",
      {
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
              prize_type: "fixed",
              prize_fixed_amount_cents: 50000,
              prize_percentage: 0,
              prize_share_policy: "split_equal",
              points: 10,
              sort_order: 10,
              closes_at: null,
            },
          ],
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      5,
      "http://api.local/api/v1/pools/pool%20id/global-predictions",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      6,
      "http://api.local/api/v1/pools/pool%20id/global-predictions/global_champion",
      {
        method: "PUT",
        body: JSON.stringify({ value_text: "Colombia" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      7,
      "http://api.local/api/v1/pools/pool%20id/global-results",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      8,
      "http://api.local/api/v1/pools/pool%20id/global-results/global_champion",
      {
        method: "PUT",
        body: JSON.stringify({ value_text: "Colombia" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      9,
      "http://api.local/api/v1/pools/pool%20id/global-results/global_top_scorer/answers",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      10,
      "http://api.local/api/v1/pools/pool%20id/global-results/global_top_scorer/aliases",
      {
        method: "PUT",
        body: JSON.stringify({ alias_values: ["Mbappe"] }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      11,
      "http://api.local/api/v1/pools/pool%20id/global-prizes/preview",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
  });

  it("saves match results and loads audit logs", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const value = String(url);
      if (value.endsWith("/match-results/match%20id") && init?.method === "PUT") {
        return jsonResponse({ data: matchResult });
      }
      if (value.endsWith("/match-results/match%20id/audit-logs") && init?.method === "GET") {
        return jsonResponse({ data: [matchResultAuditLog] });
      }
      return jsonResponse({ code: "not_found" }, { status: 404 });
    });
    const client = createPollavarClient({
      baseURL: "http://api.local",
      fetcher,
    });

    await expect(
      client.saveMatchResult("token", "pool id", "match id", {
        home_score: 2,
        away_score: 1,
        result_status: "final",
      }),
    ).resolves.toEqual(matchResult);
    await expect(
      client.listMatchResultAuditLogs("token", "pool id", "match id"),
    ).resolves.toEqual([matchResultAuditLog]);

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://api.local/api/v1/pools/pool%20id/match-results/match%20id",
      {
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
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://api.local/api/v1/pools/pool%20id/match-results/match%20id/audit-logs",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
  });

  it("loads and saves match underdog bonuses", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const value = String(url);
      if (value.endsWith("/underdog-bonuses") && init?.method === "GET") {
        return jsonResponse({ data: [matchUnderdogBonus] });
      }
      if (value.endsWith("/underdog-bonuses/match%20id") && init?.method === "PUT") {
        return jsonResponse({ data: matchUnderdogBonus });
      }
      return jsonResponse({ code: "not_found" }, { status: 404 });
    });
    const client = createPollavarClient({
      baseURL: "http://api.local",
      fetcher,
    });

    await expect(client.listMatchUnderdogBonuses("token", "pool id")).resolves.toEqual([
      matchUnderdogBonus,
    ]);
    await expect(
      client.saveMatchUnderdogBonus("token", "pool id", "match id", {
        enabled: true,
        outcome: "away",
        home_probability: 70.5,
        draw_probability: 20,
        away_probability: 9.5,
      }),
    ).resolves.toEqual(matchUnderdogBonus);

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://api.local/api/v1/pools/pool%20id/underdog-bonuses",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://api.local/api/v1/pools/pool%20id/underdog-bonuses/match%20id",
      {
        method: "PUT",
        body: JSON.stringify({
          enabled: true,
          outcome: "away",
          home_probability: 70.5,
          draw_probability: 20,
          away_probability: 9.5,
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
  });

  it("loads and updates manual pool payments", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const value = String(url);
      if (value.endsWith("/payments") && init?.method === "GET") {
        return jsonResponse({ data: paymentCollection });
      }
      if (value.endsWith("/payments/user%20id") && init?.method === "PUT") {
        return jsonResponse({ data: payment });
      }
      return jsonResponse({ code: "not_found" }, { status: 404 });
    });
    const client = createPollavarClient({
      baseURL: "http://api.local",
      fetcher,
    });

    await expect(client.listPayments("token", "pool id")).resolves.toEqual(
      paymentCollection,
    );
    await expect(
      client.upsertPayment("token", "pool id", "user id", {
        amount_cents: 5000000,
        currency: "COP",
        payment_method: "bank_transfer",
        reference: "TRX-123",
        status: "confirmed",
      }),
    ).resolves.toEqual(payment);

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://api.local/api/v1/pools/pool%20id/payments",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://api.local/api/v1/pools/pool%20id/payments/user%20id",
      {
        method: "PUT",
        body: JSON.stringify({
          amount_cents: 5000000,
          currency: "COP",
          payment_method: "bank_transfer",
          reference: "TRX-123",
          status: "confirmed",
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
  });

  it("loads, updates and previews pool prizes", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const value = String(url);
      if (value.endsWith("/prize-rules") && init?.method === "GET") {
        return jsonResponse({ data: prizeRules });
      }
      if (value.endsWith("/prize-rules") && init?.method === "PUT") {
        return jsonResponse({ data: prizeRules });
      }
      if (value.endsWith("/prizes/preview") && init?.method === "GET") {
        return jsonResponse({ data: prizePreview });
      }
      return jsonResponse({ code: "not_found" }, { status: 404 });
    });
    const client = createPollavarClient({
      baseURL: "http://api.local",
      fetcher,
    });

    await expect(client.listPrizeRules("token", "pool id")).resolves.toEqual(
      prizeRules,
    );
    await expect(
      client.updatePrizeRules("token", "pool id", {
        rules: [
          { position: 1, percentage: 70, description: "Primero" },
          { position: 2, percentage: 30, description: "Segundo" },
        ],
      }),
    ).resolves.toEqual(prizeRules);
    await expect(client.getPrizePreview("token", "pool id")).resolves.toEqual(
      prizePreview,
    );

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://api.local/api/v1/pools/pool%20id/prize-rules",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://api.local/api/v1/pools/pool%20id/prize-rules",
      {
        method: "PUT",
        body: JSON.stringify({
          rules: [
            { position: 1, percentage: 70, description: "Primero" },
            { position: 2, percentage: 30, description: "Segundo" },
          ],
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "http://api.local/api/v1/pools/pool%20id/prizes/preview",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    );
  });

  it("throws API errors with backend codes", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ code: "invalid_credentials" }, { status: 401 }),
    );
    const client = createPollavarClient({
      baseURL: "http://api.local",
      fetcher,
    });

    await expect(
      client.login({ identifier: "admin", password: "wrongpass" }),
    ).rejects.toMatchObject({
      name: "PollavarAPIError",
      status: 401,
      code: "invalid_credentials",
    });
  });

  it("uses an unknown code when an error response has no backend code", async () => {
    const fetcher = vi.fn(async () => jsonResponse({}, { status: 500 }));
    const client = createPollavarClient({
      baseURL: "http://api.local",
      fetcher,
    });

    await expect(
      client.login({ identifier: "admin", password: "wrongpass" }),
    ).rejects.toEqual(new PollavarAPIError(500, "unknown_error"));
  });

  it("uses an unknown code when an error response is not JSON", async () => {
    const fetcher = vi.fn(async () =>
      new Response("404 page not found\n", {
        status: 404,
        headers: {
          "Content-Type": "text/plain",
        },
      }),
    );
    const client = createPollavarClient({
      baseURL: "http://api.local",
      fetcher,
    });

    await expect(client.listPredictionStatuses("token", "pool id")).rejects.toEqual(
      new PollavarAPIError(404, "unknown_error"),
    );
  });
});

describe("serializeAuthSession", () => {
  it("serializes the token, expiration and user", () => {
    expect(JSON.parse(serializeAuthSession(authResult))).toEqual({
      token: "token",
      expiresAt: "2026-05-28T01:00:00Z",
      user: authResult.user,
    });
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
