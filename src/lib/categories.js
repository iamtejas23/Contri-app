export const CATEGORY_DETAILS = {
  Food: { emoji: '🍛', label: 'Food', tone: 'bg-orange-100 text-orange-700' },
  Petrol: { emoji: '⛽', label: 'Petrol', tone: 'bg-amber-100 text-amber-800' },
  Toll: { emoji: '🛣️', label: 'Toll', tone: 'bg-sky-100 text-sky-700' },
  Hotel: { emoji: '🏨', label: 'Hotel', tone: 'bg-indigo-100 text-indigo-700' },
  Stay: { emoji: '🏨', label: 'Stay', tone: 'bg-indigo-100 text-indigo-700' },
  Travel: { emoji: '🚆', label: 'Travel', tone: 'bg-teal-100 text-teal-700' },
  Activity: { emoji: '🎟️', label: 'Activity', tone: 'bg-yellow-100 text-yellow-800' },
  Shopping: { emoji: '🛍️', label: 'Shopping', tone: 'bg-purple-100 text-purple-700' },
  Other: { emoji: '📦', label: 'Other', tone: 'bg-slate-100 text-slate-600' },
}

export const getCategoryMeta = (category) =>
  CATEGORY_DETAILS[category] || {
    emoji: '🧾',
    label: category || 'Other',
    tone: 'bg-slate-100 text-slate-600',
  }
