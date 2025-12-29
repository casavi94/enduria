import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "./firebase"

export const createAthleteProfile = async (
  uid: string,
  email: string
) => {
  // Documento base de usuario
  await setDoc(doc(db, "users", uid), {
    id: uid,
    email,
    role: "athlete",
    created_at: serverTimestamp(),
  })

  // Perfil de atleta
  await setDoc(doc(db, "athlete_profiles", uid), {
    user_id: uid,
    ftp: 0,
    max_hr: 0,
    weekly_availability: {
      min_hours: 0,
      max_hours: 0,
    },
    level: "beginner",
    created_at: serverTimestamp(),
  })
}
