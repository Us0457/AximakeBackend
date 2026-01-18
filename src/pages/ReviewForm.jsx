import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const MAX_IMAGES = 4;

const ReviewForm = () => {
  const { user } = useAuth();
  const { orderId, productId } = useParams();
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files).slice(0, MAX_IMAGES);
    setImages(files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!rating || !review.trim()) {
      setError('Please provide a rating and review.');
      return;
    }
    setUploading(true);
    let imageUrls = [];
    try {
      if (images.length > 0) {
        for (const file of images) {
          if (!file) continue;
          // Always use upsert: false to avoid overwriting
          const uploadPath = `${productId}/${Date.now()}-${file.name}`;
          const { data, error: uploadError } = await supabase.storage.from('review-images').upload(uploadPath, file, { upsert: false });
          console.log('UPLOAD RESULT:', { data, uploadError, file });
          if (uploadError || !data || !data.path) {
            setError(`Image upload failed: ${uploadError?.message || 'Unknown error'}`);
            continue;
          }
          // Use the path, not the public URL, for storage
          imageUrls.push(data.path);
        }
      }
      imageUrls = imageUrls.filter(url => typeof url === 'string' && url.trim() && url !== 'null');
      const imagesToSave = imageUrls.length > 0 ? imageUrls : null;
      // Fetch avatar_url from profiles table
      let avatarUrl = '';
      if (user && user.id) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        if (profileData && profileData.avatar_url) {
          avatarUrl = profileData.avatar_url;
        } else {
          // Avoid hotlinking provider image; if provider avatar exists, use proxied URL
          const providerAvatar = user.user_metadata && (user.user_metadata.avatar_url || user.user_metadata.picture);
          if (providerAvatar) avatarUrl = `https://images.weserv.nl/?url=${encodeURIComponent(providerAvatar)}&output=jpg&w=256&h=256&fit=cover`;
        }
      }
      // Insert review
      const reviewerName = (user && user.user_metadata && user.user_metadata.full_name) ? user.user_metadata.full_name : (user && user.email ? user.email : 'User');
      const { error: insertError } = await supabase.from('reviews').insert([
        {
          user_id: user.id, // <-- Ensure user_id is included
          product_id: productId,
          order_id: orderId,
          rating,
          review_text: review,
          images: imagesToSave,
          reviewer_name: reviewerName,
          avatar_url: avatarUrl,
        },
      ]);
      if (insertError) throw insertError;
      navigate(-1); // Go back to orders or product page
    } catch (err) {
      setError(err.message || 'Failed to submit review.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="w-full max-w-lg p-8 shadow-xl">
        <CardTitle className="text-2xl mb-4 text-center">Write a Product Review</CardTitle>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center justify-center gap-2">
            {[1,2,3,4,5].map((star) => (
              <button
                type="button"
                key={star}
                onClick={() => setRating(star)}
                className={star <= rating ? 'text-yellow-400' : 'text-gray-300'}
                aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
              >
                <Star className="w-8 h-8" fill={star <= rating ? '#facc15' : 'none'} />
              </button>
            ))}
          </div>
          <textarea
            className="w-full border rounded p-3 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Share your experience with this product..."
            value={review}
            onChange={e => setReview(e.target.value)}
            maxLength={1000}
            required
          />
          <div>
            <label className="block mb-2 font-medium">Upload product images (optional, up to {MAX_IMAGES}):</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              disabled={uploading}
              className="block w-full"
            />
            <div className="flex gap-2 mt-2 flex-wrap">
              {images.length > 0 && images.map((img, idx) => (
                <img
                  key={idx}
                  src={URL.createObjectURL(img)}
                  alt="Preview"
                  className="w-16 h-16 object-cover rounded border"
                />
              ))}
            </div>
          </div>
          {error && <div className="text-red-500 text-sm text-center">{error}</div>}
          <Button type="submit" className="w-full" disabled={uploading}>
            {uploading ? 'Submitting...' : 'Submit Review'}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ReviewForm;
