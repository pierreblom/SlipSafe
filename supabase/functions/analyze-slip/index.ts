import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const formData = await req.formData()
        const file = formData.get('file')

        if (!file) {
            return new Response(
                JSON.stringify({ error: 'No file uploaded' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        const apiKey = Deno.env.get('GEMINI_API_KEY')
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not set')
        }

        // 1. Convert File to Base64 for Gemini
        const arrayBuffer = await file.arrayBuffer()
        const base64 = btoa(
            new Uint8Array(arrayBuffer)
                .reduce((data, byte) => data + String.fromCharCode(byte), '')
        )

        // 2. Call Gemini AI
        const prompt = `Analyze this South African receipt. Return JSON only: { "merchant": "name", "total": 0.00, "vat": 0.00, "date": "YYYY-MM-DD", "vatNumber": "string or null", "isTaxInvoice": boolean }. If restaurant, suggest 'Entertainment'. If total > 5000 and no vatNumber, isTaxInvoice is false.`

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type || 'image/png', data: base64 } }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        })

        const geminiData = await geminiResponse.json()
        if (!geminiData.candidates) {
            throw new Error('AI Analysis Failed')
        }

        const result = JSON.parse(geminiData.candidates[0].content.parts[0].text)

        // 3. Initialize Supabase Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseKey)

        // 4. Upload Image to Storage
        const fileName = `${Date.now()}_${result.merchant.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('receipt-proofs')
            .upload(fileName, file, {
                contentType: file.type,
                upsert: false
            })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
            .from('receipt-proofs')
            .getPublicUrl(fileName)

        // 5. Save to Database
        // Create fingerprint
        const fingerprint = `${result.merchant}|${result.date}|${result.total}`

        // Check for duplicate
        const { data: existing } = await supabase
            .from('slips')
            .select('id')
            .eq('fingerprint', fingerprint)
            .single()

        if (existing) {
            return new Response(
                JSON.stringify({ error: 'Duplicate Slip! You have already scanned this.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
            )
        }

        const slipData = {
            merchant: result.merchant,
            total: result.total,
            vat: result.vat,
            category: result.category || (result.merchant.toLowerCase().match(/cafe|restaurant|coffee|mug|bean|spur|nando/) ? "Entertainment" : "General Business"),
            date: result.date,
            vat_number: result.vatNumber,
            is_tax_invoice: result.isTaxInvoice,
            image_url: publicUrl,
            fingerprint: fingerprint
        }

        const { data: dbData, error: dbError } = await supabase
            .from('slips')
            .insert([slipData])
            .select()
            .single()

        if (dbError) throw dbError

        return new Response(
            JSON.stringify({ message: 'Success', data: dbData }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
