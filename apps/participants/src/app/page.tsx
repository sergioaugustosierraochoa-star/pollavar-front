"use client";

import {
  PollavarAPIError,
  createPollavarClient,
  type GlobalPrediction,
  type GlobalPredictionDefinition,
  type GlobalPredictionPrizePreview,
  type GlobalPredictionPrizeType,
  type GlobalPredictionResult,
  type Match,
  type MatchOutcome,
  type MatchUnderdogBonus,
  type PointEventDetail,
  type Pool,
  type Prediction,
  type PredictionMatchStatus,
  type PredictionSnapshot,
  type PredictionSummary,
  type PoolTheme,
  type PrizePreview,
  type RankingEntry,
  type ScoringRule,
  type StandingPrediction,
  type Tournament,
  type TournamentSummary,
} from "@pollavar/api-client";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

const sessionStorageKey = "pollavar.participants.session";

type AuthSession = {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    name: string;
    username: string;
    email: string;
    role: string;
    created_at: string;
  };
};

type DashboardStatus = "checking" | "signed-out" | "loading" | "ready" | "error";
type ScoreDrafts = Record<string, { home: string; away: string; outcome: MatchOutcome | "" }>;
type StandingDrafts = Record<string, string[]>;
type GlobalPredictionDrafts = Record<
  string,
  { valueText: string; valueNumber: string; rangeMin: string; rangeMax: string }
>;
type TournamentTeamOption = Tournament["groups"][number]["teams"][number];
const defaultScoringRules: ScoringRule[] = [
  { code: "exact_score", points: 5, enabled: true },
  { code: "match_result", points: 3, enabled: true },
  { code: "group_position_exact", points: 2, enabled: true },
  { code: "underdog_bonus", points: 2, enabled: false },
];
type LoadedPoolData = {
  poolDetail: Pool;
  predictionSummary: PredictionSummary;
  userPredictions: Prediction[];
  userPredictionStatuses: PredictionMatchStatus[];
  scoringRules: ScoringRule[];
  userStandingPredictions: StandingPrediction[];
  globalPredictionDefinitions: GlobalPredictionDefinition[];
  userGlobalPredictions: GlobalPrediction[];
  globalPredictionResults: GlobalPredictionResult[];
  underdogBonuses: MatchUnderdogBonus[];
  ranking: RankingEntry[];
  prizePreview: PrizePreview;
  globalPrizePreview: GlobalPredictionPrizePreview;
  tournamentDetail: Tournament | null;
};
type PredictionGroup = {
  id: string;
  title: string;
  subtitle: string;
  matches: Match[];
  standings: SuggestedStandingRow[];
  stats: {
    total: number;
    predicted: number;
    missing: number;
    closed: number;
  };
};
type PredictionGroupDraft = Omit<PredictionGroup, "standings" | "stats">;
type SuggestedStandingRow = {
  key: string;
  position: number;
  teamName: string;
  teamShortName: string;
  played: number;
  expectedMatches: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  complete: boolean;
};
type NormalizedTheme = {
  logoURL: string;
  bannerURL: string;
  mascotURL: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

export default function ParticipantsHome() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<DashboardStatus>("checking");
  const [message, setMessage] = useState("");
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPoolID, setSelectedPoolID] = useState("");
  const [pool, setPool] = useState<Pool | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [summary, setSummary] = useState<PredictionSummary | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [predictionStatuses, setPredictionStatuses] = useState<PredictionMatchStatus[]>([]);
  const [snapshotsByMatchID, setSnapshotsByMatchID] = useState<Record<string, PredictionSnapshot>>(
    {},
  );
  const [snapshotLoadingMatchID, setSnapshotLoadingMatchID] = useState("");
  const [snapshotDownloadingMatchID, setSnapshotDownloadingMatchID] = useState("");
  const [snapshotMessages, setSnapshotMessages] = useState<Record<string, string>>({});
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [prizePreview, setPrizePreview] = useState<PrizePreview | null>(null);
  const [globalPrizePreview, setGlobalPrizePreview] =
    useState<GlobalPredictionPrizePreview | null>(null);
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);
  const [standingPredictions, setStandingPredictions] = useState<StandingPrediction[]>([]);
  const [globalPredictionDefinitions, setGlobalPredictionDefinitions] = useState<
    GlobalPredictionDefinition[]
  >([]);
  const [globalPredictions, setGlobalPredictions] = useState<GlobalPrediction[]>([]);
  const [globalPredictionResults, setGlobalPredictionResults] = useState<
    GlobalPredictionResult[]
  >([]);
  const [underdogBonuses, setUnderdogBonuses] = useState<MatchUnderdogBonus[]>([]);
  const [selectedRankingUserID, setSelectedRankingUserID] = useState("");
  const [pointDetailsByUserID, setPointDetailsByUserID] = useState<
    Record<string, PointEventDetail[]>
  >({});
  const [pointDetailsLoadingUserID, setPointDetailsLoadingUserID] = useState("");
  const [pointDetailsMessage, setPointDetailsMessage] = useState("");
  const [drafts, setDrafts] = useState<ScoreDrafts>({});
  const [standingDrafts, setStandingDrafts] = useState<StandingDrafts>({});
  const [globalDrafts, setGlobalDrafts] = useState<GlobalPredictionDrafts>({});
  const [savingMatchID, setSavingMatchID] = useState("");
  const [savingStandingGroupID, setSavingStandingGroupID] = useState("");
  const [savingGlobalDefinitionCode, setSavingGlobalDefinitionCode] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [standingSaveMessage, setStandingSaveMessage] = useState("");
  const [globalSaveMessage, setGlobalSaveMessage] = useState("");
  const [clockTick, setClockTick] = useState(0);
  const dashboardRequestID = useRef(0);

  const predictionsByMatch = useMemo(() => indexPredictions(predictions), [predictions]);
  const predictionStatusesByMatch = useMemo(
    () => indexPredictionStatuses(predictionStatuses),
    [predictionStatuses],
  );
  const standingPredictionsByGroup = useMemo(
    () => indexStandingPredictions(standingPredictions),
    [standingPredictions],
  );
  const underdogBonusesByMatch = useMemo(
    () => indexUnderdogBonuses(underdogBonuses),
    [underdogBonuses],
  );

  const signOutParticipant = useCallback(function signOutParticipant() {
    dashboardRequestID.current += 1;
    clearStoredSession();
    setSession(null);
    setStatus("signed-out");
    setMessage("");
    setPools([]);
    setSelectedPoolID("");
    setPool(null);
    setTournament(null);
    setSummary(null);
    setPredictions([]);
    setPredictionStatuses([]);
    setSnapshotsByMatchID({});
    setSnapshotLoadingMatchID("");
    setSnapshotDownloadingMatchID("");
    setSnapshotMessages({});
    setRanking([]);
    setPrizePreview(null);
    setGlobalPrizePreview(null);
    setScoringRules([]);
    setStandingPredictions([]);
    setGlobalPredictionDefinitions([]);
    setGlobalPredictions([]);
    setGlobalPredictionResults([]);
    setUnderdogBonuses([]);
    setSelectedRankingUserID("");
    setPointDetailsByUserID({});
    setPointDetailsLoadingUserID("");
    setPointDetailsMessage("");
    setDrafts({});
    setStandingDrafts({});
    setGlobalDrafts({});
    setSavingMatchID("");
    setSavingStandingGroupID("");
    setSavingGlobalDefinitionCode("");
    setSaveMessage("");
    setStandingSaveMessage("");
    setGlobalSaveMessage("");
  }, []);

  const loadPoolData = useCallback(async function loadPoolData(
    token: string,
    activePool: Pool,
    tournamentList: TournamentSummary[],
  ): Promise<LoadedPoolData> {
    const client = createPollavarClient();
    const tournamentSummary = tournamentList.find(
      (item) => item.id === activePool.tournament_id || item.slug === activePool.tournament_id,
    );
    const tournamentRequest = tournamentSummary
      ? client.getTournament(tournamentSummary.slug)
      : Promise.resolve(null);
    const [
      poolDetail,
      predictionSummary,
      userPredictions,
      userPredictionStatuses,
      scoringRules,
      userStandingPredictions,
      globalPredictionDefinitions,
      userGlobalPredictions,
      globalPredictionResults,
      loadedUnderdogBonuses,
      ranking,
      prizePreview,
      globalPrizePreview,
      tournamentDetail,
    ] = await Promise.all([
      client.getPool(token, activePool.id),
      client.getPredictionSummary(token, activePool.id),
      client.listPredictions(token, activePool.id),
      listPredictionStatusesWithFallback(client, token, activePool.id),
      listScoringRulesWithFallback(client, token, activePool.id),
      client.listStandingPredictions(token, activePool.id),
      listGlobalPredictionDefinitionsWithFallback(client, token, activePool.id),
      listGlobalPredictionsWithFallback(client, token, activePool.id),
      listGlobalPredictionResultsWithFallback(client, token, activePool.id),
      listMatchUnderdogBonusesWithFallback(client, token, activePool.id),
      listRankingWithFallback(client, token, activePool.id),
      getPrizePreviewWithFallback(client, token, activePool.id),
      getGlobalPrizePreviewWithFallback(client, token, activePool.id),
      tournamentRequest,
    ]);

    return {
      poolDetail,
      predictionSummary,
      userPredictions,
      userPredictionStatuses,
      scoringRules,
      userStandingPredictions,
      globalPredictionDefinitions,
      userGlobalPredictions,
      globalPredictionResults,
      underdogBonuses: loadedUnderdogBonuses,
      ranking,
      prizePreview,
      globalPrizePreview,
      tournamentDetail,
    };
  }, []);

  const loadDashboard = useCallback(async function loadDashboard(
    token: string,
    preferredPoolID?: string,
  ) {
    const requestID = dashboardRequestID.current + 1;
    dashboardRequestID.current = requestID;
    const isLatestRequest = () => dashboardRequestID.current === requestID;

    setStatus("loading");
    setMessage("");
    setSaveMessage("");
    setStandingSaveMessage("");
    setGlobalSaveMessage("");

    try {
      const client = createPollavarClient();
      const [poolList, tournamentList] = await Promise.all([
        client.listPools(token),
        client.listTournaments(),
      ]);
      const activePool =
        poolList.find((item) => item.id === preferredPoolID) ?? poolList[0] ?? null;

      if (!isLatestRequest()) {
        return;
      }

      setPools(poolList);
      setSelectedPoolID(activePool?.id ?? "");

      if (!activePool) {
        setPool(null);
        setTournament(null);
        setSummary(null);
        setPredictions([]);
        setPredictionStatuses([]);
        setSnapshotsByMatchID({});
        setSnapshotLoadingMatchID("");
        setSnapshotDownloadingMatchID("");
        setSnapshotMessages({});
        setRanking([]);
        setPrizePreview(null);
        setGlobalPrizePreview(null);
        setScoringRules([]);
        setStandingPredictions([]);
        setGlobalPredictionDefinitions([]);
        setGlobalPredictions([]);
        setGlobalPredictionResults([]);
        setUnderdogBonuses([]);
        setSelectedRankingUserID("");
        setPointDetailsByUserID({});
        setPointDetailsLoadingUserID("");
        setPointDetailsMessage("");
        setDrafts({});
        setStandingDrafts({});
        setGlobalDrafts({});
        setStatus("ready");
        return;
      }

      const loadedPoolData = await loadPoolData(token, activePool, tournamentList);
      if (!isLatestRequest()) {
        return;
      }

      setPool(loadedPoolData.poolDetail);
      setSummary(loadedPoolData.predictionSummary);
      setPredictions(loadedPoolData.userPredictions);
      setPredictionStatuses(loadedPoolData.userPredictionStatuses);
      setSnapshotsByMatchID({});
      setSnapshotLoadingMatchID("");
      setSnapshotDownloadingMatchID("");
      setSnapshotMessages({});
      setRanking(loadedPoolData.ranking);
      setPrizePreview(loadedPoolData.prizePreview);
      setGlobalPrizePreview(loadedPoolData.globalPrizePreview);
      setScoringRules(loadedPoolData.scoringRules);
      setStandingPredictions(loadedPoolData.userStandingPredictions);
      setGlobalPredictionDefinitions(loadedPoolData.globalPredictionDefinitions);
      setGlobalPredictions(loadedPoolData.userGlobalPredictions);
      setGlobalPredictionResults(loadedPoolData.globalPredictionResults);
      setUnderdogBonuses(loadedPoolData.underdogBonuses);
      setSelectedRankingUserID("");
      setPointDetailsByUserID({});
      setPointDetailsLoadingUserID("");
      setPointDetailsMessage("");
      setTournament(loadedPoolData.tournamentDetail);
      setDrafts(
        hydrateDrafts(
          loadedPoolData.tournamentDetail?.matches ?? [],
          loadedPoolData.userPredictions,
        ),
      );
      setStandingDrafts({});
      setGlobalDrafts(
        hydrateGlobalDrafts(
          loadedPoolData.globalPredictionDefinitions,
          loadedPoolData.userGlobalPredictions,
        ),
      );
      setStatus("ready");
    } catch (error) {
      if (!isLatestRequest()) {
        return;
      }
      if (isUnauthorizedError(error)) {
        signOutParticipant();
        return;
      }
      setStatus("error");
      setMessage("No pudimos cargar tus pollas.");
    }
  }, [loadPoolData, signOutParticipant]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapDashboard() {
      const storedSession = readStoredSession();
      if (cancelled) {
        return;
      }

      if (!storedSession) {
        setStatus("signed-out");
        return;
      }

      setSession(storedSession);
      await loadDashboard(storedSession.token);
    }

    void bootstrapDashboard();

    return () => {
      cancelled = true;
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (status !== "ready") {
      return undefined;
    }

    const intervalID = window.setInterval(() => {
      setClockTick((current) => current + 1);
    }, 60_000);

    return () => {
      window.clearInterval(intervalID);
    };
  }, [status]);

  async function refreshPredictions(
    token: string,
    activePool: Pool,
    matches: Match[],
    requestID: number,
  ) {
    const client = createPollavarClient();
    const [predictionSummary, userPredictions, userPredictionStatuses] = await Promise.all([
      client.getPredictionSummary(token, activePool.id),
      client.listPredictions(token, activePool.id),
      listPredictionStatusesWithFallback(client, token, activePool.id),
    ]);

    if (dashboardRequestID.current !== requestID) {
      return;
    }

    setSummary(predictionSummary);
    setPredictions(userPredictions);
    setPredictionStatuses(userPredictionStatuses);
    setDrafts(hydrateDrafts(matches, userPredictions));
  }

  function selectPool(poolID: string) {
    if (!session) {
      return;
    }
    void loadDashboard(session.token, poolID);
  }

  async function loadPointDetails(userID: string) {
    if (!session || !pool) {
      return;
    }

    setSelectedRankingUserID(userID);
    setPointDetailsMessage("");
    if (Object.prototype.hasOwnProperty.call(pointDetailsByUserID, userID)) {
      return;
    }

    const requestID = dashboardRequestID.current;
    setPointDetailsLoadingUserID(userID);
    try {
      const client = createPollavarClient();
      const details = await listPointDetailsWithFallback(
        client,
        session.token,
        pool.id,
        userID,
      );
      if (dashboardRequestID.current !== requestID) {
        return;
      }
      setPointDetailsByUserID((current) => ({
        ...current,
        [userID]: details,
      }));
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOutParticipant();
        return;
      }
      if (dashboardRequestID.current === requestID) {
        setPointDetailsMessage("No pudimos cargar el detalle de puntos.");
      }
    } finally {
      if (dashboardRequestID.current === requestID) {
        setPointDetailsLoadingUserID("");
      }
    }
  }

  async function loadPredictionSnapshot(matchID: string) {
    if (!session || !pool) {
      return;
    }
    if (snapshotsByMatchID[matchID]) {
      setSnapshotMessages((current) => ({ ...current, [matchID]: "" }));
      return;
    }

    const requestID = dashboardRequestID.current;
    setSnapshotLoadingMatchID(matchID);
    setSnapshotMessages((current) => ({ ...current, [matchID]: "" }));
    try {
      const client = createPollavarClient();
      const snapshot = await client.getPredictionSnapshot(session.token, pool.id, matchID);
      if (dashboardRequestID.current !== requestID) {
        return;
      }
      setSnapshotsByMatchID((current) => ({
        ...current,
        [matchID]: snapshot,
      }));
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOutParticipant();
        return;
      }
      if (dashboardRequestID.current === requestID) {
        setSnapshotMessages((current) => ({
          ...current,
          [matchID]: snapshotErrorMessage(error),
        }));
      }
    } finally {
      if (dashboardRequestID.current === requestID) {
        setSnapshotLoadingMatchID("");
      }
    }
  }

  async function downloadPredictionSnapshot(matchID: string) {
    if (!session || !pool) {
      return;
    }

    const requestID = dashboardRequestID.current;
    setSnapshotDownloadingMatchID(matchID);
    setSnapshotMessages((current) => ({ ...current, [matchID]: "" }));
    try {
      const client = createPollavarClient();
      const csv = await client.downloadPredictionSnapshotCSV(session.token, pool.id, matchID);
      if (dashboardRequestID.current !== requestID) {
        return;
      }
      downloadTextFile(
        csv,
        `prediction-snapshot-${fileNamePart(pool.id)}-${fileNamePart(matchID)}.csv`,
        "text/csv;charset=utf-8",
      );
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOutParticipant();
        return;
      }
      if (dashboardRequestID.current === requestID) {
        setSnapshotMessages((current) => ({
          ...current,
          [matchID]: snapshotErrorMessage(error),
        }));
      }
    } finally {
      if (dashboardRequestID.current === requestID) {
        setSnapshotDownloadingMatchID("");
      }
    }
  }

  function updateDraft(matchID: string, side: "home" | "away" | "outcome", value: string) {
    setDrafts((current) => ({
      ...current,
      [matchID]: {
        home: current[matchID]?.home ?? "",
        away: current[matchID]?.away ?? "",
        outcome: current[matchID]?.outcome ?? "",
        [side]: value,
      },
    }));
  }

  async function savePrediction(event: FormEvent<HTMLFormElement>, match: Match) {
    event.preventDefault();
    if (!session || !pool || !tournament) {
      return;
    }

    const draft = drafts[match.id] ?? emptyPredictionDraft();
    const input = predictionInputFromDraft(pool, draft);
    if (!input) {
      setSaveMessage(
        pool.prediction_mode === "outcome"
          ? "Elige local, empate o visitante."
          : "Completa ambos marcadores con numeros validos.",
      );
      return;
    }

    setSavingMatchID(match.id);
    setSaveMessage("");
    const requestID = dashboardRequestID.current;
    try {
      const client = createPollavarClient();
      await client.savePrediction(session.token, pool.id, match.id, input);
      if (dashboardRequestID.current !== requestID) {
        return;
      }
      await refreshPredictions(session.token, pool, tournament.matches, requestID);
      if (dashboardRequestID.current !== requestID) {
        return;
      }
      setSaveMessage("Pronostico guardado.");
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOutParticipant();
        return;
      }
      setSaveMessage("No pudimos guardar el pronostico.");
    } finally {
      if (dashboardRequestID.current === requestID) {
        setSavingMatchID("");
      }
    }
  }

  function moveStandingTeam(group: PredictionGroup, teamID: string, direction: -1 | 1) {
    const currentOrder = resolveStandingTeamIDs(
      group,
      standingPredictionsByGroup,
      standingDrafts,
    );
    const currentIndex = currentOrder.indexOf(teamID);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= currentOrder.length) {
      return;
    }

    const nextOrder = [...currentOrder];
    [nextOrder[currentIndex], nextOrder[nextIndex]] = [
      nextOrder[nextIndex],
      nextOrder[currentIndex],
    ];
    setStandingDrafts((current) => ({
      ...current,
      [group.id]: nextOrder,
    }));
    setStandingSaveMessage("");
  }

  async function saveStandingPrediction(group: PredictionGroup) {
    if (!session || !pool) {
      return;
    }

    const teamIDs = resolveStandingTeamIDs(group, standingPredictionsByGroup, standingDrafts);
    if (teamIDs.length < 2) {
      setStandingSaveMessage("Necesitas al menos dos equipos para guardar posiciones.");
      return;
    }
    if (isStandingPredictionClosed(group.matches, pool.prediction_close_hours_before)) {
      setStandingSaveMessage("El pronostico de posiciones de este grupo esta cerrado.");
      return;
    }

    setSavingStandingGroupID(group.id);
    setStandingSaveMessage("");
    const requestID = dashboardRequestID.current;
    try {
      const client = createPollavarClient();
      const savedPrediction = await client.saveStandingPrediction(session.token, pool.id, group.id, {
        team_ids: teamIDs,
      });
      if (dashboardRequestID.current !== requestID) {
        return;
      }
      setStandingPredictions((current) => upsertStandingPrediction(current, savedPrediction));
      setStandingDrafts((current) => ({
        ...current,
        [group.id]: savedPrediction.team_ids,
      }));
      setStandingSaveMessage("Orden de posiciones guardado.");
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOutParticipant();
        return;
      }
      if (isPredictionClosedError(error)) {
        setStandingSaveMessage("El pronostico de posiciones de este grupo esta cerrado.");
        return;
      }
      setStandingSaveMessage("No pudimos guardar el orden de posiciones.");
    } finally {
      if (dashboardRequestID.current === requestID) {
        setSavingStandingGroupID("");
      }
    }
  }

  function updateGlobalDraft(
    definitionCode: string,
    field: keyof GlobalPredictionDrafts[string],
    value: string,
  ) {
    setGlobalDrafts((current) => ({
      ...current,
      [definitionCode]: {
        ...emptyGlobalPredictionDraft(),
        ...current[definitionCode],
        [field]: value,
      },
    }));
    setGlobalSaveMessage("");
  }

  async function saveGlobalPrediction(definition: GlobalPredictionDefinition) {
    if (!session || !pool) {
      return;
    }
    if (isGlobalDefinitionClosed(definition)) {
      setGlobalSaveMessage("Este pronostico global ya esta cerrado.");
      return;
    }

    const draft = {
      ...emptyGlobalPredictionDraft(),
      ...globalDrafts[definition.code],
    };
    const input = globalPredictionInputFromDraft(definition, draft);
    if (!input) {
      setGlobalSaveMessage("Revisa el valor del pronostico global.");
      return;
    }

    setSavingGlobalDefinitionCode(definition.code);
    setGlobalSaveMessage("");
    const requestID = dashboardRequestID.current;
    try {
      const client = createPollavarClient();
      const savedPrediction = await client.saveGlobalPrediction(
        session.token,
        pool.id,
        definition.code,
        input,
      );
      if (dashboardRequestID.current !== requestID) {
        return;
      }
      setGlobalPredictions((current) => upsertGlobalPrediction(current, savedPrediction));
      setGlobalDrafts((current) => ({
        ...current,
        [definition.code]: globalPredictionDraft(savedPrediction),
      }));
      setGlobalSaveMessage("Pronostico global guardado.");
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOutParticipant();
        return;
      }
      if (isPredictionClosedError(error)) {
        setGlobalSaveMessage("Este pronostico global ya esta cerrado.");
        return;
      }
      setGlobalSaveMessage("No pudimos guardar el pronostico global.");
    } finally {
      if (dashboardRequestID.current === requestID) {
        setSavingGlobalDefinitionCode("");
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#f8faf9] text-[#191b1f]">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">PollaVAR Participantes</p>
            <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">
              Mis pronosticos
            </h1>
          </div>
          {session ? (
            <div className="flex items-center gap-3 text-sm text-zinc-600">
              <span>{session.user.username}</span>
              <button
                className="rounded-md border border-zinc-300 px-3 py-2 font-medium text-zinc-700 hover:border-zinc-400"
                onClick={() => {
                  void loadDashboard(session.token, selectedPoolID);
                }}
                type="button"
              >
                Actualizar
              </button>
            </div>
          ) : (
            <nav aria-label="Autenticacion participantes" className="flex items-center gap-2">
              <Link
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400"
                href="/login"
              >
                Entrar
              </Link>
              <Link
                className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                href="/register"
              >
                Crear cuenta
              </Link>
            </nav>
          )}
        </div>
      </header>

      {status === "checking" || status === "loading" ? <LoadingState /> : null}
      {status === "signed-out" ? <SignedOutState /> : null}
      {status === "error" ? (
        <StatusState
          title="No pudimos cargar tu informacion"
          message={message}
          action={
            session
              ? () => {
                  void loadDashboard(session.token, selectedPoolID);
                }
              : undefined
          }
        />
      ) : null}
      {status === "ready" && session ? (
        <Dashboard
          drafts={drafts}
          currentUserID={session.user.id}
          underdogBonusesByMatch={underdogBonusesByMatch}
          onSave={savePrediction}
          onDownloadSnapshot={downloadPredictionSnapshot}
          onLoadSnapshot={loadPredictionSnapshot}
          onSelectRankingUser={loadPointDetails}
          onSaveStanding={saveStandingPrediction}
          onSaveGlobalPrediction={saveGlobalPrediction}
          onSelectPool={selectPool}
          onMoveStanding={moveStandingTeam}
          onUpdateDraft={updateDraft}
          onUpdateGlobalDraft={updateGlobalDraft}
          pool={pool}
          pools={pools}
          predictionsByMatch={predictionsByMatch}
          predictionStatusesByMatch={predictionStatusesByMatch}
          pointDetailsByUserID={pointDetailsByUserID}
          pointDetailsLoadingUserID={pointDetailsLoadingUserID}
          pointDetailsMessage={pointDetailsMessage}
          prizePreview={prizePreview}
          ranking={ranking}
          scoringRules={scoringRules}
          globalDrafts={globalDrafts}
          globalPredictionDefinitions={globalPredictionDefinitions}
          globalPredictionResults={globalPredictionResults}
          globalPredictions={globalPredictions}
          globalPrizePreview={globalPrizePreview}
          globalSaveMessage={globalSaveMessage}
          saveMessage={saveMessage}
          savingGlobalDefinitionCode={savingGlobalDefinitionCode}
          savingMatchID={savingMatchID}
          savingStandingGroupID={savingStandingGroupID}
          selectedPoolID={selectedPoolID}
          selectedRankingUserID={selectedRankingUserID}
          clockTick={clockTick}
          snapshotDownloadingMatchID={snapshotDownloadingMatchID}
          snapshotLoadingMatchID={snapshotLoadingMatchID}
          snapshotMessages={snapshotMessages}
          snapshotsByMatchID={snapshotsByMatchID}
          standingDrafts={standingDrafts}
          standingPredictionsByGroup={standingPredictionsByGroup}
          standingSaveMessage={standingSaveMessage}
          summary={summary}
          tournament={tournament}
        />
      ) : null}
    </main>
  );
}

function Dashboard({
  clockTick,
  currentUserID,
  drafts,
  globalDrafts,
  globalPredictionDefinitions,
  globalPredictionResults,
  globalPredictions,
  globalPrizePreview,
  globalSaveMessage,
  underdogBonusesByMatch,
  onDownloadSnapshot,
  onLoadSnapshot,
  onSave,
  onSaveGlobalPrediction,
  onSelectRankingUser,
  onSaveStanding,
  onSelectPool,
  onMoveStanding,
  onUpdateDraft,
  onUpdateGlobalDraft,
  pool,
  pools,
  predictionsByMatch,
  predictionStatusesByMatch,
  pointDetailsByUserID,
  pointDetailsLoadingUserID,
  pointDetailsMessage,
  prizePreview,
  ranking,
  scoringRules,
  saveMessage,
  savingGlobalDefinitionCode,
  savingMatchID,
  savingStandingGroupID,
  selectedPoolID,
  selectedRankingUserID,
  snapshotDownloadingMatchID,
  snapshotLoadingMatchID,
  snapshotMessages,
  snapshotsByMatchID,
  standingDrafts,
  standingPredictionsByGroup,
  standingSaveMessage,
  summary,
  tournament,
}: {
  clockTick: number;
  currentUserID: string;
  drafts: ScoreDrafts;
  globalDrafts: GlobalPredictionDrafts;
  globalPredictionDefinitions: GlobalPredictionDefinition[];
  globalPredictionResults: GlobalPredictionResult[];
  globalPredictions: GlobalPrediction[];
  globalPrizePreview: GlobalPredictionPrizePreview | null;
  globalSaveMessage: string;
  underdogBonusesByMatch: Map<string, MatchUnderdogBonus>;
  onDownloadSnapshot: (matchID: string) => void;
  onLoadSnapshot: (matchID: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>, match: Match) => void;
  onSaveGlobalPrediction: (definition: GlobalPredictionDefinition) => void;
  onSelectRankingUser: (userID: string) => void;
  onSaveStanding: (group: PredictionGroup) => void;
  onSelectPool: (poolID: string) => void;
  onMoveStanding: (group: PredictionGroup, teamID: string, direction: -1 | 1) => void;
  onUpdateDraft: (matchID: string, side: "home" | "away" | "outcome", value: string) => void;
  onUpdateGlobalDraft: (
    definitionCode: string,
    field: keyof GlobalPredictionDrafts[string],
    value: string,
  ) => void;
  pool: Pool | null;
  pools: Pool[];
  predictionsByMatch: Map<string, Prediction>;
  predictionStatusesByMatch: Map<string, PredictionMatchStatus>;
  pointDetailsByUserID: Record<string, PointEventDetail[]>;
  pointDetailsLoadingUserID: string;
  pointDetailsMessage: string;
  prizePreview: PrizePreview | null;
  ranking: RankingEntry[];
  scoringRules: ScoringRule[];
  saveMessage: string;
  savingGlobalDefinitionCode: string;
  savingMatchID: string;
  savingStandingGroupID: string;
  selectedPoolID: string;
  selectedRankingUserID: string;
  snapshotDownloadingMatchID: string;
  snapshotLoadingMatchID: string;
  snapshotMessages: Record<string, string>;
  snapshotsByMatchID: Record<string, PredictionSnapshot>;
  standingDrafts: StandingDrafts;
  standingPredictionsByGroup: Map<string, StandingPrediction>;
  standingSaveMessage: string;
  summary: PredictionSummary | null;
  tournament: Tournament | null;
}) {
  if (pools.length === 0) {
    return (
      <StatusState
        title="Aun no tienes pollas"
        message="Cuando te unas a una polla, tus partidos y pronosticos apareceran aqui."
      />
    );
  }

  const predictionGroups = tournament
    ? groupMatchesForPredictions(
        tournament.matches,
        predictionsByMatch,
        pool?.prediction_close_hours_before,
        clockTick,
      )
    : [];
  const activeTheme = normalizedPoolTheme(pool?.theme);

  return (
    <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[280px_1fr]">
      <aside
        className="h-fit rounded-lg border bg-white shadow-sm"
        style={{ borderColor: activeTheme.accentColor }}
      >
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-950">Mis pollas</h2>
        </div>
        <div className="grid gap-2 p-3">
          {pools.map((item) => {
            const itemTheme = normalizedPoolTheme(item.theme);
            const selected = item.id === selectedPoolID;

            return (
              <button
                className={`rounded-md border px-3 py-3 text-left text-sm transition ${
                  selected
                    ? "text-zinc-950"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                }`}
                key={item.id}
                onClick={() => onSelectPool(item.id)}
                style={
                  selected
                    ? {
                        borderColor: itemTheme.primaryColor,
                        backgroundColor: colorWithAlpha(itemTheme.primaryColor, 0.1),
                      }
                    : undefined
                }
                type="button"
              >
                <span className="block font-semibold">{poolDisplayName(item)}</span>
                <span className="mt-1 block text-xs text-zinc-500">{item.currency}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="grid gap-5">
        <PoolHeader pool={pool} tournament={tournament} />
        <SummaryGrid summary={summary} />
        <DashboardNavigation
          globalPredictionDefinitions={globalPredictionDefinitions}
          globalPredictions={globalPredictions}
          globalPrizePreview={globalPrizePreview}
          pool={pool}
          predictionGroups={predictionGroups}
          prizePreview={prizePreview}
          ranking={ranking}
          scoringRules={scoringRules}
          summary={summary}
        />
        <PrizePanel globalPreview={globalPrizePreview} preview={prizePreview} />
        <GlobalPredictionsPanel
          definitions={globalPredictionDefinitions}
          drafts={globalDrafts}
          onSave={onSaveGlobalPrediction}
          onUpdateDraft={onUpdateGlobalDraft}
          results={globalPredictionResults}
          saveMessage={globalSaveMessage}
          savingDefinitionCode={savingGlobalDefinitionCode}
          tournament={tournament}
          userPredictions={globalPredictions}
        />
        <ParticipantsPanel currentUserID={currentUserID} pool={pool} />
        <RankingPanel
          currentUserID={currentUserID}
          detailsByUserID={pointDetailsByUserID}
          loadingUserID={pointDetailsLoadingUserID}
          message={pointDetailsMessage}
          onSelectUser={onSelectRankingUser}
          ranking={ranking}
          selectedUserID={selectedRankingUserID}
        />
        <ScoringRulesPanel rules={scoringRules} />
        <RoundClarificationsPanel
          closeHours={pool?.prediction_close_hours_before}
          predictionGroups={predictionGroups}
          scoringRules={scoringRules}
        />
        <PredictionList
          drafts={drafts}
          clockTick={clockTick}
          underdogBonusesByMatch={underdogBonusesByMatch}
          underdogRule={scoringRuleByCode(scoringRules, "underdog_bonus")}
          onDownloadSnapshot={onDownloadSnapshot}
          onLoadSnapshot={onLoadSnapshot}
          onSave={onSave}
          onSaveStanding={onSaveStanding}
          onMoveStanding={onMoveStanding}
          onUpdateDraft={onUpdateDraft}
          pool={pool}
          predictionGroups={predictionGroups}
          predictionsByMatch={predictionsByMatch}
          predictionStatusesByMatch={predictionStatusesByMatch}
          saveMessage={saveMessage}
          savingMatchID={savingMatchID}
          savingStandingGroupID={savingStandingGroupID}
          snapshotDownloadingMatchID={snapshotDownloadingMatchID}
          snapshotLoadingMatchID={snapshotLoadingMatchID}
          snapshotMessages={snapshotMessages}
          snapshotsByMatchID={snapshotsByMatchID}
          standingDrafts={standingDrafts}
          standingPredictionsByGroup={standingPredictionsByGroup}
          standingSaveMessage={standingSaveMessage}
          tournament={tournament}
        />
      </div>
    </section>
  );
}

function PoolHeader({
  pool,
  tournament,
}: {
  pool: Pool | null;
  tournament: Tournament | null;
}) {
  const theme = normalizedPoolTheme(pool?.theme);

  return (
    <section
      className="overflow-hidden rounded-lg border bg-white shadow-sm"
      style={{ borderColor: theme.accentColor }}
    >
      {theme.bannerURL ? (
        <div
          aria-hidden="true"
          className="h-24 bg-cover bg-center"
          style={{ backgroundImage: `url(${JSON.stringify(theme.bannerURL)})` }}
        />
      ) : (
        <div aria-hidden="true" className="h-2" style={{ backgroundColor: theme.primaryColor }} />
      )}
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
          <ThemeLogo theme={theme} />
          <div className="min-w-0">
            <p className="text-sm font-medium" style={{ color: theme.primaryColor }}>
              {tournament?.name ?? "Torneo pendiente"}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">
              {poolDisplayName(pool)}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{pool?.description}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          {theme.mascotURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="hidden h-14 max-w-24 rounded-md object-contain md:block"
              src={theme.mascotURL}
            />
          ) : null}
          <dl className="grid min-w-56 gap-2 text-sm text-zinc-600">
            <div className="flex justify-between gap-4">
              <dt>Invitacion</dt>
              <dd className="font-semibold text-zinc-950">{pool?.invite_code ?? "-"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Cierre</dt>
              <dd className="font-semibold text-zinc-950">
                {pool ? `${pool.prediction_close_hours_before}h antes` : "-"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Participantes</dt>
              <dd className="font-semibold text-zinc-950">
                {pool?.participants.length ?? 0}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

function SummaryGrid({ summary }: { summary: PredictionSummary | null }) {
  const metrics = [
    { label: "Partidos", value: summary?.total_matches ?? 0 },
    { label: "Pronosticados", value: summary?.predicted_matches ?? 0 },
    { label: "Faltantes", value: summary?.missing_matches ?? 0 },
    { label: "Abiertos", value: summary?.open_matches ?? 0 },
    { label: "Cerrados", value: summary?.closed_matches ?? 0 },
    { label: "Puntuados", value: summary?.scored_matches ?? 0 },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {metrics.map((metric) => (
        <div
          className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          key={metric.label}
        >
          <p className="text-xs font-medium uppercase text-zinc-500">{metric.label}</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">{metric.value}</p>
        </div>
      ))}
    </section>
  );
}

function DashboardNavigation({
  globalPredictionDefinitions,
  globalPredictions,
  globalPrizePreview,
  pool,
  predictionGroups,
  prizePreview,
  ranking,
  scoringRules,
  summary,
}: {
  globalPredictionDefinitions: GlobalPredictionDefinition[];
  globalPredictions: GlobalPrediction[];
  globalPrizePreview: GlobalPredictionPrizePreview | null;
  pool: Pool | null;
  predictionGroups: PredictionGroup[];
  prizePreview: PrizePreview | null;
  ranking: RankingEntry[];
  scoringRules: ScoringRule[];
  summary: PredictionSummary | null;
}) {
  const standingGroupCount = predictionGroups.filter((group) => group.standings.length > 0).length;
  const activeRuleCount = scoringRules.filter((rule) => rule.enabled).length;
  const enabledGlobalDefinitions = globalPredictionDefinitions.filter(
    (definition) => definition.enabled,
  );
  const predictedGlobalCount = enabledGlobalDefinitions.filter((definition) =>
    globalPredictions.some((prediction) => prediction.code === definition.code),
  ).length;
  const prizeCount = (prizePreview?.payouts.length ?? 0) + (globalPrizePreview?.prizes.length ?? 0);
  const prizeCurrency = prizePreview?.currency ?? globalPrizePreview?.currency ?? "COP";
  const prizeTotal =
    prizePreview?.confirmed_total_cents ?? globalPrizePreview?.confirmed_total_cents ?? 0;
  const links = [
    {
      href: "#pronosticos",
      label: "Pronosticos",
      value: `${summary?.missing_matches ?? 0} faltantes`,
      detail: `${summary?.predicted_matches ?? 0}/${summary?.total_matches ?? 0} partidos`,
    },
    {
      href: "#globales",
      label: "Globales",
      value: `${enabledGlobalDefinitions.length - predictedGlobalCount} faltantes`,
      detail: `${predictedGlobalCount}/${enabledGlobalDefinitions.length} pronosticos`,
    },
    {
      href: standingGroupCount > 0 ? "#posiciones" : "#pronosticos",
      label: "Posiciones",
      value: `${standingGroupCount} tablas`,
      detail: "Ordenes por grupo o liga",
    },
    {
      href: "#participantes",
      label: "Participantes",
      value: String(pool?.participants.length ?? 0),
      detail: "Estados de pago y premio",
    },
    {
      href: "#ranking",
      label: "Ranking",
      value: `${ranking.length} usuarios`,
      detail: "Puntos y detalle",
    },
    {
      href: "#premios",
      label: "Premios",
      value: `${prizeCount} premios`,
      detail: formatMoney(prizeTotal, prizeCurrency),
    },
    {
      href: "#reglas",
      label: "Reglas",
      value: `${activeRuleCount} activas`,
      detail: "Puntajes de la polla",
    },
    {
      href: "#aclaraciones",
      label: "Aclaraciones",
      value: `${predictionGroups.length} rondas`,
      detail: "Cierres y conteos",
    },
  ];
  const gridColumnsClass =
    links.length >= 8 ? "xl:grid-cols-8" : "xl:grid-cols-6";

  return (
    <nav
      aria-label="Accesos de la polla"
      className={`grid gap-3 sm:grid-cols-2 ${gridColumnsClass}`}
    >
      {links.map((link) => (
        <a
          className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
          href={link.href}
          key={link.label}
        >
          <span className="block font-semibold text-zinc-950">{link.label}</span>
          <span className="mt-2 block text-lg font-semibold text-emerald-800">
            {link.value}
          </span>
          <span className="mt-1 block text-xs text-zinc-500">{link.detail}</span>
        </a>
      ))}
    </nav>
  );
}

function PrizePanel({
  globalPreview,
  preview,
}: {
  globalPreview: GlobalPredictionPrizePreview | null;
  preview: PrizePreview | null;
}) {
  const payouts = preview?.payouts ?? [];
  const globalPrizes = globalPreview?.prizes ?? [];
  const currency = preview?.currency ?? globalPreview?.currency ?? "COP";
  const confirmedTotalCents =
    preview?.confirmed_total_cents ?? globalPreview?.confirmed_total_cents ?? 0;

  if (payouts.length === 0 && globalPrizes.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm" id="premios">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-zinc-950">Premios</h2>
          <p className="text-sm text-zinc-600">Sin premios configurados.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm" id="premios">
      <div className="flex flex-col gap-2 border-b border-zinc-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Premios</h2>
          <p className="text-sm text-zinc-600">
            Bolsa confirmada: {formatMoney(confirmedTotalCents, currency)}
          </p>
        </div>
        <span className="w-fit rounded-md bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800">
          {payouts.length} ranking · {globalPrizes.length} globales
        </span>
      </div>
      {payouts.length > 0 ? (
        <div className="grid divide-y divide-zinc-200 md:grid-cols-2 md:divide-x md:divide-y-0">
          {payouts.map((payout) => (
            <div key={`${payout.position}-${payout.description}`} className="px-5 py-4">
              <p className="text-sm font-semibold text-zinc-950">
                {payout.description || `Posicion ${payout.position}`}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{payout.percentage}% de la bolsa</p>
              <p className="mt-3 text-xl font-semibold text-zinc-950">
                {formatMoney(payout.estimated_amount_cents, currency)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {globalPrizes.length > 0 ? (
        <div className="border-t border-zinc-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-zinc-950">Premios globales</h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {globalPrizes.map((prize) => (
              <div key={prize.code} className="rounded-lg border border-zinc-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">{prize.label}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {globalPrizeTypeLabel(prize.prize_type, prize.prize_percentage, currency)}
                      {" · "}
                      {prize.result_recorded
                        ? `${prize.winners.length} ganador(es)`
                        : "Sin resultado oficial"}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-zinc-950">
                    {formatMoney(prize.estimated_total_cents, currency)}
                  </p>
                </div>
                {prize.result_recorded ? (
                  prize.winners.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {prize.winners.map((winner) => (
                        <div
                          key={`${prize.code}-${winner.user_id}`}
                          className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-sm"
                        >
                          <span className="truncate text-zinc-700">
                            {winner.user_name || winner.username || winner.user_id}
                          </span>
                          <span className="shrink-0 font-medium text-zinc-950">
                            {formatMoney(winner.estimated_amount_cents, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-zinc-500">
                      Resultado cargado, pero nadie elegible lo acerto.
                    </p>
                  )
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function globalPrizeTypeLabel(
  prizeType: GlobalPredictionPrizeType,
  percentage: number,
  currency: string,
) {
  if (prizeType === "percentage") {
    return `${formatPercentage(percentage)}% de la bolsa`;
  }
  if (prizeType === "fixed") {
    return `Monto fijo en ${currency}`;
  }
  return "Sin premio";
}

function GlobalPredictionsPanel({
  definitions,
  drafts,
  onSave,
  onUpdateDraft,
  results,
  saveMessage,
  savingDefinitionCode,
  tournament,
  userPredictions,
}: {
  definitions: GlobalPredictionDefinition[];
  drafts: GlobalPredictionDrafts;
  onSave: (definition: GlobalPredictionDefinition) => void;
  onUpdateDraft: (
    definitionCode: string,
    field: keyof GlobalPredictionDrafts[string],
    value: string,
  ) => void;
  results: GlobalPredictionResult[];
  saveMessage: string;
  savingDefinitionCode: string;
  tournament: Tournament | null;
  userPredictions: GlobalPrediction[];
}) {
  const enabledDefinitions = definitions.filter((definition) => definition.enabled);
  const predictionsByCode = indexGlobalPredictions(userPredictions);
  const resultsByCode = indexGlobalPredictionResults(results);
  const teamOptions = tournamentTeamOptions(tournament);

  if (enabledDefinitions.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm" id="globales">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-zinc-950">Predicciones globales</h2>
          <p className="text-sm text-zinc-600">Esta polla no tiene predicciones globales activas.</p>
        </div>
      </section>
    );
  }

  const completedCount = enabledDefinitions.filter((definition) =>
    predictionsByCode.has(definition.code),
  ).length;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm" id="globales">
      <div className="flex flex-col gap-2 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Predicciones globales</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {completedCount} de {enabledDefinitions.length} pronosticos completos.
          </p>
        </div>
        {saveMessage ? (
          <p className="text-sm font-medium text-emerald-700" role="status">
            {saveMessage}
          </p>
        ) : null}
      </div>

      <datalist id="global-team-options">
        {teamOptions.map((team) => (
          <option key={team.id} value={team.name} />
        ))}
      </datalist>

      <div className="divide-y divide-zinc-100">
        {enabledDefinitions.map((definition) => {
          const prediction = predictionsByCode.get(definition.code);
          const result = resultsByCode.get(definition.code);
          const draft = {
            ...emptyGlobalPredictionDraft(),
            ...globalPredictionDraft(prediction),
            ...drafts[definition.code],
          };
          const closed = isGlobalDefinitionClosed(definition);
          const visibleResult = closed ? result : undefined;
          const isSaving = savingDefinitionCode === definition.code;

          return (
            <div
              className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)_auto]"
              key={definition.code}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-950">{definition.label}</h3>
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      closed ? "bg-zinc-100 text-zinc-600" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {closed ? "Cerrado" : "Abierto"}
                  </span>
                  {definition.points_enabled ? (
                    <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                      {definition.points} pts
                    </span>
                  ) : null}
                  {definition.prize_enabled ? (
                    <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">
                      Premio especial
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  {globalPredictionValueTypeLabel(definition.value_type)}
                  {definition.closes_at ? ` - Cierra ${formatMatchDate(definition.closes_at)}` : ""}
                </p>
                {prediction ? (
                  <p className="mt-2 text-sm text-zinc-700">
                    Guardado:{" "}
                    <span className="font-semibold text-zinc-950">
                      {globalPredictionValueLabel(prediction, teamOptions)}
                    </span>
                  </p>
                ) : null}
                {visibleResult ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Resultado oficial: {globalPredictionValueLabel(visibleResult, teamOptions)}
                  </p>
                ) : null}
              </div>

              <GlobalPredictionInput
                closed={closed}
                definition={definition}
                draft={draft}
                onUpdateDraft={onUpdateDraft}
                teamOptions={teamOptions}
              />

              <div className="flex items-end lg:justify-end">
                <button
                  aria-label={`Guardar prediccion global ${definition.label}`}
                  className="h-10 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  disabled={closed || isSaving}
                  onClick={() => onSave(definition)}
                  type="button"
                >
                  {isSaving ? "Guardando" : "Guardar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GlobalPredictionInput({
  closed,
  definition,
  draft,
  onUpdateDraft,
  teamOptions,
}: {
  closed: boolean;
  definition: GlobalPredictionDefinition;
  draft: GlobalPredictionDrafts[string];
  onUpdateDraft: (
    definitionCode: string,
    field: keyof GlobalPredictionDrafts[string],
    value: string,
  ) => void;
  teamOptions: TournamentTeamOption[];
}) {
  if (definition.value_type === "team" && teamOptions.length > 0) {
    return (
      <label className="grid gap-1 text-xs font-medium text-zinc-600">
        <span>Equipo</span>
        <select
          aria-label={`Pronostico global ${definition.label}`}
          className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 disabled:bg-zinc-100"
          disabled={closed}
          onChange={(event) => onUpdateDraft(definition.code, "valueText", event.target.value)}
          value={draft.valueText}
        >
          <option value="">Elegir equipo</option>
          {teamOptions.map((team) => (
            <option key={team.id || team.name} value={team.id || team.name}>
              {team.name}
            </option>
          ))}
          {draft.valueText && !teamOptions.some((team) => (team.id || team.name) === draft.valueText) ? (
            <option value={draft.valueText}>{draft.valueText}</option>
          ) : null}
        </select>
      </label>
    );
  }

  if (definition.value_type === "number") {
    return (
      <label className="grid gap-1 text-xs font-medium text-zinc-600">
        <span>Valor exacto</span>
        <input
          aria-label={`Pronostico global ${definition.label}`}
          className="h-10 rounded-md border border-zinc-300 px-3 text-sm text-zinc-950 disabled:bg-zinc-100"
          disabled={closed}
          min={0}
          onChange={(event) =>
            onUpdateDraft(definition.code, "valueNumber", event.target.value)
          }
          step={1}
          type="number"
          value={draft.valueNumber}
        />
      </label>
    );
  }

  if (definition.value_type === "number_range") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          <span>Desde</span>
          <input
            aria-label={`Pronostico global desde ${definition.label}`}
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm text-zinc-950 disabled:bg-zinc-100"
            disabled={closed}
            min={0}
            onChange={(event) => onUpdateDraft(definition.code, "rangeMin", event.target.value)}
            step={1}
            type="number"
            value={draft.rangeMin}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          <span>Hasta</span>
          <input
            aria-label={`Pronostico global hasta ${definition.label}`}
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm text-zinc-950 disabled:bg-zinc-100"
            disabled={closed}
            min={0}
            onChange={(event) => onUpdateDraft(definition.code, "rangeMax", event.target.value)}
            step={1}
            type="number"
            value={draft.rangeMax}
          />
        </label>
      </div>
    );
  }

  return (
    <label className="grid gap-1 text-xs font-medium text-zinc-600">
      <span>{definition.value_type === "team" ? "Equipo" : "Respuesta"}</span>
      <input
        aria-label={`Pronostico global ${definition.label}`}
        className="h-10 rounded-md border border-zinc-300 px-3 text-sm text-zinc-950 disabled:bg-zinc-100"
        disabled={closed}
        list={definition.value_type === "team" ? "global-team-options" : undefined}
        onChange={(event) => onUpdateDraft(definition.code, "valueText", event.target.value)}
        value={draft.valueText}
      />
    </label>
  );
}

function ParticipantsPanel({
  currentUserID,
  pool,
}: {
  currentUserID: string;
  pool: Pool | null;
}) {
  if (!pool) {
    return null;
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm" id="participantes">
      <div className="flex flex-col gap-2 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Participantes</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Estados de participacion, pago y elegibilidad.
          </p>
        </div>
        <span className="w-fit rounded-md bg-sky-100 px-3 py-2 text-sm font-semibold text-sky-800">
          {pool.participants.length} {pool.participants.length === 1 ? "inscrito" : "inscritos"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="px-5 py-3 font-medium">Participante</th>
              <th className="px-5 py-3 font-medium">Rol</th>
              <th className="px-5 py-3 font-medium">Pago</th>
              <th className="px-5 py-3 font-medium">Premio</th>
              <th className="px-5 py-3 text-right font-medium">Ingreso</th>
            </tr>
          </thead>
          <tbody>
            {pool.participants.map((participant) => (
              <tr className="border-b border-zinc-100" key={participant.user_id}>
                <td className="px-5 py-3">
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-950">
                      {poolParticipantDisplayName(participant)}
                    </span>
                    {participant.user_id === currentUserID ? (
                      <span className="rounded-md bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800">
                        Tu
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-xs text-zinc-500">
                    {poolParticipantHandle(participant)}
                  </span>
                </td>
                <td className="px-5 py-3 text-zinc-700">
                  {participantRoleLabel(participant.role)}
                </td>
                <td className="px-5 py-3">
                  <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                    {paymentStatusLabel(participant.payment_status)}
                  </span>
                </td>
                <td className="px-5 py-3 text-zinc-700">
                  {participant.prize_eligible ? "Elegible" : "Sin premio"}
                </td>
                <td className="px-5 py-3 text-right text-zinc-500">
                  {formatShortDate(participant.joined_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ScoringRulesPanel({ rules }: { rules: ScoringRule[] }) {
  const activeRules = rules.filter((rule) => rule.enabled);

  if (activeRules.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm" id="reglas">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-zinc-950">Reglas de puntaje</h2>
          <p className="text-sm text-zinc-600">Sin reglas activas para esta polla.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm" id="reglas">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-zinc-950">Reglas de puntaje</h2>
        <div className="flex flex-wrap gap-2">
          {activeRules.map((rule) => (
            <div
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
              key={rule.code}
            >
              <span className="font-medium">{scoringRuleLabel(rule.code)}</span>
              <span className="ml-2 text-amber-800">{rule.points} pts</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RoundClarificationsPanel({
  closeHours,
  predictionGroups,
  scoringRules,
}: {
  closeHours?: number;
  predictionGroups: PredictionGroup[];
  scoringRules: ScoringRule[];
}) {
  const activeRules = scoringRules.filter((rule) => rule.enabled);

  if (predictionGroups.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm" id="aclaraciones">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-zinc-950">Aclaraciones por ronda</h2>
          <p className="text-sm text-zinc-600">
            Sin rondas disponibles para mostrar conteos y cierres.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm" id="aclaraciones">
      <div className="flex flex-col gap-2 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Aclaraciones por ronda</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Conteos, cierres y puntajes aplicables por bloque de partidos.
          </p>
        </div>
        <span className="w-fit rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          {typeof closeHours === "number" ? `${closeHours}h antes` : "Cierre pendiente"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="px-5 py-3 font-medium">Ronda</th>
              <th className="px-5 py-3 text-right font-medium">Partidos</th>
              <th className="px-5 py-3 text-right font-medium">Faltantes</th>
              <th className="px-5 py-3 font-medium">Cierre</th>
              <th className="px-5 py-3 font-medium">Puntajes</th>
            </tr>
          </thead>
          <tbody>
            {predictionGroups.map((group) => (
              <tr className="border-b border-zinc-100" key={group.id}>
                <td className="px-5 py-3">
                  <span className="block font-semibold text-zinc-950">{group.title}</span>
                  <span className="mt-1 block text-xs text-zinc-500">{group.subtitle}</span>
                </td>
                <td className="px-5 py-3 text-right font-semibold text-zinc-950">
                  {group.stats.total}
                </td>
                <td className="px-5 py-3 text-right text-zinc-700">
                  {group.stats.missing}
                </td>
                <td className="px-5 py-3 text-zinc-700">
                  {roundCloseLabel(group, closeHours)}
                </td>
                <td className="px-5 py-3 text-zinc-700">
                  {roundScoringLabel(group, activeRules)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RankingPanel({
  currentUserID,
  detailsByUserID,
  loadingUserID,
  message,
  onSelectUser,
  ranking,
  selectedUserID,
}: {
  currentUserID: string;
  detailsByUserID: Record<string, PointEventDetail[]>;
  loadingUserID: string;
  message: string;
  onSelectUser: (userID: string) => void;
  ranking: RankingEntry[];
  selectedUserID: string;
}) {
  const selectedEntry = ranking.find((entry) => entry.user_id === selectedUserID) ?? null;
  const selectedDetails = selectedUserID ? detailsByUserID[selectedUserID] : undefined;
  const isLoading = selectedUserID !== "" && loadingUserID === selectedUserID;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm" id="ranking">
      <div className="flex flex-col gap-2 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Ranking general</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Posiciones calculadas con los puntos oficiales ya registrados.
          </p>
        </div>
        <span className="w-fit rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          {ranking.length} participantes
        </span>
      </div>

      {ranking.length === 0 ? (
        <div className="px-5 py-5 text-sm text-zinc-600">
          Aun no hay puntos registrados para esta polla.
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
          <ol className="divide-y divide-zinc-100">
            {ranking.map((entry) => {
              const isSelected = entry.user_id === selectedUserID;
              const isCurrentUser = entry.user_id === currentUserID;
              const displayName = rankingDisplayName(entry);
              return (
                <li key={entry.user_id}>
                  <button
                    aria-label={`Ver detalle de ${displayName}`}
                    aria-pressed={isSelected}
                    className={`grid min-h-16 w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 text-left text-sm transition ${
                      isSelected
                        ? "bg-emerald-50 text-emerald-950"
                        : "bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                    onClick={() => onSelectUser(entry.user_id)}
                    type="button"
                  >
                    <span className="text-lg font-semibold text-zinc-950">
                      {entry.position}
                    </span>
                    <span className="min-w-0">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate font-semibold text-zinc-950">
                          {displayName}
                        </span>
                        {isCurrentUser ? (
                          <span className="rounded-md bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800">
                            Tu
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate text-xs text-zinc-500">
                        {participantHandle(entry)} - {paymentStatusLabel(entry.payment_status)} -{" "}
                        {entry.prize_eligible ? "Elegible a premio" : "Sin premio"}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-xl font-semibold text-zinc-950">
                        {entry.points}
                      </span>
                      <span className="text-xs font-medium text-zinc-500">pts</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="border-t border-zinc-200 px-5 py-4 lg:border-l lg:border-t-0">
            <h3 className="text-sm font-semibold text-zinc-950">Detalle de puntos</h3>
            {message ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {message}
              </p>
            ) : null}
            {!selectedEntry ? (
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                Selecciona un participante para revisar de donde salieron sus puntos.
              </p>
            ) : null}
            {selectedEntry ? (
              <div className="mt-3">
                <p className="text-sm font-semibold text-zinc-950">
                  {rankingDisplayName(selectedEntry)}
                </p>
                <p className="text-xs text-zinc-500">
                  {selectedEntry.event_count} eventos puntuados
                </p>
              </div>
            ) : null}
            {isLoading ? (
              <p className="mt-3 text-sm text-zinc-600">Cargando detalle...</p>
            ) : null}
            {!isLoading && selectedEntry && selectedDetails?.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                Este participante aun no tiene puntos detallados.
              </p>
            ) : null}
            {!isLoading && selectedDetails && selectedDetails.length > 0 ? (
              <ul className="mt-4 divide-y divide-zinc-100 rounded-md border border-zinc-200">
                {selectedDetails.map((detail) => (
                  <li
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-3 text-sm"
                    key={`${
                      detail.prediction_id ||
                      detail.standing_prediction_id ||
                      detail.global_prediction_id
                    }-${detail.rule_code}-${detail.created_at}`}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-zinc-950">
                        {pointEventTitle(detail)}
                      </span>
                      <span className="mt-1 block text-xs text-zinc-500">
                        {scoringRuleLabel(detail.rule_code)} - {detail.explanation}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-semibold text-emerald-800">
                        {formatRankingPoints(detail.points)}
                      </span>
                      <span className="text-xs text-zinc-500">pts</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function PredictionList({
  clockTick,
  drafts,
  underdogBonusesByMatch,
  underdogRule,
  onDownloadSnapshot,
  onLoadSnapshot,
  onSave,
  onSaveStanding,
  onMoveStanding,
  onUpdateDraft,
  pool,
  predictionGroups,
  predictionsByMatch,
  predictionStatusesByMatch,
  saveMessage,
  savingMatchID,
  savingStandingGroupID,
  snapshotDownloadingMatchID,
  snapshotLoadingMatchID,
  snapshotMessages,
  snapshotsByMatchID,
  standingDrafts,
  standingPredictionsByGroup,
  standingSaveMessage,
  tournament,
}: {
  clockTick: number;
  drafts: ScoreDrafts;
  underdogBonusesByMatch: Map<string, MatchUnderdogBonus>;
  underdogRule?: ScoringRule;
  onDownloadSnapshot: (matchID: string) => void;
  onLoadSnapshot: (matchID: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>, match: Match) => void;
  onSaveStanding: (group: PredictionGroup) => void;
  onMoveStanding: (group: PredictionGroup, teamID: string, direction: -1 | 1) => void;
  onUpdateDraft: (matchID: string, side: "home" | "away" | "outcome", value: string) => void;
  pool: Pool | null;
  predictionGroups: PredictionGroup[];
  predictionsByMatch: Map<string, Prediction>;
  predictionStatusesByMatch: Map<string, PredictionMatchStatus>;
  saveMessage: string;
  savingMatchID: string;
  savingStandingGroupID: string;
  snapshotDownloadingMatchID: string;
  snapshotLoadingMatchID: string;
  snapshotMessages: Record<string, string>;
  snapshotsByMatchID: Record<string, PredictionSnapshot>;
  standingDrafts: StandingDrafts;
  standingPredictionsByGroup: Map<string, StandingPrediction>;
  standingSaveMessage: string;
  tournament: Tournament | null;
}) {
  if (!tournament) {
    return (
      <StatusState
        id="pronosticos"
        title="Torneo no disponible"
        message="No encontramos el fixture asociado a esta polla."
      />
    );
  }

  void clockTick;

  if (predictionGroups.length === 0) {
    return (
      <StatusState
        id="pronosticos"
        title="Fixture sin partidos"
        message="Este torneo aun no tiene partidos configurados para pronosticar."
      />
    );
  }
  const firstStandingGroupID =
    predictionGroups.find((group) => group.standings.length > 0)?.id ?? "";

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm" id="pronosticos">
      <div className="flex flex-col gap-2 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-zinc-950">Partidos por pronosticar</h2>
        {saveMessage ? (
          <p className="text-sm font-medium text-emerald-700" role="status">
            {saveMessage}
          </p>
        ) : null}
        {standingSaveMessage ? (
          <p className="text-sm font-medium text-emerald-700" role="status">
            {standingSaveMessage}
          </p>
        ) : null}
      </div>
      <div className="divide-y divide-zinc-200">
        {predictionGroups.map((group) => (
          <section aria-labelledby={`${group.id}-title`} key={group.id}>
            <div className="grid gap-3 bg-zinc-50 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div>
                <p className="text-xs font-medium uppercase text-sky-700">{group.subtitle}</p>
                <h3
                  className="mt-1 text-base font-semibold tracking-normal text-zinc-950"
                  id={`${group.id}-title`}
                >
                  {group.title}
                </h3>
              </div>
              <dl className="grid gap-2 text-xs text-zinc-600 sm:grid-cols-4">
                <MetricItem label="Partidos" value={group.stats.total} />
                <MetricItem
                  label="Pronosticados"
                  value={`${group.stats.predicted}/${group.stats.total}`}
                />
                <MetricItem label="Faltantes" value={group.stats.missing} />
                <MetricItem label="Cerrados" value={group.stats.closed} />
              </dl>
            </div>
            {group.standings.length > 0 ? (
              <div
                className="grid border-t border-zinc-200 lg:grid-cols-2"
                id={group.id === firstStandingGroupID ? "posiciones" : undefined}
              >
                <SuggestedStandingsTable rows={group.standings} />
                <StandingOrderEditor
                  group={group}
                  isClosed={isStandingPredictionClosed(
                    group.matches,
                    pool?.prediction_close_hours_before,
                  )}
                  isSaving={savingStandingGroupID === group.id}
                  onMove={onMoveStanding}
                  onSave={onSaveStanding}
                  rows={orderStandingRows(
                    group.standings,
                    resolveStandingTeamIDs(
                      group,
                      standingPredictionsByGroup,
                      standingDrafts,
                    ),
                  )}
                />
              </div>
            ) : null}
            <div className="divide-y divide-zinc-100">
              {group.matches.map((match) => (
                <MatchPredictionForm
                  draft={drafts[match.id] ?? emptyPredictionDraft()}
                  key={match.id}
                  match={match}
                  underdogBonus={underdogBonusesByMatch.get(match.id)}
                  underdogRule={underdogRule}
                  onDownloadSnapshot={onDownloadSnapshot}
                  onLoadSnapshot={onLoadSnapshot}
                  onSave={onSave}
                  onUpdateDraft={onUpdateDraft}
                  prediction={predictionsByMatch.get(match.id)}
                  predictionCloseHoursBefore={pool?.prediction_close_hours_before}
                  predictionMode={pool?.prediction_mode ?? "score_with_outcome"}
                  predictionStatus={predictionStatusesByMatch.get(match.id)}
                  savingMatchID={savingMatchID}
                  snapshot={snapshotsByMatchID[match.id]}
                  snapshotDownloadInProgress={snapshotDownloadingMatchID === match.id}
                  snapshotLoadInProgress={snapshotLoadingMatchID === match.id}
                  snapshotMessage={snapshotMessages[match.id] ?? ""}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function SuggestedStandingsTable({ rows }: { rows: SuggestedStandingRow[] }) {
  return (
    <div className="px-5 py-4 lg:border-r lg:border-zinc-200">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-sm font-semibold text-zinc-950">Tabla sugerida</h4>
        <p className="text-xs text-zinc-500">Calculada con tus marcadores guardados</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="w-10 py-2 pr-3 font-medium">#</th>
              <th className="py-2 pr-3 font-medium">Equipo</th>
              <th className="py-2 pr-3 text-right font-medium">PJ</th>
              <th className="py-2 pr-3 text-right font-medium">Pts</th>
              <th className="py-2 pr-3 text-right font-medium">GF</th>
              <th className="py-2 pr-3 text-right font-medium">GC</th>
              <th className="py-2 pr-3 text-right font-medium">DG</th>
              <th className="py-2 text-right font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b border-zinc-100" key={row.key}>
                <td className="py-2 pr-3 font-semibold text-zinc-950">{row.position}</td>
                <td className="py-2 pr-3">
                  <span className="font-semibold text-zinc-950">{row.teamName}</span>
                  <span className="ml-2 text-xs text-zinc-500">{row.teamShortName}</span>
                </td>
                <td className="py-2 pr-3 text-right text-zinc-700">{row.played}</td>
                <td className="py-2 pr-3 text-right font-semibold text-zinc-950">
                  {row.points}
                </td>
                <td className="py-2 pr-3 text-right text-zinc-700">{row.goalsFor}</td>
                <td className="py-2 pr-3 text-right text-zinc-700">{row.goalsAgainst}</td>
                <td className="py-2 pr-3 text-right text-zinc-700">
                  {formatGoalDifference(row.goalDifference)}
                </td>
                <td className="py-2 text-right">
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      row.complete
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {row.complete ? "Completo" : "Incompleto"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StandingOrderEditor({
  group,
  isClosed,
  isSaving,
  onMove,
  onSave,
  rows,
}: {
  group: PredictionGroup;
  isClosed: boolean;
  isSaving: boolean;
  onMove: (group: PredictionGroup, teamID: string, direction: -1 | 1) => void;
  onSave: (group: PredictionGroup) => void;
  rows: SuggestedStandingRow[];
}) {
  return (
    <div className="px-5 py-4">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-sm font-semibold text-zinc-950">Mi orden final</h4>
        <span
          className={`w-fit rounded-md px-2 py-1 text-xs font-medium ${
            isClosed ? "bg-zinc-100 text-zinc-600" : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {isClosed ? "Cerrado" : "Abierto"}
        </span>
      </div>
      <ol className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
        {rows.map((row, index) => (
          <li
            className="grid min-h-14 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-sm"
            key={row.key}
          >
            <span className="font-semibold text-zinc-950">{index + 1}</span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-zinc-950">{row.teamName}</span>
              <span className="text-xs text-zinc-500">{row.teamShortName}</span>
            </span>
            <span className="flex gap-1">
              <button
                aria-label={`Subir ${row.teamName}`}
                className="min-w-14 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={index === 0 || isClosed || isSaving}
                onClick={() => onMove(group, row.key, -1)}
                type="button"
              >
                Subir
              </button>
              <button
                aria-label={`Bajar ${row.teamName}`}
                className="min-w-14 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={index === rows.length - 1 || isClosed || isSaving}
                onClick={() => onMove(group, row.key, 1)}
                type="button"
              >
                Bajar
              </button>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex justify-end">
        <button
          className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={isClosed || isSaving}
          onClick={() => onSave(group)}
          type="button"
        >
          {isSaving ? "Guardando..." : "Guardar orden"}
        </button>
      </div>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-20">
      <dt className="font-medium text-zinc-500">{label}</dt>
      <dd className="mt-1 font-semibold text-zinc-950">{value}</dd>
    </div>
  );
}

function MatchPredictionForm({
  draft,
  match,
  underdogBonus,
  underdogRule,
  onDownloadSnapshot,
  onLoadSnapshot,
  onSave,
  onUpdateDraft,
  prediction,
  predictionCloseHoursBefore,
  predictionMode,
  predictionStatus,
  savingMatchID,
  snapshot,
  snapshotDownloadInProgress,
  snapshotLoadInProgress,
  snapshotMessage,
}: {
  draft: ScoreDrafts[string];
  match: Match;
  underdogBonus?: MatchUnderdogBonus;
  underdogRule?: ScoringRule;
  onDownloadSnapshot: (matchID: string) => void;
  onLoadSnapshot: (matchID: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>, match: Match) => void;
  onUpdateDraft: (matchID: string, side: "home" | "away" | "outcome", value: string) => void;
  prediction?: Prediction;
  predictionCloseHoursBefore?: number;
  predictionMode: Pool["prediction_mode"];
  predictionStatus?: PredictionMatchStatus;
  savingMatchID: string;
  snapshot?: PredictionSnapshot;
  snapshotDownloadInProgress: boolean;
  snapshotLoadInProgress: boolean;
  snapshotMessage: string;
}) {
  const localClosed =
    typeof predictionCloseHoursBefore === "number"
      ? isMatchClosed(match, predictionCloseHoursBefore)
      : false;
  const closed = localClosed || predictionStatus?.closed === true;
  const homeName = match.home_team?.name ?? match.home_slot;
  const awayName = match.away_team?.name ?? match.away_slot;
  const statusCode =
    predictionStatus?.status ?? (closed ? "closed" : prediction ? "complete" : "pending");
  const officialResult = predictionStatus?.official_result;
  const activeUnderdogOutcome =
    underdogBonus?.enabled === true && underdogRule?.enabled === true
      ? matchOutcomeValue(underdogBonus.outcome)
      : "";
  const activeUnderdogPoints = activeUnderdogOutcome ? underdogRule?.points ?? 0 : 0;

  return (
    <div className="px-5 py-4">
      <form
        className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_minmax(190px,auto)]"
        onSubmit={(event) => onSave(event, match)}
      >
        <div>
          <p className="text-xs font-medium text-zinc-500">Partido {match.match_number}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-950">
            <span>{homeName}</span>
            <span className="text-zinc-400">vs</span>
            <span>{awayName}</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {formatMatchDate(match.starts_at)} - {match.venue}
          </p>
        </div>

        {predictionMode === "outcome" ? (
          <OutcomePredictionControl
            awayName={awayName}
            closed={closed}
            homeName={homeName}
            matchID={match.id}
            onUpdateDraft={onUpdateDraft}
            underdogBonusPoints={activeUnderdogPoints}
            underdogOutcome={activeUnderdogOutcome}
            value={draft.outcome}
          />
        ) : (
          <ScorePredictionControl
            awayLabel={match.away_team?.short_name ?? match.away_slot}
            awayName={awayName}
            closed={closed}
            draft={draft}
            homeLabel={match.home_team?.short_name ?? match.home_slot}
            homeName={homeName}
            matchID={match.id}
            onUpdateDraft={onUpdateDraft}
            showDerivedOutcome={predictionMode === "score_with_outcome"}
            underdogBonusPoints={activeUnderdogPoints}
            underdogOutcome={activeUnderdogOutcome}
          />
        )}

        <div className="flex flex-wrap items-end gap-2 lg:justify-end">
          <span
            className={`rounded-md px-2 py-1 text-xs font-medium ${predictionStatusBadgeClass(
              statusCode,
            )}`}
          >
            {predictionStatusLabel(statusCode)}
          </span>
          {officialResult ? (
            <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800">
              Resultado {officialResult.home_score}-{officialResult.away_score}
            </span>
          ) : null}
          {predictionStatus?.scored ? (
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
              {formatPoints(predictionStatus.points)}
            </span>
          ) : null}
          <button
            className="h-10 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={closed || savingMatchID === match.id}
            type="submit"
          >
            {savingMatchID === match.id ? "Guardando" : "Guardar"}
          </button>
        </div>
      </form>

      {closed ? (
        <PredictionSnapshotPanel
          downloadInProgress={snapshotDownloadInProgress}
          loadInProgress={snapshotLoadInProgress}
          message={snapshotMessage}
          onDownload={() => onDownloadSnapshot(match.id)}
          onLoad={() => onLoadSnapshot(match.id)}
          snapshot={snapshot}
        />
      ) : null}
    </div>
  );
}

function ScorePredictionControl({
  awayLabel,
  awayName,
  closed,
  draft,
  homeLabel,
  homeName,
  matchID,
  onUpdateDraft,
  showDerivedOutcome,
  underdogBonusPoints,
  underdogOutcome,
}: {
  awayLabel: string;
  awayName: string;
  closed: boolean;
  draft: ScoreDrafts[string];
  homeLabel: string;
  homeName: string;
  matchID: string;
  onUpdateDraft: (matchID: string, side: "home" | "away" | "outcome", value: string) => void;
  showDerivedOutcome: boolean;
  underdogBonusPoints: number;
  underdogOutcome: MatchOutcome | "";
}) {
  const derivedOutcome = outcomeFromDraftScore(draft);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          <span>{homeLabel}</span>
          <input
            aria-label={`Marcador ${homeName}`}
            className="h-10 rounded-md border border-zinc-300 px-3 text-base font-semibold text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100"
            disabled={closed}
            min={0}
            onChange={(event) => onUpdateDraft(matchID, "home", event.target.value)}
            step={1}
            type="number"
            value={draft.home}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          <span>{awayLabel}</span>
          <input
            aria-label={`Marcador ${awayName}`}
            className="h-10 rounded-md border border-zinc-300 px-3 text-base font-semibold text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100"
            disabled={closed}
            min={0}
            onChange={(event) => onUpdateDraft(matchID, "away", event.target.value)}
            step={1}
            type="number"
            value={draft.away}
          />
        </label>
      </div>
      {showDerivedOutcome && derivedOutcome ? (
        <p className="mt-2 text-xs font-medium text-zinc-500">
          Resultado: {matchOutcomeLabel(derivedOutcome)}
        </p>
      ) : null}
      {underdogOutcome ? (
        <p className="mt-2 inline-flex w-fit items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
          <span aria-hidden="true">★</span>
          Sorpresa: {matchOutcomeLabel(underdogOutcome)} +{underdogBonusPoints} pts
        </p>
      ) : null}
    </div>
  );
}

function OutcomePredictionControl({
  awayName,
  closed,
  homeName,
  matchID,
  onUpdateDraft,
  underdogBonusPoints,
  underdogOutcome,
  value,
}: {
  awayName: string;
  closed: boolean;
  homeName: string;
  matchID: string;
  onUpdateDraft: (matchID: string, side: "home" | "away" | "outcome", value: string) => void;
  underdogBonusPoints: number;
  underdogOutcome: MatchOutcome | "";
  value: MatchOutcome | "";
}) {
  const options: Array<{ value: MatchOutcome; label: string }> = [
    { value: "home", label: "Local" },
    { value: "draw", label: "Empate" },
    { value: "away", label: "Visitante" },
  ];

  return (
    <fieldset className="grid gap-2">
      <legend className="sr-only">
        Resultado {homeName} contra {awayName}
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          const isUnderdog = underdogOutcome === option.value;
          return (
            <button
              aria-pressed={selected}
              className={`h-10 rounded-md border px-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
              }`}
              disabled={closed}
              key={option.value}
              onClick={() => onUpdateDraft(matchID, "outcome", option.value)}
              title={isUnderdog ? `Bonus sorpresa +${underdogBonusPoints} puntos` : undefined}
              type="button"
            >
              <span className="inline-flex items-center justify-center gap-1">
                {option.label}
                {isUnderdog ? <span aria-hidden="true">★</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function PredictionSnapshotPanel({
  downloadInProgress,
  loadInProgress,
  message,
  onDownload,
  onLoad,
  snapshot,
}: {
  downloadInProgress: boolean;
  loadInProgress: boolean;
  message: string;
  onDownload: () => void;
  onLoad: () => void;
  snapshot?: PredictionSnapshot;
}) {
  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-zinc-950">Pronosticos cerrados</h4>
          <p className="mt-1 text-xs text-zinc-500">
            {snapshot
              ? `${snapshot.row_count} participantes - checksum ${snapshot.checksum.slice(0, 10)}`
              : "Disponibles para auditoria cuando el partido ya cerro."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loadInProgress}
            onClick={onLoad}
            type="button"
          >
            {loadInProgress ? "Cargando..." : snapshot ? "Actualizar vista" : "Ver pronosticos"}
          </button>
          <button
            className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={downloadInProgress}
            onClick={onDownload}
            type="button"
          >
            {downloadInProgress ? "Descargando..." : "Descargar CSV"}
          </button>
        </div>
      </div>
      {message ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {message}
        </p>
      ) : null}
      {snapshot ? <PredictionSnapshotTable snapshot={snapshot} /> : null}
    </div>
  );
}

function PredictionSnapshotTable({ snapshot }: { snapshot: PredictionSnapshot }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-y border-zinc-200 text-xs uppercase text-zinc-500">
            <th className="py-2 pr-3 font-medium">Participante</th>
            <th className="py-2 pr-3 font-medium">Estado</th>
            <th className="py-2 pr-3 text-right font-medium">Pronostico</th>
            <th className="py-2 text-right font-medium">Actualizado</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.entries.map((entry) => (
            <tr className="border-b border-zinc-100" key={`${entry.user_id}-${entry.id}`}>
              <td className="py-2 pr-3">
                <span className="block font-semibold text-zinc-950">
                  {entry.participant_name}
                </span>
                <span className="text-xs text-zinc-500">{entry.user_id}</span>
              </td>
              <td className="py-2 pr-3">
                <span
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    entry.has_prediction
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {entry.has_prediction ? "Pronosticado" : "Sin pronostico"}
                </span>
              </td>
              <td className="py-2 pr-3 text-right font-semibold text-zinc-950">
                {predictionSnapshotScore(entry)}
              </td>
              <td className="py-2 text-right text-xs text-zinc-500">
                {entry.updated_at ? formatMatchDate(entry.updated_at) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoadingState() {
  return (
    <StatusState
      title="Cargando tus pollas"
      message="Estamos consultando tus pronosticos."
    />
  );
}

function SignedOutState() {
  return (
    <section className="mx-auto grid max-w-5xl gap-6 px-5 py-10 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-sky-700">Portal del participante</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
          Entra para completar tus marcadores
        </h2>
        <p className="mt-3 text-base leading-7 text-zinc-600">
          Tus pollas, partidos pendientes y resumen de avance quedan disponibles
          despues de iniciar sesion.
        </p>
        <div className="mt-6 flex gap-2">
          <Link
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            href="/login"
          >
            Entrar
          </Link>
          <Link
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-400"
            href="/register"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        <Metric label="Resumen" value="0/0" />
        <Metric label="Faltantes" value="0" />
        <Metric label="Cerrados" value="0" />
      </div>
    </section>
  );
}

function StatusState({
  action,
  id,
  message,
  title,
}: {
  action?: () => void;
  id?: string;
  message: string;
  title: string;
}) {
  return (
    <section className="mx-auto max-w-5xl px-5 py-10" id={id}>
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-zinc-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{message}</p>
        {action ? (
          <button
            className="mt-4 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            onClick={action}
            type="button"
          >
            Reintentar
          </button>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function readStoredSession() {
  const rawSession = window.localStorage.getItem(sessionStorageKey);
  if (!rawSession) {
    return null;
  }

  try {
    const storedSession = JSON.parse(rawSession) as unknown;
    if (!isAuthSession(storedSession) || isSessionExpired(storedSession)) {
      clearStoredSession();
      return null;
    }

    return storedSession;
  } catch {
    clearStoredSession();
    return null;
  }
}

function clearStoredSession() {
  window.localStorage.removeItem(sessionStorageKey);
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value) || !isRecord(value.user)) {
    return false;
  }

  return (
    typeof value.token === "string" &&
    value.token.trim() !== "" &&
    typeof value.expiresAt === "string" &&
    typeof value.user.id === "string" &&
    typeof value.user.username === "string"
  );
}

function isSessionExpired(session: AuthSession) {
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isNaN(expiresAt) || expiresAt <= Date.now();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUnauthorizedError(error: unknown) {
  return error instanceof PollavarAPIError && error.status === 401;
}

function isPredictionClosedError(error: unknown) {
  return error instanceof PollavarAPIError && error.status === 409 && error.code === "prediction_closed";
}

function snapshotErrorMessage(error: unknown) {
  if (error instanceof PollavarAPIError && error.code === "prediction_open") {
    return "Los pronosticos de este partido aun no han cerrado.";
  }
  return "No pudimos cargar los pronosticos cerrados.";
}

function predictionSnapshotScore(entry: PredictionSnapshot["entries"][number]) {
  if (!entry.has_prediction) {
    return "-";
  }
  if (entry.home_score === null || entry.away_score === null) {
    return matchOutcomeLabel(entry.outcome);
  }
  return `${entry.home_score}-${entry.away_score}`;
}

function matchOutcomeLabel(outcome: string) {
  switch (outcome) {
    case "home":
      return "Local";
    case "draw":
      return "Empate";
    case "away":
      return "Visitante";
    default:
      return "-";
  }
}

function predictionHasScore(prediction: Prediction) {
  return prediction.has_score !== false;
}

function predictionScoreDraft(prediction: Prediction | undefined): ScoreDrafts[string] {
  if (!prediction || !predictionHasScore(prediction)) {
    return { ...emptyPredictionDraft(), outcome: matchOutcomeValue(prediction?.outcome ?? "") };
  }
  return {
    home: String(prediction.home_score),
    away: String(prediction.away_score),
    outcome: matchOutcomeValue(prediction.outcome),
  };
}

function emptyPredictionDraft(): ScoreDrafts[string] {
  return { home: "", away: "", outcome: "" };
}

function downloadTextFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const href = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(href);
}

function fileNamePart(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "snapshot";
}

async function listPredictionStatusesWithFallback(
  client: ReturnType<typeof createPollavarClient>,
  token: string,
  poolID: string,
) {
  try {
    return await client.listPredictionStatuses(token, poolID);
  } catch (error) {
    if (isMissingEndpointError(error)) {
      return [];
    }
    throw error;
  }
}

async function listScoringRulesWithFallback(
  client: ReturnType<typeof createPollavarClient>,
  token: string,
  poolID: string,
) {
  try {
    return await client.listScoringRules(token, poolID);
  } catch (error) {
    if (isMissingEndpointError(error)) {
      return defaultScoringRules;
    }
    throw error;
  }
}

async function listMatchUnderdogBonusesWithFallback(
  client: ReturnType<typeof createPollavarClient>,
  token: string,
  poolID: string,
) {
  try {
    return await client.listMatchUnderdogBonuses(token, poolID);
  } catch (error) {
    if (isMissingEndpointError(error)) {
      return [];
    }
    throw error;
  }
}

async function listGlobalPredictionDefinitionsWithFallback(
  client: ReturnType<typeof createPollavarClient>,
  token: string,
  poolID: string,
) {
  try {
    return await client.listGlobalPredictionDefinitions(token, poolID);
  } catch (error) {
    if (isMissingEndpointError(error)) {
      return [];
    }
    throw error;
  }
}

async function listGlobalPredictionsWithFallback(
  client: ReturnType<typeof createPollavarClient>,
  token: string,
  poolID: string,
) {
  try {
    return await client.listGlobalPredictions(token, poolID);
  } catch (error) {
    if (isMissingEndpointError(error)) {
      return [];
    }
    throw error;
  }
}

async function listGlobalPredictionResultsWithFallback(
  client: ReturnType<typeof createPollavarClient>,
  token: string,
  poolID: string,
) {
  try {
    return await client.listGlobalPredictionResults(token, poolID);
  } catch (error) {
    if (isMissingEndpointError(error)) {
      return [];
    }
    throw error;
  }
}

async function listRankingWithFallback(
  client: ReturnType<typeof createPollavarClient>,
  token: string,
  poolID: string,
) {
  try {
    return await client.listRanking(token, poolID);
  } catch (error) {
    if (isMissingEndpointError(error)) {
      return [];
    }
    throw error;
  }
}

async function getPrizePreviewWithFallback(
  client: ReturnType<typeof createPollavarClient>,
  token: string,
  poolID: string,
) {
  try {
    return await client.getPrizePreview(token, poolID);
  } catch (error) {
    if (isMissingEndpointError(error)) {
      return {
        pool_id: poolID,
        currency: "COP",
        confirmed_total_cents: 0,
        rules: [],
        payouts: [],
      } satisfies PrizePreview;
    }
    throw error;
  }
}

async function getGlobalPrizePreviewWithFallback(
  client: ReturnType<typeof createPollavarClient>,
  token: string,
  poolID: string,
) {
  try {
    return await client.getGlobalPredictionPrizePreview(token, poolID);
  } catch (error) {
    if (isMissingEndpointError(error)) {
      return {
        pool_id: poolID,
        currency: "COP",
        confirmed_total_cents: 0,
        prizes: [],
      } satisfies GlobalPredictionPrizePreview;
    }
    throw error;
  }
}

async function listPointDetailsWithFallback(
  client: ReturnType<typeof createPollavarClient>,
  token: string,
  poolID: string,
  userID: string,
) {
  try {
    return await client.listPointDetails(token, poolID, userID);
  } catch (error) {
    if (isMissingEndpointError(error)) {
      return [];
    }
    throw error;
  }
}

function isMissingEndpointError(error: unknown) {
  return error instanceof PollavarAPIError && error.status === 404 && error.code === "unknown_error";
}

function groupMatchesForPredictions(
  matches: Match[],
  predictionsByMatch: Map<string, Prediction>,
  predictionCloseHoursBefore?: number,
  clockTick = 0,
) {
  void clockTick;
  const indexedGroups = new Map<string, PredictionGroupDraft>();

  for (const match of matches) {
    const groupID = predictionGroupID(match);
    const currentGroup =
      indexedGroups.get(groupID) ??
      ({
        id: groupID,
        title: predictionGroupTitle(match),
        subtitle: predictionGroupSubtitle(match),
        matches: [],
      } satisfies PredictionGroupDraft);

    currentGroup.matches.push(match);
    indexedGroups.set(groupID, currentGroup);
  }

  return [...indexedGroups.values()]
    .map((group) => {
      const sortedMatches = [...group.matches].sort(
        (first, second) => first.match_number - second.match_number,
      );
      const predicted = sortedMatches.filter((match) => predictionsByMatch.has(match.id)).length;
      const closed =
        typeof predictionCloseHoursBefore === "number"
          ? sortedMatches.filter((match) => isMatchClosed(match, predictionCloseHoursBefore)).length
          : 0;

      return {
        ...group,
        matches: sortedMatches,
        standings: buildSuggestedStandings(sortedMatches, predictionsByMatch),
        stats: {
          total: sortedMatches.length,
          predicted,
          missing: sortedMatches.length - predicted,
          closed,
        },
      };
    })
    .sort((first, second) => first.matches[0].match_number - second.matches[0].match_number);
}

function buildSuggestedStandings(matches: Match[], predictionsByMatch: Map<string, Prediction>) {
  if (!shouldBuildStandings(matches)) {
    return [];
  }

  const rowsByTeam = new Map<string, Omit<SuggestedStandingRow, "complete" | "position">>();

  for (const match of matches) {
    const homeKey = matchTeamKey(match.home_team, match.home_slot);
    const awayKey = matchTeamKey(match.away_team, match.away_slot);

    ensureStandingRow(rowsByTeam, match.home_team, match.home_slot).expectedMatches += 1;
    ensureStandingRow(rowsByTeam, match.away_team, match.away_slot).expectedMatches += 1;

    const prediction = predictionsByMatch.get(match.id);
    if (!prediction || !predictionHasScore(prediction)) {
      continue;
    }

    const homeRow = rowsByTeam.get(homeKey);
    const awayRow = rowsByTeam.get(awayKey);
    if (!homeRow || !awayRow) {
      continue;
    }

    homeRow.played += 1;
    awayRow.played += 1;
    homeRow.goalsFor += prediction.home_score;
    homeRow.goalsAgainst += prediction.away_score;
    awayRow.goalsFor += prediction.away_score;
    awayRow.goalsAgainst += prediction.home_score;

    if (prediction.home_score > prediction.away_score) {
      homeRow.points += 3;
    } else if (prediction.home_score < prediction.away_score) {
      awayRow.points += 3;
    } else {
      homeRow.points += 1;
      awayRow.points += 1;
    }
  }

  return [...rowsByTeam.values()]
    .map((row) => ({
      ...row,
      complete: row.played === row.expectedMatches,
      goalDifference: row.goalsFor - row.goalsAgainst,
      position: 0,
    }))
    .sort(compareStandingRows)
    .map((row, index) => ({
      ...row,
      position: index + 1,
    }));
}

function shouldBuildStandings(matches: Match[]) {
  if (matches.length === 0) {
    return false;
  }

  return matches.some(hasStandingContext) || uniqueStandingTeamKeys(matches).size > 2;
}

function hasStandingContext(match: Match) {
  const groupName = match.group_name.trim();
  const groupID = match.group_id.toLowerCase();
  const stageID = match.stage_id.toLowerCase();
  return (
    groupName !== "" ||
    groupID.includes("group") ||
    stageID.includes("group") ||
    stageID.includes("league") ||
    stageID.includes("regular") ||
    stageID.includes("round-robin")
  );
}

function uniqueStandingTeamKeys(matches: Match[]) {
  const teamKeys = new Set<string>();
  for (const match of matches) {
    teamKeys.add(matchTeamKey(match.home_team, match.home_slot));
    teamKeys.add(matchTeamKey(match.away_team, match.away_slot));
  }
  return teamKeys;
}

function ensureStandingRow(
  rowsByTeam: Map<string, Omit<SuggestedStandingRow, "complete" | "position">>,
  team: Match["home_team"],
  slot: string,
) {
  const key = matchTeamKey(team, slot);
  const existingRow = rowsByTeam.get(key);
  if (existingRow) {
    return existingRow;
  }

  const row = {
    key,
    teamName: matchTeamName(team, slot),
    teamShortName: matchTeamShortName(team, slot),
    played: 0,
    expectedMatches: 0,
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
  };
  rowsByTeam.set(key, row);
  return row;
}

function compareStandingRows(first: SuggestedStandingRow, second: SuggestedStandingRow) {
  return (
    second.points - first.points ||
    second.goalDifference - first.goalDifference ||
    second.goalsFor - first.goalsFor ||
    first.teamName.localeCompare(second.teamName)
  );
}

function matchTeamKey(team: Match["home_team"], slot: string) {
  return team?.id || slot;
}

function matchTeamName(team: Match["home_team"], slot: string) {
  return team?.name || slot;
}

function matchTeamShortName(team: Match["home_team"], slot: string) {
  return team?.short_name || slot;
}

function formatGoalDifference(value: number) {
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
}

function predictionGroupID(match: Match) {
  const stageID = normalizeGroupPart(match.stage_id || "stage-pending");
  const groupID = normalizeGroupPart(match.group_id || match.group_name || "general");
  return `prediction-group-${stageID}-${groupID}`;
}

function predictionGroupTitle(match: Match) {
  const groupName = match.group_name.trim();
  if (groupName) {
    return `Grupo ${groupName}`;
  }

  return formatStageName(match.stage_id);
}

function predictionGroupSubtitle(match: Match) {
  if (match.group_name.trim()) {
    return formatStageName(match.stage_id);
  }

  return "Ronda";
}

function formatStageName(stageID: string) {
  const normalizedStage = stageID.toLowerCase();
  if (normalizedStage.includes("group")) {
    return "Fase de grupos";
  }
  if (normalizedStage.includes("round-of-32") || normalizedStage.includes("r32")) {
    return "Ronda de 32";
  }
  if (normalizedStage.includes("round-of-16") || normalizedStage.includes("r16")) {
    return "Octavos de final";
  }
  if (normalizedStage.includes("quarter")) {
    return "Cuartos de final";
  }
  if (normalizedStage.includes("semi")) {
    return "Semifinales";
  }
  if (normalizedStage.includes("third")) {
    return "Tercer puesto";
  }
  if (normalizedStage.includes("final")) {
    return "Final";
  }

  return toTitleCase(stageID.replace(/[-_]+/g, " "));
}

function normalizeGroupPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function indexPredictions(predictions: Prediction[]) {
  const indexed = new Map<string, Prediction>();
  for (const prediction of predictions) {
    indexed.set(prediction.match_id, prediction);
  }
  return indexed;
}

function indexPredictionStatuses(statuses: PredictionMatchStatus[]) {
  const indexed = new Map<string, PredictionMatchStatus>();
  for (const status of statuses) {
    indexed.set(status.match_id, status);
  }
  return indexed;
}

function indexStandingPredictions(predictions: StandingPrediction[]) {
  const indexed = new Map<string, StandingPrediction>();
  for (const prediction of predictions) {
    indexed.set(prediction.group_id, prediction);
  }
  return indexed;
}

function indexUnderdogBonuses(bonuses: MatchUnderdogBonus[]) {
  const indexed = new Map<string, MatchUnderdogBonus>();
  for (const bonus of bonuses) {
    indexed.set(bonus.match_id, bonus);
  }
  return indexed;
}

function resolveStandingTeamIDs(
  group: PredictionGroup,
  standingPredictionsByGroup: Map<string, StandingPrediction>,
  standingDrafts: StandingDrafts,
) {
  const draft = standingDrafts[group.id];
  if (draft && draft.length > 0) {
    return draft;
  }

  const saved = standingPredictionsByGroup.get(group.id)?.team_ids;
  if (saved && saved.length > 0) {
    return saved;
  }

  return group.standings.map((row) => row.key);
}

function orderStandingRows(rows: SuggestedStandingRow[], teamIDs: string[]) {
  const rowsByID = new Map(rows.map((row) => [row.key, row]));
  const orderedRows: SuggestedStandingRow[] = [];
  const added = new Set<string>();

  for (const teamID of teamIDs) {
    const row = rowsByID.get(teamID);
    if (!row || added.has(teamID)) {
      continue;
    }
    orderedRows.push(row);
    added.add(teamID);
  }

  for (const row of rows) {
    if (!added.has(row.key)) {
      orderedRows.push(row);
    }
  }

  return orderedRows;
}

function upsertStandingPrediction(
  predictions: StandingPrediction[],
  nextPrediction: StandingPrediction,
) {
  const nextPredictions = predictions.filter(
    (prediction) => prediction.group_id !== nextPrediction.group_id,
  );
  nextPredictions.push(nextPrediction);
  return nextPredictions;
}

function upsertGlobalPrediction(
  predictions: GlobalPrediction[],
  nextPrediction: GlobalPrediction,
) {
  const nextPredictions = predictions.filter(
    (prediction) => prediction.code !== nextPrediction.code,
  );
  nextPredictions.push(nextPrediction);
  return nextPredictions;
}

function hydrateDrafts(matches: Match[], predictions: Prediction[]) {
  const indexed = indexPredictions(predictions);
  const nextDrafts: ScoreDrafts = {};
  for (const match of matches) {
    nextDrafts[match.id] = predictionScoreDraft(indexed.get(match.id));
  }
  return nextDrafts;
}

function hydrateGlobalDrafts(
  definitions: GlobalPredictionDefinition[],
  predictions: GlobalPrediction[],
) {
  const predictionsByCode = indexGlobalPredictions(predictions);
  const nextDrafts: GlobalPredictionDrafts = {};
  for (const definition of definitions) {
    nextDrafts[definition.code] = globalPredictionDraft(predictionsByCode.get(definition.code));
  }
  return nextDrafts;
}

function indexGlobalPredictions(predictions: GlobalPrediction[]) {
  const indexed = new Map<string, GlobalPrediction>();
  for (const prediction of predictions) {
    indexed.set(prediction.code, prediction);
  }
  return indexed;
}

function indexGlobalPredictionResults(results: GlobalPredictionResult[]) {
  const indexed = new Map<string, GlobalPredictionResult>();
  for (const result of results) {
    indexed.set(result.code, result);
  }
  return indexed;
}

function emptyGlobalPredictionDraft(): GlobalPredictionDrafts[string] {
  return { valueText: "", valueNumber: "", rangeMin: "", rangeMax: "" };
}

function globalPredictionDraft(
  prediction: GlobalPrediction | GlobalPredictionResult | undefined,
): GlobalPredictionDrafts[string] {
  if (!prediction) {
    return emptyGlobalPredictionDraft();
  }

  return {
    valueText: prediction.value_text ?? "",
    valueNumber:
      typeof prediction.value_number === "number" ? String(prediction.value_number) : "",
    rangeMin: typeof prediction.range_min === "number" ? String(prediction.range_min) : "",
    rangeMax: typeof prediction.range_max === "number" ? String(prediction.range_max) : "",
  };
}

function predictionInputFromDraft(pool: Pool, draft: ScoreDrafts[string]) {
  if (pool.prediction_mode === "outcome") {
    return draft.outcome ? { outcome: draft.outcome } : null;
  }

  const homeScore = Number(draft.home);
  const awayScore = Number(draft.away);
  if (
    draft.home === "" ||
    draft.away === "" ||
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore) ||
    homeScore < 0 ||
    awayScore < 0
  ) {
    return null;
  }

  return {
    home_score: homeScore,
    away_score: awayScore,
  };
}

function globalPredictionInputFromDraft(
  definition: GlobalPredictionDefinition,
  draft: GlobalPredictionDrafts[string],
) {
  if (
    definition.value_type === "team" ||
    definition.value_type === "player" ||
    definition.value_type === "text"
  ) {
    const valueText = draft.valueText.trim();
    return valueText ? { value_text: valueText } : null;
  }

  if (definition.value_type === "number") {
    const valueNumber = parseWholeNumber(draft.valueNumber);
    return valueNumber === null ? null : { value_number: valueNumber };
  }

  const rangeMin = parseWholeNumber(draft.rangeMin);
  const rangeMax = parseWholeNumber(draft.rangeMax);
  if (rangeMin === null || rangeMax === null || rangeMax < rangeMin) {
    return null;
  }

  return { range_min: rangeMin, range_max: rangeMax };
}

function isGlobalDefinitionClosed(definition: GlobalPredictionDefinition) {
  if (!definition.closes_at) {
    return false;
  }

  const closesAt = Date.parse(definition.closes_at);
  return Number.isFinite(closesAt) && Date.now() >= closesAt;
}

function tournamentTeamOptions(tournament: Tournament | null) {
  const teamsByID = new Map<string, TournamentTeamOption>();
  for (const group of tournament?.groups ?? []) {
    for (const team of group.teams) {
      teamsByID.set(team.id || team.name, team);
    }
  }
  return [...teamsByID.values()].sort((left, right) => left.name.localeCompare(right.name, "es"));
}

function outcomeFromDraftScore(draft: ScoreDrafts[string]): MatchOutcome | "" {
  const homeScore = Number(draft.home);
  const awayScore = Number(draft.away);
  if (
    draft.home === "" ||
    draft.away === "" ||
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore)
  ) {
    return "";
  }
  if (homeScore > awayScore) {
    return "home";
  }
  if (homeScore < awayScore) {
    return "away";
  }
  return "draw";
}

function matchOutcomeValue(value: string): MatchOutcome | "" {
  switch (value) {
    case "home":
      return "home";
    case "draw":
      return "draw";
    case "away":
      return "away";
    default:
      return "";
  }
}

function predictionStatusLabel(status: PredictionMatchStatus["status"]) {
  switch (status) {
    case "scored":
      return "Puntuado";
    case "official_result":
      return "Con resultado";
    case "closed":
      return "Cerrado";
    case "complete":
      return "Completo";
    case "pending":
    default:
      return "Pendiente";
  }
}

function predictionStatusBadgeClass(status: PredictionMatchStatus["status"]) {
  switch (status) {
    case "scored":
      return "bg-emerald-100 text-emerald-800";
    case "official_result":
      return "bg-sky-100 text-sky-800";
    case "closed":
      return "bg-zinc-100 text-zinc-600";
    case "complete":
      return "bg-emerald-50 text-emerald-800";
    case "pending":
    default:
      return "bg-amber-100 text-amber-800";
  }
}

function scoringRuleLabel(code: ScoringRule["code"]) {
  switch (code) {
    case "exact_score":
      return "Marcador exacto";
    case "match_result":
      return "Resultado correcto";
    case "group_position_exact":
      return "Posicion exacta de grupo";
    case "underdog_bonus":
      return "Bonus sorpresa";
    case "global_champion":
      return "Campeon";
    case "global_runner_up":
      return "Subcampeon";
    case "global_third_place":
      return "Tercer puesto";
    case "global_fourth_place":
      return "Cuarto puesto";
    case "global_top_scorer":
      return "Goleador";
    case "global_top_assistant":
      return "Asistente";
    case "global_yellow_cards_exact":
      return "Amarillas exactas";
    case "global_yellow_cards_range":
      return "Amarillas por rango";
    case "global_red_cards_exact":
      return "Rojas exactas";
    case "global_red_cards_range":
      return "Rojas por rango";
    case "global_penalties_exact":
      return "Penales exactos";
    case "global_penalties_range":
      return "Penales por rango";
    default:
      return code;
  }
}

function scoringRuleByCode(rules: ScoringRule[], code: ScoringRule["code"]) {
  return rules.find((rule) => rule.code === code);
}

function rankingDisplayName(entry: RankingEntry) {
  return entry.user_name || entry.username || entry.user_id;
}

function poolDisplayName(pool: Pool | null) {
  return pool?.theme?.display_name || pool?.name || "Polla";
}

function participantHandle(entry: RankingEntry) {
  return entry.username ? `@${entry.username}` : entry.user_id;
}

function poolParticipantDisplayName(participant: Pool["participants"][number]) {
  return participant.user_name || participant.username || participant.user_id;
}

function poolParticipantHandle(participant: Pool["participants"][number]) {
  return participant.username ? `@${participant.username}` : participant.user_id;
}

function ThemeLogo({ theme }: { theme: NormalizedTheme }) {
  if (theme.logoURL) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        className="h-16 w-16 rounded-md border border-zinc-200 bg-white object-contain p-2"
        src={theme.logoURL}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="grid h-16 w-16 place-items-center rounded-md text-lg font-semibold text-white"
      style={{ backgroundColor: theme.primaryColor }}
    >
      PV
    </div>
  );
}

function normalizedPoolTheme(theme?: PoolTheme): NormalizedTheme {
  const primaryColor = theme?.primary_color;
  const secondaryColor = theme?.secondary_color;
  const accentColor = theme?.accent_color;

  return {
    logoURL: theme?.logo_url ?? "",
    bannerURL: theme?.banner_url ?? "",
    mascotURL: theme?.mascot_url ?? "",
    primaryColor: validThemeColor(primaryColor) ? primaryColor : "#0F766E",
    secondaryColor: validThemeColor(secondaryColor) ? secondaryColor : "#111827",
    accentColor: validThemeColor(accentColor) ? accentColor : "#F59E0B",
  };
}

function colorWithAlpha(color: string, alpha: number) {
  const normalized = expandShortHex(color);
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function expandShortHex(color: string) {
  if (color.length !== 4) {
    return color;
  }

  return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
}

function validThemeColor(value: string | undefined): value is string {
  return Boolean(value?.match(/^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/));
}

function participantRoleLabel(role: string) {
  switch (role) {
    case "pool_admin":
      return "Admin";
    case "participant":
    default:
      return "Participante";
  }
}

function paymentStatusLabel(status: string) {
  switch (status) {
    case "confirmed":
      return "Pago confirmado";
    case "rejected":
      return "Pago rechazado";
    case "pending":
    default:
      return "Pago pendiente";
  }
}

function roundCloseLabel(group: PredictionGroup, closeHours?: number) {
  if (typeof closeHours !== "number") {
    return "Cierre pendiente";
  }

  const startsAtValues = group.matches
    .map((match) => Date.parse(match.starts_at))
    .filter((startsAt) => !Number.isNaN(startsAt));
  if (startsAtValues.length === 0) {
    return `${closeHours}h antes`;
  }

  const closesAt = new Date(Math.min(...startsAtValues) - closeHours * 60 * 60 * 1000);
  return `Hasta ${formatMatchDate(closesAt.toISOString())}`;
}

function roundScoringLabel(group: PredictionGroup, activeRules: ScoringRule[]) {
  const labels = activeRules
    .filter((rule) => rule.code !== "group_position_exact" || group.standings.length > 0)
    .map((rule) => `${scoringRuleLabel(rule.code)} (${rule.points})`);

  return labels.length > 0 ? labels.join(", ") : "Sin reglas activas";
}

function parseWholeNumber(value: string) {
  const normalized = value.trim();
  if (normalized === "") {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function formatMoney(amountCents: number, currency: string) {
  const amount = amountCents / 100;
  return `${currency} ${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)}`;
}

function formatPercentage(percentage: number) {
  return Number.isInteger(percentage) ? String(percentage) : String(percentage);
}

function globalPredictionValueTypeLabel(valueType: GlobalPredictionDefinition["value_type"]) {
  switch (valueType) {
    case "team":
      return "Equipo";
    case "player":
      return "Jugador";
    case "number":
      return "Numero exacto";
    case "number_range":
      return "Rango numerico";
    case "text":
    default:
      return "Texto";
  }
}

function globalPredictionValueLabel(
  value: GlobalPrediction | GlobalPredictionResult,
  teamOptions: TournamentTeamOption[] = [],
) {
  if (
    value.value_type === "team" ||
    value.value_type === "player" ||
    value.value_type === "text"
  ) {
    if (value.value_type === "team") {
      return teamOptionLabel(value.value_text, teamOptions) || "-";
    }
    return value.value_text || "-";
  }
  if (value.value_type === "number") {
    return typeof value.value_number === "number" ? String(value.value_number) : "-";
  }
  if (typeof value.range_min === "number" && typeof value.range_max === "number") {
    return `${value.range_min}-${value.range_max}`;
  }
  if (typeof value.value_number === "number") {
    return String(value.value_number);
  }
  return "-";
}

function teamOptionLabel(value: string, teamOptions: TournamentTeamOption[]) {
  const normalizedValue = value.trim();
  const team = teamOptions.find(
    (option) => option.id === normalizedValue || option.name === normalizedValue,
  );
  return team?.name ?? normalizedValue;
}

function pointEventTitle(detail: PointEventDetail) {
  if (detail.match_number > 0) {
    return `Partido ${detail.match_number}`;
  }
  if (detail.global_prediction_id) {
    return "Prediccion global";
  }
  return "Evento global";
}

function formatRankingPoints(points: number) {
  return points > 0 ? `+${points}` : String(points);
}

function formatPoints(points: number) {
  return points > 0 ? `+${points} pts` : `${points} pts`;
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
  }).format(date);
}

function isMatchClosed(match: Match, closeHours: number) {
  const startsAt = Date.parse(match.starts_at);
  if (Number.isNaN(startsAt)) {
    return false;
  }
  return Date.now() >= startsAt - closeHours * 60 * 60 * 1000;
}

function isStandingPredictionClosed(matches: Match[], closeHours?: number) {
  if (typeof closeHours !== "number") {
    return false;
  }

  const startsAtValues = matches
    .map((match) => Date.parse(match.starts_at))
    .filter((startsAt) => !Number.isNaN(startsAt));
  if (startsAtValues.length === 0) {
    return false;
  }

  const firstStartsAt = Math.min(...startsAtValues);
  return Date.now() >= firstStartsAt - closeHours * 60 * 60 * 1000;
}

function formatMatchDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Fecha pendiente";
  }
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
