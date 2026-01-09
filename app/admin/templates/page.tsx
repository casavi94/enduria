"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { getMyRole, listTemplates } from "@/lib/firestore/admin"

export default function AdminTemplatesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<any[]>([])
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

        const rows = await listTemplates()
        setTemplates(rows)
      } catch (e: any) {
        setError(e?.message ?? "Error cargando plantillas")
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [router])

  if (loading) return <div className="opacity-70">Cargando plantillas…</div>

  return (
    <div className="space-y-4">
      <div className="text-lg font-semibold">Plantillas</div>
      {error && <div className="text-sm text-red-600">{error}</div>}

      {templates.length === 0 ? (
        <div className="border rounded p-4 text-sm opacity-70">
          No hay plantillas todavía. Crea una en “Nueva plantilla”.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {templates.map((t) => (
            <div key={t.id} className="border rounded p-4">
              <div className="font-semibold">{t.title}</div>
              <div className="text-sm opacity-70">
                {t.sport} · {t.method}
                {t.durationMin ? ` · ${t.durationMin} min` : ""}
                {t.targetLabel ? ` · ${t.targetLabel}` : ""}
                {t.intensityPct ? ` · ${t.intensityPct}%` : ""}
              </div>
              {t.description && <div className="text-sm mt-2 opacity-80">{t.description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
