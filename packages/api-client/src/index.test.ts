import { describe, expect, it, vi } from "vitest";
import {
  PollavarAPIError,
  createPollavarClient,
  serializeAuthSession,
  type AuthResult,
  type PointEventDetail,
  type Pool,
  type PredictionMatchStatus,
  type PredictionSnapshot,
  type PredictionSummary,
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
      predicted_at: "2026-06-11T12:00:00Z",
      updated_at: "2026-06-11T12:30:00Z",
    },
  ],
};

const scoringRules: ScoringRule[] = [
  { code: "exact_score", points: 5, enabled: true },
  { code: "match_result", points: 3, enabled: true },
];

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
      home_score: 2,
      away_score: 1,
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
