import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import ReplyCard from '@/components/forum/ReplyCard';
import Timeline from '@/components/forum/Timeline';
import RelatedThreads from '@/components/forum/RelatedThreads';

function formatDate(d) { try { return new Date(d).toLocaleString(); } catch { return '-'; } }

export default function SupportThreadPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [question, setQuestion] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState([]);
  const replyRef = useRef(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { document.title = question ? `${question.title} — Support — Aximake` : 'Support Thread — Aximake'; }, [question]);

  const fetchThread = useCallback(async function fetchThread() {
    setLoading(true);
    try {
      const { data: q } = await supabase
        .from('support_forum_questions')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      setQuestion(q || null);

      // Increment views atomically via RPC (if available) unless this session already counted the view
      try {
        if (q && q.id) {
          const key = `forum_viewed_${q.id}`;
          const already = sessionStorage.getItem(key);
          if (!already) {
            try {
              await supabase.rpc('increment_question_views', { qid: q.id });
            } catch (rpcErr) {
              const newViews = (q.views || 0) + 1;
              await supabase.from('support_forum_questions').update({ views: newViews }).eq('id', q.id);
            }
            sessionStorage.setItem(key, '1');
            setQuestion(prev => ({ ...(prev || {}), views: ((prev?.views) || q.views || 0) + 1 }));
          } else {
            // if session already marked it, just reflect it locally
            setQuestion(prev => ({ ...(prev || {}), views: ((prev?.views) || q.views || 0) }));
          }
        }
      } catch (e) {
        console.warn('Failed to increment views', e);
      }

      const { data: rs } = await supabase
        .from('support_forum_replies')
        .select('*')
        .eq('question_id', id)
        .order('created_at', { ascending: true });
        const repliesRaw = rs || [];

        // fetch authoritative likes counts for replies from support_forum_likes
        try {
          const replyIds = repliesRaw.map(x => x.id).filter(Boolean);
          if (replyIds.length > 0) {
            const { data: likeRows } = await supabase.from('support_forum_likes').select('item_id').eq('item_type', 'reply').in('item_id', replyIds);
            const counts = (likeRows || []).reduce((acc, row) => { const k = String(row.item_id); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
            repliesRaw.forEach(rr => { rr.likes = counts[String(rr.id)] || (rr.likes || 0); });
          }
        } catch (e) {
          console.warn('Failed to fetch reply likes counts', e);
        }

      // Enrich replies and question with profile info (first_name, avatar_url) when available
      try {
        // collect author ids
        const authorIds = new Set();
        if (q && q.author_id) authorIds.add(q.author_id);
        repliesRaw.forEach(r => { if (r.author_id) authorIds.add(r.author_id); });
        if (authorIds.size > 0) {
          const ids = Array.from(authorIds);
          const { data: profiles } = await supabase.from('profiles').select('id,first_name,avatar_url').in('id', ids);
          const byId = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});

          // merge into question
          if (q && q.author_id && byId[q.author_id]) {
            q.author_name = byId[q.author_id].first_name || q.author_name || q.author_email || q.author_name;
            q.avatar_url = byId[q.author_id].avatar_url || q.avatar_url;
          }

          // merge into replies
          const enriched = repliesRaw.map(r => {
            if (r.author_id && byId[r.author_id]) {
              return { ...r, author_name: byId[r.author_id].first_name || r.author_name, avatar_url: byId[r.author_id].avatar_url };
            }
            return r;
          });
          setReplies(enriched);
          setQuestion(q || null);
          // fetch likes for current user for question + replies
          if (user) {
            try {
              const qids = [q?.id].filter(Boolean);
              const rids = enriched.map(r => r.id).filter(Boolean);
              const { data: likes } = await supabase.from('support_forum_likes')
                .select('item_id,item_type')
                .eq('user_id', user.id)
                .in('item_id', [...qids, ...rids]);
              const likedQ = new Set((likes || []).filter(x => x.item_type === 'question').map(x => String(x.item_id)));
              const likedR = new Set((likes || []).filter(x => x.item_type === 'reply').map(x => String(x.item_id)));
              if (q && likedQ.has(String(q.id))) q.is_liked = true;
              enriched.forEach(rr => { rr.is_liked = likedR.has(String(rr.id)); });
              setReplies(enriched);
              setQuestion(q || null);
            } catch (e) { /* ignore likes fetch errors */ }
          }
        } else {
          setReplies(repliesRaw);
        }
      } catch (e) {
        console.error('Profile enrichment error', e);
        setReplies(repliesRaw);
      }

      // check role
      if (user) {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
        if (p && p.role && String(p.role).toLowerCase().trim() === 'admin') setIsAdmin(true);
      }
    } catch (e) {
      console.error(e);
      setError('Failed to load thread');
    }
    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    if (id) fetchThread();
  }, [id, user, fetchThread]);

  // listen for like changes elsewhere in the app and update local state from event detail
  useEffect(() => {
    function onLikeChanged(e) {
      try {
        const d = e && e.detail ? e.detail : {};
        if (!d) return;
        if (d.item_type === 'reply' && d.item_id) {
          // update the specific reply in-place
          setReplies(prev => (prev || []).map(rr => rr.id === d.item_id ? { ...rr, likes: (typeof d.likes_count !== 'undefined' ? d.likes_count : rr.likes), is_liked: (typeof d.is_liked !== 'undefined' ? d.is_liked : rr.is_liked) } : rr));
          // if the event contains a question_id and we have the question, optionally update question.likes
          if (d.question_id && typeof d.question_id !== 'undefined') {
            setQuestion(prev => prev ? ({ ...prev, /* note: question.likes is server-side only */ }) : prev);
          }
          return;
        }
        if (d.item_type === 'question' && d.item_id) {
          setQuestion(prev => prev ? ({ ...prev, likes: (typeof d.likes_count !== 'undefined' ? d.likes_count : prev.likes), is_liked: (typeof d.is_liked !== 'undefined' ? d.is_liked : prev.is_liked) }) : prev);
          return;
        }
        // fallback: refetch if event had no useful detail
        fetchThread();
      } catch (err) { /* ignore */ }
    }
    window.addEventListener('forum:like-changed', onLikeChanged);
    return () => window.removeEventListener('forum:like-changed', onLikeChanged);
  }, [fetchThread]);

  async function postReply(e) {
    e.preventDefault();
    if (!replyText.trim()) return;
    try {
      // Ensure a `profiles` row exists for the current user to satisfy FK constraints
      if (user && user.id) {
        try {
          const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
          if (!existing) {
            const name = user.user_metadata?.name || user.user_metadata?.first_name || (user.email ? user.email.split('@')[0] : 'User');
            // Do not hotlink provider avatar; use proxied URL if provider avatar exists
            const providerAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
            const avatar = providerAvatar ? `https://images.weserv.nl/?url=${encodeURIComponent(providerAvatar)}&output=jpg&w=256&h=256&fit=cover` : null;
            // upsert to create a minimal profile record
            await supabase.from('profiles').upsert({ id: user.id, first_name: name, avatar_url: avatar }, { returning: 'minimal' });
          }
        } catch (e) {
          // ignore profile upsert failures; we'll surface reply insert error below if it fails
          console.warn('Failed to ensure profile exists before posting reply', e);
        }
      }
      const payload = {
        question_id: id,
        content: replyText.trim(),
        author_id: user ? user.id : null,
        author_name: user ? (user.user_metadata?.name || user.email) : 'Guest',
        is_official: isAdmin ? true : false,
      };
      const { data, error } = await supabase.from('support_forum_replies').insert(payload).select().maybeSingle();
      if (error) throw error;
      setReplies(prev => [...prev, data || payload]);
      setReplyText('');
      // Optimistically update local replies_count; server triggers will maintain authoritative count
      setQuestion(prev => ({ ...(prev || {}), replies_count: (prev?.replies_count || 0) + 1 }));
      try { window.dispatchEvent(new CustomEvent('forum:reply-changed', { detail: { question_id: id, reply_id: (data && data.id) || null } })); } catch (e) {}
    } catch (e) {
      console.error(e);
      setError('Failed to post reply');
    }
  }

  // Reply formatting helpers (markdown-style)
  function applyReplyWrapping(before, after = before) {
    const el = replyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = replyText || '';
    const selected = val.slice(start, end) || 'text';
    const newVal = val.slice(0, start) + before + selected + after + val.slice(end);
    setReplyText(newVal);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + before.length + selected.length + after.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  function applyReplyLink() {
    const el = replyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = replyText || '';
    const selected = val.slice(start, end) || 'link-text';
    const url = window.prompt('Enter URL (https://...)');
    if (!url) return;
    const md = `[${selected}](${url})`;
    const newVal = val.slice(0, start) + md + val.slice(end);
    setReplyText(newVal);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + md.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  async function handleReplyImageUpload(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const key = `forum/attachments/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    try {
      const { data: up, error: upErr } = await supabase.storage.from('banners').upload(key, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;
      const { data: publicData } = supabase.storage.from('banners').getPublicUrl(key);
      const url = publicData?.publicUrl || publicData?.publicURL || '';
      if (url) {
        const el = replyRef.current;
        const pos = (el && el.selectionStart) || replyText.length;
        const md = `![${file.name}](${url})`;
        const newVal = replyText.slice(0, pos) + '\n\n' + md + '\n\n' + replyText.slice(pos);
        setReplyText(newVal);
        setReplyAttachments(prev => [...prev, { name: file.name, url }]);
      }
    } catch (e) {
      console.error('Reply upload failed', e);
      setError('Image upload failed. Check storage permissions.');
    }
  }

  async function markOfficial(replyId, flag = true) {
    if (!isAdmin) return;
    try {
      await supabase.from('support_forum_replies').update({ is_official: flag }).eq('id', replyId);
      setReplies(prev => prev.map(r => r.id === replyId ? { ...r, is_official: flag } : r));
    } catch (e) { console.error(e); }
  }

  async function acceptReply(replyId) {
    if (!isAdmin) return;
    try {
      // unset previous accepted
      await supabase.from('support_forum_replies').update({ is_accepted: false }).eq('question_id', id).neq('id', replyId);
      await supabase.from('support_forum_replies').update({ is_accepted: true }).eq('id', replyId);
      await supabase.from('support_forum_questions').update({ accepted_reply_id: replyId, status: 'Answered' }).eq('id', id);
      setReplies(prev => prev.map(r => ({ ...r, is_accepted: (r.id === replyId) })));
      setQuestion(prev => ({ ...(prev || {}), accepted_reply_id: replyId, status: 'Answered' }));
    } catch (e) { console.error(e); }
  }

  async function closeQuestion() {
    if (!isAdmin) return;
    try {
      await supabase.from('support_forum_questions').update({ status: 'Closed' }).eq('id', id);
      setQuestion(prev => ({ ...(prev || {}), status: 'Closed' }));
    } catch (e) { console.error(e); }
  }

  if (loading) return <div className="py-8 text-center">Loading...</div>;
  if (!question) return <div className="py-8 text-center">Question not found.</div>;

  return (
    <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-8">
      <div className="mb-4">
        <Link to="/support/forum" className="text-sm text-primary hover:underline">← Back to Forum</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <main className="lg:col-span-2 space-y-4 max-w-3xl">
          <Card id="question-header" className="mb-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-semibold">{question.title}</div>
                  <div className="text-xs text-muted-foreground">{question.category} • asked by {question.author_name || 'Guest'} • {formatDate(question.created_at)}</div>
                </div>
                <div className="text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${question.status === 'Closed' ? 'bg-red-100 text-red-700' : question.status === 'Answered' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'}`}>{question.status || 'Open'}</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-line text-sm text-zinc-800">{question.description}</div>
              {isAdmin && (
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={closeQuestion}>Close Question</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            {replies.map(r => (
              <ReplyCard key={r.id} r={r} onAccept={acceptReply} onMarkOfficial={markOfficial} isAdmin={isAdmin} />
            ))}
          </div>

          {question.status !== 'Closed' ? (
            <form onSubmit={postReply} className="mt-6">
              <div className="mb-2 text-sm font-medium">Your Answer</div>

              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={() => applyReplyWrapping('**', '**')} className="px-2 py-1 rounded border text-sm">B</button>
                <button type="button" onClick={() => applyReplyWrapping('*', '*')} className="px-2 py-1 rounded border text-sm">I</button>
                <button type="button" onClick={() => applyReplyWrapping('`', '`')} className="px-2 py-1 rounded border text-sm">Code</button>
                <button type="button" onClick={() => applyReplyWrapping('```\n', '\n```')} className="px-2 py-1 rounded border text-sm">Code Block</button>
                <button type="button" onClick={() => applyReplyWrapping('- ', '')} className="px-2 py-1 rounded border text-sm">• List</button>
                <button type="button" onClick={applyReplyLink} className="px-2 py-1 rounded border text-sm">Link</button>
                <label className="ml-2 flex items-center gap-2 text-sm cursor-pointer">
                  <input type="file" accept="image/*" onChange={e => handleReplyImageUpload(e.target.files)} className="hidden" />
                  <span className="px-2 py-1 rounded border">Attach Image</span>
                </label>
              </div>

              <div className="mt-2">
                <Textarea ref={replyRef} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write your helpful answer. Support official replies are marked." />
              </div>

              {replyAttachments.length > 0 && (
                <div className="mt-2 flex gap-2 items-center">
                  {replyAttachments.map((a, i) => (
                    <div key={i} className="text-xs text-slate-700 border rounded p-1 flex items-center gap-2">
                      <img src={a.url} alt={a.name} className="w-16 h-10 object-cover rounded" />
                      <div>{a.name}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center gap-3">
                <Button type="submit">Post Answer</Button>
                <Button variant="outline" asChild><Link to="/support/forum">Cancel</Link></Button>
                {error && <div className="text-sm text-red-600">{error}</div>}
              </div>
            </form>
          ) : (
            <div className="mt-6 text-sm text-muted-foreground">This question has been closed and cannot receive new replies.</div>
          )}
        </main>

        <aside className="lg:col-span-1 space-y-6">
          <Timeline entries={[
            { title: 'Asked', time: formatDate(question.created_at), targetId: 'question-header' },
            ...replies.map(r => ({ title: `${r.is_official ? 'Official reply' : 'Reply'} • ${r.author_name || 'Guest'}`, time: formatDate(r.created_at), targetId: r.id ? `reply-${r.id}` : null })),
            question.accepted_reply_id ? { title: 'Accepted answer', time: '', targetId: `reply-${question.accepted_reply_id}` } : null,
            question.status === 'Closed' ? { title: 'Closed', time: '', targetId: null } : null
          ].filter(Boolean)} />

          <RelatedThreads category={question.category} currentId={question.id} />
        </aside>
      </div>
    </div>
  );
}
