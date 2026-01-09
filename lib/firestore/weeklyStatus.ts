import { db } from "@/lib/firebase"
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  doc,
  setDoc,
} from "firebase/firestore"

function startOfWeekMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function severity(s: "green" | "yellow" | "red") {
  return s === "red" ? 3 : s === "yellow" ? 2 : 1
}
function worst(a: "green" | "yellow" | "red", b: "green" | "yellow" | "red") {
  return severity(a) >= severity(b) ? a : b
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function ymd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

type Reason = "injury" | "time" | "fatigue" | "sick" | "other"
type WeeklyAction = "rest" | "reduce" | "continue"

export async function recomputeWeeklyAutoStatus(params: {
  uid: string
  refDate?: Date
}) {
  const { uid, refDate = new Date() } = params

  const weekStart = startOfWeekMonday(refDate)
  const weekKey = ymd(weekStart)

  const weekStartTs = Timestamp.fromDate(weekStart)
  const weekEndTs = Timestamp.fromDate(
    new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
  )

  const workoutsRef = collection(db, "users", uid, "workouts")
  const q = query(
    workoutsRef,
    where("date", ">=", weekStartTs),
    where("date", "<", weekEndTs)
  )

  const snap = await getDocs(q)
  const workouts = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const total = workouts.length
  const done = workouts.filter(
    (w: any) => w.status === "completed" || w.status === "modified"
  ).length
  const skippedWorkouts = workouts.filter((w: any) => w.status === "skipped")
  const skipped = skippedWorkouts.length
  const pending = workouts.filter((w: any) => w.status === "planned").length

  // Motivos (conteo)
  const reasonsCount: Record<Reason, number> = {
    injury: 0,
    sick: 0,
    fatigue: 0,
    time: 0,
    other: 0,
  }

  for (const w of skippedWorkouts as any[]) {
    const r = (w.skippedReason ?? "other") as Reason
    if ((reasonsCount as any)[r] === undefined) reasonsCount.other++
    else reasonsCount[r]++
  }

  let status: "green" | "yellow" | "red" = "green"

  // 1) Progreso semanal
  let pctDone = 0
  if (total > 0) {
    pctDone = (done / total) * 100
    if (pctDone < 50) status = "red"
    else if (pctDone < 80) status = "yellow"
  }

  // 2) Skips base
  if (skipped >= 2) status = worst(status, "red")
  else if (skipped === 1) status = worst(status, "yellow")

  // 3) Motivos con peso
  if (reasonsCount.injury >= 1 || reasonsCount.sick >= 1) {
    status = worst(status, "red")
  } else if (reasonsCount.fatigue >= 2) {
    status = worst(status, "red")
  } else if (reasonsCount.fatigue === 1) {
    status = worst(status, "yellow")
  } else if (reasonsCount.time >= 2) {
    status = worst(status, "yellow")
  }

  // 4) lastCheckinSummary (cacheado en workout) + señales persistidas
  const summaries = workouts
    .map((w: any) => w.lastCheckinSummary)
    .filter(Boolean)

  let signals = {
    avgRpe: null as number | null,
    avgFatigue: null as number | null,
    maxPain: null as number | null,
  }

  if (summaries.length > 0) {
    const rpes = summaries.map((s: any) => s.rpe).filter(Number.isFinite)
    const fatigues = summaries.map((s: any) => s.fatigue).filter(Number.isFinite)
    const pains = summaries.map((s: any) => s.pain).filter(Boolean)

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

    const avgRpeRaw = avg(rpes)
    const avgFatigueRaw = avg(fatigues)

    const maxPainRaw = pains.reduce((m: number, p: any) => {
      const v = p?.hasPain ? Number(p?.intensity ?? 0) : 0
      return Math.max(m, isNaN(v) ? 0 : v)
    }, 0)

    signals = {
      avgRpe: avgRpeRaw === null ? null : round1(avgRpeRaw),
      avgFatigue: avgFatigueRaw === null ? null : round1(avgFatigueRaw),
      maxPain: maxPainRaw > 0 ? round1(maxPainRaw) : null,
    }

    // Influye en status
    if (signals.avgRpe !== null) {
      if (signals.avgRpe >= 8) status = worst(status, "red")
      else if (signals.avgRpe >= 6.5) status = worst(status, "yellow")
    }

    if (signals.avgFatigue !== null) {
      if (signals.avgFatigue >= 4) status = worst(status, "red")
      else if (signals.avgFatigue >= 3) status = worst(status, "yellow")
    }

    if (signals.maxPain !== null) {
      if (signals.maxPain >= 7) status = worst(status, "red")
      else if (signals.maxPain >= 5) status = worst(status, "yellow")
    }
  }

  // ✅ 5) Recomendación inteligente + triggers explicables
  const hasCriticalReason = reasonsCount.injury >= 1 || reasonsCount.sick >= 1
  const painCritical = (signals.maxPain ?? 0) >= 6
  const stressHigh =
    (signals.avgRpe ?? 0) >= 7.5 || (signals.avgFatigue ?? 0) >= 3.5
  const fatigueSkips = reasonsCount.fatigue >= 1

  let action: WeeklyAction = "continue"
  if (status === "red" || hasCriticalReason || painCritical) action = "rest"
  else if (status === "yellow" || stressHigh || fatigueSkips) action = "reduce"

  const recommendationTriggers: string[] = []

  if (hasCriticalReason) recommendationTriggers.push("lesión/enfermedad")
  if (painCritical) recommendationTriggers.push("dolor alto")
  if (stressHigh) recommendationTriggers.push("estrés alto (RPE/Fatiga)")

  // Triggers extra por “semana irregular”
  if (total > 0 && pctDone < 80) recommendationTriggers.push("bajo progreso semanal")
  if (skipped >= 2) recommendationTriggers.push("muchos entrenos saltados")
  if (reasonsCount.time >= 2) recommendationTriggers.push("faltas por tiempo")
  if (reasonsCount.other >= 2) recommendationTriggers.push("varios motivos (otro)")

  let recommendation: { title: string; message: string; action: WeeklyAction }

  if (action === "rest") {
    recommendation = {
      title: "Descanso / descarga",
      message:
        "Hay señales de riesgo (lesión/enfermedad/dolor o semana muy irregular). Reduce carga 24–48h y prioriza recuperación. Si hay dolor alto, evita intensidad.",
      action,
    }
  } else if (action === "reduce") {
    recommendation = {
      title: "Bajar un punto la carga",
      message:
        "Vas justo o vienes cargado. Mantén entrenos fáciles, reduce intensidad o volumen un 10–20% y revisa sueño/estrés. Si aparece dolor, ajusta.",
      action,
    }
  } else {
    recommendation = {
      title: "Sigue el plan",
      message:
        "Vas bien. Mantén la carga y cuida descanso, nutrición e hidratación.",
      action,
    }
  }

  const updatedAt = Timestamp.now()

  // 6) Guardar en user (estado “actual”)
  const userRef = doc(db, "users", uid)
  await setDoc(
    userRef,
    {
      weeklyAutoStatus: {
        weekStart: weekStartTs,
        status,
        stats: {
          total,
          done,
          pending,
          skipped,
          reasons: reasonsCount,
        },
        signals,
        recommendation,
        recommendationTriggers, // ✅ nuevo
        updatedAt,
      },
    },
    { merge: true }
  )

  // ✅ 7) Guardar histórico por semana
  const historyRef = doc(db, "users", uid, "weeklyHistory", weekKey)
  await setDoc(
    historyRef,
    {
      weekKey,
      weekStart: weekStartTs,
      status,
      signals,
      stats: {
        total,
        done,
        pending,
        skipped,
        reasons: reasonsCount,
      },
      recommendation,
      recommendationTriggers,
      updatedAt,
    },
    { merge: true }
  )
}
