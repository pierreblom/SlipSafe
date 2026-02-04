# Purchase Invoice Scanner Implementation

## Overview
The Purchase Invoice feature has been converted from a manual entry form to an AI-powered scanner, similar to the receipt scanner. Users can now upload images of supplier invoices, and AI will automatically extract all the information.

## How It Works

### 1. User Flow
1. **Click "Purchase Invoice"** button in Business Hub
2. **Upload Invoice Image** - supports JPG, PNG, PDF
3. **AI Extraction** - Gemini AI analyzes the image and extracts:
   - Vendor/Supplier name
   - Invoice number
   - Invoice date  
   - Due date
  - Subtotal (excl VAT)
   - VAT amount
   - Total amount
   - Line items (description, quantity, price)
   - Vendor VAT number
   - Payment terms/notes

4. **Auto-Save** - Data is saved to the `purchase_invoices` database table
5. **View & Manage** - View in "Recent Purchase Invoices" section

### 2. Database Schema
You need to create a `purchase_invoices` table with the following structure:

```sql
CREATE TABLE purchase_invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vendor_name TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    subtotal DECIMAL(10, 2) DEFAULT 0,
    vat DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    vendor_vat_number TEXT,
    line_items JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'overdue')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX idx_purchase_invoices_user_id ON purchase_invoices(user_id);
CREATE INDEX idx_purchase_invoices_status ON purchase_invoices(status);
CREATE INDEX idx_purchase_invoices_date ON purchase_invoices(invoice_date DESC);

-- Enable Row Level Security
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own purchase invoices
CREATE POLICY "Users can view own purchase invoices" 
    ON purchase_invoices FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchase invoices" 
    ON purchase_invoices FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own purchase invoices" 
    ON purchase_invoices FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own purchase invoices" 
    ON purchase_invoices FOR DELETE 
    USING (auth.uid() = user_id);
```

### 3. Edge Function Deployment
The AI analysis is handled by a Supabase Edge Function. Deploy it with:

```bash
cd /Users/pierre/Documents/SlipSave
supabase functions deploy analyze-purchase-invoice --no-verify-jwt
```

**Important**: The `--no-verify-jwt` flag is required because we handle JWT verification manually in the function code.

### 4. Files Created/Modified

#### New Files:
- `/front_end/purchase_invoice_scanner.js` - Purchase invoice scanning logic
- `/supabase/functions/analyze-purchase-invoice/index.ts` - AI analysis Edge Function

#### Modified Files:
- `/front_end/app.js` - Updated Purchase Invoice modal to scan mode
- `/index.html` - Added purchase_invoice_scanner.js script

## Features

### Automated Extraction
- **Vendor Information**: Company name, VAT number
- **Financial Details**: Subtotal, VAT (15%), Total
- **Line Items**: Description, quantity, unit price, item total
- **Dates**: Invoice date, due date, payment terms
- **Smart Calculations**: If VAT isn't shown separately, AI calculates it from VAT-inclusive totals

### Invoice Management
- **View Invoices**: See all purchase invoices with vendor, date, amount, status
- **Mark as Paid**: Update invoice status
- **Delete**: Remove invoices
- **Image Preview**: View original invoice image

### Status Tracking
Three statuses are supported:
- `unpaid` - Default for new invoices
- `paid` - Manually marked as paid
- `overdue` - Can be set manually or by automation

## Testing

1. **Upload a Test Invoice**:
   - Click "Purchase Invoice" button
   - Upload an image of a supplier invoice
   - Wait for AI analysis (~2-5 seconds)

2. **Verify Extraction**:
   - Check that vendor name is correct
   - Verify amounts match (subtotal + VAT = total)
   - Ensure line items are extracted

3. **View & Manage**:
   - Click on invoice in list to view details
   - Test "Mark as Paid" button
   - Test delete functionality

## Future Enhancements

Possible improvements:
1. **PDF Support**: Enhanced PDF parsing
2. **Bulk Upload**: Upload multiple invoices at once
3. **Payment Reminders**: Notifications for overdue invoices
4. **Expense Categories**: Categorize purchases for accounting
5. **Export to Accounting**: Integration with accounting software
6. **Receipt Matching**: Link purchase invoices to payment receipts

## Troubleshooting

### AI Analysis Fails
- Check that GEMINI_API_KEY is set in Supabase Edge Functions
- Verify image is clear and readable
- Ensure invoice has standard format

### Database Errors
- Verify `purchase_invoices` table exists
- Check Row Level Security policies are active
- Confirm user is authenticated

### Upload Fails  
- Check storage bucket `receipt-proofs` exists
- Verify bucket has correct permissions
- Ensure file size is under limit (10MB recommended)

## Summary

The Purchase Invoice feature now provides a seamless way to digitize and track supplier invoices:
1. **Scan** - Upload invoice image
2. **Extract** - AI pulls out all details
3. **Save** - Auto-saved to database
4. **Track** - Monitor payment status

This matches the workflow users already know from the receipt scanner, making it intuitive and easy to use.
