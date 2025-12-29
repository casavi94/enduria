"use client"

import { useEffect, useState } from "react"
import { auth, db } from "@/lib/firebase"
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from "firebase/firestore"
import { useRouter } from "next/navigation"

export default function DashboardPage() {
  const router = useRouter()
  const [userData, setUserData] = useState<any>(null)
  const [nextSession, setNextSession] = useState<any>(null)
  const [nextSessionId, setNextSessionId] = useState<string | null>(null)

  useEffect(() => {
    const loadDashboard = async () => {
      const user = auth.currentUser
      if (!user) return

      // Datos usuario
      const userRef = doc(db, "users", user.uid)
      const userSnap = await getDoc(userRef)
      setUserData(userSnap.data())

      // Próxima sesión
      const sessionsRef = collection(db, "users", user.uid, "sessions")
      const q = query(
        sessionsRef,
        where("completed", "==", false),
        orderBy("date"),
        limit(1)
      )

      const snap = await getDocs(q)
      if (!snap.empty) {
        setNextSession(snap.docs[0].data())
        setNextSessionId(snap.docs[0].id)
      }
    }

    loadDashboard()
  }, [])

  if (!userData) return <p>Cargando dashboard...</p>

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">ENDURIA</h1>

      {/* Semana */}
      <div className="border rounded p-4">
        <p className="text-lg">
          Semana <strong>{userData.currentWeek}</strong>
        </p>
      </div>

      {/* Estado */}
      <div className="border rounded p-4">
        <p className="text-lg">
          Estado:{" "}
          <strong>
            {userData.status === "green" && "🟢 Verde"}
            {userData.status === "yellow" && "🟡 Amarillo"}
            {userData.status === "red" && "🔴 Rojo"}
          </strong>
        </p>
      </div>

      {/* Próxima sesión */}
      {nextSession && (
        <div
          className="border rounded p-4 cursor-pointer"
          onClick={() => router.push(`/session/${nextSessionId}`)}
        >
          <p className="font-semibold">Próxima sesión</p>
          <p>{nextSession.title}</p>
          <p className="text-sm text-gray-500">{nextSession.sport}</p>
        </div>
      )}
    </div>
  )
}
