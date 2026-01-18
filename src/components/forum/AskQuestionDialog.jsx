import React, { useRef, useState } from 'react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const CATEGORIES = ['Electronics', 'DIY Kits', '3D Printing', 'Orders', 'General'];

const AskQuestionDialog = ({ onCreated }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState([]);
  const descRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e && e.preventDefault();
    if (!title.trim() || !description.trim()) return setError('Please provide a title and description.');
    setError(null);
    setLoading(true);
    try {
      // Ensure final description trimmed; attachments are embedded in description as markdown
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
      setOpen(false);
      setTitle(''); setDescription(''); setCategory(CATEGORIES[0]);
      if (onCreated) onCreated(data || payload);
    } catch (err) {
      console.error(err);
      setError('Unable to post question — the forum may not be available yet.');
    } finally {
      setLoading(false);
    }
  }

  // Simple textarea formatting helpers (markdown-style)
  function applyWrapping(before, after = before) {
    const el = descRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = description || '';
    const selected = val.slice(start, end) || 'text';
    const newVal = val.slice(0, start) + before + selected + after + val.slice(end);
    setDescription(newVal);
    // restore focus and selection
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + before.length + selected.length + after.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  function applyLink() {
    const el = descRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = description || '';
    const selected = val.slice(start, end) || 'link-text';
    const url = window.prompt('Enter URL (https://...)');
    if (!url) return;
    const md = `[${selected}](${url})`;
    const newVal = val.slice(0, start) + md + val.slice(end);
    setDescription(newVal);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + md.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  async function handleImageUpload(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const key = `forum/attachments/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    try {
      setLoading(true);
      const { data: up, error: upErr } = await supabase.storage.from('banners').upload(key, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;
      const { data: publicData } = supabase.storage.from('banners').getPublicUrl(key);
      const url = publicData?.publicUrl || publicData?.publicURL || '';
      if (url) {
        // insert markdown image at cursor
        const el = descRef.current;
        const pos = (el && el.selectionStart) || description.length;
        const md = `![${file.name}](${url})`;
        const newVal = description.slice(0, pos) + '\n\n' + md + '\n\n' + description.slice(pos);
        setDescription(newVal);
        setAttachments(prev => [...prev, { name: file.name, url }]);
      }
    } catch (e) {
      console.error('Upload failed', e);
      setError('Image upload failed. Check storage permissions.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Create Thread</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask a Question</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
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

            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={() => applyWrapping('**', '**')} className="px-2 py-1 rounded border text-sm">B</button>
              <button type="button" onClick={() => applyWrapping('*', '*')} className="px-2 py-1 rounded border text-sm">I</button>
              <button type="button" onClick={() => applyWrapping('`', '`')} className="px-2 py-1 rounded border text-sm">Code</button>
              <button type="button" onClick={() => applyWrapping('```\n', '\n```')} className="px-2 py-1 rounded border text-sm">Code Block</button>
              <button type="button" onClick={() => applyWrapping('- ', '')} className="px-2 py-1 rounded border text-sm">• List</button>
              <button type="button" onClick={applyLink} className="px-2 py-1 rounded border text-sm">Link</button>
              <label className="ml-2 flex items-center gap-2 text-sm cursor-pointer">
                <input type="file" accept="image/*" onChange={e => handleImageUpload(e.target.files)} className="hidden" />
                <span className="px-2 py-1 rounded border">Attach Image</span>
              </label>
            </div>

            <div className="mt-2">
              <Textarea ref={descRef} value={description} onChange={e => setDescription(e.target.value)} placeholder="Provide details, steps to reproduce, images, code, or error messages." />
            </div>

            {attachments.length > 0 && (
              <div className="mt-2 flex gap-2 items-center">
                {attachments.map((a, i) => (
                  <div key={i} className="text-xs text-slate-700 border rounded p-1 flex items-center gap-2">
                    <img src={a.url} alt={a.name} className="w-16 h-10 object-cover rounded" />
                    <div>{a.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 justify-end">
            {error && <div className="text-sm text-red-600 mr-auto">{error}</div>}
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Posting...' : 'Post Thread'}</Button>
          </div>
        </form>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
};

export default AskQuestionDialog;
