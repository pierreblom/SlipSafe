Based on the **SARS Budget Tax Guide (Updated 21 May 2025)**, the following data points are critical for a business "slips" or payroll/accounting analysis program for the **2025/26 tax year**.

### 1. Corporate & Small Business Tax Rates

Use these rates to calculate the tax liability for various business structures.

| Business Type | Taxable Income (R) | Rate / Formula |
| --- | --- | --- |
| **Standard Company** | Any | <br>**27%** of taxable income 

 |
| **Small Business Corporation (SBC)** | 1 – 95,750 | 0% 

 |
|  | 95,751 – 365,000 | 7% of taxable income above 95,750 

 |
|  | 365,001 – 550,000 | R18,848 + 21% of taxable income above 365,000 

 |
|  | 550,001 and above | R57,698 + 27% of amount above 550,000 

 |
| **Turnover Tax (Micro Business)** | 1 – 335,000 | 0% 

 |
|  | 335,001 – 500,000 | 1% of taxable turnover above 335,000 

 |
|  | 500,001 – 750,000 | R1,650 + 2% of taxable turnover above 500,000 

 |
|  | 750,001 and above | R6,650 + 3% of taxable turnover above 750,000 

 |

---

### 2. Payroll & Employee Fringe Benefits

These values are essential for generating accurate salary slips and IRP5 certificates.

* 
**Skills Development Levy (SDL):** 1% of total remuneration (exempt if annual remuneration is < R500,000).


* 
**UIF Contributions:** 1% by employer and 1% by employee, based on remuneration below a specified limit.


* **Medical Scheme Fees Tax Credit:**
* 
**R364** per month for the first two members.


* 
**R246** per month for each additional dependent.




* 
**Retirement Fund Contributions:** Deductible up to 27.5% of the greater of remuneration or taxable income, capped at **R350,000** per year.


* **Travel Allowances (Deemed Costs):**
* 
**Fixed Cost:** Ranges from **R33,940 to R211,121** based on vehicle value.


* 
**Fuel Cost:** Ranges from **146.7c/km to 242.9c/km**.


* 
**Maintenance:** Ranges from **47.4c/km to 122.5c/km**.


* 
**Alternative Simplified Rate:** **R4.76 per km** (if no other travel allowance is received).




* 
**Employer-Owned Vehicles:** Taxable monthly value is **3.5%** of determined value (or **3.25%** if under a maintenance plan).



---

### 3. Indirect Taxes & Thresholds

* 
**Value-Added Tax (VAT):** 15% standard rate.


* 
**Registration Threshold:** Mandatory if taxable supplies exceed **R1 million** per annum.




* 
**Dividends Tax:** 20% (withheld by companies paying dividends).


* 
**Capital Gains Tax (CGT):** Maximum effective rate for companies is **21.6%**.



---

### 4. Interest Rates for Calculations

These interest rates apply from specific dates in 2025:

* **Official Rate (Fringe Benefit Loans):** 8.5% p.a. (from 1 February 2025) .


* **Late/Underpayment of Tax:** 11% p.a. (from 1 May 2025) .


* 
**Refund of VAT (after prescribed period):** 11% p.a..



**Would you like me to help you format these travel allowance tables into a CSV or JSON structure for your program?**

Based on the provided SARS tax guides and current 2025/2026 budget data, the following information is structured for integration into a business slips or payroll analysis program.

### 1. Corporate Income Tax (CIT) Constants

For a company analysis program, these flat rates and thresholds are the primary constants for the **2025/2026** tax year (years of assessment ending between 1 April 2025 and 31 March 2026).

| Tax Category | Rate / Value |
| --- | --- |
| **Standard Corporate Tax Rate** | 27% |
| **Trusts (other than Special Trusts)** | 45% |
| **Dividends Tax** | 20% |
| **VAT Standard Rate** | 15% |

### 2. Small Business Corporation (SBC) Tiered Rates

If your program categorizes businesses as SBCs (gross income < R20 million and other requirements), use this tiered logic for tax calculations:

| Taxable Income (R) | Tax Calculation Formula (2025/26) |
| --- | --- |
| 1 – 95,750 | 0% |
| 95,751 – 365,000 | 7% of amount above 95,750 |
| 365,001 – 550,000 | R18,848 + 21% of amount above 365,000 |
| 550,001 and above | R57,698 + 27% of amount above 550,000 |

### 3. Capital Gains Tax (CGT) Logic for Companies

Based on the **ABC of Capital Gains Tax for Companies**, the program must follow this multi-step calculation:

* **Step 1: Calculate Gain/Loss** = Proceeds − Base Cost.
* **Step 2: Aggregate Gains/Losses** for the year to find the "Net Capital Gain".
* **Step 3: Apply Inclusion Rate**. For companies, the inclusion rate is **80%**.
* **Step 4: Effective Rate**. The effective CGT rate for companies is **21.6%** (80% inclusion × 27% CIT rate).

**Important Programmatic Exclusions:**

* **Small Business Asset Relief:** Natural persons (not the company itself directly) can disregard up to **R1.8 million** in capital gains over their lifetime when disposing of a small business (assets < R10 million) if they are 55 or older.
* **Micro Businesses:** For companies on **Turnover Tax**, 50% of the receipts from the disposal of business assets are included in the taxable turnover calculation instead of standard CGT.

### 4. Payroll and Employee "Slips" Data

For payroll analysis, the following 2025/2026 figures are required:

#### PAYE and Rebates (Individuals)

* **Primary Rebate:** R17,235 (deductible from tax payable).
* **Medical Scheme Fees Tax Credits:**
* Main Member: R364 per month.
* First Dependent: R364 per month.
* Additional Dependents: R246 per month each.



#### Travel and Subsistence Allowances

* **Subsistence Allowance (Domestic):**
* Incidental costs only: **R161** per day.
* Meals and incidental costs: **R548** per day.


* **Travel Reimbursement Rate:** 476 cents per km (simplified method for 2026 tax year).
* **PAYE Inclusion:** 80% of a travel allowance is subject to PAYE unless the employer is satisfied 80% of the travel is for business (then only 20% is included).

### 5. Compliance and Interest Rates

Integrate these rates for programs tracking late payments or refunds (effective from 1 May 2025):

* **Late/Underpayment of Tax:** 11% p.a..
* **Refund of Tax Overpayment:** 7% p.a. (for provisional tax) or 11% (on successful appeal).
* **Official Interest Rate (Fringe Benefits):** 8.5% p.a. (from 1 Feb 2025) .

Based on the comprehensive **SARS Taxation in South Africa (2025 Edition)** and the **Budget Tax Guide**, the following technical specifications are provided for your business slips and payroll analysis program.

### 1. Individual Payroll & Personal Income Tax (2025/26)

For processing employee payslips and IRP5 certificates, use these constants for the tax year ending **28 February 2026**.

#### Tax Rebates (Deductible from Tax Payable)

* 
**Primary Rebate (All individuals):** R17 235.


* 
**Secondary Rebate (65 years and older):** R9 444 (additional to primary).


* 
**Tertiary Rebate (75 years and older):** R3 145 (additional to primary and secondary).



#### Medical Scheme Fees Tax Credit (Monthly)

* **Main Member:** R364.
* **First Dependent:** R364.
* **Each Additional Dependent:** R246.

#### Subsistence Allowance (Deemed Expenditure)

Use these for domestic business travel within South Africa:

* **Incidental costs only:** R161 per day.
* **Meals and incidental costs:** R548 per day.
* 
**Note:** For international travel, the amount is country-specific as per the Government Notice.



---

### 2. Corporate & Small Business Tax Logic

These rates determine the company-level tax liability for various business structures.

| Entity Type | Condition | Tax Formula (2025/2026) |
| --- | --- | --- |
| **Standard Company** | All | **27%** of taxable income. |
| **Small Business (SBC)** | Income < R20m | Tiered: 0% (up to R95,750), 7% (next R269,250), 21% (next R185,000), 27% (above R550,000). |
| **Micro Business** | Turnover < R1m | Simplified "Turnover Tax": 0% to 3% based on gross receipts .

 |
| **Trusts** | Non-Special | **45%** flat rate. |

---

### 3. Capital Gains Tax (CGT) Logic for Companies

When a business disposes of assets, the program must include these specific variables:

* **Inclusion Rate:** **80%** of the net capital gain is included in taxable income.
* 
**Effective Rate:** **21.6%** (Standard company) or **36%** (Trusts).


* **Annual Exclusion:** **R40,000** for individuals/special trusts (not applicable to standard companies).

---

### 4. Statutory Levies & Indirect Taxes

Integrate these percentages for monthly compliance and transactional analysis:

* 
**Skills Development Levy (SDL):** 1% of total remuneration (exempt if total annual payroll is < R500,000).


* 
**Unemployment Insurance (UIF):** 1% by employer and 1% by employee on remuneration below a specified cap.


* **Value-Added Tax (VAT):** **15%** standard rate. Registration is mandatory if annual taxable supplies exceed **R1 million**.

### 5. Official Interest Rates (2025/26)

Essential for programs calculating interest on late payments or fringe benefit loans:

* **Official Rate (Fringe Benefit Loans):** 8.5% p.a. (from 1 February 2025) .


* **Late/Underpayment of Tax:** 11% p.a. (from 1 May 2025) .


* 
**Late Payment of VAT:** 11% p.a..

Based on a detailed analysis of the **SARS Tax Guide for Small Businesses (2024/2025)** and related budget documentation, here are the technical data points and logic required for a business slips and payroll analysis program.

### 1. Corporate Income Tax (CIT) Logic

The program should distinguish between standard companies and Small Business Corporations (SBCs) to apply the correct rate.

* **Standard Company Rate:** 27% on each rand of taxable income.
* **Small Business Corporation (SBC) Rates (Years ending 1 April 2024 – 31 March 2025):**
* **R1 – R95 750:** 0%
* **R95 751 – R365 000:** 7% of amount above R95 750
* **R365 001 – R550 000:** R18 848 + 21% of amount above R365 000
* **R550 001 and above:** R57 698 + 27% of amount above R550 000



### 2. Payroll and "Slip" Constants (2025/2026)

For processing employee payslips and IRP5 certificates, use these values:

* **Standard Rebates (Deducted from Tax):**
* Primary: R17 235
* Secondary (65+): R9 444
* Tertiary (75+): R3 145


* **Medical Scheme Fees Tax Credits (Monthly):**
* Main member: R364
* First dependent: R364
* Each additional dependent: R246


* **Travel and Subsistence (Domestic):**
* **Incidental costs only:** R161 per day.
* **Meals and incidental costs:** R548 per day.
* **Simplified Travel Rate:** 476 cents per km (if no other allowance is received).



### 3. Fringe Benefit Calculations

For a program analyzing non-cash benefits on slips:

* **Company Vehicle:** 3.5% of the "determined value" per month. If the vehicle has a maintenance plan, the rate is 3.25%.
* **Interest-Free/Low-Interest Loans:** The "official rate" is **8.5% p.a.** (as of 1 Feb 2025). The fringe benefit is the difference between the official rate and the rate charged to the employee.
* **Retirement Fund Contributions:** Employee contributions are deductible up to **27.5%** of the greater of remuneration or taxable income, capped at **R350,000** annually.

### 4. Statutory Levies for Small Businesses

* **Skills Development Levy (SDL):** 1% of total remuneration. Small businesses are **exempt** if their total annual remuneration for the next 12 months is expected to be less than **R500,000**.
* **Unemployment Insurance Fund (UIF):** 1% from the employer and 1% from the employee (total 2%) on remuneration below the specified cap.

### 5. Deductions and Allowances for Analysis

* **Home Office Expenditure:** Deductible if the space is specifically equipped for and regularly/solely used for trade.
* **Asset Depreciation (SBCs):** SBCs can immediately write off **100%** of the cost of manufacturing plant or machinery brought into use for the first time.
* **General Deduction Formula:** For an expense to be valid on a business slip, it must be "actually incurred in the production of income" and not be of a capital nature.

### Programmatic Implementation Tip:

When building your logic, ensure the program first checks if the entity qualifies as an **SBC** (gross income < R20 million and natural person shareholders) or a **Micro Business** (turnover < R1 million) before applying the standard 27% tax rate, as the tax savings for small businesses are significant.

To develop a robust slips and accounting analysis program, your software logic must integrate the following core VAT principles, calculation formulas, and documentary validation rules as set out in the **SARS VAT 404 Guide for Vendors**.

### 1. Core VAT Calculation Logic

Your program should handle standard-rated, zero-rated, and exempt supplies differently based on the following rules:

* 
**Tax Fraction:** To extract VAT from a VAT-inclusive price (standard rate of 15%), use the formula: `Inclusive Amount x (15 / 115)`.


* 
**VAT Payable Calculation:** The fundamental formula for a tax period is `Output Tax - Input Tax - Permissible Deductions = VAT Payable/Refundable`.


* 
**Standard Rate:** Ensure a constant of **15%** is applied to all standard-rated supplies.


* 
**De Minimis Rule:** If the apportionment ratio (taxable supplies vs. total supplies) is **95% or more**, the program should allow the full amount of VAT on mixed expenses to be deducted.



### 2. Documentary Validation Rules (Slips & Invoices)

Your program's data entry or OCR validation should check for these thresholds to determine if a slip is legally sufficient for an input tax deduction:

* **Threshold 1: R50 or less:** No formal tax invoice is required. A till slip, cash slip, or sales docket is sufficient, provided it confirms the VAT charged.


* **Threshold 2: R50 to R5,000:** An **abridged tax invoice** is acceptable. It must contain the words "Tax Invoice," the supplier’s name, address, VAT registration number, the date, a description of goods, and the total consideration.


* **Threshold 3: Over R5,000:** A **full tax invoice** is mandatory. In addition to the abridged requirements, it must include the recipient's name, address, VAT number, and the volume/quantity of goods.



### 3. Input Tax Deduction Logic & Denials

The program must be able to flag expenses where input tax is legally prohibited, even if the business is a registered vendor:

* 
**Entertainment:** Input tax is generally **denied** for entertainment expenses (e.g., staff refreshments, business lunches) unless the vendor is in the business of providing entertainment.


* 
**Motor Cars:** VAT incurred on the purchase or lease of "motor cars" (as defined by the Act) is generally **not deductible**.


* 
**Exempt Supplies:** VAT incurred to make exempt supplies (e.g., residential accommodation or certain financial services) cannot be claimed as input tax.



### 4. Accounting Basis Logic

Ensure the program supports both recognized accounting methods, as they dictate the **timing** of when VAT is recognized:

* 
**Invoice (Accrual) Basis:** VAT is accounted for in the period an invoice is issued or received, or any payment is made, whichever is earlier.


* **Payments (Cash) Basis:** VAT is only accounted for once actual payment is made or received. This is typically only for small businesses or specific categories with SARS approval.



### 5. Adjustments and Special Cases

* **Second-Hand Goods:** Your program should include a field for "notional input tax." If a vendor buys second-hand goods from a non-vendor, they may claim a deduction based on the tax fraction (15/115) of the price paid, provided specific records are kept.


* **Credit/Debit Notes:** If a slip is returned or the price changes, the program must generate an adjustment. A **Credit Note** issued requires an adjustment to decrease output tax, while a **Debit Note** increases it.


* 
**Bad Debts:** Logic should allow for an input tax deduction on taxable supplies that have been written off as irrecoverable after a period of 12 months.

For your business slips and payroll analysis program, the **SARS Guide for Employers in respect of Tax Deduction Tables (2025/2026)** provides the specific statutory rates, thresholds, and calculation logic required for the tax year ending **28 February 2026**.

### 1. Taxable Income Brackets & Rates (2025/26)

Your program should use these tiers to calculate the base tax (before rebates) for employees:

| Taxable Income (R) | Rates of Tax (R) |
| --- | --- |
| 1 – 237 100 | 18% of taxable income |
| 237 101 – 370 500 | 42 678 + 26% of taxable income above 237 100 |
| 370 501 – 512 800 | 77 362 + 31% of taxable income above 370 500 |
| 512 801 – 673 000 | 121 475 + 36% of taxable income above 512 800 |
| 673 001 – 857 900 | 179 147 + 39% of taxable income above 673 000 |
| 857 901 – 1 817 000 | 251 258 + 41% of taxable income above 857 900 |
| 1 817 001 and above | 644 489 + 45% of taxable income above 1 817 000 |

### 2. Rebates and Thresholds

These values must be deducted from the calculated tax.

* 
**Tax Rebates:** 


* 
**Primary (All individuals):** R17 235.


* 
**Secondary (65+ on last day of tax year):** R9 444.


* 
**Tertiary (75+ on last day of tax year):** R3 145.




* 
**Tax Thresholds (Annual Income below which no tax is payable):** 


* **Under 65:** R95 750.
* **65 to 74:** R148 217.
* **75 and older:** R165 689.



### 3. Medical Scheme Fees Tax Credit (Monthly)

If the employee pays medical aid contributions, apply these fixed monthly rebates:

* 
**Taxpayer:** R364.


* 
**First Dependent:** R364.


* 
**Each Additional Dependent:** R246.



### 4. Calculation Logic for Slips

Your program must follow this order of operations to determine the final tax deduction on a slip:

1. **Determine Gross Remuneration.**
2. 
**Subtract Allowable Deductions:** This includes pension fund, provident fund, and retirement annuity contributions.


3. 
**Calculate Base Tax:** Apply the brackets in Section 1 to the remaining balance.


4. 
**Deduct Rebates:** Apply the annual primary, secondary, or tertiary rebates (pro-rated for the pay period).


5. 
**Deduct Medical Credits:** Subtract the total monthly medical scheme fees tax credit based on the number of dependents.


6. 
**Final Deduction:** The resulting figure is the tax to be withheld for that period.



### 5. Implementation Rules for Employers

* 
**New Rate Timing:** Employers must implement these rates by no later than **1 April** of the tax year.


* 
**Under/Over Deductions:** If rates change after 1 March, over-deductions can be refunded immediately upon implementation. Under-deductions must be adjusted over the remainder of the tax year until 28 February.


* 
**Termination:** If an employee leaves after 1 March but before new rates are implemented, the deductions made under the previous year's rates are considered final.

For your business slips and payroll analysis program, the following technical specifications are extracted directly from the **SARS Guide for Employers in respect of Employees' Tax (2026 Tax Year)**.

These values apply to the tax year **1 March 2025 – 28 February 2026**.

### 1. Payroll Tax Calculation Constants (2026)

These are the hard-coded values your program must use to calculate the base tax liability.

#### A. Annual Tax Tables (Individuals & Special Trusts)

| Taxable Income (R) | Rate of Tax (R) |
| --- | --- |
| **0 – 237 100** | 18% of taxable income |
| **237 101 – 370 500** | 42 678 + 26% of income above 237 100 |
| **370 501 – 512 800** | 77 362 + 31% of income above 370 500 |
| **512 801 – 673 000** | 121 475 + 36% of income above 512 800 |
| **673 001 – 857 900** | 179 147 + 39% of income above 673 000 |
| **857 901 – 1 817 000** | 251 258 + 41% of income above 857 900 |
| **1 817 001 and above** | 644 489 + 45% of income above 1 817 000 |

#### B. Tax Rebates (Deduct from calculated tax)

Your program must deduct these annual amounts from the tax calculated above, pro-rated for the period worked.

* **Primary Rebate (All ages):** R17 235
* **Secondary Rebate (65+):** R9 444 (cumulative with primary)
* **Tertiary Rebate (75+):** R3 145 (cumulative with primary & secondary)

#### C. Tax Thresholds (Annual Income)

If annual equivalent income is below these amounts, **Tax = 0**.

* **Under 65:** R95 750
* **65 – 74:** R148 217
* **75 and older:** R165 689

---

### 2. Logic for Deductions & Credits

These rules determine the "Balance of Remuneration" upon which tax is calculated.

#### A. Medical Scheme Fees Tax Credit (Monthly)

Deduct this fixed amount from the final tax payable every month:

* **Main Member:** R364
* **First Dependent:** R364
* **Additional Dependents:** R246 each

#### B. Retirement Fund Contributions

Deductible from income **before** tax calculation.

* **Limit Logic:** The deduction is limited to the **lesser** of:
1. R350 000 per annum; OR
2. 27.5% of the greater of Remuneration OR Taxable Income.



#### C. Travel Allowance (Logbook Logic)

* **80% Rule:** By default, **80%** of the travel allowance must be included in taxable remuneration for PAYE calculation.
* **20% Rule:** If the employer is satisfied that at least 80% of the vehicle use is for business, only **20%** is included in taxable remuneration.
* **Simplified Rate:** 476 cents/km (where no other compensation is paid).

#### D. Subsistence Allowance (Deemed Expenditure)

Payments up to these limits are tax-free for business travel within SA:

* **Meals & Incidental Costs:** R570 per day
* **Incidental Costs Only:** R176 per day

---

### 3. Statutory Levies (SDL & UIF)

Your program must calculate these separately from PAYE.

| Levy | Rate | Logic & Limits |
| --- | --- | --- |
| **SDL** (Skills Development Levy) | **1%** of Leviable Amount | **Exempt** if total annual payroll < R500 000. Public service employers are also exempt. |
| **UIF** (Unemployment Insurance) | **1%** Employer + **1%** Employee | Calculated on remuneration up to a **limit of R17 712 per month** (annual limit R212 544). Remuneration above this cap attracts no further UIF. |

---

### 4. Critical IRP5/IT3(a) Source Codes

Use these codes to map transaction data in your program.

* **Income Codes:**
* **3601:** Standard Salary/Income (Taxable)
* **3605:** Annual Bonus/Payment
* **3606:** Commission
* **3701:** Travel Allowance
* **3810:** Medical Aid Fringe Benefit (Company Contribution)


* **Deduction Codes:**
* **4001:** Pension Fund Contributions
* **4003:** Provident Fund Contributions
* **4005:** Medical Aid Contributions (Employee + Employer)
* **4006:** Retirement Annuity Contributions


* **Tax Codes:**
* **4102:** PAYE calculated
* **4116:** Medical Scheme Fees Tax Credit taken into account
* **4141:** UIF Contribution (Employee + Employer)
* **4142:** SDL Contribution



### 5. Special Employment Logic

* **Non-Standard Employment:** If an employee works <22 hours a week and does not declare they have no other employment, deduct tax at a flat rate of **25%**.
* **Independent Contractors:** If an individual meets the "Independent Contractor" tests (Independence of office, control of hours/methods), no PAYE is deducted. Code **3616**.
* **Labour Brokers:** If a labour broker has a valid IRP30 exemption certificate, no PAYE is deducted (Code **3619**). If no certificate, deduct PAYE as per standard tables (Code **3617**).

Based on the **SARS Turnover Tax Leaflet**, here is the detailed logic, data structures, and compliance rules you can integrate into your slips analyzing program. This tax system is specifically designed for micro-businesses with a turnover of **R1 million or less**.

### 1. Program Logic: Tax System Switching

Your program needs a "Tax Regime" setting. If a business is flagged as a **Turnover Tax** entity, the program must disable standard tax calculations and enable specific Turnover Tax logic.

* **Logic Switch:** If `Regime == Turnover Tax`:
* **Disable:** Corporate Income Tax (CIT) calculations.
* **Disable:** Provisional Tax logic (Turnover Tax has its own interim payment system).
* 
**Disable:** Capital Gains Tax (CGT) logic (it is included in Turnover Tax).


* 
**Disable:** Dividends Tax logic (it is included in Turnover Tax).


* **Conditional VAT:** Prompt user. Turnover Tax replaces VAT *unless* the user voluntarily elects to remain in the VAT system (allowable if registered from March 2012).


* **Enable:** PAYE. (Turnover Tax **does not** replace PAYE; payroll tax must still be calculated for employees) .





### 2. Payment Deadlines & Calculation Cycle

The program must schedule three critical events in the financial year. Unlike standard Provisional Tax, these are based on "Interim Payments".

* **1st Interim Payment:**
* 
**Due Date:** Last business day of **August**.


* **Input Data:** Estimated taxable turnover for the *full* year.
* 
**Calculation:** `(Tax on Estimated Annual Turnover) / 2` [implied standard practice, leaflet mentions "based on estimate" ].




* **2nd Interim Payment:**
* 
**Due Date:** Last business day of **February**.


* **Input Data:** Revised estimated taxable turnover for the full year.
* 
**Calculation:** `(Tax on Full Year Estimate) - (Amount Paid in 1st Interim)`.




* **Final Return (TT03):**
* 
**Due Date:** Between 1 July and 31 January of the following year.


* **Input Data:** Actual audited turnover.
* **Calculation:** `(Tax on Actual Turnover) - (Sum of Interim Payments)`.



### 3. Penalty Algorithm (The 80% Rule)

Your program should include a risk alert system for the **2nd Interim Payment**. If the user underestimates their turnover, a penalty applies.

* 
**Trigger Condition:** Is `Estimated Turnover (2nd Payment) < 80% of Actual Turnover`?.


* **Penalty Calculation:**
* Calculate Tax A: Tax on 80% of Actual Turnover.
* Calculate Tax B: Tax on the Estimated Turnover submitted.
* 
**Penalty Amount:** `20% * (Tax A - Tax B)` .




* 
**Logic Exception:** Do not apply penalty if SARS issued an assessment for the payment due.



### 4. Database Schema Requirements (Record Keeping)

The leaflet specifies simplified record keeping, but your database must track specific thresholds for assets and liabilities to ensure compliance.

* 
**Transaction Table:** Must store "Records of all amounts received" (Turnover).


* 
**Dividends Table:** Must store "Records of dividends declared" (even though exempt from Dividends Tax, records are mandatory).


* **Asset Register:** Must flag assets with a cost price **> R10,000**.
* 
*Field Requirement:* `Asset_Cost > 10000`.




* **Liability Register:** Must flag liabilities outstanding at year-end **> R10,000**.
* 
*Field Requirement:* `Liability_Amount > 10000`.




* 
**Data Retention:** Set data archival policy to **5 years** from date of submission.



### 5. Interest Calculation Logic

If a user misses a deadline, your program should estimate interest liability.

* 
**Interest Start Date (1st Interim):** 1 September.


* 
**Interest Start Date (2nd Interim):** 1 March.


* 
**Interest End Date:** The earlier of the date payment is received OR the due date of the assessment .



**Would you like me to generate a specific SQL schema or Python class structure for the "Turnover Tax" module based on these rules?**