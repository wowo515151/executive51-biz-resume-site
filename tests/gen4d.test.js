"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("homepage links to the live Gen4D demo and its source repository", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "..", "site", "index.html"), "utf8");
  const section = html.match(/<section class="resume-section section-tinted" id="gen4d-demo" aria-labelledby="gen4d-demo-title">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(section, "the homepage includes a dedicated Gen4D section");
  assert.match(section, /<h2 id="gen4d-demo-title">Gen4D, built with Executive51<\/h2>/);
  const externalLinks = [...section.matchAll(/<a class="payment-page-link" href="(https:\/\/[^\"]+)"([^>]*)>/g)];
  assert.deepEqual(externalLinks.map((match) => match[1]), [
    "https://wowo515151.github.io/Gen4D/",
    "https://github.com/wowo515151/Gen4D"
  ]);
  for (const [, , attributes] of externalLinks) {
    assert.match(attributes, /target="_blank"/, "external links open in a new tab");
    assert.match(attributes, /rel="noopener noreferrer"/, "external tabs cannot access the opener");
  }
  assert.match(html, /<div class="section-index"><span>07<\/span><span class="index-line"><\/span>Contact<\/div>/, "the contact section is the seventh section");
});
