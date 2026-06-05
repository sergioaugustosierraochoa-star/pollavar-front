"use client";

import {
  PollavarAPIError,
  createPollavarClient,
  type AuthUser,
  type Match,
  type MatchResultAuditLog,
  type MatchResultScoringMode,
  type Payment,
  type PaymentCollection,
  type PaymentMethod,
  type PaymentStatus,
  type Pool,
  type PoolParticipant,
  type PredictionMode,
  type PredictionMatchStatus,
  type PrizePreview,
  type Tournament,
  type TournamentSummary,
} from "@pollavar/api-client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const sessionStorageKey = "pollavar.admin.session";

type AuthSession = {
  token: string;
  expiresAt: string;
  user: AuthUser;
};

type DashboardStatus = "checking" | "signed-out" | "loading" | "ready" | "error";
type PaymentDrafts = Record<
  string,
  {
    amount: string;
    method: PaymentMethod;
    reference: string;
    status: PaymentStatus;
  }
>;
type PrizeRuleDraft = {
  position: string;
  percentage: string;
  description: string;
};
type ResultDrafts = Record<
  string,
  {
    home: string;
    away: string;
  }
>;
type ResultMatchGroup = {
  id: string;
  title: string;
  subtitle: string;
  matches: Match[];
};
type PredictionSettingsDraft = {
  predictionMode: PredictionMode;
  matchResultScoringMode: MatchResultScoringMode;
};
type RefreshPrizePreviewOptions = {
  syncDrafts?: boolean;
};

const prizePercentageScale = 1000;
const prizeTotalPercentageUnits = 100 * prizePercentageScale;

const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "Efectivo" },
  { value: "bank_transfer", label: "Transferencia" },
  { value: "deposit", label: "Consignacion" },
];

const paymentStatuses: Array<{ value: PaymentStatus; label: string }> = [
  { value: "pending", label: "Pendiente" },
  { value: "confirmed", label: "Confirmado" },
  { value: "rejected", label: "Rechazado" },
];

const predictionModeOptions: Array<{ value: PredictionMode; label: string }> = [
  { value: "score_with_outcome", label: "Marcador + resultado" },
  { value: "outcome", label: "Local / empate / visitante" },
  { value: "score", label: "Marcador simple" },
];

const matchResultScoringModeOptions: Array<{
  value: MatchResultScoringMode;
  label: string;
}> = [
  { value: "exclusive", label: "Exclusivo" },
  { value: "cumulative", label: "Acumulativo" },
];

export default function AdminHome() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<DashboardStatus>("checking");
  const [message, setMessage] = useState("");
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPoolID, setSelectedPoolID] = useState("");
  const [pool, setPool] = useState<Pool | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [predictionStatuses, setPredictionStatuses] = useState<PredictionMatchStatus[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentCurrency, setPaymentCurrency] = useState("COP");
  const [prizePreview, setPrizePreview] = useState<PrizePreview | null>(null);
  const [prizeDrafts, setPrizeDrafts] = useState<PrizeRuleDraft[]>([]);
  const [predictionSettingsDraft, setPredictionSettingsDraft] =
    useState<PredictionSettingsDraft>(defaultPredictionSettingsDraft(null));
  const [resultDrafts, setResultDrafts] = useState<ResultDrafts>({});
  const [resultAuditLogsByMatchID, setResultAuditLogsByMatchID] = useState<
    Record<string, MatchResultAuditLog[]>
  >({});
  const [drafts, setDrafts] = useState<PaymentDrafts>({});
  const [savingResultMatchID, setSavingResultMatchID] = useState("");
  const [loadingAuditMatchID, setLoadingAuditMatchID] = useState("");
  const [savingUserID, setSavingUserID] = useState("");
  const [savingPredictionSettings, setSavingPredictionSettings] = useState(false);
  const [savingPrizes, setSavingPrizes] = useState(false);
  const requestID = useRef(0);

  const predictionStatusesByMatch = useMemo(
    () => indexPredictionStatuses(predictionStatuses),
    [predictionStatuses],
  );
  const resultGroups = useMemo(
    () => groupMatchesForResults(tournament?.matches ?? []),
    [tournament?.matches],
  );
  const paymentsByUserID = useMemo(() => indexPayments(payments), [payments]);
  const canManageSelectedPool = Boolean(
    session && pool && canManagePayments(pool, session.user.id),
  );
  const canManageSelectedPoolPrizes = Boolean(pool && canManagePrizeRules(pool));
  const canManageSelectedPoolPredictionSettings = Boolean(
    pool && canManagePredictionSettings(pool),
  );
  const canManageSelectedPoolResults = Boolean(pool && canManageResults(pool));
  const totals = useMemo(
    () => paymentTotals(pool?.participants ?? [], paymentsByUserID),
    [pool?.participants, paymentsByUserID],
  );

  const signOutAdmin = useCallback(function signOutAdmin() {
    requestID.current += 1;
    clearStoredSession();
    setSession(null);
    setStatus("signed-out");
    setMessage("");
    setPools([]);
    setSelectedPoolID("");
    setPool(null);
    setTournament(null);
    setPredictionStatuses([]);
    setPayments([]);
    setPaymentCurrency("COP");
    setPrizePreview(null);
    setPrizeDrafts([]);
    setPredictionSettingsDraft(defaultPredictionSettingsDraft(null));
    setResultDrafts({});
    setResultAuditLogsByMatchID({});
    setDrafts({});
    setSavingResultMatchID("");
    setLoadingAuditMatchID("");
    setSavingUserID("");
    setSavingPredictionSettings(false);
    setSavingPrizes(false);
  }, []);

  const loadDashboard = useCallback(async function loadDashboard(
    token: string,
    userID: string,
    preferredPoolID?: string,
  ) {
    const nextRequestID = requestID.current + 1;
    requestID.current = nextRequestID;
    const isLatestRequest = () => requestID.current === nextRequestID;

    setStatus("loading");
    setMessage("");
    setSavingResultMatchID("");
    setLoadingAuditMatchID("");
    setSavingUserID("");
    setSavingPredictionSettings(false);

    try {
      const client = createPollavarClient();
      const [poolList, tournamentList] = await Promise.all([
        client.listPools(token),
        client.listTournaments(),
      ]);
      const activePool =
        poolList.find((item) => item.id === preferredPoolID) ??
        poolList.find((item) => canManagePayments(item, userID)) ??
        poolList[0] ??
        null;

      if (!isLatestRequest()) {
        return;
      }

        setPools(poolList);
        setSelectedPoolID(activePool?.id ?? "");

      if (!activePool) {
        setPool(null);
        setTournament(null);
        setPredictionStatuses([]);
        setPayments([]);
        setPaymentCurrency("COP");
        setPrizePreview(null);
        setPrizeDrafts([]);
        setPredictionSettingsDraft(defaultPredictionSettingsDraft(null));
        setResultDrafts({});
        setResultAuditLogsByMatchID({});
        setDrafts({});
        setStatus("ready");
        return;
      }

      const poolDetail = await client.getPool(token, activePool.id);
      const tournamentSummary = findTournamentSummary(tournamentList, poolDetail);
      const tournamentRequest = tournamentSummary
        ? client.getTournament(tournamentSummary.slug)
        : Promise.resolve(null);
      const paymentCollectionRequest: Promise<PaymentCollection> = canManagePayments(
        poolDetail,
        userID,
      )
        ? client.listPayments(token, poolDetail.id)
        : Promise.resolve({
            pool_id: poolDetail.id,
            currency: poolDetail.currency || "COP",
            confirmed_total_cents: 0,
            payments: [],
          });
      const [
        nextPrizePreview,
        nextPredictionStatuses,
        tournamentDetail,
        paymentCollection,
      ] = await Promise.all([
        client.getPrizePreview(token, poolDetail.id),
        client.listPredictionStatuses(token, poolDetail.id),
        tournamentRequest,
        paymentCollectionRequest,
      ]);
      const nextPaymentCollection: PaymentCollection = paymentCollection ?? {
        pool_id: poolDetail.id,
        currency: poolDetail.currency || "COP",
        confirmed_total_cents: 0,
        payments: [],
      };

      if (!isLatestRequest()) {
        return;
      }

      setPool(poolDetail);
      setTournament(tournamentDetail);
      setPredictionStatuses(nextPredictionStatuses);
      setPayments(nextPaymentCollection.payments);
      setPaymentCurrency(nextPaymentCollection.currency || poolDetail.currency || "COP");
      setPrizePreview(nextPrizePreview);
      setPrizeDrafts(hydratePrizeDrafts(nextPrizePreview));
      setPredictionSettingsDraft(defaultPredictionSettingsDraft(poolDetail));
      setResultDrafts(
        hydrateResultDrafts(tournamentDetail?.matches ?? [], nextPredictionStatuses),
      );
      setResultAuditLogsByMatchID({});
      setDrafts(hydratePaymentDrafts(poolDetail, nextPaymentCollection.payments));
      setStatus("ready");
      setMessage(
        canManagePayments(poolDetail, userID)
          ? ""
          : "Esta polla no esta bajo tu administracion de recaudo.",
      );
    } catch (error) {
      if (!isLatestRequest()) {
        return;
      }
      if (isUnauthorized(error)) {
        signOutAdmin();
        return;
      }
      if (isForbidden(error)) {
        setStatus("error");
        setMessage("No tienes permisos para administrar esta polla.");
        return;
      }
      setStatus("error");
      setMessage("No pudimos cargar el panel admin.");
    }
  }, [signOutAdmin]);

  useEffect(() => {
    let active = true;
    const storedSession = readStoredSession();

    queueMicrotask(() => {
      if (!active) {
        return;
      }
      if (!storedSession) {
        setStatus("signed-out");
        return;
      }

      setSession(storedSession);
      void loadDashboard(storedSession.token, storedSession.user.id);
    });

    return () => {
      active = false;
    };
  }, [loadDashboard]);

  function updateDraft(userID: string, patch: Partial<PaymentDrafts[string]>) {
    setDrafts((current) => ({
      ...current,
      [userID]: {
        ...defaultDraft(pool, paymentsByUserID.get(userID)),
        ...current[userID],
        ...patch,
      },
    }));
  }

  function updateResultDraft(matchID: string, side: "home" | "away", value: string) {
    setResultDrafts((current) => ({
      ...current,
      [matchID]: {
        ...defaultResultDraft(predictionStatusesByMatch.get(matchID)),
        ...current[matchID],
        [side]: value,
      },
    }));
  }

  async function saveMatchResult(match: Match) {
    if (!session || !pool || !canManageSelectedPoolResults) {
      return;
    }

    const draft = {
      ...defaultResultDraft(predictionStatusesByMatch.get(match.id)),
      ...resultDrafts[match.id],
    };
    const homeScore = parseWholeNumber(draft.home);
    const awayScore = parseWholeNumber(draft.away);
    if (homeScore === null || awayScore === null) {
      setMessage("Revisa el marcador oficial.");
      return;
    }

    setSavingResultMatchID(match.id);
    setMessage("");

    try {
      const client = createPollavarClient();
      await client.saveMatchResult(session.token, pool.id, match.id, {
        home_score: homeScore,
        away_score: awayScore,
        result_status: "final",
      });
      const [nextStatuses, auditLogs] = await Promise.all([
        client.listPredictionStatuses(session.token, pool.id),
        client.listMatchResultAuditLogs(session.token, pool.id, match.id),
      ]);
      setPredictionStatuses(nextStatuses);
      setResultDrafts((current) => ({
        ...current,
        [match.id]: defaultResultDraft(indexPredictionStatuses(nextStatuses).get(match.id)),
      }));
      setResultAuditLogsByMatchID((current) => ({
        ...current,
        [match.id]: auditLogs,
      }));
      setMessage("Resultado oficial actualizado.");
    } catch (error) {
      if (isUnauthorized(error)) {
        signOutAdmin();
        return;
      }
      if (isForbidden(error)) {
        setMessage("No tienes permisos para actualizar resultados oficiales.");
        return;
      }
      if (error instanceof PollavarAPIError && error.code === "prediction_open") {
        setMessage("El partido todavia no cerro para pronosticos.");
        return;
      }
      setMessage("No pudimos actualizar el resultado oficial.");
    } finally {
      setSavingResultMatchID("");
    }
  }

  async function loadMatchResultAudit(matchID: string) {
    if (!session || !pool || !canManageSelectedPoolResults) {
      return;
    }

    setLoadingAuditMatchID(matchID);
    setMessage("");

    try {
      const auditLogs = await createPollavarClient().listMatchResultAuditLogs(
        session.token,
        pool.id,
        matchID,
      );
      setResultAuditLogsByMatchID((current) => ({
        ...current,
        [matchID]: auditLogs,
      }));
    } catch (error) {
      if (isUnauthorized(error)) {
        signOutAdmin();
        return;
      }
      if (isForbidden(error)) {
        setMessage("No tienes permisos para ver la auditoria de resultados.");
        return;
      }
      setMessage("No pudimos cargar la auditoria del resultado.");
    } finally {
      setLoadingAuditMatchID("");
    }
  }

  async function refreshPrizePreview(
    token: string,
    poolID: string,
    options: RefreshPrizePreviewOptions = {},
  ) {
    try {
      const nextPrizePreview = await createPollavarClient().getPrizePreview(token, poolID);
      setPrizePreview(nextPrizePreview);
      if (options.syncDrafts) {
        setPrizeDrafts(hydratePrizeDrafts(nextPrizePreview));
      }
    } catch (error) {
      if (isUnauthorized(error)) {
        signOutAdmin();
        return;
      }
      if (isForbidden(error)) {
        setMessage("No tienes permisos para ver premios de esta polla.");
      }
    }
  }

  async function savePayment(userID: string, statusOverride?: PaymentStatus) {
    if (!session || !pool || !canManageSelectedPool) {
      return;
    }

    const draft = {
      ...defaultDraft(pool, paymentsByUserID.get(userID)),
      ...drafts[userID],
    };
    const nextStatus = statusOverride ?? draft.status;
    const amountCents = parseMoneyToCents(draft.amount);
    if (amountCents === null) {
      setMessage("Revisa el valor del pago.");
      return;
    }

    setSavingUserID(userID);
    setMessage("");

    try {
      const client = createPollavarClient();
      const savedPayment = await client.upsertPayment(session.token, pool.id, userID, {
        amount_cents: amountCents,
        currency: paymentCurrency || pool.currency,
        payment_method: draft.method,
        reference: draft.reference,
        status: nextStatus,
      });

      setPayments((current) => upsertPayment(current, savedPayment));
      setPool((current) => updateParticipantPaymentStatus(current, userID, savedPayment.status));
      setDrafts((current) => ({
        ...current,
        [userID]: draftFromPayment(savedPayment),
      }));
      void refreshPrizePreview(session.token, pool.id);
      setMessage("Pago actualizado.");
    } catch (error) {
      if (isUnauthorized(error)) {
        signOutAdmin();
        return;
      }
      if (isForbidden(error)) {
        setMessage("No tienes permisos para actualizar pagos.");
        return;
      }
      setMessage("No pudimos actualizar el pago.");
    } finally {
      setSavingUserID("");
    }
  }

  function updatePrizeDraft(index: number, patch: Partial<PrizeRuleDraft>) {
    setPrizeDrafts((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft,
      ),
    );
  }

  function addPrizeDraft() {
    setPrizeDrafts((current) => [
      ...current,
      {
        position: String(current.length + 1),
        percentage: "",
        description: "",
      },
    ]);
  }

  function removePrizeDraft(index: number) {
    setPrizeDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index));
  }

  async function savePrizeRules() {
    if (!session || !pool || !canManageSelectedPoolPrizes) {
      return;
    }

    const parsedRules = parsePrizeDrafts(prizeDrafts);
    if (!parsedRules) {
      setMessage("Revisa los porcentajes de premios. Deben sumar 100%.");
      return;
    }

    setSavingPrizes(true);
    setMessage("");

    try {
      const client = createPollavarClient();
      await client.updatePrizeRules(session.token, pool.id, { rules: parsedRules });
      const nextPrizePreview = await client.getPrizePreview(session.token, pool.id);
      setPrizePreview(nextPrizePreview);
      setPrizeDrafts(hydratePrizeDrafts(nextPrizePreview));
      setMessage("Premios actualizados.");
    } catch (error) {
      if (isUnauthorized(error)) {
        signOutAdmin();
        return;
      }
      if (isForbidden(error)) {
        setMessage("No tienes permisos para actualizar premios.");
        return;
      }
      setMessage("No pudimos actualizar los premios.");
    } finally {
      setSavingPrizes(false);
    }
  }

  async function savePredictionSettings() {
    if (!session || !pool || !canManageSelectedPoolPredictionSettings) {
      return;
    }

    setSavingPredictionSettings(true);
    setMessage("");

    try {
      const updatedPool = await createPollavarClient().updatePredictionSettings(
        session.token,
        pool.id,
        {
          prediction_mode: predictionSettingsDraft.predictionMode,
          match_result_scoring_mode: predictionSettingsDraft.matchResultScoringMode,
        },
      );
      setPool(updatedPool);
      setPools((current) =>
        current.map((item) => (item.id === updatedPool.id ? { ...item, ...updatedPool } : item)),
      );
      setPredictionSettingsDraft(defaultPredictionSettingsDraft(updatedPool));
      setMessage("Configuracion de pronosticos actualizada.");
    } catch (error) {
      if (isUnauthorized(error)) {
        signOutAdmin();
        return;
      }
      if (isForbidden(error)) {
        setMessage("No tienes permisos para configurar pronosticos.");
        return;
      }
      if (error instanceof PollavarAPIError && error.code === "prediction_settings_locked") {
        setMessage(
          "No pudimos cambiar los modos porque la polla ya tiene pronosticos o resultados.",
        );
        return;
      }
      setMessage("No pudimos actualizar la configuracion de pronosticos.");
    } finally {
      setSavingPredictionSettings(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-[#191b1f]">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">PollaVAR Admin</p>
            <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">
              Administracion de polla
            </h1>
          </div>
          <nav aria-label="Sesion admin" className="flex flex-wrap items-center gap-2">
            {session ? (
              <>
                <span className="text-sm text-zinc-600">{session.user.name}</span>
                <button
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400"
                  type="button"
                  onClick={signOutAdmin}
                >
                  Salir
                </button>
              </>
            ) : (
              <>
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
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-6">
        {status === "checking" || status === "loading" ? (
          <StatusPanel text="Cargando panel admin" />
        ) : null}

        {status === "signed-out" ? <SignedOutPanel /> : null}

        {status === "error" ? (
          <section className="rounded-lg border border-rose-200 bg-white p-6 shadow-sm">
            <p role="alert" className="text-sm font-medium text-rose-700">
              {message}
            </p>
            {session ? (
              <button
                className="mt-4 rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                type="button"
                onClick={() => void loadDashboard(session.token, session.user.id, selectedPoolID)}
              >
                Reintentar
              </button>
            ) : null}
          </section>
        ) : null}

        {status === "ready" && session ? (
          <div className="space-y-6">
            <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <label className="text-sm font-medium text-zinc-600" htmlFor="pool-select">
                    Polla
                  </label>
                  <select
                    id="pool-select"
                    className="mt-2 min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 lg:min-w-80"
                    value={selectedPoolID}
                    onChange={(event) => {
                      const nextPoolID = event.target.value;
                      setSelectedPoolID(nextPoolID);
                      void loadDashboard(session.token, session.user.id, nextPoolID);
                    }}
                  >
                    {pools.map((item) => (
                      <option key={item.id} value={item.id}>
                        {poolDisplayName(item)}
                      </option>
                    ))}
                  </select>
                </div>
                {pool ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Metric label="Participantes" value={String(pool.participants.length)} />
                    <Metric label="Confirmados" value={String(totals.confirmedCount)} />
                    <Metric label="Pendientes" value={String(totals.pendingCount)} />
                    <Metric
                      label="Recaudo confirmado"
                      value={formatMoney(totals.confirmedAmountCents, paymentCurrency)}
                    />
                  </div>
                ) : null}
              </div>
            </section>

            {message ? (
              <p
                role={
                  message.includes("No pudimos") ||
                  message.includes("No tienes permisos") ||
                  message.includes("Revisa")
                    ? "alert"
                    : "status"
                }
                className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700"
              >
                {message}
              </p>
            ) : null}

            {pool ? (
              <PredictionSettingsPanel
                canManage={canManageSelectedPoolPredictionSettings}
                draft={predictionSettingsDraft}
                onChange={setPredictionSettingsDraft}
                onSave={() => void savePredictionSettings()}
                saving={savingPredictionSettings}
              />
            ) : null}

            {pool ? (
              <ResultsPanel
                auditLogsByMatchID={resultAuditLogsByMatchID}
                canManage={canManageSelectedPoolResults}
                groups={resultGroups}
                loadingAuditMatchID={loadingAuditMatchID}
                onLoadAudit={(matchID) => void loadMatchResultAudit(matchID)}
                onSave={(match) => void saveMatchResult(match)}
                onUpdateDraft={updateResultDraft}
                predictionCloseHoursBefore={pool.prediction_close_hours_before}
                resultDrafts={resultDrafts}
                savingMatchID={savingResultMatchID}
                statusesByMatch={predictionStatusesByMatch}
              />
            ) : null}

            {pool ? (
              <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-950">Premios</h2>
                    <p className="text-sm text-zinc-600">
                      Bolsa confirmada:{" "}
                      {formatMoney(
                        prizePreview?.confirmed_total_cents ?? 0,
                        prizePreview?.currency ?? paymentCurrency,
                      )}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-md px-2 py-1 text-xs font-medium ${
                      canManageSelectedPoolPrizes
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {canManageSelectedPoolPrizes ? "Configurable" : "Solo lectura"}
                  </span>
                </div>

                <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                  <div className="overflow-x-auto">
                    <table className="min-w-[620px] w-full border-collapse text-left text-sm">
                      <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Posicion</th>
                          <th className="px-4 py-3 font-semibold">Porcentaje</th>
                          <th className="px-4 py-3 font-semibold">Descripcion</th>
                          <th className="px-4 py-3 font-semibold">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {prizeDrafts.map((draft, index) => (
                          <tr key={`${draft.position}-${index}`}>
                            <td className="px-4 py-3">
                              <label className="sr-only" htmlFor={`prize-position-${index}`}>
                                Posicion del premio {index + 1}
                              </label>
                              <input
                                id={`prize-position-${index}`}
                                className="min-h-10 w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                                disabled={!canManageSelectedPoolPrizes || savingPrizes}
                                inputMode="numeric"
                                value={draft.position}
                                onChange={(event) =>
                                  updatePrizeDraft(index, { position: event.target.value })
                                }
                              />
                            </td>
                            <td className="px-4 py-3">
                              <label className="sr-only" htmlFor={`prize-percentage-${index}`}>
                                Porcentaje del premio {index + 1}
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  id={`prize-percentage-${index}`}
                                  className="min-h-10 w-28 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                                  disabled={!canManageSelectedPoolPrizes || savingPrizes}
                                  inputMode="decimal"
                                  value={draft.percentage}
                                  onChange={(event) =>
                                    updatePrizeDraft(index, { percentage: event.target.value })
                                  }
                                />
                                <span className="text-sm text-zinc-500">%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <label className="sr-only" htmlFor={`prize-description-${index}`}>
                                Descripcion del premio {index + 1}
                              </label>
                              <input
                                id={`prize-description-${index}`}
                                className="min-h-10 w-56 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                                disabled={!canManageSelectedPoolPrizes || savingPrizes}
                                value={draft.description}
                                onChange={(event) =>
                                  updatePrizeDraft(index, { description: event.target.value })
                                }
                              />
                            </td>
                            <td className="px-4 py-3">
                              <button
                                className="rounded-md border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:border-rose-300 disabled:cursor-not-allowed disabled:text-zinc-400"
                                disabled={
                                  !canManageSelectedPoolPrizes ||
                                  savingPrizes ||
                                  prizeDrafts.length <= 1
                                }
                                type="button"
                                onClick={() => removePrizeDraft(index)}
                              >
                                Quitar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3">
                    <Metric
                      label="Ganadores"
                      value={String(prizePreview?.payouts.length ?? prizeDrafts.length)}
                    />
                    <Metric
                      label="Total porcentajes"
                      value={`${formatPercentageTotal(prizeDrafts)}%`}
                    />
                    <div className="rounded-lg border border-zinc-200">
                      <div className="border-b border-zinc-200 px-4 py-3">
                        <p className="text-sm font-semibold text-zinc-950">Vista previa</p>
                      </div>
                      <div className="divide-y divide-zinc-200">
                        {(prizePreview?.payouts ?? []).length > 0 ? (
                          prizePreview?.payouts.map((payout) => (
                            <div
                              key={`${payout.position}-${payout.description}`}
                              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                            >
                              <div>
                                <p className="font-medium text-zinc-950">
                                  {payout.description || `Posicion ${payout.position}`}
                                </p>
                                <p className="text-xs text-zinc-500">{payout.percentage}%</p>
                              </div>
                              <p className="font-semibold text-zinc-950">
                                {formatMoney(
                                  payout.estimated_amount_cents,
                                  prizePreview?.currency ?? paymentCurrency,
                                )}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="px-4 py-3 text-sm text-zinc-600">
                            Sin reglas de premios configuradas.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400 disabled:cursor-not-allowed disabled:text-zinc-400"
                        disabled={!canManageSelectedPoolPrizes || savingPrizes}
                        type="button"
                        onClick={addPrizeDraft}
                      >
                        Agregar ganador
                      </button>
                      <button
                        className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                        disabled={!canManageSelectedPoolPrizes || savingPrizes}
                        type="button"
                        onClick={() => void savePrizeRules()}
                      >
                        Guardar premios
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {pool ? (
              <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-950">
                      {poolDisplayName(pool)}
                    </h2>
                    <p className="text-sm text-zinc-600">
                      {formatMoney(pool.entry_fee_cents, pool.currency)} por entrada
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-md px-2 py-1 text-xs font-medium ${
                      canManageSelectedPool
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {canManageSelectedPool ? "Recaudo habilitado" : "Solo lectura"}
                  </span>
                </div>

                {pool.participants.length === 0 ? (
                  <div className="p-6 text-sm text-zinc-600">Sin participantes.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[980px] w-full border-collapse text-left text-sm">
                      <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Participante</th>
                          <th className="px-4 py-3 font-semibold">Estado</th>
                          <th className="px-4 py-3 font-semibold">Valor</th>
                          <th className="px-4 py-3 font-semibold">Metodo</th>
                          <th className="px-4 py-3 font-semibold">Referencia</th>
                          <th className="px-4 py-3 font-semibold">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {pool.participants.map((participant) => {
                          const payment = paymentsByUserID.get(participant.user_id);
                          const draft = {
                            ...defaultDraft(pool, payment),
                            ...drafts[participant.user_id],
                          };
                          const displayName = participantDisplayName(participant);
                          const isSaving = savingUserID === participant.user_id;

                          return (
                            <tr key={participant.user_id} className="align-top">
                              <td className="px-4 py-4">
                                <p className="font-medium text-zinc-950">{displayName}</p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  {participant.username ? `@${participant.username}` : participant.user_id}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <select
                                  aria-label={`Estado de pago de ${displayName}`}
                                  className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                                  disabled={!canManageSelectedPool || isSaving}
                                  value={draft.status}
                                  onChange={(event) =>
                                    updateDraft(participant.user_id, {
                                      status: event.target.value as PaymentStatus,
                                    })
                                  }
                                >
                                  {paymentStatuses.map((item) => (
                                    <option key={item.value} value={item.value}>
                                      {item.label}
                                    </option>
                                  ))}
                                </select>
                                <p className="mt-2">
                                  <span
                                    className={`rounded-md px-2 py-1 text-xs font-medium ${paymentStatusClass(
                                      draft.status,
                                    )}`}
                                  >
                                    {paymentStatusLabel(draft.status)}
                                  </span>
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <label className="sr-only" htmlFor={`amount-${participant.user_id}`}>
                                  Valor de pago de {displayName}
                                </label>
                                <input
                                  id={`amount-${participant.user_id}`}
                                  className="min-h-10 w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                                  disabled={!canManageSelectedPool || isSaving}
                                  inputMode="decimal"
                                  value={draft.amount}
                                  onChange={(event) =>
                                    updateDraft(participant.user_id, { amount: event.target.value })
                                  }
                                />
                                <p className="mt-2 text-xs text-zinc-500">{paymentCurrency}</p>
                              </td>
                              <td className="px-4 py-4">
                                <select
                                  aria-label={`Metodo de pago de ${displayName}`}
                                  className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                                  disabled={!canManageSelectedPool || isSaving}
                                  value={draft.method}
                                  onChange={(event) =>
                                    updateDraft(participant.user_id, {
                                      method: event.target.value as PaymentMethod,
                                    })
                                  }
                                >
                                  {paymentMethods.map((item) => (
                                    <option key={item.value} value={item.value}>
                                      {item.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-4">
                                <label
                                  className="sr-only"
                                  htmlFor={`reference-${participant.user_id}`}
                                >
                                  Referencia de pago de {displayName}
                                </label>
                                <input
                                  id={`reference-${participant.user_id}`}
                                  className="min-h-10 w-48 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                                  disabled={!canManageSelectedPool || isSaving}
                                  value={draft.reference}
                                  onChange={(event) =>
                                    updateDraft(participant.user_id, {
                                      reference: event.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                                    disabled={!canManageSelectedPool || isSaving}
                                    type="button"
                                    onClick={() => void savePayment(participant.user_id, "confirmed")}
                                  >
                                    Confirmar
                                  </button>
                                  <button
                                    className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:border-zinc-400 disabled:cursor-not-allowed disabled:text-zinc-400"
                                    disabled={!canManageSelectedPool || isSaving}
                                    type="button"
                                    onClick={() => void savePayment(participant.user_id, "pending")}
                                  >
                                    Pendiente
                                  </button>
                                  <button
                                    className="rounded-md border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:border-rose-300 disabled:cursor-not-allowed disabled:text-zinc-400"
                                    disabled={!canManageSelectedPool || isSaving}
                                    type="button"
                                    onClick={() => void savePayment(participant.user_id, "rejected")}
                                  >
                                    Rechazar
                                  </button>
                                  <button
                                    className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:border-zinc-400 disabled:cursor-not-allowed disabled:text-zinc-400"
                                    disabled={!canManageSelectedPool || isSaving}
                                    type="button"
                                    onClick={() => void savePayment(participant.user_id)}
                                  >
                                    Guardar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : (
              <section className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
                No tienes pollas creadas.
              </section>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function StatusPanel({ text }: { text: string }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <p role="status" className="text-sm font-medium text-zinc-700">
        {text}
      </p>
    </section>
  );
}

function SignedOutPanel() {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-zinc-950">Entra para administrar recaudo</h2>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          href="/login"
        >
          Entrar
        </Link>
        <Link
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400"
          href="/register"
        >
          Crear cuenta
        </Link>
      </div>
    </section>
  );
}

function PredictionSettingsPanel({
  canManage,
  draft,
  onChange,
  onSave,
  saving,
}: {
  canManage: boolean;
  draft: PredictionSettingsDraft;
  onChange: (draft: PredictionSettingsDraft) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Pronosticos</h2>
          <p className="text-sm text-zinc-600">
            {predictionModeLabel(draft.predictionMode)} -{" "}
            {matchResultScoringModeLabel(draft.matchResultScoringMode)}
          </p>
        </div>
        <span
          className={`w-fit rounded-md px-2 py-1 text-xs font-medium ${
            canManage ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {canManage ? "Configurable" : "Solo lectura"}
        </span>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)_auto] lg:items-end">
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span>Modo de pronostico</span>
          <select
            className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
            disabled={!canManage || saving}
            value={draft.predictionMode}
            onChange={(event) =>
              onChange({
                ...draft,
                predictionMode: event.target.value as PredictionMode,
              })
            }
          >
            {predictionModeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span>Puntaje de resultado</span>
          <select
            className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
            disabled={!canManage || saving}
            value={draft.matchResultScoringMode}
            onChange={(event) =>
              onChange({
                ...draft,
                matchResultScoringMode: event.target.value as MatchResultScoringMode,
              })
            }
          >
            {matchResultScoringModeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          className="min-h-10 rounded-md bg-zinc-950 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          disabled={!canManage || saving}
          onClick={onSave}
          type="button"
        >
          {saving ? "Guardando" : "Guardar configuracion"}
        </button>
      </div>
    </section>
  );
}

function ResultsPanel({
  auditLogsByMatchID,
  canManage,
  groups,
  loadingAuditMatchID,
  onLoadAudit,
  onSave,
  onUpdateDraft,
  predictionCloseHoursBefore,
  resultDrafts,
  savingMatchID,
  statusesByMatch,
}: {
  auditLogsByMatchID: Record<string, MatchResultAuditLog[]>;
  canManage: boolean;
  groups: ResultMatchGroup[];
  loadingAuditMatchID: string;
  onLoadAudit: (matchID: string) => void;
  onSave: (match: Match) => void;
  onUpdateDraft: (matchID: string, side: "home" | "away", value: string) => void;
  predictionCloseHoursBefore: number;
  resultDrafts: ResultDrafts;
  savingMatchID: string;
  statusesByMatch: Map<string, PredictionMatchStatus>;
}) {
  const matches = groups.flatMap((group) => group.matches);
  const resultCount = matches.filter(
    (match) => statusesByMatch.get(match.id)?.has_official_result,
  ).length;
  const closedCount = matches.filter((match) =>
    isMatchClosedForResults(match, predictionCloseHoursBefore, statusesByMatch.get(match.id)),
  ).length;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Resultados oficiales</h2>
          <p className="text-sm text-zinc-600">
            {resultCount} de {matches.length} partidos con marcador final.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
            {closedCount} cerrados
          </span>
          <span
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              canManage ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            }`}
          >
            {canManage ? "Carga habilitada" : "Solo lectura"}
          </span>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="p-5 text-sm text-zinc-600">Sin fixture disponible para esta polla.</div>
      ) : (
        <div className="divide-y divide-zinc-200">
          {groups.map((group) => (
            <div key={group.id}>
              <div className="bg-zinc-50 px-5 py-3">
                <h3 className="text-sm font-semibold text-zinc-950">{group.title}</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {group.matches.length} partidos - {group.subtitle}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full border-collapse text-left text-sm">
                  <thead className="bg-white text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Partido</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                      <th className="px-4 py-3 font-semibold">Marcador</th>
                      <th className="px-4 py-3 font-semibold">Auditoria</th>
                      <th className="px-4 py-3 font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {group.matches.map((match) => {
                      const status = statusesByMatch.get(match.id);
                      const draft = {
                        ...defaultResultDraft(status),
                        ...resultDrafts[match.id],
                      };
                      const closed = isMatchClosedForResults(
                        match,
                        predictionCloseHoursBefore,
                        status,
                      );
                      const auditLogs = auditLogsByMatchID[match.id] ?? [];
                      const latestAuditLog = auditLogs[0] ?? null;
                      const homeName = matchTeamName(match, "home");
                      const awayName = matchTeamName(match, "away");
                      const isSaving = savingMatchID === match.id;
                      const isLoadingAudit = loadingAuditMatchID === match.id;

                      return (
                        <tr key={match.id} className="align-top">
                          <td className="px-4 py-4">
                            <p className="text-xs font-medium text-zinc-500">
                              Partido {match.match_number}
                            </p>
                            <p className="mt-1 font-semibold text-zinc-950">
                              {homeName} vs {awayName}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {formatMatchDate(match.starts_at)} - {match.venue}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-medium ${resultStatusClass(
                                status,
                                closed,
                              )}`}
                            >
                              {resultStatusLabel(status, closed)}
                            </span>
                            {status?.official_result ? (
                              <p className="mt-2 text-xs font-medium text-zinc-700">
                                Resultado {status.official_result.home_score}-
                                {status.official_result.away_score}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4">
                            <div className="grid grid-cols-2 gap-2">
                              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                                <span>{matchTeamShortName(match, "home")}</span>
                                <input
                                  aria-label={`Goles ${homeName}`}
                                  className="min-h-10 w-20 rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold"
                                  disabled={!canManage || !closed || isSaving}
                                  min={0}
                                  onChange={(event) =>
                                    onUpdateDraft(match.id, "home", event.target.value)
                                  }
                                  step={1}
                                  type="number"
                                  value={draft.home}
                                />
                              </label>
                              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                                <span>{matchTeamShortName(match, "away")}</span>
                                <input
                                  aria-label={`Goles ${awayName}`}
                                  className="min-h-10 w-20 rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold"
                                  disabled={!canManage || !closed || isSaving}
                                  min={0}
                                  onChange={(event) =>
                                    onUpdateDraft(match.id, "away", event.target.value)
                                  }
                                  step={1}
                                  type="number"
                                  value={draft.away}
                                />
                              </label>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {latestAuditLog ? (
                              <div>
                                <p className="text-xs font-semibold text-zinc-950">
                                  {matchResultAuditActionLabel(latestAuditLog.action)}
                                </p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  {formatAuditSummary(latestAuditLog)}
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-zinc-500">
                                {status?.has_official_result
                                  ? "Auditoria pendiente de cargar."
                                  : "Sin resultado guardado."}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="rounded-md bg-zinc-950 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                                disabled={!canManage || !closed || isSaving}
                                onClick={() => onSave(match)}
                                type="button"
                              >
                                {isSaving ? "Guardando" : "Guardar resultado"}
                              </button>
                              <button
                                className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:border-zinc-400 disabled:cursor-not-allowed disabled:text-zinc-400"
                                disabled={!canManage || isLoadingAudit}
                                onClick={() => onLoadAudit(match.id)}
                                type="button"
                              >
                                {isLoadingAudit ? "Cargando" : "Ver auditoria"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-4 py-3">
      <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSession = window.localStorage.getItem(sessionStorageKey);
  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession) as AuthSession;
    if (!parsed.token || !parsed.expiresAt || !parsed.user?.id) {
      clearStoredSession();
      return null;
    }
    if (Date.parse(parsed.expiresAt) <= Date.now()) {
      clearStoredSession();
      return null;
    }
    return parsed;
  } catch {
    clearStoredSession();
    return null;
  }
}

function clearStoredSession() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(sessionStorageKey);
  }
}

function canManagePayments(pool: Pool, userID: string) {
  return pool.current_user_role === "pool_admin" || pool.collection_responsible_user_id === userID;
}

function canManagePrizeRules(pool: Pool) {
  return pool.current_user_role === "pool_admin";
}

function canManagePredictionSettings(pool: Pool) {
  return pool.current_user_role === "pool_admin";
}

function canManageResults(pool: Pool) {
  return pool.current_user_role === "pool_admin";
}

function poolDisplayName(pool: Pool) {
  return pool.theme?.display_name || pool.name;
}

function participantDisplayName(participant: PoolParticipant) {
  return participant.user_name || participant.username || participant.user_id;
}

function indexPayments(payments: Payment[]) {
  const indexed = new Map<string, Payment>();
  for (const payment of payments) {
    indexed.set(payment.user_id, payment);
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

function findTournamentSummary(tournaments: TournamentSummary[], pool: Pool) {
  return (
    tournaments.find(
      (tournament) =>
        tournament.id === pool.tournament_id || tournament.slug === pool.tournament_id,
    ) ?? null
  );
}

function groupMatchesForResults(matches: Match[]) {
  const groupsByID = new Map<string, ResultMatchGroup>();
  const sortedMatches = [...matches].sort((left, right) => left.match_number - right.match_number);

  for (const match of sortedMatches) {
    const groupID = match.group_id || match.stage_id || "matches";
    const groupName = match.group_name ? `Grupo ${match.group_name}` : stageLabel(match.stage_id);
    const existingGroup = groupsByID.get(groupID);
    if (existingGroup) {
      existingGroup.matches.push(match);
      continue;
    }

    groupsByID.set(groupID, {
      id: groupID,
      title: groupName,
      subtitle: stageLabel(match.stage_id),
      matches: [match],
    });
  }

  return Array.from(groupsByID.values());
}

function stageLabel(stageID: string) {
  const normalized = stageID.replace(/[-_]+/g, " ").trim();
  if (!normalized) {
    return "Partidos";
  }
  if (normalized.toLowerCase() === "group stage") {
    return "Fase de grupos";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function hydrateResultDrafts(
  matches: Match[],
  statuses: PredictionMatchStatus[],
) {
  const statusesByMatch = indexPredictionStatuses(statuses);
  const drafts: ResultDrafts = {};
  for (const match of matches) {
    drafts[match.id] = defaultResultDraft(statusesByMatch.get(match.id));
  }
  return drafts;
}

function defaultResultDraft(status?: PredictionMatchStatus) {
  const result = status?.official_result;
  return {
    home: result ? String(result.home_score) : "",
    away: result ? String(result.away_score) : "",
  } satisfies ResultDrafts[string];
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

function isMatchClosedForResults(
  match: Match,
  predictionCloseHoursBefore: number,
  status?: PredictionMatchStatus,
) {
  if (status?.closed) {
    return true;
  }
  const startsAt = Date.parse(match.starts_at);
  if (!Number.isFinite(startsAt)) {
    return false;
  }
  const closeAt = startsAt - predictionCloseHoursBefore * 60 * 60 * 1000;
  return Date.now() >= closeAt;
}

function matchTeamName(match: Match, side: "home" | "away") {
  if (side === "home") {
    return match.home_team?.name ?? match.home_slot;
  }
  return match.away_team?.name ?? match.away_slot;
}

function matchTeamShortName(match: Match, side: "home" | "away") {
  if (side === "home") {
    return match.home_team?.short_name ?? match.home_slot;
  }
  return match.away_team?.short_name ?? match.away_slot;
}

function resultStatusLabel(status: PredictionMatchStatus | undefined, closed: boolean) {
  if (status?.has_official_result) {
    return "Con resultado";
  }
  return closed ? "Cerrado" : "Abierto";
}

function resultStatusClass(status: PredictionMatchStatus | undefined, closed: boolean) {
  if (status?.has_official_result) {
    return "bg-sky-100 text-sky-800";
  }
  return closed ? "bg-zinc-100 text-zinc-700" : "bg-amber-100 text-amber-800";
}

function matchResultAuditActionLabel(action: MatchResultAuditLog["action"]) {
  switch (action) {
    case "match_result_created":
      return "Resultado creado";
    case "match_result_updated":
      return "Resultado editado";
    default:
      return action;
  }
}

function formatAuditSummary(log: MatchResultAuditLog) {
  const current = `${log.current.home_score}-${log.current.away_score}`;
  const previous = log.previous
    ? `${log.previous.home_score}-${log.previous.away_score} -> `
    : "";
  return `${previous}${current} por ${log.actor_user_id} - ${formatMatchDate(log.created_at)}`;
}

function paymentTotals(participants: PoolParticipant[], paymentsByUserID: Map<string, Payment>) {
  let confirmedAmountCents = 0;
  let confirmedCount = 0;
  let rejectedCount = 0;
  let pendingCount = 0;

  for (const participant of participants) {
    const status = paymentsByUserID.get(participant.user_id)?.status ?? participant.payment_status;
    if (status === "confirmed") {
      confirmedCount += 1;
      confirmedAmountCents += paymentsByUserID.get(participant.user_id)?.amount_cents ?? 0;
    } else if (status === "rejected") {
      rejectedCount += 1;
    } else {
      pendingCount += 1;
    }
  }

  return { confirmedAmountCents, confirmedCount, pendingCount, rejectedCount };
}

function hydratePaymentDrafts(pool: Pool, payments: Payment[]) {
  const paymentsByUserID = indexPayments(payments);
  const drafts: PaymentDrafts = {};
  for (const participant of pool.participants) {
    drafts[participant.user_id] = defaultDraft(pool, paymentsByUserID.get(participant.user_id));
  }
  return drafts;
}

function hydratePrizeDrafts(preview: PrizePreview | null) {
  const rules = preview?.rules ?? [];
  if (rules.length === 0) {
    return [{ position: "1", percentage: "100", description: "Posicion 1" }];
  }

  return rules.map((rule) => ({
    position: String(rule.position),
    percentage: formatPercentageInput(rule.percentage),
    description: rule.description,
  }));
}

function defaultPredictionSettingsDraft(pool: Pool | null): PredictionSettingsDraft {
  return {
    predictionMode: pool?.prediction_mode ?? "score_with_outcome",
    matchResultScoringMode: pool?.match_result_scoring_mode ?? "exclusive",
  };
}

function defaultDraft(pool: Pool | null, payment?: Payment) {
  return {
    amount: centsToInput(payment?.amount_cents ?? pool?.entry_fee_cents ?? 0),
    method: payment?.payment_method ?? "cash",
    reference: payment?.reference ?? "",
    status: payment?.status ?? "pending",
  } satisfies PaymentDrafts[string];
}

function draftFromPayment(payment: Payment) {
  return {
    amount: centsToInput(payment.amount_cents),
    method: payment.payment_method,
    reference: payment.reference,
    status: payment.status,
  } satisfies PaymentDrafts[string];
}

function upsertPayment(payments: Payment[], nextPayment: Payment) {
  const nextPayments = payments.filter((payment) => payment.user_id !== nextPayment.user_id);
  nextPayments.push(nextPayment);
  return nextPayments;
}

function updateParticipantPaymentStatus(
  pool: Pool | null,
  userID: string,
  status: PaymentStatus,
) {
  if (!pool) {
    return pool;
  }

  return {
    ...pool,
    participants: pool.participants.map((participant) =>
      participant.user_id === userID
        ? { ...participant, payment_status: status }
        : participant,
    ),
  };
}

function centsToInput(amountCents: number) {
  const amount = amountCents / 100;
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function parseMoneyToCents(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (normalized === "") {
    return null;
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }
  return Math.round(amount * 100);
}

function parsePrizeDrafts(drafts: PrizeRuleDraft[]) {
  if (drafts.length === 0) {
    return null;
  }

  const seenPositions = new Set<number>();
  let totalUnits = 0;
  const rules = [];
  for (const draft of drafts) {
    const position = Number(draft.position.trim());
    const percentage = parsePercentage(draft.percentage);
    const description = draft.description.trim();
    if (
      !Number.isInteger(position) ||
      position < 1 ||
      seenPositions.has(position) ||
      percentage === null ||
      description.includes("<") ||
      description.includes(">")
    ) {
      return null;
    }
    seenPositions.add(position);
    totalUnits += percentageToUnits(percentage);
    rules.push({ position, percentage, description });
  }

  if (totalUnits !== prizeTotalPercentageUnits) {
    return null;
  }

  return rules.sort((left, right) => left.position - right.position);
}

function parsePercentage(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (normalized === "") {
    return null;
  }
  const percentage = Number(normalized);
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
    return null;
  }
  const units = Math.round(percentage * prizePercentageScale);
  if (units <= 0 || units > prizeTotalPercentageUnits) {
    return null;
  }
  return units / prizePercentageScale;
}

function formatPercentageInput(percentage: number) {
  return Number.isInteger(percentage) ? String(percentage) : String(percentage);
}

function formatPercentageTotal(drafts: PrizeRuleDraft[]) {
  const totalUnits = drafts.reduce((accumulator, draft) => {
    const percentage = parsePercentage(draft.percentage);
    return accumulator + (percentage === null ? 0 : percentageToUnits(percentage));
  }, 0);
  const total = totalUnits / prizePercentageScale;
  return Number.isInteger(total) ? String(total) : total.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function percentageToUnits(percentage: number) {
  return Math.round(percentage * prizePercentageScale);
}

function formatMoney(amountCents: number, currency: string) {
  const amount = amountCents / 100;
  return `${currency} ${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)}`;
}

function formatMatchDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Fecha por definir";
  }
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function paymentStatusLabel(status: PaymentStatus) {
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

function paymentStatusClass(status: PaymentStatus) {
  switch (status) {
    case "confirmed":
      return "bg-emerald-100 text-emerald-800";
    case "rejected":
      return "bg-rose-100 text-rose-800";
    case "pending":
    default:
      return "bg-amber-100 text-amber-800";
  }
}

function predictionModeLabel(mode: PredictionMode) {
  switch (mode) {
    case "score":
      return "Marcador simple";
    case "outcome":
      return "Local / empate / visitante";
    case "score_with_outcome":
    default:
      return "Marcador con resultado";
  }
}

function matchResultScoringModeLabel(mode: MatchResultScoringMode) {
  switch (mode) {
    case "cumulative":
      return "Acumulativo";
    case "exclusive":
    default:
      return "Exclusivo";
  }
}

function isUnauthorized(error: unknown) {
  return error instanceof PollavarAPIError && error.status === 401;
}

function isForbidden(error: unknown) {
  return error instanceof PollavarAPIError && error.status === 403;
}
