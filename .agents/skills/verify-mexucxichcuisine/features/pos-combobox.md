# Feature: POS Customer Combobox

## Sub-features
- Auto-focused input upon combobox trigger.
- Multi-token and word-boundary ranking (word "Yến" strictly prioritizes above "Nguyễn").
- Keyboard arrow up/down navigation with scroll into view.
- Mouse hover isolation (`isKeyboardNavRef`) preventing erratic jumping on mouse drag.
- Instant selection via `onMouseDown` preventing premature blur loss.

## How to get to it (user POV)
1. Open POS page (`/#/`).
2. Click customer selector button next to "Thêm nhanh".
3. Type search keyword into the text field.

## Driving it with Playwright
```python
page.goto("https://tomeziy.github.io/mexucxich-cuisine/#/")
page.locator('button:has(.lucide-chevron-down), button:has(.lucide-search)').first.click()
search_input = page.locator('input[placeholder*="Gõ tên, SĐT"]')
search_input.fill("Yến")
first_item = page.locator('.divide-y button').first
first_item.click()
```

## Gotchas
- Must use `onMouseDown` rather than `onClick` to avoid blur closing popover before selection completes.
- Must ensure debt bonus does not supersede textual prefix match score.
