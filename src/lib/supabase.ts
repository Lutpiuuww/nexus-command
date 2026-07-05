import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Ekspor jembatan koneksi agar bisa dipanggil dari halaman manapun
export const supabase = createClient(supabaseUrl, supabaseAnonKey)