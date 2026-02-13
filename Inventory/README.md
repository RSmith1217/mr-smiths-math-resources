# TCDB Inventory Scraper (Standalone)

This folder is separate from your class website and is focused only on exporting your TCDB collection to JSON.

## Default Collection URL

The scripts are preconfigured to use:

`https://www.tcdb.com/ViewCollectionMode.cfm?Member=RSmith1217&MODE=&Type=Baseball&CollectionID=1`

## Files

- `Inventory/scripts/sync_tcdb_inventory.py`  
  Python scraper (best when direct requests work).
- `Inventory/scripts/tcdb_browser_scrape.js`  
  Browser-console fallback (best when TCDB blocks scripted requests).
- `Inventory/data/tcdb_inventory.json`  
  Output JSON file (generated).

## Option A: Python scraper

1. Install deps once:

```bash
python3 -m pip install requests beautifulsoup4
```

2. Optional cookie file (if TCDB needs auth):

- Create `Inventory/.tcdb_cookie`
- Put your full cookie string in it (no `Cookie:` prefix required).

3. Run:

```bash
python3 Inventory/scripts/sync_tcdb_inventory.py \
  --inventory-url "https://www.tcdb.com/ViewCollectionMode.cfm?Member=RSmith1217&MODE=&Type=Baseball&CollectionID=1" \
  --cookie-file "Inventory/.tcdb_cookie" \
  --output "Inventory/data/tcdb_inventory.json"
```

Optional pricing pass:

```bash
python3 Inventory/scripts/sync_tcdb_inventory.py \
  --cookie-file "Inventory/.tcdb_cookie" \
  --price-cards --max-cards 20
```

## Option B: Browser-console fallback

Use this when Python gets `403`/blocking.

1. Open your collection page in Chrome while logged in.
2. Open DevTools Console.
3. Paste and run `Inventory/scripts/tcdb_browser_scrape.js`.
4. A download named `tcdb_inventory.json` will be generated.
5. Move that file to `Inventory/data/tcdb_inventory.json`.

## Notes

- Respect TCDB terms and avoid aggressive scrape rates.
- If TCDB page markup changes, selectors may need adjustments.
