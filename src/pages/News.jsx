import { useState, useMemo, useEffect } from "react"
import { Newspaper, ExternalLink, Search, Filter, Loader2, Calendar, Hash, User, Image as ImageIcon, X, ArrowLeft, Sparkles, Globe, Tag } from "lucide-react"
import StatusBadge from "../components/StatusBadge.jsx"
import { SectionHead, EmptyState, ErrorBox } from "../components/UI.jsx"
import { useToast } from "../state/ToastContext.jsx"
import { NEWS } from "../config/endpoints.js"
import { postXylo } from "../lib/api.js"

// Curated search categories — like a news player filter
const SEARCH_CATEGORIES = [
  { id: "all",      label: "All",         query: "" },
  { id: "tech",     label: "Tech",        query: "technology OR AI OR software OR startup" },
  { id: "world",    label: "World",       query: "international OR global OR world" },
  { id: "business", label: "Business",    query: "business OR economy OR market OR finance" },
  { id: "sports",   label: "Sports",      query: "sports OR football OR basketball OR soccer" },
  { id: "science",  label: "Science",     query: "science OR space OR research OR NASA" },
  { id: "health",   label: "Health",      query: "health OR medical OR vaccine OR hospital" },
  { id: "politics", label: "Politics",    query: "politic OR government OR election OR president" },
  { id: "ent",      label: "Entertainment", query: "entertainment OR movie OR music OR celebrity" }
]

const REGIONS = ["All", "Global", "Indonesia"]

export default function News() {
  const toast = useToast()
  const [region, setRegion] = useState("All")
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("all")
  const [busyId, setBusyId] = useState(null)
  const [results, setResults] = useState({})
  const [errors, setErrors] = useState({})

  // Custom topic
  const [customTopic, setCustomTopic] = useState("")

  // Detail view state
  const [activeSource, setActiveSource] = useState(null) // news object

  const list = NEWS.filter((n) =>
    (region === "All" || n.region === region) &&
    (!q || (n.name + " " + n.id).toLowerCase().includes(q.toLowerCase()))
  )

  const currentCat = SEARCH_CATEGORIES.find((c) => c.id === cat) || SEARCH_CATEGORIES[0]

  // When a custom topic is set, it overrides the curated category for filtering
  const activeQuery = useMemo(() => {
    const t = customTopic.trim()
    if (t) return t
    return currentCat.query
  }, [customTopic, currentCat])

  const activeFilterLabel = customTopic.trim() ? `"${customTopic.trim()}"` : currentCat.label

  async function run(n) {
    setBusyId(n.id); setErrors((e) => ({ ...e, [n.id]: null }))
    try {
      const data = await postXylo(n.path, {})
      const items = collectArticles(data)
      const filtered = applyFilter(items, activeQuery)
      setResults((r) => ({ ...r, [n.id]: { ts: Date.now(), items, filtered } }))
      toast.success("Done", `${n.name}: ${filtered.length}/${items.length} article(s)`)
    } catch (err) {
      setErrors((e) => ({ ...e, [n.id]: true }))
      toast.error("Failed", `${n.name}: ${err.message || "tidak bisa memuat feed"}`)
    } finally { setBusyId(null) }
  }

  async function runAll() {
    for (const ep of list) await run(ep)
  }

  // Re-filter cached results when the custom topic or category changes
  useEffect(() => {
    setResults((r) => {
      const next = {}
      for (const k of Object.keys(r)) {
        const entry = r[k]
        next[k] = { ...entry, filtered: applyFilter(entry.items || [], activeQuery) }
      }
      return next
    })
  }, [activeQuery])

  function applyFilter(items, query) {
    if (!query) return items
    const q = String(query).toLowerCase()
    // OR-separated terms
    const terms = q.split(/\s+or\s+/i).map((t) => t.trim()).filter(Boolean)
    return items.filter((it) => {
      const hay = ((it.title || "") + " " + (it.description || "") + " " + (it.category || "") + " " + (it.source || "")).toLowerCase()
      return terms.some((term) => hay.includes(term))
    })
  }

  function fmtDate(p) {
    if (!p) return ""
    try { return new Date(p).toLocaleDateString("en-US", { day: "2-digit", month: "short" }) }
    catch { return p }
  }

  // If a source is open in detail view, render that instead
  if (activeSource) {
    return <NewsDetail
      source={activeSource}
      onBack={() => setActiveSource(null)}
      filterLabel={activeFilterLabel}
      filterQuery={activeQuery}
      initialResult={results[activeSource.id]}
      onResult={(r) => setResults((x) => ({ ...x, [activeSource.id]: r }))}
    />
  }

  return (
    <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto">
      <SectionHead
        kicker="// news"
        title="News Portal"
        sub={`${NEWS.length} sources - pick a category, set a custom topic, or open a source for the full feed.`}
      >
        <StatusBadge variant="success" dot>Online</StatusBadge>
      </SectionHead>

      {/* Category filter pills */}
      <div className="panel p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={12} className="text-gold" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/70">Category</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SEARCH_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => { setCat(c.id); setCustomTopic("") }}
              className={"px-3 py-1.5 border text-[10px] font-mono uppercase tracking-[0.08em] transition-colors " +
                (cat === c.id && !customTopic
                  ? "border-gold/40 bg-gold/10 text-gold shadow-glow-gold"
                  : "border-white/10 text-white/60 hover:border-white/20 hover:text-white")}
            >{c.label}</button>
          ))}
        </div>
      </div>

      {/* Custom topic + region + run all */}
      <div className="panel p-4 mb-6 grid gap-3 md:grid-cols-3">
        {/* Custom topic input */}
        <div className="md:col-span-2 flex items-center gap-2 border border-white/10 px-3 py-2 bg-jet/40 focus-within:border-gold/40">
          <Sparkles size={14} className="text-gold shrink-0" />
          <input
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder='Custom topic (e.g. "cryptocurrency", "AI art", "olympics 2026")...'
            className="bg-transparent outline-none flex-1 text-sm text-white placeholder:text-white/30"
          />
          {customTopic && (
            <button onClick={() => setCustomTopic("")} className="text-white/40 hover:text-white" title="Clear">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Region */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/40 flex items-center gap-1">
            <Globe size={11} /> Region
          </span>
          {REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              className={"px-2 py-1 border text-[10px] font-mono uppercase tracking-[0.08em] " +
                (region === r
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : "border-white/10 text-white/60 hover:border-white/20")}
            >{r}</button>
          ))}
        </div>

        {/* Source name filter */}
        <div className="md:col-span-2 flex items-center gap-2 border border-white/10 px-3 py-2 bg-jet/40 focus-within:border-gold/40">
          <Search size={14} className="text-white/40 shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter sources by name..."
            className="bg-transparent outline-none flex-1 text-sm text-white placeholder:text-white/30"
          />
        </div>

        <button
          onClick={runAll}
          disabled={!list.length || !!busyId}
          className="btn-primary btn-sm"
        >
          {busyId ? <Loader2 size={12} className="animate-spin" /> : <Newspaper size={12} />}
          Fetch all
        </button>
      </div>

      {/* Active filter indicator */}
      {activeQuery && (
        <div className="mb-4 flex items-center gap-2 text-[11px] font-mono">
          <Tag size={11} className="text-gold" />
          <span className="text-white/40">Filtering by:</span>
          <span className="text-gold">{activeFilterLabel}</span>
          <span className="text-white/30">— click "Open feed" on a source to see the full list</span>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((n) => {
          const r = results[n.id]
          const e = errors[n.id]
          const busy = busyId === n.id
          const filteredCount = r?.filtered?.length
          const totalCount = r?.items?.length
          return (
            <div key={n.id} className="panel p-3 flex flex-col hover:border-gold/30 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="font-bold text-white text-sm truncate">{n.name}</div>
                  <div className="text-[10px] font-mono text-white/40 break-all">{n.path}</div>
                </div>
                <StatusBadge variant={n.region === "Indonesia" ? "warning" : "info"}>{n.region}</StatusBadge>
              </div>

              {e && (
                <div className="text-[11px] text-destructive/80 mb-2 flex items-center gap-1">
                  <X size={11} /> unable to load feed
                </div>
              )}

              {r && totalCount > 0 && (
                <ul className="space-y-2 mb-2 flex-1">
                  {(r.filtered || r.items).slice(0, 3).map((a, i) => (
                    <li key={i} className="border border-white/5 p-2 hover:border-gold/30 transition-colors group">
                      <a href={a.url || "#"} target="_blank" rel="noreferrer" className="block">
                        {a.image && (
                          <div className="aspect-[16/9] mb-1.5 overflow-hidden bg-jet border border-white/5">
                            <img src={a.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" onError={(ev) => ev.target.parentElement.style.display = "none"} />
                          </div>
                        )}
                        <div className="font-bold text-[12px] text-white line-clamp-2 group-hover:text-gold">{a.title}</div>
                        {a.description && (
                          <div className="text-[10px] text-white/50 line-clamp-2 mt-1">{a.description}</div>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 text-[9px] font-mono text-white/40">
                          {a.published && <span className="flex items-center gap-0.5"><Calendar size={9} />{fmtDate(a.published)}</span>}
                          {a.category && <span className="flex items-center gap-0.5"><Hash size={9} />{a.category}</span>}
                          {a.source && <span className="flex items-center gap-0.5"><User size={9} />{a.source}</span>}
                        </div>
                      </a>
                    </li>
                  ))}
                  {filteredCount > 3 && (
                    <li className="text-[10px] font-mono text-white/40 text-center">+{filteredCount - 3} more</li>
                  )}
                </ul>
              )}

              {r && totalCount === 0 && (
                <div className="text-[11px] text-white/40 italic mb-2 flex-1">No articles returned.</div>
              )}

              {r && totalCount > 0 && filteredCount === 0 && (
                <div className="text-[11px] text-white/40 italic mb-2 flex-1">
                  No matches for "{activeFilterLabel}". Try a different topic.
                </div>
              )}

              <div className="flex gap-2 mt-auto">
                <button onClick={() => run(n)} disabled={busy} className="btn-primary btn-sm flex-1">
                  {busy ? <><Loader2 size={12} className="animate-spin" /> Fetching...</> : r ? "Refresh" : "Fetch"}
                </button>
                {r && totalCount > 0 && (
                  <button
                    onClick={() => setActiveSource(n)}
                    className="btn-sm border border-gold/30 text-gold hover:bg-gold/10 px-3"
                    title="Open full feed"
                  >
                    Open feed
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- Detail view (one source, full feed) ----------------
function NewsDetail({ source, onBack, filterLabel, filterQuery, initialResult, onResult }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [items, setItems] = useState(initialResult?.items || [])
  const [fetched, setFetched] = useState(!!initialResult)
  const [view, setView] = useState("filtered") // "filtered" | "all"
  const [localQ, setLocalQ] = useState("")

  // Refresh
  async function fetchNow() {
    setBusy(true); setError(null)
    try {
      const data = await postXylo(source.path, {})
      const arr = collectArticles(data)
      setItems(arr)
      setFetched(true)
      onResult({ ts: Date.now(), items: arr })
      toast.success("Fetched", `${arr.length} articles from ${source.name}`)
    } catch (err) {
      setError(err.message || "Failed")
      toast.error("Failed", err.message || "error")
    } finally { setBusy(false) }
  }

  // Auto-fetch on first open if no cached data
  useEffect(() => { if (!fetched) fetchNow() /* eslint-disable-line */ }, [])

  const filtered = useMemo(() => {
    let out = items
    if (view === "filtered" && filterQuery) {
      const q = String(filterQuery).toLowerCase()
      const terms = q.split(/\s+or\s+/i).map((t) => t.trim()).filter(Boolean)
      out = out.filter((it) => {
        const hay = ((it.title || "") + " " + (it.description || "") + " " + (it.category || "") + " " + (it.source || "")).toLowerCase()
        return terms.some((term) => hay.includes(term))
      })
    }
    if (localQ.trim()) {
      const lq = localQ.toLowerCase()
      out = out.filter((it) => ((it.title || "") + " " + (it.description || "")).toLowerCase().includes(lq))
    }
    return out
  }, [items, view, filterQuery, localQ])

  function fmtFull(p) {
    if (!p) return ""
    try { return new Date(p).toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) }
    catch { return p }
  }

  return (
    <div className="px-4 md:px-8 py-8 max-w-6xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[12px] font-mono uppercase tracking-[0.12em] text-white/50 hover:text-gold mb-4"
      >
        <ArrowLeft size={14} /> back to news portal
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-gold/70 mb-1">// news source</div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">{source.name}</h1>
          <div className="text-[11px] font-mono text-white/40 mt-1 break-all">{source.path}</div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge variant={source.region === "Indonesia" ? "warning" : "info"}>{source.region}</StatusBadge>
          <button onClick={fetchNow} disabled={busy} className="btn-primary btn-sm">
            {busy ? <><Loader2 size={12} className="animate-spin" /> Fetching...</> : <><Newspaper size={12} /> {fetched ? "Refresh" : "Fetch"}</>}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="panel p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 border border-white/10">
          {[
            { id: "filtered", label: filterLabel ? `Matches: ${filterLabel}` : "All articles" },
            { id: "all",      label: "All articles" }
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={"px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.08em] " +
                (view === v.id ? "bg-gold/10 text-gold border-gold/40" : "text-white/60 hover:text-white")}
            >{v.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 border border-white/10 px-3 py-1.5 bg-jet/40 flex-1 min-w-[200px]">
          <Search size={12} className="text-white/40" />
          <input
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            placeholder="Search in this feed..."
            className="bg-transparent outline-none flex-1 text-sm text-white placeholder:text-white/30"
          />
        </div>
        <div className="text-[10px] font-mono text-white/40">
          {filtered.length}/{items.length} shown
        </div>
      </div>

      {error && <ErrorBox className="mb-4" message="Unable to load this feed right now. Please try again later." />}

      {busy && (
        <div className="text-center text-white/50 py-10 flex flex-col items-center gap-2">
          <Loader2 size={20} className="animate-spin text-gold" />
          <span className="text-[11px] font-mono uppercase tracking-[0.18em]">Fetching full feed...</span>
        </div>
      )}

      {!busy && filtered.length === 0 && (
        <EmptyState
          icon={<Newspaper size={28} className="text-white/30" />}
          title={fetched ? "No matches" : "Empty feed"}
          sub={fetched ? "Try a different category or topic from the main page." : "This source returned no articles."}
        />
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {filtered.map((a, i) => (
          <a
            key={i}
            href={a.url || "#"}
            target="_blank"
            rel="noreferrer"
            className="panel p-3 hover:border-gold/40 transition-colors group flex gap-3"
          >
            {a.image ? (
              <div className="w-28 h-28 shrink-0 overflow-hidden bg-jet border border-white/5">
                <img src={a.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" onError={(e) => e.target.parentElement.style.display = "none"} />
              </div>
            ) : (
              <div className="w-28 h-28 shrink-0 bg-jet/60 border border-white/5 flex items-center justify-center">
                <ImageIcon size={20} className="text-white/20" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[14px] text-white line-clamp-2 group-hover:text-gold">{a.title}</div>
              {a.description && (
                <div className="text-[11px] text-white/60 line-clamp-3 mt-1">{a.description}</div>
              )}
              <div className="flex items-center gap-2 mt-2 text-[9px] font-mono text-white/40 flex-wrap">
                {a.published && <span className="flex items-center gap-0.5"><Calendar size={9} />{fmtFull(a.published)}</span>}
                {a.category && <span className="flex items-center gap-0.5"><Hash size={9} />{a.category}</span>}
                {a.source && <span className="flex items-center gap-0.5"><User size={9} />{a.source}</span>}
                {a.url && <span className="flex items-center gap-0.5 text-gold/70"><ExternalLink size={9} />open</span>}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

function collectArticles(data) {
  const out = []
  if (!data || typeof data !== "object") return out
  const cands = [
    data.articles, data.news, data.items, data.results,
    data.data?.articles, data.data?.news, data.data?.items
  ]
  for (const arr of cands) {
    if (Array.isArray(arr)) {
      for (const a of arr) {
        if (typeof a === "string") out.push({ title: a })
        else if (a && typeof a === "object") {
          out.push({
            title: a.title || a.headline || a.name || "Untitled",
            url: a.url || a.link || a.href || "",
            image: a.image || a.thumbnail || a.thumb || "",
            description: a.description || a.summary || "",
            published: a.published || a.pubDate || "",
            category: a.category_tag || a.category || "",
            source: a.source || ""
          })
        }
      }
      if (out.length) return out
    }
  }
  return out
}