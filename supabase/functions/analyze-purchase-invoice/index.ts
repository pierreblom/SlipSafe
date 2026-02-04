/**
 * Edge Function to analyze purchase invoices using AI
 * Extracts vendor, invoice number, date, amounts, line items, etc.
 * 
 * Deploy with: supabase functions deploy analyze-purchase-invoice --no-verify-jwt
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        console.log("Purchase Invoice Analysis triggered");

        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

        if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
            throw new Error('Missing Supabase environment variables')
        }
        if (!geminiApiKey) {
            throw new Error('GEMINI_API_KEY is not set')
        }

        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing Authorization header')
        }

        const token = authHeader.replace('Bearer ', '').trim()

        // Verify user
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: { Authorization: authHeader }
            },
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        const { data: { user }, error: userError } = await userClient.auth.getUser()
        if (userError || !user) {
            throw new Error('Invalid session. Please sign out and sign in again.')
        }

        console.log("Authenticated user:", user.id);

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const formData = await req.formData()
        const file = formData.get('file')

        if (!file || !(file instanceof File)) {
            return new Response(JSON.stringify({ error: 'No file uploaded' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            })
        }

        const arrayBuffer = await file.arrayBuffer()
        const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''))

        // Calculate SHA-256 hash for duplicate detection
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
        const imageHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

        console.log("Image Hash:", imageHash);

        // Check for duplicates
        const { data: existingHash, error: hashError } = await supabase
            .from('purchase_invoices')
            .select('id, vendor_name, invoice_number, invoice_date, total')
            .eq('image_hash', imageHash)
            .maybeSingle()

        if (hashError) console.error("Hash Check Error:", hashError);

        if (existingHash) {
            console.log("Duplicate hash found:", existingHash.id);
            return new Response(JSON.stringify({
                error: 'Duplicate Invoice! This invoice has already been scanned.',
                duplicate_data: existingHash
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 409
            })
        }

        // AI Prompt for Purchase Invoice Analysis
        let prompt = `You are an AI assistant specialized in extracting information from purchase invoices and supplier bills.

TASK: Analyze this purchase invoice/supplier bill and extract the following information in JSON format:

{
  "vendor_name": "string (supplier/vendor company name)",
  "invoice_number": "string (invoice/bill reference number)",
  "invoice_date": "YYYY-MM-DD (date the invoice was issued)",
  "due_date": "YYYY-MM-DD or null (payment due date if present)",
  "subtotal": 0.00 (amount excluding VAT)",
  "vat": 0.00 (VAT/tax amount)",
  "total": 0.00 (total amount including VAT)",
  "vendor_vat_number": "string or null (vendor's VAT registration number)",
  "line_items": [
    {
      "description": "string",
      "quantity": 0,
      "unit_price": 0.00,
      "total": 0.00
    }
  ],
  "notes": "string or null (any additional notes, payment terms, or special instructions)",
  "currency": "ZAR or detected currency code"
}

INSTRUCTIONS:
- Extract ALL line items if they are listed
- Calculate subtotal, VAT, and total correctly
- If VAT is not shown separately but the total is VAT-inclusive (15%), back-calculate: subtotal = total / 1.15, vat = total - subtotal
- If no line items are visible, return empty array for line_items
- Look for vendor VAT number (may be labeled as VAT No, VAT Reg, Tax No, etc.)
- Extract payment terms or due date if visible
- Be accurate with amounts - double-check your calculations

Return ONLY the JSON object, wrapped in a markdown code block like:
\`\`\`json
{ ... }
\`\`\`
`;

        const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + geminiApiKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: file.type || 'image/png', data: base64 } }
                    ]
                }],
                generation_config: {}
            })
        })

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text()
            console.error("Gemini API Error:", geminiResponse.status, errorText);
            throw new Error('AI Analysis failed: ' + geminiResponse.status)
        }

        const geminiData = await geminiResponse.json()
        if (!geminiData.candidates || geminiData.candidates.length === 0) {
            throw new Error('AI Analysis Failed: No response from AI')
        }

        const resultText = geminiData.candidates[0].content.parts[0].text;
        const jsonMatch = resultText.match(/```json\n([\s\S]*?)\n```/);
        if (!jsonMatch || jsonMatch.length < 2) {
            throw new Error('AI Analysis Failed: Invalid response format');
        }

        let result;
        try {
            result = JSON.parse(jsonMatch[1]);
        } catch (e) {
            console.error("JSON Parse Error:", e.message);
            throw new Error('AI Analysis Failed: Could not parse AI response')
        }

        // Upload invoice image to storage
        const vendorName = result.vendor_name || "Unknown_Vendor"
        const fileName = `${user.id}/${Date.now()}_${vendorName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`

        console.log("Uploading to storage:", fileName);
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('receipt-proofs')
            .upload(fileName, file, { contentType: file.type, upsert: false })

        if (uploadError) {
            console.error("Storage Error:", uploadError);
            throw new Error('Failed to upload image: ' + uploadError.message)
        }

        // Prepare response data
        const responseData = {
            vendor_name: result.vendor_name || 'Unknown Vendor',
            invoice_number: result.invoice_number || 'INV-' + Date.now().toString().slice(-6),
            invoice_date: result.invoice_date || new Date().toISOString().split('T')[0],
            due_date: result.due_date || null,
            subtotal: parseFloat(result.subtotal) || 0,
            vat: parseFloat(result.vat) || 0,
            total: parseFloat(result.total) || 0,
            vendor_vat_number: result.vendor_vat_number || null,
            line_items: result.line_items || [],
            notes: result.notes || '',
            currency: result.currency || 'ZAR',
            image_url: uploadData.path,
            image_hash: imageHash
        };

        console.log("Analysis successful!");
        return new Response(JSON.stringify({ message: 'Success', data: responseData }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error) {
        console.error("Function Error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        })
    }
})
