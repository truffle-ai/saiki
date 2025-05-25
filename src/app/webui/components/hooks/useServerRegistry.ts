import { useState, useEffect } from 'react';
import { serverRegistry } from '@/lib/serverRegistry';
import type { ServerRegistryEntry, ServerRegistryFilter } from '@/types';

interface UseServerRegistryOptions {
    autoLoad?: boolean;
    initialFilter?: ServerRegistryFilter;
}

export function useServerRegistry(options: UseServerRegistryOptions = {}) {
    const { autoLoad = true, initialFilter } = options;

    const [entries, setEntries] = useState<ServerRegistryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<ServerRegistryFilter>(initialFilter || {});

    const loadEntries = async (newFilter?: ServerRegistryFilter) => {
        setIsLoading(true);
        setError(null);

        try {
            const filterToUse = newFilter || filter;
            const registryEntries = await serverRegistry.getEntries(filterToUse);
            setEntries(registryEntries);
        } catch (err: any) {
            setError(err.message || 'Failed to load server registry');
        } finally {
            setIsLoading(false);
        }
    };

    const updateFilter = (newFilter: ServerRegistryFilter) => {
        setFilter(newFilter);
        loadEntries(newFilter);
    };

    const markAsInstalled = async (entryId: string) => {
        try {
            await serverRegistry.setInstalled(entryId, true);
            setEntries((prev) =>
                prev.map((entry) =>
                    entry.id === entryId ? { ...entry, isInstalled: true } : entry
                )
            );
        } catch (err: any) {
            setError(err.message || 'Failed to mark server as installed');
        }
    };

    const addCustomEntry = async (
        entry: Omit<ServerRegistryEntry, 'id' | 'isOfficial' | 'lastUpdated'>
    ) => {
        try {
            const newEntry = await serverRegistry.addCustomEntry(entry);
            setEntries((prev) => [newEntry, ...prev]);
            return newEntry;
        } catch (err: any) {
            setError(err.message || 'Failed to add custom server');
            throw err;
        }
    };

    useEffect(() => {
        if (autoLoad) {
            loadEntries();
        }
    }, [autoLoad]);

    return {
        entries,
        isLoading,
        error,
        filter,
        loadEntries,
        updateFilter,
        markAsInstalled,
        addCustomEntry,
        clearError: () => setError(null),
    };
}
