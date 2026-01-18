import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
// UI primitives used in the dialog and cards; dialog component handles the create form.
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import QuestionCard from '@/components/forum/QuestionCard';
import AskQuestionDialog from '@/components/forum/AskQuestionDialog';

const CATEGORIES = ['Electronics', 'DIY Kits', '3D Printing', 'Orders', 'General'];

function formatDate(d) {
  try { return new Date(d).toLocaleString(); } catch { return '-'; }
}

const SupportForumPage = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [allQuestions, setAllQuestions] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = 'Tech Support Forum — Aximake';
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, []);

  // re-fetch when likes change elsewhere (questions or replies)
  useEffect(() => {
    function onLikeChanged(e) {
      try { fetchQuestions(); } catch (err) { /* ignore */ }
    }
    window.addEventListener('forum:like-changed', onLikeChanged);
    function onReplyChanged(ev) {
      try {
        const d = ev && ev.detail ? ev.detail : null;
        if (!d || !d.question_id) return;
        setQuestions(prev => (prev || []).map(q => q.id === d.question_id ? ({ ...q, replies_count: (Number(q.replies_count) || 0) + 1 }) : q));
      } catch (err) { /* ignore */ }
    }
    window.addEventListener('forum:reply-changed', onReplyChanged);
    return () => window.removeEventListener('forum:like-changed', onLikeChanged);
  }, []);

  async function fetchQuestions() {
    setLoading(true);
    setError(null);
    try {
      // Attempt to fetch from Supabase table `support_forum_questions` (if available)
      const { data, error } = await supabase
        .from('support_forum_questions')
        .select('id,title,category,description,created_at,status,author_id,author_name,replies_count,views,likes,comments')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) {
        // If table not present, fall back to empty list
        console.debug('Support fetch error', error.message || error);
        setQuestions([]);
      } else {
        const rows = data || [];
        try {
          const authorIds = Array.from(new Set(rows.filter(r => r.author_id).map(r => r.author_id)));
          if (authorIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id,first_name,avatar_url').in('id', authorIds);
            const byId = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
            const enriched = rows.map(r => {
              const p = r.author_id ? byId[r.author_id] : null;
              return {
                ...r,
                author_name: p ? (p.first_name || r.author_name) : (r.author_name || 'Guest'),
                avatar_url: p ? p.avatar_url : r.avatar_url,
              };
            });
            // mark liked state for current user if available
            if (user && enriched.length > 0) {
              try {
                const ids = enriched.map(x => x.id).filter(Boolean);
                const { data: likes } = await supabase.from('support_forum_likes').select('item_id').eq('user_id', user.id).eq('item_type', 'question').in('item_id', ids);
                const likedSet = new Set((likes || []).map(l => String(l.item_id)));
                enriched.forEach(e => { e.is_liked = likedSet.has(String(e.id)); });
              } catch (e) {
                // ignore likes fetch error
              }
              // also include likes on replies in the total shown on the list page by aggregating support_forum_likes
              try {
                const qids = enriched.map(x => x.id).filter(Boolean);
                if (qids.length > 0) {
                  // get replies for these questions
                  const { data: repliesForQ } = await supabase.from('support_forum_replies').select('id,question_id').in('question_id', qids).limit(1000);
                  const replyMap = (repliesForQ || []).reduce((acc, r) => { acc[r.id] = r.question_id; return acc; }, {});
                  const replyIds = Object.keys(replyMap);
                  if (replyIds.length > 0) {
                    const { data: replyLikeRows } = await supabase.from('support_forum_likes').select('item_id').eq('item_type', 'reply').in('item_id', replyIds).limit(10000);
                    const sums = (replyLikeRows || []).reduce((acc, row) => {
                      const qid = String(replyMap[String(row.item_id)]);
                      acc[qid] = (acc[qid] || 0) + 1;
                      return acc;
                    }, {});
                    // also include question-level likes
                    const { data: qLikeRows } = await supabase.from('support_forum_likes').select('item_id').eq('item_type', 'question').in('item_id', qids).limit(10000);
                    const qCounts = (qLikeRows || []).reduce((acc, row) => { const k = String(row.item_id); acc[k] = (acc[k] || 0) + 1; return acc; }, {});

                    enriched.forEach(e => { e.likes = (Number(qCounts[String(e.id)]) || 0) + (sums[String(e.id)] || 0); });
                  }
                    // include reply likes totals by aggregating support_forum_likes
                    try {
                      const qids = enriched.map(x => x.id).filter(Boolean);
                      if (qids.length > 0) {
                        const { data: repliesForQ } = await supabase.from('support_forum_replies').select('id,question_id').in('question_id', qids).limit(1000);
                        const replyMap = (repliesForQ || []).reduce((acc, r) => { acc[r.id] = r.question_id; return acc; }, {});
                        const replyIds = Object.keys(replyMap);
                        if (replyIds.length > 0) {
                          const { data: replyLikeRows } = await supabase.from('support_forum_likes').select('item_id').eq('item_type', 'reply').in('item_id', replyIds).limit(10000);
                          const sums = (replyLikeRows || []).reduce((acc, row) => {
                            const qid = String(replyMap[String(row.item_id)]);
                            acc[qid] = (acc[qid] || 0) + 1;
                            return acc;
                          }, {});
                          const { data: qLikeRows } = await supabase.from('support_forum_likes').select('item_id').eq('item_type', 'question').in('item_id', qids).limit(10000);
                          const qCounts = (qLikeRows || []).reduce((acc, row) => { const k = String(row.item_id); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
                          enriched.forEach(e => { e.likes = (Number(qCounts[String(e.id)]) || 0) + (sums[String(e.id)] || 0); });
                        }
                      }
                    } catch (e) { console.warn('Failed to fetch reply likes sums', e); }
                }
              } catch (e) {
                console.warn('Failed to fetch reply likes sums', e);
              }
            }
            setQuestions(enriched);
            setAllQuestions(enriched);
          } else {
            setQuestions(rows);
            setAllQuestions(rows);
          }
        } catch (e) {
          console.error('Profile enrichment error', e);
          setQuestions(rows);
        }
      }
    } catch (e) {
      console.error(e);
      setError('Failed to load forum.');
    }
    setLoading(false);
  }

  async function searchQuestions() {
    const term = (search || '').trim();
    if (!term) return fetchQuestions();
    setLoading(true);
    try {
      // Search title and description using ilike
      const pattern = `%${term}%`;
      const { data, error } = await supabase
        .from('support_forum_questions')
        .select('id,title,category,description,created_at,status,author_id,author_name,replies_count,views,likes,comments')
        .or(`title.ilike.${pattern},description.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) {
        console.debug('Search error', error.message || error);
        setQuestions([]);
      } else {
        const rows = data || [];
        try {
          const authorIds = Array.from(new Set(rows.filter(r => r.author_id).map(r => r.author_id)));
          if (authorIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id,first_name,avatar_url').in('id', authorIds);
            const byId = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
            const enriched = rows.map(r => {
              const p = r.author_id ? byId[r.author_id] : null;
              return {
                ...r,
                author_name: p ? (p.first_name || r.author_name) : (r.author_name || 'Guest'),
                avatar_url: p ? p.avatar_url : r.avatar_url,
              };
            });
            if (user && enriched.length > 0) {
              try {
                const ids = enriched.map(x => x.id).filter(Boolean);
                const { data: likes } = await supabase.from('support_forum_likes').select('item_id').eq('user_id', user.id).eq('item_type', 'question').in('item_id', ids);
                const likedSet = new Set((likes || []).map(l => String(l.item_id)));
                enriched.forEach(e => { e.is_liked = likedSet.has(String(e.id)); });
              } catch (e) {}
              // include reply likes totals
              try {
                const qids = enriched.map(x => x.id).filter(Boolean);
                if (qids.length > 0) {
                  const { data: replyRows } = await supabase.from('support_forum_replies').select('question_id,likes').in('question_id', qids);
                  const sums = (replyRows || []).reduce((acc, r) => {
                    const k = String(r.question_id);
                    acc[k] = (acc[k] || 0) + (Number(r.likes) || 0);
                    return acc;
                  }, {});
                  enriched.forEach(e => { e.likes = (Number(e.likes) || 0) + (sums[String(e.id)] || 0); });
                }
              } catch (e) { console.warn('Failed to fetch reply likes sums', e); }
            }
            setQuestions(enriched);
            setAllQuestions(enriched);
          } else {
            setQuestions(rows);
            setAllQuestions(rows);
          }
        } catch (e) {
          console.error('Profile enrichment error', e);
          setQuestions(rows);
        }
      }
    } catch (e) {
      console.error(e);
      setError('Search failed.');
    }
    setLoading(false);
  }

  function fuzzyMatch(query, text) {
    if (!query) return true;
    if (!text) return false;
    const q = query.toLowerCase().trim();
    const t = text.toLowerCase();
    // direct contains
    if (t.includes(q)) return true;
    // subsequence fuzzy: all chars of q appear in t in order
    let qi = 0;
    for (let i = 0; i < t.length && qi < q.length; i++) {
      if (t[i] === q[qi]) qi++;
    }
    return qi === q.length;
  }

  function handleSearchChange(value) {
    setSearch(value);
    const term = (value || '').trim();
    if (!term) {
      setQuestions(allQuestions || []);
      return;
    }
    const filtered = (allQuestions || []).filter(q => (
      fuzzyMatch(term, q.title) || fuzzyMatch(term, q.description) || fuzzyMatch(term, q.author_name)
    ));
    setQuestions(filtered);
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">Tech Support Forum</h1>
          <div className="text-sm text-muted-foreground mt-2">Ask questions, get help from the community and official Aximake guidance.</div>
        </div>
        <div className="flex w-full flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="w-full sm:w-80">
            <input value={search} onChange={e => handleSearchChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') searchQuestions(); }} placeholder="Search threads, titles, and content" className="w-full border px-4 py-2.5 rounded" />
          </div>
          <div className="w-full sm:w-auto flex sm:justify-end">
            <AskQuestionDialog onCreated={() => fetchQuestions()} />
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Recent Questions</h2>
        <div className="text-sm text-muted-foreground">{loading ? 'Loading...' : `${questions.length} questions`}</div>
      </div>

      <div>
        {questions.length === 0 && !loading ? (
          <div className="text-sm text-muted-foreground">No questions yet — be the first to ask!</div>
        ) : (
          <div className="space-y-4">
            {questions.map(q => (
              <div key={q.id || q.title} className="w-full">
                <QuestionCard q={q} interactive={false} />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-8 text-sm text-zinc-600">
        <strong>Community Guidelines:</strong> Be respectful and helpful. Community answers are shared experiences; official Aximake responses are marked as <em>Official</em>.
      </div>
    </div>
  );
};

export default SupportForumPage;
