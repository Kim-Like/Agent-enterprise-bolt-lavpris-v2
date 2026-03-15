const ORDER_KEY = 'brasa_order';

function readOrder() {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.items)) return { items: [] };
    return parsed;
  } catch {
    return { items: [] };
  }
}

function writeOrder(order) {
  order.updated_at = new Date().toISOString();
  localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  window.dispatchEvent(new CustomEvent('order:updated', { detail: order }));
}

export function getOrder() { return readOrder(); }

export function getOrderCount() {
  return readOrder().items.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

export function getOrderTotal() {
  return readOrder().items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

export function addToOrder(item) {
  const order = readOrder();
  const existing = order.items.find(i => i.id === item.id);
  if (existing) {
    existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
  } else {
    order.items.push({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity || 1,
      image: item.image || null,
    });
  }
  writeOrder(order);
}

export function setQuantity(id, quantity) {
  const order = readOrder();
  const idx = order.items.findIndex(i => i.id === id);
  if (idx === -1) return;
  if (quantity <= 0) order.items.splice(idx, 1);
  else order.items[idx].quantity = quantity;
  writeOrder(order);
}

export function removeFromOrder(id) {
  const order = readOrder();
  order.items = order.items.filter(i => i.id !== id);
  writeOrder(order);
}

export function clearOrder() {
  writeOrder({ items: [] });
}

export function formatPrice(ore) {
  return (ore / 100).toLocaleString('da-DK', { style: 'currency', currency: 'DKK', minimumFractionDigits: 0 });
}
