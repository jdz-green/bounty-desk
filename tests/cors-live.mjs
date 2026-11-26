// Live check that the deployed public artifacts are readable from another origin.
// The spec requires CORS on the manifest, the network, links.json and the feed, so a peer
// site can load them from its own origin. Run against the deployed site, not a local server:
//   node tests/cors-live.mjs https://jdz-green.github.io/bounty-desk/
const base = (process.argv[2] || "https://jdz-green.github.io/bounty-desk/").replace(/\/?$/, "/");
const paths = ["agent-manifest.json", "bounty_desk.network.json", "links.json", "data/bounties.json"];

let failed = 0;
for (const path of paths) {
  const url = new URL(path, base);
  const res = await fetch(url, { headers: { Origin: "https://example-peer.test" } });
  const allow = res.headers.get("access-control-allow-origin");
  const ok = res.ok && (allow === "*" || allow === "https://example-peer.test");
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${path}  ${res.status}  allow-origin=${allow ?? "(none)"}`);
}
if (failed) {
  console.error(`\n${failed} public artifact(s) are not readable cross-origin.`);
  process.exit(1);
}
console.log("\nAll public artifacts are readable from another origin.");
