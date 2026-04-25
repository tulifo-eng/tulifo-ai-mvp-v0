import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars not set. Database access will be unavailable.');
}

// Auth is handled by our own backend (/api/auth/google); we just call
// supabase.auth.setSession(...) with the JWT it returns so supabase.from(...)
// requests carry an Authorization header that RLS policies can read.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: false,
        storageKey: `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`,
      },
    })
  : null;
