"use client"

import { useState } from "react"
import { login, register } from "../../lib/auth"
import { createAthleteProfile } from "../../lib/createAthleteProfile"


export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleLogin = async () => {
    setError("")
    console.log("👉 intentando login:", email)

    try {
      const user = await login(email, password)
      console.log("✅ LOGIN OK:", user)
      alert("Login correcto")
    } catch (err: any) {
      console.error("❌ LOGIN ERROR:", err)
      setError(err.message)
    }
  }

  const handleRegister = async () => {
  setError("")
  console.log("👉 intentando registro:", email)

  try {
    const result = await register(email, password)
    const user = result.user

    console.log("✅ USUARIO AUTH CREADO:", user.uid)

    await createAthleteProfile(user.uid, user.email || "")

    console.log("✅ PERFIL DE ATLETA CREADO")

    alert("Usuario y perfil creados correctamente")
  } catch (err: any) {
    console.error("❌ ERROR REGISTRO:", err)
    setError(err.message)
  }
}


  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">ENDURIA</h1>

        <input
          className="border p-3 w-full mb-3 rounded"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="border p-3 w-full mb-4 rounded"
          type="password"
          placeholder="Contraseña (mín. 6 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p className="text-red-500 text-sm mb-3">{error}</p>
        )}

        <button
          className="w-full bg-black text-white py-3 rounded mb-2"
          onClick={handleLogin}
        >
          Entrar
        </button>

        <button
          className="w-full border py-3 rounded"
          onClick={handleRegister}
        >
          Registrarse
        </button>
      </div>
    </div>
  )
}
