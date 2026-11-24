"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("homepage and contact page distinguish home location from remote availability", () => {
  const site = path.resolve(__dirname, "..", "site");
  const homepage = fs.readFileSync(path.join(site, "index.html"), "utf8");
  const contact = fs.readFileSync(path.join(site, "contact.html"), "utf8");

  assert.match(homepage, /Home location: Edmonton region, Alberta, Canada\. Remote work is available throughout Alberta, across Canada, and globally\./);
  assert.doesNotMatch(homepage, /service region/i);
  assert.match(contact, /<h2 id="contact-options-title">Contact and availability<\/h2>/);
  assert.match(contact, /<h3>Home location<\/h3>\s*<p>Edmonton region, Alberta, Canada<\/p>\s*<p>Remote work is available throughout Alberta, across Canada, and globally\.<\/p>/);
  assert.doesNotMatch(contact, /service region/i);
});
