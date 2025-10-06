import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dvbijjzltpfjggkimqsg.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2YmlqanpsdHBmamdna2ltcXNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NjIyMzEsImV4cCI6MjA3NTMzODIzMX0.WTGFXu7FwlSMFOMtz6ULkhgFlEK_Cvl1bSz_jwWJvGw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
