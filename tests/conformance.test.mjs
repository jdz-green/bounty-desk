// Conformance and integrity checks for the Bounty Desk open agentic website.
// Run: node --test tests/
// These do not call an LLM: they check the published artifacts, the action contract
// and the feed shape, which is what another site or the runtime relies on.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), "utf8"));
const manifest = await read("../agent-manifest.json");
const network = await read("../bounty_desk.network.json");
const links = await read("../links.json");
const feed = await read("../data/bounties.json");
const wellKnown = await read("../.well-known/nsdeploy.json");
const bridgeManifest = await read("../bridge/agent-manifest.json");

test("manifest names a network with a front man and an existing network file", async () => {
  assert.ok(Array.isArray(manifest.networks) && manifest.networks.length > 0);
  for (const n of manifest.networks) {
    assert.equal(typeof n.name, "string");
    assert.equal(typeof n.front_man, "string");
    assert.ok(n.hocon.endsWith(".json"), "network definition should resolve to JSON for the browser");
    const resolved = await read("../" + n.hocon.replace(/^\.\//, ""));
    assert.ok(resolved.tools.some((t) => t.name === n.front_man), `${n.front_man} must exist in the network`);
  }
});

test("the network's agents are uniquely named and every peer tool is in link_labels", () => {
  const names = network.tools.map((t) => t.name);
  assert.equal(new Set(names).size, names.length, "agent names must be unique");
  assert.ok(network.tools.every((t) => t.function?.description && t.instructions), "every agent needs a description and instructions");
  const peerUrls = network.tools.flatMap((t) => (t.tools || []).filter((u) => /^https?:\/\//.test(u)));
  for (const url of peerUrls) {
    assert.ok(network.link_labels?.[url], `peer ${url} needs a label in link_labels`);
  }
});

test("instructions never promise a payment or a submission this site cannot make", () => {
  const text = JSON.stringify(network).toLowerCase();
  for (const banned of ["you will be paid", "guaranteed payment", "we will submit", "apply on the visitor's behalf"]) {
    assert.ok(!text.includes(banned), `network text must not promise: ${banned}`);
  }
});

test("actions module exports registerActions and every tool the manifest lists exists", async () => {
  const mod = await import("../site-actions.js");
  assert.equal(typeof mod.registerActions, "function");
  const registered = [];
  mod.registerActions({ register: (def) => registered.push(def) });
  const names = registered.map((a) => a.name);
  assert.deepEqual([...names].sort(), [...manifest.actions.agentTools].sort());
  for (const a of registered) {
    assert.ok(["read", "write"].includes(a.effect), `${a.name} needs a known effect`);
    assert.equal(a.inputSchema.type, "object", `${a.name} needs an object schema`);
    assert.ok(a.description.length > 40, `${a.name} needs a useful description`);
  }
});

test("bridge exposes read-only actions to peers", async () => {
  const mod = await import("../bridge/bridge-actions.js");
  const registered = [];
  mod.registerActions({ register: (def) => registered.push(def) });
  assert.ok(registered.length > 0);
  for (const a of registered) {
    assert.equal(a.effect, "read", `${a.name} must be read-only through the bridge`);
    assert.equal(a.callerOrigins, "*", "public reads are open to any caller origin");
  }
  assert.equal(bridgeManifest.networks[0].name, manifest.networks[0].name);
});

test("the bridge manifest names an action module that exists", async () => {
  const modulePath = bridgeManifest.actions?.module;
  assert.ok(modulePath, "the bridge manifest must name its action module");
  const file = new URL("../bridge/" + modulePath.replace(/^\.\//, ""), import.meta.url);
  const source = await readFile(file, "utf8");
  assert.match(source, /registerActions/, "the module must export registerActions");
});

test("links.json and .well-known export the same network", () => {
  const name = manifest.networks[0].name;
  assert.ok(links.networks[name], "links.json must have an entry for the network");
  assert.equal(wellKnown.exports[0].network, name);
  assert.equal(wellKnown.protocol, "nsdeploy-link/v1");
});

test("the feed is well formed and every row carries what the agents promise to show", () => {
  assert.equal(typeof feed.generated_at, "string");
  assert.ok(Array.isArray(feed.bounties) && feed.bounties.length > 0);
  const sources = new Set(feed.bounties.map((b) => b.source));
  assert.ok(sources.size >= 2, "the feed should mix sources, not be one catalogue");
  for (const b of feed.bounties) {
    for (const key of ["title", "reward", "source", "url"]) {
      assert.ok(b[key] !== undefined && b[key] !== "", `row ${b.title || "?"} is missing ${key}`);
    }
    assert.match(b.url, /^https?:\/\//);
    assert.ok(["immunefi", "superteam", "stellarator", "github", "opire"].includes(b.source), `unknown source ${b.source}`);
  }
});
