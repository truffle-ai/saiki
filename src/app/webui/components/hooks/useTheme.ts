import { useEffect, useState } from 'react';

export function useTheme() {
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const storedValue = localStorage.getItem('theme');
                const stored =
                    storedValue === 'light' || storedValue === 'dark' ? storedValue : null;

                const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
                const resolvedTheme = stored || (prefersDark ? 'dark' : 'light');

                setTheme(resolvedTheme);

                document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
            } catch (error) {
                console.error('Failed to access localStorage for theme:', error);

                const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
                const fallbackTheme = prefersDark ? 'dark' : 'light';

                setTheme(fallbackTheme);
                document.documentElement.classList.toggle('dark', fallbackTheme === 'dark');
            } finally {
                setHasMounted(true);
            }
        }
    }, []);

    useEffect(() => {
        if (!hasMounted || typeof window === 'undefined') return;

        localStorage.setItem('theme', theme);
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme, hasMounted]);

    const toggleTheme = (checked: boolean) => {
        setTheme(checked ? 'dark' : 'light');
    };

    return { theme, toggleTheme, hasMounted };
}
