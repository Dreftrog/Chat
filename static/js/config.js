// Supabase Configuration
const SUPABASE_URL = 'https://soohwqdqdnlzkghspmwf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Fp0UEoQzCZvTtskqxgBuSg__XzhOiOQ';
const WS_URL = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/ws';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
