// Bounty Desk — the page's data and state.
//
// The page, its buttons and the agent runtime all share one page object, `App.page`.
// The agent calls the same methods through site-actions.js, so the assistant and a
// human clicking around see and change exactly the same state.

const FEED_URL = "./data/bounties.json";
const SHORTLIST_KEY = "bounty-desk.shortlist.v1";

/** Human-readable settlement note per source: what has to be true before money moves. */
const SETTLEMENT = {
  immunefi: "USDC on Ethereum. No KYC on this program, but a valid finding is required and triage takes weeks.",
  superteam: "USDC on Solana. Listing is open to agents; the sponsor judges submissions.",
  stellarator: "SOL from a Solana escrow. Winner-take-all contest, settled after the 72h window.",
  github: "Depends on the issue: usually a maintainer or a treasury pays after a merged PR.",
};

const SOURCE_LABEL = {
  immunefi: "Immunefi",
  superteam: "Superteam",
  stellarator: "Stellarator",
  github: "GitHub",
};

/** Parse a reward string into a comparable number (USD-ish), for sorting only. */
function rewardValue(reward) {
  const text = String(reward || "");
  const nums = [...text.matchAll(/([\d,]+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1].replace(/,/g, "")));
  if (!nums.length) return 0;
  const max = Math.max(...nums);
  if (/SOL/i.test(text)) return max * 70; // rough, for ordering only; never shown as USD
  return max;
}

export class App {
  /** The app's single page object, created once script.js loads. */
  static page = null;

  constructor() {
    this.feed = { generated_at: null, stats: {}, bounties: [] };
    this.filters = { source: "all", agentOnly: false, query: "" };
    this.selectedId = null;
    this.capabilities = [];
    this.shortlist = new Set(this.#loadShortlist());
    this.error = null;
  }

  async start() {
    try {
      const response = await fetch(FEED_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error(`feed HTTP ${response.status}`);
      this.feed = await response.json();
    } catch (error) {
      this.error = `Could not load the feed: ${error.message}`;
    }
    this.render();
  }

  /* ---------- derived data (pure) ---------- */

  /** All bounties, normalised with a stable id and a numeric sort key. */
  get all() {
    return (this.feed.bounties || []).map((b, index) => ({
      ...b,
      id: b.id || `b${index}`,
      key: `${b.source}:${b.id || index}`,
      value: rewardValue(b.reward),
    }));
  }

  /** Bounties after the current filters, easiest-first like the published feed. */
  get visible() {
    const q = this.filters.query.trim().toLowerCase();
    return this.all.filter((b) => {
      if (this.filters.source !== "all" && b.source !== this.filters.source) return false;
      if (this.filters.agentOnly && b.agent_ok !== true) return false;
      if (q && !`${b.title} ${b.reward} ${b.source}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  get selected() {
    if (!this.selectedId) return null;
    return this.all.find((b) => b.key === this.selectedId) || null;
  }

  get stats() {
    const counts = {};
    for (const b of this.all) counts[b.source] = (counts[b.source] || 0) + 1;
    return {
      generated_at: this.feed.generated_at,
      total: this.all.length,
      by_source: counts,
      shortlisted: this.shortlist.size,
      capabilities: this.capabilities,
    };
  }

  /**
   * Rank bounties by how many capability words appear in the bounty title.
   * Deliberately simple and explainable: the score is the number of matched words,
   * and the matched words are returned so the model can quote them.
   */
  match(capabilities = this.capabilities) {
    const words = capabilities.map((c) => String(c).toLowerCase().trim()).filter(Boolean);
    if (!words.length) return [];
    return this.all
      .map((b) => {
        const hay = `${b.title} ${b.source} ${b.reward}`.toLowerCase();
        const matched = words.filter((w) => hay.includes(w));
        return { ...b, matched, score: matched.length };
      })
      .filter((b) => b.score > 0)
      .sort((a, b) => b.score - a.score || b.value - a.value);
  }

  /* ---------- state changes (used by buttons and by the agent) ---------- */

  setFilters(patch = {}) {
    this.filters = { ...this.filters, ...patch };
    this.render();
    return this.filters;
  }

  setCapabilities(list) {
    this.capabilities = (Array.isArray(list) ? list : String(list).split(","))
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 12);
    this.render();
    return this.capabilities;
  }

  select(key) {
    this.selectedId = this.all.some((b) => b.key === key) ? key : null;
    this.render();
    return this.selected;
  }

  addToShortlist(key) {
    if (!this.all.some((b) => b.key === key)) return { ok: false, reason: "unknown bounty" };
    this.shortlist.add(key);
    this.#saveShortlist();
    this.render();
    return { ok: true, shortlist: [...this.shortlist] };
  }

  removeFromShortlist(key) {
    const removed = this.shortlist.delete(key);
    this.#saveShortlist();
    this.render();
    return { ok: removed, shortlist: [...this.shortlist] };
  }

  /* ---------- rendering ---------- */

  render() {
    const root = document.querySelector("#desk");
    if (!root) return;
    const visible = this.visible;
    const stats = this.stats;

    const status = document.querySelector("#desk-status");
    if (status) {
      status.textContent = this.error
        ? this.error
        : `${stats.total} bounties, updated ${stats.generated_at || "unknown"}`;
    }

    const list = document.querySelector("#bounty-rows");
    if (list) {
      list.innerHTML = visible
        .map((b) => {
          const active = b.key === this.selectedId ? " class=\"selected\"" : "";
          const short = this.shortlist.has(b.key) ? " ★" : "";
          return `<tr${active}><td><button class="link" data-select="${b.key}">${escapeHtml(b.title)}${short}</button></td>` +
            `<td>${escapeHtml(b.reward)}</td><td>${SOURCE_LABEL[b.source] || b.source}</td></tr>`;
        })
        .join("") || `<tr><td colspan="3">No bounty matches these filters.</td></tr>`;
    }

    const counts = document.querySelector("#source-counts");
    if (counts) {
      counts.innerHTML = Object.entries(stats.by_source)
        .map(([src, n]) => `<span class="chip">${SOURCE_LABEL[src] || src} ${n}</span>`)
        .join("");
    }

    const detail = document.querySelector("#bounty-detail");
    if (detail) {
      const b = this.selected;
      detail.innerHTML = b
        ? `<h3>${escapeHtml(b.title)}</h3>
           <p class="reward">${escapeHtml(b.reward)}</p>
           <p><a href="${escapeAttr(b.url)}" target="_blank" rel="noopener">Open the listing</a></p>
           <p class="settle">${escapeHtml(SETTLEMENT[b.source] || "Settlement terms are set by the poster.")}</p>
           <p class="meta">Source: ${escapeHtml(SOURCE_LABEL[b.source] || b.source)} · agent-allowed: ${b.agent_ok === true ? "yes" : "not stated"}</p>
           <button data-shortlist="${b.key}">${this.shortlist.has(b.key) ? "Remove from shortlist" : "Add to shortlist"}</button>`
        : `<p>Select a bounty to see its settlement rail and what it asks for.</p>`;
    }

    const cap = document.querySelector("#capabilities");
    if (cap && cap.value !== this.capabilities.join(", ")) cap.value = this.capabilities.join(", ");
  }

  /* ---------- persistence ---------- */

  #loadShortlist() {
    try {
      return JSON.parse(localStorage.getItem(SHORTLIST_KEY) || "[]");
    } catch {
      return [];
    }
  }

  #saveShortlist() {
    try {
      localStorage.setItem(SHORTLIST_KEY, JSON.stringify([...this.shortlist]));
    } catch {
      /* private mode: keep it in memory only */
    }
  }
}

/** Escape text for HTML text nodes and attributes. */
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function escapeAttr(value) {
  const url = String(value ?? "");
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : "#";
}

App.page = new App();

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
  App.page.start().then(() => {
    document.querySelectorAll("[data-select]").forEach((el) => {
      el.addEventListener("click", () => App.page.select(el.dataset.select));
    });
    document.querySelector("#desk")?.addEventListener("click", (event) => {
      const sel = event.target.closest("[data-select]");
      if (sel) App.page.select(sel.dataset.select);
      const short = event.target.closest("[data-shortlist]");
      if (short) {
        const key = short.dataset.shortlist;
        if (App.page.shortlist.has(key)) App.page.removeFromShortlist(key);
        else App.page.addToShortlist(key);
      }
    });
    document.querySelector("#filters")?.addEventListener("change", (event) => {
      const f = event.target;
      if (f.name === "source") App.page.setFilters({ source: f.value });
      if (f.name === "agentOnly") App.page.setFilters({ agentOnly: f.checked });
      if (f.name === "query") App.page.setFilters({ query: f.value });
    });
    document.querySelector("#search")?.addEventListener("input", (event) => {
      App.page.setFilters({ query: event.target.value });
    });
    document.querySelector("#capability-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      App.page.setCapabilities(document.querySelector("#capabilities").value);
    });
  });
});
}
