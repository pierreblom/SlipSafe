/**
 * Yoco Webhook Edge Function
 * Handles payment status updates from Yoco
 * 
 * Deploy with: supabase functions deploy yoco-webhook --no-verify-jwt
 * 
 * IMPORTANT: Register this webhook URL in your Yoco Dashboard:
 * https://<your-project-ref>.supabase.co/functions/v1/yoco-webhook
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-yoco-signature',
}

interface YocoWebhookEvent {
    id: string;
    type: string;
    createdDate: string;
    payload: {
        id: string;
        type: string;
        status: string;
        amount: number;
        currency: string;
        metadata?: Record<string, string>;
        paymentId?: string;
        merchantId?: string;
        createdDate: string;
        mode: string;
    };
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        console.log("🔔 Yoco Webhook: Event received");

        // Get environment variables
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const yocoWebhookSecret = Deno.env.get('YOCO_WEBHOOK_SECRET')

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("❌ Missing Supabase env vars");
            throw new Error('Missing Supabase environment variables')
        }

        // Get raw body for signature verification
        const rawBody = await req.text()
        console.log("📥 Webhook payload:", rawBody);

        // Optional: Verify webhook signature (if you have YOCO_WEBHOOK_SECRET set)
        const signature = req.headers.get('x-yoco-signature')
        if (yocoWebhookSecret && signature) {
            // Verify HMAC signature
            const encoder = new TextEncoder()
            const key = await crypto.subtle.importKey(
                'raw',
                encoder.encode(yocoWebhookSecret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['verify']
            )

            const signatureBuffer = new Uint8Array(
                signature.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
            )

            const isValid = await crypto.subtle.verify(
                'HMAC',
                key,
                signatureBuffer,
                encoder.encode(rawBody)
            )

            if (!isValid) {
                console.error("❌ Invalid webhook signature");
                return new Response(JSON.stringify({ error: 'Invalid signature' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 401
                })
            }
            console.log("✅ Webhook signature verified");
        }

        // Parse the webhook event
        const event: YocoWebhookEvent = JSON.parse(rawBody)
        console.log("📋 Event type:", event.type);
        console.log("📋 Checkout ID:", event.payload?.id);
        console.log("📋 Status:", event.payload?.status);

        // Create Supabase client with service role
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Handle different event types
        switch (event.type) {
            case 'checkout.completed':
                console.log("✅ Payment completed!");

                // Update payment status in database
                const { error: updateError } = await supabase
                    .from('payments')
                    .update({
                        status: 'completed',
                        payment_id: event.payload.paymentId,
                        completed_at: new Date().toISOString()
                    })
                    .eq('checkout_id', event.payload.id)

                if (updateError) {
                    console.error("❌ DB Update Error:", updateError.message);
                } else {
                    console.log("✅ Payment record updated");
                }

                // Get user_id from metadata to trigger any post-payment actions
                const userId = event.payload.metadata?.user_id
                if (userId) {
                    console.log("👤 User ID:", userId);

                    // Example: Update user subscription status
                    // await supabase.from('subscriptions').upsert({
                    //     user_id: userId,
                    //     status: 'active',
                    //     paid_at: new Date().toISOString()
                    // })
                }
                break

            case 'checkout.expired':
                console.log("⏰ Checkout expired");
                await supabase
                    .from('payments')
                    .update({ status: 'expired' })
                    .eq('checkout_id', event.payload.id)
                break

            case 'checkout.failed':
                console.log("❌ Payment failed");
                await supabase
                    .from('payments')
                    .update({ status: 'failed' })
                    .eq('checkout_id', event.payload.id)
                break

            case 'refund.completed':
                console.log("💰 Refund completed");
                await supabase
                    .from('payments')
                    .update({ status: 'refunded' })
                    .eq('checkout_id', event.payload.id)
                break

            default:
                console.log("ℹ️ Unhandled event type:", event.type);
        }

        // Always return 200 to acknowledge receipt
        return new Response(JSON.stringify({
            received: true,
            eventType: event.type
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error) {
        console.error("❌ Webhook Error:", error.message);
        // Still return 200 to prevent Yoco from retrying
        return new Response(JSON.stringify({
            received: true,
            error: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })
    }
})
