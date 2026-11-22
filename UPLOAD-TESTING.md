# Upload and live visual review

The site is a static bundle in `site/`. The existing GitHub Actions workflow,
`.github/workflows/azure-static-web-apps.yml`, uploads that folder to the
Executive51 Azure Static Web App when manually dispatched. It does not need a
build step.

## Release sequence

1. From the integration worktree, run the offline regression suite:
   `node --test tests/*.test.js`. It uses Node's built-in test runner and has no
   package installation or network dependency.
2. Publish the approved site-only commit through the existing repository
   process. Keep unrelated graph work out of the branch; do not create another
   workflow or deployment path.
3. In the repository's **Actions** tab, select **Deploy Executive51 to Azure
   Static Web Apps**, choose **Run workflow** for the approved branch, and wait
   for a successful run. The workflow checks out the selected branch, runs the
   same offline suite, and skips upload if a test fails. It reads the existing
   deployment secret; never print, copy, or add that value to a file.
4. Open `https://executive51.biz/` in a signed-out browser. If the browser shows
   a certificate warning, stop and report it; do not bypass the warning or
   switch to plaintext HTTP.

## Visual review checklist

Review the homepage, Payments, Alberta directory, Contact, graph directory,
both provider pages, and each enabled graph page at desktop width and a 390 ×
844 mobile viewport. Confirm navigation and the **Backgrounds** selector fit
without horizontal overflow. Test Particle Constellation, Fluid Ink, Vanta Net,
Vanta Waves, Vanta Globe, Vanta Dots, Vanta Rings, Vanta Halo, Gradient Drift,
Canvas Nest, Polygon Surface, Star Nest, Procedural Ocean, Topologica, and No
background. Reload and move between pages to confirm a selected effect persists.
Check keyboard access, pane readability, graph controls, data tables, and
browser errors. Reduce motion in the operating system and confirm animation
pauses.

The automatic default is Particle Constellation at widths up to 600 CSS pixels,
or up to 820 pixels with a coarse pointer, and on non-phone devices reporting at
most four CPU cores or 4 GiB of device memory. Other devices default to Fluid
Ink. A valid saved selection takes precedence; the removed `crystal` preference
is migrated to the detected device default. Only the selected effect's local
scripts are loaded. Full license notices, source mappings, and pack modifications
are in `site/backgrounds/licenses/`, `site/backgrounds/SOURCES.csv`, and
`site/backgrounds/MODIFICATIONS.txt`.

Current baseline: `https://executive51.biz/`. The browser may restrict direct
local-file previews; use a signed-out live browser for final visual review.
