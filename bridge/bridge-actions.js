// The actions this site shares with other agent sites, through its action bridge.
// bridge/agent-manifest.json loads this module in the bridge frame, which has no visible
// page. Every shared action here is a read of the public feed.
import { App } from "../script.js";

/** Reads another agentic site may run against this one. All public, so callers are "*". */
class BridgeActions {
  static registerActions(actions) {
    actions.register(BridgeActions.getFeedAction());
    actions.register(BridgeActions.getBountyAction());
    actions.register(BridgeActions.matchAction());
  }

  static getFeedAction() {
    return {
      name: "get_feed",
      description:
        "Read the live bounty feed another site publishes: every bounty's title, reward as written, source, whether agents may submit, its settlement rail and its listing URL. Changes nothing.",
      effect: "read",
      availability: "bridge",
      callerOrigins: "*",
      inputSchema: {
        type: "object",
        properties: { source: { type: "string", enum: ["all", "immunefi", "superteam", "stellarator", "github"] } },
        additionalProperties: false,
      },
      execute: ({ source = "all" } = {}) => ({
        generated_at: App.page.feed.generated_at,
        rows: App.page.all
          .filter((b) => source === "all" || b.source === source)
          .map((b) => ({
            key: b.key,
            title: b.title,
            reward: b.reward,
            source: b.source,
            agent_allowed: b.agent_ok === true,
            url: b.url,
          })),
      }),
    };
  }

  static getBountyAction() {
    return {
      name: "get_bounty",
      description: "Read one bounty by key from another site's feed: title, reward, source, settlement rail and listing URL. Changes nothing.",
      effect: "read",
      availability: "bridge",
      callerOrigins: "*",
      inputSchema: {
        type: "object",
        properties: { key: { type: "string" } },
        required: ["key"],
        additionalProperties: false,
      },
      execute: ({ key } = {}) => {
        const b = App.page.all.find((x) => x.key === key);
        return b
          ? { ok: true, key: b.key, title: b.title, reward: b.reward, source: b.source, agent_allowed: b.agent_ok === true, url: b.url }
          : { ok: false, reason: "not-in-feed", key };
      },
    };
  }

  static matchAction() {
    return {
      name: "match_bounties",
      description: "Rank another site's bounty feed against a capability list and return the matched words. Changes nothing.",
      effect: "read",
      availability: "bridge",
      callerOrigins: "*",
      inputSchema: {
        type: "object",
        properties: { capabilities: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 12 } },
        required: ["capabilities"],
        additionalProperties: false,
      },
      execute: ({ capabilities } = {}) => ({
        rows: App.page.match(capabilities || []).slice(0, 12).map((b) => ({
          key: b.key, title: b.title, reward: b.reward, source: b.source, matched: b.matched, url: b.url,
        })),
      }),
    };
  }
}

export const registerActions = BridgeActions.registerActions;
