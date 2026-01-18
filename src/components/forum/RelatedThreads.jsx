import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import { supabase } from '@/lib/supabaseClient';

const RelatedThreads = ({ category, currentId }) => {
  const [threads, setThreads] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function fetchRelated() {
      try {
        const { data } = await supabase
          .from('support_forum_questions')
          .select('id,title,category,created_at,author_name,replies_count,views,likes,comments,status')
          .eq('category', category)
          .order('created_at', { ascending: false })
          .limit(6);
        if (mounted) setThreads((data || []).filter(t => String(t.id) !== String(currentId)).slice(0, 6));
      } catch (e) { console.error(e); }
    }
    if (category) fetchRelated();
    return () => { mounted = false; };
  }, [category, currentId]);

  if (!threads || threads.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Related Threads</h4>
      <div className="space-y-2">
        {threads.map(t => (
          <Link to={`/support/forum/${t.id}`} key={t.id} className="block rounded-md border bg-white p-2 hover:shadow-sm">
            <div className="flex items-center gap-2">
              <Avatar name={t.author_name} size={36} />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 truncate">{t.title}</div>
                <div className="text-xs text-muted-foreground">{t.replies_count || 0} replies • {t.views || 0} views</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default RelatedThreads;
