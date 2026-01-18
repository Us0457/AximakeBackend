import React, { useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import Avatar from './Avatar';
import { Heart } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const ReplyCard = ({ r, onAccept, onMarkOfficial, isAdmin }) => {
  const { user } = useAuth();
  const [localLikes, setLocalLikes] = useState(r?.likes || 0);
  const [isLikedLocal, setIsLikedLocal] = useState(r?.is_liked || false);
  const [likers, setLikers] = useState([]);
  const [likersLoading, setLikersLoading] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const likerTimerRef = React.useRef(null);

  // keep local state in sync if parent updates the reply props
  React.useEffect(() => {
    if (typeof r?.likes !== 'undefined') setLocalLikes(r.likes || 0);
    if (typeof r?.is_liked !== 'undefined') setIsLikedLocal(Boolean(r.is_liked));
  }, [r?.likes, r?.is_liked]);

  async function handleLike(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!r?.id || !user || !user.id) return;
    try {
      const { data, error } = await supabase.rpc('toggle_like', { uid: user.id, itype: 'reply', iid: r.id });
      console.debug('toggle_like rpc reply:', { data, error });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        // Use authoritative counts returned from RPC when available
        const likesCount = typeof row.likes_count !== 'undefined' ? Number(row.likes_count) : (r.likes || 0);
        setLocalLikes(likesCount);
        setIsLikedLocal(Boolean(row.is_liked));
        try {
          window.dispatchEvent(new CustomEvent('forum:like-changed', { detail: { item_type: 'reply', item_id: r.id, question_id: r.question_id, likes_count: likesCount, is_liked: Boolean(row.is_liked) } }));
        } catch (e) {}
        // refresh likers list after change
        fetchLikers().catch(() => {});
      } else {
        // RPC returned no row (possible RLS or no-op); fetch authoritative likes count as fallback
        try {
          const { data: fresh, error: freshe } = await supabase.from('support_forum_replies').select('likes').eq('id', r.id).maybeSingle();
          if (!freshe && fresh) {
            setLocalLikes(fresh.likes || 0);
          }
        } catch (fetchErr) {
          console.warn('Failed to fetch fallback likes count', fetchErr);
        }
      }
    } catch (err) {
      console.warn('Reply like toggle failed', err);
    }
  }

  // fetch likers for this reply (profiles)
  async function fetchLikers() {
    if (!r?.id) return;
    setLikersLoading(true);
    try {
      const { data: likesRows, error } = await supabase.from('support_forum_likes').select('user_id').eq('item_id', r.id).limit(1000);
      if (error) throw error;
      const ids = (likesRows || []).map(x => x.user_id).filter(Boolean).map(id => String(id));
      if (ids.length === 0) {
        setLikers([]);
        setLikersLoading(false);
        return;
      }
      const { data: profiles, error: perr } = await supabase.from('profiles').select('id,first_name,avatar_url').in('id', ids);
      if (perr) throw perr;
      const byId = (profiles || []).reduce((acc, p) => { acc[String(p.id)] = p; return acc; }, {});
      // For any missing profile rows (e.g., social logins), attempt to fetch from auth `users` table as a fallback
      const missing = ids.filter(id => !byId[id]);
      if (missing.length > 0) {
        try {
          // try common locations where Supabase exposes auth users
          const { data: authUsers } = await supabase.from('users').select('id,raw_user_meta_data,user_metadata,email').in('id', missing);
          if (authUsers && authUsers.length > 0) {
            authUsers.forEach(u => {
              try {
                const meta = u.raw_user_meta_data || u.user_metadata || {};
                const m = typeof meta === 'string' ? JSON.parse(meta) : (meta || {});
                const name = m.first_name || m.firstName || m.name || m.full_name || m.displayName || m.name || (u.email ? u.email.split('@')[0] : 'User');
                const avatar = m.avatar_url || m.picture || m.photoURL || m.avatar || null;
                byId[String(u.id)] = { id: u.id, first_name: name, avatar_url: avatar };
              } catch (e) {
                byId[String(u.id)] = { id: u.id, first_name: 'User', avatar_url: null };
              }
            });
          }
        } catch (e) {
          // ignore fallback failures
        }
      }
      // Preserve the exact order from likes rows and include placeholders when a profile is missing
      const ordered = ids.map(id => (byId[id] ? byId[id] : { id, first_name: 'User', avatar_url: null }));
      setLikers(ordered);
    } catch (e) {
      console.warn('Failed to fetch likers', e);
      setLikers([]);
    }
    setLikersLoading(false);
  }

  return (
    <div id={r.id ? `reply-${r.id}` : undefined} className={`rounded-lg border bg-white p-4 ${r.is_accepted ? 'ring-2 ring-emerald-200' : ''}`}>
      <div className="flex items-start gap-3">
        <Avatar name={r.author_name} src={r.avatar_url} size={44} />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium text-slate-900">{r.author_name || 'Guest'}</div>
              <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-2">
              {r.is_official && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Official</span>}
              {r.is_accepted && <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded">Accepted</span>}
              <div className="relative">
                <button
                  type="button"
                  onClick={handleLike}
                  onMouseEnter={() => {
                    likerTimerRef.current = setTimeout(() => { setShowLikers(true); fetchLikers().catch(() => {}); }, 250);
                  }}
                  onMouseLeave={() => {
                    if (likerTimerRef.current) { clearTimeout(likerTimerRef.current); likerTimerRef.current = null; }
                    setShowLikers(false);
                  }}
                  className={`inline-flex items-center gap-2 text-sm px-2 py-1 border rounded ${(isLikedLocal || r?.is_liked) ? 'text-red-600' : 'text-slate-600'}`}
                  aria-pressed={Boolean(isLikedLocal || r?.is_liked)}
                >
                  <Heart className="w-4 h-4" />{ localLikes }
                </button>

                {showLikers && (
                  <div className="absolute right-0 z-50 mt-2 w-56 bg-white border rounded shadow p-2 text-xs">
                    <div className="font-semibold mb-1">Liked by</div>
                    {likersLoading ? (
                      <div className="text-slate-500">Loading…</div>
                    ) : likers.length === 0 ? (
                      <div className="text-slate-500">No likes yet</div>
                    ) : (
                          <div className="space-y-1 max-h-56 overflow-auto">
                        {likers.map(u => (
                          <div key={u.id} className="flex items-center gap-2">
                            {u.avatar_url ? <img src={u.avatar_url} alt={u.first_name} className="w-6 h-6 rounded-full object-cover" /> : <div className="w-6 h-6 rounded-full bg-slate-200" />}
                            <div>{u.first_name || 'User'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button onClick={() => onMarkOfficial && onMarkOfficial(r.id)} className="text-sm text-slate-600 px-2 py-1 border rounded">{r.is_official ? 'Unmark' : 'Mark'}</button>
                  <button onClick={() => onAccept && onAccept(r.id)} className="text-sm bg-sky-600 text-white px-2 py-1 rounded">Accept</button>
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 text-sm text-slate-800">
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: React.useMemo(() => {
              try {
                const raw = marked.parse(r.content || '');
                const parser = new DOMParser();
                const doc = parser.parseFromString(raw, 'text/html');
                // transform images into small thumbnails wrapped in links to the full image
                doc.querySelectorAll('img').forEach(img => {
                  const src = img.getAttribute('src') || img.src;
                  img.classList.add('w-32', 'h-20', 'object-cover', 'rounded', 'cursor-pointer');
                  const a = doc.createElement('a');
                  a.setAttribute('href', src);
                  a.setAttribute('target', '_blank');
                  a.setAttribute('rel', 'noopener noreferrer');
                  img.parentNode.replaceChild(a, img);
                  a.appendChild(img);
                });
                return DOMPurify.sanitize(doc.body.innerHTML || '');
              } catch (e) {
                return DOMPurify.sanitize(marked.parse(r.content || ''));
              }
            }, [r.content]) }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReplyCard;
