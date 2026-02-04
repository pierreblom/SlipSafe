/**
 * Yoco Checkout Edge Function
 * Creates a checkout session for payment processing
 * 
 * Deploy with: supabase functions deploy yoco-checkout --no-verify-jwt
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckoutRequest {
    amount: number;           // Amount in cents (e.g., 10000 = R100.00)
    currency?: string;        // Default: ZAR
    successUrl?: string;      // Redirect after successful payment
    cancelUrl?: string;       // Redirect if payment cancelled
    failureUrl?: string;      // Redirect if payment failed
    metadata?: Record<string, string>;  // Custom metadata (order_id, user_id, etc.)
    lineItems?: Array<{
        displayName: string;
        quantity: number;
        pricingDetails: {
            price: number;    // Price in cents
        };
    }>;
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        console.log("🛒 Yoco Checkout: Function triggered");

        // Get environment variables
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const yocoSecretKey = Deno.env.get('YOCO_SECRET_KEY')

        if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
            console.error("❌ Missing Supabase env vars");
            throw new Error('Missing Supabase environment variables')
        }

        if (!yocoSecretKey) {
            console.error("❌ Missing YOCO_SECRET_KEY");
            throw new Error('YOCO_SECRET_KEY is not set. Please add it via: supabase secrets set YOCO_SECRET_KEY=sk_live_xxx')
        }

        // Verify user authentication
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            console.error("❌ Missing Authorization header");
            throw new Error('Missing Authorization header. Please sign in.')
        }

        // Create authenticated Supabase client
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: { Authorization: authHeader }
            },
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        // Verify user
        const { data: { user }, error: userError } = await userClient.auth.getUser()
        if (userError || !user) {
            console.error("❌ Auth Error:", userError?.message);
            throw new Error('Invalid session. Please sign in again.')
        }

        console.log("✅ Authenticated user:", user.id, user.email);

        // Parse request body
        const body: CheckoutRequest = await req.json()
        
        if (!body.amount || body.amount < 100) {
            throw new Error('Invalid amount. Minimum is 100 cents (R1.00)')
        }

        // Build Yoco checkout payload
        const appUrl = Deno.env.get('APP_URL') || 'https://slipsafe.netlify.app'
        
        const yocoPayload = {
            amount: body.amount,
            currency: body.currency || 'ZAR',
            successUrl: body.successUrl || `${appUrl}?payment=success`,
            cancelUrl: body.cancelUrl || `${appUrl}?payment=cancelled`,
            failureUrl: body.failureUrl || `${appUrl}?payment=failed`,
            metadata: {
                user_id: user.id,
                user_email: user.email || '',
                ...body.metadata
            },
            ...(body.lineItems && { lineItems: body.lineItems })
        }

        console.log("📤 Sending to Yoco:", JSON.stringify(yocoPayload, null, 2));

        // Create checkout session with Yoco
        const yocoResponse = await fetch('https://payments.yoco.com/api/checkouts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${yocoSecretKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(yocoPayload)
        })

        if (!yocoResponse.ok) {
            const errorText = await yocoResponse.text()
            console.error("❌ Yoco API Error:", yocoResponse.status, errorText);
            throw new Error(`Yoco API error: ${yocoResponse.status} - ${errorText}`)
        }

        const yocoData = await yocoResponse.json()
        console.log("✅ Yoco Checkout Created:", yocoData.id);

        // Optionally store checkout in database for tracking
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        
        const { error: dbError } = await supabase.from('payments').insert([{
            user_id: user.id,
            checkout_id: yocoData.id,
            amount: body.amount,
            currency: body.currency || 'ZAR',
            status: 'pending',
            metadata: body.metadata || {},
            created_at: new Date().toISOString()
        }])

        if (dbError) {
            // Log but don't fail - payment tracking is optional
            console.warn("⚠️ Could not log payment to DB:", dbError.message);
        }

        // Return checkout URL to frontend
        return new Response(JSON.stringify({
            success: true,
            checkoutId: yocoData.id,
            redirectUrl: yocoData.redirectUrl,
            status: yocoData.status
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error) {
        console.error("❌ Function Error:", error.message);
        return new Response(JSON.stringify({ 
            success: false,
            error: error.message 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        })
    }
})
