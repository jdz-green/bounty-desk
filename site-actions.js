// Registers Bounty Desk's operations with the agent runtime.
// agent-manifest.json loads this module through "actions.module". Only the names in
// "actions.agentTools" become model tools, called website_<name>.
//
// Each action wraps a method on App.page, the page object script.js exports, so the
// assistant and the page's own buttons share one set of rules.
import { App } from "./script.js";

class SiteActions {
  /** Register every site action with the runtime. */
  static registerActions(actions) {
    actions.register(SiteActions.getFeedAction());
    actions.register(SiteActions.getBountyAction());
    actions.register(SiteActions.matchBountiesAction());
    actions.register(SiteActions.getStatsAction());
    actions.register(SiteActions.setFiltersAction());
    actions.register(SiteActions.selectBountyAction());
    actions.register(SiteActions.shortlistAction());
  }

  /** Read: the visible feed rows, with reward, source, settlement note and link. */
  static getFeedAction() {
    return {
      name: "get_feed",
      description:
        "Read the live bounty feed: every bounty currently listed, its reward as written, its source, whether the platform allows agent submissions, and a settlement note saying what must happen before money moves. Call this before answering any question about what is available.",
      effect: "read",
      inputSchema: {
        type: "object",
        properties: {
          source: { type: "string", enum: ["all", "immunefi", "superteam", "stellarator", "github"], description: "Restrict to one source, or all." },
          limit: { type: "integer", minimum: 1, maximum: 60, description: "Maximum rows to return, easiest first." },
        },
        additionalProperties: false,
      },
      execute: SiteActions.getFeed,
    };
  }

  static getFeed({ source = "all", limit = 20 } = {}) {
    const rows = App.page.all
      .filter((b) => source === "all" || b.source === source)
      .slice(0, limit)
      .map((b) => ({
        key: b.key,
        title: b.title,
        reward: b.reward,
        source: b.source,
        agent_allowed: b.agent_ok === true,
        settlement: SiteActions.settlement(b.source),
        url: b.url,
      }));
    return { generated_at: App.page.feed.generated_at, count: rows.length, rows };
  }

  /** Read: one bounty by key, with its settlement rail and shortlist state. */
  static getBountyAction() {
    return {
      name: "get_bounty",
      description:
        "Read one bounty by its key (from get_feed): title, reward as written, source, settlement note, listing URL, and whether it is on the visitor's shortlist. Use it before explaining or drafting anything about a specific bounty.",
      effect: "read",
      inputSchema: {
        type: "object",
        properties: { key: { type: "string", description: "The bounty key from get_feed, e.g. immunefi:metric." } },
        required: ["key"],
        additionalProperties: false,
      },
      execute: SiteActions.getBounty,
    };
  }

  static getBounty({ key } = {}) {
    const b = App.page.all.find((x) => x.key === key);
    if (!b) return { ok: false, reason: "not-in-feed", key };
    return {
      ok: true,
      key: b.key,
      title: b.title,
      reward: b.reward,
      source: b.source,
      agent_allowed: b.agent_ok === true,
      settlement: SiteActions.settlement(b.source),
      url: b.url,
      shortlisted: App.page.shortlist.has(b.key),
    };
  }

  /** Read: rank the feed against a list of capabilities the caller has. */
  static matchBountiesAction() {
    return {
      name: "match_bounties",
      description:
        "Rank the live feed against the caller's capabilities (for example [\"solidity\", \"foundry\", \"python\"]). Returns each matching bounty with the exact capability words that matched, so the answer can quote them. Matching only looks at the bounty title, source and reward text; say so when the fit is uncertain.",
      effect: "read",
      inputSchema: {
        type: "object",
        properties: {
          capabilities: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 12, description: "Skill words to match, lower case is fine." },
        },
        required: ["capabilities"],
        additionalProperties: false,
      },
      execute: SiteActions.matchBounties,
    };
  }

  static matchBounties({ capabilities } = {}) {
    const rows = App.page.match(capabilities || []).slice(0, 12).map((b) => ({
      key: b.key,
      title: b.title,
      reward: b.reward,
      source: b.source,
      matched: b.matched,
      score: b.score,
      url: b.url,
    }));
    return { queried: capabilities, count: rows.length, rows, caveat: "Fit is inferred from title words only, not from the full task description." };
  }

  /** Read: feed statistics and freshness. */
  static getStatsAction() {
    return {
      name: "get_stats",
      description: "Read how many bounties the feed holds, how they split by source, when it was last refreshed, and what the visitor has shortlisted.",
      effect: "read",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: () => App.page.stats,
    };
  }

  /** Write (reversible): change the page's visible filters. */
  static setFiltersAction() {
    return {
      name: "set_filters",
      description: "Change the table's filters so the visitor sees what you are describing: a source, a free-text query, or agent-allowed only. Reversible; say what you changed.",
      effect: "write",
      inputSchema: {
        type: "object",
        properties: {
          source: { type: "string", enum: ["all", "immunefi", "superteam", "stellarator", "github"] },
          query: { type: "string" },
          agentOnly: { type: "boolean" },
        },
        additionalProperties: false,
      },
      execute: (args = {}) => App.page.setFilters(args),
    };
  }

  /** Write (reversible): open one bounty's detail panel. */
  static selectBountyAction() {
    return {
      name: "select_bounty",
      description: "Open one bounty's detail panel on the page, so the visitor sees the same record you are talking about. Reversible.",
      effect: "write",
      inputSchema: {
        type: "object",
        properties: { key: { type: "string" } },
        required: ["key"],
        additionalProperties: false,
      },
      execute: ({ key } = {}) => {
        const b = App.page.select(key);
        return b ? { ok: true, key } : { ok: false, reason: "not-in-feed", key };
      },
    };
  }

  /** Write (reversible): add or remove one bounty on the visitor's shortlist. */
  static shortlistAction() {
    return {
      name: "set_shortlist",
      description: "Add or remove one bounty from the visitor's shortlist. Reversible: say what changed and how to undo it.",
      effect: "write",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string" },
          add: { type: "boolean", description: "true to add, false to remove." },
        },
        required: ["key", "add"],
        additionalProperties: false,
      },
      execute: ({ key, add } = {}) => (add ? App.page.addToShortlist(key) : App.page.removeFromShortlist(key)),
    };
  }

  /** The settlement note, kept in one place. */
  static settlement(source) {
    return {
      immunefi: "USDC on Ethereum. No KYC on this program, but a valid finding is required and triage takes weeks.",
      superteam: "USDC on Solana. Listing is open to agents; the sponsor judges submissions.",
      stellarator: "SOL from a Solana escrow. Winner-take-all contest, settled after the 72h window.",
      github: "Depends on the issue: usually a maintainer or a treasury pays after a merged PR.",
    }[source] || "Settlement terms are set by the poster.";
  }
}

export { SiteActions };
export const registerActions = SiteActions.registerActions;
