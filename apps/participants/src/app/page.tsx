"use client";

import {
  PollavarAPIError,
  createPollavarClient,
  type Match,
  type Pool,
  type Prediction,
  type PredictionSummary,
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
type LoadedPoolData = {
  poolDetail: Pool;
  predictionSummary: PredictionSummary;
  userPredictions: Prediction[];
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
  const [drafts, setDrafts] = useState<ScoreDrafts>({});
  const [savingMatchID, setSavingMatchID] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const dashboardRequestID = useRef(0);

  const predictionsByMatch = useMemo(() => indexPredictions(predictions), [predictions]);

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
    setDrafts({});
    setSavingMatchID("");
    setSaveMessage("");
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
    const [poolDetail, predictionSummary, userPredictions, tournamentDetail] =
      await Promise.all([
        client.getPool(token, activePool.id),
        client.getPredictionSummary(token, activePool.id),
        client.listPredictions(token, activePool.id),
        tournamentRequest,
      ]);

    return {
      poolDetail,
      predictionSummary,
      userPredictions,
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
        setDrafts({});
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
      setTournament(loadedPoolData.tournamentDetail);
      setDrafts(
        hydrateDrafts(
          loadedPoolData.tournamentDetail?.matches ?? [],
          loadedPoolData.userPredictions,
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

  async function refreshPredictions(
    token: string,
    activePool: Pool,
    matches: Match[],
    requestID: number,
  ) {
    const client = createPollavarClient();
    const [predictionSummary, userPredictions] = await Promise.all([
      client.getPredictionSummary(token, activePool.id),
      client.listPredictions(token, activePool.id),
    ]);

    if (dashboardRequestID.current !== requestID) {
      return;
    }

    setSummary(predictionSummary);
    setPredictions(userPredictions);
    setDrafts(hydrateDrafts(matches, userPredictions));
  }

  function selectPool(poolID: string) {
    if (!session) {
      return;
    }
    void loadDashboard(session.token, poolID);
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
          onSave={savePrediction}
          onSelectPool={selectPool}
          onUpdateDraft={updateDraft}
          pool={pool}
          pools={pools}
          predictionsByMatch={predictionsByMatch}
          saveMessage={saveMessage}
          savingMatchID={savingMatchID}
          selectedPoolID={selectedPoolID}
          summary={summary}
          tournament={tournament}
        />
      ) : null}
    </main>
  );
}

function Dashboard({
  drafts,
  onSave,
  onSelectPool,
  onUpdateDraft,
  pool,
  pools,
  predictionsByMatch,
  saveMessage,
  savingMatchID,
  selectedPoolID,
  summary,
  tournament,
}: {
  drafts: ScoreDrafts;
  onSave: (event: FormEvent<HTMLFormElement>, match: Match) => void;
  onSelectPool: (poolID: string) => void;
  onUpdateDraft: (matchID: string, side: "home" | "away", value: string) => void;
  pool: Pool | null;
  pools: Pool[];
  predictionsByMatch: Map<string, Prediction>;
  saveMessage: string;
  savingMatchID: string;
  selectedPoolID: string;
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
        <PredictionList
          drafts={drafts}
          onSave={onSave}
          onUpdateDraft={onUpdateDraft}
          pool={pool}
          predictionsByMatch={predictionsByMatch}
          saveMessage={saveMessage}
          savingMatchID={savingMatchID}
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

function PredictionList({
  drafts,
  onSave,
  onUpdateDraft,
  pool,
  predictionsByMatch,
  saveMessage,
  savingMatchID,
  tournament,
}: {
  drafts: ScoreDrafts;
  onSave: (event: FormEvent<HTMLFormElement>, match: Match) => void;
  onUpdateDraft: (matchID: string, side: "home" | "away", value: string) => void;
  pool: Pool | null;
  predictionsByMatch: Map<string, Prediction>;
  saveMessage: string;
  savingMatchID: string;
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
              <SuggestedStandingsTable rows={group.standings} />
            ) : null}
            <div className="divide-y divide-zinc-100">
              {group.matches.map((match) => (
                <MatchPredictionForm
                  draft={drafts[match.id] ?? { home: "", away: "" }}
                  key={match.id}
                  match={match}
                  onSave={onSave}
                  onUpdateDraft={onUpdateDraft}
                  prediction={predictionsByMatch.get(match.id)}
                  predictionCloseHoursBefore={pool?.prediction_close_hours_before}
                  savingMatchID={savingMatchID}
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
    <div className="border-t border-zinc-200 px-5 py-4">
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
  onSave,
  onUpdateDraft,
  prediction,
  predictionCloseHoursBefore,
  savingMatchID,
}: {
  draft: { home: string; away: string };
  match: Match;
  onSave: (event: FormEvent<HTMLFormElement>, match: Match) => void;
  onUpdateDraft: (matchID: string, side: "home" | "away", value: string) => void;
  prediction?: Prediction;
  predictionCloseHoursBefore?: number;
  savingMatchID: string;
}) {
  const closed =
    typeof predictionCloseHoursBefore === "number"
      ? isMatchClosed(match, predictionCloseHoursBefore)
      : false;
  const homeName = match.home_team?.name ?? match.home_slot;
  const awayName = match.away_team?.name ?? match.away_slot;

  return (
    <form
      className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_220px_120px]"
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

      <div className="flex items-end gap-2 lg:justify-end">
        <span
          className={`rounded-md px-2 py-1 text-xs font-medium ${
            closed
              ? "bg-zinc-100 text-zinc-600"
              : prediction
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
          }`}
        >
          {closed ? "Cerrado" : prediction ? "Guardado" : "Pendiente"}
        </span>
        <button
          className="h-10 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={closed || savingMatchID === match.id}
          type="submit"
        >
          {savingMatchID === match.id ? "Guardando" : "Guardar"}
        </button>
      </div>
    </form>
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

function groupMatchesForPredictions(
  matches: Match[],
  predictionsByMatch: Map<string, Prediction>,
  predictionCloseHoursBefore?: number,
) {
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

function isMatchClosed(match: Match, closeHours: number) {
  const startsAt = Date.parse(match.starts_at);
  if (Number.isNaN(startsAt)) {
    return false;
  }
  return Date.now() >= startsAt - closeHours * 60 * 60 * 1000;
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
