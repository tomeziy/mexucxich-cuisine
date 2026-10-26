import os
from playwright.sync_api import sync_playwright

output_dir = r"C:\Users\Tomeziy Nguyen\.gemini\antigravity\brain\dc9357a8-1900-47b9-b7d2-b284b7c94943"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 850})
    page.goto("https://tomeziy.github.io/mexucxich-cuisine/#/", wait_until="networkidle")
    page.wait_for_timeout(1000)

    # 1. Click Xúc xích Bò Tiêu Đen
    page.locator("text=Xúc xích Bò Tiêu Đen").first.click()
    page.wait_for_timeout(600)

    # 2. Set qty to 0.5
    qty_input = page.locator("input[inputmode='decimal']").first
    qty_input.fill("0.5")
    qty_input.blur()
    page.wait_for_timeout(600)
    page.screenshot(path=os.path.join(output_dir, "cart_05_scaled_250g.png"))

    # 3. Set qty to 0.56
    qty_input.fill("0.56")
    qty_input.blur()
    page.wait_for_timeout(600)
    page.screenshot(path=os.path.join(output_dir, "cart_056_scaled_280g.png"))

    # 4. Open Receipt Preview
    checkout_btn = page.locator("button:has-text('Thanh toán & In hóa đơn')").first
    if checkout_btn.count() > 0:
        checkout_btn.click()
        page.wait_for_timeout(1000)
        page.screenshot(path=os.path.join(output_dir, "receipt_modal_preview_fixed.png"))

    browser.close()
    print("ALL EVIDENCE SCREENSHOTS SAVED SUCCESSFULLY!")
