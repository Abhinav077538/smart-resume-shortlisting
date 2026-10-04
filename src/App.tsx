import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import {
  ArrowDown, ArrowUp, ArrowUpRight, BarChart3, Beaker, Check, ChevronDown, ChevronRight,
  CircleHelp, ClipboardList, FileCheck2, FileText, Filter, FolderOpen, GitCompareArrows,
  Info, Layers3, Menu, PanelLeftClose, PanelLeftOpen, Search, Settings2, ShieldCheck,
  Sparkles, Target, Upload, X, Zap,
} from "lucide-react";
import { explain, compare, rankCandidates, WGT, type RankedCandidate, type ResumeItem } from "./lib/ranking";
import { readPdf } from "./lib/pdf";
import type { PageKey, SortDir, SortKey } from "./types/app";
import "./styles.css";

const navItems: { key: PageKey; label: string; icon: typeof BarChart3; note?: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "analysis", label: "Analysis", icon: Beaker, note: "Run" },
  { key: "candidates", label: "Candidates", icon: ClipboardList },
  { key: "how-it-works", label: "How it works", icon: CircleHelp },
];

function pathToPage(path: string): PageKey {
  const normalized = path.replace(/\/$/, "");
  if (normalized === "/analysis") return "analysis";
  if (normalized === "/candidates") return "candidates";
  if (normalized === "/how-it-works") return "how-it-works";
  if (normalized === "/settings") return "settings";
  return "dashboard";
}
function pageToPath(page: PageKey) { return page === "dashboard" ? "/" : `/${page}`; }
function statusLabel(r: RankedCandidate, rank: number) {
  if (rank < 3) return "Top shortlist";
  if (r.reqFit >= 67) return "Strong fit";
  if (r.reqFit >= 34) return "Review";
  return "Needs review";
}
function biasFlags(jd: string) {
  const flags: string[] = [];
  const m = jd.match(/(\d+)\s*[–-]\s*(\d+)\s*years/i);
  if (m) flags.push(`Experience band "${m[0]}" can exclude experienced analysts and over-reward tenure; consider "relevant experience" instead.`);
  if (/bachelor|b\.?tech|degree/i.test(jd)) flags.push("A degree requirement/preference can exclude strong self-taught or non-traditional candidates; consider 'or equivalent experience'.");
  if (/tableau|power bi|looker|amplitude|mixpanel|ga4|dbt/i.test(jd)) flags.push("Named tools may miss people with equivalent tools; phrase as 'BI tool such as…'.");
  if (/\b(rockstar|ninja|young|digital native|native speaker|aggressive)\b/i.test(jd)) flags.push("Potentially biased wording detected (e.g. 'rockstar', 'young', 'native speaker').");
  return flags;
}

export default function App() {
  const [page, setPage] = useState<PageKey>(() => pathToPage(window.location.pathname));
  const [mobileNav, setMobileNav] = useState(false);
  const [jdText, setJdText] = useState("");
  const [jdFileName, setJdFileName] = useState("");
  const [jdStatus, setJdStatus] = useState<{ kind: "idle" | "ok" | "error" | "loading"; text: string }>({ kind: "idle", text: "Paste text below or add a selectable-text PDF." });
  const [resumeItems, setResumeItems] = useState<ResumeItem[]>([]);
  const [resumeStatus, setResumeStatus] = useState<{ kind: "idle" | "ok" | "error" | "loading"; text: string }>({ kind: "idle", text: "No resumes selected yet" });
  const [ranked, setRanked] = useState<RankedCandidate[]>([]);
  const [processing, setProcessing] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<RankedCandidate | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const onPop = () => setPage(pathToPage(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((next: PageKey) => {
    window.history.pushState({}, "", pageToPath(next));
    setPage(next);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const loadJD = useCallback(async (file: File) => {
    setJdFileName(file.name);
    setJdStatus({ kind: "loading", text: "Extracting JD text… (max 20s)" });
    try {
      const text = await readPdf(file);
      setJdText(text);
      setJdStatus({ kind: "ok", text: `JD read: ${file.name} (${text.length} characters)` });
      setAnnouncement("Job description loaded");
    } catch (e) {
      setJdStatus({ kind: "error", text: `${e instanceof Error ? e.message : "Unable to read PDF"} → paste the JD text below.` });
    }
  }, []);

  const loadResumes = useCallback(async (files: File[]) => {
    const pdfs = files.filter(file => /\.pdf$/i.test(file.name));
    setResumeItems([]);
    const next: ResumeItem[] = [];
    const bad: string[] = [];
    for (let i = 0; i < pdfs.length; i++) {
      setResumeStatus({ kind: "loading", text: `Reading ${i + 1}/${pdfs.length}: ${pdfs[i].name}` });
      try { next.push({ file: pdfs[i].name, text: await readPdf(pdfs[i]) }); }
      catch (e) { bad.push(`${pdfs[i].name} (${e instanceof Error ? e.message : "unable to read"})`); }
    }
    setResumeItems(next);
    setResumeStatus({ kind: bad.length ? "error" : "ok", text: `${next.length} resumes ready${bad.length ? ` · failed: ${bad.join("; ")}` : ""}` });
    setAnnouncement(`${next.length} resume${next.length === 1 ? "" : "s"} ready`);
  }, []);

  const analyze = useCallback(() => {
    setProcessing(true);
    window.setTimeout(() => {
      const output = rankCandidates(resumeItems, jdText);
      setRanked(output);
      setProcessing(false);
      setAnnouncement(`${output.length} candidates ranked`);
      navigate("candidates");
    }, 260);
  }, [jdText, navigate, resumeItems]);

  const canAnalyze = jdText.trim().length >= 40 && resumeItems.length > 0;
  const topCandidate = ranked[0];
  const flags = useMemo(() => biasFlags(jdText), [jdText]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Sidebar page={page} navigate={navigate} mobileOpen={mobileNav} onClose={() => setMobileNav(false)} />
      {mobileNav && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <div className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>SHORTLIST</span><ChevronRight size={14} /><strong>{navItems.find(item => item.key === page)?.label || "Settings"}</strong></div>
          <div className="topbar-actions">
            <span className="live-pill"><span className="live-dot" /> Local analysis</span>
            <button className="icon-button" aria-label="Open settings" onClick={() => navigate("settings")}><Settings2 size={18} /></button>
            <div className="avatar" aria-label="Workspace profile">NM</div>
          </div>
        </header>
        <main id="main-content" className="content" tabIndex={-1}>
          <div className="sr-only" aria-live="polite">{announcement}</div>
          {page === "dashboard" && <DashboardPage ranked={ranked} topCandidate={topCandidate} onAnalyze={() => navigate("analysis")} onViewHow={() => navigate("how-it-works")} onOpen={(r) => setSelectedCandidate(r)} />}
          {page === "analysis" && <AnalysisPage jdText={jdText} setJdText={setJdText} jdFileName={jdFileName} jdStatus={jdStatus} onJdFile={loadJD} resumeItems={resumeItems} resumeStatus={resumeStatus} onResumeFiles={loadResumes} canAnalyze={canAnalyze} processing={processing} onAnalyze={analyze} onViewResults={() => navigate("candidates")} />}
          {page === "candidates" && <CandidatesPage ranked={ranked} jdText={jdText} flags={flags} onOpen={(r) => setSelectedCandidate(r)} onAnalyze={() => navigate("analysis")} />}
          {page === "how-it-works" && <HowItWorksPage onAnalyze={() => navigate("analysis")} />}
          {page === "settings" && <SettingsPage />}
        </main>
        <footer className="footer"><span>© 2026 SMART RESUME</span><span>Evidence-backed candidate intelligence</span><span className="footer-status"><ShieldCheck size={14} /> Browser-only & private</span></footer>
      </div>
      {selectedCandidate && <CandidateDrawer candidate={selectedCandidate} rank={ranked.findIndex(r => r === selectedCandidate) + 1} onClose={() => setSelectedCandidate(null)} />}
    </div>
  );
}

function Sidebar({ page, navigate, mobileOpen, onClose }: { page: PageKey; navigate: (p: PageKey) => void; mobileOpen: boolean; onClose: () => void }) {
  return <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`} aria-label="Primary navigation">
    <div className="brand-lockup"><div className="brand-mark" aria-hidden="true"><i /><i /><i /></div><div><div className="brand-name">SMART RESUME</div><div className="brand-kicker">Shortlisting engine</div></div><button className="icon-button sidebar-close" aria-label="Close navigation" onClick={onClose}><PanelLeftClose size={18} /></button></div>
    <div className="workspace-card"><span className="eyebrow">Workspace</span><div className="workspace-row"><span className="workspace-dot" /> Recruitment / 01 <ChevronDown size={14} /></div><span className="workspace-meta">Private browser session</span></div>
    <nav className="nav-list">
      <span className="nav-section-label">Workspace</span>
      {navItems.map(item => { const Icon = item.icon; return <button key={item.key} className={`nav-item ${page === item.key ? "active" : ""}`} onClick={() => navigate(item.key)}><Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.note && <span className="nav-note">{item.note}</span>}</button>; })}
    </nav>
    <div className="sidebar-bottom"><div className="privacy-note"><Zap size={16} /><div><strong>Designed for signal</strong><span>No files leave this browser.</span></div></div><button className={`nav-item ${page === "settings" ? "active" : ""}`} onClick={() => navigate("settings")}><Settings2 size={17} /><span>Settings</span></button><div className="sidebar-version">SHORTLIST / 1.0.0</div></div>
  </aside>;
}

function PageHeader({ kicker, title, description, action }: { kicker: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow accent">{kicker}</div><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action && <div className="page-header-action">{action}</div>}</div>;
}

function DashboardPage({ ranked, topCandidate, onAnalyze, onViewHow, onOpen }: { ranked: RankedCandidate[]; topCandidate?: RankedCandidate; onAnalyze: () => void; onViewHow: () => void; onOpen: (r: RankedCandidate) => void }) {
  return <div className="page dashboard-page">
    <section className="hero-panel">
      <div className="hero-copy"><div className="eyebrow accent"><span className="eyebrow-line" /> Smart Resume Intelligence</div><h1>Find the right<br /><em>candidate.</em></h1><p>Evidence-backed candidate ranking built from keyword, semantic, experience, and impact signals.</p><div className="hero-actions"><button className="primary-button" onClick={onAnalyze}>Analyze candidates <ArrowUpRight size={17} /></button><button className="secondary-button" onClick={onViewHow}>View methodology <ChevronRight size={16} /></button></div></div>
      <div className="hero-signal" aria-label="Three ranking signals"><div className="signal-orbit orbit-one" /><div className="signal-orbit orbit-two" /><div className="signal-orbit orbit-three" /><div className="signal-core"><div className="brand-mark large"><i /><i /><i /></div><span>3 signal layers</span></div><div className="signal-label label-keyword"><span className="signal-index">01</span> Keyword</div><div className="signal-label label-semantic"><span className="signal-index">02</span> Semantic</div><div className="signal-label label-evidence"><span className="signal-index">03</span> Evidence</div></div>
    </section>
    <section className="stat-strip" aria-label="Workspace statistics"><Stat value={ranked.length ? String(ranked.length).padStart(2, "0") : "—"} label="Candidates analyzed" note={ranked.length ? "Current batch" : "Awaiting batch"} /><Stat value={topCandidate ? topCandidate.final.toFixed(1) : "—"} label="Top match" note={topCandidate ? topCandidate.name : "No score yet"} accent /><Stat value="40 / 35 / 15 / 10" label="Hybrid weights" note="Keyword / semantic / exp. / impact" /><Stat value="100%" label="Browser private" note="No upload server" /> </section>
    <section className="dashboard-grid"><div className="section-card spotlight-card"><div className="card-heading"><div><div className="eyebrow">Current signal</div><h2>{topCandidate ? "Your leading candidate" : "Build your first shortlist"}</h2></div><Target size={20} /></div>{topCandidate ? <button className="spotlight-candidate" onClick={() => onOpen(topCandidate)}><div className="mini-rank">01</div><div className="spotlight-name"><strong>{topCandidate.name}</strong><span>{statusLabel(topCandidate, 0)} · {topCandidate.reqFit}% required fit</span></div><div className="spotlight-score">{topCandidate.final}<ArrowUpRight size={16} /></div></button> : <div className="empty-inline"><div className="empty-icon"><FileCheck2 size={20} /></div><div><strong>Give the role and resume batch to the engine.</strong><span>The exact source engine will return a ranked shortlist with an explainable trail.</span></div><button className="text-button" onClick={onAnalyze}>Start analysis <ArrowUpRight size={14} /></button></div>}</div><div className="section-card principles-card"><div className="card-heading"><div><div className="eyebrow">Product principles</div><h2>Signal over spectacle.</h2></div><Sparkles size={20} /></div><div className="principle-list"><Principle n="01" title="Source-faithful" text="The scoring engine is preserved, not replaced." /><Principle n="02" title="Evidence-backed" text="Scores stay close to the text that produced them." /><Principle n="03" title="Recruiter-ready" text="Compare, inspect, and move with confidence." /></div></div></section>
  </div>;
}
function Stat({ value, label, note, accent }: { value: string; label: string; note: string; accent?: boolean }) { return <div className="stat-item"><div className={`stat-value ${accent ? "accent-text" : ""}`}>{value}</div><div className="stat-label">{label}</div><div className="stat-note">{note}</div></div>; }
function Principle({ n, title, text }: { n: string; title: string; text: string }) { return <div className="principle"><span>{n}</span><div><strong>{title}</strong><p>{text}</p></div></div>; }

function AnalysisPage({ jdText, setJdText, jdFileName, jdStatus, onJdFile, resumeItems, resumeStatus, onResumeFiles, canAnalyze, processing, onAnalyze, onViewResults }: { jdText: string; setJdText: (v: string) => void; jdFileName: string; jdStatus: { kind: string; text: string }; onJdFile: (file: File) => void; resumeItems: ResumeItem[]; resumeStatus: { kind: string; text: string }; onResumeFiles: (files: File[]) => void; canAnalyze: boolean; processing: boolean; onAnalyze: () => void; onViewResults: () => void }) {
  const jdInput = useRef<HTMLInputElement>(null); const resumeInput = useRef<HTMLInputElement>(null);
  const drop = (handler: (files: File[]) => void, event: DragEvent<HTMLDivElement>) => { event.preventDefault(); if (event.dataTransfer.files.length) handler([...event.dataTransfer.files]); };
  return <div className="page"><PageHeader kicker="01 / Analyze" title="Turn a role into a shortlist." description="Add the job description and a batch of selectable-text resume PDFs. Everything runs locally in this browser." action={resumeItems.length > 0 ? <button className="secondary-button" onClick={onViewResults}>View current results <ArrowUpRight size={15} /></button> : undefined} />
    <div className="capability-banner"><Info size={17} /><div><strong>Current capability</strong><span>PDF text extraction and ranking run in-browser. There is no backend upload or AI-generated resume content in this version.</span></div></div>
    <div className="analysis-grid"><section className="form-card"><div className="card-number">01</div><div className="eyebrow">Define the role</div><h2>Job description</h2><p className="card-intro">Use a PDF or paste the role, responsibilities, and qualifications below.</p><UploadZone label={jdFileName || "Add a JD PDF"} hint="Click or drop a selectable-text PDF" icon={<FileText size={20} />} onClick={() => jdInput.current?.click()} onDrop={(files) => files[0] && onJdFile(files[0])} /><input ref={jdInput} hidden type="file" accept=".pdf" onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files?.[0] && onJdFile(e.target.files[0])} /><StatusText status={jdStatus.kind} text={jdStatus.text} /><label className="field-label" htmlFor="jdText">Or paste the JD text <span>always works</span></label><textarea id="jdText" value={jdText} onChange={e => setJdText(e.target.value)} placeholder="Paste the role, responsibilities and qualifications…" /><div className="field-foot"><span>{jdText.length} characters</span><span className={jdText.trim().length >= 40 ? "good" : ""}>{jdText.trim().length >= 40 ? "Ready to analyze" : "40 characters minimum"}</span></div></section>
      <section className="form-card"><div className="card-number">02</div><div className="eyebrow">Add your batch</div><h2>Resume PDFs</h2><p className="card-intro">Select one or more PDFs. Resumes are read in order and deduplicated using the source engine.</p><UploadZone label={resumeItems.length ? `${resumeItems.length} resumes loaded` : "Add resume PDFs"} hint="Click or drop multiple PDFs" icon={<FolderOpen size={20} />} onClick={() => resumeInput.current?.click()} onDrop={onResumeFiles} /><input ref={resumeInput} hidden type="file" accept=".pdf" multiple onChange={(e: ChangeEvent<HTMLInputElement>) => onResumeFiles([...e.target.files || []])} /><StatusText status={resumeStatus.kind} text={resumeStatus.text} /><div className="file-list">{resumeItems.length ? resumeItems.map((item, index) => <div className="file-row" key={`${item.file}-${index}`}><FileCheck2 size={16} /><span>{item.file}</span><Check size={15} /></div>) : <div className="empty-file"><Upload size={17} /><span>Your batch will appear here</span></div>}</div><button className="primary-button full-button" disabled={!canAnalyze || processing} onClick={onAnalyze}>{processing ? <><span className="spinner" /> Analyzing…</> : <>Analyze candidates <ArrowUpRight size={17} /></>}</button><p className="button-note">{canAnalyze ? "Ranking is deterministic and source-faithful." : "Add a 40+ character JD and at least one readable resume PDF."}</p></section></div>
  </div>;
}
function UploadZone({ label, hint, icon, onClick, onDrop }: { label: string; hint: string; icon: ReactNode; onClick: () => void; onDrop: (files: File[]) => void }) { return <div className="upload-zone" tabIndex={0} role="button" onClick={onClick} onKeyDown={e => (e.key === "Enter" || e.key === " ") && onClick()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); onDrop(e.dataTransfer.files ? [...e.dataTransfer.files] : []); }}><div className="upload-icon">{icon}</div><div><strong>{label}</strong><span>{hint}</span></div><ChevronRight size={17} /></div>; }
function StatusText({ status, text }: { status: string; text: string }) { return <div className={`status-text ${status === "ok" ? "ok" : status === "error" ? "error" : ""}`}><span className={status === "loading" ? "spinner small" : "status-bullet"} />{text}</div>; }

function CandidatesPage({ ranked, jdText, flags, onOpen, onAnalyze }: { ranked: RankedCandidate[]; jdText: string; flags: string[]; onOpen: (r: RankedCandidate) => void; onAnalyze: () => void }) {
  if (!ranked.length) return <div className="page"><PageHeader kicker="02 / Candidates" title="Your evidence, ranked." description="The shortlist workspace appears here after a local analysis." /><EmptyState onAnalyze={onAnalyze} /></div>;
  return <div className="page results-page"><PageHeader kicker="02 / Candidates" title="The shortlist, in focus." description={`${ranked.length} candidates ranked from the current batch. Search, sort, compare, and open any row for its evidence trail.`} action={<button className="primary-button" onClick={onAnalyze}>New analysis <ArrowUpRight size={16} /></button>} /><TopCandidates ranked={ranked} onOpen={onOpen} /><ResultsTable ranked={ranked} onOpen={onOpen} /><div className="lower-grid"><Comparison ranked={ranked} /><BiasCheck jdText={jdText} flags={flags} /></div></div>;
}
function EmptyState({ onAnalyze }: { onAnalyze: () => void }) { return <div className="empty-state"><div className="empty-state-mark"><Layers3 size={25} /></div><div className="eyebrow accent">No shortlist yet</div><h2>Start with the role.</h2><p>Once the source engine has a job description and at least one resume, the exact ranked output will live here.</p><button className="primary-button" onClick={onAnalyze}>Open analysis <ArrowUpRight size={16} /></button></div>; }
function TopCandidates({ ranked, onOpen }: { ranked: RankedCandidate[]; onOpen: (r: RankedCandidate) => void }) { return <section className="results-section"><div className="section-heading"><div><div className="eyebrow accent">Top 3 shortlist</div><h2>The first read.</h2></div><span className="section-meta">Exact source order</span></div><div className="top-candidates">{ranked.slice(0, 3).map((r, index) => <CandidateCard key={`${r.name}-${index}`} candidate={r} rank={index + 1} onOpen={onOpen} />)}</div></section>; }
function CandidateCard({ candidate: r, rank, onOpen }: { candidate: RankedCandidate; rank: number; onOpen: (r: RankedCandidate) => void }) { const e = explain(r); return <button className={`candidate-card rank-${rank}`} onClick={() => onOpen(r)}><div className="candidate-card-top"><span className="rank-badge">0{rank}</span><span className="card-action"><ArrowUpRight size={16} /></span></div><div className="candidate-card-name">{r.name}</div><div className="candidate-card-status">{statusLabel(r, rank - 1)} <span /> {r.reqFit}% required fit</div><div className="candidate-score-row"><strong>{r.final}</strong><span>final score</span></div><div className="score-mini-grid"><ScoreMini label="Keyword" value={r.keyword} /><ScoreMini label="Semantic" value={r.semantic} /><ScoreMini label="Exp" value={r.experience} /></div><div className="tag-line">{e.have.slice(0, 4).map(tag => <span className="skill-tag matched" key={tag}>{tag}</span>)}{e.miss.length > 0 && <span className="skill-tag missing">{e.miss.length} required gap{e.miss.length > 1 ? "s" : ""}</span>}</div></button>; }
function ScoreMini({ label, value }: { label: string; value: number }) { return <div><span>{label}</span><strong>{value}</strong><div className="tiny-bar"><i style={{ width: `${Math.min(100, value)}%` }} /></div></div>; }

function ResultsTable({ ranked, onOpen }: { ranked: RankedCandidate[]; onOpen: (r: RankedCandidate) => void }) {
  const [query, setQuery] = useState(""); const [sortKey, setSortKey] = useState<SortKey>("rank"); const [sortDir, setSortDir] = useState<SortDir>("asc"); const [requiredOnly, setRequiredOnly] = useState(false); const [expanded, setExpanded] = useState<number | null>(null);
  const sorted = useMemo(() => { const filtered = ranked.filter(r => r.name.toLowerCase().includes(query.toLowerCase()) && (!requiredOnly || r.reqFit < 100)); return filtered.map((r, index) => ({ r, original: ranked.indexOf(r), index })).sort((a, b) => { if (sortKey === "rank") return a.original - b.original; const av = a.r[sortKey], bv = b.r[sortKey]; return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av); }); }, [ranked, query, requiredOnly, sortKey, sortDir]);
  const changeSort = (key: SortKey) => { if (key === "rank") { setSortKey("rank"); setSortDir("asc"); return; } if (sortKey === key) setSortDir(prev => prev === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDir("desc"); } };
  return <section className="results-section table-section"><div className="section-heading"><div><div className="eyebrow accent">Full ranking</div><h2>Every candidate, inspectable.</h2></div><div className="table-tools"><label className="search-field"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search candidates" aria-label="Search candidates" /></label><button className={`filter-button ${requiredOnly ? "active" : ""}`} onClick={() => setRequiredOnly(v => !v)}><Filter size={15} /> Gaps <span>{requiredOnly ? "on" : "off"}</span></button></div></div><div className="table-wrap"><table><thead><tr><th>Rank</th><th>Candidate</th>{(["final", "keyword", "semantic", "experience", "impact", "reqFit"] as SortKey[]).map(key => <th key={key}><button className="sort-head" onClick={() => changeSort(key)}>{key === "reqFit" ? "Req fit" : key}<SortIcon active={sortKey === key} dir={sortDir} /></button></th>)}<th>Status</th></tr></thead><tbody>{sorted.map(({ r, original }) => <><tr key={`${r.name}-${original}`} className={expanded === original ? "is-expanded" : ""} onClick={() => onOpen(r)}><td><span className="table-rank">{String(original + 1).padStart(2, "0")}</span></td><td><div className="table-candidate"><span className="candidate-initial">{r.name.slice(0, 1).toUpperCase()}</span><span><strong>{r.name}</strong><small>{r.file || "Browser text input"}</small></span></div></td><td><strong className="table-score">{r.final}</strong></td><td><MetricBar value={r.keyword} /></td><td><MetricBar value={r.semantic} /></td><td>{r.experience}</td><td>{r.impact}</td><td>{r.reqFit}%</td><td><span className={`status-tag ${original < 3 ? "top" : ""}`}>{statusLabel(r, original)}</span></td></tr>{expanded === original && <tr className="expanded-row"><td colSpan={9}><button className="text-button" onClick={(e) => { e.stopPropagation(); onOpen(r); }}>Open full evidence trail <ArrowUpRight size={14} /></button></td></tr>}</>)}{!sorted.length && <tr><td colSpan={9}><div className="table-empty"><Search size={18} /> No candidates match that view.</div></td></tr>}</tbody></table></div><div className="table-mobile-list">{sorted.map(({ r, original }) => <button className="mobile-result-card" key={`mobile-${r.name}-${original}`} onClick={() => onOpen(r)}><div><span className="table-rank">{String(original + 1).padStart(2, "0")}</span><strong>{r.name}</strong></div><div className="mobile-result-score">{r.final}<small>final</small></div><div className="mobile-result-meta"><span>KW {r.keyword}</span><span>SEM {r.semantic}</span><span>{r.reqFit}% req.</span></div></button>)}</div><div className="table-foot"><span>Showing {sorted.length} of {ranked.length}</span><span>Click a row for detail</span></div></section>;
}
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) { if (!active) return <ChevronDown size={13} />; return dir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />; }
function MetricBar({ value }: { value: number }) { return <div className="metric-bar"><span>{value}</span><i><b style={{ width: `${Math.min(100, value)}%` }} /></i></div>; }

function Comparison({ ranked }: { ranked: RankedCandidate[] }) { const [a, setA] = useState(0); const [b, setB] = useState(Math.min(1, ranked.length - 1)); const [output, setOutput] = useState(""); const first = ranked[a], second = ranked[b]; const run = () => { if (first === second) setOutput("Pick two different candidates."); else setOutput(first.final >= second.final ? compare(first, second) : compare(second, first)); }; return <section className="section-card comparison-card"><div className="eyebrow accent">Compare candidates</div><h2>Make the trade-off visible.</h2><p className="card-intro">The comparison uses the source explanation function. It never changes the ranking.</p><div className="compare-selects"><select value={a} onChange={e => setA(Number(e.target.value))} aria-label="First candidate">{ranked.map((r, i) => <option key={r.name + i} value={i}>{i + 1}. {r.name}</option>)}</select><span>vs</span><select value={b} onChange={e => setB(Number(e.target.value))} aria-label="Second candidate">{ranked.map((r, i) => <option key={r.name + i} value={i}>{i + 1}. {r.name}</option>)}</select></div><button className="secondary-button" onClick={run}>Explain difference <GitCompareArrows size={16} /></button>{output && <pre className="compare-output">{output}</pre>}</section>; }
function BiasCheck({ jdText, flags }: { jdText: string; flags: string[] }) { return <section className="section-card bias-card"><div className="eyebrow accent">JD bias check</div><h2>Keep the brief open.</h2><p className="card-intro">These are the exact narrow-phrasing checks from the source experience.</p><div className="bias-result"><span className={`bias-icon ${flags.length ? "warn" : "clear"}`}>{flags.length ? <Info size={18} /> : <Check size={18} />}</span><div><strong>{flags.length ? `${flags.length} consideration${flags.length > 1 ? "s" : ""}` : "No obvious narrow phrasing"}</strong><span>{jdText ? "Based on the current job description." : "Add a JD to run the source checks."}</span></div></div>{flags.length > 0 && <ul className="bias-list">{flags.map(flag => <li key={flag}>{flag}</li>)}</ul>}</section>; }

function CandidateDrawer({ candidate: r, rank, onClose }: { candidate: RankedCandidate; rank: number; onClose: () => void }) { const e = explain(r); useEffect(() => { const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose(); document.body.classList.add("drawer-open"); window.addEventListener("keydown", onKey); return () => { document.body.classList.remove("drawer-open"); window.removeEventListener("keydown", onKey); }; }, [onClose]); return <div className="drawer-layer" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="candidate-detail-title"><div className="drawer-header"><div><div className="eyebrow accent">Candidate detail / rank {String(rank).padStart(2, "0")}</div><h2 id="candidate-detail-title">{r.name}</h2></div><button className="icon-button" aria-label="Close candidate detail" onClick={onClose}><X size={19} /></button></div><div className="drawer-score"><div><span className="eyebrow">Final score</span><strong>{r.final}</strong><span className="score-status">{statusLabel(r, rank - 1)}</span></div><div className="drawer-score-meta"><span>Required fit</span><strong>{r.reqFit}%</strong></div></div><div className="detail-section"><div className="detail-heading"><span className="eyebrow">Score breakdown</span><span className="detail-source">Source weights preserved</span></div><div className="breakdown-list"><Breakdown label="Keyword" value={r.keyword} weight="40%" /><Breakdown label="Semantic" value={r.semantic} weight="35%" /><Breakdown label="Experience" value={r.experience} weight="15%" /><Breakdown label="Impact" value={r.impact} weight="10%" /></div></div><div className="detail-section"><div className="detail-heading"><span className="eyebrow">Match evidence</span></div><EvidenceBlock label="Matched skills" className="matched" values={e.have} empty="No matched signals" /><EvidenceBlock label="Missing required" className="missing" values={e.miss} empty="None" /><EvidenceBlock label="Missing preferred" className="preferred" values={e.pref} empty="None" /></div><div className="detail-section"><div className="detail-heading"><span className="eyebrow">Experience & relevance</span></div><div className="facts-grid"><Fact label="Years detected" value={`${r.years}y`} /><Fact label="Semantic relevance" value={`${r.semantic}`} /><Fact label="Evidence file" value={r.file || "Browser text"} /></div></div><div className="detail-section explanation-section"><div className="detail-heading"><span className="eyebrow">Explanation</span></div><p>This candidate’s output is calculated by the preserved hybrid engine. Matched and missing categories above are the exact source explanation groups; no new AI narrative has been added.</p></div></aside></div>; }
function Breakdown({ label, value, weight }: { label: string; value: number; weight: string }) { return <div className="breakdown-row"><span>{label}<small>{weight} weight</small></span><i><b style={{ width: `${Math.min(100, value)}%` }} /></i><strong>{value}</strong></div>; }
function EvidenceBlock({ label, className, values, empty }: { label: string; className: string; values: string[]; empty: string }) { return <div className="evidence-block"><span className="evidence-label">{label}</span><div>{values.length ? values.map(value => <span className={`skill-tag ${className}`} key={value}>{value}</span>) : <span className="muted-inline">{empty}</span>}</div></div>; }
function Fact({ label, value }: { label: string; value: string }) { return <div className="fact"><span>{label}</span><strong>{value}</strong></div>; }

function HowItWorksPage({ onAnalyze }: { onAnalyze: () => void }) { const method = [{ label: "Keyword matching", text: "Required and preferred signals across SQL, Python/R, BI, experiments, product metrics, communication, tools, warehouses, A/B design, SaaS, and quantitative degrees.", value: "40%" }, { label: "Semantic matching", text: "Concept coverage plus normalized TF-IDF cosine similarity against the job description.", value: "35%" }, { label: "Experience", text: "Parsed years, capped at three, scaled by relevance to the keyword and concept signals.", value: "15%" }, { label: "Impact", text: "Evidence of improvement, reduction, increase, savings, identification, percentages, currency, or crore markers.", value: "10%" }]; return <div className="page how-page"><PageHeader kicker="03 / Methodology" title="Every score has a trail." description="This is a productized interface around the existing browser engine—not a new model and not a black box." action={<button className="primary-button" onClick={onAnalyze}>Run an analysis <ArrowUpRight size={16} /></button>} /><section className="method-flow"><div className="flow-step"><span>01</span><strong>Job description</strong><small>Clean text, preserve intent</small></div><div className="flow-connector" /><div className="flow-step active"><span>02</span><strong>Signal extraction</strong><small>Keyword + semantic coverage</small></div><div className="flow-connector" /><div className="flow-step"><span>03</span><strong>Hybrid score</strong><small>Four preserved weights</small></div><div className="flow-connector" /><div className="flow-step"><span>04</span><strong>Ranked shortlist</strong><small>Requirement gate + order</small></div></section><section className="method-grid"><div className="section-card methodology-card"><div className="eyebrow accent">The actual formula</div><h2>Hybrid score, then a requirement gate.</h2><div className="formula-block"><code>base = 0.40 × keyword + 0.35 × semantic + 0.15 × experience + 0.10 × impact</code><code>final = base × (0.35 + 0.65 × requiredSkillFit)</code></div><p>The final output is rounded to one decimal place. The source engine sorts candidates by final score, descending. Exact thresholds, weights, and rounding remain in the core module.</p></div><div className="section-card weight-card"><div className="eyebrow accent">Weight distribution</div>{method.map(item => <div className="weight-row" key={item.label}><div><strong>{item.label}</strong><span>{item.text}</span></div><b>{item.value}</b></div>)}</div></section><section className="section-card principles-card methodology-note"><div className="card-heading"><div><div className="eyebrow">What stays unchanged</div><h2>Presentation can move. Logic does not.</h2></div><ShieldCheck size={20} /></div><div className="integrity-grid"><Integrity icon={<FileCheck2 />} title="Candidate order" text="Ranking remains the source sort: final score descending." /><Integrity icon={<BarChart3 />} title="Score values" text="Keyword, semantic, experience, impact, and final values are preserved." /><Integrity icon={<GitCompareArrows />} title="Explanations" text="Comparison and match groups use the original functions." /></div></section></div>; }
function Integrity({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="integrity-item"><div className="integrity-icon">{icon}</div><div><strong>{title}</strong><span>{text}</span></div></div>; }
function SettingsPage() { return <div className="page"><PageHeader kicker="04 / Workspace" title="Settings, kept simple." description="This workspace is intentionally browser-only in this release. There are no accounts, uploads, or external model keys to configure." /><div className="settings-grid"><section className="section-card setting-row"><div className="setting-icon"><ShieldCheck size={19} /></div><div><div className="eyebrow">Privacy model</div><h2>Files stay in this browser.</h2><p>PDF text is extracted locally and is not sent to a backend service. Refreshing the page clears the current session, just like the source file.</p></div><span className="setting-badge">Active</span></section><section className="section-card setting-row"><div className="setting-icon"><Zap size={19} /></div><div><div className="eyebrow">Engine version</div><h2>Source-faithful core</h2><p>The extracted ranking module preserves the original keyword, semantic, experience, impact, and requirement-gate behavior.</p></div><span className="setting-badge">1.0.0</span></section></div></div>; }
