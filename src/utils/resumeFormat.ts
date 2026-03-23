import { MUSKAN_RESUME_PREAMBLE } from "../templates/muskanResumePreamble";

/**
 * Parse plain-text resumes into HTML / LaTeX.
 * Typography for “Muskan Markam” PDF (pdflatex / Computer Modern), measured via PDF spans:
 * — Name: ~14.3pt bold (CMBX12)
 * — Contact: 9pt regular (CMR9)
 * — Section titles: 10pt bold caps + full-width \hrule (CMBX10)
 * — Body / summary / bullets: 10pt regular (CMR10); bullet glyph ~10pt (SFRM)
 * — Job titles & project headings: 9pt bold (CMBX9)
 * — Company lines & CGPA: 10pt bold (CMBX10)
 * — School / secondary education text: 10pt regular (CMR10)
 * — Dates: 10pt italic (CMTI10)
 * — Project URL line: 9pt bold (CMBX9)
 * — Skills “Label:” prefix: 10pt bold, remainder 10pt regular
 */

const KNOWN_SECTIONS = new Set([
  "PROFESSIONAL SUMMARY",
  "SUMMARY",
  "OBJECTIVE",
  "EDUCATION",
  "PROFESSIONAL EXPERIENCE",
  "WORK EXPERIENCE",
  "EXPERIENCE",
  "TECHNICAL SKILLS",
  "SKILLS",
  "CORE COMPETENCIES",
  "KEY PROJECTS",
  "PROJECTS",
  "SELECTED PROJECTS",
  "ACHIEVEMENTS",
  "CERTIFICATIONS",
  "PUBLICATIONS",
  "AWARDS",
  "VOLUNTEER",
  "LANGUAGES",
  "REFERENCES",
]);

export type SectionKind = "SUMMARY" | "EDUCATION" | "EXPERIENCE" | "SKILLS" | "PROJECTS" | "ACHIEVEMENTS" | "OTHER";

export type Segment =
  | { type: "name"; text: string }
  | { type: "contact"; lines: string[] }
  | { type: "section"; text: string; kind: SectionKind }
  | { type: "job_title"; text: string }
  | { type: "company"; text: string }
  | { type: "dates"; text: string }
  | { type: "degree"; text: string }
  | { type: "school"; text: string }
  | { type: "cgpa"; text: string }
  | { type: "edu_note"; text: string }
  | { type: "project_title"; text: string }
  | { type: "project_url"; text: string }
  | { type: "skill"; label: string; value: string }
  | { type: "bullet"; text: string }
  | { type: "summary_line"; text: string }
  | { type: "body"; text: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Fix PDF line-break hyphenation: "per-\nformance" → "performance" */
export function mergeBrokenLines(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    let line = raw[i];
    if (!line) {
      out.push("");
      continue;
    }
    while (line.endsWith("-") && i + 1 < raw.length) {
      const next = raw[i + 1].trim();
      if (next && /^[a-z]/.test(next)) {
        line = line.slice(0, -1) + next;
        i++;
      } else break;
    }
    out.push(line);
  }
  return out;
}

function cleanLines(text: string): string[] {
  return mergeBrokenLines(text)
    .map((l) => l.replace(/\f/g, "").trimEnd())
    .filter((l) => !/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/.test(l));
}

export function isSectionHeader(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (KNOWN_SECTIONS.has(t)) return true;
  if (t.includes("@") || /https?:\/\//i.test(t)) return false;
  if (t.length >= 3 && t.length <= 58 && t === t.toUpperCase() && /[A-Z]/.test(t)) {
    const words = t.split(/\s+/).filter(Boolean).length;
    if (words <= 10 && !/^\d/.test(t)) return true;
  }
  return false;
}

function canonicalSection(header: string): SectionKind {
  const t = header.trim().toUpperCase();
  if (t.includes("SUMMARY") || t === "OBJECTIVE") return "SUMMARY";
  if (t.includes("EDUCATION")) return "EDUCATION";
  if (t.includes("EXPERIENCE")) return "EXPERIENCE";
  if (t.includes("SKILL") || t.includes("COMPETENC")) return "SKILLS";
  if (t.includes("PROJECT")) return "PROJECTS";
  if (t.includes("ACHIEVEMENT") || t.includes("AWARD") || t.includes("PUBLICATION")) return "ACHIEVEMENTS";
  return "OTHER";
}

function isBullet(line: string): boolean {
  return /^\s*[•\-\*▪]\s+/.test(line) || /^\s*\d+[\.)]\s+/.test(line);
}

function stripBullet(line: string): string {
  return line.replace(/^\s*[•\-\*▪]\s+/, "").replace(/^\s*\d+[\.)]\s+/, "").trim();
}

function isDateLine(line: string): boolean {
  const t = line.trim();
  return /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*[-–—]\s*(?:Present|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i.test(
    t
  );
}

function isCgpaLine(line: string): boolean {
  return /^CGPA:/i.test(line.trim());
}

function isEduParenNote(line: string): boolean {
  const t = line.trim();
  return /^\([^)]{2,80}\)$/.test(t);
}

const DEGREE_PREFIX =
  /^(MCA|MBA|MS|M\.S\.|B\.Sc\.|B\.S\.|B\.Tech|M\.Tech|B\.E\.|M\.E\.|Ph\.D\.?|B\.A\.|M\.A\.|MBBS|MD|B\.Com|M\.Com)\b/i;

function isDegreeLine(line: string): boolean {
  const t = line.trim();
  if (DEGREE_PREFIX.test(t)) return true;
  if (t.length <= 12 && t === t.toUpperCase() && /^[A-Z][A-Z0-9.+]*$/.test(t)) return true;
  return false;
}

function isSchoolishLine(line: string): boolean {
  const t = line.trim();
  return /\b(University|College|Institute|School|Academy)\b/i.test(t);
}

function parseSkillLine(line: string): { label: string; value: string } | null {
  const m = line.trim().match(/^([A-Za-z][A-Za-z\s/&]+):\s*(.*)$/);
  if (!m) return null;
  const label = m[1].trim();
  if (label.length > 28) return null;
  return { label, value: m[2].trim() };
}

function isBareDomainLine(line: string): boolean {
  const t = line.trim();
  if (/[•\s]{2,}/.test(t)) return false;
  if (t.includes(" ") && !t.includes("/")) return false;
  return /^[\w.-]+\.[a-z]{2,}([/][\w./?#&+=-]*)?$/i.test(t);
}

function isProjectHeadingLine(line: string): boolean {
  const t = line.trim();
  if (isBullet(t) || isBareDomainLine(t)) return false;
  if (/[—–]/.test(t) && t.length >= 8) return true;
  if (/\s[-–—]\s/.test(t) && t.length >= 12 && !isDateLine(t)) return true;
  return false;
}

/** Build structured segments (single source of truth for HTML + LaTeX). */
export function parseResumeSegments(text: string): Segment[] {
  const lines = cleanLines(text.trim() || " ");
  const seg: Segment[] = [];
  if (lines.length === 0) return seg;

  let i = 0;
  const name = lines[i++]?.trim() || "Resume";
  seg.push({ type: "name", text: name });

  const contactLines: string[] = [];
  while (i < lines.length && lines[i] && !isSectionHeader(lines[i])) {
    contactLines.push(lines[i].trim());
    i++;
  }
  if (contactLines.length) seg.push({ type: "contact", lines: contactLines });

  let sectionKind: SectionKind = "OTHER";
  type ExpState = "title" | "company" | "wait_date" | "bullets";
  let expState: ExpState = "title";

  const pushBullet = (raw: string) => {
    seg.push({ type: "bullet", text: stripBullet(raw) });
  };

  while (i < lines.length) {
    const raw = lines[i];
    if (!raw.trim()) {
      i++;
      continue;
    }

    if (isSectionHeader(raw)) {
      const h = raw.trim();
      sectionKind = canonicalSection(h);
      expState = "title";
      seg.push({ type: "section", text: h, kind: sectionKind });
      i++;
      continue;
    }

    if (isBullet(raw)) {
      if (sectionKind === "EXPERIENCE") expState = "bullets";
      pushBullet(raw);
      i++;
      continue;
    }

    const line = raw.trim();

    if (sectionKind === "EXPERIENCE") {
      if (expState === "bullets") {
        expState = "title";
      }
      if (isDateLine(line)) {
        seg.push({ type: "dates", text: line });
        expState = "bullets";
        i++;
        continue;
      }
      if (expState === "title") {
        seg.push({ type: "job_title", text: line });
        expState = "company";
        i++;
        continue;
      }
      if (expState === "company") {
        seg.push({ type: "company", text: line });
        expState = "wait_date";
        i++;
        continue;
      }
      if (expState === "wait_date") {
        if (isDateLine(line)) {
          seg.push({ type: "dates", text: line });
          expState = "bullets";
        } else {
          seg.push({ type: "body", text: line });
          expState = "title";
        }
        i++;
        continue;
      }
    }

    if (sectionKind === "EDUCATION") {
      if (isCgpaLine(line)) {
        seg.push({ type: "cgpa", text: line });
        i++;
        continue;
      }
      if (isDateLine(line)) {
        seg.push({ type: "dates", text: line });
        i++;
        continue;
      }
      if (isEduParenNote(line)) {
        seg.push({ type: "edu_note", text: line });
        i++;
        continue;
      }
      if (isDegreeLine(line)) {
        seg.push({ type: "degree", text: line });
        i++;
        continue;
      }
      if (isSchoolishLine(line)) {
        seg.push({ type: "school", text: line });
        i++;
        continue;
      }
      seg.push({ type: "body", text: line });
      i++;
      continue;
    }

    if (sectionKind === "SKILLS") {
      const sk = parseSkillLine(line);
      if (sk) {
        seg.push({ type: "skill", label: sk.label, value: sk.value });
        i++;
        continue;
      }
      seg.push({ type: "body", text: line });
      i++;
      continue;
    }

    if (sectionKind === "PROJECTS") {
      if (isBareDomainLine(line)) {
        seg.push({ type: "project_url", text: line });
        i++;
        continue;
      }
      if (isProjectHeadingLine(line)) {
        seg.push({ type: "project_title", text: line });
        i++;
        continue;
      }
      seg.push({ type: "body", text: line });
      i++;
      continue;
    }

    if (sectionKind === "SUMMARY") {
      seg.push({ type: "summary_line", text: line });
      i++;
      continue;
    }

    seg.push({ type: "body", text: line });
    i++;
  }

  return seg;
}

function segmentsToHtml(segments: Segment[]): string {
  const parts: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      parts.push("</ul>");
      inList = false;
    }
  };

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const next = segments[i + 1];

    if (s.type === "company" && next?.type === "dates") {
      closeList();
      parts.push(
        `<div class="resume-company-dates-row"><span class="resume-company">${escapeHtml(s.text)}</span><span class="resume-dates">${escapeHtml(next.text)}</span></div>`
      );
      i++;
      continue;
    }

    if (s.type === "project_title" && next?.type === "project_url") {
      closeList();
      parts.push(
        `<div class="resume-project-row"><span class="resume-project-title">${escapeHtml(s.text)}</span><span class="resume-project-url">${escapeHtml(next.text)}</span></div>`
      );
      i++;
      continue;
    }

    switch (s.type) {
      case "name":
        parts.push(`<h1 class="resume-name">${escapeHtml(s.text)}</h1>`);
        break;
      case "contact":
        parts.push('<div class="resume-contact-block">');
        for (const ln of s.lines) {
          parts.push(`<p class="resume-contact">${escapeHtml(ln)}</p>`);
        }
        parts.push("</div>");
        break;
      case "section":
        closeList();
        parts.push(`<h2 class="resume-section-title">${escapeHtml(s.text)}</h2>`);
        break;
      case "job_title":
        closeList();
        parts.push(`<p class="resume-job-title">${escapeHtml(s.text)}</p>`);
        break;
      case "company":
        closeList();
        parts.push(`<p class="resume-company">${escapeHtml(s.text)}</p>`);
        break;
      case "dates":
        parts.push(`<p class="resume-dates">${escapeHtml(s.text)}</p>`);
        break;
      case "degree":
        closeList();
        parts.push(`<p class="resume-degree-line">${escapeHtml(s.text)}</p>`);
        break;
      case "school":
        parts.push(`<p class="resume-school-line">${escapeHtml(s.text)}</p>`);
        break;
      case "cgpa":
        parts.push(`<p class="resume-cgpa-line">${escapeHtml(s.text)}</p>`);
        break;
      case "edu_note":
        parts.push(`<p class="resume-edu-note">${escapeHtml(s.text)}</p>`);
        break;
      case "project_title":
        closeList();
        parts.push(`<p class="resume-project-title resume-project-title--solo">${escapeHtml(s.text)}</p>`);
        break;
      case "project_url":
        parts.push(`<p class="resume-project-url">${escapeHtml(s.text)}</p>`);
        break;
      case "skill":
        closeList();
        parts.push(
          `<p class="resume-skill-line"><span class="resume-skill-label">${escapeHtml(s.label)}:</span> <span class="resume-skill-value">${escapeHtml(s.value)}</span></p>`
        );
        break;
      case "summary_line":
        closeList();
        parts.push(`<p class="resume-summary-line">${escapeHtml(s.text)}</p>`);
        break;
      case "body":
        closeList();
        parts.push(`<p class="resume-line">${escapeHtml(s.text)}</p>`);
        break;
      case "bullet":
        if (!inList) {
          parts.push('<ul class="resume-bullets">');
          inList = true;
        }
        parts.push(`<li>${escapeHtml(s.text)}</li>`);
        break;
      default:
        break;
    }
  }
  closeList();
  return `<article class="resume-sheet resume-sheet--muskan">${parts.join("\n")}</article>`;
}

/** Structured HTML aligned to Muskan PDF typography classes. */
export function plainTextResumeToHtml(text: string): string {
  const segments = parseResumeSegments(text.trim() || " ");
  if (segments.length === 0)
    return `<article class="resume-sheet resume-sheet--muskan"><p class="resume-empty">No content</p></article>`;
  return segmentsToHtml(segments);
}

export function latexEscape(s: string): string {
  const map: Record<string, string> = {
    "\\": "\\textbackslash{}",
    "{": "\\{",
    "}": "\\}",
    $: "\\$",
    "&": "\\&",
    "%": "\\%",
    "#": "\\#",
    _: "\\_",
    "~": "\\textasciitilde{}",
    "^": "\\textasciicircum{}",
  };
  return s
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .replace(/</g, "\\textless{}")
    .replace(/>/g, "\\textgreater{}");
}

function linkifyContactFragment(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const asUrl = /^https?:\/\//i.test(t)
    ? t
    : /^[\w.-]+\.[a-z]{2,}(\/[\w./?#&+=-]*)?$/i.test(t.replace(/\s/g, ""))
      ? `https://${t.replace(/^\/*/, "").replace(/\s/g, "")}`
      : null;
  if (asUrl) {
    try {
      const u = new URL(asUrl);
      const display = (u.hostname + u.pathname).replace(/\/$/, "") || u.hostname;
      return `\\href{${latexEscape(u.href)}}{${latexEscape(display)}}`;
    } catch {
      return latexEscape(t);
    }
  }
  return latexEscape(t);
}

/** Two center lines under the name: #2 first contact row, #3 remaining rows joined (template \\header[3]). */
function buildMuskanHeaderContact(contactLines: string[] | undefined): [string, string] {
  if (!contactLines?.length) return ["~", "~"];
  const norm = contactLines.map((l) => l.trim()).filter(Boolean);
  if (norm.length === 1) return [linkifyLineForLatex(norm[0]), "~"];
  const first = linkifyLineForLatex(norm[0]);
  const rest = norm.slice(1).map(linkifyLineForLatex).join(" | ");
  return [first, rest];
}

function linkifyLineForLatex(line: string): string {
  const parts = line
    .split(/\s*\|\s*|\s*[—–]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return linkifyContactFragment(line);
  return parts.map(linkifyContactFragment).join(" | ");
}

type EduBlock = { degree: string; school: string; cgpa: string; dates: string; note: string };

function parseEducationBlocks(parts: Segment[]): EduBlock[] {
  const blocks: EduBlock[] = [];
  let cur: EduBlock | null = null;
  const flush = () => {
    if (cur) {
      blocks.push(cur);
      cur = null;
    }
  };
  for (const p of parts) {
    if (p.type === "degree") {
      flush();
      cur = { degree: p.text, school: "", cgpa: "", dates: "", note: "" };
    } else if (cur) {
      if (p.type === "school") cur.school = p.text;
      else if (p.type === "cgpa") cur.cgpa = p.text;
      else if (p.type === "dates") cur.dates = p.text;
      else if (p.type === "edu_note") cur.note = p.text;
      else if (p.type === "body") cur.note = cur.note ? `${cur.note} ${p.text}` : p.text;
    }
  }
  flush();
  return blocks;
}

type JobBlock = { title: string; company: string; dates: string; bullets: string[] };

function parseExperienceJobs(parts: Segment[]): JobBlock[] {
  const jobs: JobBlock[] = [];
  let j: JobBlock | null = null;
  for (const p of parts) {
    if (p.type === "job_title") {
      if (j) jobs.push(j);
      j = { title: p.text, company: "", dates: "", bullets: [] };
    } else if (j) {
      if (p.type === "company") j.company = p.text;
      else if (p.type === "dates") j.dates = p.text;
      else if (p.type === "bullet") j.bullets.push(p.text);
      else if (p.type === "body") j.bullets.push(p.text);
    }
  }
  if (j) jobs.push(j);
  return jobs;
}

type ProjectBlock = { title: string; url: string; bullets: string[] };

function parseProjectBlocks(parts: Segment[]): ProjectBlock[] {
  const list: ProjectBlock[] = [];
  let cur: ProjectBlock | null = null;
  for (const p of parts) {
    if (p.type === "project_title") {
      if (cur) list.push(cur);
      cur = { title: normalizeProjectTitleForLatex(p.text), url: "", bullets: [] };
    } else if (cur) {
      if (p.type === "project_url") cur.url = p.text.trim();
      else if (p.type === "bullet") cur.bullets.push(p.text);
      else if (p.type === "body") cur.bullets.push(p.text);
    }
  }
  if (cur) list.push(cur);
  return list;
}

function normalizeProjectTitleForLatex(t: string): string {
  return t.replace(/\s*[—–]\s*/g, " -- ");
}

function projectHrefLatex(urlRaw: string): string {
  const t = urlRaw.trim();
  if (!t) return "~";
  const full = /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, "")}`;
  try {
    const u = new URL(full);
    const display = (u.hostname + u.pathname).replace(/\/$/, "") || u.hostname;
    return `\\href{${latexEscape(u.href)}}{${latexEscape(display)}}`;
  } catch {
    return latexEscape(t);
  }
}

function itemizeBody(bullets: string[]): string {
  if (!bullets.length) return "\\begin{itemize}\\end{itemize}";
  const items = bullets.map((b) => `    \\item ${latexEscape(b)}`).join("\n");
  return `\\begin{itemize}\n${items}\n\\end{itemize}`;
}

function renderMuskanSection(kind: SectionKind, title: string, parts: Segment[]): string {
  const sec = latexEscape(title.trim().toUpperCase());
  switch (kind) {
    case "SUMMARY": {
      const lines = parts.filter((p): p is Extract<Segment, { type: "summary_line" }> => p.type === "summary_line");
      const para = lines.map((l) => latexEscape(l.text)).join("\n\n");
      return `\\section{${sec}}\n\\vspace{2pt}\n${para}`;
    }
    case "EDUCATION": {
      const blocks = parseEducationBlocks(parts);
      if (blocks.length === 0) {
        const fallback = parts
          .map((p) => {
            if (p.type === "body") return latexEscape(p.text);
            return "";
          })
          .filter(Boolean)
          .join("\n\n");
        return `\\section{${sec}}\n\\vspace{2pt}\n${fallback || "% (education parse empty)"}`;
      }
      const rows = blocks
        .map((b) => {
          const cgpaCell = b.cgpa ? `\\textbf{${latexEscape(b.cgpa)}}` : "~";
          const row1 = `    \\textbf{${latexEscape(b.degree)}} & ${latexEscape(b.school)} & ${cgpaCell}\\\\`;
          const noteCell = b.note ? latexEscape(b.note) : "";
          const row2 = `    {\\fontsize{9}{10}\\selectfont\\itshape ${latexEscape(b.dates)}} & ${noteCell} & \\\\`;
          return `${row1}\n${row2}`;
        })
        .join("\n");
      return `\\section{${sec}}\n\\vspace{2pt}\n\\begin{tabularx}{\\textwidth}{@{}X X r@{}}\n${rows}\n\\end{tabularx}`;
    }
    case "EXPERIENCE": {
      const jobs = parseExperienceJobs(parts);
      if (jobs.length === 0) {
        const fb = parts.map((p) => ("text" in p ? latexEscape((p as { text: string }).text) : "")).join("\n");
        return `\\section{${sec}}\n\\vspace{2pt}\n${fb}`;
      }
      const chunks = jobs.map((job, idx) => {
        const body = itemizeBody(job.bullets);
        const exp = `\\experience{${latexEscape(job.title)}}{${latexEscape(job.company)}}{${latexEscape(job.dates)}}{\n${body}\n}`;
        return idx < jobs.length - 1 ? `${exp}\n\n\\vspace{3pt}` : exp;
      });
      return `\\section{${sec}}\n\\vspace{2pt}\n${chunks.join("\n\n")}`;
    }
    case "SKILLS": {
      const lines = parts
        .map((p) => {
          if (p.type === "skill") return `\\textbf{${latexEscape(p.label)}:} ${latexEscape(p.value)}\\\\`;
          if (p.type === "body") return `${latexEscape(p.text)}\\\\`;
          return "";
        })
        .filter(Boolean);
      return `\\section{${sec}}\n\\vspace{2pt}\n${lines.join("\n")}`;
    }
    case "PROJECTS": {
      const projects = parseProjectBlocks(parts);
      if (projects.length === 0) {
        const fb = parts.map((p) => ("text" in p ? latexEscape((p as { text: string }).text) : "")).join("\n");
        return `\\section{${sec}}\n\\vspace{2pt}\n${fb}`;
      }
      const chunks = projects.map((proj, idx) => {
        const href = projectHrefLatex(proj.url);
        const body = itemizeBody(proj.bullets);
        const pr = `\\project{${latexEscape(proj.title)}}{${href}}{\n${body}\n}`;
        return idx < projects.length - 1 ? `${pr}\n\n\\vspace{3pt}` : pr;
      });
      return `\\section{${sec}}\n\\vspace{2pt}\n${chunks.join("\n\n")}`;
    }
    case "ACHIEVEMENTS": {
      const bullets = parts.filter((p): p is Extract<Segment, { type: "bullet" }> => p.type === "bullet");
      const bodies = parts.filter((p) => p.type === "body");
      const allItems = [
        ...bullets.map((b) => b.text),
        ...bodies.map((b) => (b.type === "body" ? b.text : "")),
      ].filter(Boolean);
      const list = allItems.map((t) => `    \\item ${latexEscape(t)}`).join("\n");
      const itemize =
        allItems.length > 0
          ? `\\begin{itemize}\n${list}\n\\end{itemize}`
          : "% (no achievement bullets)";
      return `\\section{${sec}}\n\\vspace{2pt}\n${itemize}`;
    }
    default: {
      const lines = parts
        .map((p) => {
          if (p.type === "body") return latexEscape(p.text);
          if (p.type === "bullet") return `\\item ${latexEscape(p.text)}`;
          if ("text" in p && typeof (p as { text?: string }).text === "string")
            return latexEscape((p as { text: string }).text);
          return "";
        })
        .filter(Boolean);
      return `\\section{${sec}}\n\\vspace{2pt}\n${lines.join("\n\n")}`;
    }
  }
}

/** Build document body using Muskan \\section / \\experience / \\project macros. */
function buildMuskanTexBody(segments: Segment[]): string {
  const out: string[] = [];
  let i = 0;
  if (i < segments.length && segments[i].type === "name") {
    const nameSeg = segments[i] as Extract<Segment, { type: "name" }>;
    i++;
    let contact: string[] | undefined;
    if (i < segments.length && segments[i].type === "contact") {
      contact = (segments[i] as Extract<Segment, { type: "contact" }>).lines;
      i++;
    }
    const [line2, line3] = buildMuskanHeaderContact(contact);
    out.push(`\\header{${latexEscape(nameSeg.text)}}{${line2}}{${line3}}`);
  }

  while (i < segments.length) {
    const s = segments[i];
    if (s.type !== "section") {
      i++;
      continue;
    }
    const sec = s as Extract<Segment, { type: "section" }>;
    i++;
    const chunk: Segment[] = [];
    while (i < segments.length && segments[i].type !== "section") {
      chunk.push(segments[i]);
      i++;
    }
    out.push(renderMuskanSection(sec.kind, sec.text, chunk));
  }
  return out.join("\n\n");
}

/** Full .tex using Muskan preamble + generated body (compile with pdflatex). */
export function plainTextResumeToMuskanLatex(text: string): string {
  const segments = parseResumeSegments(text.trim() || " ");
  if (segments.length === 0) {
    return `${MUSKAN_RESUME_PREAMBLE}\n% (empty)\n\\end{document}`;
  }
  const body = buildMuskanTexBody(segments);
  return `${MUSKAN_RESUME_PREAMBLE}\n\n${body}\n\n\\end{document}`;
}

/** Alias for {@link plainTextResumeToMuskanLatex} (Muskan template .tex). */
export function plainTextResumeToLatex(text: string): string {
  return plainTextResumeToMuskanLatex(text);
}
