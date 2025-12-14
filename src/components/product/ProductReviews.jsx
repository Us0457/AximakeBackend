import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Star } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const ProductReviews = ({ productId, showSummaryOnly, limit }) => {
  const [reviews, setReviews] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReviews() {
      setLoading(true);
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
      setReviews(data || []);
      setLoading(false);
    }
    if (productId) fetchReviews();
  }, [productId]);

  if (loading) return showSummaryOnly ? null : <div className="text-center text-gray-400 py-6">Loading reviews...</div>;
  if (!reviews.length) return showSummaryOnly ? null : <div className="text-center text-gray-400 py-6">No reviews yet.</div>;

  // Calculate average rating
  const avgRating = (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1);

  if (showSummaryOnly) {
    // Always show 5 stars, fill based on average rating
    return (
      <span className="flex items-center gap-1 text-yellow-600 font-semibold text-base ml-2">
        {avgRating}
        <span className="flex items-center ml-1">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className={`w-5 h-5 ${i < Math.round(avgRating) ? 'text-yellow-400' : 'text-gray-200'}`} fill={i < Math.round(avgRating) ? '#facc15' : 'none'} />
          ))}
        </span>
        <span className="text-gray-600 font-medium">({reviews.length})</span>
      </span>
    );
  }

  // If limit is set, only show the latest N reviews
  const displayReviews = limit ? reviews.slice(0, limit) : reviews;

  return (
    <div className="mt-10">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl font-bold text-yellow-500 flex items-center">
          {avgRating} <Star className="w-6 h-6 ml-1 text-yellow-400" fill="#facc15" />
        </span>
        <span className="text-gray-600 font-medium">({reviews.length} review{reviews.length > 1 ? 's' : ''})</span>
        {!limit && (
          <button
            className="ml-auto text-blue-600 underline text-sm font-medium"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? 'Hide Reviews' : 'Show All Reviews'}
          </button>
        )}
      </div>
      <div className={`transition-all duration-300 ${expanded || limit ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayReviews.map((review) => {
            // Robustly parse review.images to always get an array of image paths/urls
            let images = [];
            if (Array.isArray(review.images)) {
              images = review.images;
            } else if (typeof review.images === 'string' && review.images.trim() !== '') {
              try {
                const parsed = JSON.parse(review.images);
                if (Array.isArray(parsed)) {
                  images = parsed.filter(Boolean);
                } else if (typeof parsed === 'string') {
                  images = [parsed];
                } else {
                  images = [review.images];
                }
              } catch {
                if (review.images.includes(',')) {
                  images = review.images.split(',').map(s => s.trim()).filter(Boolean);
                } else {
                  images = [review.images];
                }
              }
            }
            images = images.filter(img => typeof img === 'string' && img.trim());
            return (
              <div key={review.id} className="bg-white rounded-xl shadow p-6 flex flex-col gap-3 border border-blue-50">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="w-10 h-10">
                    {review.avatar_url ? (
                      <img
                        src={review.avatar_url}
                        alt={review.reviewer_name || 'User Avatar'}
                        className="w-10 h-10 object-cover rounded-full"
                        onError={e => { e.target.onerror = null; e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(review.reviewer_name || 'User'); }}
                      />
                    ) : (
                      <AvatarFallback>{review.reviewer_name ? review.reviewer_name.substring(0,2).toUpperCase() : (review.user_name ? review.user_name.substring(0,2).toUpperCase() : (review.user_email ? review.user_email.substring(0,2).toUpperCase() : 'U'))}</AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-semibold text-zinc-800 text-base">{review.reviewer_name || review.user_name || review.user_email || 'User'}</span>
                    <span className="text-gray-500 text-xs">{new Date(review.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-5 h-5 ${i < review.rating ? 'text-yellow-400' : 'text-gray-200'}`} fill={i < review.rating ? '#facc15' : 'none'} />
                    ))}
                  </div>
                </div>
                <div className="text-gray-700 text-base mb-2">{review.review_text}</div>
                {images.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    {images.map((img, idx) => {
                      let url = img;
                      if (url && !/^https?:\/\//i.test(url)) {
                        url = `https://wruysjrqadlsljnkmnte.supabase.co/storage/v1/object/public/review-images/${url.replace(/^\/+/, '')}`;
                      }
                      return (
                        <img
                          key={idx}
                          src={url}
                          alt={`Review image ${idx + 1}`}
                          className="w-20 h-20 object-cover rounded border hover:scale-105 transition-transform cursor-pointer"
                          loading="lazy"
                          onError={e => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1585592049294-8f466326930a'; }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProductReviews;
