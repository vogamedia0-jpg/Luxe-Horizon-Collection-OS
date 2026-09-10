import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

const KEY = 'luxe-horizon-appearance';

type Theme = 'light' | 'dark';

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.dataset.theme = theme;
}

export default function AppearanceToggle() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'));

  useEffect(() => { apply(theme); localStorage.setItem(KEY, theme); }, [theme]);

  return (
    <button
      type="button"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}
      className="fixed right-[132px] top-[15px] z-[80] flex h-9 w-9 items-center justify-center rounded-full border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] text-[var(--lh-burgundy)] shadow-sm transition hover:scale-[1.03] sm:right-[150px]"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
