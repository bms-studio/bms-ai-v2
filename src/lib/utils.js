// Tiny class-name combiner
export function cn(...args) {
  return args.filter(Boolean).join(" ")
}

// Unique short id
export function uid() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9)
}

// Truncate with ellipsis
export function truncate(s, n = 80) {
  s = String(s == null ? "" : s)
  return s.length > n ? s.slice(0, n).trimEnd() + "..." : s
}

// Format a timestamp like "29 Jun, 19:04"
export function fmtDate(ts) {
  if (!ts) return "now"
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
    }).format(new Date(ts))
  } catch (e) { return "now" }
}

// HTML entity map (built once at module load).
// Using fromCharCode keeps the literal source free of HTML entities so
// no editor formatter will strip or "fix" them.
const E = {
  amp:  String.fromCharCode(38),
  lt:   String.fromCharCode(60),
  gt:   String.fromCharCode(62),
  quot: String.fromCharCode(34),
  apos: String.fromCharCode(39),
  nbsp: String.fromCharCode(160)
}

export function escHtml(s) {
  s = String(s == null ? "" : s)
  return s
    .replace(/&/g, "&" + E.amp)
    .replace(/</g, "&" + E.lt)
    .replace(/>/g, "&" + E.gt)
    .replace(/"/g, "&" + E.quot)
    .replace(/'/g, "&" + E.apos)
}

// Lightweight markdown -> HTML
export function md(src) {
  let t = String(src == null ? "" : src).replace(/\r\n/g, "\n")
  t = escHtml(t)
  t = t.replace(/```([a-zA-Z0-9_+\-#.]*)?\n([\s\S]*?)```/g,
    (_, _l, code) => "<pre class=\"md-pre\"><code>" + code + "</code></pre>")
  t = t.replace(/`([^`]+)`/g, "<code class=\"md-inline\">$1</code>")
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  t = t.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
  t = t.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>")
  t = t.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>")
  t = t.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>")
  t = t.replace(/\[([^\]]+)\]\((https?:[^\s)]+)\)/g,
    "<a href=\"$2\" target=\"_blank\" rel=\"noreferrer\">$1</a>")
  t = t.replace(/(?:^|\n)(- .+(?:\n- .+)*)/g, function (m) {
    var items = m.trim().split("\n").map(function (l) { return l.replace(/^- /, "") })
    return "\n<ul>" + items.map(function (i) { return "<li>" + i + "</li>" }).join("") + "</ul>"
  })
  t = t.replace(/(?:^|\n)(\d+\. .+(?:\n\d+\. .+)*)/g, function (m) {
    var items = m.trim().split("\n").map(function (l) { return l.replace(/^\d+\. /, "") })
    return "\n<ol>" + items.map(function (i) { return "<li>" + i + "</li>" }).join("") + "</ol>"
  })
  t = t.replace(/\n\n+/g, "</p><p>")
  t = "<p>" + t + "</p>"
  t = t.replace(/<p>\s*<\/(h\d|ul|ol|pre)/g, "<$1")
  t = t.replace(/<\/(h\d|ul|ol|pre)>\s*<\/p>/g, "</$1>")
  return t
}

// Safe clipboard write
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (e1) {
    try {
      var ta = document.createElement("textarea")
      ta.value = text
      ta.style.position = "fixed"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      return true
    } catch (e2) { return false }
  }
}

// Convert a File to a blob URL
export function fileToURL(file) {
  return URL.createObjectURL(file)
}