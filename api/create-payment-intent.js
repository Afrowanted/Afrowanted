// api/create-payment-intent.js
// Vercel Serverless Function — Stripe Payment Intent
// Questo file va nella cartella /api della repo GitHub
 
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
 
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
 
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
 
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
 
  try {
    const { amount, items, buyerEmail } = req.body;
 
    if (!amount || amount < 100) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
 
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   Math.round(amount * 100), // in centesimi
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
