import { rateLimit } from './_rateLimit.js';

// api/send-shipping-email.js
// Vercel Serverless Function — Email conferma spedizione via Resend
 
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
 
  const { email, name, tracking, orderId } = req.body;
  if (!email || !tracking) return res.status(400).json({ error: 'Missing required fields' });
 
  const firstName = name ? name.split(' ')[0] : 'there';
 
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#c9943a;font-size:28px;letter-spacing:4px;margin:0;">AFRO<em style="font-style:normal;color:#ffffff;">-</em>WANTED</h1>
      <p style="color:#666;font-size:11px;letter-spacing:2px;margin:6px 0 0;">RECORDS</p>
    </div>
    <div style="background:#141414;border:1px solid #222;border-radius:4px;padding:32px;">
      <h2 style="color:#ffffff;font-size:18px;margin:0 0 8px;">Your order is on its way! ✈</h2>
      <p style="color:#aaa;font-size:14px;line-height:1.7;margin:0 0 24px;">
        Hi ${firstName}! Your records have been shipped and are on their way to you.
      </p>
      ${orderId ? `<p style="color:#666;font-size:12px;margin:0 0 20px;letter-spacing:1px;">ORDER: <span style="color:#c9943a;">${orderId}</span></p>` : ''}
      <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:3px;padding:20px;text-align:center;margin-bottom:24px;">
        <p style="color:#666;font-size:11px;letter-spacing:2px;margin:0 0 8px;">TRACKING NUMBER</p>
        <p style="color:#c9943a;font-size:22px;font-weight:bold;letter-spacing:3px;margin:0;font-family:'Courier New',monospace;">${tracking}</p>
      </div>
      <p style="color:#888;font-size:13px;line-height:1.6;margin:0 0 24px;">
        Use this tracking number on the carrier's website to follow your shipment. Delivery usually takes 3–7 business days within Europe.
      </p>
      <div style="padding-top:24px;border-top:1px solid #2a2a2a;text-align:center;">
        <p style="color:#666;font-size:12px;margin:0;">Questions? Write to <a href="mailto:afrowantedrecords@gmail.com" style="color:#c9943a;">afrowantedrecords@gmail.com</a></p>
      </div>
    </div>
    <p style="text-align:center;color:#444;font-size:11px;margin-top:24px;">© Afro-Wanted Records · Milano</p>
  </div>
</body>
</html>`;
 
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Afro-Wanted Records <noreply@afrowanted.com>',
        to: [email],
        subject: `Your order has been shipped — tracking: ${tracking}`,
        html
      })
    });
 
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data });
    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
