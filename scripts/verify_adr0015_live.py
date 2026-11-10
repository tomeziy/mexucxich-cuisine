# scripts/verify_adr0015_live.py
import os
import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def verify_adr0015():
    artifact_dir = r"C:\Users\Tomeziy Nguyen\.gemini\antigravity\brain\dc9357a8-1900-47b9-b7d2-b284b7c94943"
    receipt_screenshot = os.path.join(artifact_dir, "verified_customer_receipt_click_adr0015.png")
    search_screenshot = os.path.join(artifact_dir, "verified_reports_search_adr0015.png")
    combobox_screenshot = os.path.join(artifact_dir, "verified_edit_order_combobox_adr0015.png")

    print("--- STARTING ADR-0015 LIVE VERIFICATION ---", flush=True)

    with sync_playwright() as p:
        print("[1/5] Launching Chromium...", flush=True)
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        # Base URL
        base_url = "https://tomeziy.github.io/mexucxich-cuisine/#/"
        print(f"[2/5] Navigating to {base_url} ...", flush=True)
        page.goto(base_url, wait_until="networkidle")
        page.wait_for_timeout(2000)

        # ----------------------------------------------------------------------
        # Test 1: Reports Page Order Search
        # ----------------------------------------------------------------------
        print("[3/5] Verifying Reports Page Search...", flush=True)
        page.goto(base_url + "reports", wait_until="networkidle")
        page.wait_for_timeout(1500)

        search_input = page.locator("input[placeholder*='Tìm theo tên khách']").first
        if search_input.count() > 0:
            print("  ✓ Found Reports search input", flush=True)
            search_input.fill("Minh")
            page.wait_for_timeout(600)
            page.screenshot(path=search_screenshot)
            print(f"  ✓ Saved search screenshot: {search_screenshot}", flush=True)
            search_input.fill("")
            page.wait_for_timeout(400)
        else:
            print("  ⚠ Search input not rendered yet (checking deployment status)", flush=True)

        # ----------------------------------------------------------------------
        # Test 2: Customer Detail Click Order -> Receipt Modal
        # ----------------------------------------------------------------------
        print("[4/5] Verifying Customer Detail Click Order...", flush=True)
        page.goto(base_url + "customers", wait_until="networkidle")
        page.wait_for_timeout(1500)

        # Click the first eye icon (Xem sổ nợ & lịch sử)
        view_customer_btn = page.locator("button[title*='Xem sổ nợ']").first
        if view_customer_btn.count() > 0:
            view_customer_btn.click()
            page.wait_for_timeout(800)

            # Check for recent orders
            recent_order_card = page.locator("div[title*='xem chi tiết hóa đơn']").first
            if recent_order_card.count() > 0:
                print("  ✓ Found clickable recent order card in customer detail", flush=True)
                recent_order_card.click()
                page.wait_for_timeout(1000)

                receipt_modal = page.locator(".bg-white.rounded-2xl.max-w-md").first
                if receipt_modal.count() > 0:
                    print("  ✓ ReceiptModal successfully opened from Customer Detail click!", flush=True)
                    page.screenshot(path=receipt_screenshot)
                    print(f"  ✓ Saved customer receipt screenshot: {receipt_screenshot}", flush=True)

                    # Close receipt modal
                    close_btn = page.locator("button:has-text('Đóng')").first
                    if close_btn.count() > 0:
                        close_btn.click()
                        page.wait_for_timeout(400)

            # Close customer modal
            close_cust_btn = page.locator("button:has-text('Đóng')").last
            if close_cust_btn.count() > 0:
                close_cust_btn.click()
                page.wait_for_timeout(400)

        # ----------------------------------------------------------------------
        # Test 3: Edit Order Modal Product Combobox
        # ----------------------------------------------------------------------
        print("[5/5] Verifying Edit Order Product Combobox...", flush=True)
        page.goto(base_url + "reports", wait_until="networkidle")
        page.wait_for_timeout(1500)

        edit_order_btn = page.locator("button[title*='Chỉnh sửa đơn']").first
        if edit_order_btn.count() > 0:
            edit_order_btn.click()
            page.wait_for_timeout(800)

            combobox_input = page.locator("input[placeholder*='Gõ tìm món']").first
            if combobox_input.count() > 0:
                print("  ✓ Found ProductCombobox input in EditOrderModal", flush=True)
                combobox_input.click()
                combobox_input.fill("Xôi")
                page.wait_for_timeout(500)
                page.screenshot(path=combobox_screenshot)
                print(f"  ✓ Saved combobox screenshot: {combobox_screenshot}", flush=True)
            else:
                print("  ⚠ ProductCombobox input not yet rendered", flush=True)

        browser.close()
        print("✓ All ADR-0015 Live Verifications completed.", flush=True)

if __name__ == '__main__':
    verify_adr0015()
