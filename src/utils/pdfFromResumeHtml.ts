import html2canvas from "html2canvas";

/** 0.35in — matches Muskan one-page template `geometry` margin. */
const MARGIN_PT = 0.35 * 72;

/** Rasterize styled resume HTML to a multi-page A4 PDF (matches Muskan LaTeX template). */
export async function pdfBlobFromResumeElement(el: HTMLElement): Promise<Blob> {
  const { jsPDF } = await import("jspdf");

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
    onclone: (doc) => {
      doc.querySelectorAll(".resume-sheet").forEach((node) => {
        const h = node as HTMLElement;
        h.style.boxShadow = "none";
      });
    },
  });

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const printableWidth = pageWidth - MARGIN_PT * 2;
  const printableHeight = pageHeight - MARGIN_PT * 2;

  const imgWidth = printableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let offsetPt = 0;
  let firstPage = true;

  while (offsetPt < imgHeight - 0.5) {
    if (!firstPage) pdf.addPage();
    firstPage = false;

    const segmentPt = Math.min(printableHeight, imgHeight - offsetPt);
    const srcY = (offsetPt / imgHeight) * canvas.height;
    const srcH = (segmentPt / imgHeight) * canvas.height;

    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.max(1, Math.ceil(srcH));
    const ctx = slice.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable.");
    ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

    const imgData = slice.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", MARGIN_PT, MARGIN_PT, printableWidth, segmentPt);

    offsetPt += segmentPt;
  }

  return pdf.output("blob");
}
