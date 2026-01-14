# SlipSafe Pro: Business Analysis Prompts (SARS 2025/26)

This document contains specialized prompts designed to help the SlipSafe Pro AI accurately process business slips, invoices, and payroll data according to the South African Revenue Service (SARS) guidelines for the 2025/26 tax year.

---

## 1. Receipt Extraction & SARS Compliance Validation

**Goal:** Extract data and verify if the document meets the legal requirements for an Input Tax deduction.

### Prompt Template:
```text
Act as a South African Tax Specialist. Analyze the provided image/text of a business slip or invoice.
Extract the following fields into a JSON format:
- supplier_name
- supplier_vat_number
- supplier_address
- date (YYYY-MM-DD)
- invoice_number
- description_of_goods_services
- total_amount_inclusive
- vat_amount (if explicitly stated)
- recipient_name (if present)
- recipient_vat_number (if present)
- recipient_address (if present)
- volume_quantity (if present)

Validation Logic (SARS 2025/26):
1. Document Type: Ensure the words "Tax Invoice", "VAT Invoice", or "Invoice" are present.
2. If Total <= R50: Mark as 'Sufficient' (Till slip/cash slip is enough, no VAT number required).
3. If R50 < Total <= R5,000: Check for 'Abridged Tax Invoice' requirements:
   - Supplier Name, VAT #, and Address.
   - Date of issue and Invoice Number.
   - Description of goods/services.
   - Total amount and VAT amount (or statement that VAT is included).
4. If Total > R5,000: Check for 'Full Tax Invoice' requirements:
   - All abridged requirements PLUS:
   - Recipient Name, Address, and VAT Number.
   - Volume or Quantity of goods/services.

Return a 'compliance_status' (Valid/Invalid/Incomplete) and 'missing_fields' list.
```

---

## 2. Tax Deductibility & Expense Classification

**Goal:** Determine if an expense is deductible under the "General Deduction Formula" or if it falls under prohibited categories.

### Prompt Template:
```text
Analyze the following business expense: [EXPENSE_DESCRIPTION]
Amount: [AMOUNT]
Business Type: [e.g., Standard / Personal Service Provider (PSP)]

Apply SARS 2025/26 Rules:
1. General Deduction Formula: Is this expense 'actually incurred in the production of income' and not of a capital nature?
2. Small Item Write-Off: If the cost is < R7,000, it can be written off in full in the year of acquisition (Section 11(e)).
3. Personal Service Provider (PSP) Restriction: If the business is a PSP, deductions are restricted (Section 23(k)) to:
   - Remuneration to employees.
   - Legal expenses and Bad debts.
   - Contributions to pension/provident/RA funds.
   - Premises, finance charges, insurance, repairs, fuel, and maintenance (only if used wholly for trade).
4. Entertainment Denial:
   - General Rule: Input tax is denied for staff refreshments, business lunches, or client entertainment.
   - Exception: Input tax IS claimable if the expense is for business travel (employee is away from home for at least one night).
5. Motor Car Denial:
   - General Rule: Input tax is denied for the purchase, lease, or maintenance of a 'motor car'.
   - Definition: A 'motor car' is a passenger vehicle with 3+ wheels (including double-cabs).
   - Exclusions: Delivery vehicles, motorcycles, and vehicles with > 16 seats are NOT 'motor cars' and input tax can be claimed.

Output:
- category: (e.g., Travel, Entertainment, Manufacturing, General Admin)
- is_deductible: (Boolean)
- vat_claimable: (Boolean)
- reasoning: (Brief explanation citing SARS 404 or Section 23(k))
```

---

## 3. VAT Classification & Calculation

**Goal:** Correctly classify the supply type and calculate the tax fraction.

### Prompt Template:
```text
Analyze the items on this slip: [ITEMS_LIST]
Accounting Basis: [Invoice / Payments]

Classify each item as:
- Standard-Rated (15% VAT)
- Zero-Rated (0% VAT):
  - Basic Foodstuffs: Brown bread, milk, eggs, maize meal, rice, lentils, vegetable oil, pilchards, fruit/veg (fresh).
  - Exports and International Transport.
  - Petrol and Diesel (Fuel Levy goods).
- Exempt (No VAT):
  - Residential accommodation (long-term).
  - Certain financial services (interest, life insurance).
  - Public transport (bus, taxi, train).

Calculation Logic:
- Tax Fraction: For standard-rated items, VAT = Total * (15 / 115).
- De Minimis Rule: If taxable supplies are >= 95% of total supplies, allow 100% input tax on mixed expenses.
- Apportionment: If taxable supplies < 95%, input tax on mixed expenses must be apportioned.

Output a breakdown of VAT per category and total claimable VAT.
```

---

## 4. Fringe Benefit & Payroll Detection

**Goal:** Identify items on a slip or payroll record that constitute a taxable fringe benefit.

### Prompt Template:
```text
Scan the document for potential Fringe Benefits (SARS 2025/26 Rates):
1. Travel Allowance:
   - Fixed Allowance: 80% subject to PAYE (20% if 80% business use proven).
   - Reimbursement: Use simplified rate of R4.76/km (Code 3702).
2. Company Vehicle:
   - Benefit = 3.5% of determined value per month.
   - Reduced to 3.25% if a maintenance plan was included at purchase.
3. Low-Interest Loans:
   - Official Interest Rate = Repo Rate + 1% (Currently approx 8.5% - 9.5% p.a.).
4. Medical Aid Credits:
   - R364 for the taxpayer.
   - R364 for the first dependant.
   - R246 for each additional dependant.
5. Subsistence Allowance (Overnight):
   - Meals & Incidental: R570 per day.
   - Incidental Only: R176 per day.
6. Bursaries:
   - Remuneration Proxy: Employee must earn < R600,000 p.a.
   - Limits: R20,000 (Basic Education) / R60,000 (Higher Education).
   - Disabled: R30,000 (Basic) / R90,000 (Higher).
7. Two-Pot Retirement: Flag "Savings Withdrawal Benefits" (taxed at marginal rates).

Output:
- benefit_type
- taxable_value
- irp5_code (e.g., 3801, 3701, 4001)
```

---

## 5. Business Regime Specific Analysis (SBC & Turnover Tax)

**Goal:** Tailor the analysis based on the business's tax structure.

### Prompt Template:
```text
Context: The business is a [REGIME: SBC / Turnover Tax / Standard Company].

If SBC (Small Business Corporation):
- Tiered Rates: 0% (up to R95,750), 7% (to R365,000), 21% (to R550,000), 27% (above).
- Manufacturing Assets: 100% deduction in year 1 (Section 12E).
- Renewable Energy (Section 12B): 100% deduction for solar PV < 1MW.
- Other Assets: 50/30/20 write-off over 3 years.
- Professional Services Restriction: Ensure < 80% of income is from professional services (unless 3+ full-time non-owner employees).

If Turnover Tax (Micro Business):
- Threshold: Turnover < R1 million.
- Taxable Turnover: Includes 50% of capital gains from business assets.
- Professional Services Restriction: Same as SBC (80% rule).
- Record Keeping: Mandatory for receipts, dividends, and assets/liabilities > R10,000.

If Standard Company:
- Corporate Tax Rate: 27%.
- Assessed Loss Limitation: Set-off limited to higher of R1 million or 80% of taxable income (Section 20).
- CGT Inclusion: 80% (Effective rate 21.6%).

Provide a summary of tax liability, depreciation benefits, and compliance alerts.
```
