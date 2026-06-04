export type AuthUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  created_at: string;
};

export type AuthResult = {
  user: AuthUser;
  token: string;
  expires_at: string;
};

export type RegisterInput = {
  name: string;
  username: string;
  email: string;
  password: string;
};

export type LoginInput = {
  identifier: string;
  password: string;
};

export type TournamentSummary = {
  id: string;
  name: string;
  slug: string;
  sport: string;
  format_code: string;
  starts_at: string;
  ends_at: string;
  group_count: number;
  team_count: number;
};

export type Team = {
  id: string;
  name: string;
  short_name: string;
  country_code: string;
};

export type Match = {
  id: string;
  tournament_id: string;
  stage_id: string;
  group_id: string;
  group_name: string;
  match_number: number;
  home_team?: Team | null;
  away_team?: Team | null;
  home_slot: string;
  away_slot: string;
  starts_at: string;
  venue: string;
  status: string;
};

export type Tournament = TournamentSummary & {
  groups: Array<{
    id: string;
    name: string;
    teams: Team[];
  }>;
  matches: Match[];
};

export type PoolTheme = {
  id: string;
  pool_id: string;
  display_name: string;
  logo_url: string;
  banner_url: string;
  mascot_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  created_at: string;
  updated_at: string;
};

export type PoolParticipant = {
  id: string;
  pool_id: string;
  user_id: string;
  user_name: string;
  username: string;
  role: string;
  payment_status: string;
  prize_eligible: boolean;
  joined_at: string;
};

export type Pool = {
  id: string;
  tournament_id: string;
  name: string;
  description: string;
  invite_code: string;
  entry_fee_cents: number;
  currency: string;
  collection_responsible_user_id: string;
  prediction_close_hours_before: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  current_user_role: string;
  theme: PoolTheme;
  participants: PoolParticipant[];
};

export type Prediction = {
  id: string;
  pool_id: string;
  user_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  created_at: string;
  updated_at: string;
};

export type PredictionSummary = {
  total_matches: number;
  predicted_matches: number;
  missing_matches: number;
  open_matches: number;
  closed_matches: number;
  scored_matches: number;
};

export type ScoringRuleCode = "exact_score" | "match_result";

export type ScoringRule = {
  code: ScoringRuleCode;
  points: number;
  enabled: boolean;
};

export type SaveScoringRuleInput = {
  code: ScoringRuleCode;
  points: number;
  enabled?: boolean;
};

export type UpdateScoringRulesInput = {
  rules: SaveScoringRuleInput[];
};

export type PredictionMatchStatusCode =
  | "pending"
  | "complete"
  | "closed"
  | "official_result"
  | "scored";

export type MatchResult = {
  match_id: string;
  home_score: number;
  away_score: number;
  result_status: string;
  recorded_at: string;
};

export type PredictionMatchStatus = {
  match_id: string;
  prediction_id: string;
  status: PredictionMatchStatusCode;
  has_prediction: boolean;
  closed: boolean;
  has_official_result: boolean;
  scored: boolean;
  points: number;
  official_result?: MatchResult | null;
};

export type RankingEntry = {
  position: number;
  user_id: string;
  user_name: string;
  username: string;
  points: number;
  event_count: number;
  payment_status: string;
  prize_eligible: boolean;
  participant: PoolParticipant;
};

export type PointEventDetail = {
  pool_id: string;
  user_id: string;
  prediction_id: string;
  match_id: string;
  match_number: number;
  rule_code: ScoringRuleCode;
  points: number;
  explanation: string;
  created_at: string;
};

export type StandingPrediction = {
  id: string;
  pool_id: string;
  user_id: string;
  group_id: string;
  team_ids: string[];
  created_at: string;
  updated_at: string;
};

export type SavePredictionInput = {
  home_score: number;
  away_score: number;
};

export type SaveStandingPredictionInput = {
  team_ids: string[];
};

export type PollavarClientOptions = {
  baseURL?: string;
  fetcher?: typeof fetch;
};

type DataEnvelope<T> = {
  data: T;
};

type ErrorEnvelope = {
  code?: string;
};

export class PollavarAPIError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "PollavarAPIError";
    this.status = status;
    this.code = code;
  }
}

export function createPollavarClient(options: PollavarClientOptions = {}) {
  const baseURL = normalizeBaseURL(options.baseURL ?? defaultAPIURL());
  const fetcher = options.fetcher ?? fetch;

  return {
    register(input: RegisterInput) {
      return request<AuthResult>(fetcher, `${baseURL}/api/v1/auth/register`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    login(input: LoginInput) {
      return request<AuthResult>(fetcher, `${baseURL}/api/v1/auth/login`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    me(token: string) {
      return request<AuthUser>(fetcher, `${baseURL}/api/v1/auth/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },
    listTournaments() {
      return request<TournamentSummary[]>(fetcher, `${baseURL}/api/v1/tournaments`, {
        method: "GET",
      });
    },
    getTournament(slug: string) {
      return request<Tournament>(
        fetcher,
        `${baseURL}/api/v1/tournaments/${encodeURIComponent(slug)}`,
        {
          method: "GET",
        },
      );
    },
    listPools(token: string) {
      return request<Pool[]>(fetcher, `${baseURL}/api/v1/pools`, {
        method: "GET",
        headers: authHeaders(token),
      });
    },
    getPool(token: string, poolID: string) {
      return request<Pool>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    listPredictions(token: string, poolID: string) {
      return request<Prediction[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/predictions`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    getPredictionSummary(token: string, poolID: string) {
      return request<PredictionSummary>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/predictions/summary`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    listPredictionStatuses(token: string, poolID: string) {
      return request<PredictionMatchStatus[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/predictions/statuses`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    listRanking(token: string, poolID: string) {
      return request<RankingEntry[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/ranking`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    listPointDetails(token: string, poolID: string, userID: string) {
      return request<PointEventDetail[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/ranking/${encodeURIComponent(userID)}/points`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    listScoringRules(token: string, poolID: string) {
      return request<ScoringRule[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/scoring-rules`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    updateScoringRules(token: string, poolID: string, input: UpdateScoringRulesInput) {
      return request<ScoringRule[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/scoring-rules`,
        {
          method: "PUT",
          body: JSON.stringify(input),
          headers: authHeaders(token),
        },
      );
    },
    savePrediction(token: string, poolID: string, matchID: string, input: SavePredictionInput) {
      return request<Prediction>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/predictions/${encodeURIComponent(matchID)}`,
        {
          method: "PUT",
          body: JSON.stringify(input),
          headers: authHeaders(token),
        },
      );
    },
    listStandingPredictions(token: string, poolID: string) {
      return request<StandingPrediction[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/standing-predictions`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    saveStandingPrediction(
      token: string,
      poolID: string,
      groupID: string,
      input: SaveStandingPredictionInput,
    ) {
      return request<StandingPrediction>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/standing-predictions/${encodeURIComponent(groupID)}`,
        {
          method: "PUT",
          body: JSON.stringify(input),
          headers: authHeaders(token),
        },
      );
    },
  };
}

export function serializeAuthSession(result: AuthResult) {
  return JSON.stringify({
    token: result.token,
    expiresAt: result.expires_at,
    user: result.user,
  });
}

async function request<T>(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
) {
  const response = await fetcher(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const payload = await responsePayload<T>(response);

  if (!response.ok) {
    throw new PollavarAPIError(response.status, errorCode(payload));
  }

  return (payload as DataEnvelope<T>).data;
}

async function responsePayload<T>(response: Response): Promise<DataEnvelope<T> | ErrorEnvelope> {
  try {
    return (await response.json()) as DataEnvelope<T> | ErrorEnvelope;
  } catch (error) {
    if (!response.ok) {
      return {};
    }

    throw error;
  }
}

function defaultAPIURL() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
}

function normalizeBaseURL(value: string) {
  return value.replace(/\/+$/, "");
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function errorCode(payload: DataEnvelope<unknown> | ErrorEnvelope) {
  return "code" in payload && payload.code ? payload.code : "unknown_error";
}
