# Bounty Desk — Open Agentic Web Challenge submission plan

Deadline: 2027-01-11. Prize: $5k / $3k / $2k. Judges: Cognizant CAIO, MIT Media Lab, Mozilla.

## The idea

An agentic website that is the **job board for the agentic web**: live, machine-readable bounties
that an agent (or its human) can actually claim, plus a small agent network that triages a bounty
against a caller's capabilities and drafts a submission plan.

Differentiator vs the ~26 contributed sites: the others are tools *about* sites (trust, recall,
policy, calendars). This one answers "what can I be paid for today, and can I actually do it?" —
and it is *callable by peers*, so other agentic sites (e.g. a contest desk, a résumé agent, a
procurement agent) can ask it for work matching a capability list.

## Live data

`data/bounties.json` is refreshed every 6h by GitHub Actions from four public, no-auth sources
(Immunefi `kyc:false`, Superteam `AGENT_ALLOWED`, Stellarator yard, GitHub `bounty` issues).
Same pipeline as the published `agent-bounty-radar` feed, so the site is a real service, not a demo.

## Conformance (MVP Profile 0.3)

- `agent-manifest.json` — network name, front man, hocon/network path, router (Otari + BYOK), peer policy, theme, linking
- `bounty_desk.network.json` — resolved Neuro SAN network (JSON)
- `links.json` — peer-network bindings
- `runtime/` — the skill's runtime, unchanged
- `bridge/bridge-actions.js` — read-only actions shared with peers (get feed, get bounty, match capabilities)
- `.well-known/nsdeploy/` — discovery metadata
- BYOK panel (visitor supplies router + key), default Otari router

## Agents

| agent | role | tools |
|---|---|---|
| `bounty_desk` (front) | answers about the feed, ranks by fit, explains amounts/deadlines/provenance | `website_get_feed`, `website_get_bounty`, `website_match_bounties`, `website_get_stats` |
| `fit_analyst` | given a capability list and a bounty, decides doable / not / needs-check, with reasons grounded in the bounty text | delegated, same tools |
| `submission_drafter` | drafts a short application or PR plan for the chosen bounty | no site tools; text-only |

Rules: facts only from tool results; never invent amounts/deadlines; say "not in the feed" when
absent; a listed bounty is not a guarantee of payment (surface the settlement rail).

## Peer demo

The site calls one contributed peer that publishes a network (e.g. Deadline Desk) after a consent
card, to show composition: "this bounty closes in 9 days; add it to your contest planner".

## Build steps

1. `script.js`: fetch `data/bounties.json`, render table + detail panel + capability chips, expose `App.page` methods
2. `site-actions.js`: 4 reads (+1 write: shortlist add/remove)
3. `index.html` + `styles.css`
4. `bounty_desk.hocon` → `bounty_desk.network.json`
5. `agent-manifest.json`, `links.json`, `.well-known/`
6. `tests/`: adapt the example's node tests (actions schema, bridge, network validity)
7. Deploy to GitHub Pages under jdz-green, verify CORS + peer call
8. Devpost: register, submit URL + screenshots

## Status

- [x] scaffold from `marrow_point_pizza_agentified`
- [ ] script.js + actions
- [ ] page + styles
- [ ] network JSON
- [ ] manifest/links/well-known
- [ ] tests green
- [ ] deploy + submit
