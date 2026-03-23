import { useCallback, useEffect, useRef, useState } from "react";
import { loadResumePreviewPayload, saveResumePreviewPayload } from "../storage/resumePreview";
import { pdfBlobFromPlainText, downloadPlainTextPdf } from "../utils/exportResume";

/** Full-page editor: edit tailored resume text, preview PDF in iframe, download final PDF. */
export function PreviewApp() {
  const [body, setBody] = useState("");
  const [meta, setMeta] = useState<{ title?: string; company?: string; jobUrl?: string }>({});
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadResumePreviewPayload().then((p) => {
      if (!p) {
        setStatus("Open this page from the extension after “Analyze job”, or paste your resume below.");
        return;
      }
      setBody(p.bodyText);
      setMeta(p.meta ?? {});
    });
  }, []);

  const persistDraft = useCallback(
    (text: string, m: typeof meta) => {
      void saveResumePreviewPayload({
        bodyText: text,
        meta: m,
        updatedAt: new Date().toISOString(),
      });
    },
    []
  );

  const onBodyChange = (value: string) => {
    setBody(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistDraft(value, meta), 400);
  };

  const revokePdf = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  };

  useEffect(() => () => revokePdf(), []);

  const handleShowPdf = async () => {
    setErr(null);
    setStatus(null);
    revokePdf();
    try {
      const blob = await pdfBlobFromPlainText(body);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setStatus("PDF preview updated — edit the text on the left and refresh preview as needed.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not build PDF preview.");
    }
  };

  const handleDownloadPdf = async () => {
    setErr(null);
    setStatus(null);
    try {
      await downloadPlainTextPdf(body, `resume-${Date.now()}.pdf`);
      setStatus("PDF downloaded — upload it to the employer site.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Download failed.");
    }
  };

  return (
    <>
      <header className="preview-header">
        <h1>Resume &amp; PDF</h1>
      </header>
      {(meta.title || meta.company || meta.jobUrl) && (
        <div className="preview-meta">
          {[meta.title, meta.company].filter(Boolean).join(" · ")}
          {meta.jobUrl ? (
            <>
              {" · "}
              <a href={meta.jobUrl} target="_blank" rel="noreferrer">
                Job link
              </a>
            </>
          ) : null}
        </div>
      )}

      <div className="toolbar">
        <button type="button" onClick={() => void handleShowPdf()}>
          Show PDF preview
        </button>
        <button type="button" className="secondary" onClick={() => void handleDownloadPdf()}>
          Create / download PDF
        </button>
      </div>

      {err ? <p style={{ color: "#f87171" }}>{err}</p> : null}
      {status ? <p style={{ color: "#4ade80", fontSize: 13 }}>{status}</p> : null}

      <div className="layout">
        <div className="panel">
          <h2>Edit resume (plain text)</h2>
          <textarea
            className="editor"
            spellCheck
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder="Your tailored resume appears here. Edit lines, then use Show PDF preview and Create / download PDF."
          />
        </div>
        <div className="panel">
          <h2>PDF preview</h2>
          {pdfUrl ? (
            <iframe className="pdf-frame" title="PDF preview" src={pdfUrl} />
          ) : (
            <div className="hint" style={{ padding: 16 }}>
              Click <strong>Show PDF preview</strong> to render the current text as a PDF in this pane.
            </div>
          )}
        </div>
      </div>

      <p className="hint">
        Draft auto-saves to extension storage while you type. The popup can send a fresh version from “Analyze job”
        by opening this page again.
      </p>
    </>
  );
}
