import React from 'react';

const PriceDisplay = ({ price }) => {
  // Always show integer price for quotes
  const roundedPrice = Math.round(price);
  return (
    <div className="pt-6 border-t border-border">
      <p className="text-lg text-muted-foreground">Estimated Price:</p>
      <p className="text-4xl font-bold gradient-text">₹{roundedPrice.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground mt-1">Price may vary based on final model analysis and complexity.</p>
    </div>
  );
};

export default PriceDisplay;