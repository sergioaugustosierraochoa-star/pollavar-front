import Link from "next/link";

const participantActions = [
  { name: "Mis predicciones", status: "Proximo", tone: "bg-sky-100 text-sky-900" },
  { name: "Partidos pendientes", status: "Proximo", tone: "bg-amber-100 text-amber-900" },
  { name: "Mi pago", status: "Proximo", tone: "bg-emerald-100 text-emerald-900" },
  { name: "Ranking", status: "Proximo", tone: "bg-indigo-100 text-indigo-900" },
];

const upcomingMatches = [
  { home: "Mexico", away: "South Africa", group: "Grupo A" },
  { home: "Canada", away: "Bosnia and Herzegovina", group: "Grupo B" },
  { home: "Brazil", away: "Morocco", group: "Grupo C" },
];

export default function ParticipantsHome() {
  return (
    <main className="min-h-screen bg-[#f8faf9] text-[#191b1f]">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-medium text-emerald-700">PollaVAR</p>
            <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">
              Portal del participante
            </h1>
          </div>
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
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-sky-700">
            Mundial 2026 como primera plantilla
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
            Haz tus picks, revisa tu pago y compite por el ranking
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-600">
            Esta app sera usada por participantes para unirse a una polla, completar
            predicciones antes del cierre, consultar puntos y ver premios.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Metric label="Puntos" value="0" />
            <Metric label="Posicion" value="-" />
            <Metric label="Pendientes" value="0" />
          </div>
        </div>

        <aside className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">Proximos partidos</h2>
          <div className="mt-4 space-y-3">
            {upcomingMatches.map((match) => (
              <div key={`${match.home}-${match.away}`} className="rounded-lg border border-zinc-200 p-4">
                <p className="text-xs font-medium text-zinc-500">{match.group}</p>
                <div className="mt-2 flex items-center justify-between gap-3 text-sm font-semibold text-zinc-950">
                  <span>{match.home}</span>
                  <span className="text-zinc-400">vs</span>
                  <span>{match.away}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-10">
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-zinc-950">Acciones del participante</h2>
          </div>
          <div className="grid gap-0 md:grid-cols-2 lg:grid-cols-4">
            {participantActions.map((action) => (
              <div key={action.name} className="border-b border-zinc-200 p-6 lg:border-r">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-zinc-950">{action.name}</h3>
                  <span className={`rounded-md px-2 py-1 text-xs font-medium ${action.tone}`}>
                    {action.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  Flujo separado del administrador para mantener una experiencia
                  limpia y enfocada en jugar la polla.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
