import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FileText, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const YourQuotesPage = () => {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!user) {
      setQuotes([]);
      setLoading(false);
      return;
    }
    const fetchQuotes = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('quotes')
        .select('id, file_name, material, color, infill, price, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setQuotes(error ? [] : data || []);
      setLoading(false);
    };
    fetchQuotes();
  }, [user]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this quote?')) return;
    setDeletingId(id);
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (!error) {
      setQuotes((prev) => prev.filter((q) => q.id !== id));
    }
    setDeletingId(null);
  };

  return (
    <div className="container mx-auto py-0 px-2 sm:px-4 lg:px-6">
      <h1 className="text-3xl font-bold mb-8 gradient-text text-center">Your Quotes</h1>  
    
        {loading ? (
          <div className="text-muted-foreground text-center py-8">Loading...</div>
        ) : quotes.length === 0 ? (
          <div className="text-muted-foreground text-center py-8">No quotes found. Upload a file or request a quote to get started.</div>
        ) : (
          <div className="space-y-4">
            {quotes.map((q) => (
              <div key={q.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between bg-background/80">
                <div>
                  <div className="font-semibold text-lg">{q.file_name}</div>
                  <div className="text-xs text-muted-foreground mb-1">Material: {q.material?.toUpperCase()} | Infill: {q.infill}%</div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-block w-4 h-4 rounded-full border border-gray-300 align-middle" style={{ background: q.color }}></span>
                    <span>Color</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Requested: {q.created_at?.slice(0, 10)}</div>
                </div>
                <div className="mt-2 md:mt-0 md:text-right flex flex-col items-end gap-2">
                  <div className="text-xl font-bold text-primary">₹{q.price}</div>
                  <Trash2
                    className={`w-5 h-5 cursor-pointer transition-colors ${deletingId === q.id ? 'opacity-50 pointer-events-none' : 'hover:text-red-600 text-muted-foreground'}`}
                    onClick={() => deletingId !== q.id && handleDelete(q.id)}
                    title="Delete quote"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
};

export default YourQuotesPage;
