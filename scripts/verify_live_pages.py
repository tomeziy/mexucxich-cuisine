import json
import os
import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_verification():
    evidence_dir = os.path.join(os.getcwd(), '.scratch', 'verification_evidence')
    os.makedirs(evidence_dir, exist_ok=True)
    
    results = {
        "target_url": "https://tomeziy.github.io/mexucxich-cuisine/",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "checks": []
    }

    with sync_playwright() as p:
        print("[1/5] Launching headless Chromium browser...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        print("[2/5] Navigating to live deployment: https://tomeziy.github.io/mexucxich-cuisine/#/ ...")
        page.goto("https://tomeziy.github.io/mexucxich-cuisine/#/", wait_until="networkidle", timeout=30000)
        time.sleep(1)

        # Check 1: POS Page Render
        pos_title = page.title()
        has_pos_ui = page.locator("text=Mexucxich Cuisine").count() > 0 or page.locator("text=Đơn hàng").count() > 0
        results["checks"].append({
            "name": "POS UI Rendered",
            "passed": has_pos_ui,
            "details": f"Page title: '{pos_title}', Has POS Header/Cart: {has_pos_ui}"
        })
        print(f" -> POS UI check: {'PASSED' if has_pos_ui else 'FAILED'}")

        # Check 2: CustomerCombobox Interaction, Search Ranking & 1-Touch Selection
        print("[3/5] Driving CustomerCombobox on POS...")
        combobox_btn = page.locator('button:has(.lucide-chevron-down)').first
        if combobox_btn.count() > 0:
            combobox_btn.click()
            time.sleep(0.3)
            
            search_input = page.locator('input[placeholder*="Gõ tên, SĐT"]')
            if search_input.count() > 0:
                search_input.fill("yến")
                time.sleep(0.5)

                # Capture dropdown screenshot
                combobox_screenshot = os.path.join(evidence_dir, "pos_customer_combobox_yen.png")
                page.screenshot(path=combobox_screenshot)
                
                # Check dropdown items inside popover
                dropdown_items = page.locator('.absolute.z-50.max-h-72 > div.cursor-pointer')
                dropdown_count = dropdown_items.count()
                top_items = []
                for i in range(min(5, dropdown_count)):
                    item_text = dropdown_items.nth(i).inner_text().split('\n')[0].strip()
                    top_items.append(item_text)
                
                # All top items must be true "Yến" customers, NOT "Nguyễn"
                all_top_are_yen = len(top_items) > 0 and all(
                    "yến" in it.lower() or "yen" in it.lower() for it in top_items
                )
                no_nguyen_in_top = not any(it.lower().startswith("nguyễn") for it in top_items)

                # Verify 1-touch instant selection via onMouseDown
                first_item = dropdown_items.first
                selected_expected_name = top_items[0] if top_items else ""
                first_item.dispatch_event('mousedown')
                time.sleep(0.3)
                
                # Verify customer selected on trigger button
                after_btn_text = page.locator('button:has(.lucide-chevron-down)').first.inner_text()
                selected_successfully = selected_expected_name in after_btn_text

                combobox_passed = all_top_are_yen and no_nguyen_in_top and selected_successfully
                results["checks"].append({
                    "name": "CustomerCombobox Whole-word Ranking & Instant Selection",
                    "passed": combobox_passed,
                    "screenshot": combobox_screenshot,
                    "top_items": top_items,
                    "all_top_are_yen": all_top_are_yen,
                    "no_nguyen_in_top": no_nguyen_in_top,
                    "selected_name": selected_expected_name,
                    "selected_successfully": selected_successfully
                })
                print(f" -> CustomerCombobox test: {'PASSED' if combobox_passed else 'FAILED'} (Top: {top_items}, Selected: '{selected_expected_name}')")
            else:
                results["checks"].append({"name": "CustomerCombobox Input", "passed": False, "error": "Search input not found"})
        else:
            results["checks"].append({"name": "CustomerCombobox Button", "passed": False, "error": "Combobox trigger not found"})

        # Check 3: CustomersPage Navigation & KiotViet Pagination
        print("[4/5] Navigating to CustomersPage (/#/customers)...")
        page.goto("https://tomeziy.github.io/mexucxich-cuisine/#/customers", wait_until="networkidle", timeout=30000)
        time.sleep(1)

        # Check table
        table_rows = page.locator("tbody tr")
        row_count = table_rows.count()
        
        # Check pagination bar
        has_pagination_bar = page.locator("text=Hiển thị").count() > 0
        pagination_text = page.locator("text=Hiển thị").first.inner_text() if has_pagination_bar else "Not found"
        
        # Check page size dropdown (20, 50, 100)
        page_size_select = page.locator("select:has-text('khách/trang')")
        has_page_size_select = page_size_select.count() > 0

        # Change page size to 50
        if has_page_size_select:
            page_size_select.select_option("50")
            time.sleep(0.5)
            row_count_50 = page.locator("tbody tr").count()
            pagination_text_50 = page.locator("text=Hiển thị").first.inner_text()
        else:
            row_count_50 = row_count
            pagination_text_50 = pagination_text

        # Test pagination navigation (click "Trang tiếp / Sau")
        next_btn = page.locator("button:has-text('Sau')").first
        if next_btn.count() > 0 and not next_btn.is_disabled():
            next_btn.click()
            time.sleep(0.5)
            page_2_text = page.locator("text=Hiển thị").first.inner_text()
        else:
            page_2_text = "N/A"

        customers_screenshot = os.path.join(evidence_dir, "customers_page_pagination.png")
        page.screenshot(path=customers_screenshot)

        pagination_passed = has_pagination_bar and has_page_size_select and (row_count_50 == 50)
        results["checks"].append({
            "name": "CustomersPage KiotViet Pagination & Dynamic Page Sizing",
            "passed": pagination_passed,
            "screenshot": customers_screenshot,
            "initial_rows": row_count,
            "rows_at_50": row_count_50,
            "pagination_text_50": pagination_text_50,
            "page_2_text": page_2_text
        })
        print(f" -> CustomersPage Pagination: {'PASSED' if pagination_passed else 'FAILED'} (Page size 50: {row_count_50} rows, Page 2: '{page_2_text}')")

        # Check 4: CustomersPage Search Multi-token & Whole-word Ranking
        print("[5/5] Testing CustomersPage search bar for 'yến' vs 'nguyễn'...")
        cust_search = page.locator('input[placeholder*="Tìm nhanh khách hàng"]')
        if cust_search.count() > 0:
            cust_search.fill("yến")
            time.sleep(0.5)
            
            search_screenshot = os.path.join(evidence_dir, "customers_page_search_yen.png")
            page.screenshot(path=search_screenshot)

            filtered_rows = page.locator("tbody tr")
            filtered_count = filtered_rows.count()
            top_filtered_names = []
            for i in range(min(5, filtered_count)):
                row_strong = filtered_rows.nth(i).locator("strong").first
                name_str = row_strong.inner_text().strip() if row_strong.count() > 0 else filtered_rows.nth(i).inner_text().split('\n')[0].strip()
                top_filtered_names.append(name_str)

            # Check that top filtered names all have "Yến" or "Yen", and no "Nguyễn" is ranked ahead
            all_are_yen = len(top_filtered_names) > 0 and all(
                "yến" in name.lower() or "yen" in name.lower() for name in top_filtered_names
            )
            no_nguyen_leading = not any(name.lower().startswith("nguyễn") for name in top_filtered_names)

            search_passed = filtered_count > 0 and all_are_yen and no_nguyen_leading
            results["checks"].append({
                "name": "CustomersPage Multi-token & Word-boundary Ranking",
                "passed": search_passed,
                "screenshot": search_screenshot,
                "filtered_count": filtered_count,
                "top_filtered_names": top_filtered_names
            })
            print(f" -> CustomersPage Search: {'PASSED' if search_passed else 'FAILED'} (Top filtered: {top_filtered_names})")

            # Check 5: Multi-token search for "yến thanh phan"
            print(" -> Testing exact multi-token search for 'yến thanh phan'...")
            cust_search.fill("yến thanh phan")
            time.sleep(0.5)
            specific_rows = page.locator("tbody tr")
            specific_count = specific_rows.count()
            first_specific = specific_rows.first.locator("strong").first.inner_text().strip() if specific_count > 0 else ""
            is_yen_thanh_phan_found = "yến thanh phan" in first_specific.lower()
            results["checks"].append({
                "name": "Multi-token search for 'yến thanh phan'",
                "passed": is_yen_thanh_phan_found,
                "matched_name": first_specific
            })
            print(f" -> Multi-token 'yến thanh phan': {'PASSED' if is_yen_thanh_phan_found else 'FAILED'} (Found: '{first_specific}')")
        else:
            results["checks"].append({"name": "CustomersPage Search Input", "passed": False, "error": "Search input not found"})

        browser.close()

    # Save summary report
    summary_path = os.path.join(evidence_dir, "verification_summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print("\n==================================================")
    print("VERIFICATION RUN SUMMARY:")
    all_passed = all(c.get("passed", False) for c in results["checks"])
    for c in results["checks"]:
        status = "✓ PASS" if c.get("passed") else "✗ FAIL"
        print(f"  {status}: {c['name']}")
    print(f"All Checks Passed: {all_passed}")
    print(f"Evidence Directory: {evidence_dir}")
    print("==================================================")

    if not all_passed:
        sys.exit(1)

if __name__ == "__main__":
    run_verification()
