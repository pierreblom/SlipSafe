# SlipSafe System Architecture & Process Flow Prompt

**Goal:** Create a high-quality, modern system architecture diagram or infographic that visualizes how the SlipSafe application processes receipts using AI.

**Visual Style:**
*   **Theme:** Professional, Fintech, Modern, Secure.
*   **Colors:** Deep Navy Blue (`#0f172a`), Clean White, Emerald Green (for success/money), and subtle glowing accents (Blue/Purple for AI).
*   **Style:** Isometric or Flat 2.0 with Glassmorphism elements. Clean lines, distinct icons, and clear data flow arrows.

---

## Diagram Components & Flow (Step-by-Step)

### 1. The Input (User Action)
*   **Visual:** A smartphone with the SlipSafe app open, taking a photo of a crumpled paper receipt.
*   **Label:** "Smart Scan"
*   **Sub-text:** "Image Compression & Encryption"

### 2. The Secure Gateway (Supabase Edge Function)
*   **Visual:** A central, shield-shaped cloud node acting as the traffic controller.
*   **Label:** "Secure Edge Function"
*   **Key Tasks (represented as small icons/text inside):**
    *   Auth Verification (Lock icon)
    *   Business Context Injection (Briefcase icon)
    *   Duplicate Detection (Fingerprint icon)

### 3. The AI Brain (Google Gemini Integration)
*   **Visual:** A glowing, futuristic AI chip or brain node connected to the Gateway.
*   **Label:** "Gemini 1.5 Flash AI"
*   **Process Visualization:**
    *   Input: Raw Receipt Image
    *   Processing: "SARS Tax Logic" + "OCR Extraction" + "Categorization"
    *   Output: Structured JSON Data

### 4. The Data Core (Supabase Backend)
*   **Visual:** A robust database cluster split into two parts:
    *   **Storage:** A secure vault icon holding the "Receipt Image".
    *   **Database:** A cylinder icon holding the "Slip Data" (Merchant, Total, VAT, Category).

### 5. The Result (User Dashboard)
*   **Visual:** A clean, organized dashboard screen on a laptop or tablet.
*   **Content:**
    *   The digital version of the slip.
    *   Badges showing: "Tax Deductible", "VAT Claimable", "Compliance Verified".
*   **Label:** "Tax-Ready Record"

---

## Data Flow Description (for the arrow paths)

1.  **User** uploads/scans receipt -> **Frontend** compresses & secures it.
2.  **Frontend** sends data to -> **Edge Function**.
3.  **Edge Function** injects "Business Type" context and sends to -> **Gemini AI**.
4.  **Gemini AI** applies "SARS Rules", extracts data, and returns -> **Analysis**.
5.  **Edge Function** saves Image to **Storage** and Data to **Database**.
6.  **System** returns final result to -> **User Dashboard**.

---

## Prompt for Image Generation (Copy & Paste)

> Create a professional, isometric system architecture diagram for a Fintech app called "SlipSafe". The diagram should flow from left to right.
>
> **Left:** A user scanning a paper receipt with a smartphone.
> **Middle-Left:** A "Secure Edge Gateway" node (shield icon) receiving the data.
> **Top-Middle:** A glowing "Gemini AI" node connected to the Gateway, processing "OCR" and "Tax Logic".
> **Bottom-Middle:** A "Supabase" database cluster storing the image and data.
> **Right:** A clean dashboard interface showing the digitized, analyzed receipt with "Tax Deductible" badges.
>
> **Style:** Modern tech, deep blue background, glowing data streams connecting the nodes, glassmorphism effects, high resolution, 8k, vector art style.
