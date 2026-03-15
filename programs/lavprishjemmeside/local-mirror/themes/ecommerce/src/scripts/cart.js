const CART_KEY = 'verde_cart';

function readCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.items)) return { items: [] };
    return parsed;
  } catch {
    return { items: [] };
  }
}

function writeCart(cart) {
  cart.updated_at = new Date().toISOString();
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
}

export function getCart() { return readCart(); }

export function getCartCount() {
  return readCart().items.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

export function getCartTotal() {
  return readCart().items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

export function addToCart(item) {
  const cart = readCart();
  const existing = cart.items.find(i => i.id === item.id);
  if (existing) {
    existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
    existing.price = item.price;
  } else {
    cart.items.push({
      id: item.id,
      slug: item.slug,
      name: item.name,
      price: item.price,
      quantity: item.quantity || 1,
      image: item.image || null,
    });
  }
  writeCart(cart);
}

export function setQuantity(id, quantity) {
  const cart = readCart();
  const idx = cart.items.findIndex(i => i.id === id);
  if (idx === -1) return;
  if (quantity <= 0) cart.items.splice(idx, 1);
  else cart.items[idx].quantity = quantity;
  writeCart(cart);
}

export function removeFromCart(id) {
  const cart = readCart();
  cart.items = cart.items.filter(i => i.id !== id);
  writeCart(cart);
}

export function clearCart() {
  writeCart({ items: [] });
}

export function formatPrice(ore) {
  return (ore / 100).toLocaleString('da-DK', { style: 'currency', currency: 'DKK', minimumFractionDigits: 0 });
}
