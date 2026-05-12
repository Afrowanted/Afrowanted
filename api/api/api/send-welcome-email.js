// api/send-welcome-email.js
// Vercel Serverless Function — Email benvenuto nuovi iscritti via Resend
 
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
 
  const { email, name } = req.body;
 
  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }
 
  const firstName = name ? name.split(' ')[0] : '';
 
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
 
    <!-- Benvenuto -->
    <div style="background:#1a1710;border-radius:4px;padding:24px;margin-bottom:24px;border:1px solid #2a2a2a;">
      <div style="font-family:monospace;font-size:11px;color:#c9943a;letter-spacing:2px;margin-bottom:8px;">WELCOME</div>
      <div style="font-size:22px;color:#f0ebe0;font-weight:700;margin-bottom:8px;">
        ${firstName ? `Welcome, ${firstName}! 🎵` : 'Welcome to Afro-Wanted! 🎵'}
      </div>
      <div style="font-size:13px;color:#888;line-height:1.7;">
        Your account has been created successfully.<br>
        You can now save your favourite records to your wishlist and track your orders.
      </div>
    </div>
 
    <!-- Cosa puoi fare -->
    <div style="background:#1a1710;border-radius:4px;padding:24px;margin-bottom:24px;border:1px solid #2a2a2a;">
      <div style="font-family:monospace;font-size:11px;color:#c9943a;letter-spacing:2px;margin-bottom:16px;">WHAT YOU CAN DO</div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="font-size:18px;">♥</div>
          <div>
            <div style="color:#f0ebe0;font-size:13px;font-weight:600;">Wishlist</div>
            <div style="color:#888;font-size:12px;margin-top:2px;">Save records you love and find them easily later.</div>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="font-size:18px;">📦</div>
          <div>
            <div style="color:#f0ebe0;font-size:13px;font-weight:600;">Order History</div>
            <div style="color:#888;font-size:12px;margin-top:2px;">Keep track of all your past purchases.</div>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="font-size:18px;">🎵</div>
          <div>
            <div style="color:#f0ebe0;font-size:13px;font-weight:600;">Afro Radio</div>
            <div style="color:#888;font-size:12px;margin-top:2px;">Stream previews from our entire catalogue for free.</div>
          </div>
        </div>
      </div>
    </div>
 
    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://afrowanted.vercel.app" style="display:inline-block;background:#c9943a;color:#0d0c09;font-family:monospace;font-size:12px;font-weight:700;letter-spacing:2px;padding:14px 32px;border-radius:3px;text-decoration:none;">BROWSE THE CATALOGUE</a>
    </div>
 
    <!-- Contatti -->
    <div style="background:#1a1710;border-radius:4px;padding:16px;border:1px solid #2a2a2a;margin-bottom:24px;">
      <div style="font-size:13px;color:#888;line-height:1.7;text-align:center;">
        Questions? Contact us at<br>
        <a href="mailto:afrowantedrecords@gmail.com" style="color:#c9943a;text-decoration:none;">afrowantedrecords@gmail.com</a>
      </div>
    </div>
 
    <!-- Footer -->
    <div style="text-align:center;">
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
        from: 'Afro-Wanted <onboarding@resend.dev>',
        to: [email],
        subject: '🎵 Welcome to Afro-Wanted!',
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
    console.error('Welcome email error:', err);
    res.status(500).json({ error: err.message });
  }
}
