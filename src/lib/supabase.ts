import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabasePublic = createClient(supabaseUrl, anonKey);

// Server-side admin client (keep service key server-only)
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
