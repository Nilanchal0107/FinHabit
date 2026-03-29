/**
 * Default expense categories for FinHabits.
 * Each category has a stable id, display name, emoji icon,
 * brand color, and sort order.
 */
export const DEFAULT_CATEGORIES = [
  { id: 'food',        name: 'Food & Dining',    icon: '🍽️',  color: '#F59E0B', order: 1,  isDefault: true },
  { id: 'transport',   name: 'Transport',         icon: '🚗',  color: '#4F46E5', order: 2,  isDefault: true },
  { id: 'shopping',    name: 'Shopping',          icon: '🛍️',  color: '#7C3AED', order: 3,  isDefault: true },
  { id: 'utilities',   name: 'Utilities',         icon: '💡',  color: '#0D9488', order: 4,  isDefault: true },
  { id: 'health',      name: 'Health',            icon: '🏥',  color: '#22C55E', order: 5,  isDefault: true },
  { id: 'entertainment',name: 'Entertainment',    icon: '🎬',  color: '#F43F5E', order: 6,  isDefault: true },
  { id: 'education',   name: 'Education',         icon: '📚',  color: '#3B82F6', order: 7,  isDefault: true },
  { id: 'travel',      name: 'Travel',            icon: '✈️',  color: '#8B5CF6', order: 8,  isDefault: true },
  { id: 'groceries',   name: 'Groceries',         icon: '🛒',  color: '#84CC16', order: 9,  isDefault: true },
  { id: 'rent',        name: 'Rent & Housing',    icon: '🏠',  color: '#06B6D4', order: 10, isDefault: true },
  { id: 'emi',         name: 'EMI & Loans',       icon: '🏦',  color: '#EF4444', order: 11, isDefault: true },
  { id: 'investment',  name: 'Investment',        icon: '📈',  color: '#10B981', order: 12, isDefault: true },
  { id: 'insurance',   name: 'Insurance',         icon: '🛡️',  color: '#64748B', order: 13, isDefault: true },
  { id: 'subscriptions',name: 'Subscriptions',   icon: '📱',  color: '#EC4899', order: 14, isDefault: true },
  { id: 'fuel',        name: 'Fuel',              icon: '⛽',  color: '#F97316', order: 15, isDefault: true },
  { id: 'salary',      name: 'Salary',            icon: '💰',  color: '#22C55E', order: 16, isDefault: true },
  { id: 'transfer',    name: 'Transfer',          icon: '🔄',  color: '#8B8A9E', order: 17, isDefault: true },
  { id: 'atm',         name: 'ATM Withdrawal',    icon: '🏧',  color: '#F59E0B', order: 18, isDefault: true },
  { id: 'recharge',    name: 'Recharge',          icon: '📶',  color: '#0D9488', order: 19, isDefault: true },
  { id: 'other',       name: 'Other',             icon: '📦',  color: '#6B7280', order: 20, isDefault: true },
];

/**
 * Map of category id → category object for O(1) lookups.
 */
export const CATEGORY_MAP = Object.fromEntries(
  DEFAULT_CATEGORIES.map((cat) => [cat.id, cat])
);

/**
 * Returns the category object for a given id, falling back to 'other'.
 *
 * @param {string} id
 * @returns {object}
 */
export const getCategory = (id) => CATEGORY_MAP[id] || CATEGORY_MAP['other'];

/**
 * Categories sorted by order for display in pickers.
 */
export const SORTED_CATEGORIES = [...DEFAULT_CATEGORIES].sort((a, b) => a.order - b.order);

/**
 * Income categories (for credit transactions).
 */
export const INCOME_CATEGORIES = DEFAULT_CATEGORIES.filter((cat) =>
  ['salary', 'transfer', 'investment'].includes(cat.id)
);

/**
 * Expense categories (for debit transactions).
 */
export const EXPENSE_CATEGORIES = DEFAULT_CATEGORIES.filter(
  (cat) => !['salary'].includes(cat.id)
);
