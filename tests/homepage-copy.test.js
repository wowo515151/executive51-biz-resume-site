"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("homepage profile begins with the requested agent capability sentence", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "..", "site", "index.html"), "utf8");
  const profile = html.match(/<section class="resume-section" id="profile" aria-labelledby="profile-title">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(profile, "the homepage includes its profile panel");
  const paragraphs = [...profile.matchAll(/<p>(.*?)<\/p>/g)].map((match) => match[1]);
  assert.equal(paragraphs[0], "An Executive51 agent can usually perform as much work or more as a qualified human when performing a job the agent is capable of.");
  assert.match(paragraphs[1], /^Executive51 is a long-running agent system/);
});
