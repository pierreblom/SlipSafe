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
        console.log("Function triggered");

        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

        if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
            console.error("Missing env vars");
            throw new Error('Missing Supabase environment variables')
        }
        if (!geminiApiKey) {
            console.error("Missing Gemini API Key");
            throw new Error('GEMINI_API_KEY is not set')
        }

        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing Authorization header')

        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        const { data: { user }, error: userError } = await userClient.auth.getUser()
        if (userError || !user) {
            console.error("Auth Error:", userError?.message || "User not found");
            throw new Error('Invalid user session: ' + (userError?.message || 'User not found'))
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const formData = await req.formData()
        const file = formData.get('file')

        if (!file || !(file instanceof File)) {
            console.error("Invalid file upload");
            return new Response(JSON.stringify({ error: 'No file uploaded' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
        }

        const arrayBuffer = await file.arrayBuffer()
        const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''))

        const prompt = 'Act as a South African Tax Specialist. Analyze the provided image of a business slip or invoice. Extract the following fields into a JSON format: { "supplier_name": "string", "supplier_vat_number": "string or null", "supplier_address": "string or null", "date": "YYYY-MM-DD", "invoice_number": "string or null", "description": "string or null", "total_amount_inclusive": 0.00, "vat_amount": 0.00, "recipient_name": "string or null", "recipient_vat_number": "string or null", "recipient_address": "string or null", "volume_quantity": "string or null", "category": "string", "is_deductible": boolean, "vat_claimable": boolean, "compliance_status": "Valid | Invalid | Incomplete", "missing_fields": ["string"], "reasoning": "string" } Validation Logic (SARS 2025/26): 1. Document Type: Ensure the words "Tax Invoice", "VAT Invoice", or "Invoice" are present. 2. If Total <= R50: Mark as Sufficient. 3. If R50 < Total <= R5,000: Check for Abridged Tax Invoice requirements. 4. If Total > R5,000: Check for Full Tax Invoice requirements. Tax Deductibility: 1. General Deduction Formula. 2. Small Item Write-Off (< R7,000). 3. Entertainment Denial. 4. Motor Car Denial. Category Options: General Business, Entertainment, Travel, Stock, Utilities.';

        const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + geminiApiKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type || 'image/png', data: base64 } }] }],
                generation_config: {
                    response_mime_type: "application/json"
                }
            })
        })

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text()
            console.error("Gemini API Error Status:", geminiResponse.status);
            console.error("Gemini API Error Body:", errorText);
            throw new Error('Gemini API error: ' + geminiResponse.status + ' - ' + errorText)
        }

        const geminiData = await geminiResponse.json()
        if (!geminiData.candidates || geminiData.candidates.length === 0) {
            console.error("Gemini No Candidates:", JSON.stringify(geminiData));
            throw new Error('AI Analysis Failed: No candidates returned from Gemini')
        }

        const resultText = geminiData.candidates[0].content.parts[0].text
        console.log("Gemini Raw Result:", resultText);

        let result;
        try {
            result = JSON.parse(resultText)
        } catch (e) {
            console.error("JSON Parse Error:", (e as Error).message, "Raw text:", resultText);
            throw new Error('AI Analysis Failed: Invalid JSON returned from AI')
        }

        const merchantName = result.supplier_name || result.merchant || "Unknown Merchant"
        const fileName = user.id + "/" + Date.now() + "_" + merchantName.replace(/[^a-z0-9]/gi, '_').toLowerCase() + ".png"
        console.log("Uploading to storage:", fileName);
        const { data: uploadData, error: uploadError } = await supabase.storage.from('receipt-proofs').upload(fileName, file, { contentType: file.type, upsert: false })
        if (uploadError) {
            console.error("Storage Error:", uploadError);
            throw new Error('Storage upload failed: ' + uploadError.message)
        }

        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
        const imageHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
        const total = result.total_amount_inclusive || result.total || 0
        const date = result.date || new Date().toISOString().split('T')[0]
        const fingerprint = user.id + "|" + merchantName.trim().toLowerCase() + "|" + date + "|" + total

        console.log("Checking duplicate with fingerprint:", fingerprint);
        const { data: existingFingerprint, error: fingerError } = await supabase.from('slips').select('id').eq('fingerprint', fingerprint).maybeSingle()
        if (fingerError) console.error("Fingerprint Check Error:", fingerError);
        if (existingFingerprint) {
            console.log("Duplicate fingerprint found:", existingFingerprint.id);
            return new Response(JSON.stringify({ error: 'Duplicate Slip! You have already scanned this receipt.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 })
        }

        console.log("Checking duplicate with hash:", imageHash);
        const { data: existingHash, error: hashError } = await supabase.from('slips').select('id').eq('image_hash', imageHash).maybeSingle()
        if (hashError) console.error("Hash Check Error:", hashError);
        if (existingHash) {
            console.log("Duplicate hash found:", existingHash.id);
            return new Response(JSON.stringify({ error: 'Duplicate Slip! This image has already been uploaded.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 })
        }

        const slipData = {
            user_id: user.id,
            merchant: merchantName,
            total: total,
            vat: result.vat_amount || result.vat || 0,
            category: result.category || "General Business",
            date: date,
            vat_number: result.supplier_vat_number || result.vatNumber,
            is_tax_invoice: result.compliance_status === 'Valid' || result.compliance_status === 'Sufficient' || result.isTaxInvoice || false,
            is_tax_deductible: result.is_deductible ?? result.isTaxDeductible ?? false,
            notes: result.reasoning || result.notes,
            image_url: uploadData.path,
            fingerprint: fingerprint,
            image_hash: imageHash,
            supplier_address: result.supplier_address,
            invoice_number: result.invoice_number,
            description: result.description,
            recipient_name: result.recipient_name,
            recipient_vat_number: result.recipient_vat_number,
            recipient_address: result.recipient_address,
            volume_quantity: result.volume_quantity,
            compliance_status: result.compliance_status,
            missing_fields: Array.isArray(result.missing_fields) ? result.missing_fields : (result.missing_fields ? [result.missing_fields] : []),
            reasoning: result.reasoning
        }

        console.log("Inserting into DB:", JSON.stringify(slipData));
        const { data: dbData, error: dbError } = await supabase.from('slips').insert([slipData]).select().single()
        if (dbError) {
            console.error("DB Error:", dbError);
            throw new Error('Database insert failed: ' + dbError.message)
        }

        console.log("Success!");
        return new Response(JSON.stringify({ message: 'Success', data: dbData }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    } catch (error) {
        console.error("Function Error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }
})
