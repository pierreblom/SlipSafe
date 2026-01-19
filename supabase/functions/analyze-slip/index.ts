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

        // Build enhanced prompt with business context
        let prompt = 'Act as a South African Tax Specialist. ';

        if (businessContext) {
            prompt += `You are analyzing a receipt for a ${businessContext.label} business in South Africa.\n\n`;
            prompt += `Business Context:\n`;
            prompt += `- Common deductible expenses for this business: ${businessContext.commonExpenses}\n`;
            prompt += `- NOT deductible for this business: ${businessContext.nonDeductible}\n`;
            prompt += `- SARS tax rules apply\n\n`;
        }

        prompt += 'Analyze the provided image of a business slip or invoice. Extract the following fields into a JSON format: { "supplier_name": "string", "supplier_vat_number": "string or null", "supplier_address": "string or null", "date": "YYYY-MM-DD", "invoice_number": "string or null", "description": "string or null", "total_amount_inclusive": 0.00, "vat_amount": 0.00, "recipient_name": "string or null", "recipient_vat_number": "string or null", "recipient_address": "string or null", "volume_quantity": "string or null", "category": "string", "is_deductible": boolean, "vat_claimable": boolean, "compliance_status": "Valid | Invalid | Incomplete", "missing_fields": ["string"], "reason": "string" } ';

        prompt += '\n\nValidation Logic (SARS 2025/26): 1. Document Type: Ensure the words "Tax Invoice", "VAT Invoice", or "Invoice" are present. 2. If Total <= R50: Mark as Sufficient. 3. If R50 < Total <= R5,000: Check for Abridged Tax Invoice requirements. 4. If Total > R5,000: Check for Full Tax Invoice requirements. ';

        if (businessContext) {
            prompt += '\n\nTax Deductibility (Business-Specific): ';
            prompt += '1. Determine if this expense is typical for a ' + businessContext.label + ' business. ';
            prompt += '2. Check if it matches common expenses: ' + businessContext.commonExpenses + '. ';
            prompt += '3. Verify it is NOT a personal expense like: ' + businessContext.nonDeductible + '. ';
            prompt += '4. Apply SARS rules: Entertainment has 50% limit (but mark as deductible), personal items are NOT deductible. ';
        } else {
            prompt += '\n\nTax Deductibility: 1. General Deduction Formula. 2. Small Item Write-Off (< R7,000). 3. Entertainment Denial (mark as deductible but note 50% rule). 4. Motor Car Denial. ';
        }

        if (businessContext) {
            prompt += '\n\nCategory Selection (Business-Specific): ';
            prompt += 'Based on the receipt and the business type (' + businessContext.label + '), select the MOST APPROPRIATE category from: General Business, Entertainment, Travel, Stock, Utilities. ';
            prompt += 'Examples: ';
            prompt += '- Food suppliers for Catering business = Stock ';
            prompt += '- Petrol for Transport business = Travel ';
            prompt += '- Office supplies for any business = General Business ';
            prompt += '- Internet/electricity = Utilities ';
            prompt += '- Client meals/events = Entertainment ';
        } else {
            prompt += '\n\nCategory Options: General Business, Entertainment, Travel, Stock, Utilities.';
        }

        const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=' + geminiApiKey, {
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

        console.log("Success!");
        return new Response(JSON.stringify({ message: 'Success', data: dbData }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    } catch (error) {
        console.error("Function Error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }
})