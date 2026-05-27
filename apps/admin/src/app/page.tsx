const adminModules = [
  { name: "Torneos", status: "Modelo base", tone: "bg-sky-100 text-sky-900" },
  { name: "Pollas privadas", status: "Pendiente API", tone: "bg-amber-100 text-amber-900" },
  { name: "Puntajes", status: "Por configurar", tone: "bg-amber-100 text-amber-900" },
  { name: "Recaudo", status: "Diseno listo", tone: "bg-emerald-100 text-emerald-900" },
  { name: "Premios", status: "Diseno listo", tone: "bg-emerald-100 text-emerald-900" },
  { name: "Resultados", status: "Por construir", tone: "bg-amber-100 text-amber-900" },
];

const setupSteps = [
  "Crear torneo o elegir plantilla",
  "Configurar polla privada",
  "Definir reglas de puntaje",
  "Configurar recaudo y premios",
  "Invitar participantes",
];

export default function AdminHome() {
  return (
    <main className="min-h-screen bg-[#f7f8fb] text-[#191b1f]">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-medium text-emerald-700">PollaVAR Admin</p>
            <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">
              Configuracion de pollas y torneos
            </h1>
          </div>
          <span className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700">
            Admin
          </span>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-sky-700">
            Panel de administracion
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
            Controla reglas, recaudo, premios y resultados desde un solo lugar
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-600">
            Esta app sera usada por el administrador de la polla para preparar el
            torneo, invitar participantes, validar pagos, cargar resultados y
            recalcular rankings.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Metric label="Pollas activas" value="0" />
            <Metric label="Recaudo confirmado" value="$0" />
            <Metric label="Resultados cargados" value="0" />
          </div>
        </div>

        <aside className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">Flujo del admin</h2>
          <ol className="mt-4 space-y-3">
            {setupSteps.map((step, index) => (
              <li key={step} className="flex items-start gap-3 text-sm text-zinc-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-xs font-semibold text-emerald-800">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-10">
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-zinc-950">Modulos admin</h2>
          </div>
          <div className="grid gap-0 md:grid-cols-2 lg:grid-cols-3">
            {adminModules.map((module) => (
              <div key={module.name} className="border-b border-zinc-200 p-6 lg:border-r">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-zinc-950">{module.name}</h3>
                  <span className={`rounded-md px-2 py-1 text-xs font-medium ${module.tone}`}>
                    {module.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  Preparado para conectarse al API de PollaVAR conforme avancemos
                  por las historias del backlog.
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

