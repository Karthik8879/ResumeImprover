import {
  MSG_AUTOFILL_ANSWERS,
  MSG_EXTRACT_JOB,
  type AutofillPayload,
  type AutofillResponse,
  type ExtractJobResponse,
} from "../types/messages";
import { autofillAnswers } from "./autofill";
import { extractJobFromPage } from "./extract";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === MSG_EXTRACT_JOB) {
    try {
      const payload = extractJobFromPage();
      if (!payload.description || payload.description.length < 80) {
        const res: ExtractJobResponse = {
          ok: false,
          error:
            "Could not read enough job text on this page. Paste the JD into the popup or open the full job description.",
        };
        sendResponse(res);
        return true;
      }
      const res: ExtractJobResponse = { ok: true, payload };
      sendResponse(res);
    } catch (e) {
      const res: ExtractJobResponse = {
        ok: false,
        error: e instanceof Error ? e.message : "Extraction failed",
      };
      sendResponse(res);
    }
    return true;
  }

  if (message?.type === MSG_AUTOFILL_ANSWERS) {
    try {
      const payload = message.payload as AutofillPayload;
      const filled = autofillAnswers(payload);
      const res: AutofillResponse = { ok: true, filled };
      sendResponse(res);
    } catch (e) {
      const res: AutofillResponse = {
        ok: false,
        error: e instanceof Error ? e.message : "Autofill failed",
      };
      sendResponse(res);
    }
    return true;
  }

  return false;
});
