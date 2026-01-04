"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  Timestamp,
} from "firebase/firestore"

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

function fmtRange(a: Date, b: Date) {
  const f = (x: Date) => x.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
  return `${f(a)} – ${f(b)}`
}

function fmtDayLabel(d: Date) {
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit" }).toUpperCase()
}

function statusBadge(status?: string) {
  if (status === "completed") return "✅"
  if (status === "modified") return "🟡"
  if (status === "skipped") return "❌"
  return "⬜"
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  const [userData, setUserData] = useState<any>(null)

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()))
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const [workouts, setWorkouts] = useState<any[]>([])
  const [nextWorkout, setNextWorkout] = useState<any>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login")
        return
      }

      try {
        setLoading(true)

        // 1) user doc
        const userRef = doc(db, "users", user.uid)
        const userSnap = await getDoc(userRef)
        if (!userSnap.exists()) {
          setUserData(null)
          setWorkouts([])
          setNextWorkout(null)
          return
        }
        setUserData(userSnap.data())

        // 2) workouts semana (lunes -> lunes siguiente)
        const start = Timestamp.fromDate(weekStart)
        const endExclusive = Timestamp.fromDate(addDays(weekStart, 7))

        const workoutsRef = collection(db, "users", user.uid, "workouts")
        const weekQ = query(
          workoutsRef,
          where("date", ">=", start),
          where("date", "<", endExclusive),
          orderBy("date", "asc")
        )

        const weekSnap = await getDocs(weekQ)
        const weekWorkouts = weekSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setWorkouts(weekWorkouts)

        // 3) próximo entreno (planned) desde ahora
        const now = Timestamp.fromDate(new Date())
        const nextQ = query(
          workoutsRef,
          where("date", ">=", now),
          where("status", "==", "planned"),
          orderBy("date", "asc"),
          limit(1)
        )

        const nextSnap = await getDocs(nextQ)
        setNextWorkout(nextSnap.empty ? null : { id: nextSnap.docs[0].id, ...nextSnap.docs[0].data() })
      } finally {
        setLoading(false)
      }
    })

    return () => unsub()
  }, [router, weekStart])

  if (loading) return <p className="p-6">Cargando dashboard...</p>

  if (!userData) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-bold">ENDURIA</h1>
        <p className="text-red-600">
          Este usuario ha iniciado sesión, pero no tiene documento en Firestore (users/{`{uid}`}).
        </p>
        <p className="text-sm text-gray-600">
          Solución: registra el usuario desde /register o crea el doc manualmente.
        </p>
      </div>
    )
  }

  // Agrupar workouts por día
  const byDay: Record<string, any[]> = {}
  for (const w of workouts) {
    const dt: Date | null = w?.date?.toDate ? w.date.toDate() : null
    if (!dt) continue
    const key = dt.toISOString().slice(0, 10)
    byDay[key] = byDay[key] || []
    byDay[key].push(w)
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">ENDURIA</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded p-4">
          <p className="text-lg">
            Semana <strong>{userData.currentWeek}</strong>
          </p>
          <p className="text-sm opacity-70">{fmtRange(weekDays[0], weekDays[6])}</p>
        </div>

        <div className="border rounded p-4">
          <p className="text-lg">
            Estado:{" "}
            <strong>
              {userData.status === "green" && "🟢 Verde"}
              {userData.status === "yellow" && "🟡 Amarillo"}
              {userData.status === "red" && "🔴 Rojo"}
            </strong>
          </p>
          <p className="text-sm opacity-70">Basado en sesiones completadas</p>
        </div>
      </div>

      {/* Selector semana */}
      <div className="flex items-center justify-between gap-2">
        <button className="border rounded px-3 py-2" onClick={() => setWeekStart((d) => addDays(d, -7))}>
          ⬅️ Semana anterior
        </button>
        <div className="text-sm opacity-70">{fmtRange(weekDays[0], weekDays[6])}</div>
        <button className="border rounded px-3 py-2" onClick={() => setWeekStart((d) => addDays(d, 7))}>
          Semana siguiente ➡️
        </button>
      </div>

      {/* Vista semanal */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((d) => {
          const key = d.toISOString().slice(0, 10)
          const dayWorkouts = byDay[key] || []

          return (
            <div key={key} className="border rounded p-3 space-y-2">
              <div className="text-xs font-semibold opacity-70">{fmtDayLabel(d)}</div>

              {dayWorkouts.length === 0 && <div className="text-sm opacity-40">—</div>}

              {dayWorkouts.map((w) => (
                <div
                  key={w.id}
                  className="border rounded p-2 cursor-pointer hover:opacity-80"
                  onClick={() => router.push(`/workout/${w.id}`)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm truncate">{w.title ?? "Entreno"}</div>
                    <div>{statusBadge(w.status)}</div>
                  </div>
                  <div className="text-xs opacity-60">{w.sport ?? ""}</div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Próximo entreno */}
      {nextWorkout ? (
        <div className="border rounded p-4 cursor-pointer" onClick={() => router.push(`/workout/${nextWorkout.id}`)}>
          <p className="font-semibold">Próximo entreno</p>
          <p>{nextWorkout.title}</p>
          <p className="text-sm text-gray-500">{nextWorkout.sport}</p>
        </div>
      ) : (
        <div className="border rounded p-4">
          <p className="font-semibold">No hay entrenos pendientes</p>
          <p className="text-sm text-gray-500">Crea workouts con campo date (Timestamp) para verlos aquí.</p>
        </div>
      )}
    </div>
  )
}
