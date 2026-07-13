function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function editDistance(left: string, right: string) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      )
    }
    previous = current
  }

  return previous[right.length]
}

export function locationSearchScore(location: string | null, query: string) {
  const needle = normalize(query)
  if (!needle) return 0

  const target = normalize(location ?? "")
  if (!target) return null

  const directIndex = target.indexOf(needle)
  if (directIndex >= 0) return directIndex / target.length

  const targetWords = target.split(" ")
  let score = 1

  for (const queryWord of needle.split(" ")) {
    if (queryWord.length < 3) return null

    const distance = Math.min(...targetWords.map((word) => editDistance(queryWord, word)))
    const tolerance = Math.max(1, Math.round(queryWord.length / 3))
    if (distance > tolerance) return null
    score += distance / queryWord.length
  }

  return score
}
