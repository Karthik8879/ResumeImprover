/** Extracted job context from the active tab. */
export type JobPayload = {
  url: string;
  title: string;
  company: string;
  description: string;
  source: "linkedin" | "naukri" | "generic";
};
