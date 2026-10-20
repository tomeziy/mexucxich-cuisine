# Feature: Customers Page Pagination

## Sub-features
- KiotViet style bottom pagination bar.
- Rows per page dropdown (20, 50, 100).
- Dynamic slice calculations with boundary protection.
- Search input auto-resetting `currentPage` to 1.
- Previous/Next and first/last page jump buttons.

## How to get to it (user POV)
1. Open Customers page (`/#/customers`).
2. Observe bottom bar showing `Hiển thị X - Y trên tổng số Z khách`.
3. Select 50 khách/trang or 100 khách/trang.

## Driving it with Playwright
```python
page.goto("https://tomeziy.github.io/mexucxich-cuisine/#/customers")
page.locator("select:has-text('khách/trang')").select_option("50")
page.locator("button:has-text('Sau')").click()
```

## Gotchas
- When filtering by query or debt, `currentPage` must immediately reset to 1 to avoid blank page states.
