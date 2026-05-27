// api/send-order-email.js
// Vercel Serverless Function — Email conferma ordine via Resend
 
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
 
  const { buyerEmail, buyerName, items, total, orderId, shippingAddress } = req.body;
 
  if (!buyerEmail || !items || !total) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
 
  const itemsHTML = items.map(item => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;color:#f0ebe0;font-size:14px;">${item.label}</td>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;color:#c9943a;font-size:14px;text-align:right;font-family:monospace;">€${item.price}</td>
    </tr>`).join('');
 
  const addressHTML = shippingAddress ? `
    <div style="margin-top:24px;padding:16px;background:#1a1710;border-radius:4px;">
      <div style="font-family:monospace;font-size:11px;color:#c9943a;letter-spacing:1px;margin-bottom:8px;">SHIPPING TO</div>
      <div style="color:#f0ebe0;font-size:14px;line-height:1.6;">
        ${shippingAddress.name}<br>
        ${shippingAddress.address}<br>
        ${shippingAddress.city}${shippingAddress.country ? ', ' + shippingAddress.country : ''}
      </div>
    </div>` : '';
 
  const emailHTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0c09;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
 
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:28px;letter-spacing:4px;color:#f0ebe0;font-weight:900;">AFRO<span style="color:#c9943a;">-</span>WANTED</div>
      <div style="font-size:11px;letter-spacing:3px;color:#888;margin-top:4px;font-family:monospace;">RARE AFRICAN RECORDS</div>
    </div>
 
    <!-- Titolo -->
    <div style="background:#1a1710;border-radius:4px;padding:24px;margin-bottom:24px;border:1px solid #2a2a2a;">
      <div style="font-family:monospace;font-size:11px;color:#c9943a;letter-spacing:2px;margin-bottom:8px;">ORDER CONFIRMED</div>
      <div style="font-size:22px;color:#f0ebe0;font-weight:700;margin-bottom:4px;">Thank you${buyerName ? ', ' + buyerName.split(' ')[0] : ''}! 🎵</div>
      <div style="font-size:13px;color:#888;">Your order has been received and is being processed.</div>
      ${orderId ? `<div style="font-family:monospace;font-size:11px;color:#555;margin-top:8px;">Order #${orderId.toString().slice(-8).toUpperCase()}</div>` : ''}
    </div>
 
    <!-- Articoli -->
    <div style="background:#1a1710;border-radius:4px;padding:24px;margin-bottom:24px;border:1px solid #2a2a2a;">
      <div style="font-family:monospace;font-size:11px;color:#c9943a;letter-spacing:2px;margin-bottom:16px;">YOUR ORDER</div>
      <table style="width:100%;border-collapse:collapse;">
        ${itemsHTML}
        <tr>
          <td style="padding:12px 0 0;color:#888;font-family:monospace;font-size:12px;letter-spacing:1px;">TOTAL</td>
          <td style="padding:12px 0 0;color:#c9943a;font-family:monospace;font-size:18px;font-weight:700;text-align:right;">€${total}</td>
        </tr>
      </table>
    </div>
 
    <!-- Spedizione -->
    ${addressHTML}
 
    <!-- Messaggio -->
    <div style="margin-top:24px;padding:16px;background:#1a1710;border-radius:4px;border:1px solid #2a2a2a;">
      <div style="font-size:13px;color:#888;line-height:1.7;">
        We will contact you shortly to confirm shipment details and tracking information.<br><br>
        For any questions, reply to this email or contact us at<br>
        <a href="mailto:afrowantedrecords@gmail.com" style="color:#c9943a;text-decoration:none;">afrowantedrecords@gmail.com</a>
      </div>
    </div>
 
    <!-- Footer -->
    <div style="text-align:center;margin-top:32px;">
      <div style="font-size:11px;color:#444;font-family:monospace;letter-spacing:1px;">© 2026 AFRO-WANTED — ALL RIGHTS RESERVED</div>
      <div style="margin-top:8px;">
        <a href="https://www.discogs.com/user/Afro-Wanted" style="color:#555;font-size:11px;text-decoration:none;margin:0 8px;">DISCOGS</a>
        <a href="https://www.instagram.com/afrowanted" style="color:#555;font-size:11px;text-decoration:none;margin:0 8px;">INSTAGRAM</a>
      </div>
    </div>
 
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
        from: 'Afro-Wanted <noreply@afrowanted.com>',
        to: [buyerEmail],
        subject: `✓ Order Confirmed — Afro-Wanted`,
        html: emailHTML
      })
    });
 
    const data = await response.json();
    if (response.ok) {
      res.status(200).json({ success: true, id: data.id });
    } else {
      console.error('Resend error:', data);
      res.status(500).json({ error: data.message || 'Email send failed' });
    }
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: err.message });
  }
}
