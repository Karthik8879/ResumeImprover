import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadResumePreviewPayload, saveResumePreviewPayload } from "../storage/resumePreview";
import { pdfBlobFromPlainText, triggerDownloadBlob, triggerDownload } from "../utils/exportResume";
import { pdfBlobFromResumeElement } from "../utils/pdfFromResumeHtml";
import { plainTextResumeToHtml, plainTextResumeToMuskanLatex } from "../utils/resumeFormat";

/** Full-page editor: edit tailored resume text, see formatted preview, export styled PDF or LaTeX. */
export function PreviewApp() {
  const [body, setBody] = useState("");
  const [meta, setMeta] = useState<{ title?: string; company?: string; jobUrl?: string }>({});
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeRootRef = useRef<HTMLDivElement>(null);

  const resumeHtml = useMemo(() => plainTextResumeToHtml(body), [body]);

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
    setPdfBusy(true);
    try {
      const root = resumeRootRef.current;
      let blob: Blob;
      if (root?.querySelector(".resume-sheet")) {
        try {
          blob = await pdfBlobFromResumeElement(root);
        } catch {
          blob = await pdfBlobFromPlainText(body);
        }
      } else {
        blob = await pdfBlobFromPlainText(body);
      }
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setStatus("PDF preview updated — edit the text on the left and refresh preview as needed.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not build PDF preview.");
    } finally {
      setPdfBusy(false);
    }
  };

  const handleDownloadPdf = async () => {
    setErr(null);
    setStatus(null);
    setPdfBusy(true);
    try {
      const root = resumeRootRef.current;
      let blob: Blob;
      if (root?.querySelector(".resume-sheet")) {
        try {
          blob = await pdfBlobFromResumeElement(root);
        } catch {
          blob = await pdfBlobFromPlainText(body);
        }
      } else {
        blob = await pdfBlobFromPlainText(body);
      }
      triggerDownloadBlob(`resume-${Date.now()}.pdf`, blob);
      setStatus("PDF downloaded — upload it to the employer site.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setPdfBusy(false);
    }
  };

  const handleDownloadTex = () => {
    setErr(null);
    setStatus(null);
    try {
      const tex = plainTextResumeToMuskanLatex(body);
      triggerDownload(`resume-${Date.now()}.tex`, "application/x-tex", tex);
      setStatus("LaTeX (.tex) downloaded — compile with pdflatex or upload to Overleaf.");
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
        <button type="button" disabled={pdfBusy} onClick={() => void handleShowPdf()}>
          Show PDF preview
        </button>
        <button type="button" className="secondary" disabled={pdfBusy} onClick={() => void handleDownloadPdf()}>
          Download styled PDF
        </button>
        <button type="button" className="secondary" onClick={handleDownloadTex}>
          Download LaTeX (.tex)
        </button>
      </div>

      {err ? <p style={{ color: "#f87171" }}>{err}</p> : null}
      {status ? <p style={{ color: "#4ade80", fontSize: 13 }}>{status}</p> : null}

      <div className="layout resume-layout">
        <div className="panel">
          <h2>Edit resume (plain text)</h2>
          <textarea
            className="editor"
            spellCheck
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder="Your tailored resume appears here. Use ALL CAPS section titles (e.g. PROFESSIONAL SUMMARY), then bullets with • or -."
          />
        </div>
        <div className="panel resume-output-panel">
          <h2>Formatted preview</h2>
          <div className="resume-preview-outer">
            <div
              ref={resumeRootRef}
              className="resume-preview-root"
              dangerouslySetInnerHTML={{ __html: resumeHtml }}
            />
          </div>
          <h2 className="panel-subheading">PDF preview</h2>
          {pdfUrl ? (
            <iframe className="pdf-frame" title="PDF preview" src={pdfUrl} />
          ) : (
            <div className="hint pdf-placeholder">
              Click <strong>Show PDF preview</strong> to render the formatted resume as a multi-page PDF.
            </div>
          )}
        </div>
      </div>

      <p className="hint">
        Draft auto-saves to extension storage. The preview uses your Muskan LaTeX layout (A4, 0.4in margins, primary blue
        sections). Download LaTeX produces the full template (preamble + \\header / \\experience / \\project) — compile with
        pdflatex for the exact PDF; the in-browser PDF is a raster A4 preview.
      </p>
    </>
  );
}
