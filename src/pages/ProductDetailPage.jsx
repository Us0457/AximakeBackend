import React from 'react';
import { useParams } from 'react-router-dom';
import UnifiedPDP from '@/components/product/UnifiedPDP';

const ProductDetailPage = () => {
  const { id } = useParams();
  return <UnifiedPDP productId={id} />;
};

export default ProductDetailPage;
