import { db } from "@/lib/firebase"
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp,
} from "firebase/firestore"
import { listTemplates, type WorkoutTemplate } from "@/lib/firestore/admin"

type Sport = "run" | "bike" | "strength"

function startOfWeekMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, days: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

function dayKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const da = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${da}`
}

function pickTemplate(templates: WorkoutTemplate[], sport: Sport, preferTag?: string) {
  const bySport = templates.filter((t: any) => t.sport === sport)
  if (!bySport.length) return null

  if (preferTag) {
    const byTag = bySport.filter((t: any) => Array.isArray(t.tags) && t.tags.includes(preferTag))
    if (byTag.length) return byTag[0] as any
  }
  return bySport[0] as any
}

function buildWeekPattern() {
  // Patrón simple y “coach-like”
  // L: descanso | M: run | X: bike | J: run | V: strength | S: bike | D: run
  return [
    { offset: 0, sport: null as Sport | null, tag: "rest" },
    { offset: 1, sport: "run" as Sport, tag: "easy" },
    { offset: 2, sport: "bike" as Sport, tag: "easy" },
    { offset: 3, sport: "run" as Sport, tag: "quality" },
    { offset: 4, sport: "strength" as Sport, tag: "strength" },
    { offset: 5, sport: "bike" as Sport, tag: "long" },
    { offset: 6, sport: "run" as Sport, tag: "easy" },
  ]
}

async function listExistingWorkouts(uid: string, weekStart: Date) {
  const start = Timestamp.fromDate(weekStart)
  const end = Timestamp.fromDate(addDays(weekStart, 7))

  const ref = collection(db, "users", uid, "workouts")
  const q = query(ref, where("date", ">=", start), where("date", "<", end))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as any))
}

export async function generateWeekForAthlete(params: {
  athleteUid: string
  refDate?: Date // cualquier día de la semana, calculamos lunes
  overwrite?: boolean // si true, permite crear aunque haya otros (pero igualmente evitamos duplicados por día+sporte)
}) {
  const { athleteUid, refDate = new Date(), overwrite = false } = params

  if (!athleteUid) throw new Error("generateWeekForAthlete: athleteUid missing")

  // 1) Leer atleta (por si luego quieres usar entrevista: días disponibles, nivel, etc.)
  const userRef = doc(db, "users", athleteUid)
  const userSnap = await getDoc(userRef)
  if (!userSnap.exists()) throw new Error("Atleta no existe en users/{uid}")

  // 2) Semana objetivo
  const weekStart = startOfWeekMonday(refDate)

  // 3) Plantillas disponibles
  const templatesRaw = await listTemplates()
  const templates = templatesRaw.map((t: any) => t as WorkoutTemplate)

  // 4) Ver si ya hay workouts esa semana
  const existing = await listExistingWorkouts(athleteUid, weekStart)
  const existingByDaySport = new Set(
    existing
      .map((w: any) => {
        const dt = w?.date?.toDate ? w.date.toDate() : null
        if (!dt) return null
        return `${dayKey(dt)}|${w.sport ?? ""}`
      })
      .filter(Boolean) as string[]
  )

  const pattern = buildWeekPattern()

  let created = 0

  for (const slot of pattern) {
    if (!slot.sport) continue // descanso, no creamos doc

    const date = addDays(weekStart, slot.offset)
    // Hora fija para evitar líos de timezone en UI
    date.setHours(8, 0, 0, 0)

    const key = `${dayKey(date)}|${slot.sport}`
    if (!overwrite && existingByDaySport.has(key)) continue

    const tpl = pickTemplate(templates, slot.sport, slot.tag)
    if (!tpl) continue

    const workoutRef = doc(collection(db, "users", athleteUid, "workouts"))
    await setDoc(workoutRef, {
      title: tpl.title,
      sport: tpl.sport,
      date: Timestamp.fromDate(date),
      status: "planned",

      duration: tpl.durationMin ?? null,
      distanceKm: (tpl as any).distanceKm ?? null,

      intensity: {
        type:
          tpl.method === "power"
            ? "power"
            : tpl.method === "hr"
            ? "hr"
            : tpl.method === "pace"
            ? "pace"
            : "rpe",
        target: {
          zone: tpl.targetLabel ?? null,
          pct: tpl.intensityPct ?? null,
        },
      },

      description: tpl.description ?? null,
      blocks: (tpl as any).blocks ?? [],

      sourceTemplateId: (tpl as any).id ?? null,
      sourceTemplateSnapshot: tpl,

      createdBy: "autoplan",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    created++
  }

  return { weekStart, created }
}
