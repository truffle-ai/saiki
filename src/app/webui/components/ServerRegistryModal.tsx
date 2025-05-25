'use client';

import React, { useState, useEffect } from 'react';
import { serverRegistry } from '@/lib/serverRegistry';
import type { ServerRegistryEntry, ServerRegistryFilter } from '@/types';
import AddCustomServerModal from './AddCustomServerModal';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { Alert, AlertDescription } from "./ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { 
    Search, 
    Download, 
    CheckCircle, 
    ExternalLink, 
    Star,
    Filter,
    Plus,
    Tag,
    Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServerRegistryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onInstallServer: (entry: ServerRegistryEntry) => Promise<void>;
}

export default function ServerRegistryModal({ 
    isOpen, 
    onClose, 
    onInstallServer 
}: ServerRegistryModalProps) {
    const [entries, setEntries] = useState<ServerRegistryEntry[]>([]);
    const [filteredEntries, setFilteredEntries] = useState<ServerRegistryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [installing, setInstalling] = useState<string | null>(null);
    const [isAddCustomModalOpen, setIsAddCustomModalOpen] = useState(false);
    
    // Filter state
    const [filter, setFilter] = useState<ServerRegistryFilter>({});
    const [searchInput, setSearchInput] = useState('');
    
    const categories = [
        { value: 'all', label: 'All Categories' },
        { value: 'productivity', label: 'Productivity' },
        { value: 'development', label: 'Development' },
        { value: 'research', label: 'Research' },
        { value: 'creative', label: 'Creative' },
        { value: 'data', label: 'Data' },
        { value: 'communication', label: 'Communication' },
        { value: 'custom', label: 'Custom' },
    ];

    // Load registry entries
    useEffect(() => {
        if (!isOpen) return;
        
        const loadEntries = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const registryEntries = await serverRegistry.getEntries();
                setEntries(registryEntries);
                setFilteredEntries(registryEntries);
            } catch (err: any) {
                setError(err.message || 'Failed to load server registry');
            } finally {
                setIsLoading(false);
            }
        };

        loadEntries();
    }, [isOpen]);

    // Apply filters
    useEffect(() => {
        const applyFilters = async () => {
            try {
                const filtered = await serverRegistry.getEntries({
                    ...filter,
                    search: searchInput || undefined,
                });
                setFilteredEntries(filtered);
            } catch (err: any) {
                setError(err.message || 'Failed to filter entries');
            }
        };

        applyFilters();
    }, [filter, searchInput, entries]);

    const handleInstall = async (entry: ServerRegistryEntry) => {
        setInstalling(entry.id);
        try {
            await onInstallServer(entry);
            await serverRegistry.setInstalled(entry.id, true);
            
            // Update local state
            setEntries(prev => prev.map(e => 
                e.id === entry.id ? { ...e, isInstalled: true } : e
            ));
        } catch (err: any) {
            setError(err.message || 'Failed to install server');
        } finally {
            setInstalling(null);
        }
    };

    const getCategoryColor = (category: string) => {
        const colors = {
            productivity: 'bg-blue-100 text-blue-800',
            development: 'bg-green-100 text-green-800',
            research: 'bg-purple-100 text-purple-800',
            creative: 'bg-pink-100 text-pink-800',
            data: 'bg-orange-100 text-orange-800',
            communication: 'bg-indigo-100 text-indigo-800',
            custom: 'bg-gray-100 text-gray-800',
        };
        return colors[category as keyof typeof colors] || colors.custom;
    };

    const handleAddCustomServer = async (entry: Omit<ServerRegistryEntry, 'id' | 'isOfficial' | 'lastUpdated'>) => {
        try {
            const newEntry = await serverRegistry.addCustomEntry(entry);
            setEntries(prev => [newEntry, ...prev]);
            setIsAddCustomModalOpen(false);
        } catch (err: any) {
            setError(err.message || 'Failed to add custom server');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5" />
                        MCP Server Registry
                    </DialogTitle>
                    <DialogDescription>
                        Browse and install MCP servers to extend your agent capabilities
                    </DialogDescription>
                </DialogHeader>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 py-4 border-b">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search servers..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select
                        value={filter.category || 'all'}
                        onValueChange={(value) => setFilter(prev => ({
                            ...prev,
                            category: value === 'all' ? undefined : value
                        }))}
                    >
                        <SelectTrigger className="w-full sm:w-48">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            {categories.map(cat => (
                                <SelectItem key={cat.value} value={cat.value}>
                                    {cat.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                        <Button
                            variant={filter.official ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFilter(prev => ({
                                ...prev,
                                official: prev.official ? undefined : true
                            }))}
                        >
                            <Star className="h-4 w-4 mr-1" />
                            Official
                        </Button>
                        <Button
                            variant={filter.installed ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFilter(prev => ({
                                ...prev,
                                installed: prev.installed ? undefined : true
                            }))}
                        >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Installed
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsAddCustomModalOpen(true)}
                        >
                            <Settings className="h-4 w-4 mr-1" />
                            Add Custom
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="text-muted-foreground">Loading servers...</div>
                        </div>
                    ) : filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Filter className="h-12 w-12 text-muted-foreground mb-4" />
                            <div className="text-muted-foreground">
                                {entries.length === 0 
                                    ? 'No servers available'
                                    : 'No servers match your filters'
                                }
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredEntries.map((entry) => (
                                <Card key={entry.id} className="transition-all hover:shadow-md">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3">
                                                <div className="text-2xl">{entry.icon || '⚡'}</div>
                                                <div className="flex-1">
                                                    <CardTitle className="text-lg flex items-center gap-2">
                                                        {entry.name}
                                                        {entry.isOfficial && (
                                                            <Badge variant="secondary" className="text-xs">
                                                                <Star className="h-3 w-3 mr-1" />
                                                                Official
                                                            </Badge>
                                                        )}
                                                        {entry.isInstalled && (
                                                            <Badge variant="default" className="text-xs">
                                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                                Installed
                                                            </Badge>
                                                        )}
                                                    </CardTitle>
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        {entry.description}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                onClick={() => handleInstall(entry)}
                                                disabled={entry.isInstalled || installing === entry.id}
                                                className="shrink-0"
                                            >
                                                {installing === entry.id ? (
                                                    'Installing...'
                                                ) : entry.isInstalled ? (
                                                    <>
                                                        <CheckCircle className="h-4 w-4 mr-2" />
                                                        Installed
                                                    </>
                                                ) : (
                                                    <>
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        Add to Agent
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-3">
                                            <Badge className={getCategoryColor(entry.category)}>
                                                {entry.category}
                                            </Badge>
                                            {entry.tags.slice(0, 3).map(tag => (
                                                <Badge key={tag} variant="outline" className="text-xs">
                                                    <Tag className="h-3 w-3 mr-1" />
                                                    {tag}
                                                </Badge>
                                            ))}
                                            {entry.tags.length > 3 && (
                                                <Badge variant="outline" className="text-xs">
                                                    +{entry.tags.length - 3} more
                                                </Badge>
                                            )}
                                        </div>
                                        
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <div className="flex items-center gap-4">
                                                {entry.author && (
                                                    <span>By {entry.author}</span>
                                                )}
                                                {entry.version && (
                                                    <span>v{entry.version}</span>
                                                )}
                                                {entry.popularity && (
                                                    <span className="flex items-center gap-1">
                                                        <Star className="h-3 w-3" />
                                                        {entry.popularity}%
                                                    </span>
                                                )}
                                            </div>
                                            {entry.homepage && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 px-2 text-xs"
                                                    onClick={() => window.open(entry.homepage, '_blank')}
                                                >
                                                    <ExternalLink className="h-3 w-3 mr-1" />
                                                    Docs
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>

            {/* Add Custom Server Modal */}
            <AddCustomServerModal
                isOpen={isAddCustomModalOpen}
                onClose={() => setIsAddCustomModalOpen(false)}
                onAddServer={handleAddCustomServer}
            />
        </Dialog>
    );
} 