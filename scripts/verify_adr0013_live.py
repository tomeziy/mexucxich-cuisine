import os
import sys
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def verify_adr0013():
    evidence_dir = os.path.join(os.getcwd(), '.scratch', 'verification_evidence')
    os.makedirs(evidence_dir, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # 1. Test 1092px (1366x768 @ 125% Windows scaling - identical to user's laptop)
        print("[1/4] Testing at 1092x700 (1366x768 @ 125% scaling)...")
        page = browser.new_page(viewport={"width": 1092, "height": 700})
        page.goto("https://tomeziy.github.io/mexucxich-cuisine/#/customers", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # Click debtor filter
        debt_btn = page.locator('button:has-text("Chỉ hiện khách đang nợ")').first
        if debt_btn.count() > 0:
            debt_btn.click()
            page.wait_for_timeout(500)

        th_last = page.locator('th').last
        th_text = th_last.inner_text().strip()
        print(f" -> Header text: {th_text}")
        assert "THAO TÁC" in th_text, f"Header must be full 'THAO TÁC', got '{th_text}'"

        card_box = page.locator('.bg-white.rounded-2xl.border.border-slate-200.shadow-xs.overflow-hidden').last.bounding_box()
        card_right = card_box['x'] + card_box['width']

        td_last = page.locator('tbody tr td:last-child').first
        td_box = td_last.bounding_box()
        print(f" -> Sticky TD last: x={td_box['x']}, width={td_box['width']}, right={td_box['x'] + td_box['width']}")

        btns = td_last.locator('button').all()
        print(f" -> Action buttons count: {len(btns)}")
        assert len(btns) == 3, f"Debtor row must show 3 buttons, found {len(btns)}"

        for i, b in enumerate(btns):
            b_box = b.bounding_box()
            b_text = b.inner_text().strip()
            print(f"    Button {i} ({b_text}): x={b_box['x']}, width={b_box['width']}, right={b_box['x'] + b_box['width']}")
            assert b_box['x'] + b_box['width'] <= card_right + 2, f"Button {i} must not overflow card boundary!"

        page.screenshot(path=os.path.join(evidence_dir, "verified_laptop_1092.png"))
        print(" -> Screenshot saved: verified_laptop_1092.png")

        # 2. Test 1440px desktop
        print("\n[2/4] Testing at 1440x900 desktop...")
        page_1440 = browser.new_page(viewport={"width": 1440, "height": 900})
        page_1440.goto("https://tomeziy.github.io/mexucxich-cuisine/#/customers", wait_until="networkidle")
        page_1440.wait_for_timeout(1000)

        debt_btn_1440 = page_1440.locator('button:has-text("Chỉ hiện khách đang nợ")').first
        if debt_btn_1440.count() > 0:
            debt_btn_1440.click()
            page_1440.wait_for_timeout(500)

        page_1440.screenshot(path=os.path.join(evidence_dir, "verified_desktop_1440.png"))
        print(" -> Screenshot saved: verified_desktop_1440.png")

        # 3. Test 390x844 mobile (iPhone)
        print("\n[3/4] Testing at 390x844 mobile...")
        page_mobile = browser.new_page(viewport={"width": 390, "height": 844})
        page_mobile.goto("https://tomeziy.github.io/mexucxich-cuisine/#/customers", wait_until="networkidle")
        page_mobile.wait_for_timeout(1000)

        m_debt_btn = page_mobile.locator('button:has-text("Chỉ hiện khách đang nợ")').first
        if m_debt_btn.count() > 0:
            m_debt_btn.click()
            page_mobile.wait_for_timeout(500)

        m_td_last = page_mobile.locator('tbody tr td:last-child').first
        m_td_box = m_td_last.bounding_box()
        print(f" -> Mobile Sticky TD last: x={m_td_box['x']}, width={m_td_box['width']}")
        assert m_td_box['x'] >= 200, "Sticky Thao tác column must be pinned to the right on mobile viewport!"

        page_mobile.screenshot(path=os.path.join(evidence_dir, "verified_mobile_390.png"))
        print(" -> Screenshot saved: verified_mobile_390.png")

        browser.close()
        print("\n[4/4] All verification checks passed 100%!")

if __name__ == '__main__':
    verify_adr0013()
