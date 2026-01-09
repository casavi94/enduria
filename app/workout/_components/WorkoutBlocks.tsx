type WorkoutBlock = {
  label?: string
  durationMin?: number
  target?: string
  note?: string
}

export default function WorkoutBlocks({ blocks }: { blocks?: WorkoutBlock[] }) {
  if (!blocks || blocks.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="font-semibold text-sm">Estructura del entreno</div>

      <div className="space-y-2">
        {blocks.map((b, i) => (
          <div key={i} className="border rounded p-3">
            <div className="flex justify-between items-center">
              <div className="font-medium text-sm">
                {b.label ?? `Bloque ${i + 1}`}
              </div>
              {b.durationMin && (
                <div className="text-xs opacity-70">
                  {b.durationMin} min
                </div>
              )}
            </div>

            {b.target && (
              <div className="text-sm mt-1">
                🎯 <strong>{b.target}</strong>
              </div>
            )}

            {b.note && (
              <div className="text-xs opacity-70 mt-1">
                {b.note}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
