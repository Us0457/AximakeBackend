import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Star } from 'lucide-react';

const ProductRatingSummary = ({ productId }) => {
  const [avg, setAvg] = useState(null);
  const [count, setCount] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchRating() {
      const { data, error } = await supabase
        .from('reviews')
        .select('rating')
        .eq('product_id', productId);
      if (!error && isMounted) {
        const ratings = (data || []).map(r => r.rating).filter(Boolean);
        if (ratings.length) {
          const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
          setAvg(avgRating);
          setCount(ratings.length);
        } else {
          setAvg(null);
          setCount(0);
        }
      }
    }
    if (productId) fetchRating();
    return () => { isMounted = false; };
  }, [productId]);

  if (avg === null) return null;
  return (
    <span className="flex items-center gap-1 text-yellow-600 font-semibold text-sm">
      {avg.toFixed(1)}
      <span className="flex items-center ml-1">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className={`w-4 h-4 ${i < Math.round(avg) ? 'text-yellow-400' : 'text-gray-200'}`} fill={i < Math.round(avg) ? '#facc15' : 'none'} />
        ))}
      </span>
      <span className="text-gray-600 font-medium ml-1">({count})</span>
    </span>
  );
};

export default ProductRatingSummary;
