/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // רשימת הצבעים של הקטגוריות שאסור למחוק מהעיצוב
    'text-emerald-500', 'dark:text-emerald-400', 'bg-emerald-500/10', 'dark:bg-emerald-500/20',
    'text-indigo-500', 'dark:text-indigo-400', 'bg-indigo-500/10', 'dark:bg-indigo-500/20',
    'text-pink-500', 'dark:text-pink-400', 'bg-pink-500/10', 'dark:bg-pink-500/20',
    'text-orange-500', 'dark:text-orange-400', 'bg-orange-500/10', 'dark:bg-orange-500/20',
    'text-rose-500', 'dark:text-rose-400', 'bg-rose-500/10', 'dark:bg-rose-500/20',
    'text-teal-500', 'dark:text-teal-400', 'bg-teal-500/10', 'dark:bg-teal-500/20',
    'text-purple-500', 'dark:text-purple-400', 'bg-purple-500/10', 'dark:bg-purple-500/20',
    'text-amber-500', 'dark:text-amber-400', 'bg-amber-500/10', 'dark:bg-amber-500/20',
    'text-sky-500', 'dark:text-sky-400', 'bg-sky-500/10', 'dark:bg-sky-500/20',
    'text-slate-500', 'dark:text-slate-400', 'bg-slate-500/10', 'dark:bg-slate-500/20',
    'text-cyan-600', 'bg-cyan-50',
    'text-gray-500', 'dark:text-gray-400', 'bg-gray-500/10', 'dark:bg-gray-500/20'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}