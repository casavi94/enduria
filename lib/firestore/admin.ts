import { db } from "@/lib/firebase"
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
} from "firebase/firestore"

import { WorkoutBlock } from "@/lib/types/workoutBlocks"

// ===============================
// Types
// ===============================

export type UserRole = "athlete" | "admin" | "coach"
export type Sport = "run" | "bike" | "strength"
export type IntensityMethod = "hr" | "power" | "pace" | "rpe"

export type WorkoutTemplate = {
  title: string
  sport: Sport
  method: IntensityMethod

  description?: string

  durationMin?: number
  distanceKm?: number

  // Legacy / UI (opcional)
  targetLabel?: string
  intensityPct?: number

  // 🔥 BLOQUES NORMALIZADOS (B1.1)
  blocks?: WorkoutBlock[]

  // Metadata
  tags?: string[]
  createdAt?: any
  updatedAt?: any
}

// ===============================
// Roles
// ===============================

export async function getMyRole(uid: string): Promise<UserRole | null> {
  const ref = doc(db, "users", uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return (snap.data()?.role ?? null) as UserRole | null
}

// ===============================
// Athletes
// ===============================

export async function listAthletes() {
  const usersRef = collection(db, "users")
  const q = query(usersRef, orderBy("createdAt", "desc"))
  const snap = await getDocs(q)

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((u) => u.role === "athlete")
}

// ===============================
// Templates
// ===============================

export async function listTemplates() {
  const ref = collection(db, "workoutTemplates")
  const q = query(ref, orderBy("createdAt", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as any))
}

export async function createTemplate(params: { template: WorkoutTemplate }) {
  const { template } = params

  const ref = doc(collection(db, "workoutTemplates"))
  await setDoc(ref, {
    ...template,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return ref.id
}

// ===============================
// Assign template to athlete
// ===============================

export async function assignTemplateToAthlete(params: {
  athleteUid: string
  date: Date
  templateId: string
  template: WorkoutTemplate
}) {
  const { athleteUid, date, templateId, template } = params

  const workoutRef = doc(collection(db, "users", athleteUid, "workouts"))

  await setDoc(workoutRef, {
    // Identidad básica
    title: template.title,
    sport: template.sport,
    date: Timestamp.fromDate(date),
    status: "planned",

    // Resumen rápido
    duration: template.durationMin ?? null,
    distanceKm: template.distanceKm ?? null,

    // Intensidad principal (para dashboard legacy)
    intensity: {
      type:
        template.method === "power"
          ? "power"
          : template.method === "hr"
          ? "hr"
          : template.method === "pace"
          ? "pace"
          : "rpe",
      target: {
        zone: template.targetLabel ?? null,
        pct: template.intensityPct ?? null,
      },
    },

    // 🔥 BLOQUES NORMALIZADOS
    blocks: template.blocks ?? [],

    description: template.description ?? null,

    // Trazabilidad
    sourceTemplateId: templateId,
    sourceTemplateSnapshot: template,

    createdBy: "admin",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return workoutRef.id
}
