# Mexucxich Cuisine

A lightweight, offline-first point-of-sale, debt ledger, and cloud synchronization system for Mexucxich Cuisine artisanal delicatessen and specialty foods.

## Language

**Customer Combobox**:
A keyboard-navigable autocomplete input at the point-of-sale that filters customers in real time with Vietnamese diacritics insensitivity, phone search, ranked matching, and inline customer creation.
_Avoid_: Customer dropdown, customer select, customer picker

**Thermal Receipt**:
An 80mm (K80) monochrome receipt printed by thermal head for at-counter customers, delivery riders, and kitchen preparation.
_Avoid_: Invoice, bill, ticket, check

**Order Type**:
The fulfillment method of an order, either at-counter direct sale (`direct`) or delivery (`delivery`).
_Avoid_: Shipping type, order method, delivery mode

**Debt Ledger**:
A cumulative balance tracking uncollected receivables owed by a customer across multiple orders.
_Avoid_: Credit account, loan, tabs

**Atomic Stock Adjustment**:
A database-level stored procedure incrementing or decrementing product inventory by a delta value to prevent concurrent overwrite race conditions across devices.
_Avoid_: Absolute stock overwrite, stock sync

**Fractional Quantity**:
A non-integer quantity value (e.g. 0.5kg, 0.59kg) assigned to line items measured by weight or custom portions.
_Avoid_: Split quantity, sub-unit, partial piece

**Delivery Callout Header**:
An enlarged, high-contrast customer information block (Recipient Name, Phone, Delivery Address, Shipping Note) on the thermal receipt formatted for delivery driver readability while preserving compact itemized rows.
_Avoid_: Shipper note, driver box, large address banner
