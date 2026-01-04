"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"

export default function SessionDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()

  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        setLoading(true)
        setError(null)

        if (!user) {
          router.replace("/login")
          return
        }

        if (!id) {
          setError("Falta el id en la URL.")
          setSession(null)
          return
        }

        // DEBUG (opcional): confirma UID real
        console.log("[SessionDetail] UID:", user.uid, "ID:", id)

        // 1) Leer session
        const sessionRef = doc(db, "users", user.uid, "sessions", id)
        const snap = await getDoc(sessionRef)

        if (!snap.exists()) {
          setSession(null)
          setError(
            `No se encontró la sesión en users/${user.uid}/sessions/${id}.`
          )
          return
        }

        const sessionData = snap.data()
        setSession(sessionData)

        // 2) Crear/actualizar workout espejo
        const workoutRef = doc(db, "users", user.uid, "workouts", id)

        await setDoc(
          workoutRef,
          {
            title: sessionData.title ?? "Entreno",
            sport: sessionData.sport ?? "run",
            date: sessionData.date, // debe ser Timestamp
            status: sessionData.completed ? "completed" : "planned",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      } catch (e: any) {
        setError(e?.message ?? "Error cargando sesión")
        setSession(null)
      } finally {
        setLoading(false)
      }
    })

    return () => unsub()
  }, [id, router])

  if (loading) return <p className="p-6">Cargando sesión...</p>

  if (!session) {
    return (
      <div className="p-6 space-y-2">
        <p className="font-semibold">No se encontró la sesión</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-sm opacity-70">
          Revisa que estás logueado con el mismo usuario (UID) donde creaste
          <strong> sessions/{id}</strong>.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Cabecera */}
      <div>
        <h1 className="text-2xl font-bold">{session.title}</h1>
        <p className="text-gray-500">
          {session.sport} · {session.duration} min
        </p>
      </div>

      {/* Descripción */}
      {session.description && (
        <p className="text-gray-700">{session.description}</p>
      )}

      {/* Bloques */}
      {session.blocks && (
        <div className="space-y-2">
          <h2 className="font-semibold">Estructura del entreno</h2>

          {session.blocks.map((block: any, index: number) => (
            <div
              key={index}
              className="border rounded p-3 flex justify-between text-sm"
            >
              <span>
                {block.type}
                {block.zone && ` (${block.zone})`}
                {block.repeat && ` x${block.repeat}`}
              </span>
              <span>{block.duration} min</span>
            </div>
          ))}
        </div>
      )}

      {/* Acción */}
      <button
        onClick={() => router.push(`/workout/${id}`)}
        className="w-full bg-black text-white p-3 rounded"
      >
        Abrir detalle y registrar check-in
      </button>

      {session.completed && (
        <p className="text-green-600 font-semibold">✅ Sesión completada</p>
      )}
    </div>
  )
}
