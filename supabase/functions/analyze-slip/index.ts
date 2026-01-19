/**
 * IMPORTANT: This function must be deployed with --no-verify-jwt flag
 * because we handle JWT verification manually in the code below.
 * 
 * Deploy with: supabase functions deploy analyze-slip --no-verify-jwt
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
        if (!authHeader) {
            console.error("Missing Authorization header");
            throw new Error('Missing Authorization header. Please sign in again.')
        }

        // Extract the JWT token from the Authorization header
        const token = authHeader.replace('Bearer ', '').trim()
        console.log("Token received (first 20 chars):", token.substring(0, 20) + "...");

        // Create client with anon key and pass the token in headers
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: authHeader
                }
            },
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        // Verify the user
        const { data: { user }, error: userError } = await userClient.auth.getUser()
        if (userError || !user) {
            console.error("Auth Error Details:", {
                message: userError?.message,
                status: userError?.status,
                name: userError?.name
            });
            // Provide more specific error messages
            if (userError?.message?.includes('JWT') || userError?.message?.includes('token') || userError?.message?.includes('expired') || userError?.message?.includes('invalid')) {
                throw new Error('Invalid JWT: Your session has expired. Please sign out and sign in again.')
            }
            throw new Error('Invalid user session: ' + (userError?.message || 'User not found') + '. Please sign in again.')
        }

        console.log("Authenticated user:", user.id, user.email);

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const formData = await req.formData()
        const file = formData.get('file')

        if (!file || !(file instanceof File)) {
            console.error("Invalid file upload");
            return new Response(JSON.stringify({ error: 'No file uploaded' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
        }

        const arrayBuffer = await file.arrayBuffer()
        const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''))

        // Get user's business type from metadata
        const businessType = user.user_metadata?.business_type || null;

        // Business type context mapping
        const businessContextMap: { [key: string]: { label: string; commonExpenses: string; nonDeductible: string } } = {
            'accommodation': {
                label: 'Accommodation (Airbnb, Guest Houses, Hotels, B&Bs)',
                commonExpenses: 'Bedding, cleaning supplies, guest amenities, Wi-Fi, toiletries',
                nonDeductible: 'Personal groceries, family meals, personal entertainment'
            },
            'catering': {
                label: 'Catering & Food (Restaurants, Coffee Shops, Spas)',
                commonExpenses: 'Kitchen equipment, food stock, uniforms, cleaning supplies, packaging',
                nonDeductible: 'Personal dining, family meals, personal entertainment'
            },
            'professional': {
                label: 'Professional Services (Lawyers, Accountants, Consultants)',
                commonExpenses: 'Office rent, laptops, software, professional fees, stationery',
                nonDeductible: 'Personal clothing, gym memberships, personal education'
            },
            'tech': {
                label: 'Tech & Info (IT Support, Web Design, Software)',
                commonExpenses: 'Servers, software subscriptions, internet, hardware, cloud services',
                nonDeductible: 'Personal devices, home entertainment, personal software'
            },
            'education': {
                label: 'Education (Tutors, Preschools, Training Centers)',
                commonExpenses: 'Books, stationery, classroom supplies, teaching materials, educational software',
                nonDeductible: 'Personal education, family courses, personal books'
            },
            'construction': {
                label: 'Construction (Builders, Plumbers, Electricians)',
                commonExpenses: 'Tools, safety gear (PPE), building materials, vehicle fuel, equipment',
                nonDeductible: 'Personal tools, home improvements for personal use'
            },
            'retail': {
                label: 'Retail & Trade (Spaza Shops, Online Stores, Boutiques)',
                commonExpenses: 'Stock for resale, packaging, delivery costs, POS systems, shelving',
                nonDeductible: 'Personal shopping, family items, personal clothing'
            },
            'manufacturing': {
                label: 'Manufacturing (Furniture Making, Clothing Factories)',
                commonExpenses: 'Raw materials, machinery, factory supplies, safety equipment, tools',
                nonDeductible: 'Personal purchases, home goods, personal equipment'
            },
            'personal_services': {
                label: 'Personal Services (Hairdressers, Spas, Garden Services)',
                commonExpenses: 'Equipment, beauty products, petrol for client visits, supplies',
                nonDeductible: 'Personal grooming, family services, personal beauty products'
            },
            'transport': {
                label: 'Transport (Uber/Bolt, Logistics, Deliveries)',
                commonExpenses: 'Vehicle repairs, petrol, insurance, GPS, safety equipment, car wash',
                nonDeductible: 'Personal travel, family trips, personal vehicle maintenance'
            }
        };

        const businessContext = businessType && businessContextMap[businessType]
            ? businessContextMap[businessType]
            : null;

        // Build SARS-smart prompt with item-level analysis
        let prompt = 'You are a South African Tax Specialist AI. Your job is to analyze receipts and determine EXACTLY what can be claimed for VAT and Income Tax purposes.\n\n';

        if (businessContext) {
            prompt += `BUSINESS CONTEXT:\n`;
            prompt += `- Business Type: ${businessContext.label}\n`;
            prompt += `- Common business expenses: ${businessContext.commonExpenses}\n`;
            prompt += `- NOT business expenses: ${businessContext.nonDeductible}\n\n`;
        }

        prompt += `CRITICAL SARS RULES:\n`;
        prompt += `1. PERSONAL ITEMS = NEVER CLAIMABLE (beds, bedding, personal clothing, toiletries for home, groceries for family)\n`;
        prompt += `2. RESTAURANT/FOOD = NO VAT claim, but 50% Income Tax deduction IF it was client entertainment\n`;
        prompt += `3. OFFICE EQUIPMENT = Fully claimable (desks, chairs, computers, printers, stationery)\n`;
        prompt += `4. STOCK FOR RESALE = Fully claimable\n`;
        prompt += `5. PETROL/VEHICLE = Claimable if for business use\n`;
        prompt += `6. ASSETS > R7,000 = Must be depreciated, not immediately deducted\n\n`;

        prompt += `TASK: Analyze the receipt image and return JSON with these fields:\n`;
        prompt += `{\n`;
        prompt += `  "supplier_name": "string",\n`;
        prompt += `  "date": "YYYY-MM-DD",\n`;
        prompt += `  "total_amount_inclusive": 0.00,\n`;
        prompt += `  "vat_amount": 0.00,\n`;
        prompt += `  "supplier_vat_number": "string or null",\n`;
        prompt += `  "category": "General Business | Entertainment | Travel | Stock | Utilities",\n`;
        prompt += `  "is_deductible": boolean,\n`;
        prompt += `  "vat_claimable": boolean,\n`;
        prompt += `  "vat_claimable_amount": 0.00,\n`;
        prompt += `  "income_tax_deductible_amount": 0.00,\n`;
        prompt += `  "personal_amount": 0.00,\n`;
        prompt += `  "compliance_status": "Valid | Invalid | Incomplete",\n`;
        prompt += `  "claim_summary": "Human-readable explanation of what can be claimed and why",\n`;
        prompt += `  "item_analysis": "Brief description of main items and their claimability"\n`;
        prompt += `}\n\n`;

        prompt += `CALCULATION RULES:\n`;
        prompt += `- vat_claimable_amount: The VAT portion of BUSINESS items only (NOT personal items, NOT restaurant food)\n`;
        prompt += `- income_tax_deductible_amount: Full amount for business items, 50% for entertainment/restaurants, 0 for personal\n`;
        prompt += `- personal_amount: Any items that are personal/home use = NOT claimable\n`;
        prompt += `- is_deductible: true ONLY if income_tax_deductible_amount > 0\n`;
        prompt += `- vat_claimable: true ONLY if vat_claimable_amount > 0\n\n`;

        prompt += `EXAMPLES:\n`;
        prompt += `- PEP (bedding/clothing for home) → personal_amount = full total, vat_claimable_amount = 0, claim_summary = "Personal household items cannot be claimed"\n`;
        prompt += `- Spur (restaurant) → vat_claimable_amount = 0, income_tax_deductible_amount = 50% of total (if client entertainment), claim_summary = "Restaurant meals: No VAT claim. 50% deductible for Income Tax if client entertainment"\n`;
        prompt += `- Makro (office supplies) → vat_claimable_amount = full VAT, income_tax_deductible_amount = full total, claim_summary = "Office supplies fully claimable"\n`;
        prompt += `- Engen (petrol) → vat_claimable_amount = full VAT, income_tax_deductible_amount = full total (if business travel), claim_summary = "Petrol for business travel is fully claimable"\n\n`;

        prompt += `Validation (SARS 2025/26): Check if document is a valid Tax Invoice. For Total <= R50: Sufficient. For R50 < Total <= R5,000: Abridged Tax Invoice. For Total > R5,000: Full Tax Invoice requirements.\n`;

        const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=' + geminiApiKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type || 'image/png', data: base64 } }] }],
                generation_config: {}
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

        const resultText = geminiData.candidates[0].content.parts[0].text;
        const jsonMatch = resultText.match(/```json\n([\s\S]*?)\n```/);
        if (!jsonMatch || jsonMatch.length < 2) {
            throw new Error('AI Analysis Failed: No valid JSON block found in Gemini response.');
        }
        let result;
        try {
            result = JSON.parse(jsonMatch[1]);
        } catch (e) {
            console.error("JSON Parse Error:", (e as Error).message, "Raw text:", resultText);
            throw new Error('AI Analysis Failed: Invalid JSON returned from AI. Raw response: ' + resultText)
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
            notes: Array.isArray(result.notes) ? result.notes : (result.notes ? [result.notes] : []), // Ensure notes is an array
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
            missing_fields: Array.isArray(result.missing_fields) ? result.missing_fields : (result.missing_fields ? [result.missing_fields] : [])
            // reason: result.reason // Removed: Column does not exist in DB schema
        }

        console.log("Inserting into DB:", JSON.stringify(slipData));
        const { data: dbData, error: dbError } = await supabase.from('slips').insert([slipData]).select().single()
        if (dbError) {
            console.error("DB Error:", dbError);
            throw new Error('Database insert failed: ' + dbError.message)
        }

        // Include SARS analysis fields in response (not stored in DB but needed for frontend)
        const responseData = {
            ...dbData,
            vat_claimable_amount: result.vat_claimable_amount || 0,
            income_tax_deductible_amount: result.income_tax_deductible_amount || 0,
            personal_amount: result.personal_amount || 0,
            claim_summary: result.claim_summary || "",
            item_analysis: result.item_analysis || ""
        };

        console.log("Success!");
        return new Response(JSON.stringify({ message: 'Success', data: responseData }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    } catch (error) {
        console.error("Function Error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }
})