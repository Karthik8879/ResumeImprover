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

This runs Vite for the React **popup** and **preview** pages, esbuild for `background.js` and `content.js`, and copies `extension/manifest.json` into `dist/`.

## Load unpacked in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the **`dist`** folder inside this project (not the repo root)

## Configure

1. Click the extension icon to open the popup
2. Expand **API & profile**
3. Choose **Anthropic** or **OpenAI**, paste your API key, adjust the model id if needed
4. Paste your **default resume (full plain text)** — or **Import .txt** — so the model can tailor a full resume per job (see `extension/default-resume.sample.txt` in the repo as a starting template)
5. Optionally add **Extra notes** (targeting, keywords)

## Use

1. Open a job posting (LinkedIn, Naukri, or most career sites)
2. **Load from page** — fills the job description textarea when extraction works
3. Edit the JD text if needed, then **Analyze job**
4. Review match score, **tailored full resume**, bullets, and answers
5. **Open resume & PDF editor** — new tab with a split view: edit plain text, **Show PDF preview**, then **Create / download PDF** after edits (upload that file manually to the employer)
6. On the application form tab, **Autofill answers** (heuristic — always verify)
7. **Save job** stores a snapshot locally; **Export saved JSON** backs up your list

## Security

API keys are stored only in your browser (`chrome.storage.local`). Do not commit keys or built artifacts containing them.

## Development note

For day-to-day UI work you can run `vite build --watch` in one terminal and `node scripts/build-extension.mjs --watch` in another so `dist/` updates as you edit.
