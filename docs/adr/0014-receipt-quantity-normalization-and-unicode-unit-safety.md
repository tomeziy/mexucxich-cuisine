# ADR-0014: Receipt Quantity Normalization & Unicode Unit Safety

**Status:** Accepted  
**Date:** 2026-11-05  
**Context:** Mexucxich Cuisine POS & Thermal Printing Engine  

---

## Context & Problem Statement

Real production receipts produced at Mexucxich Cuisine revealed unintended behaviors:
1. **Unintended Integer Weight Multiplication:**
   When cashiers rang up multiple whole items (e.g., 2 packs of fried shallots 300g, 4 boxes of pasta sauce 600g, 5 boxes of mushroom sauce 310g), `calculateEffectiveWeight` multiplied the base packaging weight by the quantity (e.g., 600g * 4 = 2.4kg). This printed confusing and inaccurate labels like `Sốt mỳ ý bò bằm 600g (Hộp (2.4kg))` and printed a bracketed weight `(2.4kg)` under the `SL` column.
2. **Unicode Regex Boundary Collision:**
   A standard ASCII word boundary `\b` does not recognize non-ASCII characters like `ó` in `gói`. In Vietnamese, `set 5 gói` was truncated at the letter `g`, parsed as 5 grams, and multiplied by 3 to produce `15g`.
3. **Cluttered `SL` Column:**
   Rendering `{effectiveWeight && <span>({effectiveWeight})</span>}` directly under the quantity in `ThermalReceipt.tsx` cluttered the receipt table and contradicted standard POS receipt formatting.

---

## Decisions

1. **Integer Quantity Immunity:**
   In `calculateEffectiveWeight`, immediately return `null` if `Number.isInteger(qty)`. Whole quantities (1, 2, 3, 4, 5...) represent discrete physical packaging units (boxes, bags, jars) and must never have their nominal weights multiplied.
2. **Unicode-Aware Lookahead:**
   Update the unit extraction regex to `/(?:^|\s|\(|\/)(\d+(?:[.,]\d+)?)\s*(kg|kilogram|g|gr|gram|ml|l|lít)(?![a-zA-Z\p{L}])/iu`. This ensures Vietnamese words such as `gói`, `gà`, `ly`, `lọ`, `miếng` are never matched as abbreviations for grams or liters.
3. **Sanitize `SL` Column:**
   Remove the bracketed weight subline under the `SL` column in `ThermalReceipt.tsx`. The column strictly displays `formatReceiptQty(item.qty)` (`x1`, `x2`, `x0.5`).
4. **Preserve Fractional Portion Cuts:**
   Fractional/cut portion scaling (`0.5`, `0.56`, `0.59`) remains fully supported on the item name line (`Gói 500g → 250g`) and on the POS cart badge (`⚖️ Gói 500g → 250g`).

---

## Consequences

- Real receipts printed on thermal paper K80 match standard retail clarity.
- Whole-packaged food items maintain their exact unit integrity regardless of the quantity purchased.
- Vietnamese product descriptions containing words like `gói` or `gà` will never be erroneously treated as weight units.
