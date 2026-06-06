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
  theme_template: TournamentThemeTemplate;
  tiebreakers: TournamentTiebreaker[];
  group_count: number;
  team_count: number;
};

export type TournamentTiebreaker =
  | "points"
  | "goal_difference"
  | "goals_for"
  | "goals_against";

export type TournamentThemeTemplate = {
  logo_url: string;
  banner_url: string;
  mascot_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
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
  stage_name: string;
  stage_type: string;
  stage_round_size: number;
  group_id: string;
  group_name: string;
  match_number: number;
  home_team?: Team | null;
  away_team?: Team | null;
  home_slot: string;
  away_slot: string;
  home_slot_config: MatchSlot;
  away_slot_config: MatchSlot;
  starts_at: string;
  venue: string;
  status: string;
};

export type MatchSlot = {
  type:
    | ""
    | "team"
    | "seed"
    | "group_position"
    | "best_group_rank"
    | "ranking_top_n"
    | "match_winner"
    | "match_loser"
    | "bye"
    | "placeholder";
  source_id: string;
  rank: number;
  label: string;
};

export type Tournament = TournamentSummary & {
  groups: Array<{
    id: string;
    name: string;
    teams: Team[];
  }>;
  matches: Match[];
  advancement_rules: AdvancementRule[];
};

export type AdvancementRule = {
  id: string;
  tournament_id: string;
  from_stage_id: string;
  from_stage_name: string;
  to_stage_id: string;
  to_stage_name: string;
  rule_type:
    | "top_n_per_group"
    | "best_group_rank"
    | "ranking_top_n"
    | "match_winner"
    | "match_loser"
    | "bye";
  rank: number;
  qualifiers: number;
  source_rank: number;
  source_match_id: string;
  source_match_number: number;
  target_match_id: string;
  target_match_number: number;
  target_slot: "" | "home" | "away";
  priority: number;
  label: string;
};

export type GenerateKnockoutBracketInput = {
  stage_id: string;
  stage_name: string;
  stage_type?: string;
  match_id_prefix: string;
  match_number_start: number;
  slots: MatchSlot[];
  from_stage_id?: string;
  from_stage_name?: string;
  rule_id_prefix?: string;
  rule_priority_start?: number;
  source_matches?: Array<{
    id: string;
    match_number: number;
    home_slot_config?: MatchSlot;
    away_slot_config?: MatchSlot;
  }>;
};

export type UpdateTournamentTiebreakersInput = {
  tiebreakers: TournamentTiebreaker[];
};

export type UpdateMatchSlotOverrideInput = {
  home_team_id?: string;
  away_team_id?: string;
  reason: string;
};

export type GeneratedBracket = {
  matches: Match[];
  advancement_rules: AdvancementRule[];
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
  prediction_mode: PredictionMode;
  match_result_scoring_mode: MatchResultScoringMode;
  created_by: string;
  created_at: string;
  updated_at: string;
  current_user_role: string;
  theme: PoolTheme;
  participants: PoolParticipant[];
};

export type PaymentMethod = "cash" | "bank_transfer" | "deposit";
export type PaymentStatus = "pending" | "confirmed" | "rejected";

export type Payment = {
  id: string;
  pool_id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  reference: string;
  confirmed_by: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentCollection = {
  pool_id: string;
  currency: string;
  confirmed_total_cents: number;
  payments: Payment[];
};

export type PrizeRule = {
  id: string;
  pool_id: string;
  type: string;
  position: number;
  percentage: number;
  fixed_amount_cents: number;
  currency: string;
  description: string;
  created_at: string;
};

export type PrizePayout = {
  position: number;
  percentage: number;
  estimated_amount_cents: number;
  description: string;
};

export type PrizePreview = {
  pool_id: string;
  currency: string;
  confirmed_total_cents: number;
  rules: PrizeRule[];
  payouts: PrizePayout[];
};

export type GlobalPredictionPrizeType = "none" | "fixed" | "percentage";
export type GlobalPredictionPrizeSharePolicy = "split_equal";

export type GlobalPredictionPrizeWinner = {
  user_id: string;
  user_name: string;
  username: string;
  prediction_id: string;
  estimated_amount_cents: number;
};

export type GlobalPredictionPrize = {
  definition_id: string;
  code: ScoringRuleCode;
  label: string;
  prize_type: GlobalPredictionPrizeType;
  prize_fixed_amount_cents: number;
  prize_percentage: number;
  prize_share_policy: GlobalPredictionPrizeSharePolicy;
  estimated_total_cents: number;
  result_recorded: boolean;
  winner_count: number;
  winners: GlobalPredictionPrizeWinner[];
};

export type GlobalPredictionPrizePreview = {
  pool_id: string;
  currency: string;
  confirmed_total_cents: number;
  prizes: GlobalPredictionPrize[];
};

export type SavePrizeRuleInput = {
  position: number;
  percentage: number;
  description?: string;
};

export type UpdatePrizeRulesInput = {
  rules: SavePrizeRuleInput[];
};

export type UpsertPaymentInput = {
  amount_cents: number;
  currency?: string;
  payment_method?: PaymentMethod;
  reference?: string;
  status?: PaymentStatus;
};

export type Prediction = {
  id: string;
  pool_id: string;
  user_id: string;
  match_id: string;
  has_score: boolean;
  home_score: number;
  away_score: number;
  outcome: MatchOutcome;
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

export type ScoringRuleCode = string;

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
  pool_id?: string;
  match_id: string;
  home_score: number;
  away_score: number;
  result_status: string;
  recorded_at: string;
};

export type MatchResultSnapshot = {
  home_score: number;
  away_score: number;
  result_status: string;
};

export type MatchResultAuditLog = {
  id: string;
  pool_id: string;
  match_id: string;
  actor_user_id: string;
  action: "match_result_created" | "match_result_updated";
  previous?: MatchResultSnapshot | null;
  current: MatchResultSnapshot;
  created_at: string;
};

export type SaveMatchResultInput = {
  home_score: number;
  away_score: number;
  result_status?: string;
};

export type OfficialStanding = {
  pool_id: string;
  tournament_id: string;
  stage_id: string;
  group_id: string;
  team: Team;
  position: number;
  reason: string;
  updated_by: string;
  updated_at: string;
};

export type OfficialStandingInput = {
  team_id: string;
  position: number;
};

export type ReplaceOfficialStandingsInput = {
  stage_id: string;
  group_id?: string;
  reason: string;
  standings: OfficialStandingInput[];
};

export type OfficialStandingAuditLog = {
  id: string;
  pool_id: string;
  tournament_id: string;
  stage_id: string;
  group_id: string;
  actor_user_id: string;
  action: "official_standings_replaced";
  previous: OfficialStanding[];
  current: OfficialStanding[];
  reason: string;
  created_at: string;
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
  resolved_home_team?: Team | null;
  resolved_away_team?: Team | null;
};

export type PredictionSnapshotEntry = {
  id: string;
  snapshot_id: string;
  prediction_id: string;
  user_id: string;
  participant_name: string;
  has_prediction: boolean;
  home_score: number | null;
  away_score: number | null;
  outcome: MatchOutcome | "";
  predicted_at: string | null;
  updated_at: string | null;
};

export type PredictionSnapshot = {
  id: string;
  pool_id: string;
  match_id: string;
  generated_at: string;
  row_count: number;
  checksum: string;
  entries: PredictionSnapshotEntry[];
};

export type MatchUnderdogBonus = {
  id: string;
  pool_id: string;
  match_id: string;
  enabled: boolean;
  outcome: MatchOutcome | "";
  source: string;
  home_probability: number | null;
  draw_probability: number | null;
  away_probability: number | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
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
  standing_prediction_id: string;
  global_prediction_id: string;
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

export type MatchOutcome = "home" | "draw" | "away";
export type PredictionMode = "score" | "outcome" | "score_with_outcome";
export type MatchResultScoringMode = "exclusive" | "cumulative";
export type PredictionSettingsOverrideScope = "stage" | "match";
export type PredictionSettingsSource = "pool" | "stage" | "match";
export type GlobalPredictionValueType =
  | "team"
  | "player"
  | "text"
  | "number"
  | "number_range"
  | "boolean";

export type PredictionSettingsOverride = {
  id: string;
  pool_id: string;
  scope_type: PredictionSettingsOverrideScope;
  stage_id: string;
  match_id: string;
  prediction_mode: PredictionMode | null;
  match_result_scoring_mode: MatchResultScoringMode | null;
  underdog_bonus_enabled: boolean | null;
  underdog_bonus_points: number | null;
  created_at: string;
  updated_at: string;
};

export type EffectiveMatchPredictionSettings = {
  pool_id: string;
  match_id: string;
  stage_id: string;
  prediction_mode: PredictionMode;
  match_result_scoring_mode: MatchResultScoringMode;
  underdog_bonus_enabled: boolean;
  underdog_bonus_points: number;
  prediction_mode_source: PredictionSettingsSource;
  match_result_scoring_mode_source: PredictionSettingsSource;
  underdog_bonus_enabled_source: PredictionSettingsSource;
  underdog_bonus_points_source: PredictionSettingsSource;
};

export type GlobalPredictionDefinition = {
  id: string;
  pool_id: string;
  code: ScoringRuleCode;
  label: string;
  value_type: GlobalPredictionValueType;
  enabled: boolean;
  points_enabled: boolean;
  prize_enabled: boolean;
  prize_type: GlobalPredictionPrizeType;
  prize_fixed_amount_cents: number;
  prize_percentage: number;
  prize_share_policy: GlobalPredictionPrizeSharePolicy;
  points: number;
  sort_order: number;
  closes_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GlobalPredictionTemplate = {
  id: string;
  code: string;
  label: string;
  value_type: GlobalPredictionValueType;
  sport: string;
  category: string;
  resolution_mode: string;
  enabled: boolean;
  points_enabled: boolean;
  prize_enabled: boolean;
  points: number;
  sort_order: number;
  default_enabled: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type GlobalPrediction = {
  id: string;
  pool_id: string;
  user_id: string;
  definition_id: string;
  code: ScoringRuleCode;
  value_type: GlobalPredictionValueType;
  value_text: string;
  value_number: number | null;
  range_min: number | null;
  range_max: number | null;
  created_at: string;
  updated_at: string;
};

export type GlobalPredictionResult = {
  id: string;
  pool_id: string;
  definition_id: string;
  code: ScoringRuleCode;
  value_type: GlobalPredictionValueType;
  value_text: string;
  value_number: number | null;
  range_min: number | null;
  range_max: number | null;
  recorded_by: string;
  recorded_at: string;
  created_at: string;
  updated_at: string;
};

export type GlobalPredictionAnswerGroup = {
  value_text: string;
  normalized_value: string;
  prediction_count: number;
  approved: boolean;
  alias_id: string;
  target_value_text: string;
  target_normalized_value: string;
  updated_by: string;
  updated_at: string;
};

export type GlobalPredictionAnswerSummary = {
  pool_id: string;
  definition_id: string;
  code: ScoringRuleCode;
  label: string;
  value_type: GlobalPredictionValueType;
  result_recorded: boolean;
  result_value_text: string;
  result_normalized_value: string;
  answers: GlobalPredictionAnswerGroup[];
};

export type UpdatePredictionSettingsInput = {
  prediction_mode: PredictionMode;
  match_result_scoring_mode: MatchResultScoringMode;
};

export type PredictionSettingsOverrideInput = {
  scope_type: PredictionSettingsOverrideScope;
  stage_id?: string;
  match_id?: string;
  prediction_mode?: PredictionMode | null;
  match_result_scoring_mode?: MatchResultScoringMode | null;
  underdog_bonus_enabled?: boolean | null;
  underdog_bonus_points?: number | null;
};

export type UpdatePredictionSettingsOverridesInput = {
  overrides: PredictionSettingsOverrideInput[];
};

export type UpdatePoolThemeInput = {
  display_name: string;
  logo_url: string;
  banner_url: string;
  mascot_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
};

export type SaveMatchUnderdogBonusInput = {
  enabled: boolean;
  outcome?: MatchOutcome | "";
  home_probability?: number | null;
  draw_probability?: number | null;
  away_probability?: number | null;
};

export type SavePredictionInput =
  | {
      home_score: number;
      away_score: number;
      outcome?: MatchOutcome;
    }
  | {
      outcome: MatchOutcome;
    };

export type SaveStandingPredictionInput = {
  team_ids: string[];
};

export type GlobalPredictionDefinitionInput = {
  code: ScoringRuleCode;
  label: string;
  value_type: GlobalPredictionValueType;
  enabled?: boolean;
  points_enabled?: boolean;
  prize_enabled?: boolean;
  prize_type?: GlobalPredictionPrizeType;
  prize_fixed_amount_cents?: number;
  prize_percentage?: number;
  prize_share_policy?: GlobalPredictionPrizeSharePolicy;
  points: number;
  sort_order?: number;
  closes_at?: string | null;
};

export type UpdateGlobalPredictionDefinitionsInput = {
  definitions: GlobalPredictionDefinitionInput[];
};

export type GlobalPredictionTemplateInput = {
  label: string;
  value_type: GlobalPredictionValueType;
  sport: string;
  category: string;
  resolution_mode: string;
  enabled: boolean;
  points_enabled: boolean;
  prize_enabled: boolean;
  points: number;
  sort_order: number;
  default_enabled: boolean;
};

export type SaveGlobalPredictionInput = {
  value_text?: string;
  value_number?: number | null;
  range_min?: number | null;
  range_max?: number | null;
};

export type UpdateGlobalPredictionAliasesInput = {
  alias_values: string[];
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
    generateKnockoutBracket(
      token: string,
      tournamentID: string,
      input: GenerateKnockoutBracketInput,
    ) {
      return request<GeneratedBracket>(
        fetcher,
        `${baseURL}/api/v1/tournaments/${encodeURIComponent(tournamentID)}/brackets/generate`,
        {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify(input),
        },
      );
    },
    updateTournamentTiebreakers(
      token: string,
      tournamentID: string,
      input: UpdateTournamentTiebreakersInput,
    ) {
      return request<Tournament>(
        fetcher,
        `${baseURL}/api/v1/tournaments/${encodeURIComponent(tournamentID)}/tiebreakers`,
        {
          method: "PUT",
          body: JSON.stringify(input),
          headers: authHeaders(token),
        },
      );
    },
    updateMatchSlotOverride(
      token: string,
      tournamentID: string,
      matchID: string,
      input: UpdateMatchSlotOverrideInput,
    ) {
      return request<Tournament>(
        fetcher,
        `${baseURL}/api/v1/tournaments/${encodeURIComponent(tournamentID)}/matches/${encodeURIComponent(matchID)}/slots`,
        {
          method: "PUT",
          body: JSON.stringify(input),
          headers: authHeaders(token),
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
    listPayments(token: string, poolID: string) {
      return request<PaymentCollection>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/payments`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    upsertPayment(token: string, poolID: string, userID: string, input: UpsertPaymentInput) {
      return request<Payment>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/payments/${encodeURIComponent(userID)}`,
        {
          method: "PUT",
          body: JSON.stringify(input),
          headers: authHeaders(token),
        },
      );
    },
    listPrizeRules(token: string, poolID: string) {
      return request<PrizeRule[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/prize-rules`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    updatePrizeRules(token: string, poolID: string, input: UpdatePrizeRulesInput) {
      return request<PrizeRule[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/prize-rules`,
        {
          method: "PUT",
          body: JSON.stringify(input),
          headers: authHeaders(token),
        },
      );
    },
    getPrizePreview(token: string, poolID: string) {
      return request<PrizePreview>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/prizes/preview`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    getGlobalPredictionPrizePreview(token: string, poolID: string) {
      return request<GlobalPredictionPrizePreview>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/global-prizes/preview`,
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
    saveMatchResult(
      token: string,
      poolID: string,
      matchID: string,
      input: SaveMatchResultInput,
    ) {
      return request<MatchResult>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/match-results/${encodeURIComponent(matchID)}`,
        {
          method: "PUT",
          body: JSON.stringify(input),
          headers: authHeaders(token),
        },
      );
    },
    listMatchResultAuditLogs(token: string, poolID: string, matchID: string) {
      return request<MatchResultAuditLog[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/match-results/${encodeURIComponent(matchID)}/audit-logs`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    listOfficialStandings(
      token: string,
      poolID: string,
      params: { stageID?: string; groupID?: string } = {},
    ) {
      const query = officialStandingsQuery(params);
      return request<OfficialStanding[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/official-standings${query}`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    replaceOfficialStandings(
      token: string,
      poolID: string,
      input: ReplaceOfficialStandingsInput,
    ) {
      return request<OfficialStanding[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/official-standings`,
        {
          method: "PUT",
          body: JSON.stringify(input),
          headers: authHeaders(token),
        },
      );
    },
    listOfficialStandingAuditLogs(
      token: string,
      poolID: string,
      params: { stageID?: string; groupID?: string } = {},
    ) {
      const query = officialStandingsQuery(params);
      return request<OfficialStandingAuditLog[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/official-standings/audit-logs${query}`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    listMatchUnderdogBonuses(token: string, poolID: string) {
      return request<MatchUnderdogBonus[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/underdog-bonuses`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    saveMatchUnderdogBonus(
      token: string,
      poolID: string,
      matchID: string,
      input: SaveMatchUnderdogBonusInput,
    ) {
      return request<MatchUnderdogBonus>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/underdog-bonuses/${encodeURIComponent(matchID)}`,
        {
          method: "PUT",
          body: JSON.stringify(input),
          headers: authHeaders(token),
        },
      );
    },
    getPredictionSnapshot(token: string, poolID: string, matchID: string) {
      return request<PredictionSnapshot>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/matches/${encodeURIComponent(matchID)}/prediction-snapshot`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    downloadPredictionSnapshotCSV(token: string, poolID: string, matchID: string) {
      return requestText(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/matches/${encodeURIComponent(matchID)}/prediction-snapshot.csv`,
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
    updatePredictionSettings(
      token: string,
      poolID: string,
      input: UpdatePredictionSettingsInput,
    ) {
      return request<Pool>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/prediction-settings`,
        {
          method: "PUT",
          body: JSON.stringify(input),
          headers: authHeaders(token),
        },
      );
    },
    listPredictionSettingsOverrides(token: string, poolID: string) {
      return request<PredictionSettingsOverride[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/prediction-settings-overrides`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    updatePredictionSettingsOverrides(
      token: string,
      poolID: string,
      input: UpdatePredictionSettingsOverridesInput,
    ) {
      return request<PredictionSettingsOverride[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/prediction-settings-overrides`,
        {
          method: "PUT",
          body: JSON.stringify(input),
          headers: authHeaders(token),
        },
      );
    },
    listEffectiveMatchPredictionSettings(token: string, poolID: string) {
      return request<EffectiveMatchPredictionSettings[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/match-prediction-settings`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    updatePoolTheme(token: string, poolID: string, input: UpdatePoolThemeInput) {
      return request<Pool>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/theme`,
        {
          method: "PUT",
          body: JSON.stringify(input),
          headers: authHeaders(token),
        },
      );
    },
    listGlobalPredictionTemplates(token: string, poolID: string) {
      return request<GlobalPredictionTemplate[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/global-prediction-templates`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    saveGlobalPredictionTemplate(
      token: string,
      poolID: string,
      templateCode: string,
      input: GlobalPredictionTemplateInput,
    ) {
      return request<GlobalPredictionTemplate>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/global-prediction-templates/${encodeURIComponent(templateCode)}`,
        {
          method: "PUT",
          body: JSON.stringify(input),
          headers: authHeaders(token),
        },
      );
    },
    listGlobalPredictionDefinitions(token: string, poolID: string) {
      return request<GlobalPredictionDefinition[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/global-prediction-definitions`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    updateGlobalPredictionDefinitions(
      token: string,
      poolID: string,
      input: UpdateGlobalPredictionDefinitionsInput,
    ) {
      return request<GlobalPredictionDefinition[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/global-prediction-definitions`,
        {
          method: "PUT",
          body: JSON.stringify(input),
          headers: authHeaders(token),
        },
      );
    },
    listGlobalPredictions(token: string, poolID: string) {
      return request<GlobalPrediction[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/global-predictions`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    saveGlobalPrediction(
      token: string,
      poolID: string,
      definitionCode: string,
      input: SaveGlobalPredictionInput,
    ) {
      return request<GlobalPrediction>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/global-predictions/${encodeURIComponent(definitionCode)}`,
        {
          method: "PUT",
          body: JSON.stringify(input),
          headers: authHeaders(token),
        },
      );
    },
    listGlobalPredictionResults(token: string, poolID: string) {
      return request<GlobalPredictionResult[]>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/global-results`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    saveGlobalPredictionResult(
      token: string,
      poolID: string,
      definitionCode: string,
      input: SaveGlobalPredictionInput,
    ) {
      return request<GlobalPredictionResult>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/global-results/${encodeURIComponent(definitionCode)}`,
        {
          method: "PUT",
          body: JSON.stringify(input),
          headers: authHeaders(token),
        },
      );
    },
    getGlobalPredictionAnswerSummary(token: string, poolID: string, definitionCode: string) {
      return request<GlobalPredictionAnswerSummary>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/global-results/${encodeURIComponent(definitionCode)}/answers`,
        {
          method: "GET",
          headers: authHeaders(token),
        },
      );
    },
    updateGlobalPredictionAliases(
      token: string,
      poolID: string,
      definitionCode: string,
      input: UpdateGlobalPredictionAliasesInput,
    ) {
      return request<GlobalPredictionAnswerSummary>(
        fetcher,
        `${baseURL}/api/v1/pools/${encodeURIComponent(poolID)}/global-results/${encodeURIComponent(definitionCode)}/aliases`,
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

async function requestText(fetcher: typeof fetch, url: string, init: RequestInit) {
  const response = await fetcher(url, {
    ...init,
    headers: {
      ...init.headers,
    },
  });
  const payload = await response.text();

  if (!response.ok) {
    throw new PollavarAPIError(response.status, textErrorCode(payload));
  }

  return payload;
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

function officialStandingsQuery(params: { stageID?: string; groupID?: string }) {
  const search = new URLSearchParams();
  if (params.stageID) {
    search.set("stage_id", params.stageID);
  }
  if (params.groupID) {
    search.set("group_id", params.groupID);
  }
  const value = search.toString();
  return value ? `?${value}` : "";
}

function errorCode(payload: DataEnvelope<unknown> | ErrorEnvelope) {
  return "code" in payload && payload.code ? payload.code : "unknown_error";
}

function textErrorCode(payload: string) {
  try {
    const parsed = JSON.parse(payload) as ErrorEnvelope;
    return parsed.code || "unknown_error";
  } catch {
    return "unknown_error";
  }
}
