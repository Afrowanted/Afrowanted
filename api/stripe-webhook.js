// api/stripe-webhook.js
import Stripe from 'stripe';

// Necessario per verificare la firma Stripe: serve il raw body, non quello già parsato da Vercel
export const config = {
  api: {
    bodyParser: false
  }
};

const SUPABASE_URL = 'https://gohqfbdepmqacxcfijzl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bI8wUzAGj-YUFMqb4dLldA_NRhQjUzH';

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function supabaseFetch(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}

// Manda una email tramite l'endpoint esistente, senza far fallire il webhook se l'email non parte
async function sendOrderEmail(origin, payload) {
  try {
    await fetch(`${origin}/api/send-order-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error('Webhook: send-order-email failed', e);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  const rawBody = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Rispondiamo subito 200 il prima possibile dopo aver fatto il lavoro,
  // ma gestiamo solo l'evento che ci interessa
  if (event.type !== 'payment_intent.succeeded') {
    return res.status(200).json({ received: true, ignored: event.type });
  }

  try {
    const paymentIntent = event.data.object;
    const md = paymentIntent.metadata || {};

    // 1. Idempotenza: se l'ordine esiste già (creato dal flusso client-side
    //    quando non c'è stato un redirect), non duplichiamo nulla.
    const existingRes = await supabaseFetch(`orders?paypal_order_id=eq.${paymentIntent.id}&select=id`);
    const existing = existingRes.ok ? await existingRes.json() : [];
    if (existing.length > 0) {
      return res.status(200).json({ received: true, alreadyExists: true });
    }

    // 2. Ricostruisce i dati ordine dai metadata del PaymentIntent
    let items = [];
    try { items = JSON.parse(md.items || '[]'); } catch (e) {}
    let packagingOptions = [];
    try { packagingOptions = JSON.parse(md.packaging_options || '[]'); } catch (e) {}

    const buyerName    = md.buyer_name || '';
    const buyerEmail   = md.buyer_email || paymentIntent.receipt_email || '';
    const buyerAddress = md.buyer_address || '';
    const buyerCity    = md.buyer_city || '';
    const buyerZip     = md.buyer_zip || '';
    const buyerCountry = md.buyer_country || '';
    const buyerPhone   = md.buyer_phone || '';
    const shippingCost = Number(md.shipping_cost || 0);
    const packagingCost = Number(md.packaging_cost || 0);
    const total = paymentIntent.amount / 100; // amount è in centesimi su Stripe

    const orderData = {
      buyer_name:        buyerName,
      buyer_email:       buyerEmail,
      shipping_address:  buyerAddress,
      buyer_zip:         buyerZip,
      buyer_city:        buyerCity,
      buyer_country:     buyerCountry,
      buyer_phone:       buyerPhone,
      record_ids:        items.map(i => i.id),
      items_snapshot:    items.map(i => ({ id: i.id, label: i.label, price: i.price })),
      packaging_options: packagingOptions,
      shipping_cost:     Math.round(shippingCost * 100),
      packaging_cost:    Math.round(packagingCost * 100),
      total:             Math.round(total * 100),
      status:            'pending',
      paypal_order_id:   paymentIntent.id,
      payment_method:    'stripe',
      created_at:        new Date().toISOString(),
    };

    // 3. Crea l'ordine
    const orderRes = await supabaseFetch('orders', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(orderData)
    });

    if (!orderRes.ok) {
      const errBody = await orderRes.text();
      console.error('Webhook: order insert failed', orderRes.status, errBody);
      const origin = `https://${req.headers.host}`;
      await sendOrderEmail(origin, {
        buyerEmail: 'afrowantedrecords@gmail.com',
        buyerName: 'SYSTEM ALERT (webhook)',
        orderId: paymentIntent.id,
        isErrorAlert: true,
        errorDetail: `Webhook order save FAILED for ${buyerEmail} (Stripe PaymentIntent ${paymentIntent.id}). Status: ${orderRes.status}. Body: ${errBody}`
      });
      // Rispondiamo comunque 200 per non far ritentare Stripe all'infinito
      // sullo stesso errore — l'alert email è già stata inviata.
      return res.status(200).json({ received: true, orderSaveFailed: true });
    }

    // 4. Marca i dischi venduti
    for (const item of items) {
      if (!item.id) continue;
      await supabaseFetch(`records?id=eq.${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ available: false, visible: false })
      });
    }

    // 5. Email di conferma cliente + notifica negozio
    const origin = `https://${req.headers.host}`;
    await sendOrderEmail(origin, {
      buyerEmail,
      buyerName,
      orderId: paymentIntent.id,
      items: items.map(i => ({ label: i.label, price: i.price })),
      total: total.toFixed(2),
      shippingAddress: { name: buyerName, address: buyerAddress, city: buyerCity, country: buyerCountry }
    });

    const itemsListText = items.map(i => `${i.label} — €${(i.price || 0).toFixed(2)}`).join('\n');
    await sendOrderEmail(origin, {
      buyerEmail: 'afrowantedrecords@gmail.com',
      buyerName: 'NEW STRIPE ORDER NOTIFICATION (webhook)',
      orderId: paymentIntent.id,
      isShopNotification: true,
      items: items.map(i => ({ label: i.label, price: i.price })),
      total: total.toFixed(2),
      shippingCost: shippingCost.toFixed(2),
      packagingCost: packagingCost.toFixed(2),
      customerName: buyerName,
      customerEmail: buyerEmail,
      shippingAddress: { name: buyerName, address: buyerAddress, zip: buyerZip, city: buyerCity, country: buyerCountry },
      errorDetail: `Nuovo ordine STRIPE da ${buyerName} (${buyerEmail}) — creato via webhook (pagamento con redirect, es. Klarna/Amazon Pay/Bancontact).\n\nItems:\n${itemsListText}\n\nShipping: €${shippingCost.toFixed(2)}\nPackaging: €${packagingCost.toFixed(2)}\nTotal: €${total.toFixed(2)}\n\nAddress:\n${buyerAddress}\n${buyerZip} ${buyerCity}\n${buyerCountry}\n\nStripe PaymentIntent: ${paymentIntent.id}`
    });

    return res.status(200).json({ received: true, orderCreated: true });

  } catch (err) {
    console.error('Webhook handler error:', err);
    // 200 per evitare retry infiniti di Stripe su un bug nostro non recuperabile al volo;
    // l'errore è comunque loggato nei log Vercel per debug.
    return res.status(200).json({ received: true, error: err.message });
  }
}
