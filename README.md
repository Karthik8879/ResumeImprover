# AI Job Assistant (Chrome Extension)

Manifest V3 extension: extract job descriptions from common job sites, analyze with OpenAI or Anthropic, edit tailored bullets and answers, optionally autofill visible form fields, and save application records locally (`chrome.storage.local`).

## Prerequisites

- Node.js 18+
- Chrome (or Chromium)

## Build

```bash
npm install
npm run build
```

This runs Vite for the React **popup** and **preview** pages, esbuild for `background.js` and `content.js`, copies `extension/manifest.json`, and copies **`extension/resumes/` → `dist/resumes/`** (bundled resume text).

## Load unpacked in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the **`dist`** folder inside this project (not the repo root)

## Configure

1. Click the extension icon to open the popup
2. Expand **API & profile**
3. Choose **OpenRouter** (default), **Anthropic**, or **OpenAI**. OpenRouter ships with a **built-in key** (you can still replace it in the popup). Pick a model id (often `…:free`); see [openrouter.ai/models](https://openrouter.ai/models).
4. Choose **Resume owner**: **Karthik** or **Muskan** loads bundled text from `extension/resumes/*.txt` (copied to `dist/resumes` on build), or **Custom** to paste / **Import .txt**
5. OpenRouter key is **built into the extension** for convenience; you can still override it in the popup. **Do not use a public repo** if the key or resume text must stay private
6. To **refresh resumes from PDF** (paths in `scripts/extract-resumes.mjs`): `npm run extract-resumes` then `npm run build`
7. Optionally add **Extra notes** (targeting, keywords)

## Use

1. Open a job posting (LinkedIn, Naukri, or most career sites)
2. **Load from page** — fills the job description textarea when extraction works
3. Edit the JD text if needed, then **Analyze job**
4. Review match score, **tailored full resume**, bullets, and answers
5. **Open resume & PDF editor** — new tab with a split view: edit plain text, **Show PDF preview**, then **Create / download PDF** after edits (upload that file manually to the employer)
6. On the application form tab, **Autofill answers** (heuristic — always verify)
7. **Save job** stores a snapshot locally; **Export saved JSON** backs up your list

## Security

- A **default OpenRouter key** is embedded in source for personal use; anyone with the code can use it — **rotate the key** if the repo is public or shared.
- Overrides are stored in **`chrome.storage.local`** when you type a key in the popup.
- Bundled **resume .txt files contain personal data**; keep the repo **private** if needed.

## Development note

For day-to-day UI work you can run `vite build --watch` in one terminal and `node scripts/build-extension.mjs --watch` in another so `dist/` updates as you edit.
