import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import { Calendar, Eye, MessageCircle, Heart } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const QuestionCard = ({ q, interactive = true }) => {
  const [localLikes, setLocalLikes] = useState(q?.likes || 0);
  const [isLikedLocal, setIsLikedLocal] = useState(q?.is_liked || false);

  // keep local state in sync if parent updates the question counts/status
  React.useEffect(() => {
    if (typeof q?.likes !== 'undefined') setLocalLikes(q.likes || 0);
    if (typeof q?.is_liked !== 'undefined') setIsLikedLocal(Boolean(q.is_liked));
  }, [q?.likes, q?.is_liked]);

  const statusClass = q?.status === 'Closed'
    ? 'bg-red-100 text-red-700'
    : q?.status === 'Answered'
      ? 'bg-emerald-100 text-emerald-800'
      : 'bg-yellow-100 text-yellow-800';

  const { user } = useAuth();

  async function handleCardClick(e) {
    // mark as viewed in session so thread page doesn't double-increment
    try {
      if (q?.id) {
        sessionStorage.setItem(`forum_viewed_${q.id}`, '1');
      }
    } catch (err) {
      // ignore
    }
  }

  async function handleLike(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!q?.id) return;
    if (!user || !user.id) return; // must be signed in to like
    try {
      // Toggle like via RPC which returns authoritative state and likes count
      const { data, error } = await supabase.rpc('toggle_like', { uid: user.id, itype: 'question', iid: q.id });
      console.debug('toggle_like rpc question:', { data, error });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setIsLikedLocal(Boolean(row.is_liked));
        setLocalLikes(Number(row.likes_count || 0));
        // notify other parts of the app so lists/threads can update UI without refetch
        try { window.dispatchEvent(new CustomEvent('forum:like-changed', { detail: { item_type: 'question', item_id: q.id, likes_count: Number(row.likes_count || 0), is_liked: Boolean(row.is_liked) } })); } catch (e) {}
      } else {
        // fallback: read authoritative count
        try {
          const { data: fresh, error: freshe } = await supabase.from('support_forum_questions').select('likes').eq('id', q.id).maybeSingle();
          if (!freshe && fresh) setLocalLikes(fresh.likes || 0);
        } catch (fetchErr) { console.warn('Failed to fetch question likes fallback', fetchErr); }
      }
    } catch (err) {
      console.warn('Like toggle failed', err);
    }
  }

  return (
    <Link to={`/support/forum/${q?.id || ''}`} onClick={handleCardClick} className="block">
      <div className="cursor-pointer hover:shadow-md transition rounded-lg border bg-white px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <Avatar name={q?.author_name} src={q?.avatar_url} size={40} className="rounded-full" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900 truncate">{q?.title}</h3>
              <span className={`ml-2 shrink-0 px-2 py-0.5 rounded text-xs font-medium ${statusClass}`}>{q?.status || 'Open'}</span>
            </div>

            <div className="mt-1 text-sm text-slate-600 flex items-center gap-2 truncate">
              <span className="text-xs inline-flex items-center gap-1"><strong className="text-slate-800">{q?.author_name || 'Guest'}</strong> • {q?.created_at ? new Date(q.created_at).toLocaleDateString() : ''}</span>
            </div>

            <p className="mt-2 text-sm text-slate-700 line-clamp-1 whitespace-pre-line">{q?.description}</p>

            <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1"><Calendar className="w-4 h-4" />{q?.replies_count || 0} replies</span>
              <span className="inline-flex items-center gap-1"><Eye className="w-4 h-4" />{q?.views || 0}</span>
              <span className="inline-flex items-center gap-1"><MessageCircle className="w-4 h-4" />{q?.comments || 0}</span>
              {interactive ? (
                <button type="button" onClick={handleLike} className={`inline-flex items-center gap-1 text-xs ${(isLikedLocal || q?.is_liked) ? 'text-red-600' : 'text-slate-500'}`} aria-pressed={Boolean(isLikedLocal || q?.is_liked)}>
                  <Heart className="w-4 h-4" />{ typeof q?.likes !== 'undefined' ? q.likes : localLikes }
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Heart className="w-4 h-4" />{ typeof q?.likes !== 'undefined' ? q.likes : localLikes }</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default QuestionCard;
