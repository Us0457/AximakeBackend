import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';

const CATEGORIES = ['Electronics', 'DIY Kits', '3D Printing', 'Orders', 'General'];

function formatDate(d) {
  try { return new Date(d).toLocaleString(); } catch { return '-'; }
}

const SupportForumPage = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = 'Tech Support Forum — Aximake';
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, []);

  async function fetchQuestions() {
    setLoading(true);
    setError(null);
    try {
      // Attempt to fetch from Supabase table `support_forum_questions` (if available)
      const { data, error } = await supabase
        .from('support_forum_questions')
        .select('id,title,category,description,created_at,status,author_id,author_name,replies_count')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) {
        // If table not present, fall back to empty list
        console.debug('Support fetch error', error.message || error);
        setQuestions([]);
      } else {
        setQuestions(data || []);
      }
    } catch (e) {
      console.error(e);
      setError('Failed to load forum.');
    }
    setLoading(false);
  }

  async function handleAskQuestion(e) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return setError('Please provide a title and description.');
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        category,
        description: description.trim(),
        status: 'Open',
        author_id: user ? user.id : null,
        author_name: user ? (user.user_metadata?.name || user.email) : 'Guest',
      };
      const { data, error } = await supabase.from('support_forum_questions').insert(payload).select().maybeSingle();
      if (error) throw error;
      // Prepend newly created question to UI list
      setQuestions(prev => [data || payload, ...(prev || [])]);
      setTitle(''); setDescription(''); setCategory(CATEGORIES[0]);
    } catch (e) {
      console.error(e);
      setError('Unable to post question — the forum may not be available yet.');
    }
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-primary">Tech Support Forum</h1>
        <div className="text-sm text-muted-foreground">Ask questions, get help from the community and official Aximake guidance.</div>
      </div>

      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Ask a Question</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAskQuestion} className="space-y-3">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Short, clear question title" />
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border rounded px-3 py-2">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Provide details, steps to reproduce, images, code, or error messages." />
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit">Ask Question</Button>
                <Button variant="outline" asChild><Link to="/faq">See FAQs</Link></Button>
                {error && <div className="text-sm text-red-600">{error}</div>}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Questions</h2>
          <div className="text-sm text-muted-foreground">{loading ? 'Loading...' : `${questions.length} questions`}</div>
        </div>
        <div className="space-y-3">
          {questions.length === 0 && !loading ? (
            <div className="text-sm text-muted-foreground">No questions yet — be the first to ask!</div>
          ) : (
            questions.map(q => (
              <Card key={q.id || q.title}>
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <Link to={`/support/forum/${q.id || ''}`} className="text-lg font-semibold text-primary hover:underline">{q.title}</Link>
                      <div className="text-xs text-muted-foreground">{q.category} • asked by {q.author_name || 'Guest'} • {formatDate(q.created_at)}</div>
                    </div>
                    <div className="text-sm">
                      <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-medium">{q.status || 'Open'}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-zinc-700 line-clamp-4 whitespace-pre-line">{q.description}</div>
                  <div className="mt-3 text-xs text-muted-foreground">{(q.replies_count || 0)} replies</div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
      <div className="mt-8 text-sm text-zinc-600">
        <strong>Community Guidelines:</strong> Be respectful and helpful. Community answers are shared experiences; official Aximake responses are marked as <em>Official</em>.
      </div>
    </div>
  );
};

export default SupportForumPage;
