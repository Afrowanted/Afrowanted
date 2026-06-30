import { rateLimit } from './_rateLimit.js';

// api/create-payment-intent.js
import Stripe from 'stripe';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limiting: max 20 richieste al minuto per IP
  const rl = rateLimit(req, { max: 20, windowMs: 60000 });
  Object.entries(rl.headers).forEach(([k,v]) => res.setHeader(k, v));
  if (!rl.ok) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: rl.retryAfter,
      message: `Rate limit exceeded. Try again in ${rl.retryAfter} seconds.`
    });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const {
      amount, items, buyerEmail,
      buyerName, buyerAddress, buyerCity, buyerZip, buyerCountry, buyerPhone,
      shippingCost, packagingCost, packagingOptions
    } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Stripe metadata: ogni valore max 500 caratteri. Tronchiamo per sicurezza
    // gli array potenzialmente lunghi (items / packagingOptions).
    const safe = (v, max = 500) => (v == null ? '' : String(v)).slice(0, max);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'eur',
      receipt_email: buyerEmail || undefined,
      metadata: {
        items: safe(JSON.stringify(items || [])),
        source: 'afrowanted',
        buyer_name: safe(buyerName),
        buyer_email: safe(buyerEmail),
        buyer_address: safe(buyerAddress),
        buyer_city: safe(buyerCity),
        buyer_zip: safe(buyerZip),
        buyer_country: safe(buyerCountry),
        buyer_phone: safe(buyerPhone),
        shipping_cost: safe(shippingCost ?? 0),
        packaging_cost: safe(packagingCost ?? 0),
        packaging_options: safe(JSON.stringify(packagingOptions || [])),
        total: safe(amount)
      }
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message });
  }
}
