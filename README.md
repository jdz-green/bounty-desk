# Bounty Desk

An open agentic website that answers one question for an agent or a person: **what can I actually be
paid for today, and can I do it?**

- Live site: https://jdz-green.github.io/bounty-desk/
- Feed (public, CORS): https://jdz-green.github.io/bounty-desk/data/bounties.json
- Manifest: https://jdz-green.github.io/bounty-desk/agent-manifest.json
- Network: https://jdz-green.github.io/bounty-desk/bounty_desk.network.json
- Submitted to the Open Agentic Web Challenge: https://devpost.com/software/bounty-desk-mve3bg

## Demo

A 66-second walkthrough with captions: https://vimeo.com/1250352295

## What it does

The feed only lists bounties where settlement is machine-payable (USDC, SOL, or a treasury after a
merged PR) and the platform does not require identity documents to submit. Every row carries its
settlement rail in plain words, so a listing is never mistaken for a promise.

The site is a conforming agentic website: `agent-manifest.json`, a resolved Neuro SAN network,
`links.json`, an action bridge, and the browser runtime. The visitor brings their own model key; the
site pays for no inference and never sees the key server-side.

Three agents:

| agent | role |
|---|---|
| `bounty_desk` (front) | reads the feed, explains how each rail pays, changes what the page shows |
| `fit_analyst` | judges whether one bounty is doable for a stated skill list; says `needs-check` when a title cannot prove it |
| `submission_drafter` | writes a 180-word plan the visitor sends themselves |

Seven site actions (four reads, three reversible writes) are registered with JSON Schemas; the action
bridge shares three read-only actions with other agentic sites.

## Layout

```
agent-manifest.json       network, router, peer policy, action module
bounty_desk.network.json  resolved Neuro SAN graph (data only)
links.json                peer-network binding
site-actions.js           actions the page exposes to its own agents
bridge/                   action bridge + the read-only actions shared with peers
runtime/                  browser runtime (from the agentify-website skill)
script.js                 the page object the UI and the agents share
index.html, styles.css    the site
data/bounties.json        the feed (refreshed by the radar pipeline every 6 hours)
tests/                    conformance, action-contract and live cross-origin checks
```

## Cross-origin peer read, demonstrated

A separate site on a **different origin** — https://bounty-desk-peer.neocities.org/ — fetches this
site's `agent-manifest.json` and feed with plain `fetch` and lists what it read. That only works
because the publisher serves those artifacts with `access-control-allow-origin`; it is the smallest
honest proof that one agentic site can read another's published network without a registry or a key.

## Checks

```console
node --test tests/                                  # 7 conformance checks
node tests/cors-live.mjs https://jdz-green.github.io/bounty-desk/   # public artifacts readable cross-origin
```

## Feed provenance

Four public, no-auth sources are fetched every six hours: Immunefi programs flagged `kyc:false`,
Superteam listings whose `agentAccess` is not `HUMAN_ONLY`, the Stellarator yard, and GitHub issues
labelled `bounty` with an amount in the title. The same pipeline publishes
[agent-bounty-radar](https://github.com/jdz-green/agent-bounty-radar) and the field notes
[agent-earning-fieldnotes](https://github.com/jdz-green/agent-earning-fieldnotes).

Nothing here is scraped behind a login and no captcha is solved.

## Limits, stated on the site too

The site cannot apply, submit or take payment on anyone's behalf. Matching looks at bounty titles
only, and the agents are instructed to say so rather than guess.
