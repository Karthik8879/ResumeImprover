import type { JobPayload } from "../types/job";
import { normalizeWhitespace } from "../utils/text";

function textFrom(el: Element | null | undefined): string {
  if (!el) return "";
  return normalizeWhitespace(el.textContent ?? "");
}

function pickLargestTextBlock(root: Document): string {
  const skip = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG"]);
  const candidates: { len: number; text: string }[] = [];

  const blocks = root.querySelectorAll(
    "main, article, [role=main], [itemprop=description], section, div"
  );
  blocks.forEach((el) => {
    if (skip.has(el.tagName)) return;
    const t = normalizeWhitespace(el.textContent ?? "");
    if (t.length > 400) candidates.push({ len: t.length, text: t });
  });

  if (candidates.length === 0) {
    const body = root.body;
    const t = body ? normalizeWhitespace(body.innerText ?? "") : "";
    return t;
  }

  candidates.sort((a, b) => b.len - a.len);
  return candidates[0]?.text ?? "";
}

/** LinkedIn job posting page — selectors drift; update when layout changes. */
function extractLinkedIn(doc: Document, url: string): JobPayload {
  const title =
    textFrom(doc.querySelector(".job-details-jobs-unified-top-card__job-title")) ||
    textFrom(doc.querySelector("h1")) ||
    "Unknown role";

  const company =
    textFrom(
      doc.querySelector(
        ".job-details-jobs-unified-top-card__company-name a, .job-details-jobs-unified-top-card__company-name"
      )
    ) || textFrom(doc.querySelector('[data-testid="job-poster"]')) || "Unknown company";

  let description =
    textFrom(doc.querySelector(".jobs-description-content__text, .jobs-box__html-content")) ||
    textFrom(doc.querySelector(".jobs-description")) ||
    pickLargestTextBlock(doc);

  return {
    url,
    title,
    company,
    description,
    source: "linkedin",
  };
}

/** Naukri job detail — best-effort selectors. */
function extractNaukri(doc: Document, url: string): JobPayload {
  const title =
    textFrom(doc.querySelector(".jd-header .title, .jd-header h1, h1")) || "Unknown role";
  const company =
    textFrom(doc.querySelector(".jd-header .comp-name, a.comp-name, .company-name")) ||
    "Unknown company";
  let description =
    textFrom(doc.querySelector(".jd-desc, .job-desc, [itemprop=description]")) ||
    pickLargestTextBlock(doc);

  return {
    url,
    title,
    company,
    description,
    source: "naukri",
  };
}

function extractGeneric(doc: Document, url: string): JobPayload {
  const title =
    textFrom(doc.querySelector("h1")) ||
    textFrom(doc.querySelector('[property="og:title"]')) ||
    document.title ||
    "Unknown role";

  const company =
    textFrom(doc.querySelector('[property="og:site_name"]')) ||
    textFrom(doc.querySelector('[data-company]')) ||
    "Unknown company";

  const description =
    textFrom(doc.querySelector('[itemprop="description"]')) ||
    textFrom(doc.querySelector("article")) ||
    pickLargestTextBlock(doc);

  return {
    url,
    title,
    company,
    description,
    source: "generic",
  };
}

function detectSource(hostname: string): "linkedin" | "naukri" | "generic" {
  if (hostname.includes("linkedin.com")) return "linkedin";
  if (hostname.includes("naukri.com")) return "naukri";
  return "generic";
}

/** Route by host and extract title, company, JD text. */
export function extractJobFromPage(): JobPayload {
  const url = window.location.href;
  const host = window.location.hostname;
  const source = detectSource(host);
  const doc = document;

  if (source === "linkedin") return extractLinkedIn(doc, url);
  if (source === "naukri") return extractNaukri(doc, url);
  return extractGeneric(doc, url);
}
