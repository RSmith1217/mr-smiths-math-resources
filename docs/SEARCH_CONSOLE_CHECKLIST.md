# Google Search Console Checklist

Use this checklist after SEO changes to keep indexing healthy for `https://dydxmath.com/`.

## 1) Verify Property
- Open Google Search Console.
- Add property: `https://dydxmath.com/` (URL-prefix property).
- Use the recommended verification method and confirm ownership.

## 2) Submit Sitemap
- Go to **Indexing -> Sitemaps**.
- Submit: `https://dydxmath.com/sitemap.xml`.
- Confirm status is **Success**.

## 3) Request Indexing for Key Pages
- Use **URL Inspection** for:
  - `https://dydxmath.com/`
  - `https://dydxmath.com/algebra-ii-advanced.html`
  - `https://dydxmath.com/precalculus-i-cp.html`
  - `https://dydxmath.com/calculus-honors.html`
- Click **Request Indexing** if page is not indexed or changed recently.

## 4) Validate SEO Signals
- Confirm each page reports:
  - Canonical URL set to its own final URL.
  - Crawl allowed (not blocked by `robots.txt`).
  - Mobile-friendly rendering.

## 5) Check Coverage Weekly
- Review **Indexing -> Pages** for:
  - `Crawled - currently not indexed`
  - `Duplicate without user-selected canonical`
  - `Blocked by robots.txt`
- Investigate any new spikes.

## 6) Monitor Search Performance Monthly
- Open **Performance -> Search results**.
- Track:
  - Top queries leading to course pages.
  - CTR changes by page.
  - Pages with impressions but low clicks (candidates for title/description tweaks).

## 7) Re-run After Major Updates
- After major content updates:
  - Re-submit sitemap.
  - Inspect and request indexing for edited pages.
  - Check link-check workflow status in GitHub Actions.
