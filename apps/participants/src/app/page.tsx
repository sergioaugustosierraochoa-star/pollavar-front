"use client";

import {
  PollavarAPIError,
  createPollavarClient,
  type ClosedPrediction,
  type EffectiveMatchPredictionSettings,
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
  type RankingManualTiebreaker,
  type RankingTiebreaker,
  type RankingTiebreakerCode,
  type ScoringRule,
  type StandingPrediction,
  type Tournament,
  type TournamentSummary,
} from "@pollavar/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readStoredSession, redirectToLogin, signOut, type AuthSession } from "./session";
import { TeamBadge } from "@pollavar/ui";

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
  { code: "score_difference", points: 2, enabled: true },
  { code: "match_result", points: 3, enabled: true },
  { code: "group_position_exact", points: 2, enabled: true },
  { code: "underdog_bonus", points: 2, enabled: false },
];
const rankingTiebreakerLabels: Record<RankingTiebreakerCode, string> = {
  exact_score: "Marcadores exactos",
  match_result: "Resultados correctos",
  group_position_exact: "Posiciones exactas",
  underdog_bonus: "Bonus sorpresa",
  global_points: "Predicciones globales",
  total_event_count: "Total de aciertos",
};
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
  effectiveMatchSettings: EffectiveMatchPredictionSettings[];
  underdogBonuses: MatchUnderdogBonus[];
  ranking: RankingEntry[];
  rankingTiebreakers: RankingTiebreaker[];
  rankingManualTiebreakers: RankingManualTiebreaker[];
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
  team: Match["home_team"];
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

type ParticipantsAppMode = "lobby" | "detail";
type ParticipantSectionID =
  | "pronosticos"
  | "ranking"
  | "premios"
  | "participantes"
  | "reglas";

const participantSections: Array<{ id: ParticipantSectionID; label: string }> = [
  { id: "pronosticos", label: "Pronósticos" },
  { id: "participantes", label: "Participantes" },
  { id: "ranking", label: "Ranking" },
  { id: "premios", label: "Premios" },
  { id: "reglas", label: "Reglas" },
];

export default function ParticipantsHome() {
  return <ParticipantsApp mode="lobby" />;
}

export function ParticipantsApp({
  initialPoolID,
  mode,
}: {
  initialPoolID?: string;
  mode: ParticipantsAppMode;
}) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<DashboardStatus>("checking");
  const [message, setMessage] = useState("");
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPoolID, setSelectedPoolID] = useState("");
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [joiningPool, setJoiningPool] = useState(false);
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
  const [rankingTiebreakers, setRankingTiebreakers] = useState<RankingTiebreaker[]>([]);
  const [rankingManualTiebreakers, setRankingManualTiebreakers] = useState<
    RankingManualTiebreaker[]
  >([]);
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
  const [effectiveMatchSettings, setEffectiveMatchSettings] = useState<
    EffectiveMatchPredictionSettings[]
  >([]);
  const [underdogBonuses, setUnderdogBonuses] = useState<MatchUnderdogBonus[]>([]);
  const [selectedRankingUserID, setSelectedRankingUserID] = useState("");
  const [pointDetailsByUserID, setPointDetailsByUserID] = useState<
    Record<string, PointEventDetail[]>
  >({});
  const [closedPredictionsByUserID, setClosedPredictionsByUserID] = useState<
    Record<string, ClosedPrediction[]>
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const dashboardRequestID = useRef(0);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const toastItems = [
    message && status !== "error"
      ? {
          id: "general",
          message,
          onDismiss: () => setMessage(""),
          type: participantToastType(message),
        }
      : null,
    saveMessage
      ? {
          id: "prediction",
          message: saveMessage,
          onDismiss: () => setSaveMessage(""),
          type: participantToastType(saveMessage),
        }
      : null,
    standingSaveMessage
      ? {
          id: "standing",
          message: standingSaveMessage,
          onDismiss: () => setStandingSaveMessage(""),
          type: participantToastType(standingSaveMessage),
        }
      : null,
    globalSaveMessage
      ? {
          id: "global",
          message: globalSaveMessage,
          onDismiss: () => setGlobalSaveMessage(""),
          type: participantToastType(globalSaveMessage),
        }
      : null,
    pointDetailsMessage
      ? {
          id: "points",
          message: pointDetailsMessage,
          onDismiss: () => setPointDetailsMessage(""),
          type: participantToastType(pointDetailsMessage),
        }
      : null,
  ].filter((item): item is ParticipantToastItem => item !== null);

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
  const effectiveMatchSettingsByMatch = useMemo(
    () => indexEffectiveMatchSettings(effectiveMatchSettings),
    [effectiveMatchSettings],
  );

  const signOutParticipant = useCallback(function signOutParticipant() {
    dashboardRequestID.current += 1;
    setUserMenuOpen(false);
    signOut();
    setSession(null);
    setStatus("signed-out");
    setMessage("");
    setPools([]);
    setSelectedPoolID("");
    setJoinInviteCode("");
    setJoiningPool(false);
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
    setRankingTiebreakers([]);
    setRankingManualTiebreakers([]);
    setPrizePreview(null);
    setGlobalPrizePreview(null);
    setScoringRules([]);
    setStandingPredictions([]);
    setGlobalPredictionDefinitions([]);
    setGlobalPredictions([]);
    setGlobalPredictionResults([]);
    setEffectiveMatchSettings([]);
    setUnderdogBonuses([]);
    setSelectedRankingUserID("");
    setPointDetailsByUserID({});
    setClosedPredictionsByUserID({});
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
    redirectToLogin();
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
      loadedEffectiveMatchSettings,
      loadedUnderdogBonuses,
      ranking,
      loadedRankingTiebreakers,
      loadedRankingManualTiebreakers,
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
      listEffectiveMatchPredictionSettingsWithFallback(client, token, activePool.id),
      listMatchUnderdogBonusesWithFallback(client, token, activePool.id),
      listRankingWithFallback(client, token, activePool.id),
      listRankingTiebreakersWithFallback(client, token, activePool.id),
      listRankingManualTiebreakersWithFallback(client, token, activePool.id),
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
      effectiveMatchSettings: loadedEffectiveMatchSettings,
      underdogBonuses: loadedUnderdogBonuses,
      ranking,
      rankingTiebreakers: loadedRankingTiebreakers,
      rankingManualTiebreakers: loadedRankingManualTiebreakers,
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
      if (!isLatestRequest()) {
        return;
      }

      setPools(poolList);

      const requestedPool = preferredPoolID
        ? poolList.find((item) => item.id === preferredPoolID)
        : null;

      if (mode === "detail" && preferredPoolID && !requestedPool) {
        setSelectedPoolID(preferredPoolID);
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
        setRankingTiebreakers([]);
        setRankingManualTiebreakers([]);
        setPrizePreview(null);
        setGlobalPrizePreview(null);
        setScoringRules([]);
        setStandingPredictions([]);
        setGlobalPredictionDefinitions([]);
        setGlobalPredictions([]);
        setGlobalPredictionResults([]);
        setEffectiveMatchSettings([]);
        setUnderdogBonuses([]);
        setSelectedRankingUserID("");
        setPointDetailsByUserID({});
        setClosedPredictionsByUserID({});
        setPointDetailsLoadingUserID("");
        setPointDetailsMessage("");
        setDrafts({});
        setStandingDrafts({});
        setGlobalDrafts({});
        setStatus("error");
        setMessage("No encontramos esta polla o ya no tienes acceso.");
        return;
      }

      const activePool = requestedPool;
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
        setRankingTiebreakers([]);
        setRankingManualTiebreakers([]);
        setPrizePreview(null);
        setGlobalPrizePreview(null);
        setScoringRules([]);
        setStandingPredictions([]);
        setGlobalPredictionDefinitions([]);
        setGlobalPredictions([]);
        setGlobalPredictionResults([]);
        setEffectiveMatchSettings([]);
        setUnderdogBonuses([]);
        setSelectedRankingUserID("");
        setPointDetailsByUserID({});
        setClosedPredictionsByUserID({});
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
      setRankingTiebreakers(loadedPoolData.rankingTiebreakers);
      setRankingManualTiebreakers(loadedPoolData.rankingManualTiebreakers);
      setPrizePreview(loadedPoolData.prizePreview);
      setGlobalPrizePreview(loadedPoolData.globalPrizePreview);
      setScoringRules(loadedPoolData.scoringRules);
      setStandingPredictions(loadedPoolData.userStandingPredictions);
      setGlobalPredictionDefinitions(loadedPoolData.globalPredictionDefinitions);
      setGlobalPredictions(loadedPoolData.userGlobalPredictions);
      setGlobalPredictionResults(loadedPoolData.globalPredictionResults);
      setEffectiveMatchSettings(loadedPoolData.effectiveMatchSettings);
      setUnderdogBonuses(loadedPoolData.underdogBonuses);
      setSelectedRankingUserID("");
      setPointDetailsByUserID({});
      setClosedPredictionsByUserID({});
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
  }, [loadPoolData, mode, signOutParticipant]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapDashboard() {
      const storedSession = readStoredSession();
      if (cancelled) {
        return;
      }

      if (!storedSession) {
        setStatus("signed-out");
        redirectToLogin();
        return;
      }

      setSession(storedSession);
      await loadDashboard(storedSession.token, initialPoolID);
    }

    void bootstrapDashboard();

    return () => {
      cancelled = true;
    };
  }, [initialPoolID, loadDashboard]);

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

  useEffect(() => {
    if (!message || status === "error") {
      return;
    }

    const timeoutID = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timeoutID);
  }, [message, status]);

  useEffect(() => {
    if (!saveMessage && !standingSaveMessage && !globalSaveMessage && !pointDetailsMessage) {
      return;
    }

    const timeoutID = window.setTimeout(() => {
      setSaveMessage("");
      setStandingSaveMessage("");
      setGlobalSaveMessage("");
      setPointDetailsMessage("");
    }, 4000);

    return () => window.clearTimeout(timeoutID);
  }, [globalSaveMessage, pointDetailsMessage, saveMessage, standingSaveMessage]);

  useEffect(() => {
    if (!userMenuOpen) {
      return;
    }

    function closeMenuOnOutsideInteraction(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && userMenuRef.current?.contains(target)) {
        return;
      }
      setUserMenuOpen(false);
    }

    function closeMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeMenuOnOutsideInteraction);
    document.addEventListener("keydown", closeMenuOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenuOnOutsideInteraction);
      document.removeEventListener("keydown", closeMenuOnEscape);
    };
  }, [userMenuOpen]);

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

  async function joinPool() {
    if (!session || joiningPool) {
      return;
    }

    const inviteCode = joinInviteCode.trim().toUpperCase();
    if (!inviteCode) {
      setMessage("Ingresa el código de invitación.");
      return;
    }

    setJoiningPool(true);
    setMessage("");
    try {
      const joinedPool = await createPollavarClient().joinPool(session.token, {
        invite_code: inviteCode,
      });
      setJoinInviteCode("");
      await loadDashboard(session.token, joinedPool.id);
      setMessage("Te uniste a la polla.");
      router.push(`/pools/${joinedPool.id}`);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOutParticipant();
        return;
      }
      if (error instanceof PollavarAPIError && error.status === 400) {
        setMessage("Revisa el código de invitación.");
        return;
      }
      if (error instanceof PollavarAPIError && error.status === 404) {
        setMessage("No encontramos una polla con ese código.");
        return;
      }
      setMessage("No pudimos unirte a la polla.");
    } finally {
      setJoiningPool(false);
    }
  }

  async function loadPointDetails(userID: string) {
    if (!session || !pool) {
      return;
    }

    setSelectedRankingUserID(userID);
    setPointDetailsMessage("");
    const hasPointDetails = Object.prototype.hasOwnProperty.call(pointDetailsByUserID, userID);
    const hasClosedPredictions = Object.prototype.hasOwnProperty.call(
      closedPredictionsByUserID,
      userID,
    );
    if (hasPointDetails && hasClosedPredictions) {
      return;
    }

    const requestID = dashboardRequestID.current;
    setPointDetailsLoadingUserID(userID);
    try {
      const client = createPollavarClient();
      const [details, closedPredictions] = await Promise.all([
        hasPointDetails
          ? Promise.resolve(pointDetailsByUserID[userID] ?? [])
          : listPointDetailsWithFallback(client, session.token, pool.id, userID),
        hasClosedPredictions
          ? Promise.resolve(closedPredictionsByUserID[userID] ?? [])
          : listClosedPredictionsWithFallback(client, session.token, pool.id, userID),
      ]);
      if (dashboardRequestID.current !== requestID) {
        return;
      }
      setPointDetailsByUserID((current) => ({
        ...current,
        [userID]: details,
      }));
      setClosedPredictionsByUserID((current) => ({
        ...current,
        [userID]: closedPredictions,
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

  async function savePredictionDraft(match: Match, draft: ScoreDrafts[string]) {
    if (!session || !pool || !tournament) {
      return;
    }

    const predictionMode =
      effectiveMatchSettingsByMatch.get(match.id)?.prediction_mode ?? pool.prediction_mode;
    const input = predictionInputFromDraft(predictionMode, draft);
    if (!input) {
      setSaveMessage(
        predictionMode === "outcome"
          ? "Elige local, empate o visitante."
          : "Completa ambos marcadores con números válidos.",
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
      setSaveMessage("Pronóstico guardado.");
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOutParticipant();
        return;
      }
      setSaveMessage("No pudimos guardar el pronóstico.");
    } finally {
      if (dashboardRequestID.current === requestID) {
        setSavingMatchID("");
      }
    }
  }

  async function savePrediction(event: FormEvent<HTMLFormElement>, match: Match) {
    event.preventDefault();
    await savePredictionDraft(match, drafts[match.id] ?? emptyPredictionDraft());
  }

  async function saveOutcomePrediction(match: Match, outcome: MatchOutcome) {
    const currentDraft = drafts[match.id] ?? emptyPredictionDraft();
    updateDraft(match.id, "outcome", outcome);
    await savePredictionDraft(match, { ...currentDraft, outcome });
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
      setStandingSaveMessage("El pronóstico de posiciones de este grupo está cerrado.");
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
        setStandingSaveMessage("El pronóstico de posiciones de este grupo está cerrado.");
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
      setGlobalSaveMessage("Este pronóstico global ya está cerrado.");
      return;
    }

    const draft = {
      ...emptyGlobalPredictionDraft(),
      ...globalDrafts[definition.code],
    };
    const input = globalPredictionInputFromDraft(definition, draft);
    if (!input) {
      setGlobalSaveMessage("Revisa el valor del pronóstico global.");
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
      setGlobalSaveMessage("Pronóstico global guardado.");
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOutParticipant();
        return;
      }
      if (isPredictionClosedError(error)) {
        setGlobalSaveMessage("Este pronóstico global ya está cerrado.");
        return;
      }
      setGlobalSaveMessage("No pudimos guardar el pronóstico global.");
    } finally {
      if (dashboardRequestID.current === requestID) {
        setSavingGlobalDefinitionCode("");
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <header className="border-b border-[#10B981]/35 bg-[#0f172a] text-white shadow-sm">
        <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-4 px-5 py-4">
          <Link className="flex min-w-0 items-center gap-3" href="/">
            <span className="truncate text-lg font-semibold tracking-normal text-[#10B981]">
              PollaVAR
            </span>
            <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-white/80">
              Participantes
            </span>
          </Link>
          {session ? (
            <div className="relative" ref={userMenuRef}>
              <button
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                className="flex min-w-0 items-center gap-3 rounded-md px-2 py-1 text-sm font-medium text-white outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                onClick={() => setUserMenuOpen((open) => !open)}
                type="button"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#10B981] text-xs font-semibold text-white">
                  {userInitials(session.user.name, session.user.username)}
                </span>
                <span className="hidden max-w-40 truncate sm:block">{session.user.name}</span>
              </button>
              {userMenuOpen ? (
                <div className="absolute right-0 z-[80] mt-3 grid min-w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white py-2 text-sm text-zinc-700 shadow-xl ring-1 ring-zinc-950/5">
                  <Link
                    className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-100"
                    href="/profile"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <span aria-hidden="true" className="grid size-5 place-items-center">
                      <svg fill="none" height="18" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" width="18">
                        <path d="M20 21a8 8 0 0 0-16 0" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    Mi perfil
                  </Link>
                  <button
                    className="flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-100"
                    onClick={signOutParticipant}
                    type="button"
                  >
                    <span aria-hidden="true" className="grid size-5 place-items-center">
                      <svg fill="none" height="18" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" width="18">
                        <path d="M12 2v10" />
                        <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
                      </svg>
                    </span>
                    Salir
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <nav aria-label="Autenticación participantes" className="flex items-center gap-2">
              <Link
                className="rounded-md border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/15"
                href="/login"
              >
                Entrar
              </Link>
              <Link
                className="rounded-md bg-[#10B981] px-3 py-2 text-sm font-medium text-white hover:bg-[#059669]"
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
          title="No pudimos cargar tu información"
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
      {status === "ready" && session && mode === "lobby" ? (
        <section className="mx-auto grid w-full max-w-[96rem] gap-5 px-5 py-6">
          <JoinPoolPanel
            inviteCode={joinInviteCode}
            joining={joiningPool}
            onChange={setJoinInviteCode}
            onJoin={() => void joinPool()}
          />
          <ParticipantPoolLobby pools={pools} />
        </section>
      ) : null}
      {status === "ready" && session && mode === "detail" ? (
        <>
          <Dashboard
            closedPredictionsByUserID={closedPredictionsByUserID}
            drafts={drafts}
            currentUserID={session.user.id}
            effectiveMatchSettingsByMatch={effectiveMatchSettingsByMatch}
            underdogBonusesByMatch={underdogBonusesByMatch}
            onSave={savePrediction}
            onSaveOutcome={saveOutcomePrediction}
            onDownloadSnapshot={downloadPredictionSnapshot}
            onLoadSnapshot={loadPredictionSnapshot}
            onSelectRankingUser={loadPointDetails}
            onSaveStanding={saveStandingPrediction}
            onSaveGlobalPrediction={saveGlobalPrediction}
            onMoveStanding={moveStandingTeam}
            onUpdateDraft={updateDraft}
            onUpdateGlobalDraft={updateGlobalDraft}
            pool={pool}
            predictionsByMatch={predictionsByMatch}
            predictionStatusesByMatch={predictionStatusesByMatch}
            pointDetailsByUserID={pointDetailsByUserID}
            pointDetailsLoadingUserID={pointDetailsLoadingUserID}
            pointDetailsMessage={pointDetailsMessage}
            prizePreview={prizePreview}
            ranking={ranking}
            rankingManualTiebreakers={rankingManualTiebreakers}
            rankingTiebreakers={rankingTiebreakers}
            scoringRules={scoringRules}
            globalDrafts={globalDrafts}
            globalPredictionDefinitions={globalPredictionDefinitions}
            globalPredictionResults={globalPredictionResults}
            globalPredictions={globalPredictions}
            globalPrizePreview={globalPrizePreview}
            savingGlobalDefinitionCode={savingGlobalDefinitionCode}
            savingMatchID={savingMatchID}
            savingStandingGroupID={savingStandingGroupID}
            selectedRankingUserID={selectedRankingUserID}
            clockTick={clockTick}
            snapshotDownloadingMatchID={snapshotDownloadingMatchID}
            snapshotLoadingMatchID={snapshotLoadingMatchID}
            snapshotMessages={snapshotMessages}
            snapshotsByMatchID={snapshotsByMatchID}
            standingDrafts={standingDrafts}
            standingPredictionsByGroup={standingPredictionsByGroup}
            summary={summary}
            tournament={tournament}
          />
        </>
      ) : null}
      <ParticipantToastStack items={toastItems} />
    </main>
  );
}

function JoinPoolPanel({
  inviteCode,
  joining,
  onChange,
  onJoin,
}: {
  inviteCode: string;
  joining: boolean;
  onChange: (value: string) => void;
  onJoin: () => void;
}) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-[0_10px_40px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#0f172a]">Unirse a una polla</h2>
          <p className="text-sm text-slate-500">
            Ingresa el código que te compartió el administrador.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            <span>Código de invitación</span>
            <input
              className="min-h-11 w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm uppercase text-[#0f172a] outline-none transition placeholder:text-slate-400 focus:border-[#22D3EE] focus:ring-4 focus:ring-[#22D3EE]/10 disabled:bg-slate-100 sm:w-56"
              disabled={joining}
              onChange={(event) => onChange(event.target.value.toUpperCase())}
              placeholder="CÓDIGO"
              value={inviteCode}
            />
          </label>
          <button
            className="min-h-11 rounded-xl bg-[#10B981] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={joining}
            onClick={onJoin}
            type="button"
          >
            {joining ? "Uniendo" : "Unirme"}
          </button>
        </div>
      </div>
    </section>
  );
}

type ParticipantToastItem = {
  id: string;
  message: string;
  onDismiss: () => void;
  type: "success" | "error";
};

function ParticipantToastStack({ items }: { items: ParticipantToastItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[200] grid w-[min(22rem,calc(100vw-2rem))] gap-2">
      {items.map((item) => {
        const isSuccess = item.type === "success";
        return (
          <div
            className={[
              "flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur",
              isSuccess
                ? "border-green-500/30 bg-green-500/15 text-green-700"
                : "border-[#F59E0B]/30 bg-[#F59E0B]/15 text-[#b45309]",
            ].join(" ")}
            key={item.id}
            role={isSuccess ? "status" : "alert"}
          >
            <span>{item.message}</span>
            <button
              aria-label="Cerrar mensaje"
              className="rounded-full px-1 text-current opacity-70 transition hover:opacity-100"
              onClick={item.onDismiss}
              type="button"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

function participantToastType(message: string): "success" | "error" {
  return isParticipantErrorMessage(message) ? "error" : "success";
}

function isParticipantErrorMessage(message: string) {
  return (
    message.includes("No pudimos") ||
    message.includes("No encontramos") ||
    message.includes("Revisa") ||
    message.includes("Ingresa") ||
    message.includes("Completa") ||
    message.includes("cerrado") ||
    message.includes("cerrada") ||
    message.includes("Elige") ||
    message.includes("Necesitas")
  );
}

function ParticipantPoolLobby({ pools }: { pools: Pool[] }) {
  if (pools.length === 0) {
    return (
      <section className="rounded-xl bg-white p-6 text-sm text-slate-600 shadow-[0_10px_40px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/10">
        <h2 className="text-xl font-bold text-[#0f172a]">Mis pollas</h2>
        <p className="mt-2">Cuando te unas a una polla, aparecerá aquí para entrar a jugar.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[#0f172a]">Mis pollas</h2>
        <p className="mt-1 text-sm text-slate-500">
          Elige una polla para ver sus pronósticos, ranking, premios y reglas.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {pools.map((pool) => {
          const theme = normalizedPoolTheme(pool.theme);
          const paidCount = pool.participants.filter(
            (participant) => participant.payment_status === "confirmed",
          ).length;

          return (
            <Link
              className="group overflow-hidden rounded-xl bg-white text-left shadow-[0_10px_40px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/10 transition hover:-translate-y-0.5 hover:shadow-[0_14px_48px_rgba(15,23,42,0.12),0_1px_3px_rgba(15,23,42,0.05)]"
              href={`/pools/${pool.id}`}
              key={pool.id}
            >
              <div
                className="grid gap-4 p-5"
                style={{
                  background: `linear-gradient(135deg, ${colorWithAlpha(theme.primaryColor, 0.08)}, #ffffff 52%, ${colorWithAlpha(theme.secondaryColor, 0.1)})`,
                }}
              >
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_150px] sm:items-center">
                  <div className="flex min-w-0 items-start gap-3">
                    <ThemeLogo theme={theme} />
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold text-[#0f172a]">
                        {poolDisplayName(pool)}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Código {pool.invite_code}
                      </p>
                    </div>
                  </div>
                  {theme.bannerURL || theme.mascotURL ? (
                    <div className="relative hidden h-24 overflow-hidden sm:block">
                      {theme.bannerURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt=""
                          className="absolute inset-y-0 right-0 h-full w-full object-contain object-right"
                          src={theme.bannerURL}
                        />
                      ) : null}
                      {theme.mascotURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt=""
                          className="absolute bottom-1 right-2 h-16 max-w-24 object-contain drop-shadow-[0_8px_16px_rgba(15,23,42,0.16)]"
                          src={theme.mascotURL}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <LobbyMetric label="Entrada" value={formatMoney(pool.entry_fee_cents, pool.currency)} />
                  <LobbyMetric label="Participantes" value={String(pool.participants.length)} />
                  <LobbyMetric label="Pagados" value={String(paidCount)} />
                  <LobbyMetric label="Cierre" value={`${pool.prediction_close_hours_before}h antes`} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function LobbyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-950/5">
      <p className="text-[11px] font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate font-semibold text-[#0f172a]">{value}</p>
    </div>
  );
}

function Dashboard({
  clockTick,
  closedPredictionsByUserID,
  currentUserID,
  drafts,
  effectiveMatchSettingsByMatch,
  globalDrafts,
  globalPredictionDefinitions,
  globalPredictionResults,
  globalPredictions,
  globalPrizePreview,
  underdogBonusesByMatch,
  onDownloadSnapshot,
  onLoadSnapshot,
  onSave,
  onSaveOutcome,
  onSaveGlobalPrediction,
  onSelectRankingUser,
  onSaveStanding,
  onMoveStanding,
  onUpdateDraft,
  onUpdateGlobalDraft,
  pool,
  predictionsByMatch,
  predictionStatusesByMatch,
  pointDetailsByUserID,
  pointDetailsLoadingUserID,
  pointDetailsMessage,
  prizePreview,
  ranking,
  rankingManualTiebreakers,
  rankingTiebreakers,
  scoringRules,
  savingGlobalDefinitionCode,
  savingMatchID,
  savingStandingGroupID,
  selectedRankingUserID,
  snapshotDownloadingMatchID,
  snapshotLoadingMatchID,
  snapshotMessages,
  snapshotsByMatchID,
  standingDrafts,
  standingPredictionsByGroup,
  summary,
  tournament,
}: {
  clockTick: number;
  closedPredictionsByUserID: Record<string, ClosedPrediction[]>;
  currentUserID: string;
  drafts: ScoreDrafts;
  effectiveMatchSettingsByMatch: Map<string, EffectiveMatchPredictionSettings>;
  globalDrafts: GlobalPredictionDrafts;
  globalPredictionDefinitions: GlobalPredictionDefinition[];
  globalPredictionResults: GlobalPredictionResult[];
  globalPredictions: GlobalPrediction[];
  globalPrizePreview: GlobalPredictionPrizePreview | null;
  underdogBonusesByMatch: Map<string, MatchUnderdogBonus>;
  onDownloadSnapshot: (matchID: string) => void;
  onLoadSnapshot: (matchID: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>, match: Match) => void;
  onSaveOutcome: (match: Match, outcome: MatchOutcome) => void;
  onSaveGlobalPrediction: (definition: GlobalPredictionDefinition) => void;
  onSelectRankingUser: (userID: string) => void;
  onSaveStanding: (group: PredictionGroup) => void;
  onMoveStanding: (group: PredictionGroup, teamID: string, direction: -1 | 1) => void;
  onUpdateDraft: (matchID: string, side: "home" | "away" | "outcome", value: string) => void;
  onUpdateGlobalDraft: (
    definitionCode: string,
    field: keyof GlobalPredictionDrafts[string],
    value: string,
  ) => void;
  pool: Pool | null;
  predictionsByMatch: Map<string, Prediction>;
  predictionStatusesByMatch: Map<string, PredictionMatchStatus>;
  pointDetailsByUserID: Record<string, PointEventDetail[]>;
  pointDetailsLoadingUserID: string;
  pointDetailsMessage: string;
  prizePreview: PrizePreview | null;
  ranking: RankingEntry[];
  rankingManualTiebreakers: RankingManualTiebreaker[];
  rankingTiebreakers: RankingTiebreaker[];
  scoringRules: ScoringRule[];
  savingGlobalDefinitionCode: string;
  savingMatchID: string;
  savingStandingGroupID: string;
  selectedRankingUserID: string;
  snapshotDownloadingMatchID: string;
  snapshotLoadingMatchID: string;
  snapshotMessages: Record<string, string>;
  snapshotsByMatchID: Record<string, PredictionSnapshot>;
  standingDrafts: StandingDrafts;
  standingPredictionsByGroup: Map<string, StandingPrediction>;
  summary: PredictionSummary | null;
  tournament: Tournament | null;
}) {
  const [activeSection, setActiveSection] = useState<ParticipantSectionID>("pronosticos");

  if (!pool) {
    return (
      <StatusState
        title="No encontramos esta polla"
        message="Vuelve a mis pollas y selecciona una disponible."
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
  const standingsPredictionEnabled =
    scoringRuleByCode(scoringRules, "group_position_exact")?.enabled ?? false;
  const visiblePredictionGroups = standingsPredictionEnabled
    ? predictionGroups
    : predictionGroups.map((group) => ({ ...group, standings: [] }));
  const theme = normalizedPoolTheme(pool.theme);
  return (
    <section
      className="min-h-screen overflow-x-clip px-4 pb-24 pt-4 sm:px-6 sm:py-6"
      style={{
        backgroundColor: colorWithAlpha(theme.primaryColor, 0.1),
        backgroundImage: `radial-gradient(circle at 8% 8%, ${colorWithAlpha(theme.primaryColor, 0.2)}, transparent 34%), radial-gradient(circle at 92% 12%, ${colorWithAlpha(theme.primaryColor, 0.14)}, transparent 32%), linear-gradient(180deg, ${colorWithAlpha(theme.primaryColor, 0.08)}, ${colorWithAlpha(theme.primaryColor, 0.12)})`,
      }}
    >
      <div className="mx-auto grid w-full max-w-[96rem] gap-5">
        <ParticipantPoolHero
          pool={pool}
          tournament={tournament}
        />
        <div className="grid min-w-0 gap-5 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
          <ParticipantPoolShell
            activeSection={activeSection}
            onSelectSection={setActiveSection}
            pool={pool}
            summary={summary}
            theme={theme}
          />

          <div className="min-w-0 overflow-x-clip">
            <div
              className="sticky top-[8.5rem] z-20 mb-5 grid gap-3 rounded-2xl p-3 shadow-[0_18px_28px_rgba(248,250,252,0.98)] sm:p-4 xl:top-[10.5rem]"
              style={{
                background: `linear-gradient(135deg, rgba(255,255,255,0.94), ${colorWithAlpha(theme.secondaryColor, 0.16)})`,
              }}
            >
              <SummaryGrid summary={summary} theme={theme} />
              <DashboardNavigation
                currentUserID={currentUserID}
                globalPrizePreview={globalPrizePreview}
                onSelectSection={setActiveSection}
                prizePreview={prizePreview}
                ranking={ranking}
                theme={theme}
              />
            </div>

            {activeSection === "pronosticos" ? (
            <div className="grid gap-5">
              <PredictionList
                drafts={drafts}
                clockTick={clockTick}
                effectiveMatchSettingsByMatch={effectiveMatchSettingsByMatch}
                underdogBonusesByMatch={underdogBonusesByMatch}
                underdogRule={scoringRuleByCode(scoringRules, "underdog_bonus")}
                onDownloadSnapshot={onDownloadSnapshot}
                onLoadSnapshot={onLoadSnapshot}
                onSave={onSave}
                onSaveOutcome={onSaveOutcome}
                onSaveStanding={onSaveStanding}
                onMoveStanding={onMoveStanding}
                onUpdateDraft={onUpdateDraft}
                pool={pool}
                predictionGroups={visiblePredictionGroups}
                predictionsByMatch={predictionsByMatch}
                predictionStatusesByMatch={predictionStatusesByMatch}
                savingMatchID={savingMatchID}
                savingStandingGroupID={savingStandingGroupID}
                snapshotDownloadingMatchID={snapshotDownloadingMatchID}
                snapshotLoadingMatchID={snapshotLoadingMatchID}
                snapshotMessages={snapshotMessages}
                snapshotsByMatchID={snapshotsByMatchID}
                standingDrafts={standingDrafts}
                standingPredictionsByGroup={standingPredictionsByGroup}
                tournament={tournament}
              />
              <GlobalPredictionsPanel
                definitions={globalPredictionDefinitions}
                drafts={globalDrafts}
                onSave={onSaveGlobalPrediction}
                onUpdateDraft={onUpdateGlobalDraft}
                results={globalPredictionResults}
                savingDefinitionCode={savingGlobalDefinitionCode}
                tournament={tournament}
                userPredictions={globalPredictions}
              />
            </div>
            ) : null}

            {activeSection === "ranking" ? (
            <RankingPanel
              closedPredictionsByUserID={closedPredictionsByUserID}
              currentUserID={currentUserID}
              detailsByUserID={pointDetailsByUserID}
              loadingUserID={pointDetailsLoadingUserID}
              message={pointDetailsMessage}
              onSelectUser={onSelectRankingUser}
              ranking={ranking}
              selectedUserID={selectedRankingUserID}
            />
            ) : null}

            {activeSection === "premios" ? (
            <PrizePanel
              globalPreview={globalPrizePreview}
              preview={prizePreview}
              ranking={ranking}
              rankingManualTiebreakers={rankingManualTiebreakers}
              rankingTiebreakers={rankingTiebreakers}
            />
            ) : null}

            {activeSection === "participantes" ? (
            <ParticipantsPanel currentUserID={currentUserID} pool={pool} />
            ) : null}

            {activeSection === "reglas" ? (
            <div className="grid gap-5">
              <ScoringRulesPanel rules={scoringRules} />
              <RoundClarificationsPanel
                closeHours={pool?.prediction_close_hours_before}
                predictionGroups={visiblePredictionGroups}
                scoringRules={scoringRules}
              />
            </div>
            ) : null}
          </div>
        </div>
      </div>
      <MobileBottomNavigation
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        pool={pool}
        summary={summary}
        theme={theme}
      />
    </section>
  );
}

function ParticipantPoolHero({
  pool,
  tournament,
}: {
  pool: Pool;
  tournament: Tournament | null;
}) {
  const theme = normalizedPoolTheme(pool.theme);

  return (
    <section
      className="sticky top-2 z-40 overflow-hidden rounded-2xl border bg-white shadow-[0_10px_40px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.04)] xl:top-4 xl:z-30"
      style={{
        borderColor: colorWithAlpha(theme.secondaryColor, 0.18),
        boxShadow: `0 18px 50px ${colorWithAlpha(theme.primaryColor, 0.12)}, 0 1px 3px rgba(15,23,42,0.06)`,
      }}
    >
      <div
        className="grid gap-4 p-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)] lg:items-center"
        style={{
          background: `linear-gradient(135deg, ${colorWithAlpha(theme.primaryColor, 0.1)}, #ffffff 48%, ${colorWithAlpha(theme.secondaryColor, 0.12)})`,
        }}
      >
        <div className="flex min-w-0 items-center gap-4">
          <ThemeLogo theme={theme} />
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase" style={{ color: theme.primaryColor }}>
              {tournament?.name ?? "Torneo pendiente"}
            </p>
            <h1 className="mt-1 truncate text-2xl font-bold tracking-normal text-[#0f172a]">
              {poolDisplayName(pool)}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Código {pool.invite_code} · {formatMoney(pool.entry_fee_cents, pool.currency)} por entrada
            </p>
          </div>
        </div>
        {theme.bannerURL || theme.mascotURL ? (
          <div className="relative hidden h-28 overflow-hidden lg:block">
            {theme.bannerURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="absolute inset-y-0 right-0 h-full w-full object-contain object-right"
                src={theme.bannerURL}
              />
            ) : null}
            {theme.mascotURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="absolute bottom-2 right-4 h-20 max-w-32 object-contain drop-shadow-[0_12px_22px_rgba(15,23,42,0.16)]"
                src={theme.mascotURL}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ParticipantPoolShell({
  activeSection,
  onSelectSection,
  pool,
  summary,
  theme,
}: {
  activeSection: ParticipantSectionID;
  onSelectSection: (section: ParticipantSectionID) => void;
  pool: Pool;
  summary: PredictionSummary | null;
  theme: NormalizedTheme;
}) {
  const activeSectionData =
    participantSections.find((section) => section.id === activeSection) ?? participantSections[0];

  return (
    <aside
      className="sticky top-[10.5rem] z-10 hidden rounded-2xl border bg-white p-4 shadow-[0_10px_40px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.04)] xl:block"
      style={{ borderColor: colorWithAlpha(theme.accentColor, 0.18) }}
    >
      <div
        className="rounded-xl p-3"
        style={{
          background: `linear-gradient(135deg, ${colorWithAlpha(theme.primaryColor, 0.12)}, ${colorWithAlpha(theme.secondaryColor, 0.08)})`,
        }}
      >
        <p className="text-xs font-semibold uppercase" style={{ color: theme.primaryColor }}>
          Participar
        </p>
        <h2 className="mt-1 text-lg font-bold text-[#0f172a]">{activeSectionData.label}</h2>
        <p className="mt-1 text-sm text-slate-500">{participantSectionDescription(activeSection)}</p>
      </div>
      <nav aria-label="Secciones de la polla" className="mt-4 grid gap-2">
        {participantSections.map((section) => {
          const selected = section.id === activeSection;
          const counter = participantSectionCounter(section.id, pool, summary);
          return (
            <button
              className="flex min-h-12 items-center justify-between rounded-xl border-l-4 border-solid px-4 py-3 text-left text-sm font-semibold transition"
              key={section.id}
              onClick={() => onSelectSection(section.id)}
              style={{
                background: selected
                  ? `linear-gradient(135deg, ${colorWithAlpha(theme.secondaryColor, 0.18)}, ${colorWithAlpha(theme.primaryColor, 0.1)})`
                  : colorWithAlpha(theme.secondaryColor, 0.07),
                borderLeftColor: selected ? theme.accentColor : "transparent",
                boxShadow: "none",
                color: selected ? "#0f172a" : "#475569",
              }}
              type="button"
            >
              <span>{section.label}</span>
              {counter ? (
                <span className="rounded-lg bg-white/80 px-2 py-1 text-xs text-slate-600">
                  {counter}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function MobileParticipantSummary({
  summary,
  theme,
}: {
  summary: PredictionSummary | null;
  theme: NormalizedTheme;
}) {
  const total = summary?.total_matches ?? 0;
  const predicted = summary?.predicted_matches ?? 0;
  const missing = summary?.missing_matches ?? 0;
  const closed = summary?.closed_matches ?? 0;
  const progress = total > 0 ? Math.round((predicted / total) * 100) : 0;

  return (
    <div className="border-t border-white/70 pt-4">
      <p className="text-xs font-semibold uppercase" style={{ color: theme.primaryColor }}>
        Tu avance
      </p>
      <p className="mt-1 text-lg font-bold text-[#0f172a]">
        {predicted} de {total} partidos
      </p>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: colorWithAlpha(theme.secondaryColor, 0.14) }}
      >
        <div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${theme.primaryColor}, ${theme.accentColor})`,
            width: `${Math.min(progress, 100)}%`,
          }}
        />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <MobileSummaryStat label="Faltantes" theme={theme} value={missing} />
        <MobileSummaryStat label="Cerrados" theme={theme} value={closed} />
        <MobileSummaryStat label="Avance" theme={theme} value={`${progress}%`} />
      </dl>
    </div>
  );
}

function MobileSummaryStat({
  label,
  theme,
  value,
}: {
  label: string;
  theme: NormalizedTheme;
  value: number | string;
}) {
  return (
    <div
      className="rounded-xl px-3 py-2"
      style={{ backgroundColor: colorWithAlpha(theme.secondaryColor, 0.11) }}
    >
      <dt className="font-semibold uppercase" style={{ color: theme.primaryColor }}>
        {label}
      </dt>
      <dd className="mt-1 text-base font-bold text-[#0f172a]">{value}</dd>
    </div>
  );
}

function ParticipantQuickCard({
  label,
  onClick,
  theme,
  value,
}: {
  label: string;
  onClick: () => void;
  theme: NormalizedTheme;
  value: string;
}) {
  return (
    <button
      className="rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5"
      onClick={onClick}
      style={{
        backgroundColor: colorWithAlpha(theme.secondaryColor, 0.08),
        borderColor: colorWithAlpha(theme.accentColor, 0.18),
      }}
      type="button"
    >
      <span className="block text-xs font-semibold uppercase" style={{ color: theme.primaryColor }}>
        {label}
      </span>
      <span className="mt-1 block text-base font-bold text-[#0f172a]">{value}</span>
    </button>
  );
}

function participantSectionDescription(sectionID: ParticipantSectionID) {
  switch (sectionID) {
    case "pronosticos":
      return "Partidos, globales y posiciones configuradas.";
    case "ranking":
      return "Posiciones, puntos y pronósticos cerrados.";
    case "premios":
      return "Bolsa, ganadores y premios especiales.";
    case "participantes":
      return "Integrantes, pagos y elegibilidad.";
    case "reglas":
      return "Puntajes, cierres y aclaraciones.";
    default:
      return "";
  }
}

function participantSectionCounter(
  sectionID: ParticipantSectionID,
  pool: Pool,
  summary: PredictionSummary | null,
) {
  switch (sectionID) {
    case "pronosticos":
      return summary ? `${summary.predicted_matches}/${summary.total_matches}` : "";
    case "ranking":
      return "";
    case "premios":
      return "";
    case "participantes":
      return String(pool.participants.length);
    case "reglas":
      return summary ? `${summary.closed_matches} cerrados` : "";
    default:
      return "";
  }
}

function MobileBottomNavigation({
  activeSection,
  onSelectSection,
  pool,
  summary,
  theme,
}: {
  activeSection: ParticipantSectionID;
  onSelectSection: (section: ParticipantSectionID) => void;
  pool: Pool;
  summary: PredictionSummary | null;
  theme: NormalizedTheme;
}) {
  return (
    <nav
      aria-label="Secciones de la polla"
      className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 gap-1 rounded-2xl border bg-white/95 p-2 shadow-[0_18px_48px_rgba(15,23,42,0.22)] backdrop-blur xl:hidden"
      style={{ borderColor: colorWithAlpha(theme.accentColor, 0.22) }}
    >
      {participantSections.map((section) => {
        const selected = section.id === activeSection;
        const counter = participantSectionCounter(section.id, pool, summary);
        return (
          <button
            aria-label={section.label}
            aria-current={selected ? "page" : undefined}
            className="relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition"
            key={section.id}
            onClick={() => onSelectSection(section.id)}
            style={{
              backgroundColor: selected ? colorWithAlpha(theme.secondaryColor, 0.15) : "transparent",
              boxShadow: selected ? `inset 0 0 0 2px ${theme.accentColor}` : "none",
              color: selected ? "#0f172a" : "#64748b",
            }}
            type="button"
          >
            <ParticipantSectionIcon section={section.id} />
            <span className="max-w-full truncate">{section.label}</span>
            {counter ? (
              <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] leading-none text-slate-700 shadow-sm">
                {counter}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

function ParticipantSectionIcon({ section }: { section: ParticipantSectionID }) {
  const common = "h-5 w-5";
  switch (section) {
    case "pronosticos":
      return (
        <svg aria-hidden="true" className={common} fill="none" viewBox="0 0 24 24">
          <path d="M7 7h10M7 12h6M7 17h8" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "participantes":
      return (
        <svg aria-hidden="true" className={common} fill="none" viewBox="0 0 24 24">
          <path d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM16 10a3 3 0 1 0 0-6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          <path d="M3 21a5 5 0 0 1 10 0M14 20a4 4 0 0 1 7 0" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
      );
    case "ranking":
      return (
        <svg aria-hidden="true" className={common} fill="none" viewBox="0 0 24 24">
          <path d="M5 20V10M12 20V4M19 20v-7" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
      );
    case "premios":
      return (
        <svg aria-hidden="true" className={common} fill="none" viewBox="0 0 24 24">
          <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
      );
    case "reglas":
      return (
        <svg aria-hidden="true" className={common} fill="none" viewBox="0 0 24 24">
          <path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          <path d="m4 6 1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
      );
    default:
      return null;
  }
}

function PoolHeader({
  pool,
  tournament,
  variant = "default",
}: {
  pool: Pool | null;
  tournament: Tournament | null;
  variant?: "default" | "compact";
}) {
  const theme = normalizedPoolTheme(pool?.theme);
  const compact = variant === "compact";

  return (
    <section
      className={
        compact
          ? "overflow-hidden bg-white"
          : "overflow-hidden rounded-xl bg-white shadow-[0_10px_40px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-950/10"
      }
    >
      {compact ? null : theme.bannerURL ? (
        <div
          aria-hidden="true"
          className="h-24 bg-cover bg-center"
          style={{ backgroundImage: `url(${JSON.stringify(theme.bannerURL)})` }}
        />
      ) : (
        <div aria-hidden="true" className="h-2" style={{ backgroundColor: theme.primaryColor }} />
      )}
      <div className={`flex flex-col gap-4 ${compact ? "p-4" : "p-5"} md:flex-row md:items-start md:justify-between`}>
        <div className="flex min-w-0 items-center gap-3">
          <ThemeLogo theme={theme} />
          <div className="min-w-0">
            <p className="text-sm font-medium" style={{ color: theme.primaryColor }}>
              {tournament?.name ?? "Torneo pendiente"}
            </p>
            <h2 className={`${compact ? "text-xl" : "mt-1 text-2xl"} font-bold tracking-normal text-[#0f172a]`}>
              {poolDisplayName(pool)}
            </h2>
            {compact ? null : (
              <p className="mt-2 text-sm leading-6 text-slate-500">{pool?.description}</p>
            )}
          </div>
        </div>
        <div className={`flex flex-col gap-3 md:items-end ${compact ? "hidden md:flex" : ""}`}>
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

function SummaryGrid({
  summary,
  theme,
}: {
  summary: PredictionSummary | null;
  theme: NormalizedTheme;
}) {
  const total = summary?.total_matches ?? 0;
  const predicted = summary?.predicted_matches ?? 0;
  const missing = summary?.missing_matches ?? 0;
  const closed = summary?.closed_matches ?? 0;
  const progress = total > 0 ? Math.round((predicted / total) * 100) : 0;

  return (
    <section
      className="rounded-2xl border bg-white p-4 shadow-[0_10px_40px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.04)] sm:p-5"
      style={{ borderColor: colorWithAlpha(theme.accentColor, 0.22) }}
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div>
          <p className="text-xs font-semibold uppercase" style={{ color: theme.primaryColor }}>
            Tu avance
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-normal text-[#0f172a] xl:text-2xl">
            {predicted} de {total} partidos pronosticados
          </h2>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full sm:mt-4 sm:h-3"
            style={{ backgroundColor: colorWithAlpha(theme.secondaryColor, 0.12) }}
          >
            <div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${theme.primaryColor}, ${theme.accentColor})`,
                width: `${Math.min(progress, 100)}%`,
              }}
            />
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 xl:min-w-64 xl:gap-3">
          <SummaryStat label="Faltantes" theme={theme} value={missing} />
          <SummaryStat label="Cerrados" theme={theme} value={closed} />
          <SummaryStat label="Avance" theme={theme} value={`${progress}%`} />
        </dl>
      </div>
    </section>
  );
}

function SummaryStat({
  label,
  theme,
  value,
}: {
  label: string;
  theme: NormalizedTheme;
  value: number | string;
}) {
  return (
    <div
      className="rounded-xl px-3 py-2 sm:px-4 sm:py-3"
      style={{ backgroundColor: colorWithAlpha(theme.secondaryColor, 0.1) }}
    >
      <dt className="truncate text-[10px] font-semibold uppercase sm:text-xs" style={{ color: theme.primaryColor }}>
        {label}
      </dt>
      <dd className="mt-1 text-base font-bold text-[#0f172a] sm:text-xl">{value}</dd>
    </div>
  );
}

function DashboardNavigation({
  currentUserID,
  globalPrizePreview,
  onSelectSection,
  prizePreview,
  ranking,
  theme,
}: {
  currentUserID: string;
  globalPrizePreview: GlobalPredictionPrizePreview | null;
  onSelectSection: (section: ParticipantSectionID) => void;
  prizePreview: PrizePreview | null;
  ranking: RankingEntry[];
  theme: NormalizedTheme;
}) {
  const currentRanking = ranking.find((entry) => entry.user_id === currentUserID);
  const prizeCount = (prizePreview?.payouts.length ?? 0) + (globalPrizePreview?.prizes.length ?? 0);
  const prizeCurrency = prizePreview?.currency ?? globalPrizePreview?.currency ?? "COP";
  const prizeTotal =
    prizePreview?.prize_pool_total_cents ??
    globalPrizePreview?.prize_pool_total_cents ??
    prizePreview?.confirmed_total_cents ??
    globalPrizePreview?.confirmed_total_cents ??
    0;
  const links = [
    {
      section: "ranking" as const,
      label: "Ranking",
      value: currentRanking ? `#${currentRanking.position}` : "-",
      detail: currentRanking
        ? `${currentRanking.points} pts · ${ranking.length} participantes`
        : `${ranking.length} participantes`,
    },
    {
      section: "premios" as const,
      label: "Premios",
      value: `${prizeCount} premios`,
      detail: formatMoney(prizeTotal, prizeCurrency),
    },
  ];

  return (
    <nav
      aria-label="Accesos de la polla"
      className="hidden gap-3 xl:grid xl:grid-cols-2"
    >
      {links.map((link) => (
        <button
          className="rounded-2xl border bg-white px-5 py-4 text-left text-sm shadow-sm transition hover:-translate-y-0.5"
          key={link.label}
          onClick={() => onSelectSection(link.section)}
          style={{
            borderColor: colorWithAlpha(theme.accentColor, 0.24),
            boxShadow: `0 10px 24px ${colorWithAlpha(theme.primaryColor, 0.08)}`,
          }}
          type="button"
        >
          <span className="block font-semibold text-zinc-950">{link.label}</span>
          <span className="mt-2 block text-lg font-semibold" style={{ color: theme.primaryColor }}>
            {link.value}
          </span>
          <span className="mt-1 block text-xs text-zinc-500">{link.detail}</span>
        </button>
      ))}
    </nav>
  );
}

function PrizePanel({
  globalPreview,
  preview,
  ranking,
  rankingManualTiebreakers,
  rankingTiebreakers,
}: {
  globalPreview: GlobalPredictionPrizePreview | null;
  preview: PrizePreview | null;
  ranking: RankingEntry[];
  rankingManualTiebreakers: RankingManualTiebreaker[];
  rankingTiebreakers: RankingTiebreaker[];
}) {
  const payouts = preview?.payouts ?? [];
  const rankingPayouts = buildRankingPrizePayouts(preview, ranking);
  const globalPrizes = globalPreview?.prizes ?? [];
  const currency = preview?.currency ?? globalPreview?.currency ?? "COP";
  const confirmedTotalCents =
    preview?.prize_pool_total_cents ??
    globalPreview?.prize_pool_total_cents ??
    preview?.confirmed_total_cents ??
    globalPreview?.confirmed_total_cents ??
    0;
  const safeRankingTiebreakers = Array.isArray(rankingTiebreakers) ? rankingTiebreakers : [];
  const activeTiebreakers = safeRankingTiebreakers
    .filter((tiebreaker) => tiebreaker.enabled)
    .sort((left, right) => left.priority - right.priority);
  const manualTiebreakerSummary = buildRankingManualTiebreakerSummary(
    ranking,
    rankingManualTiebreakers,
  );

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
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm" id="premios">
      <div className="grid gap-4 border-b border-zinc-200 bg-zinc-50/70 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Premios</h2>
          <p className="mt-1 text-sm text-zinc-600">Distribucion de bolsa y premios especiales.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase text-emerald-700">Bolsa</p>
            <p className="mt-1 text-lg font-semibold text-zinc-950">
              {formatMoney(confirmedTotalCents, currency)}
            </p>
          </div>
          <div className="rounded-lg border border-white bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase text-sky-700">Ranking</p>
            <p className="mt-1 text-lg font-semibold text-zinc-950">{payouts.length}</p>
          </div>
          <div className="rounded-lg border border-white bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase text-amber-700">Globales</p>
            <p className="mt-1 text-lg font-semibold text-zinc-950">{globalPrizes.length}</p>
          </div>
        </div>
      </div>
      {preview?.ranking_tie_policy === "automatic" && activeTiebreakers.length > 0 ? (
        <div className="border-b border-zinc-200 px-5 py-3 text-xs text-zinc-600">
          Desempate automatico:{" "}
          {activeTiebreakers
            .map((tiebreaker) => rankingTiebreakerLabels[tiebreaker.code])
            .join(" · ")}
        </div>
      ) : null}
      {preview?.ranking_tie_policy === "manual" ? (
        <div className="border-b border-zinc-200 px-5 py-3 text-xs text-zinc-600">
          Desempate manual: {manualTiebreakerSummary || "pendiente de decision"}
        </div>
      ) : null}
      {payouts.length > 0 ? (
        <div className="px-5 py-5">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-zinc-950">Premios por ranking</h3>
              <p className="text-sm text-zinc-600">Se asignan segun la posicion final en la polla.</p>
            </div>
            <span className="w-fit rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
              {rankingPayouts.length} posiciones
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {rankingPayouts.map((payout) => (
              <article
                key={`${payout.position}-${payout.description}`}
                className={`rounded-xl border p-4 shadow-sm ${
                  payout.position === 1
                    ? "border-emerald-200 bg-emerald-50/70"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">
                      {payout.description || `Posicion ${payout.position}`}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{payout.percentage}% de la bolsa</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-zinc-950 shadow-sm">
                    #{payout.position}
                  </span>
                </div>
                <p className="mt-5 text-2xl font-semibold text-zinc-950">
                  {formatMoney(payout.estimated_amount_cents, currency)}
                </p>
                {payout.winners.length > 0 ? (
                  <div className="mt-4 space-y-2 text-xs text-zinc-600">
                    {payout.split ? (
                      <p className="rounded-md bg-white/80 px-3 py-2">
                        Premio dividido entre {payout.winners.length} empatados.
                      </p>
                    ) : null}
                    {payout.winners.map((winner) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-md bg-white/80 px-3 py-2"
                        key={`${payout.position}-${winner.user_id}`}
                      >
                        <span className="min-w-0 truncate font-medium text-zinc-800">
                          {rankingDisplayName(winner)}
                        </span>
                        <span className="shrink-0 font-semibold text-emerald-800">
                          {formatMoney(winner.estimated_amount_cents, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                    Sin ganador asignado todavia.
                  </p>
                )}
              </article>
            ))}
          </div>
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
  savingDefinitionCode: string;
  tournament: Tournament | null;
  userPredictions: GlobalPrediction[];
}) {
  const enabledDefinitions = definitions.filter((definition) => definition.enabled);
  const predictionsByCode = indexGlobalPredictions(userPredictions);
  const resultsByCode = indexGlobalPredictionResults(results);
  const teamOptions = tournamentTeamOptions(tournament);
  const [open, setOpen] = useState(false);

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
      <button
        aria-expanded={open}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-zinc-200 px-5 py-4 text-left sm:grid-cols-[minmax(0,1fr)_auto_auto]"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Predicciones globales</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {completedCount} de {enabledDefinitions.length} pronósticos completos.
          </p>
        </div>
        <span className="flex items-center gap-3 text-sm text-zinc-600">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-zinc-200 text-base font-semibold">
            {open ? "⌃" : "⌄"}
          </span>
        </span>
      </button>

      <datalist id="global-team-options">
        {teamOptions.map((team) => (
          <option key={team.id} value={team.name} />
        ))}
      </datalist>

      {open ? (
        <div className="grid gap-3 bg-zinc-50/70 px-4 py-5 sm:px-5 min-[900px]:grid-cols-2 2xl:grid-cols-3">
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
              <article
                className="grid min-h-full gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                key={definition.code}
              >
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold tracking-normal text-zinc-950">
                        {definition.label}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        {globalPredictionValueTypeLabel(definition.value_type)}
                        {definition.closes_at
                          ? ` - Cierra ${formatMatchDate(definition.closes_at)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
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
                    </div>
                  </div>

                  <div className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                    {prediction ? (
                      <p>
                        Guardado:{" "}
                        <span className="font-semibold text-zinc-950">
                          {globalPredictionValueLabel(prediction, teamOptions)}
                        </span>
                      </p>
                    ) : (
                      <p>Sin respuesta guardada.</p>
                    )}
                    {definition.prize_enabled ? (
                      <p className="mt-1 text-xs font-semibold text-sky-800">Premio especial</p>
                    ) : null}
                    {visibleResult ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        Resultado oficial: {globalPredictionValueLabel(visibleResult, teamOptions)}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid content-end gap-3">
                  <GlobalPredictionInput
                    closed={closed}
                    definition={definition}
                    draft={draft}
                    onUpdateDraft={onUpdateDraft}
                    teamOptions={teamOptions}
                  />

                  <button
                    aria-label={`Guardar prediccion global ${definition.label}`}
                    className="h-11 w-full rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                    disabled={closed || isSaving}
                    onClick={() => onSave(definition)}
                    type="button"
                  >
                    {isSaving ? "Guardando" : "Guardar"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function TeamAutocomplete({
  ariaLabel,
  disabled,
  label,
  onChange,
  options,
  placeholder,
  value,
}: {
  ariaLabel: string;
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: TournamentTeamOption[];
  placeholder: string;
  value: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selectedTeam = options.find((team) => teamOptionValue(team) === value);
  const visibleValue = open ? query : selectedTeam?.name ?? (value || "");
  const normalizedQuery = normalizeSearchText(query);
  const filteredOptions = normalizedQuery
    ? options.filter((team) =>
        [team.name, team.short_name, team.country_code, ...(team.aliases ?? [])]
          .filter(Boolean)
          .some((text) => normalizeSearchText(text).includes(normalizedQuery)),
      )
    : options;

  return (
    <label className="relative grid gap-1 text-xs font-medium text-zinc-600">
      <span>{label}</span>
      <input
        aria-label={ariaLabel}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 disabled:bg-zinc-100"
        disabled={disabled}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
            setQuery("");
          }, 120);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (event.target.value === "") {
            onChange("");
          }
        }}
        onFocus={() => setOpen(true)}
        placeholder={selectedTeam ? undefined : placeholder}
        value={visibleValue}
      />
      {open && !disabled ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 normal-case shadow-lg">
          {filteredOptions.slice(0, 12).map((team) => (
            <button
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100"
              key={teamOptionValue(team)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(teamOptionValue(team));
                setQuery("");
                setOpen(false);
              }}
              type="button"
            >
              <TeamBadge label={team.name} team={team} />
            </button>
          ))}
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-3 text-sm text-zinc-500">Sin equipos encontrados.</p>
          ) : null}
        </div>
      ) : null}
    </label>
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
      <TeamAutocomplete
        ariaLabel={`Pronóstico global ${definition.label}`}
        disabled={closed}
        label="Equipo"
        onChange={(value) => onUpdateDraft(definition.code, "valueText", value)}
        options={teamOptions}
        placeholder="Buscar equipo"
        value={draft.valueText}
      />
    );
  }

  if (definition.value_type === "number") {
    return (
      <label className="grid gap-1 text-xs font-medium text-zinc-600">
        <span>Valor exacto</span>
        <input
          aria-label={`Pronóstico global ${definition.label}`}
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
            aria-label={`Pronóstico global desde ${definition.label}`}
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
            aria-label={`Pronóstico global hasta ${definition.label}`}
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

  if (definition.value_type === "boolean") {
    return (
      <label className="grid gap-1 text-xs font-medium text-zinc-600">
        <span>Respuesta</span>
        <select
          aria-label={`Pronóstico global ${definition.label}`}
          className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 disabled:bg-zinc-100"
          disabled={closed}
          onChange={(event) =>
            onUpdateDraft(definition.code, "valueNumber", event.target.value)
          }
          value={draft.valueNumber}
        >
          <option value="">Elegir</option>
          <option value="1">Si</option>
          <option value="0">No</option>
        </select>
      </label>
    );
  }

  return (
    <label className="grid gap-1 text-xs font-medium text-zinc-600">
      <span>{definition.value_type === "team" ? "Equipo" : "Respuesta"}</span>
      <input
        aria-label={`Pronóstico global ${definition.label}`}
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
  const [participantSearch, setParticipantSearch] = useState("");
  if (!pool) {
    return null;
  }
  const normalizedSearch = normalizeSearchText(participantSearch);
  const filteredParticipants = normalizedSearch
    ? pool.participants.filter((participant) =>
        normalizeSearchText(
          `${poolParticipantDisplayName(participant)} ${poolParticipantHandle(participant)} ${paymentStatusLabel(
            participant.payment_status,
          )}`,
        ).includes(normalizedSearch),
      )
    : pool.participants;

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
      <div className="border-b border-zinc-200 px-5 py-4">
        <label className="text-sm font-medium text-zinc-800" htmlFor="participants-search">
          Buscar participante
        </label>
        <input
          autoComplete="off"
          className="mt-2 min-h-10 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          id="participants-search"
          onChange={(event) => setParticipantSearch(event.target.value)}
          placeholder="Filtrar por nombre, usuario o estado de pago"
          type="text"
          value={participantSearch}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="px-5 py-3 font-medium">Participante</th>
              <th className="px-5 py-3 font-medium">Pago</th>
            </tr>
          </thead>
          <tbody>
            {filteredParticipants.map((participant) => (
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
                <td className="px-5 py-3">
                  <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                    {paymentStatusLabel(participant.payment_status)}
                  </span>
                </td>
              </tr>
            ))}
            {filteredParticipants.length === 0 ? (
              <tr>
                <td className="px-5 py-5 text-sm text-zinc-600" colSpan={2}>
                  No encontramos participantes con ese filtro.
                </td>
              </tr>
            ) : null}
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
  closedPredictionsByUserID,
  currentUserID,
  detailsByUserID,
  loadingUserID,
  message,
  onSelectUser,
  ranking,
  selectedUserID,
}: {
  closedPredictionsByUserID: Record<string, ClosedPrediction[]>;
  currentUserID: string;
  detailsByUserID: Record<string, PointEventDetail[]>;
  loadingUserID: string;
  message: string;
  onSelectUser: (userID: string) => void;
  ranking: RankingEntry[];
  selectedUserID: string;
}) {
  const [participantSearch, setParticipantSearch] = useState("");
  const selectedDetails = selectedUserID ? detailsByUserID[selectedUserID] : undefined;
  const selectedClosedPredictions = selectedUserID
    ? closedPredictionsByUserID[selectedUserID]
    : undefined;
  const isLoading = selectedUserID !== "" && loadingUserID === selectedUserID;
  const normalizedSearch = normalizeSearchText(participantSearch);
  const filteredRanking = normalizedSearch
    ? ranking.filter((entry) => normalizeSearchText(rankingSearchLabel(entry)).includes(normalizedSearch))
    : ranking;

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
        <div>
          <div className="grid gap-4 border-b border-zinc-200 px-5 py-4">
            <div>
              <label className="text-sm font-medium text-zinc-800" htmlFor="ranking-search">
                Buscar participante
              </label>
              <input
                autoComplete="off"
                className="mt-2 min-h-10 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                id="ranking-search"
                placeholder="Filtrar por nombre, usuario o posicion"
                value={participantSearch}
                onChange={(event) => setParticipantSearch(event.target.value)}
              />
            </div>
          </div>
          <ol className="divide-y divide-zinc-100">
            {filteredRanking.map((entry) => {
              const isSelected = entry.user_id === selectedUserID;
              const isCurrentUser = entry.user_id === currentUserID;
              const displayName = rankingDisplayName(entry);
              const entryDetails = isSelected ? selectedDetails : undefined;
              const entryClosedPredictions = isSelected ? selectedClosedPredictions : undefined;

              return (
                <li className={isSelected ? "bg-emerald-50/60" : "bg-white"} key={entry.user_id}>
                  <button
                    aria-expanded={isSelected}
                    aria-label={`Ver detalle de ${displayName}`}
                    className="grid min-h-20 w-full grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 text-left text-sm transition hover:bg-zinc-50"
                    onClick={() => onSelectUser(entry.user_id)}
                    type="button"
                  >
                    <span className="text-2xl font-semibold text-zinc-950">#{entry.position}</span>
                    <span className="min-w-0">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-base font-semibold text-zinc-950">
                          {displayName}
                        </span>
                        {isCurrentUser ? (
                          <span className="rounded-md bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800">
                            Tu
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate text-xs text-zinc-500">
                        {participantHandle(entry)} · {entry.event_count} eventos puntuados
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-2xl font-semibold text-zinc-950">
                        {entry.points}
                      </span>
                      <span className="text-xs font-medium text-zinc-500">pts</span>
                    </span>
                  </button>

                  {isSelected ? (
                    <div className="grid gap-4 border-t border-emerald-100 px-5 pb-5 pt-4 lg:grid-cols-2">
                      <div className="rounded-md border border-zinc-200 bg-white p-4">
                        <h3 className="text-sm font-semibold text-zinc-950">Detalle de puntos</h3>
                        {message ? (
                          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            {message}
                          </p>
                        ) : null}
                        {isLoading ? (
                          <p className="mt-3 text-sm text-zinc-600">Cargando detalle...</p>
                        ) : null}
                        {!isLoading && entryDetails?.length === 0 ? (
                          <p className="mt-3 text-sm leading-6 text-zinc-600">
                            Este participante aún no tiene puntos detallados.
                          </p>
                        ) : null}
                        {!isLoading && entryDetails && entryDetails.length > 0 ? (
                          <ul className="mt-4 divide-y divide-zinc-100 rounded-md border border-zinc-200">
                            {entryDetails.map((detail) => (
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

                      <div className="rounded-md border border-zinc-200 bg-white p-4">
                        <h3 className="text-sm font-semibold text-zinc-950">
                          Pronósticos cerrados
                        </h3>
                        <p className="mt-1 text-xs text-zinc-500">
                          Solo se muestran partidos cuyo cierre ya paso.
                        </p>
                        {isLoading ? (
                          <p className="mt-3 text-sm text-zinc-600">Cargando pronósticos...</p>
                        ) : null}
                        {!isLoading && entryClosedPredictions?.length === 0 ? (
                          <p className="mt-3 text-sm leading-6 text-zinc-600">
                            Este participante no tiene pronósticos cerrados visibles.
                          </p>
                        ) : null}
                        {!isLoading &&
                        entryClosedPredictions &&
                        entryClosedPredictions.length > 0 ? (
                          <ul className="mt-3 divide-y divide-zinc-100 rounded-md border border-zinc-200">
                            {entryClosedPredictions.map((prediction) => (
                              <li className="px-3 py-3 text-sm" key={prediction.id}>
                                <div className="flex items-start justify-between gap-3">
                                  <span className="min-w-0">
                                    <span className="block font-semibold text-zinc-950">
                                      {closedPredictionTitle(prediction)}
                                    </span>
                                    <span className="mt-1 block text-xs text-zinc-500">
                                      {prediction.stage_name || prediction.group_name || "Partido"} -{" "}
                                      {formatMatchDate(prediction.starts_at)}
                                    </span>
                                  </span>
                                  <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-800">
                                    {closedPredictionValue(prediction)}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
            {filteredRanking.length === 0 ? (
              <li className="px-5 py-5 text-sm text-zinc-600">
                No encontramos participantes con ese filtro.
              </li>
            ) : null}
          </ol>
        </div>
      )}
    </section>
  );
}

function PredictionList({
  clockTick,
  drafts,
  effectiveMatchSettingsByMatch,
  underdogBonusesByMatch,
  underdogRule,
  onDownloadSnapshot,
  onLoadSnapshot,
  onSave,
  onSaveOutcome,
  onSaveStanding,
  onMoveStanding,
  onUpdateDraft,
  pool,
  predictionGroups,
  predictionsByMatch,
  predictionStatusesByMatch,
  savingMatchID,
  savingStandingGroupID,
  snapshotDownloadingMatchID,
  snapshotLoadingMatchID,
  snapshotMessages,
  snapshotsByMatchID,
  standingDrafts,
  standingPredictionsByGroup,
  tournament,
}: {
  clockTick: number;
  drafts: ScoreDrafts;
  effectiveMatchSettingsByMatch: Map<string, EffectiveMatchPredictionSettings>;
  underdogBonusesByMatch: Map<string, MatchUnderdogBonus>;
  underdogRule?: ScoringRule;
  onDownloadSnapshot: (matchID: string) => void;
  onLoadSnapshot: (matchID: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>, match: Match) => void;
  onSaveOutcome: (match: Match, outcome: MatchOutcome) => void;
  onSaveStanding: (group: PredictionGroup) => void;
  onMoveStanding: (group: PredictionGroup, teamID: string, direction: -1 | 1) => void;
  onUpdateDraft: (matchID: string, side: "home" | "away" | "outcome", value: string) => void;
  pool: Pool | null;
  predictionGroups: PredictionGroup[];
  predictionsByMatch: Map<string, Prediction>;
  predictionStatusesByMatch: Map<string, PredictionMatchStatus>;
  savingMatchID: string;
  savingStandingGroupID: string;
  snapshotDownloadingMatchID: string;
  snapshotLoadingMatchID: string;
  snapshotMessages: Record<string, string>;
  snapshotsByMatchID: Record<string, PredictionSnapshot>;
  standingDrafts: StandingDrafts;
  standingPredictionsByGroup: Map<string, StandingPrediction>;
  tournament: Tournament | null;
}) {
  const [open, setOpen] = useState(false);
  const [openGroupIDs, setOpenGroupIDs] = useState<Set<string>>(
    () => new Set(),
  );

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
        message="Este torneo aún no tiene partidos configurados para pronosticar."
      />
    );
  }
  const firstStandingGroupID =
    predictionGroups.find((group) => group.standings.length > 0)?.id ?? "";

  function toggleGroup(groupID: string) {
    setOpenGroupIDs((current) => {
      const next = new Set(current);
      if (next.has(groupID)) {
        next.delete(groupID);
      } else {
        next.add(groupID);
      }
      return next;
    });
  }

  return (
    <section className="w-full max-w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm" id="pronosticos">
      <button
        aria-expanded={open}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-zinc-200 px-5 py-4 text-left sm:grid-cols-[minmax(0,1fr)_auto_auto]"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Partidos por pronosticar</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {predictionGroups.length} grupos o rondas disponibles.
          </p>
        </div>
        <span className="flex items-center gap-3 text-sm text-zinc-600">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-zinc-200 text-base font-semibold">
            {open ? "⌃" : "⌄"}
          </span>
        </span>
      </button>
      {open ? (
      <div className="divide-y divide-zinc-200">
        {predictionGroups.map((group) => {
          const groupOpen = openGroupIDs.has(group.id);
          return (
          <section aria-labelledby={`${group.id}-title`} key={group.id}>
            <button
              aria-expanded={groupOpen}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-zinc-50 px-5 py-4 text-left min-[900px]:grid-cols-[minmax(0,1fr)_auto_auto]"
              onClick={() => toggleGroup(group.id)}
              type="button"
            >
              <div>
                <p className="text-xs font-medium uppercase text-sky-700">{group.subtitle}</p>
                <h3
                  className="mt-1 text-base font-semibold tracking-normal text-zinc-950"
                  id={`${group.id}-title`}
                >
                  {group.title}
                </h3>
                <p className="mt-2 text-xs font-medium text-zinc-500 min-[900px]:hidden">
                  {group.stats.total} partidos · {group.stats.predicted}/{group.stats.total} pronosticados ·{" "}
                  {group.stats.missing} faltantes · {group.stats.closed} cerrados
                </p>
              </div>
              <dl className="hidden grid-cols-4 gap-2 text-xs text-zinc-600 min-[900px]:col-span-1 min-[900px]:grid">
                <MetricItem label="Partidos" value={group.stats.total} />
                <MetricItem
                  label="Pronosticados"
                  value={`${group.stats.predicted}/${group.stats.total}`}
                />
                <MetricItem label="Faltantes" value={group.stats.missing} />
                <MetricItem label="Cerrados" value={group.stats.closed} />
              </dl>
              <span className="grid h-10 w-10 place-items-center rounded-full border border-zinc-200 bg-white text-base font-semibold text-zinc-600">
                {groupOpen ? "⌃" : "⌄"}
              </span>
            </button>
            {groupOpen ? (
            <>
            <div className="border-t border-zinc-200">
              <div className="bg-white px-5 py-3">
                <h4 className="text-sm font-semibold text-zinc-950">Partidos</h4>
                <p className="mt-1 text-xs text-zinc-500">
                  Marca cada partido disponible de este grupo o ronda.
                </p>
              </div>
              <div className="grid gap-3 bg-zinc-50/70 px-4 py-5 sm:px-5 min-[900px]:grid-cols-2">
                {group.matches.map((match) => {
                  const matchSettings = effectiveMatchSettingsByMatch.get(match.id);
                  return (
                    <MatchPredictionForm
                      draft={drafts[match.id] ?? emptyPredictionDraft()}
                      key={match.id}
                      match={match}
                      underdogBonus={underdogBonusesByMatch.get(match.id)}
                      underdogRule={effectiveUnderdogRule(underdogRule, matchSettings)}
                      onDownloadSnapshot={onDownloadSnapshot}
                      onLoadSnapshot={onLoadSnapshot}
                      onSave={onSave}
                      onSaveOutcome={onSaveOutcome}
                      onUpdateDraft={onUpdateDraft}
                      prediction={predictionsByMatch.get(match.id)}
                      predictionCloseHoursBefore={pool?.prediction_close_hours_before}
                      predictionMode={
                        matchSettings?.prediction_mode ?? pool?.prediction_mode ?? "score_with_outcome"
                      }
                      predictionStatus={predictionStatusesByMatch.get(match.id)}
                      savingMatchID={savingMatchID}
                      snapshot={snapshotsByMatchID[match.id]}
                      snapshotDownloadInProgress={snapshotDownloadingMatchID === match.id}
                      snapshotLoadInProgress={snapshotLoadingMatchID === match.id}
                      snapshotMessage={snapshotMessages[match.id] ?? ""}
                    />
                  );
                })}
              </div>
            </div>
            {group.standings.length > 0 ? (
              <div className="border-t border-zinc-200 bg-white px-5 py-3">
                <h4 className="text-sm font-semibold text-zinc-950">Orden del grupo</h4>
                <p className="mt-1 text-xs text-zinc-500">
                  Revisa la tabla sugerida y ajusta tu orden final si aplica para esta polla.
                </p>
              </div>
            ) : null}
            {group.standings.length > 0 ? (
              <div
                className="bg-white"
                id={group.id === firstStandingGroupID ? "posiciones" : undefined}
              >
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
                  showGoalColumns={shouldShowStandingGoalColumns(
                    group,
                    pool,
                    effectiveMatchSettingsByMatch,
                  )}
                />
              </div>
            ) : null}
            </>
            ) : null}
          </section>
          );
        })}
      </div>
      ) : null}
    </section>
  );
}

function StandingOrderEditor({
  group,
  isClosed,
  isSaving,
  onMove,
  onSave,
  rows,
  showGoalColumns,
}: {
  group: PredictionGroup;
  isClosed: boolean;
  isSaving: boolean;
  onMove: (group: PredictionGroup, teamID: string, direction: -1 | 1) => void;
  onSave: (group: PredictionGroup) => void;
  rows: SuggestedStandingRow[];
  showGoalColumns: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-zinc-950">Orden final</h4>
          <p className="mt-1 text-xs text-zinc-500">
            Inicia con la tabla sugerida por tus marcadores y puedes ajustar posiciones.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
            {showGoalColumns ? "PJ, PTS, GF, GC y DG sugeridos" : "PJ y PTS sugeridos"}
          </span>
          <span
            className={`w-fit rounded-md px-2 py-1 text-xs font-medium ${
              isClosed ? "bg-zinc-100 text-zinc-600" : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {isClosed ? "Cerrado" : "Abierto"}
          </span>
        </div>
      </div>
      <div className="grid gap-2 sm:hidden">
        {rows.map((row, index) => (
          <div className="rounded-xl border border-zinc-200 bg-white p-3" key={row.key}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-500">#{index + 1}</p>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <TeamBadge label={row.teamName} team={row.team} />
                  <span className="shrink-0 text-xs text-zinc-500">{row.teamShortName}</span>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${
                  row.complete
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {row.complete ? "Completo" : "Incompleto"}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-5 gap-1 text-center text-xs">
              <StandingMobileMetric label="PJ" value={row.played} />
              <StandingMobileMetric label="Pts" value={row.points} />
              {showGoalColumns ? (
                <>
                  <StandingMobileMetric label="GF" value={row.goalsFor} />
                  <StandingMobileMetric label="GC" value={row.goalsAgainst} />
                  <StandingMobileMetric label="DG" value={formatGoalDifference(row.goalDifference)} />
                </>
              ) : null}
            </dl>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                aria-label={`Subir ${row.teamName}`}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={index === 0 || isClosed || isSaving}
                onClick={() => onMove(group, row.key, -1)}
                type="button"
              >
                Subir
              </button>
              <button
                aria-label={`Bajar ${row.teamName}`}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={index === rows.length - 1 || isClosed || isSaving}
                onClick={() => onMove(group, row.key, 1)}
                type="button"
              >
                Bajar
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-md border border-zinc-200 sm:block">
        <table className={`w-full border-collapse text-left text-sm ${showGoalColumns ? "min-w-[760px]" : "min-w-[600px]"}`}>
          <thead>
            <tr className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <th className="w-12 px-3 py-3 font-medium">#</th>
              <th className="px-3 py-3 font-medium">Equipo</th>
              <th className="px-3 py-3 text-right font-medium">PJ</th>
              <th className="px-3 py-3 text-right font-medium">Pts</th>
              {showGoalColumns ? (
                <>
                  <th className="px-3 py-3 text-right font-medium">GF</th>
                  <th className="px-3 py-3 text-right font-medium">GC</th>
                  <th className="px-3 py-3 text-right font-medium">DG</th>
                </>
              ) : null}
              <th className="px-3 py-3 text-right font-medium">Estado</th>
              <th className="px-3 py-3 text-right font-medium">Orden</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr className="border-t border-zinc-100" key={row.key}>
                <td className="px-3 py-3 font-semibold text-zinc-950">{index + 1}</td>
                <td className="min-w-0 px-3 py-3">
                  <TeamBadge label={row.teamName} team={row.team} />
                  <span className="ml-2 text-xs text-zinc-500">{row.teamShortName}</span>
                </td>
                <td className="px-3 py-3 text-right text-zinc-700">{row.played}</td>
                <td className="px-3 py-3 text-right font-semibold text-zinc-950">
                  {row.points}
                </td>
                {showGoalColumns ? (
                  <>
                    <td className="px-3 py-3 text-right text-zinc-700">{row.goalsFor}</td>
                    <td className="px-3 py-3 text-right text-zinc-700">{row.goalsAgainst}</td>
                    <td className="px-3 py-3 text-right text-zinc-700">
                      {formatGoalDifference(row.goalDifference)}
                    </td>
                  </>
                ) : null}
                <td className="px-3 py-3 text-right">
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
                <td className="px-3 py-3">
                  <span className="flex justify-end gap-1">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          className="w-full rounded-md bg-zinc-950 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:w-auto"
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

function StandingMobileMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-1.5 py-2">
      <dt className="font-medium uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 font-semibold text-zinc-950">{value}</dd>
    </div>
  );
}

function shouldShowStandingGoalColumns(
  group: PredictionGroup,
  pool: Pool | null,
  effectiveMatchSettingsByMatch: Map<string, EffectiveMatchPredictionSettings>,
) {
  return group.matches.some((match) => {
    const mode = effectiveMatchSettingsByMatch.get(match.id)?.prediction_mode ?? pool?.prediction_mode;
    return mode !== "outcome";
  });
}

function MetricItem({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0 rounded-lg bg-white/70 px-2 py-1.5 text-center">
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
  onSaveOutcome,
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
  onSaveOutcome: (match: Match, outcome: MatchOutcome) => void;
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
  const homeTeam = predictionStatus?.resolved_home_team ?? match.home_team;
  const awayTeam = predictionStatus?.resolved_away_team ?? match.away_team;
  const homeName = homeTeam?.name ?? matchSlotLabel(match, "home");
  const awayName = awayTeam?.name ?? matchSlotLabel(match, "away");
  const statusCode =
    predictionStatus?.status ?? (closed ? "closed" : prediction ? "complete" : "pending");
  const officialResult = predictionStatus?.official_result;
  const activeUnderdogOutcome =
    underdogBonus?.enabled === true && underdogRule?.enabled === true
      ? matchOutcomeValue(underdogBonus.outcome)
      : "";
  const activeUnderdogPoints = activeUnderdogOutcome ? underdogRule?.points ?? 0 : 0;

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <form
        className="grid gap-4"
        onSubmit={(event) => onSave(event, match)}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div>
            <p className="text-xs font-medium text-zinc-500">Partido {match.match_number}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-950">
              <TeamBadge label={homeName} team={homeTeam} />
              <span className="text-zinc-400">vs</span>
              <TeamBadge label={awayName} team={awayTeam} />
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {formatMatchDate(match.starts_at)} - {match.venue}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
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
          </div>
        </div>

        <div className="grid gap-3">
          {predictionMode === "outcome" ? (
            <OutcomePredictionControl
              awayName={awayName}
              awayLabel={awayTeam?.short_name ?? matchSlotLabel(match, "away")}
              awayTeam={awayTeam}
              closed={closed}
              homeLabel={homeTeam?.short_name ?? matchSlotLabel(match, "home")}
              homeName={homeName}
              homeTeam={homeTeam}
              matchID={match.id}
              onSaveOutcome={(outcome) => onSaveOutcome(match, outcome)}
              onUpdateDraft={onUpdateDraft}
              saving={savingMatchID === match.id}
              underdogBonusPoints={activeUnderdogPoints}
              underdogOutcome={activeUnderdogOutcome}
              value={draft.outcome}
            />
          ) : (
            <ScorePredictionControl
              awayLabel={awayTeam?.short_name ?? matchSlotLabel(match, "away")}
              awayName={awayName}
              awayTeam={awayTeam}
              closed={closed}
              draft={draft}
              homeLabel={homeTeam?.short_name ?? matchSlotLabel(match, "home")}
              homeName={homeName}
              homeTeam={homeTeam}
              matchID={match.id}
              onUpdateDraft={onUpdateDraft}
              showDerivedOutcome={predictionMode === "score_with_outcome"}
              underdogBonusPoints={activeUnderdogPoints}
              underdogOutcome={activeUnderdogOutcome}
            />
          )}
          {predictionMode !== "outcome" ? (
            <button
              className="h-11 w-full rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={closed || savingMatchID === match.id}
              type="submit"
            >
              {savingMatchID === match.id ? "Guardando" : "Guardar"}
            </button>
          ) : null}
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
    </article>
  );
}

function ScorePredictionControl({
  awayLabel,
  awayName,
  awayTeam,
  closed,
  draft,
  homeLabel,
  homeName,
  homeTeam,
  matchID,
  onUpdateDraft,
  showDerivedOutcome,
  underdogBonusPoints,
  underdogOutcome,
}: {
  awayLabel: string;
  awayName: string;
  awayTeam: Match["away_team"];
  closed: boolean;
  draft: ScoreDrafts[string];
  homeLabel: string;
  homeName: string;
  homeTeam: Match["home_team"];
  matchID: string;
  onUpdateDraft: (matchID: string, side: "home" | "away" | "outcome", value: string) => void;
  showDerivedOutcome: boolean;
  underdogBonusPoints: number;
  underdogOutcome: MatchOutcome | "";
}) {
  const derivedOutcome = outcomeFromDraftScore(draft);

  return (
    <div className="grid min-w-0 justify-items-center">
      <div className="inline-grid max-w-full grid-cols-[auto_3rem_3rem_auto] items-end gap-2 sm:grid-cols-[auto_4rem_4rem_auto] sm:gap-3">
        <div className="min-w-0 self-center justify-self-end">
          <span className="sm:hidden">
            <TeamBadge label={homeLabel} size="md" team={homeTeam} />
          </span>
          <span className="hidden sm:inline-flex">
            <TeamBadge label={homeLabel} size="lg" team={homeTeam} />
          </span>
        </div>
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          <span className="sr-only">{homeLabel}</span>
          <input
            aria-label={`Marcador ${homeName}`}
            className="h-10 w-11 rounded-md border border-zinc-300 px-1 text-center text-base font-semibold text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100 sm:h-11 sm:w-16 sm:px-2"
            disabled={closed}
            inputMode="numeric"
            max={999}
            min={0}
            onChange={(event) => onUpdateDraft(matchID, "home", event.target.value)}
            step={1}
            type="number"
            value={draft.home}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          <span className="sr-only">{awayLabel}</span>
          <input
            aria-label={`Marcador ${awayName}`}
            className="h-10 w-11 rounded-md border border-zinc-300 px-1 text-center text-base font-semibold text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100 sm:h-11 sm:w-16 sm:px-2"
            disabled={closed}
            inputMode="numeric"
            max={999}
            min={0}
            onChange={(event) => onUpdateDraft(matchID, "away", event.target.value)}
            step={1}
            type="number"
            value={draft.away}
          />
        </label>
        <div className="min-w-0 self-center">
          <span className="sm:hidden">
            <TeamBadge label={awayLabel} size="md" team={awayTeam} />
          </span>
          <span className="hidden sm:inline-flex">
            <TeamBadge label={awayLabel} size="lg" team={awayTeam} />
          </span>
        </div>
      </div>
      {showDerivedOutcome && derivedOutcome ? (
        <p className="mt-2 text-xs font-medium text-zinc-500">
          Resultado: {matchOutcomeLabel(derivedOutcome)}
        </p>
      ) : null}
      {underdogOutcome ? (
        <p className="mt-2 inline-flex max-w-full flex-wrap items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
          <span aria-hidden="true">★</span>
          <span>Sorpresa:</span>
          {underdogOutcome === "home" ? (
            <TeamBadge label={homeLabel} team={homeTeam} />
          ) : underdogOutcome === "away" ? (
            <TeamBadge label={awayLabel} team={awayTeam} />
          ) : (
            <span>{matchOutcomeLabel(underdogOutcome)}</span>
          )}
          <span className="ml-2">+{underdogBonusPoints} pts</span>
        </p>
      ) : null}
    </div>
  );
}

function OutcomePredictionControl({
  awayLabel,
  awayName,
  awayTeam,
  closed,
  homeLabel,
  homeName,
  homeTeam,
  matchID,
  onSaveOutcome,
  onUpdateDraft,
  saving,
  underdogBonusPoints,
  underdogOutcome,
  value,
}: {
  awayLabel: string;
  awayName: string;
  awayTeam: Match["away_team"];
  closed: boolean;
  homeLabel: string;
  homeName: string;
  homeTeam: Match["home_team"];
  matchID: string;
  onSaveOutcome: (outcome: MatchOutcome) => void;
  onUpdateDraft: (matchID: string, side: "home" | "away" | "outcome", value: string) => void;
  saving: boolean;
  underdogBonusPoints: number;
  underdogOutcome: MatchOutcome | "";
  value: MatchOutcome | "";
}) {
  const options: Array<{ value: MatchOutcome; label: string; shortLabel: string }> = [
    { value: "home", label: "Local", shortLabel: "1" },
    { value: "draw", label: "Empate", shortLabel: "E" },
    { value: "away", label: "Visitante", shortLabel: "2" },
  ];

  return (
    <fieldset className="grid justify-items-center gap-3">
      <legend className="sr-only">
        Resultado {homeName} contra {awayName}
      </legend>
      <div className="inline-grid max-w-full grid-cols-[auto_3.25rem_3.25rem_3.25rem_auto] items-center gap-2 sm:grid-cols-[auto_4rem_4rem_4rem_auto] sm:gap-3">
        <div className="justify-self-end">
          <TeamBadge label={homeLabel} size="md" team={homeTeam} />
        </div>
        {options.map((option) => {
          const selected = value === option.value;
          const isUnderdog = underdogOutcome === option.value;
          return (
            <button
              aria-pressed={selected}
              aria-label={`${option.label}: guardar ${homeName} contra ${awayName}`}
              className={`relative grid h-12 w-full place-items-center rounded-md border text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60 sm:h-14 ${
                selected
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
              }`}
              disabled={closed || saving}
              key={option.value}
              onClick={() => {
                onUpdateDraft(matchID, "outcome", option.value);
                onSaveOutcome(option.value);
              }}
              title={isUnderdog ? `Bonus sorpresa +${underdogBonusPoints} puntos` : undefined}
              type="button"
            >
              {isUnderdog ? (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 grid place-items-center text-[2rem] leading-none [-webkit-text-stroke:0.035em_currentColor] sm:text-[2.25rem] ${
                    selected ? "text-white/55" : "text-slate-950/42"
                  }`}
                >
                  ★
                </span>
              ) : null}
              <span className="relative z-10">{option.shortLabel}</span>
            </button>
          );
        })}
        <div>
          <TeamBadge label={awayLabel} size="md" team={awayTeam} />
        </div>
      </div>
      {underdogOutcome ? (
        <p className="inline-flex max-w-full flex-wrap items-center justify-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
          <span aria-hidden="true">★</span>
          <span>Sorpresa:</span>
          {underdogOutcome === "home" ? (
            <TeamBadge label={homeLabel} team={homeTeam} />
          ) : underdogOutcome === "away" ? (
            <TeamBadge label={awayLabel} team={awayTeam} />
          ) : (
            <span>{matchOutcomeLabel(underdogOutcome)}</span>
          )}
          <span className="ml-2">+{underdogBonusPoints} pts</span>
        </p>
      ) : null}
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
          <h4 className="text-sm font-semibold text-zinc-950">Pronósticos cerrados</h4>
          <p className="mt-1 text-xs text-zinc-500">
            {snapshot
              ? `${snapshot.row_count} participantes - checksum ${snapshot.checksum.slice(0, 10)}`
              : "Disponibles para auditoría cuando el partido ya cerró."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loadInProgress}
            onClick={onLoad}
            type="button"
          >
            {loadInProgress ? "Cargando..." : snapshot ? "Actualizar vista" : "Ver pronósticos"}
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
            <th className="py-2 pr-3 text-right font-medium">Pronóstico</th>
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
                  {entry.has_prediction ? "Pronosticado" : "Sin pronóstico"}
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
      message="Estamos consultando tus pronósticos."
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

function isUnauthorizedError(error: unknown) {
  return error instanceof PollavarAPIError && error.status === 401;
}

function isPredictionClosedError(error: unknown) {
  return error instanceof PollavarAPIError && error.status === 409 && error.code === "prediction_closed";
}

function snapshotErrorMessage(error: unknown) {
  if (error instanceof PollavarAPIError && error.code === "prediction_open") {
    return "Los pronósticos de este partido aún no han cerrado.";
  }
  return "No pudimos cargar los pronósticos cerrados.";
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

async function listEffectiveMatchPredictionSettingsWithFallback(
  client: ReturnType<typeof createPollavarClient>,
  token: string,
  poolID: string,
) {
  try {
    return await client.listEffectiveMatchPredictionSettings(token, poolID);
  } catch (error) {
    if (isMissingEndpointError(error)) {
      return [];
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

async function listRankingTiebreakersWithFallback(
  client: ReturnType<typeof createPollavarClient>,
  token: string,
  poolID: string,
) {
  try {
    const tiebreakers = await client.listRankingTiebreakers(token, poolID);
    return Array.isArray(tiebreakers) ? tiebreakers : [];
  } catch (error) {
    if (isMissingEndpointError(error)) {
      return [];
    }
    throw error;
  }
}

async function listRankingManualTiebreakersWithFallback(
  client: ReturnType<typeof createPollavarClient>,
  token: string,
  poolID: string,
) {
  try {
    const decisions = await client.listRankingManualTiebreakers(token, poolID);
    return Array.isArray(decisions) ? decisions : [];
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
        prize_pool_percentage: 100,
        prize_pool_total_cents: 0,
        admin_fee_cents: 0,
        ranking_tie_policy: "split_equal",
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
        prize_pool_percentage: 100,
        prize_pool_total_cents: 0,
        admin_fee_cents: 0,
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

async function listClosedPredictionsWithFallback(
  client: ReturnType<typeof createPollavarClient>,
  token: string,
  poolID: string,
  userID: string,
) {
  try {
    return await client.listClosedPredictions(token, poolID, userID);
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
    const impliedScore = prediction ? standingScoreFromPrediction(prediction) : null;
    if (!impliedScore) {
      continue;
    }

    const homeRow = rowsByTeam.get(homeKey);
    const awayRow = rowsByTeam.get(awayKey);
    if (!homeRow || !awayRow) {
      continue;
    }

    homeRow.played += 1;
    awayRow.played += 1;
    homeRow.goalsFor += impliedScore.home;
    homeRow.goalsAgainst += impliedScore.away;
    awayRow.goalsFor += impliedScore.away;
    awayRow.goalsAgainst += impliedScore.home;

    if (impliedScore.home > impliedScore.away) {
      homeRow.points += 3;
    } else if (impliedScore.home < impliedScore.away) {
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
  const stageName = match.stage_name.toLowerCase();
  const stageType = match.stage_type.toLowerCase();
  return (
    groupName !== "" ||
    groupID.includes("group") ||
    stageType === "group" ||
    stageType === "league" ||
    stageID.includes("group") ||
    stageID.includes("league") ||
    stageID.includes("regular") ||
    stageID.includes("round-robin") ||
    stageName.includes("group") ||
    stageName.includes("league") ||
    stageName.includes("regular") ||
    stageName.includes("round robin")
  );
}

function standingScoreFromPrediction(prediction: Prediction) {
  if (predictionHasScore(prediction)) {
    return { home: prediction.home_score, away: prediction.away_score };
  }

  switch (matchOutcomeValue(prediction.outcome)) {
    case "home":
      return { home: 1, away: 0 };
    case "away":
      return { home: 0, away: 1 };
    case "draw":
      return { home: 0, away: 0 };
    default:
      return null;
  }
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
    team,
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

function matchSlotLabel(match: Match, side: "home" | "away") {
  const slotConfig = side === "home" ? match.home_slot_config : match.away_slot_config;
  const fallbackSlot = side === "home" ? match.home_slot : match.away_slot;
  return slotConfig?.label || fallbackSlot;
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

  return formatStageName(match);
}

function predictionGroupSubtitle(match: Match) {
  if (match.group_name.trim()) {
    return formatStageName(match);
  }

  return "Ronda";
}

function formatStageName(match: Pick<Match, "stage_id" | "stage_name" | "stage_type" | "stage_round_size">) {
  const stageType = match.stage_type.toLowerCase();
  if (stageType === "knockout" && match.stage_round_size > 2) {
    return `Ronda de ${match.stage_round_size}`;
  }
  if (stageType === "knockout" && match.stage_round_size === 2) {
    return "Final";
  }
  const source = match.stage_name || match.stage_id;
  const normalizedStage = source.toLowerCase();
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

  return toTitleCase(source.replace(/[-_]+/g, " "));
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

function indexEffectiveMatchSettings(settings: EffectiveMatchPredictionSettings[]) {
  const indexed = new Map<string, EffectiveMatchPredictionSettings>();
  for (const setting of settings) {
    indexed.set(setting.match_id, setting);
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

function predictionInputFromDraft(predictionMode: Pool["prediction_mode"], draft: ScoreDrafts[string]) {
  if (predictionMode === "outcome") {
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

  if (definition.value_type === "boolean") {
    const valueNumber = parseWholeNumber(draft.valueNumber);
    return valueNumber === 0 || valueNumber === 1 ? { value_number: valueNumber } : null;
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
    case "score_difference":
      return "Diferencia correcta";
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

function effectiveUnderdogRule(
  rule: ScoringRule | undefined,
  settings: EffectiveMatchPredictionSettings | undefined,
) {
  if (!settings) {
    return rule;
  }
  return {
    code: "underdog_bonus",
    enabled: settings.underdog_bonus_enabled,
    points: settings.underdog_bonus_points,
  } satisfies ScoringRule;
}

type RankingPrizePayout = PrizePreview["payouts"][number] & {
  split: boolean;
  occupied_positions: number[];
  winners: Array<RankingEntry & { estimated_amount_cents: number }>;
};

function buildRankingPrizePayouts(
  preview: PrizePreview | null,
  ranking: RankingEntry[],
): RankingPrizePayout[] {
  const payouts = preview?.payouts ?? [];
  if (preview?.ranking_tie_policy !== "split_equal") {
    return payouts.map((payout) => ({
      ...payout,
      split: false,
      occupied_positions: [payout.position],
      winners: ranking
        .filter((entry) => entry.prize_eligible && entry.position === payout.position)
        .map((winner) => ({
          ...winner,
          estimated_amount_cents: payout.estimated_amount_cents,
        })),
    }));
  }

  const payoutByPosition = new Map(payouts.map((payout) => [payout.position, payout]));
  const consumedPositions = new Set<number>();
  const groupedRanking = new Map<number, RankingEntry[]>();
  for (const entry of ranking.filter((rankingEntry) => rankingEntry.prize_eligible)) {
    groupedRanking.set(entry.position, [...(groupedRanking.get(entry.position) ?? []), entry]);
  }

  const result: RankingPrizePayout[] = [];
  for (const position of [...groupedRanking.keys()].sort((left, right) => left - right)) {
    const winners = groupedRanking.get(position) ?? [];
    const occupiedPayouts = Array.from({ length: winners.length }, (_, index) =>
      payoutByPosition.get(position + index),
    ).filter((payout): payout is PrizePreview["payouts"][number] => Boolean(payout));

    if (occupiedPayouts.length === 0) {
      continue;
    }

    for (const payout of occupiedPayouts) {
      consumedPositions.add(payout.position);
    }

    const totalAmountCents = occupiedPayouts.reduce(
      (total, payout) => total + payout.estimated_amount_cents,
      0,
    );
    const totalPercentage = occupiedPayouts.reduce((total, payout) => total + payout.percentage, 0);
    const winnerAmounts = splitCents(totalAmountCents, winners.length);
    const firstPayout = occupiedPayouts[0];
    const lastPayout = occupiedPayouts[occupiedPayouts.length - 1];

    result.push({
      ...firstPayout,
      percentage: totalPercentage,
      estimated_amount_cents: totalAmountCents,
      description:
        occupiedPayouts.length > 1
          ? `Posiciones ${firstPayout.position}-${lastPayout.position}`
          : firstPayout.description,
      split: winners.length > 1,
      occupied_positions: occupiedPayouts.map((payout) => payout.position),
      winners: winners.map((winner, index) => ({
        ...winner,
        estimated_amount_cents: winnerAmounts[index] ?? 0,
      })),
    });
  }

  for (const payout of payouts) {
    if (!consumedPositions.has(payout.position)) {
      result.push({
        ...payout,
        split: false,
        occupied_positions: [payout.position],
        winners: [],
      });
    }
  }

  return result.sort((left, right) => left.position - right.position);
}

function splitCents(amountCents: number, parts: number) {
  if (parts <= 0) {
    return [];
  }
  const base = Math.trunc(amountCents / parts);
  const remainder = amountCents - base * parts;
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
}

function rankingDisplayName(entry: RankingEntry) {
  return entry.user_name || entry.username || entry.user_id;
}

function rankingSearchLabel(entry: RankingEntry) {
  const handle = participantHandle(entry);
  const displayName = rankingDisplayName(entry);
  return handle === entry.user_id ? displayName : `${displayName} (${handle})`;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function buildRankingManualTiebreakerSummary(
  ranking: RankingEntry[],
  decisions: RankingManualTiebreaker[],
) {
  const entriesByUserID = new Map(ranking.map((entry) => [entry.user_id, entry]));
  return [...decisions]
    .sort((left, right) => left.priority - right.priority)
    .map((decision) => {
      const entry = entriesByUserID.get(decision.user_id);
      return entry ? rankingDisplayName(entry) : decision.user_id;
    })
    .join(" · ");
}

function poolDisplayName(pool: Pool | null) {
  return pool?.theme?.display_name || pool?.name || "Polla";
}

function participantHandle(entry: RankingEntry) {
  return entry.username ? `@${entry.username}` : entry.user_id;
}

function closedPredictionTitle(prediction: ClosedPrediction) {
  return `#${prediction.match_number} ${prediction.home_team_name || "Local"} vs ${
    prediction.away_team_name || "Visitante"
  }`;
}

function closedPredictionValue(prediction: ClosedPrediction) {
  if (prediction.has_score) {
    return `${prediction.home_score}-${prediction.away_score}`;
  }
  switch (prediction.outcome) {
    case "home":
      return "Local";
    case "draw":
      return "Empate";
    case "away":
      return "Visitante";
    default:
      return "Sin dato";
  }
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
        className="h-16 w-16 rounded-md object-contain"
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
    case "boolean":
      return "Si / No";
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
  if (value.value_type === "boolean") {
    if (typeof value.value_number !== "number") {
      return "-";
    }
    return value.value_number === 1 ? "Si" : "No";
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

function teamOptionValue(team: TournamentTeamOption) {
  return team.id || team.name;
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

function userInitials(name: string, username: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = words.length > 0 ? words.slice(0, 2).map((word) => word[0]).join("") : username.slice(0, 2);
  return initials.toUpperCase();
}
