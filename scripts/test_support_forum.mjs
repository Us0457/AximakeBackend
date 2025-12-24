import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function run() {
  try {
    console.log('Sanity check: pinging REST endpoint for support_forum_questions...');
    try {
      const raw = await fetch(`${SUPABASE_URL}/rest/v1/support_forum_questions?select=id&limit=1`, {
        headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` }
      });
      const text = await raw.text();
      console.log('REST ping status:', raw.status);
      console.log('REST ping body:', text.substring(0, 1000));
    } catch (e) {
      console.error('REST ping failed:', e);
    }

    console.log('Inserting test question...');
    const questionPayload = {
      title: `Test question from script ${new Date().toISOString()}`,
      category: 'General',
      description: 'This is a test question created by scripts/test_support_forum.mjs',
      status: 'Open',
      author_name: 'ScriptRunner'
    };

    const { data: qdata, error: qerr } = await supabase.from('support_forum_questions').insert(questionPayload).select().maybeSingle();
    if (qerr) {
      console.error('Insert question error:', qerr);
      throw qerr;
    }
    console.log('Question inserted:', qdata?.id);

    console.log('Inserting test reply...');
    const replyPayload = {
      question_id: qdata.id,
      content: 'This is a test reply from the script.',
      author_name: 'ScriptRunner',
      is_official: true
    };
    const { data: rdata, error: rerr } = await supabase.from('support_forum_replies').insert(replyPayload).select().maybeSingle();
    if (rerr) {
      console.error('Insert reply error:', rerr);
      throw rerr;
    }
    console.log('Reply inserted:', rdata?.id);

    console.log('Fetching question and replies...');
    const { data: qf } = await supabase.from('support_forum_questions').select('*').eq('id', qdata.id).maybeSingle();
    const { data: replies } = await supabase.from('support_forum_replies').select('*').eq('question_id', qdata.id).order('created_at', { ascending: true });

    console.log('Question:', qf);
    console.log('Replies:', replies);

    // cleanup: delete inserted rows (optional)
    console.log('Cleaning up test rows...');
    await supabase.from('support_forum_replies').delete().eq('id', rdata.id);
    await supabase.from('support_forum_questions').delete().eq('id', qdata.id);
    console.log('Done.');
  } catch (e) {
    console.error('Test failed (full):', e);
    process.exitCode = 2;
  }
}

run();
