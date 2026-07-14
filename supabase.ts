import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 🚨 INI ADALAH PENJAGA KEAMANANNYA
if (!supabaseUrl || !supabaseKey) {
  console.error("Gawat! Variabel Lingkungan Supabase Kosong!");
  throw new Error("Missing Supabase environment variables. Cek file .env.local kamu.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// perbaikan kesalahan mutlak