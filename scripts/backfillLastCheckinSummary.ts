import admin from "firebase-admin"

// -------------------------------
// CONFIG
// -------------------------------
// 1) Ruta al JSON de service account
//    OJO: NO lo subas a Git
//
// Opción A (recomendada): variable de entorno GOOGLE_APPLICATION_CREDENTIALS
// Opción B: ruta fija aquí (menos recomendado)
const SERVICE_ACCOUNT_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || "serviceAccountKey.json"

// Cambia esto si quieres forzar reescritura aunque ya exista
const FORCE = process.env.FORCE === "true"

// Limita usuarios a procesar (para pruebas)
const USER_LIMIT = Number(process.env.USER_LIMIT || 0) // 0 = sin límite

// Limita workouts por usuario (para pruebas)
const WORKOUT_LIMIT = Number(process.env.WORKOUT_LIMIT || 0) // 0 = sin límite

// Concurrencia (cuántos workouts procesa a la vez)
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || 10))

// -------------------------------
// INIT ADMIN
// -------------------------------
function initAdmin() {
  if (admin.apps.length) return

  // Si usas GOOGLE_APPLICATION_CREDENTIALS, admin lo lee solo,
  // pero aquí lo permitimos también por ruta.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const serviceAccount = require(require("path").resolve(SERVICE_ACCOUNT_PATH))

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

// -------------------------------
// TYPES / HELPERS
// -------------------------------
type Summary = {
  rpe?: number
  fatigue?: number
  pain?: {
    hasPain: boolean
    intensity?: number
    area?: string
  }
}


function removeUndefinedDeep<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) {
    // @ts-ignore
    return obj.map(removeUndefinedDeep) as T
  }
  if (typeof obj === "object") {
    const out: any = {}
    for (const [k, v] of Object.entries(obj as any)) {
      if (v === undefined) continue
      out[k] = removeUndefinedDeep(v)
    }
    return out
  }
  return obj
}



function buildSummaryFromCheckin(checkin: admin.firestore.DocumentData): Summary {
  const pain = checkin?.pain
  return {
    rpe: typeof checkin?.rpe === "number" ? checkin.rpe : undefined,
    fatigue: typeof checkin?.fatigue === "number" ? checkin.fatigue : undefined,
    pain: {
      hasPain: Boolean(pain?.hasPain ?? false),
      intensity:
        typeof pain?.intensity === "number" ? pain.intensity : undefined,
      area: typeof pain?.area === "string" ? pain.area : undefined,
    },
  }
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let i = 0

  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx], idx)
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker()
  )
  await Promise.all(workers)
  return results
}

// -------------------------------
// MAIN
// -------------------------------
async function main() {
  initAdmin()
  const db = admin.firestore()

  console.log("✅ Backfill lastCheckinSummary starting…")
  console.log("Config:", {
    FORCE,
    USER_LIMIT: USER_LIMIT || "∞",
    WORKOUT_LIMIT: WORKOUT_LIMIT || "∞",
    CONCURRENCY,
  })

  // 1) Obtener usuarios (docs en /users)
  let usersQuery: admin.firestore.Query = db.collection("users")
  if (USER_LIMIT > 0) usersQuery = usersQuery.limit(USER_LIMIT)

  const usersSnap = await usersQuery.get()
  console.log(`Found users: ${usersSnap.size}`)

  let totalWorkoutsScanned = 0
  let totalUpdated = 0
  let totalSkippedNoCheckins = 0
  let totalSkippedAlreadyHas = 0
  let totalErrors = 0

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id

    // 2) Obtener workouts del usuario
    let workoutsQuery: admin.firestore.Query = db
      .collection("users")
      .doc(uid)
      .collection("workouts")

    if (WORKOUT_LIMIT > 0) workoutsQuery = workoutsQuery.limit(WORKOUT_LIMIT)

    const workoutsSnap = await workoutsQuery.get()
    console.log(`\nUser ${uid}: workouts=${workoutsSnap.size}`)

    totalWorkoutsScanned += workoutsSnap.size

    // Procesar workouts con concurrencia
    const workoutDocs = workoutsSnap.docs

    await mapLimit(workoutDocs, CONCURRENCY, async (wDoc) => {
      const workoutId = wDoc.id
      const workoutData = wDoc.data()

      try {
        const hasSummary = workoutData?.lastCheckinSummary != null

        if (hasSummary && !FORCE) {
          totalSkippedAlreadyHas++
          return
        }

        // 3) Buscar último check-in
        const checkinsRef = db
          .collection("users")
          .doc(uid)
          .collection("workouts")
          .doc(workoutId)
          .collection("checkins")

        const lastSnap = await checkinsRef
          .orderBy("completedAt", "desc")
          .limit(1)
          .get()

        if (lastSnap.empty) {
          totalSkippedNoCheckins++
          return
        }

        const lastDoc = lastSnap.docs[0]
        const checkin = lastDoc.data()
        const summaryRaw = buildSummaryFromCheckin(checkin)
        const summary = removeUndefinedDeep(summaryRaw)


        // lastCheckinAt: si el checkin tiene completedAt (Timestamp), úsalo.
        // Si no, ponemos serverTimestamp.
        const completedAt = checkin?.completedAt
        const lastCheckinAt =
          completedAt && typeof completedAt.toDate === "function"
            ? completedAt
            : admin.firestore.FieldValue.serverTimestamp()

        // 4) Actualizar workout
        await wDoc.ref.set(
          {
            lastCheckinSummary: summary,
            lastCheckinAt,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        )

        totalUpdated++
      } catch (e: any) {
        totalErrors++
        console.error(
          `❌ Error user=${uid} workout=${workoutId}:`,
          e?.message ?? e
        )
      }
    })
  }

  console.log("\n✅ DONE")
  console.log({
    totalWorkoutsScanned,
    totalUpdated,
    totalSkippedNoCheckins,
    totalSkippedAlreadyHas,
    totalErrors,
  })
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})
