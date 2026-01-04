"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    setError(null)
    setLoading(true)

    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)
      const user = result.user

      // ✅ ESTO ES LO QUE TE FALTA:
      // Crear el documento users/{uid} en Firestore
      await setDoc(doc(db, "users", user.uid), {
        name: name || "",
        email: user.email,
        role: "athlete",
        currentWeek: 1,
        status: "green",
        createdAt: serverTimestamp(),
      })

      router.push("/dashboard")
    } catch (e: any) {
      setError(e?.message ?? "Error registrando usuario")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center">ENDURIA · Registro</h1>

        <input
          className="border p-3 w-full"
          placeholder="Nombre (opcional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="border p-3 w-full"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="border p-3 w-full"
          placeholder="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-black text-white p-3 rounded"
        >
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>

        <button
          onClick={() => router.push("/login")}
          className="w-full border p-3 rounded"
        >
          Ya tengo cuenta
        </button>
      </div>
    </div>
  )
}
