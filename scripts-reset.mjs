import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
if (error) throw error;
const tests = data.users.filter(u => /@klika\.test$/i.test(u.email||'') || /^test[-.]/i.test(u.email||''));
console.log('Matched:', tests.map(u=>u.email));
for (const u of tests) {
  const { error: e } = await sb.auth.admin.updateUserById(u.id, { password: 'Test123!' });
  console.log(u.email, e ? 'ERR '+e.message : 'OK');
}
