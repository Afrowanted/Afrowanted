// api/delete-account.js
// Cancella un utente da Supabase Auth usando la Service Role Key
// Richiede: Authorization header con il JWT dell'utente (per verificare identità)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userToken = authHeader.replace('Bearer ', '');
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Prima verifica che il token sia valido e ottieni l'user_id
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${userToken}`
      }
    });

    if (!userRes.ok) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userData = await userRes.json();
    const userId = userData.id;

    if (!userId) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Cancella wishlist e profilo
    await fetch(`${SUPABASE_URL}/rest/v1/wishlist?user_id=eq.${userId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });

    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });

    // Cancella utente da Auth con Service Role Key (admin)
    const deleteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });

    if (!deleteRes.ok) {
      const err = await deleteRes.text();
      console.error('Delete user error:', err);
      return res.status(500).json({ error: 'Failed to delete user' });
    }

    return res.status(200).json({ success: true });

  } catch (e) {
    console.error('Delete account error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
