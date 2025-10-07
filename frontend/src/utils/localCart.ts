export type CartPlan = 'mensual' | 'anual';

export interface LocalCartItem {
  id: number | string;
  title: string;
  price: number; // en miles (para usar formatCOP existente)
  qty: number;
  photo?: string;
  plan?: CartPlan;
  iconName?: string; // icono de la app (iconify)
  colorClass?: string; // clase tailwind de fondo de la app
}

const STORAGE_KEY = 'appStoreCartItems';

export const getCart = (): LocalCartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const setCart = (items: LocalCartItem[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const addItem = (item: LocalCartItem) => {
  const cart = getCart();
  const idx = cart.findIndex(ci => ci.id === item.id && ci.plan === item.plan);
  if (idx >= 0) {
    cart[idx].qty += item.qty;
  } else {
    cart.push(item);
  }
  setCart(cart);
};

export const updateQty = (id: number | string, plan: CartPlan | undefined, qty: number) => {
  const cart = getCart();
  const idx = cart.findIndex(ci => ci.id === id && ci.plan === plan);
  if (idx >= 0) {
    cart[idx].qty = Math.max(1, qty);
    setCart(cart);
  }
};

export const increment = (id: number | string, plan: CartPlan | undefined) => {
  const cart = getCart();
  const idx = cart.findIndex(ci => ci.id === id && ci.plan === plan);
  if (idx >= 0) {
    cart[idx].qty += 1;
    setCart(cart);
  }
};

export const decrement = (id: number | string, plan: CartPlan | undefined) => {
  const cart = getCart();
  const idx = cart.findIndex(ci => ci.id === id && ci.plan === plan);
  if (idx >= 0) {
    cart[idx].qty = Math.max(1, cart[idx].qty - 1);
    setCart(cart);
  }
};

export const removeItem = (id: number | string, plan: CartPlan | undefined) => {
  const cart = getCart().filter(ci => !(ci.id === id && ci.plan === plan));
  setCart(cart);
};

export const clearCart = () => {
  setCart([]);
};


