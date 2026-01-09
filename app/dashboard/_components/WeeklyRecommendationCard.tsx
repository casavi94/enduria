"use client"

function round1(n: number) {
  return Math.round(n * 10) / 10
}

type RecAction = "rest" | "reduce" | "continue"

type Recommendation = {
  action: RecAction
  title: string
  message: string
}

type Signals = {
  avgRpe: number | null
  avgFatigue: number | null
  maxPain: number | null
}

function SignalPill({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="px-3 py-1 rounded-full border text-sm flex items-center gap-2 bg-white/70">
      <span className="opacity-70">{label}</span>
      <span className="font-semibold">{value === null ? "—" : round1(value)}</span>
    </div>
  )
}

function recommendationUI(action: RecAction) {
  if (action === "rest")
    return { emoji: "🛌", border: "border-red-300", bg: "bg-red-50" }
  if (action === "reduce")
    return { emoji: "📉", border: "border-amber-300", bg: "bg-amber-50" }
  return { emoji: "✅", border: "border-emerald-300", bg: "bg-emerald-50" }
}

export default function WeeklyRecommendationCard({
  recommendation,
  signals,
  triggers,
}: {
  recommendation: Recommendation
  signals: Signals
  triggers?: string[]
}) {
  const ui = recommendationUI(recommendation.action)
  const cleanTriggers = (triggers ?? []).filter(Boolean)

  return (
    <div className={`mt-3 rounded-2xl border ${ui.border} ${ui.bg} p-4`}>
      <div className="text-lg font-semibold">
        {ui.emoji} {recommendation.title}
      </div>

      <div className="text-sm opacity-80 mt-1">{recommendation.message}</div>

      {cleanTriggers.length > 0 && (
        <div className="text-xs opacity-70 mt-2">
          <span className="font-medium">Señales que han disparado la recomendación:</span>{" "}
          {cleanTriggers.join(" · ")}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <SignalPill label="avgRPE" value={signals.avgRpe} />
        <SignalPill label="avgFatiga" value={signals.avgFatigue} />
        <SignalPill label="maxDolor" value={signals.maxPain} />
      </div>
    </div>
  )
}
