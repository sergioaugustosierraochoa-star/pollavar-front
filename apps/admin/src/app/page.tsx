"use client";

import {
  PollavarAPIError,
  createPollavarClient,
  type AuthUser,
  type Payment,
  type PaymentCollection,
  type PaymentMethod,
  type PaymentStatus,
  type Pool,
  type PoolParticipant,
  type PrizePreview,
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

export default function AdminHome() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<DashboardStatus>("checking");
  const [message, setMessage] = useState("");
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPoolID, setSelectedPoolID] = useState("");
  const [pool, setPool] = useState<Pool | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentCurrency, setPaymentCurrency] = useState("COP");
  const [prizePreview, setPrizePreview] = useState<PrizePreview | null>(null);
  const [prizeDrafts, setPrizeDrafts] = useState<PrizeRuleDraft[]>([]);
  const [drafts, setDrafts] = useState<PaymentDrafts>({});
  const [savingUserID, setSavingUserID] = useState("");
  const [savingPrizes, setSavingPrizes] = useState(false);
  const requestID = useRef(0);

  const paymentsByUserID = useMemo(() => indexPayments(payments), [payments]);
  const canManageSelectedPool = Boolean(
    session && pool && canManagePayments(pool, session.user.id),
  );
  const canManageSelectedPoolPrizes = Boolean(pool && canManagePrizeRules(pool));
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
    setPayments([]);
    setPaymentCurrency("COP");
    setPrizePreview(null);
    setPrizeDrafts([]);
    setDrafts({});
    setSavingUserID("");
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
    setSavingUserID("");

    try {
      const client = createPollavarClient();
      const poolList = await client.listPools(token);
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
        setPayments([]);
        setPaymentCurrency("COP");
        setPrizePreview(null);
        setPrizeDrafts([]);
        setDrafts({});
        setStatus("ready");
        return;
      }

      const poolDetail = await client.getPool(token, activePool.id);
      const nextPrizePreview = await client.getPrizePreview(token, poolDetail.id);
      let paymentCollection: PaymentCollection = {
        pool_id: poolDetail.id,
        currency: poolDetail.currency || "COP",
        confirmed_total_cents: 0,
        payments: [],
      };

      if (canManagePayments(poolDetail, userID)) {
        paymentCollection = await client.listPayments(token, poolDetail.id);
      }

      if (!isLatestRequest()) {
        return;
      }

      setPool(poolDetail);
      setPayments(paymentCollection.payments);
      setPaymentCurrency(paymentCollection.currency || poolDetail.currency || "COP");
      setPrizePreview(nextPrizePreview);
      setPrizeDrafts(hydratePrizeDrafts(nextPrizePreview));
      setDrafts(hydratePaymentDrafts(poolDetail, paymentCollection.payments));
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
      setStatus("error");
      setMessage("No pudimos cargar el panel de recaudo.");
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
      setMessage("No pudimos actualizar los premios.");
    } finally {
      setSavingPrizes(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-[#191b1f]">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">PollaVAR Admin</p>
            <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">
              Recaudo manual
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
          <StatusPanel text="Cargando panel de recaudo" />
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
                role={message.includes("No pudimos") || message.includes("Revisa") ? "alert" : "status"}
                className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700"
              >
                {message}
              </p>
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

function isUnauthorized(error: unknown) {
  return error instanceof PollavarAPIError && error.status === 401;
}
