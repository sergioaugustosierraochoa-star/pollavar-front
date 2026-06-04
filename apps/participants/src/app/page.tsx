"use client";

import {
  PollavarAPIError,
  createPollavarClient,
  type Match,
  type PointEventDetail,
  type Pool,
  type Prediction,
  type PredictionMatchStatus,
  type PredictionSnapshot,
  type PredictionSummary,
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
type ScoreDrafts = Record<string, { home: string; away: string }>;
type StandingDrafts = Record<string, string[]>;
const defaultScoringRules: ScoringRule[] = [
  { code: "exact_score", points: 5, enabled: true },
  { code: "match_result", points: 3, enabled: true },
];
type LoadedPoolData = {
  poolDetail: Pool;
  predictionSummary: PredictionSummary;
  userPredictions: Prediction[];
  userPredictionStatuses: PredictionMatchStatus[];
  scoringRules: ScoringRule[];
  userStandingPredictions: StandingPrediction[];
  ranking: RankingEntry[];
  prizePreview: PrizePreview;
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
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);
  const [standingPredictions, setStandingPredictions] = useState<StandingPrediction[]>([]);
  const [selectedRankingUserID, setSelectedRankingUserID] = useState("");
  const [pointDetailsByUserID, setPointDetailsByUserID] = useState<
    Record<string, PointEventDetail[]>
  >({});
  const [pointDetailsLoadingUserID, setPointDetailsLoadingUserID] = useState("");
  const [pointDetailsMessage, setPointDetailsMessage] = useState("");
  const [drafts, setDrafts] = useState<ScoreDrafts>({});
  const [standingDrafts, setStandingDrafts] = useState<StandingDrafts>({});
  const [savingMatchID, setSavingMatchID] = useState("");
  const [savingStandingGroupID, setSavingStandingGroupID] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [standingSaveMessage, setStandingSaveMessage] = useState("");
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
    setScoringRules([]);
    setStandingPredictions([]);
    setSelectedRankingUserID("");
    setPointDetailsByUserID({});
    setPointDetailsLoadingUserID("");
    setPointDetailsMessage("");
    setDrafts({});
    setStandingDrafts({});
    setSavingMatchID("");
    setSavingStandingGroupID("");
    setSaveMessage("");
    setStandingSaveMessage("");
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
      ranking,
      prizePreview,
      tournamentDetail,
    ] = await Promise.all([
      client.getPool(token, activePool.id),
      client.getPredictionSummary(token, activePool.id),
      client.listPredictions(token, activePool.id),
      listPredictionStatusesWithFallback(client, token, activePool.id),
      listScoringRulesWithFallback(client, token, activePool.id),
      client.listStandingPredictions(token, activePool.id),
      listRankingWithFallback(client, token, activePool.id),
      getPrizePreviewWithFallback(client, token, activePool.id),
      tournamentRequest,
    ]);

    return {
      poolDetail,
      predictionSummary,
      userPredictions,
      userPredictionStatuses,
      scoringRules,
      userStandingPredictions,
      ranking,
      prizePreview,
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
      setScoringRules([]);
        setStandingPredictions([]);
        setSelectedRankingUserID("");
        setPointDetailsByUserID({});
        setPointDetailsLoadingUserID("");
        setPointDetailsMessage("");
        setDrafts({});
        setStandingDrafts({});
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
      setScoringRules(loadedPoolData.scoringRules);
      setStandingPredictions(loadedPoolData.userStandingPredictions);
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

  function updateDraft(matchID: string, side: "home" | "away", value: string) {
    setDrafts((current) => ({
      ...current,
      [matchID]: {
        home: current[matchID]?.home ?? "",
        away: current[matchID]?.away ?? "",
        [side]: value,
      },
    }));
  }

  async function savePrediction(event: FormEvent<HTMLFormElement>, match: Match) {
    event.preventDefault();
    if (!session || !pool || !tournament) {
      return;
    }

    const draft = drafts[match.id] ?? { home: "", away: "" };
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
      setSaveMessage("Completa ambos marcadores con numeros validos.");
      return;
    }

    setSavingMatchID(match.id);
    setSaveMessage("");
    const requestID = dashboardRequestID.current;
    try {
      const client = createPollavarClient();
      await client.savePrediction(session.token, pool.id, match.id, {
        home_score: homeScore,
        away_score: awayScore,
      });
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
          onSave={savePrediction}
          onDownloadSnapshot={downloadPredictionSnapshot}
          onLoadSnapshot={loadPredictionSnapshot}
          onSelectRankingUser={loadPointDetails}
          onSaveStanding={saveStandingPrediction}
          onSelectPool={selectPool}
          onMoveStanding={moveStandingTeam}
          onUpdateDraft={updateDraft}
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
          saveMessage={saveMessage}
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
  onDownloadSnapshot,
  onLoadSnapshot,
  onSave,
  onSelectRankingUser,
  onSaveStanding,
  onSelectPool,
  onMoveStanding,
  onUpdateDraft,
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
  onDownloadSnapshot: (matchID: string) => void;
  onLoadSnapshot: (matchID: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>, match: Match) => void;
  onSelectRankingUser: (userID: string) => void;
  onSaveStanding: (group: PredictionGroup) => void;
  onSelectPool: (poolID: string) => void;
  onMoveStanding: (group: PredictionGroup, teamID: string, direction: -1 | 1) => void;
  onUpdateDraft: (matchID: string, side: "home" | "away", value: string) => void;
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

  return (
    <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[280px_1fr]">
      <aside className="h-fit rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-950">Mis pollas</h2>
        </div>
        <div className="grid gap-2 p-3">
          {pools.map((item) => (
            <button
              className={`rounded-md border px-3 py-3 text-left text-sm transition ${
                item.id === selectedPoolID
                  ? "border-emerald-600 bg-emerald-50 text-emerald-950"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
              }`}
              key={item.id}
              onClick={() => onSelectPool(item.id)}
              type="button"
            >
              <span className="block font-semibold">{item.name}</span>
              <span className="mt-1 block text-xs text-zinc-500">{item.currency}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="grid gap-5">
        <PoolHeader pool={pool} tournament={tournament} />
        <SummaryGrid summary={summary} />
        <PrizePanel preview={prizePreview} />
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
        <PredictionList
          drafts={drafts}
          clockTick={clockTick}
          onDownloadSnapshot={onDownloadSnapshot}
          onLoadSnapshot={onLoadSnapshot}
          onSave={onSave}
          onSaveStanding={onSaveStanding}
          onMoveStanding={onMoveStanding}
          onUpdateDraft={onUpdateDraft}
          pool={pool}
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
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-sky-700">
            {tournament?.name ?? "Torneo pendiente"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">
            {pool?.theme.display_name || pool?.name || "Polla"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{pool?.description}</p>
        </div>
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

function PrizePanel({ preview }: { preview: PrizePreview | null }) {
  if (!preview || preview.payouts.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-zinc-950">Premios</h2>
          <p className="text-sm text-zinc-600">Sin premios configurados.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-zinc-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Premios</h2>
          <p className="text-sm text-zinc-600">
            Bolsa confirmada: {formatMoney(preview.confirmed_total_cents, preview.currency)}
          </p>
        </div>
        <span className="w-fit rounded-md bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800">
          {preview.payouts.length} ganadores
        </span>
      </div>
      <div className="grid divide-y divide-zinc-200 md:grid-cols-2 md:divide-x md:divide-y-0">
        {preview.payouts.map((payout) => (
          <div key={`${payout.position}-${payout.description}`} className="px-5 py-4">
            <p className="text-sm font-semibold text-zinc-950">
              {payout.description || `Posicion ${payout.position}`}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{payout.percentage}% de la bolsa</p>
            <p className="mt-3 text-xl font-semibold text-zinc-950">
              {formatMoney(payout.estimated_amount_cents, preview.currency)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ScoringRulesPanel({ rules }: { rules: ScoringRule[] }) {
  const activeRules = rules.filter((rule) => rule.enabled);

  if (activeRules.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
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
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
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
                    key={`${detail.prediction_id}-${detail.rule_code}-${detail.created_at}`}
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
  onDownloadSnapshot,
  onLoadSnapshot,
  onSave,
  onSaveStanding,
  onMoveStanding,
  onUpdateDraft,
  pool,
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
  onDownloadSnapshot: (matchID: string) => void;
  onLoadSnapshot: (matchID: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>, match: Match) => void;
  onSaveStanding: (group: PredictionGroup) => void;
  onMoveStanding: (group: PredictionGroup, teamID: string, direction: -1 | 1) => void;
  onUpdateDraft: (matchID: string, side: "home" | "away", value: string) => void;
  pool: Pool | null;
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
        title="Torneo no disponible"
        message="No encontramos el fixture asociado a esta polla."
      />
    );
  }

  const predictionGroups = groupMatchesForPredictions(
    tournament.matches,
    predictionsByMatch,
    pool?.prediction_close_hours_before,
    clockTick,
  );

  if (predictionGroups.length === 0) {
    return (
      <StatusState
        title="Fixture sin partidos"
        message="Este torneo aun no tiene partidos configurados para pronosticar."
      />
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
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
              <div className="grid border-t border-zinc-200 lg:grid-cols-2">
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
                  draft={drafts[match.id] ?? { home: "", away: "" }}
                  key={match.id}
                  match={match}
                  onDownloadSnapshot={onDownloadSnapshot}
                  onLoadSnapshot={onLoadSnapshot}
                  onSave={onSave}
                  onUpdateDraft={onUpdateDraft}
                  prediction={predictionsByMatch.get(match.id)}
                  predictionCloseHoursBefore={pool?.prediction_close_hours_before}
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
  onDownloadSnapshot,
  onLoadSnapshot,
  onSave,
  onUpdateDraft,
  prediction,
  predictionCloseHoursBefore,
  predictionStatus,
  savingMatchID,
  snapshot,
  snapshotDownloadInProgress,
  snapshotLoadInProgress,
  snapshotMessage,
}: {
  draft: { home: string; away: string };
  match: Match;
  onDownloadSnapshot: (matchID: string) => void;
  onLoadSnapshot: (matchID: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>, match: Match) => void;
  onUpdateDraft: (matchID: string, side: "home" | "away", value: string) => void;
  prediction?: Prediction;
  predictionCloseHoursBefore?: number;
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

        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs font-medium text-zinc-600">
            <span>{match.home_team?.short_name ?? match.home_slot}</span>
            <input
              aria-label={`Marcador ${homeName}`}
              className="h-10 rounded-md border border-zinc-300 px-3 text-base font-semibold text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100"
              disabled={closed}
              min={0}
              onChange={(event) => onUpdateDraft(match.id, "home", event.target.value)}
              step={1}
              type="number"
              value={draft.home}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-600">
            <span>{match.away_team?.short_name ?? match.away_slot}</span>
            <input
              aria-label={`Marcador ${awayName}`}
              className="h-10 rounded-md border border-zinc-300 px-3 text-base font-semibold text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100"
              disabled={closed}
              min={0}
              onChange={(event) => onUpdateDraft(match.id, "away", event.target.value)}
              step={1}
              type="number"
              value={draft.away}
            />
          </label>
        </div>

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
            <th className="py-2 pr-3 text-right font-medium">Marcador</th>
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
  message,
  title,
}: {
  action?: () => void;
  message: string;
  title: string;
}) {
  return (
    <section className="mx-auto max-w-5xl px-5 py-10">
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
  if (!entry.has_prediction || entry.home_score === null || entry.away_score === null) {
    return "-";
  }
  return `${entry.home_score}-${entry.away_score}`;
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
    if (!prediction) {
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

function hydrateDrafts(matches: Match[], predictions: Prediction[]) {
  const indexed = indexPredictions(predictions);
  const nextDrafts: ScoreDrafts = {};
  for (const match of matches) {
    const prediction = indexed.get(match.id);
    nextDrafts[match.id] = {
      home: prediction ? String(prediction.home_score) : "",
      away: prediction ? String(prediction.away_score) : "",
    };
  }
  return nextDrafts;
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
    default:
      return code;
  }
}

function rankingDisplayName(entry: RankingEntry) {
  return entry.user_name || entry.username || entry.user_id;
}

function participantHandle(entry: RankingEntry) {
  return entry.username ? `@${entry.username}` : entry.user_id;
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

function formatMoney(amountCents: number, currency: string) {
  const amount = amountCents / 100;
  return `${currency} ${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)}`;
}

function pointEventTitle(detail: PointEventDetail) {
  if (detail.match_number > 0) {
    return `Partido ${detail.match_number}`;
  }
  return "Evento global";
}

function formatRankingPoints(points: number) {
  return points > 0 ? `+${points}` : String(points);
}

function formatPoints(points: number) {
  return points > 0 ? `+${points} pts` : `${points} pts`;
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
