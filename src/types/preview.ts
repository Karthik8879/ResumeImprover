/** Payload passed to the resume / PDF preview tab (chrome.storage.local). */
export type ResumePreviewPayload = {
  bodyText: string;
  meta: {
    title?: string;
    company?: string;
    jobUrl?: string;
  };
  updatedAt: string;
};
