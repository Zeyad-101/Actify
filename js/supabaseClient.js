// Supabase client initialization.
// Fill these in from your Supabase project (Project Settings > API).
const SUPABASE_URL = 'https://wisjrxevsewrgbxlwrec.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpc2pyeGV2c2V3cmdieGx3cmVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MDM0NzEsImV4cCI6MjEwNDI3OTQ3MX0.3OTXuJ2ziHJK8Qb-tBUq31WyYotVMBpD6N7D-j8qf0w';

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
