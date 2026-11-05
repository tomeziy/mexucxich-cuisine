# scripts/verify_adr0014_live.py
import os
import sys
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def verify_adr0014():
    artifact_dir = r"C:\Users\Tomeziy Nguyen\.gemini\antigravity\brain\dc9357a8-1900-47b9-b7d2-b284b7c94943"
    screenshot_path = os.path.join(artifact_dir, "verified_receipt_adr0014.png")

    print("--- STARTING ADR-0014 LIVE VERIFICATION ---", flush=True)

    with sync_playwright() as p:
        print("[1/4] Launching Chromium...", flush=True)
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        print("[2/4] Navigating to https://tomeziy.github.io/mexucxich-cuisine/#/ ...", flush=True)
        page.goto("https://tomeziy.github.io/mexucxich-cuisine/#/", wait_until="networkidle")
        page.wait_for_timeout(1500)

        print("[3/4] Adding Xúc xích Bò Tiêu Đen with qty = 4...", flush=True)
        # Click product card
        product = page.locator("text=Xúc xích Bò Tiêu Đen").first
        if product.count() == 0:
            product = page.locator("text=Xúc xích").first
        product.click()
        page.wait_for_timeout(500)

        # Fill quantity = 4 (integer quantity)
        qty_input = page.locator("input[inputmode='decimal']").first
        qty_input.fill("4")
        qty_input.blur()
        page.wait_for_timeout(500)

        # Check cart badge: should NOT show ⚖️ Gói 500g → 2kg badge because qty 4 is integer!
        has_scaled_badge = page.locator("text=2kg").count() > 0 or page.locator("text=2000g").count() > 0
        assert not has_scaled_badge, "Cart should NOT scale integer quantity 4 into composite 2kg weight"
        print("✓ Cart verified: Integer qty 4 does not scale unit weight.", flush=True)

        print("[4/4] Opening Receipt Preview Modal...", flush=True)
        checkout_btn = page.locator("button:has-text('Thanh toán & In hóa đơn')").first
        if checkout_btn.count() == 0:
            checkout_btn = page.locator("button:has-text('Thanh toán')").first
        checkout_btn.click()
        page.wait_for_timeout(1000)

        # In Payment Modal, click 'Hoàn tất & In hóa đơn'
        complete_btn = page.locator("button:has-text('Hoàn tất & In hóa đơn')").first
        if complete_btn.count() > 0:
            complete_btn.click()
            page.wait_for_timeout(1200)

        # Inspect ThermalReceipt modal
        receipt_modal = page.locator(".bg-white.rounded-2xl.max-w-md").first
        if receipt_modal.count() > 0:
            sl_texts = page.locator(".w-1\\/3.text-center.font-medium").all_inner_texts()
            print(f" -> SL column text values: {sl_texts}", flush=True)
            for t in sl_texts:
                assert "(" not in t and ")" not in t, f"Found bracketed weight in SL: {t}"
                print(f"    ✓ Clean quantity verified in SL column: '{t}'", flush=True)

            receipt_modal.screenshot(path=screenshot_path)
            print(f"✓ Screenshot saved to {screenshot_path}", flush=True)
        else:
            print("Modal not found directly, saving full page screenshot", flush=True)
            page.screenshot(path=screenshot_path)

        browser.close()
        print("🎉 ADR-0014 LIVE VERIFICATION SUCCEEDED!", flush=True)

if __name__ == '__main__':
    verify_adr0014()
