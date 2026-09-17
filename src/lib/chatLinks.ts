/** Parse & sanitize URLs trong chat */

const URL_RE =
  /(?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?"')\]}>]/gi

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_RE) ?? []
  return [...new Set(matches.map(normalizeUrl).filter(Boolean))]
}

export function normalizeUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  if (/^www\./i.test(t)) return `https://${t}`
  return ''
}

/** Chỉ cho phép http(s) — tránh javascript: */
export function safeHref(raw: string): string | null {
  const url = normalizeUrl(raw)
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.href
  } catch {
    return null
  }
}

export type TextPart = { type: 'text'; value: string } | { type: 'link'; value: string; href: string }

export function splitTextWithLinks(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  const re = new RegExp(URL_RE.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) })
    const raw = m[0]
    const href = safeHref(raw)
    if (href) parts.push({ type: 'link', value: raw, href })
    else parts.push({ type: 'text', value: raw })
    last = m.index + raw.length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts.length ? parts : [{ type: 'text', value: text }]
}
