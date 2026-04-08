/**
 * PayPal Payment Integration for AreAxiomian Premium
 *
 * Handles PayPal order creation and capture for premium subscriptions.
 * Premium benefits: 150% XP, housing, custom texture uploads.
 *
 * Configuration via environment variables:
 *   PAYPAL_CLIENT_ID    — PayPal REST API client ID
 *   PAYPAL_SECRET       — PayPal REST API secret
 *   PAYPAL_MODE         — 'sandbox' or 'live'
 *
 * Flow:
 *   1. Client calls POST /premium/create-order
 *   2. Server creates PayPal order, returns order ID + approval URL
 *   3. User approves on PayPal
 *   4. Client calls POST /premium/capture-order with order ID
 *   5. Server captures payment and upgrades player to Premium rank
 */

import log from '@kaetram/common/util/log';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_SECRET = process.env.PAYPAL_SECRET || '';
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';

const PAYPAL_API = PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const PREMIUM_PRICE = '9.99';
const PREMIUM_CURRENCY = 'EUR';
const PREMIUM_DESCRIPTION = 'AreAxiomian Premium — 150% XP, Housing, Custom Textures';

export interface PayPalOrder {
    id: string;
    status: string;
    approvalUrl: string;
}

export interface PayPalCapture {
    id: string;
    status: string;
    payerEmail: string;
    amount: string;
    currency: string;
}

/** Get OAuth2 access token from PayPal. */
async function getAccessToken(): Promise<string> {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
        throw new Error('PayPal credentials not configured (PAYPAL_CLIENT_ID / PAYPAL_SECRET)');
    }

    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');

    const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`PayPal auth failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    return data.access_token;
}

/** Create a PayPal order for premium subscription. */
export async function createOrder(username: string): Promise<PayPalOrder> {
    const accessToken = await getAccessToken();

    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: `premium_${username}_${Date.now()}`,
                description: PREMIUM_DESCRIPTION,
                amount: {
                    currency_code: PREMIUM_CURRENCY,
                    value: PREMIUM_PRICE
                },
                custom_id: username
            }],
            application_context: {
                brand_name: 'AreAxiomian',
                landing_page: 'LOGIN',
                user_action: 'PAY_NOW',
                return_url: 'http://localhost:9000/premium/success',
                cancel_url: 'http://localhost:9000/premium/cancel'
            }
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`PayPal create order failed: ${response.status} ${text}`);
    }

    const order = await response.json();
    const approvalLink = order.links?.find((l: any) => l.rel === 'approve');

    log.info(`[PayPal] Order ${order.id} created for ${username}`);

    return {
        id: order.id,
        status: order.status,
        approvalUrl: approvalLink?.href || ''
    };
}

/** Capture an approved PayPal order. */
export async function captureOrder(orderId: string): Promise<PayPalCapture> {
    const accessToken = await getAccessToken();

    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`PayPal capture failed: ${response.status} ${text}`);
    }

    const capture = await response.json();
    const payment = capture.purchase_units?.[0]?.payments?.captures?.[0];

    log.info(`[PayPal] Order ${orderId} captured: ${capture.status}`);

    return {
        id: capture.id,
        status: capture.status,
        payerEmail: capture.payer?.email_address || '',
        amount: payment?.amount?.value || PREMIUM_PRICE,
        currency: payment?.amount?.currency_code || PREMIUM_CURRENCY
    };
}

/** Check if PayPal credentials are configured. */
export function isPayPalConfigured(): boolean {
    return !!(PAYPAL_CLIENT_ID && PAYPAL_SECRET);
}

export function getPayPalConfig() {
    return {
        configured: isPayPalConfigured(),
        mode: PAYPAL_MODE,
        price: PREMIUM_PRICE,
        currency: PREMIUM_CURRENCY
    };
}
