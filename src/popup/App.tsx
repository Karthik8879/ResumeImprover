import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeJobDescription } from "../api/analyze";
import {
  MSG_AUTOFILL_ANSWERS,
  MSG_EXTRACT_JOB,
  type AutofillPayload,
  type ExtractJobResponse,
} from "../types/messages";
import type { JobPayload } from "../types/job";
import type { JobAnalysis } from "../types/analysis";
import type { AiProvider, ExtensionSettings, ResumeProfile } from "../types/storage";
import { loadSettings, saveSettings } from "../storage/settings";
import { listApplications, saveApplication, exportApplicationsJson } from "../storage/applications";
import { saveResumePreviewPayload } from "../storage/resumePreview";
import {
  buildResumeMarkdown,
  buildResumeText,
  downloadResumePdf,
  triggerDownload,
} from "../utils/exportResume";
import { fetchBundledResume } from "../utils/bundledResume";

function getActiveTabId(): Promise<number | undefined> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]?.id);
    });
  });
}

async function sendToContent<T>(tabId: number, msg: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, msg, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(response as T);
    });
  });
}

export function App() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [job, setJob] = useState<JobPayload | null>(null);
  const [manualJd, setManualJd] = useState("");
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const resumeFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadSettings().then(setSettings);
    void listApplications().then((l) => setSavedCount(l.length));
  }, []);

  const persistSettings = useCallback(async (next: ExtensionSettings) => {
    setSettings(next);
    await saveSettings(next);
  }, []);

  /** First open: fill default resume from bundled Karthik/Muskan .txt when storage is empty. */
  useEffect(() => {
    if (!settings) return;
    if (settings.resumeProfile === "custom") return;
    if (settings.defaultResumeText.trim().length > 0) return;
    if (settings.resumeProfile !== "karthik" && settings.resumeProfile !== "muskan") return;
    let cancelled = false;
    void (async () => {
      const profile = settings.resumeProfile;
      if (profile !== "karthik" && profile !== "muskan") return;
      try {
        const t = await fetchBundledResume(profile);
        if (cancelled) return;
        await persistSettings({ ...settings, defaultResumeText: t });
        setStatus(`Loaded ${profile} resume from extension bundle.`);
      } catch {
        if (!cancelled) {
          setStatus("Run npm run build so resumes copy to dist/resumes, then reload the extension.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings, persistSettings]);

  const handleResumeProfileChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value as ResumeProfile;
      if (!settings) return;
      setError(null);
      if (v === "custom") {
        await persistSettings({ ...settings, resumeProfile: "custom" });
        setStatus("Custom — paste resume text or import a .txt file.");
        return;
      }
      try {
        const t = await fetchBundledResume(v);
        await persistSettings({ ...settings, resumeProfile: v, defaultResumeText: t });
        setStatus(`Loaded ${v} resume from bundle.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load bundled resume.");
      }
    },
    [settings, persistSettings]
  );

  const handleExtract = useCallback(async () => {
    setError(null);
    setStatus(null);
    const tabId = await getActiveTabId();
    if (tabId == null) {
      setError("No active tab.");
      return;
    }
    try {
      const res = await sendToContent<ExtractJobResponse>(tabId, { type: MSG_EXTRACT_JOB });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setJob(res.payload);
      setManualJd(res.payload.description);
      setStatus("Job details loaded from page.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not reach the page. Refresh the job page or paste the JD below."
      );
    }
  }, []);

  const jdForAnalyze = manualJd.trim() || job?.description?.trim() || "";

  const handleAnalyze = useCallback(async () => {
    if (!settings) return;
    setError(null);
    setStatus(null);
    setLoading(true);
    setAnalysis(null);
    const ac = new AbortController();
    const t = window.setTimeout(() => ac.abort(), 120_000);
    try {
      const text = jdForAnalyze;
      if (!text) {
        setError("Load a job page or paste a job description first.");
        return;
      }
      const result = await analyzeJobDescription(text, settings, ac.signal);
      setAnalysis(result);
      setStatus("Analysis ready — review and edit before submitting anywhere.");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setError("Request timed out.");
      } else {
        setError(e instanceof Error ? e.message : "Analysis failed.");
      }
    } finally {
      window.clearTimeout(t);
      setLoading(false);
    }
  }, [settings, jdForAnalyze]);

  const answersForEdit = analysis
    ? { ...analysis.answers }
    : { whyHire: "", relevantExperience: "", strengths: "" };

  const setAnswer = (key: keyof JobAnalysis["answers"], value: string) => {
    if (!analysis) return;
    setAnalysis({
      ...analysis,
      answers: { ...analysis.answers, [key]: value },
    });
  };

  const setBulletsText = (raw: string) => {
    if (!analysis) return;
    const lines = raw
      .split("\n")
      .map((l) => l.replace(/^•\s*/, "").trim())
      .filter(Boolean);
    setAnalysis({ ...analysis, resumeBullets: lines });
  };

  const setTailoredResumeFullText = (text: string) => {
    if (!analysis) return;
    setAnalysis({ ...analysis, tailoredResumeFullText: text });
  };

  const handleOpenResumePreview = useCallback(async () => {
    setError(null);
    setStatus(null);
    if (!analysis?.tailoredResumeFullText?.trim()) {
      setError("Run analysis first to generate a tailored resume.");
      return;
    }
    try {
      await saveResumePreviewPayload({
        bodyText: analysis.tailoredResumeFullText,
        meta: {
          title: job?.title,
          company: job?.company,
          jobUrl: job?.url,
        },
        updatedAt: new Date().toISOString(),
      });
      const url = chrome.runtime.getURL("preview.html");
      await chrome.tabs.create({ url });
      setStatus("Opened resume editor tab — preview PDF there after edits.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open preview tab.");
    }
  }, [analysis, job]);

  const handleImportDefaultResume = useCallback(
    (file: File | undefined) => {
      if (!file || !settings) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === "string" ? reader.result : "";
        void persistSettings({ ...settings, resumeProfile: "custom", defaultResumeText: text });
        setStatus(`Imported ${file.name} — profile set to Custom.`);
      };
      reader.onerror = () => setError("Could not read file.");
      reader.readAsText(file);
    },
    [settings, persistSettings]
  );

  const handleAutofill = useCallback(async () => {
    setError(null);
    setStatus(null);
    if (!analysis) {
      setError("Run analysis first.");
      return;
    }
    const tabId = await getActiveTabId();
    if (tabId == null) {
      setError("No active tab.");
      return;
    }
    const payload: AutofillPayload = {
      whyHire: analysis.answers.whyHire,
      relevantExperience: analysis.answers.relevantExperience,
      strengths: analysis.answers.strengths,
    };
    try {
      const res = await sendToContent<{ ok: boolean; filled?: { key: string }[]; error?: string }>(
        tabId,
        { type: MSG_AUTOFILL_ANSWERS, payload }
      );
      if (!res.ok) {
        setError(res.error ?? "Autofill failed.");
        return;
      }
      setStatus(`Filled ${res.filled?.length ?? 0} field(s). Verify before submit.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Autofill failed.");
    }
  }, [analysis]);

  const handleSaveJob = useCallback(async () => {
    setError(null);
    setStatus(null);
    if (!analysis) {
      setError("Run analysis before saving.");
      return;
    }
    try {
      let url = job?.url ?? "";
      let company = job?.company ?? "Unknown company";
      let role = job?.title ?? "Unknown role";
      if (!job) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const t = tabs[0];
        if (t?.url) url = t.url;
        if (t?.title) role = t.title;
      }
      if (!url) url = "manual-entry";

      await saveApplication({
        url,
        company,
        role,
        appliedAt: new Date().toISOString(),
        jdExcerpt: jdForAnalyze,
        answers: {
          ...analysis.answers,
          resumeBullets: analysis.resumeBullets,
          matchScore: analysis.matchScore,
          tailoredResumeFullText: analysis.tailoredResumeFullText,
        },
      });
      const list = await listApplications();
      setSavedCount(list.length);
      setStatus("Saved to local storage.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    }
  }, [analysis, job, jdForAnalyze]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied.");
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  const handleExportApps = async () => {
    try {
      const json = await exportApplicationsJson();
      triggerDownload(`ai-job-assistant-applications.json`, "application/json", json);
      setStatus("Exported applications JSON.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    }
  };

  if (!settings) {
    return <p className="small">Loading…</p>;
  }

  return (
    <>
      <h1>AI Job Assistant</h1>
      <p className="disclaimer">
        AI drafts can be wrong — always edit facts before you apply. Works alongside tools like Simplify;
        this extension does not upload files automatically.
      </p>

      <details className="settings" open>
        <summary>API &amp; profile</summary>
        <div className="stack" style={{ marginTop: 8 }}>
          <div>
            <label htmlFor="provider">Provider</label>
            <select
              id="provider"
              value={settings.provider}
              onChange={(e) =>
                void persistSettings({ ...settings, provider: e.target.value as AiProvider })
              }
            >
              <option value="openrouter">OpenRouter (Qwen, free models, …)</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          {settings.provider === "openrouter" ? (
            <>
              <div>
                <label htmlFor="ork">OpenRouter API key</label>
                <input
                  id="ork"
                  type="password"
                  autoComplete="off"
                  placeholder="sk-or-v1-…"
                  value={settings.openrouterApiKey}
                  onChange={(e) => persistSettings({ ...settings, openrouterApiKey: e.target.value })}
                />
                <p className="small" style={{ marginTop: 4 }}>
                  Get a key at{" "}
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
                    openrouter.ai/keys
                  </a>
                  . Paste here — stored only in this browser. Switch the model below if a free tier runs out.
                </p>
              </div>
              <div>
                <label htmlFor="ormodel">Model id</label>
                <input
                  id="ormodel"
                  type="text"
                  list="openrouter-model-suggestions"
                  value={settings.openrouterModel}
                  onChange={(e) => persistSettings({ ...settings, openrouterModel: e.target.value })}
                />
                <datalist id="openrouter-model-suggestions">
                  <option value="qwen/qwen2.5-7b-instruct:free" />
                  <option value="qwen/qwen-2.5-7b-instruct:free" />
                  <option value="google/gemma-2-9b-it:free" />
                  <option value="meta-llama/llama-3.2-3b-instruct:free" />
                  <option value="mistralai/mistral-7b-instruct:free" />
                  <option value="huggingfaceh4/zephyr-7b-beta:free" />
                </datalist>
                <p className="small" style={{ marginTop: 4 }}>
                  Free models often end with <code>:free</code>. Browse current IDs on{" "}
                  <a href="https://openrouter.ai/models" target="_blank" rel="noreferrer">
                    openrouter.ai/models
                  </a>
                  .
                </p>
              </div>
            </>
          ) : null}
          {settings.provider === "anthropic" ? (
            <>
              <div>
                <label htmlFor="ak">Anthropic API key</label>
                <input
                  id="ak"
                  type="password"
                  autoComplete="off"
                  value={settings.anthropicApiKey}
                  onChange={(e) => persistSettings({ ...settings, anthropicApiKey: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="amodel">Model id</label>
                <input
                  id="amodel"
                  type="text"
                  value={settings.anthropicModel}
                  onChange={(e) => persistSettings({ ...settings, anthropicModel: e.target.value })}
                />
              </div>
            </>
          ) : null}
          {settings.provider === "openai" ? (
            <>
              <div>
                <label htmlFor="ok">OpenAI API key</label>
                <input
                  id="ok"
                  type="password"
                  autoComplete="off"
                  value={settings.openaiApiKey}
                  onChange={(e) => persistSettings({ ...settings, openaiApiKey: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="omodel">Model id</label>
                <input
                  id="omodel"
                  type="text"
                  value={settings.openaiModel}
                  onChange={(e) => persistSettings({ ...settings, openaiModel: e.target.value })}
                />
              </div>
            </>
          ) : null}
          <div>
            <label htmlFor="resumeProfile">Resume owner</label>
            <select
              id="resumeProfile"
              value={settings.resumeProfile}
              onChange={(e) => void handleResumeProfileChange(e)}
            >
              <option value="karthik">Karthik (bundled text)</option>
              <option value="muskan">Muskan (bundled text)</option>
              <option value="custom">Custom — paste or import .txt</option>
            </select>
            <p className="small" style={{ marginTop: 4 }}>
              Karthik/Muskan use <code>resumes/karthik.txt</code> and <code>resumes/muskan.txt</code> from your build
              (exported from PDF). Updating PDFs: edit paths in <code>scripts/extract-resumes.mjs</code>, run{" "}
              <code>npm run extract-resumes</code>, then <code>npm run build</code>.
            </p>
          </div>
          <div>
            <label htmlFor="defaultResume">Default resume (full text — configurable)</label>
            <textarea
              id="defaultResume"
              rows={8}
              placeholder="Paste your full resume as plain text (from PDF/Word). This is sent to the AI with each job to produce a tailored version."
              value={settings.defaultResumeText}
              onChange={(e) => persistSettings({ ...settings, defaultResumeText: e.target.value })}
            />
            <input
              ref={resumeFileInputRef}
              type="file"
              accept=".txt,.text,text/plain"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                handleImportDefaultResume(f);
                e.target.value = "";
              }}
            />
            <div className="row" style={{ marginTop: 6 }}>
              <button
                type="button"
                className="secondary"
                onClick={() => resumeFileInputRef.current?.click()}
              >
                Import .txt
              </button>
              <span className="small">
                Import sets profile to Custom. PDFs: convert to .txt via{" "}
                <code>npm run extract-resumes</code> (dev machine) or paste text here.
              </span>
            </div>
          </div>
          <div>
            <label htmlFor="profile">Extra notes (optional)</label>
            <textarea
              id="profile"
              placeholder="Targeting, constraints, or keywords — added on top of the default resume."
              value={settings.userProfileSummary}
              onChange={(e) => persistSettings({ ...settings, userProfileSummary: e.target.value })}
            />
          </div>
        </div>
      </details>

      <div className="row">
        <button type="button" className="secondary" onClick={() => void handleExtract()}>
          Load from page
        </button>
        <button type="button" onClick={() => void handleAnalyze()} disabled={loading}>
          {loading ? "Analyzing…" : "Analyze job"}
        </button>
      </div>
      <div className="row">
        <button type="button" className="secondary" onClick={() => void handleAutofill()} disabled={!analysis}>
          Autofill answers
        </button>
        <button type="button" className="secondary" onClick={() => void handleSaveJob()} disabled={!analysis}>
          Save job
        </button>
      </div>

      <p className="small">Saved applications (local): {savedCount}</p>
      <div className="row">
        <button type="button" className="secondary" onClick={() => void handleExportApps()}>
          Export saved JSON
        </button>
      </div>

      {error ? <p className="err">{error}</p> : null}
      {status ? <p className="ok-msg">{status}</p> : null}

      <h2>Job description</h2>
      <label htmlFor="jd">Edit or paste JD if extraction missed content</label>
      <textarea
        id="jd"
        rows={6}
        value={manualJd}
        onChange={(e) => setManualJd(e.target.value)}
        placeholder="Use “Load from page” or paste the job description here."
      />

      {job ? (
        <div className="job-meta">
          <strong>{job.title}</strong> · {job.company}
          <br />
          <span className="small">{job.source} · </span>
          <a href={job.url} target="_blank" rel="noreferrer" className="small">
            Open tab
          </a>
        </div>
      ) : null}

      {analysis ? (
        <>
          <h2>Match</h2>
          <div className="score">{analysis.matchScore}%</div>
          {analysis.assumptions ? <p className="small">{analysis.assumptions}</p> : null}

          <h2>Tailored resume (full text)</h2>
          <p className="small">
            Edit here or open the full-page editor for PDF preview and download.
          </p>
          <textarea
            rows={12}
            value={analysis.tailoredResumeFullText}
            onChange={(e) => setTailoredResumeFullText(e.target.value)}
            placeholder="Full tailored resume from AI — edit before PDF."
          />
          <div className="row">
            <button type="button" onClick={() => void handleOpenResumePreview()}>
              Open resume &amp; PDF editor
            </button>
          </div>

          <h2>Tailored bullets</h2>
          <textarea
            rows={8}
            value={analysis.resumeBullets.map((b) => `• ${b}`).join("\n")}
            onChange={(e) => setBulletsText(e.target.value)}
          />
          <div className="row">
            <button
              type="button"
              className="secondary"
              onClick={() => copy(analysis.resumeBullets.map((b) => `• ${b}`).join("\n"))}
            >
              Copy bullets
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                triggerDownload(
                  "tailored-resume.txt",
                  "text/plain",
                  analysis.tailoredResumeFullText ||
                    buildResumeText(analysis.resumeBullets, job?.title, job?.company)
                )
              }
            >
              Download .txt
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                triggerDownload(
                  "tailored-resume.md",
                  "text/markdown",
                  analysis.tailoredResumeFullText
                    ? `# Tailored resume\n\n${analysis.tailoredResumeFullText}`
                    : buildResumeMarkdown(analysis.resumeBullets, job?.title, job?.company)
                )
              }
            >
              Download .md
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => void downloadResumePdf(analysis, { title: job?.title, company: job?.company })}
            >
              Quick download PDF
            </button>
          </div>

          <h2>Answers</h2>
          {(["whyHire", "relevantExperience", "strengths"] as const).map((key) => (
            <div key={key} style={{ marginBottom: 8 }}>
              <label htmlFor={key}>{key}</label>
              <textarea
                id={key}
                rows={5}
                value={answersForEdit[key]}
                onChange={(e) => setAnswer(key, e.target.value)}
              />
              <button type="button" className="secondary" onClick={() => copy(answersForEdit[key])}>
                Copy
              </button>
            </div>
          ))}
        </>
      ) : null}
    </>
  );
}
