# Upload and live visual review

The site is a static bundle in `site/`. The existing GitHub Actions workflow,
`.github/workflows/azure-static-web-apps.yml`, uploads that folder to the
Executive51 Azure Static Web App when manually dispatched. It does not need a
build step.

## Release sequence

1. Confirm the project release gate is clear and the exact commit has been
   approved for publication. The current management handoff records a rejected
   push gate; do not dispatch a deployment while it remains active.
2. Publish the approved commit through the existing authorized repository
   process. Do not create another workflow or deployment path.
3. In the repository's **Actions** tab, select **Deploy Executive51 to Azure
   Static Web Apps**, choose **Run workflow** for the approved branch, and wait
   for a successful run. The workflow reads the existing deployment secret;
   never print, copy, or add that value to a file.
4. Open `https://executive51.biz/` in a signed-out browser. If the browser shows
   a certificate warning, stop and report it; do not bypass the warning or
   switch to plaintext HTTP.

## Visual review checklist

Review the homepage, Payments, Alberta directory, Contact, graph directory,
both provider pages, and each enabled graph page at desktop width and a 390 ×
844 mobile viewport. Confirm navigation and the **Backgrounds** selector fit
without horizontal overflow. Try Crystal artwork, Particle constellation,
Gradient drift, Canvas nest, Polygon surface, and No background; reload and
move between pages to confirm the selection persists. Check keyboard focus,
content contrast, graph controls, data tables, and browser errors. Reduce motion
in the operating system and confirm animated backgrounds stay paused.

Current baseline: `https://executive51.biz/`. The browser may restrict direct
local-file previews; the live deployment is the visual review target once the
release gate is cleared.
