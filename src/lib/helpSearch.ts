// Búsqueda dentro de la guía: encuentra en qué tema y bajo qué apartado se habla de lo que se escribe.
import { stripAccents } from './spreadsheet'

export interface HelpSource { slug: string; title: string; raw: string }
export interface HelpHit { slug: string; topicTitle: string; heading: string; snippet: string }

const norm = (s: string) => stripAccents(s).toLowerCase()
const plain = (s: string) => s.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^[-#\s]+/, '').trim()

/** Un resultado por apartado (## …) que contenga todas las palabras buscadas; los apartados cuyo título las contiene van primero. */
export function searchHelp(topics: HelpSource[], query: string, limit = 12): HelpHit[] {
  const words = norm(query).split(/\s+/).filter(w => w.length >= 3)
  if (words.length === 0) return []
  const hits: (HelpHit & { score: number })[] = []
  for (const topic of topics) {
    let heading = topic.title
    let lines: string[] = []
    const flush = () => {
      const text = norm(`${heading} ${lines.join(' ')}`)
      if (words.every(w => text.includes(w))) {
        const inHeading = words.every(w => norm(heading).includes(w))
        const line = lines.find(l => words.some(w => norm(l).includes(w))) ?? lines[0] ?? ''
        const clean = plain(line)
        hits.push({
          slug: topic.slug, topicTitle: topic.title, heading,
          snippet: clean.length > 140 ? `${clean.slice(0, 137)}…` : clean,
          score: inHeading ? 0 : 1,
        })
      }
    }
    for (const line of topic.raw.split(/\r?\n/)) {
      const h = /^#{1,3}\s+(.*)$/.exec(line)
      if (h) { flush(); heading = plain(h[1]); lines = []; continue }
      if (line.trim()) lines.push(line)
    }
    flush()
  }
  return hits.sort((a, b) => a.score - b.score).slice(0, limit).map(({ score: _score, ...hit }) => hit)
}
