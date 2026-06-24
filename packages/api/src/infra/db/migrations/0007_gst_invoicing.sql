-- ============================================================================
-- RentLedger — Tier-3: GST invoicing for commercial lets.
--
-- A GST tax invoice carries a taxable value plus CGST/SGST (intra-state) or
-- IGST (inter-state). invoices.amount_minor stays the GROSS (taxable + tax) so
-- payments, allocations and arrears keep working unchanged; the breakdown below
-- is what a compliant tax invoice must additionally show. All amounts are paise.
-- Columns are nullable: only GST invoices populate them.
-- ============================================================================

ALTER TABLE invoices
  ADD COLUMN taxable_minor   bigint,
  ADD COLUMN cgst_minor      bigint,
  ADD COLUMN sgst_minor      bigint,
  ADD COLUMN igst_minor      bigint,
  ADD COLUMN gst_rate_bps    integer,
  ADD COLUMN hsn_sac         text,
  ADD COLUMN place_of_supply text,   -- two-digit state code of the property
  ADD COLUMN supplier_gstin  text,
  ADD COLUMN recipient_gstin text;
