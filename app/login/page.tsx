"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signInWithEmailAndPassword } from "firebase/auth"
import { auth } from "@/lib/firebase"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
  setError(null)
  setLoading(true)

  try {
    const cleanEmail = email.trim()
    const cleanPassword = password

    console.log("👉 login:", cleanEmail)

    const result = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword)
    console.log("✅ LOGIN OK:", result.user.uid)

    router.push("/dashboard")
  } catch (e: any) {
    console.log("❌ LOGIN ERROR:", e?.code, e?.message)

    if (e?.code === "auth/invalid-credential") {
      setError("Email o contraseña incorrectos (o ese usuario no es de tipo 'password').")
    } else if (e?.code === "auth/user-not-found") {
      setError("No existe ningún usuario con ese email.")
    } else if (e?.code === "auth/wrong-password") {
      setError("Contraseña incorrecta.")
    } else {
      setError(e?.message ?? "Error de login")
    }
  } finally {
    setLoading(false)
  }
}


  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center">ENDURIA</h1>

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
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-black text-white p-3 rounded"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <button
          onClick={() => router.push("/register")}
          className="w-full border p-3 rounded"
        >
          Crear cuenta
        </button>
      </div>
    </div>
  )
}
