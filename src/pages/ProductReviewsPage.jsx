import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

const sortOptions = [
  { label: 'Latest', value: 'latest' },
  { label: 'Most Positive', value: 'positive' },
  { label: 'Most Negative', value: 'negative' },
];

const ReviewBreakdown = ({ reviews }) => {
  const counts = [1, 2, 3, 4, 5].map(star =>
    reviews.filter(r => r.rating === star).length
  );
  const total = reviews.length;
  return (
    <div className="flex flex-col gap-2 my-4">
      {[5, 4, 3, 2, 1].map(star => (
        <div key={star} className="flex items-center gap-2">
          <span className="w-8 text-sm font-medium">{star}★</span>
          <div className="flex-1 bg-gray-200 rounded h-3 overflow-hidden">
            <div
              className="bg-yellow-400 h-3 rounded"
              style={{ width: `${(counts[star - 1] / (total || 1)) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right text-xs">{counts[star - 1]}</span>
        </div>
      ))}
    </div>
  );
};

const ProductReviewsPage = () => {
  const { id } = useParams();
  const [reviews, setReviews] = useState([]);
  const [sort, setSort] = useState('latest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReviews() {
      setLoading(true);
      const { data } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', id);
      setReviews(data || []);
      setLoading(false);
    }
    fetchReviews();
  }, [id]);

  let sorted = [...reviews];
  if (sort === 'positive') sorted.sort((a, b) => b.rating - a.rating);
  else if (sort === 'negative') sorted.sort((a, b) => a.rating - b.rating);
  else sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="max-w-3xl mx-auto py-10 px-2">
      <h1 className="text-3xl font-bold mb-2">{reviews.length} Reviews</h1>
      <ReviewBreakdown reviews={reviews} />
      <div className="flex items-center gap-4 mb-6">
        <span className="font-medium">Sort by:</span>
        <select
          className="border rounded px-3 py-1"
          value={sort}
          onChange={e => setSort(e.target.value)}
        >
          {sortOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <div className="text-gray-400 py-8 text-center">Loading reviews...</div>
      ) : sorted.length === 0 ? (
        <div className="text-gray-400 py-8 text-center">No reviews yet.</div>
      ) : (
        <div className="flex flex-col gap-6">
          {sorted.map(review => (
            <div key={review.id} className="bg-white rounded-xl shadow p-6 border border-blue-50">
              <div className="flex items-center gap-3 mb-2">
                <img src={review.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(review.reviewer_name || 'User')}`} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
                <div className="flex flex-col">
                  <span className="font-semibold text-zinc-800 text-base">{review.reviewer_name || 'User'}</span>
                  <span className="text-gray-500 text-xs">{new Date(review.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-5 h-5 ${i < review.rating ? 'text-yellow-400' : 'text-gray-200'}`} fill={i < review.rating ? '#facc15' : 'none'} />
                  ))}
                </div>
              </div>
              <div className="text-gray-700 text-base mb-2">{review.review_text}</div>
              {review.images && Array.isArray(review.images) && review.images.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {review.images.map((img, idx) => {
                    let url = img;
                    if (url && !/^https?:\/\//i.test(url)) {
                      url = `https://wruysjrqadlsljnkmnte.supabase.co/storage/v1/object/public/review-images/${url.replace(/^\/+/, '')}`;
                    }
                    return (
                      <img
                        key={idx}
                        src={url}
                        alt={`Review image ${idx + 1}`}
                        className="w-20 h-20 object-cover rounded border"
                        loading="lazy"
                        onError={e => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1585592049294-8f466326930a'; }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductReviewsPage;
