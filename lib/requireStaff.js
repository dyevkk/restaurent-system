// lib/requireStaff.js
import { supabase } from './supabaseClient';        // client (anon) - used to decode token -> user
import { supabaseServer } from './supabaseServer';  // server (service role) - used to check staffs table

/**
 * requireStaff(req, res)
 * - reads token from Authorization header (Bearer <token>) or cookies fallback
 * - returns { allowed: true, user } when OK
 * - returns { allowed: false, error: '...' } when not allowed
 */
export async function requireStaff(req, res) {
  // Accept token from Authorization header first, fallback to Supabase cookie name
  const header = req.headers?.authorization || '';
  const token = header?.startsWith('Bearer ') ? header.replace('Bearer ', '') : null;

  // also check cookie fallback (if you are using cookies)
  const cookieToken = (!token && req.cookies) ? (req.cookies['sb-access-token'] || null) : null;
  const accessToken = token || cookieToken;

  if (!accessToken) {
    return { allowed: false, error: 'missing_token' };
  }

  // 1) decode/verify token and get user (using client library)
  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return { allowed: false, error: 'invalid_token' };
    }
    const user = userData.user;

    // 2) check if this user's email exists in staffs table (use service role client)
    const { data: staffRow, error: staffErr } = await supabaseServer
      .from('staffs')
      .select('id,email')
      .eq('email', user.email)
      .limit(1)
      .maybeSingle(); // maybeSingle returns null if not found

    if (staffErr) {
      console.error('requireStaff: staffs query error', staffErr);
      return { allowed: false, error: 'internal_error' };
    }
    if (!staffRow) {
      return { allowed: false, error: 'not_staff' };
    }

    // allowed
    return { allowed: true, user };
  } catch (err) {
    console.error('requireStaff unexpected', err);
    return { allowed: false, error: 'exception' };
  }
}
