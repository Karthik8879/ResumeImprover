import type { AutofillPayload } from "../types/messages";

const MARKER = "data-ai-job-assistant-filled";

type FieldKind = keyof AutofillPayload;

const KEYWORDS: Record<FieldKind, string[]> = {
  whyHire: ["why", "hire", "motivat", "reason", "interest", "cover", "summary", "about you"],
  relevantExperience: [
    "experience",
    "background",
    "qualif",
    "relevant",
    "work history",
    "describe your",
  ],
  strengths: ["strength", "skill", "competenc", "what makes", "unique", "value"],
};

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function fieldContext(el: Element): string {
  const parts: string[] = [];

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el.getAttribute("aria-label")) parts.push(el.getAttribute("aria-label")!);
    if (el.placeholder) parts.push(el.placeholder);
    if (el.name) parts.push(el.name);
    if (el.id) {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab) parts.push(lab.textContent ?? "");
    }
  }

  let p: Element | null = el.parentElement;
  let depth = 0;
  while (p && depth < 5) {
    const prev = p.previousElementSibling;
    if (prev) parts.push(prev.textContent ?? "");
    const leg = p.querySelector(":scope > label, :scope > legend, :scope > span");
    if (leg) parts.push(leg.textContent ?? "");
    p = p.parentElement;
    depth++;
  }

  return norm(parts.join(" "));
}

function scoreForKind(ctx: string, kind: FieldKind): number {
  let score = 0;
  for (const kw of KEYWORDS[kind]) {
    if (ctx.includes(kw)) score += kw.length;
  }
  return score;
}

function bestKindForElement(el: Element): FieldKind | null {
  const ctx = fieldContext(el);
  if (!ctx) return null;
  const scores: [FieldKind, number][] = (Object.keys(KEYWORDS) as FieldKind[]).map((k) => [
    k,
    scoreForKind(ctx, k),
  ]);
  scores.sort((a, b) => b[1] - a[1]);
  const top = scores[0];
  if (!top || top[1] < 4) return null;
  return top[0];
}

function isFillable(el: Element): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    const t = el.type;
    if (t === "file" || t === "hidden" || t === "button" || t === "submit" || t === "checkbox" || t === "radio")
      return false;
    return t === "text" || t === "search" || t === "email" || t === "" || t === "url";
  }
  return false;
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.focus();
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Heuristic autofill: map visible inputs/textareas to answer buckets by label-like context.
 * Skips file inputs and fields already marked in this session.
 */
export function autofillAnswers(payload: AutofillPayload): { key: string; selector: string }[] {
  const filled: { key: string; selector: string }[] = [];
  const usedKinds = new Set<FieldKind>();

  const candidates = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("textarea, input")
  ).filter(isFillable);

  // Prefer higher textarea count for long answers
  const sorted = [...candidates].sort((a, b) => {
    const aw = a instanceof HTMLTextAreaElement ? 2 : 1;
    const bw = b instanceof HTMLTextAreaElement ? 2 : 1;
    return bw - aw;
  });

  for (const el of sorted) {
    if (el.hasAttribute(MARKER)) continue;
    const current = (el.value ?? "").trim();
    if (current.length > 20) continue;

    const kind = bestKindForElement(el);
    if (!kind || usedKinds.has(kind)) continue;

    const text = payload[kind]?.trim();
    if (!text) continue;

    setValue(el, text);
    el.setAttribute(MARKER, "1");
    usedKinds.add(kind);
    const sel = el.id ? `#${CSS.escape(el.id)}` : el.tagName.toLowerCase();
    filled.push({ key: kind, selector: sel });

    if (usedKinds.size >= 3) break;
  }

  return filled;
}
