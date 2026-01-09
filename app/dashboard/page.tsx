"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import {
  doc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  Timestamp,
  onSnapshot,
} from "firebase/firestore"
import WeeklyRecommendationCard from "./_components/WeeklyRecommendationCard"

type SportFilter = "all" | "run" | "bike" | "strength"

function startOfWeekMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, days: number) {
  const date = new Date(d)
  date.setDate(date.getDate() + days)
  return date
}

function ymd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function fmtRange(a: Date, b: Date) {
  const f = (x: Date) =>
    x.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
  return `${f(a)} – ${f(b)}`
}

function fmtDayLabel(d: Date) {
  return d
    .toLocaleDateString("es-ES", { weekday: "short", day: "2-digit" })
    .toUpperCase()
}

function intensityLabel(intensity: any) {
  const type = intensity?.type
  const zone = intensity?.target?.zone
  const icon = type === "power" ? "⚡" : "❤️"
  return zone ? `${icon} ${zone}` : icon
}

function statusBadge(status?: string) {
  if (status === "completed") return "✅"
  if (status === "modified") return "🟡"
  if (status === "skipped") return "❌"
  return "⬜"
}

function statusPillText(status?: string) {
  if (status === "completed") return "Completado"
  if (status === "modified") return "Modificado"
  if (status === "skipped") return "Saltado"
  return "Pendiente"
}

function cardClassForStatus(status?: string) {
  if (status === "completed") return "border border-green-300"
  if (status === "modified") return "border border-yellow-300"
  if (status === "skipped") return "border border-red-300"
  return "border border-gray-200"
}

function weeklyLabelFromUser(userData: any) {
  const s = userData?.weeklyAutoStatus?.status
  if (s === "green") return "🟢 Verde"
  if (s === "yellow") return "🟡 Amarillo"
  if (s === "red") return "🔴 Rojo"
  return "—"
}

function weeklyStatsFromUser(userData: any) {
  return (
    userData?.weeklyAutoStatus?.stats ?? {
      total: 0,
      done: 0,
      pending: 0,
      skipped: 0,
    }
  )
}

function WeeklyHelpPanel() {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
        aria-expanded={open}
      >
        {open ? "Ocultar explicación" : "¿Cómo se calcula?"}
      </button>

      {open && (
        <div className="mt-3 rounded-lg border bg-gray-50 p-4 text-sm leading-relaxed">
          <div className="font-semibold text-base mb-2">Cómo se calcula el estado</div>

          <div className="text-gray-800">
            Se recalcula cuando:
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Guardas un <strong>check-in</strong></li>
              <li>Marcas un entreno como <strong>saltado</strong></li>
            </ul>
          </div>

          <div className="mt-4">
            <div className="font-semibold mb-1">Peso de motivos (si saltas un entreno)</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Crítico:</strong> lesión / enfermedad → tiende a <strong>🔴</strong>
              </li>
              <li>
                <strong>Moderado:</strong> fatiga (1 → <strong>🟡</strong>, 2+ → <strong>🔴</strong>)
              </li>
              <li>
                <strong>Leve:</strong> falta de tiempo / otro → penaliza menos
              </li>
            </ul>
          </div>

          <div className="mt-4">
            <div className="font-semibold mb-1">También influye</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                El <strong>progreso</strong> de la semana (hechos/total)
              </li>
              <li>
                El último resumen de check-in: <strong>RPE</strong>, <strong>fatiga</strong> y <strong>dolor</strong>
              </li>
            </ul>
          </div>

          <div className="mt-4 text-xs opacity-70">
            Nota: esto es un “semáforo rápido” para orientar la carga. Lo iremos afinando.
          </div>
        </div>
      )}
    </div>
  )
}

function ReasonPills({ reasons }: { reasons: any }) {
  if (!reasons) return null

  const items: { key: string; label: string; count: number }[] = [
    { key: "injury", label: "Lesión", count: Number(reasons.injury ?? 0) },
    { key: "sick", label: "Enfermedad", count: Number(reasons.sick ?? 0) },
    { key: "fatigue", label: "Fatiga", count: Number(reasons.fatigue ?? 0) },
    { key: "time", label: "Tiempo", count: Number(reasons.time ?? 0) },
    { key: "other", label: "Otro", count: Number(reasons.other ?? 0) },
  ].filter((x) => x.count > 0)

  if (!items.length) return null

  return (
    <div className="mt-3">
      <div className="text-[11px] opacity-60 mb-2">Motivos</div>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <div key={it.key} className="px-3 py-1 rounded-full border text-xs bg-white/70">
            <span className="opacity-70">{it.label}</span>{" "}
            <span className="font-semibold">{it.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function statusEmoji(s?: string) {
  if (s === "green") return "🟢"
  if (s === "yellow") return "🟡"
  if (s === "red") return "🔴"
  return "⚪"
}

function TrendCard({ history }: { history: any[] }) {
  if (!history?.length) return null

  return (
    <div className="border rounded p-4">
      <div className="text-sm opacity-70">Tendencia (últimas semanas)</div>

      <div className="mt-3 space-y-2">
        {history.map((h) => {
          const ws = h?.weekStart?.toDate ? h.weekStart.toDate() : null
          const startLabel = ws ? fmtRange(ws, addDays(ws, 6)) : h.weekKey ?? "—"

          const s = h?.signals ?? {}
          return (
            <div key={h.id ?? h.weekKey} className="rounded-lg border bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">
                  {statusEmoji(h.status)} {startLabel}
                </div>
                <div className="text-xs opacity-60">
                  Hecho {h?.stats?.done ?? 0}/{h?.stats?.total ?? 0} · Salt {h?.stats?.skipped ?? 0}
                </div>
              </div>

              <div className="mt-2 text-xs opacity-80 flex flex-wrap gap-2">
                <span className="px-2 py-1 rounded-full border bg-gray-50">avgRPE: <strong>{s.avgRpe ?? "—"}</strong></span>
                <span className="px-2 py-1 rounded-full border bg-gray-50">avgFatiga: <strong>{s.avgFatigue ?? "—"}</strong></span>
                <span className="px-2 py-1 rounded-full border bg-gray-50">maxDolor: <strong>{s.maxPain ?? "—"}</strong></span>
              </div>

              {Array.isArray(h.recommendationTriggers) && h.recommendationTriggers.length > 0 && (
                <div className="mt-2 text-[11px] opacity-70">
                  <span className="font-medium">Triggers:</span>{" "}
                  {h.recommendationTriggers.join(" · ")}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [uid, setUid] = useState<string | null>(null)
  const [userData, setUserData] = useState<any>(null)

  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeekMonday(new Date())
  )
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const [sportFilter, setSportFilter] = useState<SportFilter>("all")
  const [workouts, setWorkouts] = useState<any[]>([])
  const [nextWorkout, setNextWorkout] = useState<any>(null)

  // ✅ nuevo: histórico
  const [weeklyHistory, setWeeklyHistory] = useState<any[]>([])

  // Auth + user doc realtime
  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUid(null)
        setUserData(null)
        setWeeklyHistory([])
        setLoading(false)
        router.push("/login")
        return
      }

      setUid(user.uid)
      setLoading(true)

      const userRef = doc(db, "users", user.uid)

      unsubUserDoc = onSnapshot(
        userRef,
        (snap) => {
          setUserData(snap.exists() ? snap.data() : null)
          setLoading(false)
        },
        () => setLoading(false)
      )
    })

    return () => {
      if (unsubUserDoc) unsubUserDoc()
      unsubAuth()
    }
  }, [router])

  // Workouts semana + next workout
  useEffect(() => {
    if (!uid) return

    let cancelled = false

    async function run() {
      const start = Timestamp.fromDate(weekStart)
      const endExclusive = Timestamp.fromDate(addDays(weekStart, 7))

      const workoutsRef = collection(db, "users", uid, "workouts")
      const weekQ = query(
        workoutsRef,
        where("date", ">=", start),
        where("date", "<", endExclusive),
        orderBy("date", "asc")
      )

      const weekSnap = await getDocs(weekQ)
      if (cancelled) return
      setWorkouts(weekSnap.docs.map((d) => ({ id: d.id, ...d.data() })))

      const now = Timestamp.fromDate(new Date())
      const base = [
        where("date", ">=", now),
        where("status", "==", "planned"),
      ] as any[]

      const nextQ =
        sportFilter === "all"
          ? query(workoutsRef, ...base, orderBy("date", "asc"), limit(1))
          : query(
              workoutsRef,
              ...base,
              where("sport", "==", sportFilter),
              orderBy("date", "asc"),
              limit(1)
            )

      const nextSnap = await getDocs(nextQ)
      if (cancelled) return
      setNextWorkout(
        nextSnap.empty
          ? null
          : { id: nextSnap.docs[0].id, ...nextSnap.docs[0].data() }
      )
    }

    run()
    return () => {
      cancelled = true
    }
  }, [uid, weekStart, sportFilter])

  // ✅ histórico realtime (últimas 8 semanas)
  useEffect(() => {
    if (!uid) return

    const historyRef = collection(db, "users", uid, "weeklyHistory")
    const qh = query(historyRef, orderBy("weekStart", "desc"), limit(8))

    const unsub = onSnapshot(
      qh,
      (snap) => {
        setWeeklyHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      },
      () => setWeeklyHistory([])
    )

    return () => unsub()
  }, [uid])

  if (loading) return <p className="p-6">Cargando dashboard...</p>

  if (!userData) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-bold">ENDURIA</h1>
        <p className="text-red-600">
          Este usuario ha iniciado sesión, pero no tiene documento en Firestore
          (users/{`{uid}`}).
        </p>
        <p className="text-sm text-gray-600">
          Solución: registra el usuario desde /register o crea el doc manualmente.
        </p>
      </div>
    )
  }

  const todayKey = ymd(new Date())

  const filteredWorkouts =
    sportFilter === "all"
      ? workouts
      : workouts.filter((w) => w.sport === sportFilter)

  const byDay: Record<string, any[]> = {}
  for (const w of filteredWorkouts) {
    const dt: Date | null = w?.date?.toDate ? w.date.toDate() : null
    if (!dt) continue
    const key = ymd(dt)
    byDay[key] = byDay[key] || []
    byDay[key].push(w)
  }

  for (const key of Object.keys(byDay)) {
    byDay[key].sort((a, b) => {
      const da = a?.date?.toDate ? a.date.toDate().getTime() : 0
      const dbt = b?.date?.toDate ? b.date.toDate().getTime() : 0
      return da - dbt
    })
  }

  const weeklyStatusLabel = weeklyLabelFromUser(userData)
  const ws = weeklyStatsFromUser(userData)

  const rec = userData?.weeklyAutoStatus?.recommendation
  const signals = userData?.weeklyAutoStatus?.signals ?? {
    avgRpe: null,
    avgFatigue: null,
    maxPain: null,
  }
  const triggers: string[] = userData?.weeklyAutoStatus?.recommendationTriggers ?? []
  const reasons = userData?.weeklyAutoStatus?.stats?.reasons

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">ENDURIA</h1>

        {(userData?.role === "admin" || userData?.role === "coach") && (
          <button
            className="bg-black text-white px-4 py-2 rounded"
            onClick={() => router.push("/workout/new")}
          >
            ➕ Crear entreno
          </button>
        )}

      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="border rounded p-4">
          <div className="text-sm opacity-70">Semana</div>
          <div className="text-lg">
            <strong>{userData.currentWeek}</strong>
          </div>
          <div className="text-sm opacity-70">{fmtRange(weekDays[0], weekDays[6])}</div>
        </div>

        <div className="border rounded p-4">
          <div className="text-sm opacity-70">Estado semanal (tiempo real)</div>

          <div className="text-lg mt-1">
            <strong>{weeklyStatusLabel}</strong>
          </div>

          <div className="text-xs opacity-60 mt-1">
            Hecho {ws.done}/{ws.total} · Pend {ws.pending} · Salt {ws.skipped}
          </div>

          <ReasonPills reasons={reasons} />

          {rec && (
            <WeeklyRecommendationCard
              recommendation={rec}
              signals={signals}
              triggers={triggers}
            />
          )}

          <WeeklyHelpPanel />

          <div className="text-[11px] opacity-50 mt-2">
            (Se actualiza al guardar check-in o saltar entreno)
          </div>
        </div>

        <div className="border rounded p-4">
          <div className="text-sm opacity-70">Filtro</div>
          <div className="text-lg">
            <strong>
              {sportFilter === "all" && "Todos"}
              {sportFilter === "run" && "🏃 Running"}
              {sportFilter === "bike" && "🚴 Ciclismo"}
              {sportFilter === "strength" && "🏋️ Fuerza"}
            </strong>
          </div>
          <div className="text-xs opacity-60 mt-1">
            Afecta a la vista semanal y al “próximo entreno”.
          </div>
        </div>
      </div>

      {/* ✅ histórico/tendencia */}
      <TrendCard history={weeklyHistory} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button className="border rounded px-3 py-2" onClick={() => setWeekStart((d) => addDays(d, -7))}>
            ⬅️ Semana anterior
          </button>

          <button className="border rounded px-3 py-2" onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>
            🏠 Semana actual
          </button>

          <button className="border rounded px-3 py-2" onClick={() => setWeekStart((d) => addDays(d, 7))}>
            Semana siguiente ➡️
          </button>

          <div className="text-sm opacity-70 ml-2">{fmtRange(weekDays[0], weekDays[6])}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            ["all", "Todos"],
            ["run", "🏃 Run"],
            ["bike", "🚴 Bike"],
            ["strength", "🏋️ Strength"],
          ].map(([k, label]) => (
            <button
              key={k}
              className={`border rounded px-3 py-2 ${sportFilter === k ? "bg-black text-white" : ""}`}
              onClick={() => setSportFilter(k as SportFilter)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((d) => {
          const key = ymd(d)
          const dayWorkouts = byDay[key] || []
          const isToday = key === todayKey

          return (
            <div
              key={key}
              className={`rounded p-3 space-y-2 ${isToday ? "border-2 border-black" : "border"}`}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold opacity-70">{fmtDayLabel(d)}</div>
                {isToday && <div className="text-xs font-semibold">HOY</div>}
              </div>

              {dayWorkouts.length === 0 && <div className="text-sm opacity-40">—</div>}

              {dayWorkouts.map((w) => (
                <div
                  key={w.id}
                  className={`rounded p-2 cursor-pointer hover:opacity-90 ${cardClassForStatus(w.status)}`}
                  onClick={() => router.push(`/workout/${w.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{w.title ?? "Entreno"}</div>

                      <div className="flex items-center justify-between text-xs opacity-70 mt-1">
                        <span>
                          {w.sport ?? ""}
                          {w.duration ? ` · ${w.duration}’` : ""}
                        </span>
                        <span>{intensityLabel(w.intensity)}</span>
                      </div>

                      {w.lastCheckinSummary && (
                        <div className="text-[11px] opacity-70 mt-2">
                          RPE: <strong>{w.lastCheckinSummary.rpe ?? "—"}</strong> · Fat:{" "}
                          <strong>{w.lastCheckinSummary.fatigue ?? "—"}</strong>{" "}
                          {w.lastCheckinSummary.pain?.hasPain ? (
                            <>
                              · Dolor: <strong>{w.lastCheckinSummary.pain?.intensity ?? "—"}</strong>
                            </>
                          ) : (
                            <>
                              · Dolor: <strong>No</strong>
                            </>
                          )}
                        </div>
                      )}

                      <div className="mt-2 inline-flex items-center gap-2 text-[11px] opacity-80 border rounded px-2 py-1">
                        <span>{statusBadge(w.status)}</span>
                        <span>{statusPillText(w.status)}</span>
                      </div>
                    </div>

                    <div className="text-lg">{statusBadge(w.status)}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {nextWorkout ? (
        <div
          className="border rounded p-4 cursor-pointer hover:opacity-90"
          onClick={() => router.push(`/workout/${nextWorkout.id}`)}
        >
          <p className="font-semibold">Próximo entreno</p>
          <p>{nextWorkout.title}</p>
          <p className="text-sm text-gray-500">
            {nextWorkout.sport} · {intensityLabel(nextWorkout.intensity)}
          </p>
        </div>
      ) : (
        <div className="border rounded p-4">
          <p className="font-semibold">No hay entrenos pendientes</p>
          <p className="text-sm text-gray-500">
            Crea entrenos en <code>/workout/new</code> para verlos aquí.
          </p>
        </div>
      )}

      <div className="text-xs opacity-40">
        UID: {uid ?? "—"} · Workouts semana: {workouts.length} · Mostrados: {filteredWorkouts.length}
      </div>
    </div>
  )
}
