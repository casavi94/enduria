import WorkoutDetailClient from "./WorkoutDetailClient"

export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <WorkoutDetailClient workoutId={id} />
    </div>
  )
}
