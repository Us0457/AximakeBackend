import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

function formatDate(d) { try { return new Date(d).toLocaleString(); } catch { return '-'; } }

export default function SupportThreadPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [question, setQuestion] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { document.title = question ? `${question.title} — Support — Aximake` : 'Support Thread — Aximake'; }, [question]);

  useEffect(() => {
    async function fetchThread() {
      setLoading(true);
      try {
        const { data: q } = await supabase
          .from('support_forum_questions')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        setQuestion(q || null);

        const { data: rs } = await supabase
          .from('support_forum_replies')
          .select('*')
          .eq('question_id', id)
          .order('created_at', { ascending: true });
        setReplies(rs || []);

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
    }
    if (id) fetchThread();
  }, [id, user]);

  async function postReply(e) {
    e.preventDefault();
    if (!replyText.trim()) return;
    try {
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
      // Update replies_count on question (best-effort)
      await supabase.from('support_forum_questions').update({ replies_count: (question?.replies_count || 0) + 1 }).eq('id', id);
      setQuestion(prev => ({ ...(prev || {}), replies_count: (prev?.replies_count || 0) + 1 }));
    } catch (e) {
      console.error(e);
      setError('Failed to post reply');
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
    <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-8 max-w-3xl">
      <div className="mb-4">
        <Link to="/support/forum" className="text-sm text-primary hover:underline">← Back to Forum</Link>
      </div>
      <Card className="mb-4">
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
          <Card key={r.id} className={`${r.is_accepted ? 'border-2 border-emerald-200' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <div>
                  <div className="font-medium">{r.author_name || 'Guest'}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(r.created_at)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {r.is_official && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Official</span>}
                  {r.is_accepted && <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded">Accepted</span>}
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => markOfficial(r.id, !r.is_official)}>{r.is_official ? 'Unmark Official' : 'Mark Official'}</Button>
                      <Button size="sm" onClick={() => acceptReply(r.id)}>Accept</Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm whitespace-pre-line">{r.content}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {question.status !== 'Closed' ? (
        <form onSubmit={postReply} className="mt-6">
          <div className="mb-2 text-sm font-medium">Your Answer</div>
          <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write your helpful answer. Support official replies are marked." />
          <div className="mt-3 flex items-center gap-3">
            <Button type="submit">Post Answer</Button>
            <Button variant="outline" asChild><Link to="/support/forum">Cancel</Link></Button>
            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>
        </form>
      ) : (
        <div className="mt-6 text-sm text-muted-foreground">This question has been closed and cannot receive new replies.</div>
      )}
    </div>
  );
}
