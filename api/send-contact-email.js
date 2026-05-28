import { rateLimit } from './_rateLimit.js';

export default async function handler(req, res) {
  // Rate limiting: max 5 richieste al minuto per IP
  const rl = rateLimit(req, { max: 5, windowMs: 60000 });
  Object.entries(rl.headers).forEach(([k,v]) => res.setHeader(k, v));
  if (!rl.ok) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: rl.retryAfter,
      message: `Rate limit exceeded. Try again in ${rl.retryAfter} seconds.`
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, subject, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }

  const subjectLabel = subject || 'General inquiry';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Afro-Wanted Records <noreply@afrowanted.com>',
        to: ['afrowantedrecords@gmail.com'],
        reply_to: email,
        subject: `[Contatto] ${subjectLabel} — da ${name}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#111;color:#f0e8d6;padding:2rem;border-radius:8px;">
            <h2 style="color:#c9a84c;font-family:sans-serif;margin-bottom:1.5rem;border-bottom:1px solid #333;padding-bottom:1rem;">
              Nuovo messaggio da Afro-Wanted
            </h2>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:.5rem 0;color:#888;font-size:.85rem;width:100px;">Da:</td>
                <td style="padding:.5rem 0;color:#f0e8d6;">${name}</td>
              </tr>
              <tr>
                <td style="padding:.5rem 0;color:#888;font-size:.85rem;">Email:</td>
                <td style="padding:.5rem 0;"><a href="mailto:${email}" style="color:#c9a84c;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding:.5rem 0;color:#888;font-size:.85rem;">Oggetto:</td>
                <td style="padding:.5rem 0;color:#f0e8d6;">${subjectLabel}</td>
              </tr>
            </table>
            <div style="margin-top:1.5rem;padding:1rem;background:#1a1a1a;border-radius:4px;border-left:3px solid #c9a84c;">
              <p style="margin:0;line-height:1.7;color:#f0e8d6;white-space:pre-wrap;">${message}</p>
            </div>
            <div style="margin-top:1.5rem;">
              <a href="mailto:${email}?subject=Re: ${subjectLabel}" 
                 style="display:inline-block;background:#c9a84c;color:#111;padding:.6rem 1.2rem;border-radius:4px;text-decoration:none;font-weight:700;font-size:.85rem;">
                ↩ Rispondi a ${name}
              </a>
            </div>
            <p style="margin-top:2rem;font-size:.75rem;color:#555;">
              Messaggio ricevuto tramite il form contatti di afrowanted.com
            </p>
          </div>
        `
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Email send failed', details: err });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Send contact email error:', err);
    return res.status(500).json({ error: err.message });
  }
}
