#!/usr/bin/env python3
"""Sync a TCDB collection/inventory page to JSON for local analysis or a static site.

Example:
  python3 Inventory/scripts/sync_tcdb_inventory.py \
    --inventory-url "https://www.tcdb.com/ViewCollectionMode.cfm?Member=RSmith1217&MODE=&Type=Baseball&CollectionID=1" \
    --cookie-file "Inventory/.tcdb_cookie" \
    --output "Inventory/data/tcdb_inventory.json"
"""

from __future__ import annotations

import argparse
import json
import re
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

DEFAULT_URL = (
    "https://www.tcdb.com/ViewCollectionMode.cfm?Member=RSmith1217&MODE=&Type=Baseball&CollectionID=1"
)

MONEY_RE = re.compile(r"\$\s*([0-9]+(?:\.[0-9]{1,2})?)")


@dataclass
class CardRow:
    card_url: str
    set_name: str
    card_number: str
    card_name: str
    player: str
    team: str
    quantity: int
    tcdb_price: Optional[float]
    tcdb_price_source: str


def read_cookie(cookie_file: Optional[str]) -> str:
    if not cookie_file:
        return ""
    text = Path(cookie_file).read_text(encoding="utf-8").strip()
    if not text:
        return ""

    # Accept either raw Cookie header value or a curl snippet.
    text = text.replace("Cookie:", "").strip()
    text = text.strip("'\"")
    if text.lower().startswith("cookie="):
        text = text.split("=", 1)[1].strip()
    return text


def session_with_cookie(cookie: str) -> requests.Session:
    s = requests.Session()
    s.headers.update(
        {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    if cookie:
        s.headers["Cookie"] = cookie
    return s


def fetch_with_retry(session: requests.Session, url: str, retries: int = 5) -> requests.Response:
    wait = 1.5
    for attempt in range(1, retries + 1):
        resp = session.get(url, timeout=30)
        if resp.status_code in (429, 500, 502, 503, 504):
            if attempt == retries:
                resp.raise_for_status()
            time.sleep(wait)
            wait *= 1.75
            continue
        resp.raise_for_status()
        return resp
    raise RuntimeError("unreachable")


def parse_table_rows(page_url: str, html: str) -> tuple[list[CardRow], Optional[str]]:
    soup = BeautifulSoup(html, "html.parser")

    table = None
    for t in soup.find_all("table"):
        tx = t.get_text(" ", strip=True).lower()
        if "card" in tx and ("qty" in tx or "quantity" in tx or "player" in tx):
            table = t
            break

    if table is None:
        return [], find_next_url(soup, page_url)

    cards: list[CardRow] = []
    for tr in table.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 2:
            continue

        a = tr.select_one('a[href*="/Card.cfm"], a[href*="/Cards/"], a[href*="/cards/"]')
        if not a:
            continue

        href = a.get("href", "").strip()
        if not href:
            continue

        full_url = urljoin(page_url, href)
        cols = [td.get_text(" ", strip=True) for td in tds]

        set_name = cols[0] if cols else ""
        card_number = cols[1] if len(cols) > 1 else ""
        card_name = cols[2] if len(cols) > 2 else a.get_text(" ", strip=True)
        player = cols[3] if len(cols) > 3 else ""
        team = cols[4] if len(cols) > 4 else ""

        qty = 1
        for c in reversed(cols):
            m = re.search(r"\b(\d{1,3})\b", c)
            if m:
                qty = int(m.group(1))
                break

        cards.append(
            CardRow(
                card_url=full_url,
                set_name=set_name,
                card_number=card_number,
                card_name=card_name,
                player=player,
                team=team,
                quantity=qty,
                tcdb_price=None,
                tcdb_price_source="",
            )
        )

    return cards, find_next_url(soup, page_url)


def find_next_url(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    next_link = soup.select_one('a[rel="next"], a[title*="Next" i]')
    if not next_link:
        for a in soup.find_all("a"):
            txt = a.get_text(" ", strip=True).lower()
            if txt in {"next", "next >", "next >>", ">", ">>"} or txt.startswith("next"):
                next_link = a
                break

    if not next_link:
        return None

    href = next_link.get("href", "").strip()
    if not href:
        return None
    return urljoin(base_url, href)


def parse_price(html: str) -> Optional[float]:
    prices = [float(m.group(1)) for m in MONEY_RE.finditer(html)]
    if not prices:
        return None
    return round(min(prices), 2)


def dedupe(cards: Iterable[CardRow]) -> list[CardRow]:
    seen: set[str] = set()
    out: list[CardRow] = []
    for c in cards:
        key = c.card_url
        if key in seen:
            continue
        seen.add(key)
        out.append(c)
    return out


def scrape(args: argparse.Namespace) -> dict:
    cookie = read_cookie(args.cookie_file)
    session = session_with_cookie(cookie)

    url = args.inventory_url
    page_count = 0
    rows: list[CardRow] = []

    while url and page_count < args.max_pages:
        page_count += 1
        resp = fetch_with_retry(session, url)
        cards, next_url = parse_table_rows(resp.url, resp.text)
        rows.extend(cards)
        url = next_url
        time.sleep(args.page_delay)

    rows = dedupe(rows)

    if args.price_cards:
        for i, row in enumerate(rows, start=1):
            try:
                resp = fetch_with_retry(session, row.card_url)
                row.tcdb_price = parse_price(resp.text)
                row.tcdb_price_source = "tcdb-page" if row.tcdb_price is not None else "not-found"
            except Exception:
                row.tcdb_price = None
                row.tcdb_price_source = "fetch-error"
            if args.max_cards and i >= args.max_cards:
                break
            time.sleep(args.card_delay)

    priced = sum(1 for r in rows if r.tcdb_price is not None)
    payload = {
        "source": {"inventory_url": args.inventory_url, "site": "tcdb.com"},
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "totals": {
            "cards": len(rows),
            "units": sum(r.quantity for r in rows),
            "priced_cards": priced,
        },
        "cards": [asdict(r) for r in rows],
    }
    return payload


def main() -> None:
    p = argparse.ArgumentParser(description="Sync TCDB inventory page to JSON")
    p.add_argument("--inventory-url", default=DEFAULT_URL)
    p.add_argument("--cookie-file", default="")
    p.add_argument("--output", default="Inventory/data/tcdb_inventory.json")
    p.add_argument("--max-pages", type=int, default=50)
    p.add_argument("--price-cards", action="store_true")
    p.add_argument("--max-cards", type=int, default=0, help="Limit priced card pages (0 = all)")
    p.add_argument("--page-delay", type=float, default=0.35)
    p.add_argument("--card-delay", type=float, default=0.45)
    args = p.parse_args()

    payload = scrape(args)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {payload['totals']['cards']} cards to {out}")


if __name__ == "__main__":
    main()
