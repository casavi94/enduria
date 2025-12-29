"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore"

export default function SessionDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    const loadSession = async () => {
      const user = auth.currentUser
      if (!user) return

      const ref = doc(db, "users", user.uid, "sessions", id as string)
      const snap = await getDoc(ref)

      if (snap.exists()) {
        setSession(snap.data())
      }
    }

    loadSession()
  }, [id])

  const updateUserStatus = async (userId: string, week: number) => {
    const sessionsRef = collection(db, "users", userId, "sessions")
    const q = query(sessionsRef, where("week", "==", week))
    const snap = await getDocs(q)

    const total = snap.docs.length
    const completed = snap.docs.filter(
      d => d.data().completed === true
    ).length

    if (total === 0) return

    const percentage = (completed / total) * 100

    let status = "green"
    if (percentage < 50) status = "red"
    else if (percentage < 80) status = "yellow"

    const userRef = doc(db, "users", userId)
    await updateDoc(userRef, { status })

    // Avanzar semana si todo está completado
    if (completed === total) {
      await updateDoc(userRef, {
        currentWeek: week + 1
      })
    }
  }

  const markAsCompleted = async () => {
    const user = auth.currentUser
    if (!user || !session) return

    const sessionRef = doc(db, "users", user.uid, "sessions", id as string)

    // Marcar sesión
    await updateDoc(sessionRef, { completed: true })

    // Recalcular estado
    await updateUserStatus(user.uid, session.week)

    router.push("/dashboard")
  }

  if (!session) return <p>Cargando sesión...</p>

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
      {!session.completed && (
        <button
          onClick={markAsCompleted}
          className="w-full bg-black text-white p-3 rounded"
        >
          Marcar sesión como completada
        </button>
      )}

      {session.completed && (
        <p className="text-green-600 font-semibold">
          ✅ Sesión completada
        </p>
      )}
    </div>
  )
}
