"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { getMyRole, listAthletes } from "@/lib/firestore/admin"

export default function AdminHomePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [athletes, setAthletes] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login")
        return
      }

      setLoading(true)
      setError(null)

      try {
        const role = await getMyRole(user.uid)
        if (role !== "admin" && role !== "coach") {
          router.replace("/dashboard")
          return
        }

        const rows = await listAthletes()
        setAthletes(rows)
      } catch (e: any) {
        setError(e?.message ?? "Error cargando atletas")
      } finally {
        setLoading(false)
      }
    })

    return () => unsub()
  }, [router])

  if (loading) return <div className="opacity-70">Cargando admin…</div>

  return (
    <div className="space-y-4">
      <div className="text-lg font-semibold">Atletas</div>
      {error && <div className="text-sm text-red-600">{error}</div>}

      {athletes.length === 0 ? (
        <div className="border rounded p-4 text-sm opacity-70">
          No hay atletas todavía.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {athletes.map((a) => (
            <button
              key={a.id}
              className="text-left border rounded p-4 hover:opacity-90"
              onClick={() => router.push(`/admin/athletes/${a.id}`)}
            >
              <div className="font-semibold">{a.name ?? "Atleta"}</div>
              <div className="text-sm opacity-70">{a.email ?? a.id}</div>
              <div className="text-xs opacity-60 mt-1">
                Week: {a.currentWeek ?? "—"} · Estado:{" "}
                {a.weeklyAutoStatus?.status ?? "—"}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
