/*
Run this in browser DevTools Console while logged into TCDB at your collection page.
It crawls pages and downloads tcdb_inventory.json.
*/

(async () => {
  const START_URL =
    "https://www.tcdb.com/ViewCollectionMode.cfm?Member=RSmith1217&MODE=&Type=Baseball&CollectionID=1";
  const PAGE_DELAY_MS = 350;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function toAbs(base, href) {
    try {
      return new URL(href, base).toString();
    } catch {
      return "";
    }
  }

  function findBestTable(doc) {
    const tables = [...doc.querySelectorAll("table")];
    let best = null;
    let score = -Infinity;
    for (const t of tables) {
      const text = (t.textContent || "").toLowerCase();
      let s = 0;
      if (text.includes("card")) s += 3;
      if (text.includes("player")) s += 2;
      if (text.includes("qty") || text.includes("quantity")) s += 2;
      if (t.querySelector('a[href*="/Card.cfm"], a[href*="/Cards/"], a[href*="/cards/"]')) s += 5;
      if (s > score) {
        score = s;
        best = t;
      }
    }
    return best;
  }

  function parsePage(pageUrl, html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const table = findBestTable(doc);
    const cards = [];

    if (table) {
      for (const tr of table.querySelectorAll("tr")) {
        const tds = [...tr.querySelectorAll("td")];
        if (tds.length < 2) continue;

        const link = tr.querySelector('a[href*="/Card.cfm"], a[href*="/Cards/"], a[href*="/cards/"]');
        if (!link) continue;

        const cols = tds.map((td) => (td.textContent || "").replace(/\s+/g, " ").trim());
        const href = toAbs(pageUrl, link.getAttribute("href") || "");
        if (!href) continue;

        let quantity = 1;
        for (let i = cols.length - 1; i >= 0; i -= 1) {
          const m = cols[i].match(/\b(\d{1,3})\b/);
          if (m) {
            quantity = Number(m[1]);
            break;
          }
        }

        cards.push({
          card_url: href,
          set_name: cols[0] || "",
          card_number: cols[1] || "",
          card_name: cols[2] || (link.textContent || "").trim(),
          player: cols[3] || "",
          team: cols[4] || "",
          quantity,
          tcdb_price: null,
          tcdb_price_source: "",
        });
      }
    }

    let nextUrl = null;
    for (const a of doc.querySelectorAll("a[href]")) {
      const text = (a.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (text === "next" || text.startsWith("next") || text === ">" || text === ">>") {
        nextUrl = toAbs(pageUrl, a.getAttribute("href"));
        break;
      }
    }

    return { cards, nextUrl };
  }

  async function fetchText(url, attempt = 1) {
    const res = await fetch(url, { credentials: "include" });
    if (res.status === 429 && attempt < 6) {
      const wait = 1000 * attempt;
      console.warn(`[TCDB] 429, retrying in ${wait}ms: ${url}`);
      await sleep(wait);
      return fetchText(url, attempt + 1);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} at ${url}`);
    return res.text();
  }

  const all = [];
  const seen = new Set();
  let current = START_URL;
  let pages = 0;

  while (current && pages < 80) {
    pages += 1;
    console.log(`[TCDB] Page ${pages}: ${current}`);
    const html = await fetchText(current);
    const parsed = parsePage(current, html);

    for (const c of parsed.cards) {
      if (!seen.has(c.card_url)) {
        seen.add(c.card_url);
        all.push(c);
      }
    }

    current = parsed.nextUrl;
    if (current) await sleep(PAGE_DELAY_MS);
  }

  const payload = {
    source: { inventory_url: START_URL, site: "tcdb.com" },
    generated_at: new Date().toISOString(),
    totals: {
      cards: all.length,
      units: all.reduce((s, c) => s + (Number(c.quantity) || 0), 0),
      priced_cards: 0,
    },
    cards: all,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tcdb_inventory.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  console.log(`[TCDB] Done. Downloaded tcdb_inventory.json with ${all.length} cards.`);
})();
