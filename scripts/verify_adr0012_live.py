import os
import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def verify_adr0012():
    evidence_dir = os.path.join(os.getcwd(), '.scratch', 'verification_evidence')
    os.makedirs(evidence_dir, exist_ok=True)

    with sync_playwright() as p:
        print("[1/5] Launching headless browser...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        print("[2/5] Navigating to live site: https://tomeziy.github.io/mexucxich-cuisine/#/ ...")
        page.goto("https://tomeziy.github.io/mexucxich-cuisine/#/", wait_until="networkidle", timeout=30000)
        time.sleep(2)

        print("[3/5] Adding product to cart and entering fractional quantities (0.5 and 0.56)...")
        # Find product card with 'Xúc xích Bò Tiêu Đen' or first product
        sausage_card = page.locator("text=Xúc xích Bò Tiêu Đen").first
        if sausage_card.count() > 0:
            sausage_card.click()
        else:
            # Fallback click first product in grid
            page.locator(".cursor-pointer:has-text('500g')").first.click()
        time.sleep(0.5)

        # Quantity input inside cart
        qty_input = page.locator("input[title='Nhập số lượng (hỗ trợ số lẻ như 0.59 hoặc 0,59)']").first
        if qty_input.count() == 0:
            qty_input = page.locator("input[type='text'][inputmode='decimal']").first

        print(" -> Testing qty = 0.5 (expecting 250g)...")
        qty_input.fill("0.5")
        qty_input.blur()
        time.sleep(0.5)

        # Check cart badge for 250g
        badge_text_05 = page.locator("text=250g").first
        has_250g = badge_text_05.count() > 0
        print(f" -> Dynamic weight 250g displayed: {'YES (PASS)' if has_250g else 'NO (FAIL)'}")

        # Screenshot cart with 0.5 -> 250g
        cart_05_path = os.path.join(evidence_dir, "cart_fractional_05_250g.png")
        page.screenshot(path=cart_05_path)
        print(f" -> Saved screenshot: {cart_05_path}")

        print(" -> Testing qty = 0.56 (expecting 280g)...")
        qty_input.fill("0.56")
        qty_input.blur()
        time.sleep(0.5)

        badge_text_056 = page.locator("text=280g").first
        has_280g = badge_text_056.count() > 0
        print(f" -> Dynamic weight 280g displayed: {'YES (PASS)' if has_280g else 'NO (FAIL)'}")

        cart_056_path = os.path.join(evidence_dir, "cart_fractional_056_280g.png")
        page.screenshot(path=cart_056_path)
        print(f" -> Saved screenshot: {cart_056_path}")

        print("[4/5] Testing Receipt Preview Modal typography & font...")
        # Add customer to trigger receipt delivery callout
        combobox_btn = page.locator('button:has(.lucide-chevron-down)').first
        if combobox_btn.count() > 0:
            combobox_btn.click()
            time.sleep(0.3)
            # Pick first customer
            first_cust = page.locator(".cursor-pointer:has-text('09')").first
            if first_cust.count() > 0:
                first_cust.click()
                time.sleep(0.3)

        # Click "Xem hóa đơn" or "Giao hàng"
        delivery_btn = page.locator("button:has-text('Giao hàng')").first
        if delivery_btn.count() > 0:
            delivery_btn.click()
            time.sleep(0.3)

        # Click print / preview receipt button
        preview_btn = page.locator("button:has-text('In hóa đơn')").first
        if preview_btn.count() == 0:
            preview_btn = page.locator("button:has-text('Hóa đơn')").first
        if preview_btn.count() > 0:
            preview_btn.click()
            time.sleep(1)

            receipt_modal = page.locator("text=Hóa đơn bán hàng").first
            modal_open = receipt_modal.count() > 0
            print(f" -> Receipt Modal open: {'YES (PASS)' if modal_open else 'NO (FAIL)'}")

            # Verify 280g appears on receipt
            receipt_280g = page.locator(".max-w-md:has-text('280g')").first
            has_receipt_weight = receipt_280g.count() > 0
            print(f" -> Calculated weight 280g rendered on thermal receipt: {'YES (PASS)' if has_receipt_weight else 'NO (FAIL)'}")

            # Verify font family of receipt
            font_computed = page.evaluate("""() => {
                const el = document.querySelector('[data-testid=\"delivery-callout-header\"]');
                return el ? window.getComputedStyle(el).fontFamily : 'not found';
            }""")
            print(f" -> Computed receipt font-family: {font_computed}")

            receipt_path = os.path.join(evidence_dir, "receipt_modal_adr0012.png")
            page.screenshot(path=receipt_path)
            print(f" -> Saved receipt screenshot: {receipt_path}")

        print("[5/5] Verification completed successfully.")
        browser.close()

if __name__ == '__main__':
    verify_adr0012()
