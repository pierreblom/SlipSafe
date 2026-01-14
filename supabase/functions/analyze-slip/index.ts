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
        console.log("Function triggered");

        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

        if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
            console.error("Missing env vars");
            throw new Error('Missing Supabase environment variables (URL/Anon Key/Service Key)')
        }
        if (!geminiApiKey) {
            console.error("Missing Gemini API Key");
            throw new Error('GEMINI_API_KEY is not set in Supabase secrets')
        }

        // 1. Get User from Auth Header
        const authHeader = req.headers.get('Authorization')
        console.log("Auth Header present:", !!authHeader);

        if (!authHeader) {
            throw new Error('Missing Authorization header')
        }

        // Create a client with the user's token to verify them
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        const { data: { user }, error: userError } = await userClient.auth.getUser()
        if (userError || !user) {
            console.error("Auth Error:", userError);
            throw new Error('Invalid user session: ' + (userError?.message || 'User not found'))
        }
        console.log("User verified:", user.id);

        // 2. Process File
        const formData = await req.formData()
        const file = formData.get('file')

        if (!file || !(file instanceof File)) {
            console.error("Invalid file upload");
            return new Response(
                JSON.stringify({ error: 'No file uploaded or invalid file format' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }
        console.log("File received:", file.name, file.type, file.size);

        // Convert File to Base64 for Gemini
        const arrayBuffer = await file.arrayBuffer()
        const base64 = btoa(
            new Uint8Array(arrayBuffer)
                .reduce((data, byte) => data + String.fromCharCode(byte), '')
        )

        // 3. Call Gemini AI
        console.log("Calling Gemini AI...");
        const prompt = `Analyze this South African receipt. Return JSON only: { "merchant": "name", "total": 0.00, "vat": 0.00, "date": "YYYY-MM-DD", "vatNumber": "string or null", "isTaxInvoice": boolean }. If restaurant, suggest 'Entertainment'. If total > 5000 and no vatNumber, isTaxInvoice is false.`

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type || 'image/png', data: base64 } }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        })

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text()
            console.error("Gemini API Error:", geminiResponse.status, errorText);
            throw new Error(`Gemini API error: ${geminiResponse.status} ${errorText}`)
        }

        const geminiData = await geminiResponse.json()
        if (!geminiData.candidates || geminiData.candidates.length === 0) {
            console.error("Gemini No Candidates:", geminiData);
            throw new Error('AI Analysis Failed: No candidates returned')
        }

        const resultText = geminiData.candidates[0].content.parts[0].text
        console.log("Gemini Result:", resultText);
        const result = JSON.parse(resultText)

        // 4. Initialize Service Role Client for Storage and DB
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 5. Upload Image to Storage
        const fileName = `${user.id}/${Date.now()}_${result.merchant.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`
        console.log("Uploading to storage:", fileName);
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('receipt-proofs')
            .upload(fileName, file, {
                contentType: file.type,
                upsert: false
            })

        if (uploadError) {
            console.error("Storage Error:", uploadError);
            throw new Error('Storage upload failed: ' + uploadError.message)
        }

        const { data: { publicUrl } } = supabase.storage
            .from('receipt-proofs')
            .getPublicUrl(fileName)

        // 6. Save to Database
        const fingerprint = `${user.id}|${result.merchant}|${result.date}|${result.total}`
        console.log("Checking duplicate with fingerprint:", fingerprint);

        // Check for duplicate
        const { data: existing } = await supabase
            .from('slips')
            .select('id')
            .eq('fingerprint', fingerprint)
            .single()

        if (existing) {
            console.log("Duplicate found:", existing.id);
            return new Response(
                JSON.stringify({ error: 'Duplicate Slip! You have already scanned this.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
            )
        }

        const slipData = {
            user_id: user.id,
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

        console.log("Inserting into DB...");
        const { data: dbData, error: dbError } = await supabase
            .from('slips')
            .insert([slipData])
            .select()
            .single()

        if (dbError) {
            console.error("DB Error:", dbError);
            throw new Error('Database insert failed: ' + dbError.message)
        }

        console.log("Success!");
        return new Response(
            JSON.stringify({ message: 'Success', data: dbData }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error: any) {
        console.error("Function Error:", error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
