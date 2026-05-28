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
    const { amount, items, buyerEmail } = req.body;
 
    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
 
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'eur',
      receipt_email: buyerEmail || undefined,
      metadata: {
        items: JSON.stringify(items || []),
        source: 'afrowanted'
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
 
