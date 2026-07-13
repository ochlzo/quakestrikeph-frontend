export type MagnitudeRange = {
  from: number
  to?: number
  upperExclusive?: boolean
}

export const MAGNITUDE_RANGE_OPTIONS = [
  {
    value: "magnitude-below-3",
    label: "Below M3",
    colorClass: "bg-magnitude-below-3",
    range: { from: 0, to: 3, upperExclusive: true },
  },
  {
    value: "magnitude-3",
    label: "M3–3.9",
    colorClass: "bg-magnitude-3",
    range: { from: 3, to: 4, upperExclusive: true },
  },
  {
    value: "magnitude-4",
    label: "M4–4.9",
    colorClass: "bg-magnitude-4",
    range: { from: 4, to: 5, upperExclusive: true },
  },
  {
    value: "magnitude-5-plus",
    label: "M5+",
    colorClass: "bg-magnitude-5-plus",
    range: { from: 5 },
  },
] as const

const OPTION_BY_VALUE = new Map(
  MAGNITUDE_RANGE_OPTIONS.map((option) => [option.value, option])
)
const CUSTOM_RANGE_PATTERN = /^((?:\d+(?:\.\d+)?|\.\d+))\s*-\s*((?:\d+(?:\.\d+)?|\.\d+))$/

export function parseCustomMagnitudeRanges(input: string) {
  const tokens = input.split(",").map((token) => token.trim()).filter(Boolean)
  if (!tokens.length) return { values: [], error: "Enter a range like 1-2." }

  const values: string[] = []
  for (const token of tokens) {
    const match = token.match(CUSTOM_RANGE_PATTERN)
    if (!match) return { values: [], error: `“${token}” must use the format <num>-<num>.` }

    const from = Number(match[1])
    const to = Number(match[2])
    if (from > to) return { values: [], error: `“${token}” must start with the lower value.` }
    values.push(`${from}-${to}`)
  }

  return { values: [...new Set(values)] }
}

export function magnitudeSelectionsToRanges(values: string[]): MagnitudeRange[] {
  return values.flatMap((value) => {
    const preset = OPTION_BY_VALUE.get(value as (typeof MAGNITUDE_RANGE_OPTIONS)[number]["value"])
    if (preset) return [{ ...preset.range }]

    const match = value.match(CUSTOM_RANGE_PATTERN)
    return match ? [{ from: Number(match[1]), to: Number(match[2]) }] : []
  })
}

export function magnitudeRangeFilter(ranges: MagnitudeRange[]) {
  return ranges.map(({ from, to, upperExclusive }) =>
    to === undefined
      ? `Magnitude.gte.${from}`
      : `and(Magnitude.gte.${from},Magnitude.${upperExclusive ? "lt" : "lte"}.${to})`
  ).join(",")
}
