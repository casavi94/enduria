"use client"

import { WorkoutBlock } from "@/lib/types/workoutBlocks"

export default function BlocksEditor({
  blocks,
  onChange,
}: {
  blocks: WorkoutBlock[]
  onChange: (b: WorkoutBlock[]) => void
}) {
  function updateBlock(i: number, patch: Partial<WorkoutBlock>) {
    const next = [...blocks]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }

  function updateTarget(i: number, patch: any) {
    const next = [...blocks]
    next[i] = {
      ...next[i],
      target: { ...next[i].target, ...patch },
    }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="font-semibold">Bloques del entreno</div>

      {blocks.map((b, i) => (
        <div key={i} className="border rounded p-3 space-y-2">
          <input
            className="border rounded p-2 w-full"
            placeholder="Nombre del bloque"
            value={b.label}
            onChange={(e) => updateBlock(i, { label: e.target.value })}
          />

          <input
            type="number"
            className="border rounded p-2 w-full"
            placeholder="Duración (min)"
            value={b.durationMin}
            onChange={(e) =>
              updateBlock(i, { durationMin: Number(e.target.value) })
            }
          />

          <select
            className="border rounded p-2 w-full"
            value={b.target.type}
            onChange={(e) =>
              updateBlock(i, {
                target:
                  e.target.value === "hr"
                    ? { type: "hr", min: 140, max: 155 }
                    : e.target.value === "power"
                    ? { type: "power", value: 180, tolerancePct: 5 }
                    : { type: "free" },
              })
            }
          >
            <option value="free">Libre</option>
            <option value="hr">Frecuencia cardíaca</option>
            <option value="power">Potencia</option>
          </select>

          {b.target.type === "hr" && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                className="border rounded p-2"
                placeholder="FC min"
                value={b.target.min}
                onChange={(e) =>
                  updateTarget(i, { min: Number(e.target.value) })
                }
              />
              <input
                type="number"
                className="border rounded p-2"
                placeholder="FC max"
                value={b.target.max}
                onChange={(e) =>
                  updateTarget(i, { max: Number(e.target.value) })
                }
              />
            </div>
          )}

          {b.target.type === "power" && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                className="border rounded p-2"
                placeholder="Vatios"
                value={b.target.value}
                onChange={(e) =>
                  updateTarget(i, { value: Number(e.target.value) })
                }
              />
              <input
                type="number"
                className="border rounded p-2"
                placeholder="± %"
                value={b.target.tolerancePct ?? 5}
                onChange={(e) =>
                  updateTarget(i, { tolerancePct: Number(e.target.value) })
                }
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
