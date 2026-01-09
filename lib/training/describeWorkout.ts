export function describeWorkoutFromBlocks(blocks: any[]): string {
  if (!blocks || blocks.length === 0) return ""

  const lines = blocks.map((b: any) => {
    const d = b.durationMin ? `${b.durationMin}’` : ""
    const t = b.target ? ` a ${b.target}` : ""
    return `• ${b.label ?? "Bloque"}: ${d}${t}`
  })

  return [
    "Entrenamiento estructurado:",
    ...lines,
    "",
    "Concéntrate en mantener la intensidad indicada y una técnica eficiente.",
  ].join("\n")
}
