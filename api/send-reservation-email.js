// api/send-reservation-email.js
// Email conferma prenotazione con dettagli bancari
 
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
 
  const { buyerEmail, buyerName, orderCode, items, total, expiresAt, shippingAddress } = req.body;
 
  if (!buyerEmail || !orderCode) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
 
  const WISE_IBAN = process.env.WISE_IBAN || '';
  const WISE_NAME = process.env.WISE_NAME || 'Frying Pan Records di Carlotta Fiorio';
 
  const expires = new Date(expiresAt).toLocaleString('it-IT', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
 
  const itemsHTML = (items || []).map(item => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;color:#f0ebe0;font-size:14px;">${item.label}</td>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;color:#c9943a;font-size:14px;text-align:right;font-family:monospace;">€${item.price}</td>
    </tr>`).join('');
 
  const emailHTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0c09;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
 
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:28px;letter-spacing:4px;color:#f0ebe0;font-weight:900;">AFRO<span style="color:#c9943a;">-</span>WANTED</div>
      <div style="font-size:11px;letter-spacing:3px;color:#888;margin-top:4px;font-family:monospace;">RARE AFRICAN RECORDS</div>
    </div>
 
    <div style="background:#1a1710;border-radius:4px;padding:24px;margin-bottom:24px;border:1px solid #2a2a2a;">
      <div style="font-family:monospace;font-size:11px;color:#c9943a;letter-spacing:2px;margin-bottom:8px;">RESERVATION CONFIRMED</div>
      <div style="font-size:22px;color:#f0ebe0;font-weight:700;margin-bottom:4px;">Record reserved! ✓</div>
      <div style="font-size:13px;color:#888;">Your record is reserved for 48 hours. Complete the bank transfer to confirm your order.</div>
    </div>
 
    <!-- Codice ordine -->
    <div style="background:#1a1710;border-radius:4px;padding:24px;margin-bottom:24px;border:2px solid #c9943a;text-align:center;">
      <div style="font-family:monospace;font-size:11px;color:#888;letter-spacing:2px;margin-bottom:8px;">YOUR ORDER CODE</div>
      <div style="font-family:monospace;font-size:28px;font-weight:700;color:#c9943a;letter-spacing:4px;">${orderCode}</div>
      <div style="font-size:12px;color:#888;margin-top:8px;">Use this as payment reference / causale del bonifico</div>
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
 
    <!-- Dati bancari -->
    <div style="background:#1a1710;border-radius:4px;padding:24px;margin-bottom:24px;border:1px solid #2a2a2a;">
      <div style="font-family:monospace;font-size:11px;color:#c9943a;letter-spacing:2px;margin-bottom:16px;">BANK TRANSFER DETAILS</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr>
          <td style="padding:6px 0;color:#888;">Beneficiary</td>
          <td style="padding:6px 0;color:#f0ebe0;text-align:right;">${WISE_NAME}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#888;">IBAN</td>
          <td style="padding:6px 0;color:#f0ebe0;text-align:right;font-family:monospace;font-size:12px;">${WISE_IBAN}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#888;">Amount</td>
          <td style="padding:6px 0;color:#c9943a;text-align:right;font-weight:700;font-size:15px;">€${total}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#888;">Reference / Causale</td>
          <td style="padding:6px 0;color:#c9943a;text-align:right;font-family:monospace;font-weight:700;">${orderCode}</td>
        </tr>
      </table>
    </div>
 
    <!-- Scadenza -->
    <div style="background:#2a1a10;border-radius:4px;padding:16px;margin-bottom:24px;border:1px solid #8b4513;text-align:center;">
      <div style="font-size:13px;color:#f0ebe0;">⚠️ Reservation expires on <strong style="color:#c9943a;">${expires}</strong></div>
      <div style="font-size:12px;color:#888;margin-top:4px;">If payment is not received by then, the record will become available again.</div>
    </div>
 
    <div style="background:#1a1710;border-radius:4px;padding:16px;border:1px solid #2a2a2a;margin-bottom:24px;">
      <div style="font-size:13px;color:#888;line-height:1.7;text-align:center;">
        Questions? Contact us at<br>
        <a href="mailto:afrowantedrecords@gmail.com" style="color:#c9943a;text-decoration:none;">afrowantedrecords@gmail.com</a>
      </div>
    </div>
 
    <div style="text-align:center;">
      <div style="font-size:11px;color:#444;font-family:monospace;letter-spacing:1px;">© 2026 AFRO-WANTED — ALL RIGHTS RESERVED</div>
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
        bcc: ['afrowantedrecords@gmail.com'], // notifica anche a te
        subject: `✓ Record Reserved — ${orderCode} | Afro-Wanted`,
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
    console.error('Reservation email error:', err);
    res.status(500).json({ error: err.message });
  }
}
