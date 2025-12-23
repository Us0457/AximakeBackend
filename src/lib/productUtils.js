// Utility to get unique categories from products
export function getCategories(products) {
  const cats = new Set();
  products.forEach(p => {
    if (p.category) cats.add(p.category);
  });
  return Array.from(cats);
}

// Utility to get min/max price from products
export function getPriceRange(products) {
  let min = Infinity, max = -Infinity;
  products.forEach(p => {
    if (typeof p.price === 'number') {
      min = Math.min(min, p.price);
      max = Math.max(max, p.price);
    }
  });
  return [min === Infinity ? 0 : min, max === -Infinity ? 0 : max];
}

// Utility to robustly normalize product image paths to valid public URLs
export function getImages(product) {
  const supabaseBaseUrl = 'https://wruysjrqadlsljnkmnte.supabase.co/storage/v1/object/public/product-images/';
  let images = [];
  if (Array.isArray(product?.images) && product.images.some(Boolean)) {
    images = product.images.filter(Boolean);
  } else if (typeof product?.images === 'string' && product.images.trim() !== '') {
    try {
      const parsed = JSON.parse(product.images);
      if (Array.isArray(parsed)) {
        images = parsed.filter(Boolean);
      } else if (typeof parsed === 'string') {
        images = [parsed];
      } else {
        images = [product.images];
      }
    } catch {
      images = product.images.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  images = images.filter(img => typeof img === 'string' && img.trim()).map(img => {
    if (/^https?:\/\//.test(img)) return img;
    // Only strip '/product/' (singular) and leading slashes, but keep 'products/'
    let cleanImg = img.replace(/^\/product\//, '').replace(/^\//, '');
    return supabaseBaseUrl + cleanImg;
  });
  if (!images.length && product?.image_url) images = [product.image_url];
  if (!images.length) images = ['https://images.unsplash.com/photo-1585592049294-8f466326930a'];
  return images;
}

// Detect whether a product should be considered an Electronics Kit
export function isKitProduct(p) {
  if (!p) return false;
  const ELECTRONICS_CATEGORIES = ['Arduino Kits', 'IoT Kits', 'Beginner Kits', 'Sensors', 'Robotics', 'Learning Projects', 'Advanced Kits'];
  // Category exact match
  if (p.category && ELECTRONICS_CATEGORIES.includes(p.category)) return true;
  // Category keyword heuristics (catch RaspberryPi Kits, etc.)
  if (p.category && typeof p.category === 'string') {
    const cat = p.category.toLowerCase();
    const keywords = ['kit', 'kits', 'arduino', 'raspberry', 'raspberrypi', 'raspberry pi', 'iot', 'robot', 'robotics'];
    for (const kw of keywords) {
      if (cat.includes(kw)) return true;
    }
  }
  if (p.short_description) return true;
  if (p.difficulty) return true;
  if (p.includes && (Array.isArray(p.includes) ? p.includes.length > 0 : String(p.includes).trim() !== '' && String(p.includes) !== '[]')) return true;
  if (p.outcomes && (Array.isArray(p.outcomes) ? p.outcomes.length > 0 : String(p.outcomes).trim() !== '' && String(p.outcomes) !== '[]')) return true;
  return false;
}

// Split a category string into hierarchical parts.
// Example: "Kits > Raspberry Pi Kits" -> ["Kits", "Raspberry Pi Kits"]
export function buildBreadcrumbParts(cat) {
  if (!cat) return [];
  return String(cat).split(/\s*[>\/|›-]\s*/).map(s => s.trim()).filter(Boolean);
}
