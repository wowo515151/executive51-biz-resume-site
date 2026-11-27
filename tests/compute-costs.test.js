"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const site = path.resolve(__dirname, "..", "site");
const read = (name) => fs.readFileSync(path.join(site, name), "utf8");

test("homepage links near the top to the standalone compute costs page", () => {
  const homepage = read("index.html");
  const linkIndex = homepage.indexOf('href="compute-costs.html"');
  const mainIndex = homepage.indexOf("<main id=\"main\">");
  const firstSectionIndex = homepage.indexOf('<section class="resume-section"');
  assert.ok(linkIndex > mainIndex && linkIndex < firstSectionIndex, "the compute-costs link appears in the homepage hero near the top");
  assert.match(homepage, /href="compute-costs\.html">GPU compute and project setup costs/);
});

test("compute costs page explains thread, GPU, Azure, and setup costs", () => {
  const page = read("compute-costs.html");
  for (const text of [
    "The $1/hour fee covers the basic computing cost of running one AI thread.",
    "Projects that require substantial GPU computing power for model development will need to cover the additional fees.",
    "Executive51 is set up to use Azure.",
    "You will not be charged a premium on top of Azure's fees",
    "complete it within an hour or two",
    "Prices for a GPU-enabled machine on Azure start at less than a dollar.",
    "Other compute arrangements are possible; feel free to inquire."
  ]) assert.ok(page.includes(text), `the page includes: ${text}`);
  assert.match(page, /<site-nav><\/site-nav>/);
  assert.match(page, /<site-ad class="site-ad-slot"><\/site-ad>/);
  assert.match(page, /href="index\.html#top"/);
});
