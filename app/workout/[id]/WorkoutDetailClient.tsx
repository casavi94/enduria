"use client"

import { useEffect, useState } from "react"
import { onAuthStateChanged, User } from "firebase/auth"
import { useRouter } from "next/navigation"
import { auth } from "@/lib/firebase"
import CheckInForm from "./CheckInForm"

export default function WorkoutDetailClient({ workoutId }: { workoutId: string }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)

      if (!u) {
        router.replace("/login")
      }
    })

    return () => unsub()
  }, [router])

  if (loading) return <div className="text-sm opacity-70">Cargando...</div>
  if (!user) return null // ya redirige

  return (
    <div className="space-y-4">
      {/* TODO: aquí irá el detalle del entreno (título, bloques, etc.) */}

      <CheckInForm uid={user.uid} workoutId={workoutId} />
    </div>
  )
}
