"use client";

import {
  PollavarAPIError,
  createPollavarClient,
  type AuthUser,
  type EffectiveMatchPredictionSettings,
  type GlobalPredictionDefinition,
  type GlobalPredictionDefinitionInput,
  type GlobalPredictionPrizePreview,
  type GlobalPredictionPrizeType,
  type GlobalPredictionResult,
  type GlobalPredictionTemplate,
  type GlobalPredictionTemplateInput,
  type GlobalPredictionValueType,
  type Match,
  type MatchOutcome,
  type MatchResultAuditLog,
  type MatchUnderdogBonus,
  type MatchResultScoringMode,
  type Payment,
  type PaymentCollection,
  type PaymentMethod,
  type PaymentStatus,
  type Pool,
  type PoolParticipant,
  type PoolTheme,
  type PredictionSettingsOverride,
  type PredictionSettingsOverrideInput,
  type PredictionSettingsOverrideScope,
  type PredictionMode,
  type PredictionSettingsSource,
  type PredictionMatchStatus,
  type PrizePreview,
  type SaveGlobalPredictionInput,
  type ScoringRule,
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
type GlobalPredictionDrafts = Record<
  string,
  { valueText: string; valueNumber: string; rangeMin: string; rangeMax: string }
>;
type GlobalPredictionDefinitionDrafts = Record<
  string,
  {
    code: string;
    label: string;
    valueType: GlobalPredictionValueType;
    enabled: boolean;
    pointsEnabled: boolean;
    prizeEnabled: boolean;
    prizeType: GlobalPredictionPrizeType;
    prizeFixedAmount: string;
    prizePercentage: string;
    points: string;
    sortOrder: string;
    closesAt: string;
  }
>;
type GlobalPredictionTemplateDrafts = Record<
  string,
  {
    code: string;
    label: string;
    valueType: GlobalPredictionValueType;
    sport: string;
    category: string;
    resolutionMode: string;
    enabled: boolean;
    pointsEnabled: boolean;
    prizeEnabled: boolean;
    points: string;
    sortOrder: string;
    defaultEnabled: boolean;
  }
>;
type GlobalPredictionTemplateDraftInput = GlobalPredictionTemplateInput & { code: string };
type ResultMatchGroup = {
  id: string;
  title: string;
  subtitle: string;
  matches: Match[];
};
type PredictionSettingsDraft = {
  predictionMode: PredictionMode;
  matchResultScoringMode: MatchResultScoringMode;
  underdogBonusEnabled: boolean;
  underdogBonusPoints: string;
};
type PredictionSettingsOverrideDrafts = Record<
  string,
  {
    scopeType: PredictionSettingsOverrideScope;
    stageID: string;
    matchID: string;
    predictionMode: PredictionMode | "";
    matchResultScoringMode: MatchResultScoringMode | "";
    underdogBonusEnabled: "inherit" | "enabled" | "disabled";
    underdogBonusPoints: string;
  }
>;
type PredictionSettingsScopeRow = {
  key: string;
  scopeType: PredictionSettingsOverrideScope;
  stageID: string;
  matchID: string;
  title: string;
  subtitle: string;
  matchIDs: string[];
};
type UnderdogBonusDrafts = Record<
  string,
  {
    enabled: boolean;
    outcome: MatchOutcome | "";
    homeProbability: string;
    drawProbability: string;
    awayProbability: string;
  }
>;
type ThemeDraft = {
  displayName: string;
  logoURL: string;
  bannerURL: string;
  mascotURL: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};
type NormalizedTheme = {
  logoURL: string;
  bannerURL: string;
  mascotURL: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};
type TournamentTeamOption = Tournament["groups"][number]["teams"][number];
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

const globalPredictionValueTypeOptions: Array<{
  value: GlobalPredictionValueType;
  label: string;
}> = [
  { value: "team", label: "Equipo" },
  { value: "player", label: "Jugador" },
  { value: "text", label: "Texto" },
  { value: "number", label: "Numero" },
  { value: "number_range", label: "Rango numerico" },
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
  const [globalPrizePreview, setGlobalPrizePreview] =
    useState<GlobalPredictionPrizePreview | null>(null);
  const [prizeDrafts, setPrizeDrafts] = useState<PrizeRuleDraft[]>([]);
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);
  const [globalPredictionDefinitions, setGlobalPredictionDefinitions] = useState<
    GlobalPredictionDefinition[]
  >([]);
  const [globalPredictionTemplates, setGlobalPredictionTemplates] = useState<
    GlobalPredictionTemplate[]
  >([]);
  const [globalTemplateDrafts, setGlobalTemplateDrafts] =
    useState<GlobalPredictionTemplateDrafts>({});
  const [globalPredictionResults, setGlobalPredictionResults] = useState<
    GlobalPredictionResult[]
  >([]);
  const [globalDefinitionDrafts, setGlobalDefinitionDrafts] =
    useState<GlobalPredictionDefinitionDrafts>({});
  const [globalResultDrafts, setGlobalResultDrafts] = useState<GlobalPredictionDrafts>({});
  const [underdogBonusDrafts, setUnderdogBonusDrafts] = useState<UnderdogBonusDrafts>({});
  const [themeDraft, setThemeDraft] = useState<ThemeDraft>(defaultThemeDraft(null));
  const [predictionSettingsDraft, setPredictionSettingsDraft] =
    useState<PredictionSettingsDraft>(defaultPredictionSettingsDraft(null, []));
  const [predictionSettingsOverrideDrafts, setPredictionSettingsOverrideDrafts] =
    useState<PredictionSettingsOverrideDrafts>({});
  const [effectiveMatchSettings, setEffectiveMatchSettings] = useState<
    EffectiveMatchPredictionSettings[]
  >([]);
  const [resultDrafts, setResultDrafts] = useState<ResultDrafts>({});
  const [resultAuditLogsByMatchID, setResultAuditLogsByMatchID] = useState<
    Record<string, MatchResultAuditLog[]>
  >({});
  const [drafts, setDrafts] = useState<PaymentDrafts>({});
  const [savingResultMatchID, setSavingResultMatchID] = useState("");
  const [loadingAuditMatchID, setLoadingAuditMatchID] = useState("");
  const [savingUserID, setSavingUserID] = useState("");
  const [savingBonusMatchID, setSavingBonusMatchID] = useState("");
  const [savingGlobalDefinitions, setSavingGlobalDefinitions] = useState(false);
  const [savingGlobalTemplateCode, setSavingGlobalTemplateCode] = useState("");
  const [savingGlobalResultCode, setSavingGlobalResultCode] = useState("");
  const [savingTheme, setSavingTheme] = useState(false);
  const [savingPredictionSettings, setSavingPredictionSettings] = useState(false);
  const [savingPredictionOverrides, setSavingPredictionOverrides] = useState(false);
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
  const predictionSettingsScopeRows = useMemo(
    () => predictionSettingsScopeRowsForMatches(tournament?.matches ?? []),
    [tournament?.matches],
  );
  const effectiveMatchSettingsByMatch = useMemo(
    () => indexEffectiveMatchSettings(effectiveMatchSettings),
    [effectiveMatchSettings],
  );
  const paymentsByUserID = useMemo(() => indexPayments(payments), [payments]);
  const canManageSelectedPool = Boolean(
    session && pool && canManagePayments(pool, session.user.id),
  );
  const canManageSelectedPoolPrizes = Boolean(pool && canManagePrizeRules(pool));
  const canManageSelectedPoolPredictionSettings = Boolean(
    pool && canManagePredictionSettings(pool),
  );
  const canManageSelectedPoolGlobalPredictions = Boolean(
    pool && canManagePredictionSettings(pool),
  );
  const canManageSelectedPoolTheme = Boolean(pool && canManageTheme(pool));
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
    setGlobalPrizePreview(null);
    setPrizeDrafts([]);
    setScoringRules([]);
    setGlobalPredictionDefinitions([]);
    setGlobalPredictionTemplates([]);
    setGlobalTemplateDrafts({});
    setGlobalPredictionResults([]);
    setGlobalDefinitionDrafts({});
    setGlobalResultDrafts({});
    setUnderdogBonusDrafts({});
    setThemeDraft(defaultThemeDraft(null));
    setPredictionSettingsDraft(defaultPredictionSettingsDraft(null, []));
    setPredictionSettingsOverrideDrafts({});
    setEffectiveMatchSettings([]);
    setResultDrafts({});
    setResultAuditLogsByMatchID({});
    setDrafts({});
    setSavingResultMatchID("");
    setLoadingAuditMatchID("");
    setSavingUserID("");
    setSavingBonusMatchID("");
    setSavingGlobalDefinitions(false);
    setSavingGlobalTemplateCode("");
    setSavingGlobalResultCode("");
    setSavingTheme(false);
    setSavingPredictionSettings(false);
    setSavingPredictionOverrides(false);
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
    setSavingBonusMatchID("");
    setSavingGlobalDefinitions(false);
    setSavingGlobalResultCode("");
    setSavingTheme(false);
    setSavingPredictionSettings(false);
    setSavingPredictionOverrides(false);
    setSavingPrizes(false);

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
        setGlobalPrizePreview(null);
        setPrizeDrafts([]);
        setScoringRules([]);
        setGlobalPredictionDefinitions([]);
        setGlobalPredictionTemplates([]);
        setGlobalTemplateDrafts({});
        setGlobalPredictionResults([]);
        setGlobalDefinitionDrafts({});
        setGlobalResultDrafts({});
        setUnderdogBonusDrafts({});
        setThemeDraft(defaultThemeDraft(null));
        setPredictionSettingsDraft(defaultPredictionSettingsDraft(null, []));
        setPredictionSettingsOverrideDrafts({});
        setEffectiveMatchSettings([]);
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
      const canManagePredictionConfig = canManagePredictionSettings(poolDetail);
      const [
        nextPrizePreview,
        nextGlobalPrizePreview,
        nextPredictionStatuses,
        tournamentDetail,
        paymentCollection,
        nextScoringRules,
        nextUnderdogBonuses,
        nextPredictionSettingsOverrides,
        nextEffectiveMatchSettings,
        nextGlobalTemplates,
        nextGlobalDefinitions,
        nextGlobalResults,
      ] = await Promise.all([
        client.getPrizePreview(token, poolDetail.id),
        client.getGlobalPredictionPrizePreview(token, poolDetail.id),
        client.listPredictionStatuses(token, poolDetail.id),
        tournamentRequest,
        paymentCollectionRequest,
        client.listScoringRules(token, poolDetail.id),
        client.listMatchUnderdogBonuses(token, poolDetail.id),
        canManagePredictionConfig
          ? client.listPredictionSettingsOverrides(token, poolDetail.id)
          : Promise.resolve([]),
        canManagePredictionConfig
          ? client.listEffectiveMatchPredictionSettings(token, poolDetail.id)
          : Promise.resolve([]),
        canManagePredictionConfig
          ? client.listGlobalPredictionTemplates(token, poolDetail.id)
          : Promise.resolve([]),
        client.listGlobalPredictionDefinitions(token, poolDetail.id),
        client.listGlobalPredictionResults(token, poolDetail.id),
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
      setGlobalPrizePreview(nextGlobalPrizePreview);
      setPrizeDrafts(hydratePrizeDrafts(nextPrizePreview));
      setScoringRules(nextScoringRules);
      setGlobalPredictionTemplates(nextGlobalTemplates);
      setGlobalTemplateDrafts(hydrateGlobalTemplateDrafts(nextGlobalTemplates));
      setGlobalPredictionDefinitions(nextGlobalDefinitions);
      setGlobalPredictionResults(nextGlobalResults);
      setGlobalDefinitionDrafts(hydrateGlobalDefinitionDrafts(nextGlobalDefinitions));
      setGlobalResultDrafts(
        hydrateGlobalResultDrafts(nextGlobalDefinitions, nextGlobalResults),
      );
      setUnderdogBonusDrafts(hydrateUnderdogBonusDrafts(nextUnderdogBonuses));
      setThemeDraft(defaultThemeDraft(poolDetail));
      setPredictionSettingsDraft(defaultPredictionSettingsDraft(poolDetail, nextScoringRules));
      setPredictionSettingsOverrideDrafts(
        hydratePredictionSettingsOverrideDrafts(nextPredictionSettingsOverrides),
      );
      setEffectiveMatchSettings(nextEffectiveMatchSettings);
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

  function updateUnderdogBonusDraft(
    matchID: string,
    patch: Partial<UnderdogBonusDrafts[string]>,
  ) {
    setUnderdogBonusDrafts((current) => ({
      ...current,
      [matchID]: {
        ...defaultUnderdogBonusDraft(),
        ...current[matchID],
        ...patch,
      },
    }));
  }

  function updatePredictionSettingsOverrideDraft(
    row: PredictionSettingsScopeRow,
    patch: Partial<PredictionSettingsOverrideDrafts[string]>,
  ) {
    setPredictionSettingsOverrideDrafts((current) => ({
      ...current,
      [row.key]: {
        ...defaultPredictionSettingsOverrideDraft(row),
        ...current[row.key],
        ...patch,
      },
    }));
  }

  function clearPredictionSettingsOverrideDraft(row: PredictionSettingsScopeRow) {
    setPredictionSettingsOverrideDrafts((current) => ({
      ...current,
      [row.key]: defaultPredictionSettingsOverrideDraft(row),
    }));
  }

  function updateGlobalDefinitionDraft(
    code: string,
    patch: Partial<GlobalPredictionDefinitionDrafts[string]>,
  ) {
    setGlobalDefinitionDrafts((current) => ({
      ...current,
      [code]: {
        ...globalDefinitionDraft(
          globalPredictionDefinitions.find((definition) => definition.code === code),
        ),
        ...current[code],
        ...patch,
      },
    }));
  }

  function addGlobalDefinitionTemplate(template: GlobalPredictionTemplate) {
    if (!pool || !canManageSelectedPoolGlobalPredictions) {
      return;
    }

    const nextDefinition = globalDefinitionFromTemplate(pool.id, template);
    setGlobalPredictionDefinitions((current) => {
      if (current.some((definition) => definition.code === template.code)) {
        return current;
      }
      return globalDefinitionsInOrder([...current, nextDefinition]);
    });
    setGlobalDefinitionDrafts((current) => ({
      ...current,
      [template.code]: {
        ...globalDefinitionDraft(nextDefinition),
        ...current[template.code],
        enabled: true,
      },
    }));
    setMessage("Plantilla agregada. Guarda la configuracion para aplicarla.");
  }

  function updateGlobalTemplateDraft(
    code: string,
    patch: Partial<GlobalPredictionTemplateDrafts[string]>,
  ) {
    setGlobalTemplateDrafts((current) => ({
      ...current,
      [code]: {
        ...globalTemplateDraft(globalPredictionTemplates.find((template) => template.code === code)),
        ...current[code],
        ...patch,
      },
    }));
  }

  function addReusableGlobalTemplateDraft() {
    if (!pool || !canManageSelectedPoolGlobalPredictions) {
      return;
    }

    const code = nextReusableGlobalTemplateCode(globalPredictionTemplates, globalTemplateDrafts);
    const sortOrder = nextGlobalTemplateSortOrder(globalPredictionTemplates, globalTemplateDrafts);
    const nextTemplate = globalReusableTemplate(code, sortOrder);
    setGlobalPredictionTemplates((current) => globalTemplatesInOrder([...current, nextTemplate]));
    setGlobalTemplateDrafts((current) => ({
      ...current,
      [code]: globalTemplateDraft(nextTemplate),
    }));
    setMessage("Plantilla reusable agregada. Ajustala y guardala en el catalogo.");
  }

  async function saveGlobalPredictionTemplate(originalCode: string) {
    if (!session || !pool || !canManageSelectedPoolGlobalPredictions) {
      return;
    }

    const draft = {
      ...globalTemplateDraft(
        globalPredictionTemplates.find((template) => template.code === originalCode),
      ),
      ...globalTemplateDrafts[originalCode],
    };
    const input = parseGlobalTemplateDraft(draft);
    if (!input) {
      setMessage("Revisa la plantilla del catalogo.");
      return;
    }

    setSavingGlobalTemplateCode(originalCode);
    setMessage("");

    try {
      const { code, ...payload } = input;
      const savedTemplate = await createPollavarClient().saveGlobalPredictionTemplate(
        session.token,
        pool.id,
        code,
        payload,
      );
      setGlobalPredictionTemplates((current) =>
        globalTemplatesInOrder(
          current
            .filter(
              (template) =>
                template.code !== originalCode && template.code !== savedTemplate.code,
            )
            .concat(savedTemplate),
        ),
      );
      setGlobalTemplateDrafts((current) => {
        const next = { ...current };
        delete next[originalCode];
        next[savedTemplate.code] = globalTemplateDraft(savedTemplate);
        return next;
      });
      setMessage("Plantilla del catalogo guardada.");
    } catch (error) {
      if (isUnauthorized(error)) {
        signOutAdmin();
        return;
      }
      if (isForbidden(error)) {
        setMessage("No tienes permisos para administrar el catalogo.");
        return;
      }
      setMessage("No pudimos guardar la plantilla del catalogo.");
    } finally {
      setSavingGlobalTemplateCode("");
    }
  }

  function addCustomGlobalDefinitionDraft() {
    if (!pool || !canManageSelectedPoolGlobalPredictions) {
      return;
    }

    const code = nextCustomGlobalPredictionCode(globalPredictionDefinitions, globalDefinitionDrafts);
    const sortOrder = nextGlobalPredictionSortOrder(globalPredictionDefinitions, globalDefinitionDrafts);
    const nextDefinition = globalCustomDefinition(pool.id, code, sortOrder);
    setGlobalPredictionDefinitions((current) => globalDefinitionsInOrder([...current, nextDefinition]));
    setGlobalDefinitionDrafts((current) => ({
      ...current,
      [code]: globalDefinitionDraft(nextDefinition),
    }));
    setMessage("Prediccion custom agregada. Completa el nombre y guarda la configuracion.");
  }

  function updateGlobalResultDraft(
    code: string,
    field: keyof GlobalPredictionDrafts[string],
    value: string,
  ) {
    setGlobalResultDrafts((current) => ({
      ...current,
      [code]: {
        ...emptyGlobalPredictionDraft(),
        ...current[code],
        [field]: value,
      },
    }));
  }

  async function saveGlobalPredictionDefinitions() {
    if (!session || !pool || !canManageSelectedPoolGlobalPredictions) {
      return;
    }

    const definitions = parseGlobalDefinitionDrafts(globalDefinitionDrafts);
    if (!definitions) {
      setMessage("Revisa la configuracion de predicciones globales.");
      return;
    }

    setSavingGlobalDefinitions(true);
    setMessage("");

    try {
      const client = createPollavarClient();
      const nextDefinitions = await client.updateGlobalPredictionDefinitions(session.token, pool.id, {
        definitions,
      });
      setGlobalPredictionDefinitions(nextDefinitions);
      setGlobalDefinitionDrafts(hydrateGlobalDefinitionDrafts(nextDefinitions));
      setGlobalResultDrafts((current) => ({
        ...hydrateGlobalResultDrafts(nextDefinitions, globalPredictionResults),
        ...current,
      }));
      void refreshGlobalPrizePreview(session.token, pool.id);
      setMessage("Predicciones globales actualizadas.");
    } catch (error) {
      if (isUnauthorized(error)) {
        signOutAdmin();
        return;
      }
      if (isForbidden(error)) {
        setMessage("No tienes permisos para configurar predicciones globales.");
        return;
      }
      if (error instanceof PollavarAPIError && error.code === "prediction_settings_locked") {
        setMessage(
          "No puedes cambiar el tipo de una prediccion global que ya tiene pronosticos o resultado.",
        );
        return;
      }
      setMessage("No pudimos actualizar las predicciones globales.");
    } finally {
      setSavingGlobalDefinitions(false);
    }
  }

  async function saveGlobalPredictionResult(definition: GlobalPredictionDefinition) {
    if (!session || !pool || !canManageSelectedPoolGlobalPredictions) {
      return;
    }
    if (!isGlobalDefinitionClosed(definition)) {
      setMessage("La prediccion global todavia no cerro.");
      return;
    }

    const draft = {
      ...emptyGlobalPredictionDraft(),
      ...globalResultDrafts[definition.code],
    };
    const input = globalPredictionInputFromDraft(definition, draft);
    if (!input) {
      setMessage("Revisa el resultado oficial global.");
      return;
    }

    setSavingGlobalResultCode(definition.code);
    setMessage("");

    try {
      const client = createPollavarClient();
      const result = await client.saveGlobalPredictionResult(
        session.token,
        pool.id,
        definition.code,
        input,
      );
      setGlobalPredictionResults((current) => upsertGlobalPredictionResult(current, result));
      setGlobalResultDrafts((current) => ({
        ...current,
        [definition.code]: globalPredictionDraft(result),
      }));
      void refreshGlobalPrizePreview(session.token, pool.id);
      setMessage("Resultado global actualizado.");
    } catch (error) {
      if (isUnauthorized(error)) {
        signOutAdmin();
        return;
      }
      if (isForbidden(error)) {
        setMessage("No tienes permisos para cargar resultados globales.");
        return;
      }
      if (error instanceof PollavarAPIError && error.code === "prediction_open") {
        setMessage("La prediccion global todavia no cerro.");
        return;
      }
      setMessage("No pudimos actualizar el resultado global.");
    } finally {
      setSavingGlobalResultCode("");
    }
  }

  async function saveUnderdogBonus(match: Match) {
    if (!session || !pool || !canManageSelectedPoolResults) {
      return;
    }

    const draft = {
      ...defaultUnderdogBonusDraft(),
      ...underdogBonusDrafts[match.id],
    };
    const parsedProbabilities = parseUnderdogProbabilities(draft);
    if (!parsedProbabilities) {
      setMessage("Revisa las probabilidades del bonus sorpresa.");
      return;
    }
    if (draft.enabled && !draft.outcome) {
      setMessage("Elige cual resultado es la sorpresa.");
      return;
    }

    setSavingBonusMatchID(match.id);
    setMessage("");

    try {
      const bonus = await createPollavarClient().saveMatchUnderdogBonus(
        session.token,
        pool.id,
        match.id,
        {
          enabled: draft.enabled,
          outcome: draft.enabled ? draft.outcome : "",
          ...parsedProbabilities,
        },
      );
      setUnderdogBonusDrafts((current) => ({
        ...current,
        [match.id]: underdogBonusDraft(bonus),
      }));
      setMessage("Bonus sorpresa actualizado.");
    } catch (error) {
      if (isUnauthorized(error)) {
        signOutAdmin();
        return;
      }
      if (isForbidden(error)) {
        setMessage("No tienes permisos para configurar bonus sorpresa.");
        return;
      }
      if (error instanceof PollavarAPIError && error.code === "prediction_closed") {
        setMessage("No puedes cambiar el bonus de un partido cerrado.");
        return;
      }
      setMessage("No pudimos actualizar el bonus sorpresa.");
    } finally {
      setSavingBonusMatchID("");
    }
  }

  async function savePoolTheme() {
    if (!session || !pool || !canManageSelectedPoolTheme) {
      return;
    }

    setSavingTheme(true);
    setMessage("");

    try {
      const updatedPool = await createPollavarClient().updatePoolTheme(session.token, pool.id, {
        display_name: themeDraft.displayName,
        logo_url: themeDraft.logoURL,
        banner_url: themeDraft.bannerURL,
        mascot_url: themeDraft.mascotURL,
        primary_color: themeDraft.primaryColor,
        secondary_color: themeDraft.secondaryColor,
        accent_color: themeDraft.accentColor,
      });
      setPool(updatedPool);
      setPools((current) =>
        current.map((item) => (item.id === updatedPool.id ? { ...item, ...updatedPool } : item)),
      );
      setThemeDraft(defaultThemeDraft(updatedPool));
      setMessage("Identidad visual actualizada.");
    } catch (error) {
      if (isUnauthorized(error)) {
        signOutAdmin();
        return;
      }
      if (isForbidden(error)) {
        setMessage("No tienes permisos para configurar la identidad visual.");
        return;
      }
      if (error instanceof PollavarAPIError && error.status === 400) {
        setMessage("Revisa los colores y URLs de la identidad visual.");
        return;
      }
      setMessage("No pudimos actualizar la identidad visual.");
    } finally {
      setSavingTheme(false);
    }
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

  async function refreshGlobalPrizePreview(token: string, poolID: string) {
    try {
      const nextGlobalPrizePreview =
        await createPollavarClient().getGlobalPredictionPrizePreview(token, poolID);
      setGlobalPrizePreview(nextGlobalPrizePreview);
    } catch (error) {
      if (isUnauthorized(error)) {
        signOutAdmin();
        return;
      }
      if (isForbidden(error)) {
        setMessage("No tienes permisos para ver premios globales de esta polla.");
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
      void refreshGlobalPrizePreview(session.token, pool.id);
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

    const underdogPoints = parseWholeNumber(predictionSettingsDraft.underdogBonusPoints);
    if (underdogPoints === null || underdogPoints > 1000) {
      setMessage("Revisa los puntos del bonus sorpresa.");
      return;
    }

    setSavingPredictionSettings(true);
    setMessage("");

    try {
      const client = createPollavarClient();
      let updatedPool = pool;
      if (
        predictionSettingsDraft.predictionMode !== pool.prediction_mode ||
        predictionSettingsDraft.matchResultScoringMode !== pool.match_result_scoring_mode
      ) {
        updatedPool = await client.updatePredictionSettings(session.token, pool.id, {
          prediction_mode: predictionSettingsDraft.predictionMode,
          match_result_scoring_mode: predictionSettingsDraft.matchResultScoringMode,
        });
        setPool(updatedPool);
        setPools((current) =>
          current.map((item) => (item.id === updatedPool.id ? { ...item, ...updatedPool } : item)),
        );
      }
      const nextScoringRules = await client.updateScoringRules(session.token, pool.id, {
        rules: scoringRulesWithUnderdog(scoringRules, {
          enabled: predictionSettingsDraft.underdogBonusEnabled,
          points: underdogPoints,
        }),
      });
      const nextEffectiveMatchSettings = await client.listEffectiveMatchPredictionSettings(
        session.token,
        pool.id,
      );
      setScoringRules(nextScoringRules);
      setEffectiveMatchSettings(nextEffectiveMatchSettings);
      setPredictionSettingsDraft(defaultPredictionSettingsDraft(updatedPool, nextScoringRules));
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

  async function savePredictionSettingsOverrides() {
    if (!session || !pool || !canManageSelectedPoolPredictionSettings) {
      return;
    }

    const overrides = parsePredictionSettingsOverrideDrafts(predictionSettingsOverrideDrafts);
    if (!overrides) {
      setMessage("Revisa los overrides de pronosticos.");
      return;
    }

    setSavingPredictionOverrides(true);
    setMessage("");

    try {
      const client = createPollavarClient();
      const nextOverrides = await client.updatePredictionSettingsOverrides(session.token, pool.id, {
        overrides,
      });
      const nextEffectiveMatchSettings = await client.listEffectiveMatchPredictionSettings(
        session.token,
        pool.id,
      );
      setPredictionSettingsOverrideDrafts(
        hydratePredictionSettingsOverrideDrafts(nextOverrides),
      );
      setEffectiveMatchSettings(nextEffectiveMatchSettings);
      setMessage("Overrides de pronosticos actualizados.");
    } catch (error) {
      if (isUnauthorized(error)) {
        signOutAdmin();
        return;
      }
      if (isForbidden(error)) {
        setMessage("No tienes permisos para configurar overrides de pronosticos.");
        return;
      }
      if (error instanceof PollavarAPIError && error.code === "prediction_settings_locked") {
        setMessage(
          "No pudimos cambiar overrides de modo porque la polla ya tiene pronosticos o resultados.",
        );
        return;
      }
      if (error instanceof PollavarAPIError && error.code === "prediction_closed") {
        setMessage("No puedes cambiar overrides de bonus en rondas o partidos cerrados.");
        return;
      }
      setMessage("No pudimos actualizar los overrides de pronosticos.");
    } finally {
      setSavingPredictionOverrides(false);
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
            <PoolThemeOverview
              onSelectPool={(nextPoolID) => {
                setSelectedPoolID(nextPoolID);
                void loadDashboard(session.token, session.user.id, nextPoolID);
              }}
              paymentCurrency={paymentCurrency}
              pool={pool}
              pools={pools}
              selectedPoolID={selectedPoolID}
              totals={totals}
            />

            {message ? (
              <p
                role={
                  message.includes("No pudimos") ||
                  message.includes("No tienes permisos") ||
                  message.includes("No puedes") ||
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
              <PoolThemePanel
                canManage={canManageSelectedPoolTheme}
                draft={themeDraft}
                onChange={setThemeDraft}
                onSave={() => void savePoolTheme()}
                saving={savingTheme}
              />
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
              <PredictionSettingsOverridesPanel
                canManage={canManageSelectedPoolPredictionSettings}
                drafts={predictionSettingsOverrideDrafts}
                effectiveSettingsByMatch={effectiveMatchSettingsByMatch}
                onChange={updatePredictionSettingsOverrideDraft}
                onClear={clearPredictionSettingsOverrideDraft}
                onSave={() => void savePredictionSettingsOverrides()}
                pool={pool}
                rows={predictionSettingsScopeRows}
                saving={savingPredictionOverrides}
              />
            ) : null}

            {pool ? (
              <GlobalPredictionAdminPanel
                canManage={canManageSelectedPoolGlobalPredictions}
                definitionDrafts={globalDefinitionDrafts}
                definitions={globalPredictionDefinitions}
                templates={globalPredictionTemplates}
                onAddCustomDefinition={addCustomGlobalDefinitionDraft}
                onAddReusableTemplate={addReusableGlobalTemplateDraft}
                onAddTemplate={addGlobalDefinitionTemplate}
                onSaveDefinitions={() => void saveGlobalPredictionDefinitions()}
                onSaveResult={(definition) => void saveGlobalPredictionResult(definition)}
                onSaveTemplate={(code) => void saveGlobalPredictionTemplate(code)}
                onUpdateDefinitionDraft={updateGlobalDefinitionDraft}
                onUpdateResultDraft={updateGlobalResultDraft}
                onUpdateTemplateDraft={updateGlobalTemplateDraft}
                resultDrafts={globalResultDrafts}
                results={globalPredictionResults}
                savingDefinitions={savingGlobalDefinitions}
                savingResultCode={savingGlobalResultCode}
                savingTemplateCode={savingGlobalTemplateCode}
                templateDrafts={globalTemplateDrafts}
                tournament={tournament}
              />
            ) : null}

            {pool ? (
              <ResultsPanel
                auditLogsByMatchID={resultAuditLogsByMatchID}
                bonusDrafts={underdogBonusDrafts}
                canManage={canManageSelectedPoolResults}
                groups={resultGroups}
                loadingAuditMatchID={loadingAuditMatchID}
                onSaveBonus={(match) => void saveUnderdogBonus(match)}
                onLoadAudit={(matchID) => void loadMatchResultAudit(matchID)}
                onSave={(match) => void saveMatchResult(match)}
                onUpdateBonusDraft={updateUnderdogBonusDraft}
                onUpdateDraft={updateResultDraft}
                predictionCloseHoursBefore={pool.prediction_close_hours_before}
                resultDrafts={resultDrafts}
                savingBonusMatchID={savingBonusMatchID}
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
                    <GlobalPrizePreviewBlock
                      currency={
                        globalPrizePreview?.currency ?? prizePreview?.currency ?? paymentCurrency
                      }
                      preview={globalPrizePreview}
                    />
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

function PoolThemeOverview({
  onSelectPool,
  paymentCurrency,
  pool,
  pools,
  selectedPoolID,
  totals,
}: {
  onSelectPool: (poolID: string) => void;
  paymentCurrency: string;
  pool: Pool | null;
  pools: Pool[];
  selectedPoolID: string;
  totals: ReturnType<typeof paymentTotals>;
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
          className="h-20 bg-cover bg-center"
          style={{ backgroundImage: `url(${JSON.stringify(theme.bannerURL)})` }}
        />
      ) : (
        <div aria-hidden="true" className="h-2" style={{ backgroundColor: theme.primaryColor }} />
      )}
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
          <ThemeLogo theme={theme} />
          <div>
            <label className="text-sm font-medium text-zinc-600" htmlFor="pool-select">
              Polla
            </label>
            <select
              id="pool-select"
              className="mt-2 min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 lg:min-w-80"
              value={selectedPoolID}
              onChange={(event) => onSelectPool(event.target.value)}
            >
              {pools.map((item) => (
                <option key={item.id} value={item.id}>
                  {poolDisplayName(item)}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm font-medium" style={{ color: theme.primaryColor }}>
              {pool ? poolDisplayName(pool) : "Sin polla seleccionada"}
            </p>
          </div>
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
  );
}

function PoolThemePanel({
  canManage,
  draft,
  onChange,
  onSave,
  saving,
}: {
  canManage: boolean;
  draft: ThemeDraft;
  onChange: (draft: ThemeDraft) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const update = (patch: Partial<ThemeDraft>) => onChange({ ...draft, ...patch });

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Identidad visual</h2>
          <p className="text-sm text-zinc-600">
            Logo, banner, mascota opcional y colores de la polla.
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

      <div className="grid gap-4 p-5 lg:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span>Nombre visible</span>
          <input
            className="min-h-10 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
            disabled={!canManage || saving}
            onChange={(event) => update({ displayName: event.target.value })}
            value={draft.displayName}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span>Logo URL</span>
          <input
            className="min-h-10 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
            disabled={!canManage || saving}
            onChange={(event) => update({ logoURL: event.target.value })}
            value={draft.logoURL}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span>Banner URL</span>
          <input
            className="min-h-10 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
            disabled={!canManage || saving}
            onChange={(event) => update({ bannerURL: event.target.value })}
            value={draft.bannerURL}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span>Mascota URL</span>
          <input
            className="min-h-10 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
            disabled={!canManage || saving}
            onChange={(event) => update({ mascotURL: event.target.value })}
            value={draft.mascotURL}
          />
        </label>
        <ColorField
          disabled={!canManage || saving}
          label="Color principal"
          onChange={(value) => update({ primaryColor: value })}
          value={draft.primaryColor}
        />
        <ColorField
          disabled={!canManage || saving}
          label="Color secundario"
          onChange={(value) => update({ secondaryColor: value })}
          value={draft.secondaryColor}
        />
        <ColorField
          disabled={!canManage || saving}
          label="Color acento"
          onChange={(value) => update({ accentColor: value })}
          value={draft.accentColor}
        />
        <div className="flex items-end">
          <button
            className="min-h-10 rounded-md bg-zinc-950 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            disabled={!canManage || saving}
            onClick={onSave}
            type="button"
          >
            {saving ? "Guardando" : "Guardar identidad"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ColorField({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="grid gap-2 text-sm font-medium text-zinc-700">
      <span>{label}</span>
      <span className="grid grid-cols-[44px_1fr] gap-2">
        <input
          aria-label={`${label} selector`}
          className="h-10 w-11 rounded-md border border-zinc-300 bg-white p-1 disabled:bg-zinc-100"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          type="color"
          value={colorPickerValue(value)}
        />
        <input
          aria-label={label}
          className="min-h-10 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      </span>
    </div>
  );
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

        <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-zinc-700">
          <input
            checked={draft.underdogBonusEnabled}
            className="h-4 w-4"
            disabled={!canManage || saving}
            onChange={(event) =>
              onChange({
                ...draft,
                underdogBonusEnabled: event.target.checked,
              })
            }
            type="checkbox"
          />
          <span>Bonus sorpresa</span>
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span>Puntos bonus</span>
          <input
            className="min-h-10 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
            disabled={!canManage || saving}
            min={0}
            onChange={(event) =>
              onChange({
                ...draft,
                underdogBonusPoints: event.target.value,
              })
            }
            step={1}
            type="number"
            value={draft.underdogBonusPoints}
          />
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

function PredictionSettingsOverridesPanel({
  canManage,
  drafts,
  effectiveSettingsByMatch,
  onChange,
  onClear,
  onSave,
  pool,
  rows,
  saving,
}: {
  canManage: boolean;
  drafts: PredictionSettingsOverrideDrafts;
  effectiveSettingsByMatch: Map<string, EffectiveMatchPredictionSettings>;
  onChange: (
    row: PredictionSettingsScopeRow,
    patch: Partial<PredictionSettingsOverrideDrafts[string]>,
  ) => void;
  onClear: (row: PredictionSettingsScopeRow) => void;
  onSave: () => void;
  pool: Pool;
  rows: PredictionSettingsScopeRow[];
  saving: boolean;
}) {
  const stageRows = rows.filter((row) => row.scopeType === "stage");
  const matchRows = rows.filter((row) => row.scopeType === "match");
  const activeOverrides = Object.values(drafts).filter(predictionSettingsOverrideDraftHasValue);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Overrides de pronostico</h2>
          <p className="text-sm text-zinc-600">
            Base: {predictionModeLabel(pool.prediction_mode)} -{" "}
            {matchResultScoringModeLabel(pool.match_result_scoring_mode)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
            {activeOverrides.length} activos
          </span>
          <span
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              canManage ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            }`}
          >
            {canManage ? "Configurable" : "Solo lectura"}
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-5 text-sm text-zinc-600">Sin fixture disponible para esta polla.</div>
      ) : (
        <div className="grid gap-5 p-5">
          <PredictionSettingsOverrideTable
            canManage={canManage}
            drafts={drafts}
            effectiveSettingsByMatch={effectiveSettingsByMatch}
            onChange={onChange}
            onClear={onClear}
            rows={stageRows}
            saving={saving}
            title="Rondas"
          />
          <PredictionSettingsOverrideTable
            canManage={canManage}
            drafts={drafts}
            effectiveSettingsByMatch={effectiveSettingsByMatch}
            onChange={onChange}
            onClear={onClear}
            rows={matchRows}
            saving={saving}
            title="Partidos"
          />
          <div className="flex justify-end">
            <button
              className="min-h-10 rounded-md bg-zinc-950 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              disabled={!canManage || saving}
              onClick={onSave}
              type="button"
            >
              {saving ? "Guardando" : "Guardar overrides"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function PredictionSettingsOverrideTable({
  canManage,
  drafts,
  effectiveSettingsByMatch,
  onChange,
  onClear,
  rows,
  saving,
  title,
}: {
  canManage: boolean;
  drafts: PredictionSettingsOverrideDrafts;
  effectiveSettingsByMatch: Map<string, EffectiveMatchPredictionSettings>;
  onChange: (
    row: PredictionSettingsScopeRow,
    patch: Partial<PredictionSettingsOverrideDrafts[string]>,
  ) => void;
  onClear: (row: PredictionSettingsScopeRow) => void;
  rows: PredictionSettingsScopeRow[];
  saving: boolean;
  title: string;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-zinc-950">{title}</h3>
      <div className="overflow-x-auto rounded-md border border-zinc-200">
        <table className="min-w-[1120px] w-full border-collapse text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Alcance</th>
              <th className="px-4 py-3 font-semibold">Modo</th>
              <th className="px-4 py-3 font-semibold">Puntaje</th>
              <th className="px-4 py-3 font-semibold">Bonus</th>
              <th className="px-4 py-3 font-semibold">Puntos</th>
              <th className="px-4 py-3 font-semibold">Efectivo</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {rows.map((row) => {
              const draft = {
                ...defaultPredictionSettingsOverrideDraft(row),
                ...drafts[row.key],
              };
              const disabled = !canManage || saving;

              return (
                <tr className="align-top" key={row.key}>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-zinc-950">{row.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">{row.subtitle}</p>
                  </td>
                  <td className="px-4 py-4">
                    <select
                      aria-label={`Modo ${row.title}`}
                      className="min-h-9 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-950 disabled:bg-zinc-100"
                      disabled={disabled}
                      onChange={(event) =>
                        onChange(row, {
                          predictionMode: event.target.value as PredictionMode | "",
                        })
                      }
                      value={draft.predictionMode}
                    >
                      <option value="">Heredar</option>
                      {predictionModeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-4">
                    <select
                      aria-label={`Puntaje ${row.title}`}
                      className="min-h-9 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-950 disabled:bg-zinc-100"
                      disabled={disabled}
                      onChange={(event) =>
                        onChange(row, {
                          matchResultScoringMode: event.target.value as
                            | MatchResultScoringMode
                            | "",
                        })
                      }
                      value={draft.matchResultScoringMode}
                    >
                      <option value="">Heredar</option>
                      {matchResultScoringModeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-4">
                    <select
                      aria-label={`Bonus ${row.title}`}
                      className="min-h-9 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-950 disabled:bg-zinc-100"
                      disabled={disabled}
                      onChange={(event) =>
                        onChange(row, {
                          underdogBonusEnabled: event.target
                            .value as PredictionSettingsOverrideDrafts[string]["underdogBonusEnabled"],
                        })
                      }
                      value={draft.underdogBonusEnabled}
                    >
                      <option value="inherit">Heredar</option>
                      <option value="enabled">Activo</option>
                      <option value="disabled">Inactivo</option>
                    </select>
                  </td>
                  <td className="px-4 py-4">
                    <input
                      aria-label={`Puntos bonus ${row.title}`}
                      className="min-h-9 w-24 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-950 disabled:bg-zinc-100"
                      disabled={disabled}
                      min={0}
                      onChange={(event) =>
                        onChange(row, {
                          underdogBonusPoints: event.target.value,
                        })
                      }
                      step={1}
                      type="number"
                      value={draft.underdogBonusPoints}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-xs text-zinc-600">
                      {predictionSettingsEffectiveSummary(row, effectiveSettingsByMatch)}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-400 disabled:cursor-not-allowed disabled:text-zinc-400"
                      disabled={disabled || !predictionSettingsOverrideDraftHasValue(draft)}
                      onClick={() => onClear(row)}
                      type="button"
                    >
                      Limpiar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GlobalPredictionAdminPanel({
  canManage,
  definitionDrafts,
  definitions,
  templates,
  onAddCustomDefinition,
  onAddReusableTemplate,
  onAddTemplate,
  onSaveDefinitions,
  onSaveResult,
  onSaveTemplate,
  onUpdateDefinitionDraft,
  onUpdateResultDraft,
  onUpdateTemplateDraft,
  resultDrafts,
  results,
  savingDefinitions,
  savingResultCode,
  savingTemplateCode,
  templateDrafts,
  tournament,
}: {
  canManage: boolean;
  definitionDrafts: GlobalPredictionDefinitionDrafts;
  definitions: GlobalPredictionDefinition[];
  templates: GlobalPredictionTemplate[];
  onAddCustomDefinition: () => void;
  onAddReusableTemplate: () => void;
  onAddTemplate: (template: GlobalPredictionTemplate) => void;
  onSaveDefinitions: () => void;
  onSaveResult: (definition: GlobalPredictionDefinition) => void;
  onSaveTemplate: (code: string) => void;
  onUpdateDefinitionDraft: (
    code: string,
    patch: Partial<GlobalPredictionDefinitionDrafts[string]>,
  ) => void;
  onUpdateResultDraft: (
    code: string,
    field: keyof GlobalPredictionDrafts[string],
    value: string,
  ) => void;
  onUpdateTemplateDraft: (
    code: string,
    patch: Partial<GlobalPredictionTemplateDrafts[string]>,
  ) => void;
  resultDrafts: GlobalPredictionDrafts;
  results: GlobalPredictionResult[];
  savingDefinitions: boolean;
  savingResultCode: string;
  savingTemplateCode: string;
  templateDrafts: GlobalPredictionTemplateDrafts;
  tournament: Tournament | null;
}) {
  const sortedDefinitions = globalDefinitionsInOrder(definitions);
  const enabledDefinitions = sortedDefinitions.filter((definition) => definition.enabled);
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedTemplateCode, setSelectedTemplateCode] = useState("");
  const configuredCodes = new Set(sortedDefinitions.map((definition) => definition.code));
  const normalizedTemplateSearch = templateSearch.trim().toLowerCase();
  const availableTemplates = templates.filter(
    (template) =>
      template.enabled &&
      !configuredCodes.has(template.code) &&
      (!normalizedTemplateSearch ||
        template.label.toLowerCase().includes(normalizedTemplateSearch) ||
        template.code.toLowerCase().includes(normalizedTemplateSearch) ||
        template.category.toLowerCase().includes(normalizedTemplateSearch) ||
        globalTemplateSportLabel(template.sport).toLowerCase().includes(normalizedTemplateSearch)),
  );
  const selectedTemplate =
    availableTemplates.find((template) => template.code === selectedTemplateCode) ?? null;
  const resultsByCode = indexGlobalPredictionResults(results);
  const teamOptions = tournamentTeamOptions(tournament);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Predicciones globales</h2>
          <p className="text-sm text-zinc-600">
            {enabledDefinitions.length} activas de {sortedDefinitions.length} configuradas.
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

      {canManage ? (
        <GlobalTemplateCatalogPanel
          drafts={templateDrafts}
          onAddTemplate={onAddReusableTemplate}
          onSaveTemplate={onSaveTemplate}
          onUpdateDraft={onUpdateTemplateDraft}
          savingTemplateCode={savingTemplateCode}
          templates={templates}
        />
      ) : null}

      {canManage ? (
        <div className="grid gap-3 border-b border-zinc-200 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-end">
          <label className="grid gap-2 text-sm font-medium text-zinc-700">
            <span>Buscar</span>
            <input
              className="min-h-10 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
              disabled={savingDefinitions || templates.length === 0}
              onChange={(event) => setTemplateSearch(event.target.value)}
              placeholder="Nombre o codigo"
              value={templateSearch}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-zinc-700">
            <span>Plantilla</span>
            <select
              className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
              disabled={savingDefinitions || availableTemplates.length === 0}
              onChange={(event) => setSelectedTemplateCode(event.target.value)}
              value={selectedTemplateCode}
            >
              <option value="">
                {availableTemplates.length === 0 ? "Sin plantillas disponibles" : "Elegir plantilla"}
              </option>
              {availableTemplates.map((template) => (
                <option key={template.code} value={template.code}>
                  {template.label} ({globalTemplateSportLabel(template.sport)})
                </option>
              ))}
            </select>
          </label>
          <button
            className="min-h-10 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
            disabled={!selectedTemplate || savingDefinitions}
            onClick={() => {
              if (!selectedTemplate) {
                return;
              }
              onAddTemplate(selectedTemplate);
              setSelectedTemplateCode("");
            }}
            type="button"
          >
            Agregar
          </button>
          <button
            className="min-h-10 rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            disabled={savingDefinitions}
            onClick={onAddCustomDefinition}
            type="button"
          >
            Nueva custom
          </button>
        </div>
      ) : null}

      {sortedDefinitions.length === 0 ? (
        <div className="p-5 text-sm text-zinc-600">
          Esta polla aun no tiene predicciones globales inicializadas.
        </div>
      ) : (
        <div className="space-y-5 p-5">
          <div className="overflow-x-auto">
            <table className="min-w-[1300px] w-full border-collapse text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Activa</th>
                  <th className="px-4 py-3 font-semibold">Pronostico</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Puntos</th>
                  <th className="px-4 py-3 font-semibold">Premio</th>
                  <th className="px-4 py-3 font-semibold">Orden</th>
                  <th className="px-4 py-3 font-semibold">Cierre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {sortedDefinitions.map((definition) => {
                  const draft = {
                    ...globalDefinitionDraft(definition),
                    ...definitionDrafts[definition.code],
                  };

                  return (
                    <tr key={definition.code} className="align-top">
                      <td className="px-4 py-4">
                        <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                          <input
                            aria-label={`Activar ${definition.label}`}
                            checked={draft.enabled}
                            className="h-4 w-4"
                            disabled={!canManage || savingDefinitions}
                            onChange={(event) =>
                              onUpdateDefinitionDraft(definition.code, {
                                enabled: event.target.checked,
                              })
                            }
                            type="checkbox"
                          />
                          <span>Activa</span>
                        </label>
                      </td>
                      <td className="px-4 py-4">
                        <label className="sr-only" htmlFor={`global-label-${definition.code}`}>
                          Nombre de {definition.label}
                        </label>
                        <input
                          id={`global-label-${definition.code}`}
                          className="min-h-10 w-64 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
                          disabled={!canManage || savingDefinitions}
                          onChange={(event) =>
                            onUpdateDefinitionDraft(definition.code, {
                              label: event.target.value,
                            })
                          }
                          value={draft.label}
                        />
                        <p className="mt-1 text-xs text-zinc-500">{definition.code}</p>
                      </td>
                      <td className="px-4 py-4">
                        <label className="sr-only" htmlFor={`global-type-${definition.code}`}>
                          Tipo de {definition.label}
                        </label>
                        <select
                          id={`global-type-${definition.code}`}
                          className="min-h-10 w-40 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
                          disabled={!canManage || savingDefinitions}
                          onChange={(event) =>
                            onUpdateDefinitionDraft(definition.code, {
                              valueType: event.target.value as GlobalPredictionValueType,
                            })
                          }
                          value={draft.valueType}
                        >
                          {globalPredictionValueTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                            <input
                              aria-label={`Puntua ${definition.label}`}
                              checked={draft.pointsEnabled}
                              className="h-4 w-4"
                              disabled={!canManage || savingDefinitions}
                              onChange={(event) =>
                                onUpdateDefinitionDraft(definition.code, {
                                  pointsEnabled: event.target.checked,
                                })
                              }
                              type="checkbox"
                            />
                            <span>Si</span>
                          </label>
                          <label className="sr-only" htmlFor={`global-points-${definition.code}`}>
                            Puntos de {definition.label}
                          </label>
                          <input
                            id={`global-points-${definition.code}`}
                            className="min-h-10 w-20 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
                            disabled={!canManage || savingDefinitions || !draft.pointsEnabled}
                            min={0}
                            onChange={(event) =>
                              onUpdateDefinitionDraft(definition.code, {
                                points: event.target.value,
                              })
                            }
                            step={1}
                            type="number"
                            value={draft.points}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="grid gap-2">
                          <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                            <input
                              aria-label={`Premio especial ${definition.label}`}
                              checked={draft.prizeEnabled}
                              className="h-4 w-4"
                              disabled={!canManage || savingDefinitions}
                              onChange={(event) =>
                                onUpdateDefinitionDraft(definition.code, {
                                  prizeEnabled: event.target.checked,
                                  prizeType: event.target.checked
                                    ? draft.prizeType === "none"
                                      ? "fixed"
                                      : draft.prizeType
                                    : "none",
                                })
                              }
                              type="checkbox"
                            />
                            <span>Especial</span>
                          </label>
                          <div className="grid gap-2 sm:grid-cols-[112px_120px]">
                            <label
                              className="sr-only"
                              htmlFor={`global-prize-type-${definition.code}`}
                            >
                              Tipo de premio de {definition.label}
                            </label>
                            <select
                              id={`global-prize-type-${definition.code}`}
                              className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
                              disabled={!canManage || savingDefinitions || !draft.prizeEnabled}
                              onChange={(event) =>
                                onUpdateDefinitionDraft(definition.code, {
                                  prizeType: event.target.value as GlobalPredictionPrizeType,
                                })
                              }
                              value={draft.prizeType === "none" ? "fixed" : draft.prizeType}
                            >
                              <option value="fixed">Monto</option>
                              <option value="percentage">%</option>
                            </select>
                            <label
                              className="sr-only"
                              htmlFor={`global-prize-amount-${definition.code}`}
                            >
                              Valor de premio de {definition.label}
                            </label>
                            <input
                              id={`global-prize-amount-${definition.code}`}
                              className="min-h-10 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
                              disabled={!canManage || savingDefinitions || !draft.prizeEnabled}
                              inputMode="decimal"
                              onChange={(event) =>
                                onUpdateDefinitionDraft(definition.code, {
                                  [draft.prizeType === "percentage"
                                    ? "prizePercentage"
                                    : "prizeFixedAmount"]: event.target.value,
                                })
                              }
                              placeholder={
                                draft.prizeType === "percentage" ? "Porcentaje" : "Monto"
                              }
                              value={
                                draft.prizeType === "percentage"
                                  ? draft.prizePercentage
                                  : draft.prizeFixedAmount
                              }
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <label className="sr-only" htmlFor={`global-order-${definition.code}`}>
                          Orden de {definition.label}
                        </label>
                        <input
                          id={`global-order-${definition.code}`}
                          className="min-h-10 w-20 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
                          disabled={!canManage || savingDefinitions}
                          min={0}
                          onChange={(event) =>
                            onUpdateDefinitionDraft(definition.code, {
                              sortOrder: event.target.value,
                            })
                          }
                          step={1}
                          type="number"
                          value={draft.sortOrder}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <label className="sr-only" htmlFor={`global-closes-${definition.code}`}>
                          Cierre de {definition.label}
                        </label>
                        <input
                          id={`global-closes-${definition.code}`}
                          className="min-h-10 w-52 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
                          disabled={!canManage || savingDefinitions}
                          onChange={(event) =>
                            onUpdateDefinitionDraft(definition.code, {
                              closesAt: event.target.value,
                            })
                          }
                          type="datetime-local"
                          value={draft.closesAt}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button
              className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              disabled={!canManage || savingDefinitions}
              onClick={onSaveDefinitions}
              type="button"
            >
              {savingDefinitions ? "Guardando" : "Guardar predicciones globales"}
            </button>
          </div>

          <div className="border-t border-zinc-200 pt-5">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-zinc-950">
                Resultados globales oficiales
              </h3>
              <p className="text-sm text-zinc-600">
                Los resultados por rango se cargan como numero real final.
              </p>
            </div>

            {enabledDefinitions.length === 0 ? (
              <p className="text-sm text-zinc-600">
                Activa al menos una prediccion global para cargar resultados.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {enabledDefinitions.map((definition) => {
                  const result = resultsByCode.get(definition.code);
                  const draft = {
                    ...emptyGlobalPredictionDraft(),
                    ...globalPredictionDraft(result),
                    ...resultDrafts[definition.code],
                  };
                  const closed = isGlobalDefinitionClosed(definition);
                  const isSavingResult = savingResultCode === definition.code;
                  const canSaveResult = canManage && closed;

                  return (
                    <div
                      key={definition.code}
                      className="rounded-lg border border-zinc-200 p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-zinc-950">{definition.label}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {globalValueTypeLabel(definition.value_type)} -{" "}
                            {definition.points_enabled
                              ? `${definition.points} pts`
                              : "Sin puntos"}
                            {definition.prize_enabled ? " - premio especial" : ""}
                          </p>
                        </div>
                        <span
                          className={`w-fit rounded-md px-2 py-1 text-xs font-medium ${
                            closed ? "bg-zinc-100 text-zinc-700" : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {result ? "Con resultado" : globalDefinitionCloseStatus(definition)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                        <GlobalResultInput
                          definition={definition}
                          disabled={!canSaveResult || isSavingResult}
                          draft={draft}
                          onUpdate={(field, value) =>
                            onUpdateResultDraft(definition.code, field, value)
                          }
                          teamOptions={teamOptions}
                        />
                        <button
                          aria-label={`Guardar resultado ${definition.label}`}
                          className="min-h-10 rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                          disabled={!canSaveResult || isSavingResult}
                          onClick={() => onSaveResult(definition)}
                          type="button"
                        >
                          {isSavingResult ? "Guardando" : "Guardar resultado"}
                        </button>
                      </div>

                      {result ? (
                        <p className="mt-3 text-xs text-zinc-500">
                          Actual:{" "}
                          <span className="font-medium text-zinc-700">
                            {globalValueLabel(result, teamOptions)}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function GlobalTemplateCatalogPanel({
  drafts,
  onAddTemplate,
  onSaveTemplate,
  onUpdateDraft,
  savingTemplateCode,
  templates,
}: {
  drafts: GlobalPredictionTemplateDrafts;
  onAddTemplate: () => void;
  onSaveTemplate: (code: string) => void;
  onUpdateDraft: (
    code: string,
    patch: Partial<GlobalPredictionTemplateDrafts[string]>,
  ) => void;
  savingTemplateCode: string;
  templates: GlobalPredictionTemplate[];
}) {
  const sortedTemplates = globalTemplatesInOrder(templates);

  return (
    <div className="border-b border-zinc-200 px-5 py-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">Catalogo de plantillas</h3>
          <p className="text-sm text-zinc-600">
            {sortedTemplates.filter((template) => template.enabled).length} activas de{" "}
            {sortedTemplates.length}.
          </p>
        </div>
        <button
          className="min-h-10 w-fit rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          disabled={Boolean(savingTemplateCode)}
          onClick={onAddTemplate}
          type="button"
        >
          Nueva plantilla
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Activa</th>
              <th className="px-4 py-3 font-semibold">Codigo</th>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Deporte</th>
              <th className="px-4 py-3 font-semibold">Categoria</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Puntos</th>
              <th className="px-4 py-3 font-semibold">Premio</th>
              <th className="px-4 py-3 font-semibold">Default</th>
              <th className="px-4 py-3 font-semibold">Orden</th>
              <th className="px-4 py-3 font-semibold">Accion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {sortedTemplates.map((template) => {
              const draft = {
                ...globalTemplateDraft(template),
                ...drafts[template.code],
              };
              const isSaving = savingTemplateCode === template.code;
              const canEditCode = isDraftGlobalTemplate(template);

              return (
                <tr key={template.code} className="align-top">
                  <td className="px-4 py-4">
                    <input
                      aria-label={`Activar plantilla ${template.label}`}
                      checked={draft.enabled}
                      className="h-4 w-4"
                      disabled={isSaving}
                      onChange={(event) =>
                        onUpdateDraft(template.code, { enabled: event.target.checked })
                      }
                      type="checkbox"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      aria-label={`Codigo plantilla ${template.label}`}
                      className="min-h-10 w-44 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
                      disabled={isSaving || !canEditCode}
                      onChange={(event) =>
                        onUpdateDraft(template.code, { code: event.target.value })
                      }
                      value={draft.code}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      aria-label={`Nombre plantilla ${template.label}`}
                      className="min-h-10 w-52 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
                      disabled={isSaving}
                      onChange={(event) =>
                        onUpdateDraft(template.code, { label: event.target.value })
                      }
                      value={draft.label}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      aria-label={`Deporte plantilla ${template.label}`}
                      className="min-h-10 w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
                      disabled={isSaving}
                      onChange={(event) =>
                        onUpdateDraft(template.code, { sport: event.target.value })
                      }
                      value={draft.sport}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      aria-label={`Categoria plantilla ${template.label}`}
                      className="min-h-10 w-36 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
                      disabled={isSaving}
                      onChange={(event) =>
                        onUpdateDraft(template.code, { category: event.target.value })
                      }
                      value={draft.category}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <select
                      aria-label={`Tipo plantilla ${template.label}`}
                      className="min-h-10 w-36 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
                      disabled={isSaving}
                      onChange={(event) =>
                        onUpdateDraft(template.code, {
                          valueType: event.target.value as GlobalPredictionValueType,
                        })
                      }
                      value={draft.valueType}
                    >
                      {globalPredictionValueTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <input
                        aria-label={`Puntua plantilla ${template.label}`}
                        checked={draft.pointsEnabled}
                        className="h-4 w-4"
                        disabled={isSaving}
                        onChange={(event) =>
                          onUpdateDraft(template.code, { pointsEnabled: event.target.checked })
                        }
                        type="checkbox"
                      />
                      <input
                        aria-label={`Puntos plantilla ${template.label}`}
                        className="min-h-10 w-20 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
                        disabled={isSaving || !draft.pointsEnabled}
                        min={0}
                        onChange={(event) =>
                          onUpdateDraft(template.code, { points: event.target.value })
                        }
                        step={1}
                        type="number"
                        value={draft.points}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <input
                      aria-label={`Premio plantilla ${template.label}`}
                      checked={draft.prizeEnabled}
                      className="h-4 w-4"
                      disabled={isSaving}
                      onChange={(event) =>
                        onUpdateDraft(template.code, { prizeEnabled: event.target.checked })
                      }
                      type="checkbox"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      aria-label={`Default plantilla ${template.label}`}
                      checked={draft.defaultEnabled}
                      className="h-4 w-4"
                      disabled={isSaving}
                      onChange={(event) =>
                        onUpdateDraft(template.code, { defaultEnabled: event.target.checked })
                      }
                      type="checkbox"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      aria-label={`Orden plantilla ${template.label}`}
                      className="min-h-10 w-20 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
                      disabled={isSaving}
                      min={0}
                      onChange={(event) =>
                        onUpdateDraft(template.code, { sortOrder: event.target.value })
                      }
                      step={1}
                      type="number"
                      value={draft.sortOrder}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <button
                      aria-label={`Guardar plantilla ${template.label}`}
                      className="min-h-10 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                      disabled={isSaving}
                      onClick={() => onSaveTemplate(template.code)}
                      type="button"
                    >
                      {isSaving ? "Guardando" : "Guardar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GlobalResultInput({
  definition,
  disabled,
  draft,
  onUpdate,
  teamOptions,
}: {
  definition: GlobalPredictionDefinition;
  disabled: boolean;
  draft: GlobalPredictionDrafts[string];
  onUpdate: (field: keyof GlobalPredictionDrafts[string], value: string) => void;
  teamOptions: TournamentTeamOption[];
}) {
  if (definition.value_type === "team" && teamOptions.length > 0) {
    return (
      <label className="grid gap-2 text-sm font-medium text-zinc-700">
        <span>Equipo</span>
        <select
          aria-label={`Resultado oficial ${definition.label}`}
          className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
          disabled={disabled}
          onChange={(event) => onUpdate("valueText", event.target.value)}
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

  if (definition.value_type === "number" || definition.value_type === "number_range") {
    return (
      <label className="grid gap-2 text-sm font-medium text-zinc-700">
        <span>
          {definition.value_type === "number_range" ? "Resultado exacto" : "Numero oficial"}
        </span>
        <input
          aria-label={`Resultado oficial ${definition.label}`}
          className="min-h-10 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
          disabled={disabled}
          min={0}
          onChange={(event) => onUpdate("valueNumber", event.target.value)}
          step={1}
          type="number"
          value={draft.valueNumber}
        />
      </label>
    );
  }

  return (
    <label className="grid gap-2 text-sm font-medium text-zinc-700">
      <span>{globalValueTypeLabel(definition.value_type)}</span>
      <input
        aria-label={`Resultado oficial ${definition.label}`}
        className="min-h-10 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 disabled:bg-zinc-100"
        disabled={disabled}
        onChange={(event) => onUpdate("valueText", event.target.value)}
        value={draft.valueText}
      />
    </label>
  );
}

function ResultsPanel({
  auditLogsByMatchID,
  bonusDrafts,
  canManage,
  groups,
  loadingAuditMatchID,
  onSaveBonus,
  onLoadAudit,
  onSave,
  onUpdateBonusDraft,
  onUpdateDraft,
  predictionCloseHoursBefore,
  resultDrafts,
  savingBonusMatchID,
  savingMatchID,
  statusesByMatch,
}: {
  auditLogsByMatchID: Record<string, MatchResultAuditLog[]>;
  bonusDrafts: UnderdogBonusDrafts;
  canManage: boolean;
  groups: ResultMatchGroup[];
  loadingAuditMatchID: string;
  onSaveBonus: (match: Match) => void;
  onLoadAudit: (matchID: string) => void;
  onSave: (match: Match) => void;
  onUpdateBonusDraft: (matchID: string, patch: Partial<UnderdogBonusDrafts[string]>) => void;
  onUpdateDraft: (matchID: string, side: "home" | "away", value: string) => void;
  predictionCloseHoursBefore: number;
  resultDrafts: ResultDrafts;
  savingBonusMatchID: string;
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
                <table className="min-w-[1220px] w-full border-collapse text-left text-sm">
                  <thead className="bg-white text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Partido</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                      <th className="px-4 py-3 font-semibold">Sorpresa</th>
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
                      const isSavingBonus = savingBonusMatchID === match.id;
                      const isLoadingAudit = loadingAuditMatchID === match.id;
                      const bonusDraft = {
                        ...defaultUnderdogBonusDraft(),
                        ...bonusDrafts[match.id],
                      };

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
                            <div className="grid gap-2">
                              <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                                <input
                                  checked={bonusDraft.enabled}
                                  className="h-4 w-4"
                                  disabled={!canManage || closed || isSavingBonus}
                                  onChange={(event) =>
                                    onUpdateBonusDraft(match.id, {
                                      enabled: event.target.checked,
                                    })
                                  }
                                  type="checkbox"
                                />
                                <span>Activo</span>
                              </label>
                              <select
                                aria-label={`Sorpresa ${homeName} vs ${awayName}`}
                                className="min-h-9 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-950 disabled:bg-zinc-100"
                                disabled={!canManage || closed || !bonusDraft.enabled || isSavingBonus}
                                onChange={(event) =>
                                  onUpdateBonusDraft(match.id, {
                                    outcome: event.target.value as MatchOutcome | "",
                                  })
                                }
                                value={bonusDraft.outcome}
                              >
                                <option value="">Elegir</option>
                                <option value="home">Local</option>
                                <option value="draw">Empate</option>
                                <option value="away">Visitante</option>
                              </select>
                              <div className="grid grid-cols-3 gap-1">
                                <input
                                  aria-label={`Probabilidad local ${homeName}`}
                                  className="min-h-8 rounded-md border border-zinc-300 px-2 text-xs"
                                  disabled={!canManage || closed || isSavingBonus}
                                  onChange={(event) =>
                                    onUpdateBonusDraft(match.id, {
                                      homeProbability: event.target.value,
                                    })
                                  }
                                  placeholder="L %"
                                  type="number"
                                  value={bonusDraft.homeProbability}
                                />
                                <input
                                  aria-label={`Probabilidad empate ${homeName} vs ${awayName}`}
                                  className="min-h-8 rounded-md border border-zinc-300 px-2 text-xs"
                                  disabled={!canManage || closed || isSavingBonus}
                                  onChange={(event) =>
                                    onUpdateBonusDraft(match.id, {
                                      drawProbability: event.target.value,
                                    })
                                  }
                                  placeholder="E %"
                                  type="number"
                                  value={bonusDraft.drawProbability}
                                />
                                <input
                                  aria-label={`Probabilidad visitante ${awayName}`}
                                  className="min-h-8 rounded-md border border-zinc-300 px-2 text-xs"
                                  disabled={!canManage || closed || isSavingBonus}
                                  onChange={(event) =>
                                    onUpdateBonusDraft(match.id, {
                                      awayProbability: event.target.value,
                                    })
                                  }
                                  placeholder="V %"
                                  type="number"
                                  value={bonusDraft.awayProbability}
                                />
                              </div>
                              <button
                                className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-400 disabled:cursor-not-allowed disabled:text-zinc-400"
                                disabled={!canManage || closed || isSavingBonus}
                                onClick={() => onSaveBonus(match)}
                                type="button"
                              >
                                {isSavingBonus ? "Guardando" : "Guardar bonus"}
                              </button>
                            </div>
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

function GlobalPrizePreviewBlock({
  currency,
  preview,
}: {
  currency: string;
  preview: GlobalPredictionPrizePreview | null;
}) {
  const prizes = preview?.prizes ?? [];

  return (
    <div className="rounded-lg border border-zinc-200">
      <div className="border-b border-zinc-200 px-4 py-3">
        <p className="text-sm font-semibold text-zinc-950">Premios globales</p>
        <p className="text-xs text-zinc-500">
          Bolsa base: {formatMoney(preview?.confirmed_total_cents ?? 0, currency)}
        </p>
      </div>
      <div className="divide-y divide-zinc-200">
        {prizes.length === 0 ? (
          <p className="px-4 py-3 text-sm text-zinc-600">
            Sin premios especiales configurados.
          </p>
        ) : (
          prizes.map((prize) => (
            <div key={prize.code} className="px-4 py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-zinc-950">{prize.label}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {globalPrizeTypeLabel(prize.prize_type, prize.prize_percentage, currency)}
                    {" · "}
                    {prize.result_recorded
                      ? `${prize.winners.length} ganador(es)`
                      : "Sin resultado oficial"}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-zinc-950">
                  {formatMoney(prize.estimated_total_cents, currency)}
                </p>
              </div>
              {prize.result_recorded ? (
                prize.winners.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {prize.winners.map((winner) => (
                      <div
                        key={`${prize.code}-${winner.user_id}`}
                        className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2"
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
          ))
        )}
      </div>
    </div>
  );
}

function globalPrizeTypeLabel(
  prizeType: GlobalPredictionPrizeType,
  percentage: number,
  currency: string,
) {
  if (prizeType === "percentage") {
    return `${formatPercentageInput(percentage)}% de la bolsa`;
  }
  if (prizeType === "fixed") {
    return `Monto fijo en ${currency}`;
  }
  return "Sin premio";
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

function canManageTheme(pool: Pool) {
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

function defaultPredictionSettingsDraft(
  pool: Pool | null,
  rules: ScoringRule[],
): PredictionSettingsDraft {
  const underdogRule = scoringRuleByCode(rules, "underdog_bonus");

  return {
    predictionMode: pool?.prediction_mode ?? "score_with_outcome",
    matchResultScoringMode: pool?.match_result_scoring_mode ?? "exclusive",
    underdogBonusEnabled: underdogRule?.enabled ?? false,
    underdogBonusPoints: String(underdogRule?.points ?? 2),
  };
}

function predictionSettingsScopeRowsForMatches(matches: Match[]) {
  const sortedMatches = [...matches].sort((left, right) => left.match_number - right.match_number);
  const stagesByID = new Map<string, PredictionSettingsScopeRow>();
  const matchRows: PredictionSettingsScopeRow[] = [];

  for (const match of sortedMatches) {
    const stageID = match.stage_id.trim();
    if (stageID) {
      const existingStage = stagesByID.get(stageID);
      if (existingStage) {
        existingStage.matchIDs.push(match.id);
      } else {
        stagesByID.set(stageID, {
          key: predictionSettingsScopeKey("stage", stageID),
          scopeType: "stage",
          stageID,
          matchID: "",
          title: stageLabel(stageID),
          subtitle: "",
          matchIDs: [match.id],
        });
      }
    }

    const homeName = matchTeamName(match, "home");
    const awayName = matchTeamName(match, "away");
    matchRows.push({
      key: predictionSettingsScopeKey("match", match.id),
      scopeType: "match",
      stageID,
      matchID: match.id,
      title: `${homeName} vs ${awayName}`,
      subtitle: `Partido ${match.match_number} - ${stageLabel(stageID)}`,
      matchIDs: [match.id],
    });
  }

  const stageRows = [...stagesByID.values()].map((row) => ({
    ...row,
    subtitle: `${row.matchIDs.length} partidos`,
  }));

  return [...stageRows, ...matchRows];
}

function predictionSettingsScopeKey(
  scopeType: PredictionSettingsOverrideScope,
  id: string,
) {
  return `${scopeType}:${id}`;
}

function defaultPredictionSettingsOverrideDraft(
  row: PredictionSettingsScopeRow,
): PredictionSettingsOverrideDrafts[string] {
  return {
    scopeType: row.scopeType,
    stageID: row.stageID,
    matchID: row.matchID,
    predictionMode: "",
    matchResultScoringMode: "",
    underdogBonusEnabled: "inherit",
    underdogBonusPoints: "",
  };
}

function hydratePredictionSettingsOverrideDrafts(
  overrides: PredictionSettingsOverride[],
) {
  const drafts: PredictionSettingsOverrideDrafts = {};
  for (const override of overrides) {
    const id = override.scope_type === "stage" ? override.stage_id : override.match_id;
    if (!id) {
      continue;
    }
    const key = predictionSettingsScopeKey(override.scope_type, id);
    drafts[key] = predictionSettingsOverrideDraft(override);
  }
  return drafts;
}

function predictionSettingsOverrideDraft(
  override: PredictionSettingsOverride,
): PredictionSettingsOverrideDrafts[string] {
  return {
    scopeType: override.scope_type,
    stageID: override.stage_id,
    matchID: override.match_id,
    predictionMode: override.prediction_mode ?? "",
    matchResultScoringMode: override.match_result_scoring_mode ?? "",
    underdogBonusEnabled:
      typeof override.underdog_bonus_enabled === "boolean"
        ? override.underdog_bonus_enabled
          ? "enabled"
          : "disabled"
        : "inherit",
    underdogBonusPoints:
      typeof override.underdog_bonus_points === "number"
        ? String(override.underdog_bonus_points)
        : "",
  };
}

function parsePredictionSettingsOverrideDrafts(
  drafts: PredictionSettingsOverrideDrafts,
): PredictionSettingsOverrideInput[] | null {
  const overrides: PredictionSettingsOverrideInput[] = [];
  const sortedDrafts = Object.entries(drafts).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  for (const [, draft] of sortedDrafts) {
    if (!predictionSettingsOverrideDraftHasValue(draft)) {
      continue;
    }

    const input: PredictionSettingsOverrideInput = {
      scope_type: draft.scopeType,
    };
    if (draft.scopeType === "stage") {
      input.stage_id = draft.stageID;
    } else {
      input.match_id = draft.matchID;
    }
    if (draft.predictionMode) {
      input.prediction_mode = draft.predictionMode;
    }
    if (draft.matchResultScoringMode) {
      input.match_result_scoring_mode = draft.matchResultScoringMode;
    }
    if (draft.underdogBonusEnabled !== "inherit") {
      input.underdog_bonus_enabled = draft.underdogBonusEnabled === "enabled";
    }
    if (draft.underdogBonusPoints.trim() !== "") {
      const underdogBonusPoints = parseWholeNumber(draft.underdogBonusPoints);
      if (underdogBonusPoints === null || underdogBonusPoints > 1000) {
        return null;
      }
      input.underdog_bonus_points = underdogBonusPoints;
    }

    overrides.push(input);
  }

  return overrides;
}

function predictionSettingsOverrideDraftHasValue(
  draft: PredictionSettingsOverrideDrafts[string],
) {
  return (
    draft.predictionMode !== "" ||
    draft.matchResultScoringMode !== "" ||
    draft.underdogBonusEnabled !== "inherit" ||
    draft.underdogBonusPoints.trim() !== ""
  );
}

function indexEffectiveMatchSettings(settings: EffectiveMatchPredictionSettings[]) {
  const indexed = new Map<string, EffectiveMatchPredictionSettings>();
  for (const setting of settings) {
    indexed.set(setting.match_id, setting);
  }
  return indexed;
}

function predictionSettingsEffectiveSummary(
  row: PredictionSettingsScopeRow,
  effectiveSettingsByMatch: Map<string, EffectiveMatchPredictionSettings>,
) {
  if (row.scopeType === "stage") {
    const matchOverrides = row.matchIDs.filter((matchID) => {
      const settings = effectiveSettingsByMatch.get(matchID);
      return (
        settings?.prediction_mode_source === "match" ||
        settings?.match_result_scoring_mode_source === "match" ||
        settings?.underdog_bonus_enabled_source === "match" ||
        settings?.underdog_bonus_points_source === "match"
      );
    }).length;
    return matchOverrides > 0
      ? `${row.matchIDs.length} partidos, ${matchOverrides} con override de partido`
      : `${row.matchIDs.length} partidos`;
  }

  const settings = effectiveSettingsByMatch.get(row.matchID);
  if (!settings) {
    return "Pendiente";
  }

  const bonusLabel = settings.underdog_bonus_enabled
    ? `Bonus +${settings.underdog_bonus_points}`
    : "Bonus inactivo";
  return `${predictionModeLabel(settings.prediction_mode)} (${predictionSettingsSourceLabel(
    settings.prediction_mode_source,
  )}) - ${matchResultScoringModeLabel(settings.match_result_scoring_mode)} - ${bonusLabel}`;
}

function predictionSettingsSourceLabel(source: PredictionSettingsSource) {
  switch (source) {
    case "match":
      return "Partido";
    case "stage":
      return "Ronda";
    case "pool":
    default:
      return "Polla";
  }
}

function defaultUnderdogBonusDraft(): UnderdogBonusDrafts[string] {
  return {
    enabled: false,
    outcome: "",
    homeProbability: "",
    drawProbability: "",
    awayProbability: "",
  };
}

function hydrateUnderdogBonusDrafts(bonuses: MatchUnderdogBonus[]) {
  const drafts: UnderdogBonusDrafts = {};
  for (const bonus of bonuses) {
    drafts[bonus.match_id] = underdogBonusDraft(bonus);
  }
  return drafts;
}

function underdogBonusDraft(bonus: MatchUnderdogBonus): UnderdogBonusDrafts[string] {
  return {
    enabled: bonus.enabled,
    outcome: bonus.outcome,
    homeProbability: probabilityDraftValue(bonus.home_probability),
    drawProbability: probabilityDraftValue(bonus.draw_probability),
    awayProbability: probabilityDraftValue(bonus.away_probability),
  };
}

function probabilityDraftValue(value: number | null) {
  if (typeof value !== "number") {
    return "";
  }
  return Number.isInteger(value) ? String(value) : String(value);
}

function parseUnderdogProbabilities(draft: UnderdogBonusDrafts[string]) {
  const homeProbability = parseOptionalProbability(draft.homeProbability);
  const drawProbability = parseOptionalProbability(draft.drawProbability);
  const awayProbability = parseOptionalProbability(draft.awayProbability);
  if (homeProbability === undefined || drawProbability === undefined || awayProbability === undefined) {
    return null;
  }

  return {
    home_probability: homeProbability,
    draw_probability: drawProbability,
    away_probability: awayProbability,
  };
}

function parseOptionalProbability(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (normalized === "") {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return undefined;
  }
  return parsed;
}

function scoringRulesWithUnderdog(
  rules: ScoringRule[],
  underdogRule: { enabled: boolean; points: number },
) {
  const rulesByCode = new Map(scoringRulesWithDefaults(rules).map((rule) => [rule.code, rule]));
  rulesByCode.set("underdog_bonus", {
    code: "underdog_bonus",
    enabled: underdogRule.enabled,
    points: underdogRule.points,
  });
  return scoringRulesInDefaultOrder(rulesByCode);
}

function scoringRulesWithDefaults(rules: ScoringRule[]) {
  const defaults: ScoringRule[] = [
    { code: "exact_score", points: 5, enabled: true },
    { code: "match_result", points: 3, enabled: true },
    { code: "group_position_exact", points: 2, enabled: true },
    { code: "underdog_bonus", points: 2, enabled: false },
  ];
  const rulesByCode = new Map(defaults.map((rule) => [rule.code, rule]));
  for (const rule of rules) {
    rulesByCode.set(rule.code, rule);
  }
  return scoringRulesInDefaultOrder(rulesByCode);
}

function scoringRulesInDefaultOrder(rulesByCode: Map<ScoringRule["code"], ScoringRule>) {
  return [
    rulesByCode.get("exact_score"),
    rulesByCode.get("match_result"),
    rulesByCode.get("group_position_exact"),
    rulesByCode.get("underdog_bonus"),
  ].filter((rule): rule is ScoringRule => Boolean(rule));
}

function scoringRuleByCode(rules: ScoringRule[], code: ScoringRule["code"]) {
  return scoringRulesWithDefaults(rules).find((rule) => rule.code === code) ?? null;
}

function hydrateGlobalDefinitionDrafts(definitions: GlobalPredictionDefinition[]) {
  const drafts: GlobalPredictionDefinitionDrafts = {};
  for (const definition of definitions) {
    drafts[definition.code] = globalDefinitionDraft(definition);
  }
  return drafts;
}

function hydrateGlobalResultDrafts(
  definitions: GlobalPredictionDefinition[],
  results: GlobalPredictionResult[],
) {
  const resultsByCode = indexGlobalPredictionResults(results);
  const drafts: GlobalPredictionDrafts = {};
  for (const definition of definitions) {
    drafts[definition.code] = globalPredictionDraft(resultsByCode.get(definition.code));
  }
  return drafts;
}

function hydrateGlobalTemplateDrafts(templates: GlobalPredictionTemplate[]) {
  const drafts: GlobalPredictionTemplateDrafts = {};
  for (const template of templates) {
    drafts[template.code] = globalTemplateDraft(template);
  }
  return drafts;
}

function globalTemplateDraft(
  template: GlobalPredictionTemplate | undefined,
): GlobalPredictionTemplateDrafts[string] {
  return {
    code: template?.code ?? "",
    label: template?.label ?? "",
    valueType: template?.value_type ?? "text",
    sport: template?.sport ?? "general",
    category: template?.category ?? "general",
    resolutionMode: template?.resolution_mode ?? "manual",
    enabled: template?.enabled ?? true,
    pointsEnabled: template?.points_enabled ?? true,
    prizeEnabled: template?.prize_enabled ?? false,
    points: String(template?.points ?? 0),
    sortOrder: String(template?.sort_order ?? 0),
    defaultEnabled: template?.default_enabled ?? false,
  };
}

function globalReusableTemplate(code: string, sortOrder: number): GlobalPredictionTemplate {
  const now = new Date().toISOString();
  return {
    id: `draft-${code}`,
    code,
    label: "Nueva plantilla",
    value_type: "text",
    sport: "general",
    category: "general",
    resolution_mode: "manual",
    enabled: true,
    points_enabled: true,
    prize_enabled: false,
    points: 0,
    sort_order: sortOrder,
    default_enabled: false,
    created_at: now,
    updated_at: now,
  };
}

function parseGlobalTemplateDraft(
  draft: GlobalPredictionTemplateDrafts[string],
): GlobalPredictionTemplateDraftInput | null {
  const code = normalizeConfigCode(draft.code);
  const label = draft.label.trim();
  const sport = normalizeConfigCode(draft.sport || "general");
  const category = normalizeConfigCode(draft.category || "general");
  const resolutionMode = normalizeConfigCode(draft.resolutionMode || "manual");
  const points = parseWholeNumber(draft.points);
  const sortOrder = parseWholeNumber(draft.sortOrder);
  if (
    !code ||
    !label ||
    !sport ||
    !category ||
    resolutionMode !== "manual" ||
    points === null ||
    points > 1000 ||
    sortOrder === null
  ) {
    return null;
  }

  return {
    code,
    label,
    value_type: draft.valueType,
    sport,
    category,
    resolution_mode: resolutionMode,
    enabled: draft.enabled,
    points_enabled: draft.pointsEnabled,
    prize_enabled: draft.prizeEnabled,
    points,
    sort_order: sortOrder,
    default_enabled: draft.defaultEnabled,
  };
}

function globalDefinitionDraft(
  definition: GlobalPredictionDefinition | undefined,
): GlobalPredictionDefinitionDrafts[string] {
  return {
    code: definition?.code ?? "",
    label: definition?.label ?? "",
    valueType: definition?.value_type ?? "text",
    enabled: definition?.enabled ?? false,
    pointsEnabled: definition?.points_enabled ?? true,
    prizeEnabled: definition?.prize_enabled ?? false,
    prizeType:
      definition?.prize_type && definition.prize_type !== "none"
        ? definition.prize_type
        : definition?.prize_enabled
          ? "fixed"
          : "none",
    prizeFixedAmount: centsToInput(definition?.prize_fixed_amount_cents ?? 0),
    prizePercentage: formatPercentageInput(definition?.prize_percentage ?? 0),
    points: String(definition?.points ?? 0),
    sortOrder: String(definition?.sort_order ?? 0),
    closesAt: toDatetimeLocalInput(definition?.closes_at ?? null),
  };
}

function globalDefinitionFromTemplate(
  poolID: string,
  template: GlobalPredictionTemplate,
): GlobalPredictionDefinition {
  const now = new Date().toISOString();
  return {
    id: `draft-${template.code}`,
    pool_id: poolID,
    code: template.code,
    label: template.label,
    value_type: template.value_type,
    enabled: true,
    points_enabled: template.points_enabled,
    prize_enabled: false,
    prize_type: "none",
    prize_fixed_amount_cents: 0,
    prize_percentage: 0,
    prize_share_policy: "split_equal",
    points: template.points,
    sort_order: template.sort_order,
    closes_at: null,
    created_at: now,
    updated_at: now,
  };
}

function globalCustomDefinition(
  poolID: string,
  code: string,
  sortOrder: number,
): GlobalPredictionDefinition {
  const now = new Date().toISOString();
  return {
    id: `draft-${code}`,
    pool_id: poolID,
    code,
    label: "Nueva prediccion",
    value_type: "text",
    enabled: true,
    points_enabled: true,
    prize_enabled: false,
    prize_type: "none",
    prize_fixed_amount_cents: 0,
    prize_percentage: 0,
    prize_share_policy: "split_equal",
    points: 0,
    sort_order: sortOrder,
    closes_at: null,
    created_at: now,
    updated_at: now,
  };
}

function nextCustomGlobalPredictionCode(
  definitions: GlobalPredictionDefinition[],
  drafts: GlobalPredictionDefinitionDrafts,
) {
  const usedCodes = new Set([
    ...definitions.map((definition) => definition.code),
    ...Object.values(drafts).map((draft) => draft.code.trim()).filter(Boolean),
  ]);
  for (let index = 1; index < 1000; index += 1) {
    const code = `custom_global_${index}`;
    if (!usedCodes.has(code)) {
      return code;
    }
  }

  return `custom_global_${Date.now()}`;
}

function nextReusableGlobalTemplateCode(
  templates: GlobalPredictionTemplate[],
  drafts: GlobalPredictionTemplateDrafts,
) {
  const usedCodes = new Set([
    ...templates.map((template) => template.code),
    ...Object.values(drafts).map((draft) => normalizeConfigCode(draft.code)).filter(Boolean),
  ]);
  for (let index = 1; index < 1000; index += 1) {
    const code = `catalog_template_${index}`;
    if (!usedCodes.has(code)) {
      return code;
    }
  }

  return `catalog_template_${Date.now()}`;
}

function nextGlobalTemplateSortOrder(
  templates: GlobalPredictionTemplate[],
  drafts: GlobalPredictionTemplateDrafts,
) {
  const draftOrders = Object.values(drafts)
    .map((draft) => parseWholeNumber(draft.sortOrder))
    .filter((order): order is number => order !== null);
  const currentMax = Math.max(
    0,
    ...templates.map((template) => template.sort_order),
    ...draftOrders,
  );
  return currentMax + 10;
}

function nextGlobalPredictionSortOrder(
  definitions: GlobalPredictionDefinition[],
  drafts: GlobalPredictionDefinitionDrafts,
) {
  const draftOrders = Object.values(drafts)
    .map((draft) => parseWholeNumber(draft.sortOrder))
    .filter((order): order is number => order !== null);
  const currentMax = Math.max(
    0,
    ...definitions.map((definition) => definition.sort_order),
    ...draftOrders,
  );
  return currentMax + 10;
}

function globalTemplatesInOrder(templates: GlobalPredictionTemplate[]) {
  return [...templates].sort(
    (left, right) =>
      left.sort_order - right.sort_order ||
      left.label.localeCompare(right.label, "es") ||
      left.code.localeCompare(right.code),
  );
}

function isDraftGlobalTemplate(template: GlobalPredictionTemplate) {
  return template.id.startsWith("draft-");
}

function normalizeConfigCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseGlobalDefinitionDrafts(
  drafts: GlobalPredictionDefinitionDrafts,
): GlobalPredictionDefinitionInput[] | null {
  const definitions: GlobalPredictionDefinitionInput[] = [];
  const seenCodes = new Set<string>();

  for (const draft of Object.values(drafts)) {
    const code = draft.code.trim() as GlobalPredictionDefinition["code"];
    const label = draft.label.trim();
    const points = parseWholeNumber(draft.points);
    const sortOrder = parseWholeNumber(draft.sortOrder);
    const closesAt = datetimeLocalToISO(draft.closesAt);
    const prizeConfig = parseGlobalPrizeDraft(draft);

    if (
      !code ||
      seenCodes.has(code) ||
      !label ||
      points === null ||
      points > 1000 ||
      sortOrder === null ||
      closesAt === undefined ||
      !prizeConfig
    ) {
      return null;
    }

    seenCodes.add(code);
    definitions.push({
      code,
      label,
      value_type: draft.valueType,
      enabled: draft.enabled,
      points_enabled: draft.pointsEnabled,
      prize_enabled: draft.prizeEnabled,
      ...prizeConfig,
      points,
      sort_order: sortOrder,
      closes_at: closesAt,
    });
  }

  return definitions.sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));
}

function parseGlobalPrizeDraft(draft: GlobalPredictionDefinitionDrafts[string]) {
  if (!draft.prizeEnabled) {
    return {
      prize_type: "none" as const,
      prize_fixed_amount_cents: 0,
      prize_percentage: 0,
      prize_share_policy: "split_equal" as const,
    };
  }

  if (draft.prizeType === "fixed") {
    const fixedAmountCents = parseMoneyToCents(draft.prizeFixedAmount);
    if (fixedAmountCents === null || fixedAmountCents <= 0) {
      return null;
    }
    return {
      prize_type: "fixed" as const,
      prize_fixed_amount_cents: fixedAmountCents,
      prize_percentage: 0,
      prize_share_policy: "split_equal" as const,
    };
  }

  if (draft.prizeType === "percentage") {
    const percentage = parsePercentage(draft.prizePercentage);
    if (percentage === null) {
      return null;
    }
    return {
      prize_type: "percentage" as const,
      prize_fixed_amount_cents: 0,
      prize_percentage: percentage,
      prize_share_policy: "split_equal" as const,
    };
  }

  return null;
}

function emptyGlobalPredictionDraft(): GlobalPredictionDrafts[string] {
  return { valueText: "", valueNumber: "", rangeMin: "", rangeMax: "" };
}

function globalPredictionDraft(
  prediction: GlobalPredictionResult | undefined,
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

function globalPredictionInputFromDraft(
  definition: GlobalPredictionDefinition,
  draft: GlobalPredictionDrafts[string],
): SaveGlobalPredictionInput | null {
  if (
    definition.value_type === "team" ||
    definition.value_type === "player" ||
    definition.value_type === "text"
  ) {
    const valueText = draft.valueText.trim();
    return valueText ? { value_text: valueText } : null;
  }

  const valueNumber = parseWholeNumber(draft.valueNumber);
  if (valueNumber === null) {
    return null;
  }
  return { value_number: valueNumber };
}

function upsertGlobalPredictionResult(
  results: GlobalPredictionResult[],
  nextResult: GlobalPredictionResult,
) {
  const nextResults = results.filter((result) => result.code !== nextResult.code);
  nextResults.push(nextResult);
  return globalPredictionResultsInOrder(nextResults);
}

function indexGlobalPredictionResults(results: GlobalPredictionResult[]) {
  const indexed = new Map<GlobalPredictionDefinition["code"], GlobalPredictionResult>();
  for (const result of results) {
    indexed.set(result.code, result);
  }
  return indexed;
}

function globalDefinitionsInOrder(definitions: GlobalPredictionDefinition[]) {
  return [...definitions].sort(
    (left, right) =>
      left.sort_order - right.sort_order ||
      left.label.localeCompare(right.label, "es") ||
      left.code.localeCompare(right.code),
  );
}

function globalPredictionResultsInOrder(results: GlobalPredictionResult[]) {
  return [...results].sort((left, right) => left.code.localeCompare(right.code));
}

function globalValueTypeLabel(valueType: GlobalPredictionValueType) {
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

function globalTemplateSportLabel(sport: string) {
  switch (sport) {
    case "football":
      return "Futbol";
    case "general":
    default:
      return "General";
  }
}

function isGlobalDefinitionClosed(definition: GlobalPredictionDefinition) {
  if (!definition.closes_at) {
    return false;
  }

  const closesAt = Date.parse(definition.closes_at);
  return Number.isFinite(closesAt) && Date.now() >= closesAt;
}

function globalDefinitionCloseStatus(definition: GlobalPredictionDefinition) {
  if (!definition.closes_at) {
    return "Configura cierre";
  }
  return isGlobalDefinitionClosed(definition) ? "Cerrado" : "Abierto";
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

function teamOptionLabel(value: string, teamOptions: TournamentTeamOption[]) {
  const normalizedValue = value.trim();
  const team = teamOptions.find(
    (option) => option.id === normalizedValue || option.name === normalizedValue,
  );
  return team?.name ?? normalizedValue;
}

function globalValueLabel(value: GlobalPredictionResult, teamOptions: TournamentTeamOption[] = []) {
  if (value.value_text) {
    if (value.value_type === "team") {
      return teamOptionLabel(value.value_text, teamOptions);
    }
    return value.value_text;
  }
  if (typeof value.value_number === "number") {
    return String(value.value_number);
  }
  if (typeof value.range_min === "number" && typeof value.range_max === "number") {
    return `${value.range_min} - ${value.range_max}`;
  }
  return "Sin valor";
}

function toDatetimeLocalInput(value: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return offsetDate.toISOString().slice(0, 16);
}

function datetimeLocalToISO(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

function defaultThemeDraft(pool: Pool | null): ThemeDraft {
  const theme = normalizedPoolTheme(pool?.theme);

  return {
    displayName: pool?.theme?.display_name || pool?.name || "",
    logoURL: theme.logoURL,
    bannerURL: theme.bannerURL,
    mascotURL: theme.mascotURL,
    primaryColor: theme.primaryColor,
    secondaryColor: theme.secondaryColor,
    accentColor: theme.accentColor,
  };
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

function colorPickerValue(value: string) {
  return validThemeColor(value) && value.length === 7 ? value : "#0F766E";
}

function validThemeColor(value: string | undefined): value is string {
  return Boolean(value?.match(/^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/));
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
