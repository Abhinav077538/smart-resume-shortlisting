/*
 * Smart Resume Shortlisting ranking core
 *
 * This module is a behavior-preserving extraction of the ranking engine in
 * tests/shortlist-source.html. Keep changes here deliberately conservative.
 */

export const BOILER = [
  /[^.\n]*with\s+experience\s+aligned\s+to\s+selected\s+requirements[^.]*\./gi,
  /this\s+is\s+a\s+fictional\s+resume[^.]*\./gi,
  /candidate\s+profile\s*[—-]\s*[a-z/ ]*fit/gi,
  /\b(excellent|very good|very poor|good\/adjacent|weak\/adjacent|weak\/transferable|moderate|poor|weak|good)\s+fit\b/gi,
];

export function cleanText(t: string) {
  t = t.replace(/\u25a0/g, "₹");
  for (const re of BOILER) t = t.replace(re, " ");
  return t.replace(/[ \t]+/g, " ");
}

export const LEVEL: Record<string, number> = { advanced: 1, expert: 1, strong: .85, intermediate: .6, working: .6, basic: .3, beginner: .3, none: 0 };
export const LEVEL_RE = Object.keys(LEVEL).join("|");
export const NEG = /\b(?:no|none|without|lack(?:s|ing)?|never|zero|not)\b[^,]*$/;
export const SKILLS: Record<string, string[]> = {
  sql: ["sql", "postgresql", "mysql", "bigquery", "snowflake", "redshift"],
  python: ["python", "pandas", "numpy"], r: ["r programming", "r language", "rstudio"],
  tableau: ["tableau"], powerbi: ["power bi", "powerbi"], looker: ["looker"], excel: ["excel"],
  amplitude: ["amplitude"], mixpanel: ["mixpanel"], ga4: ["ga4", "google analytics"],
  dbt: ["dbt"], bigquery: ["bigquery"], snowflake: ["snowflake"],
};

export interface ResumeItem { name?: string; file?: string; text: string; }
export type ScoreParts = Record<string, [number, number, boolean]>;
export interface RankedCandidate {
  name: string;
  file?: string;
  final: number;
  keyword: number;
  semantic: number;
  experience: number;
  impact: number;
  reqFit: number;
  years: number;
  parts: ScoreParts;
}

export function skillLevel(t: string, sk: string) {
  const names = SKILLS[sk].join("|");
  const m = new RegExp("(?:" + names + ")\\s*[:\\-]\\s*(" + LEVEL_RE + ")", "i").exec(t);
  if (m) return LEVEL[m[1].toLowerCase()];
  const re = new RegExp("\\b(?:" + names + ")", "gi");
  let found = false, mm: RegExpExecArray | null;
  while ((mm = re.exec(t))) {
    found = true;
    let before = t.slice(Math.max(0, mm.index - 25), mm.index).toLowerCase();
    before = before.split(/[.;•\n]/).pop() || "";
    if (NEG.test(before)) return 0;
  }
  return found ? .6 : 0;
}

export function biLevel(t: string) {
  let lv = Math.max(...["tableau", "powerbi", "looker"].map(s => skillLevel(t, s)));
  if (lv === 0 && /\b(dashboard|power bi|bi\b)/i.test(t) && !/bi\s*:\s*none/i.test(t)) lv = .4;
  if (lv === 0) lv = .25 * skillLevel(t, "excel");
  return lv;
}

export function parseYears(t: string) {
  let best = 0, m: RegExpExecArray | null;
  const re = /(\d+(?:\.\d+)?)\s*\+?\s*(years?|yrs?|months?|mos?)\b/gi;
  while ((m = re.exec(t))) { let v = parseFloat(m[1]); if (/^m/i.test(m[2])) v /= 12; if (v <= 40) best = Math.max(best, v); }
  return best;
}

export function keywordScore(t: string) {
  const has = (re: RegExp) => re.test(t);
  const stats = has(/\b(a\/b test|experiment|statistic|hypothesis|regression)/i);
  const metrics = has(/\b(funnel|cohort|retention|engagement|conversion|activation|churn|kpi)/i);
  const comms = has(/\b(stakeholder|communication|leadership|present|executive|owned|recommend)/i);
  const py = Math.max(skillLevel(t, "python"), skillLevel(t, "r"));
  const P: ScoreParts = {
    "SQL": [22, skillLevel(t, "sql"), true], "Python/R": [12, py, true], "BI tool": [13, biLevel(t), true],
    "Stats/experiment": [11, stats ? 1 : 0, true], "Product metrics": [10, metrics ? 1 : 0, true], "Communication": [5, comms ? 1 : 0, true],
    "Product analytics tool": [7, Math.max(...["amplitude", "mixpanel", "ga4"].map(s => skillLevel(t, s))), false],
    "dbt/warehouse": [6, Math.max(...["dbt", "bigquery", "snowflake"].map(s => skillLevel(t, s))), false],
    "A/B test design": [6, has(/a\/b test/i) ? 1 : 0, false], "SaaS": [4, has(/\bsaas\b/i) ? 1 : 0, false],
    "Quant degree": [4, has(/b\.?tech|b\.?e\.?\b|m\.?sc|statistic|economics|computer|information science/i) ? 1 : 0, false],
  };
  const vals = Object.values(P), tw = vals.reduce((a, x) => a + x[0], 0);
  const score = 100 * vals.reduce((a, x) => a + x[0] * x[1], 0) / tw;
  const req = vals.filter(x => x[2]);
  const reqFit = req.filter(x => x[1] >= .5).length / req.length;
  return { score, reqFit, parts: P };
}

export const CONCEPTS: Record<string, RegExp> = {
  funnel_conversion: /funnel|conversion|activation|onboarding flow|drop-?off|attribution|checkout/gi,
  retention_cohort: /retention|cohort|churn|lifetime|ltv|repeat|engagement/gi,
  experimentation: /a\/b|experiment|hypothesis|test(?:ing)? (?:and|&) learn|significance|uplift/gi,
  dashboards_reports: /dashboard|report(?:ing)?|kpi|metric definition|visuali[sz]/gi,
  product_thinking: /product|feature|user behaviou?r|roadmap|saas|app\b|growth/gi,
  data_quality_docs: /data[- ]quality|document|metric definition|governance|dbt|pipeline/gi,
  stakeholders: /stakeholder|leadership|recommend|executive|insight|cross-functional/gi,
  analysis_stats: /statistic|regression|segment|forecast|predictive|model(?:l)?ing|analy[sz]/gi,
  impact: /improv|reduc|increas|saved|identified|\d+\s?%|₹|\$|cr\b|worth/gi,
};
export const CW: Record<string, number> = { funnel_conversion: 14, retention_cohort: 14, experimentation: 14, dashboards_reports: 12, product_thinking: 12, data_quality_docs: 6, stakeholders: 8, analysis_stats: 8, impact: 12 };
export const OFF = /graphic|design|brand|adobe|figma|administrative|scheduling|vendor|office coordination|hr analyst|headcount|attrition|financial analyst|budgeting|variance|seo|social media|customer success|onboarding customers|account review|backend|api/gi;
export const count = (re: RegExp, t: string) => (t.match(re) || []).length;

export function conceptSemantic(t: string) {
  let got = 0;
  for (const c in CONCEPTS) got += CW[c] * Math.min(1, count(CONCEPTS[c], t) / 2);
  const sem = 100 * got / Object.values(CW).reduce((a, b) => a + b, 0);
  return Math.max(0, sem * (1 - Math.min(.5, .12 * count(OFF, t))));
}
export function impactScore(t: string) { return 100 * Math.min(1, count(CONCEPTS.impact, t) / 3); }

const STOP = new Set("a an and are as at be by for from has have in is it its of on or that the this to was were will with you your we our their they them he she his her i not no but if so than then there these those which who whom what when where why how can could should would may might must also into over under about between during very more most such own same other any each both few all some".split(" "));
export function grams(s: string) {
  const tok = (s.toLowerCase().match(/\b\w\w+\b/g) || []).filter(w => !STOP.has(w));
  const g = tok.slice(); for (let i = 0; i < tok.length - 1; i++) g.push(tok[i] + " " + tok[i + 1]); return g;
}
export function tfidfSemantic(cleaned: string[], jd: string) {
  const docs = [jd, ...cleaned].map(grams), n = docs.length, df: Record<string, number> = {};
  docs.forEach(d => new Set(d).forEach(w => df[w] = (df[w] || 0) + 1));
  const vec = (d: string[]) => { const tf: Record<string, number> = {}; d.forEach(w => tf[w] = (tf[w] || 0) + 1); const v: Record<string, number> = {}; let nr = 0;
    for (const w in tf) { const x = (1 + Math.log(tf[w])) * (Math.log((1 + n) / (1 + df[w])) + 1); v[w] = x; nr += x * x; }
    nr = Math.sqrt(nr) || 1; for (const w in v) v[w] /= nr; return v; };
  const V = docs.map(vec), j = V[0];
  const sims = V.slice(1).map(v => { let s = 0; for (const w in v) if (j[w]) s += v[w] * j[w]; return s; });
  const lo = Math.min(...sims), hi = Math.max(...sims);
  return sims.map(s => 100 * (s - lo) / (hi - lo + 1e-9));
}

export const WGT = { keyword: .40, semantic: .35, experience: .15, impact: .10 };
export function rankCandidates(items: ResumeItem[], jdRaw: string): RankedCandidate[] {
  const jd = cleanText(jdRaw), seen = new Set<string>(), cands: { name: string; file?: string; t: string }[] = [];
  for (const it of items) {
    const t = cleanText(it.text), em = (it.text.match(/[\w.]+@[\w.]+/) || [null])[0];
    const key = em || t.replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue; seen.add(key);
    cands.push({ name: it.name || it.text.trim().split("\n")[0].trim(), file: it.file, t });
  }
  const sv = tfidfSemantic(cands.map(c => c.t), jd);
  const out = cands.map((c, i) => {
    const { score: kw, reqFit, parts } = keywordScore(c.t), cs = conceptSemantic(c.t);
    const sem = .65 * cs + .35 * sv[i], years = parseYears(c.t);
    const rel = Math.pow(Math.min(1, (.5 * kw + .5 * cs) / 60), 2);
    const exp = 100 * Math.min(years, 3) / 3 * rel, imp = impactScore(c.t);
    const base = WGT.keyword * kw + WGT.semantic * sem + WGT.experience * exp + WGT.impact * imp;
    const final = base * (.35 + .65 * reqFit);
    const r1 = (x: number) => Math.round(x * 10) / 10;
    return { name: c.name, file: c.file, final: r1(final), keyword: r1(kw), semantic: r1(sem), experience: r1(exp), impact: r1(imp), reqFit: Math.round(100 * reqFit), years, parts };
  });
  return out.sort((a, b) => b.final - a.final);
}

export function explain(r: RankedCandidate) {
  const e = Object.entries(r.parts);
  const have = e.filter(([, [, v]]) => v >= .5).map(x => x[0]);
  const miss = e.filter(([, [, v, rq]]) => v < .5 && rq).map(x => x[0]);
  const pref = e.filter(([, [, v, rq]]) => v < .5 && !rq).map(x => x[0]);
  return { have, miss, pref };
}

export function compare(a: RankedCandidate, b: RankedCandidate) {
  const lines = [`${a.name} (${a.final}) ranks above ${b.name} (${b.final}) by ${(a.final - b.final).toFixed(1)} points.`];
  for (const k of ["keyword", "semantic", "experience", "impact"] as const) {
    const d = a[k] - b[k]; if (Math.abs(d) >= 3) lines.push(`• ${k}: ${a[k]} vs ${b[k]} (${d > 0 ? "+" : ""}${d.toFixed(1)} for ${a.name})`);
  }
  if (a.reqFit !== b.reqFit) lines.push(`• required-skill coverage: ${a.reqFit}% vs ${b.reqFit}%`);
  const ea = Object.entries(a.parts), eb = b.parts;
  const aOnly = ea.filter(([k, [, v]]) => v >= .5 && eb[k][1] < .5).map(x => x[0]);
  const bOnly = ea.filter(([k, [, v]]) => v < .5 && eb[k][1] >= .5).map(x => x[0]);
  if (aOnly.length) lines.push(`• ${a.name} has: ${aOnly.join(", ")} (${b.name} lacks)`);
  if (bOnly.length) lines.push(`• ${b.name} has: ${bOnly.join(", ")} (${a.name} lacks)`);
  return lines.join("\n");
}
