// Elimina undefined recursivamente (Firestore no lo soporta)
export function deepClean<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((v) => deepClean(v))
      .filter((v) => v !== undefined) as any
  }

  if (value && typeof value === "object") {
    const out: any = {}
    for (const [k, v] of Object.entries(value as any)) {
      const cleaned = deepClean(v)
      if (cleaned !== undefined) out[k] = cleaned
    }
    // Si el objeto queda vacío, devuélvelo como undefined para que no se guarde
    if (Object.keys(out).length === 0) return undefined as any
    return out
  }

  return value
}
