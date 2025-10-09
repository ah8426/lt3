'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMatters } from '@/hooks/useMatters';
import {
  Search,
  Plus,
  Filter,
  Clock,
  FileText,
  Mic,
  MoreVertical,
  Play,
  Trash2,
  Share2,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

interface Session {
  id: string;
  title: string;
  matter?: {
    id: string;
    name: string;
    client_name: string;
  };
  transcript: string;
  duration_ms: number;
  status: string;
  created_at: string;
  updated_at: string;
  _count?: {
    count: number;
  };
}

interface SessionsResponse {
  sessions: Session[];
  total: number;
  limit: number;
  offset: number;
}

type SortOption = 'date-desc' | 'date-asc' | 'duration-desc' | 'duration-asc' | 'matter';

export default function SessionsPage() {
  const router = useRouter();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatter, setSelectedMatter] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);

  // Fetch matters for filter
  const { data: mattersData } = useMatters();

  // Fetch sessions
  const { data, isLoading, error } = useQuery<SessionsResponse>({
    queryKey: ['sessions', { selectedMatter, selectedStatus, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (selectedMatter !== 'all') {
        params.append('matterId', selectedMatter);
      }

      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }

      const response = await fetch(`/api/sessions?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      return response.json();
    },
  });

  // Filter and sort sessions
  const filteredSessions = useMemo(() => {
    if (!data?.sessions) return [];

    let filtered = [...data.sessions];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (session) =>
          session.title.toLowerCase().includes(query) ||
          session.transcript?.toLowerCase().includes(query) ||
          session.matter?.name.toLowerCase().includes(query) ||
          session.matter?.client_name.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'date-asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'duration-desc':
          return b.duration_ms - a.duration_ms;
        case 'duration-asc':
          return a.duration_ms - b.duration_ms;
        case 'matter':
          return (a.matter?.name || '').localeCompare(b.matter?.name || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [data?.sessions, searchQuery, sortBy]);

  /**
   * Format duration
   */
  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
  };

  /**
   * Get status badge color
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'recording':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  /**
   * Handle delete session
   */
  const handleDelete = async (sessionId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }

      // Refetch sessions
      window.location.reload();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete session');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dictation Sessions
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {data?.total || 0} total sessions
          </p>
        </div>

        <Link href="/dictation">
          <Button className="bg-[#00BFA5] hover:bg-[#00BFA5]/90">
            <Plus className="mr-2 h-4 w-4" />
            New Session
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search sessions, matters, or transcript..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Matter Filter */}
            <Select value={selectedMatter} onValueChange={setSelectedMatter}>
              <SelectTrigger>
                <SelectValue placeholder="All matters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All matters</SelectItem>
                {mattersData?.map((matter) => (
                  <SelectItem key={matter.id} value={matter.id}>
                    {matter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="recording">Recording</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="stopped">Stopped</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Sort by:</span>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Newest first</SelectItem>
                  <SelectItem value="date-asc">Oldest first</SelectItem>
                  <SelectItem value="duration-desc">Longest first</SelectItem>
                  <SelectItem value="duration-asc">Shortest first</SelectItem>
                  <SelectItem value="matter">By matter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(searchQuery || selectedMatter !== 'all' || selectedStatus !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedMatter('all');
                  setSelectedStatus('all');
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sessions List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#00BFA5]" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-600">Failed to load sessions</p>
          </CardContent>
        </Card>
      ) : filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mic className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              No sessions found
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {searchQuery || selectedMatter !== 'all' || selectedStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by creating your first dictation session'}
            </p>
            <Link href="/dictation">
              <Button className="mt-4 bg-[#00BFA5] hover:bg-[#00BFA5]/90">
                <Plus className="mr-2 h-4 w-4" />
                New Session
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredSessions.map((session) => (
            <Link key={session.id} href={`/sessions/${session.id}`}>
              <Card className="hover:border-[#00BFA5] transition-colors cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    {/* Main Content */}
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            {session.title}
                          </h3>

                          {session.matter && (
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                              {session.matter.name} • {session.matter.client_name}
                            </p>
                          )}

                          {/* Transcript Preview */}
                          {session.transcript && (
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                              {session.transcript}
                            </p>
                          )}

                          {/* Meta Info */}
                          <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(session.duration_ms)}
                            </div>

                            {session._count && (
                              <div className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {session._count.count} segments
                              </div>
                            )}

                            <span>{format(new Date(session.created_at), 'MMM d, yyyy')}</span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <Badge className={getStatusColor(session.status)}>
                          {session.status}
                        </Badge>
                      </div>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                        <Button variant="ghost" size="icon" className="ml-4">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault();
                            router.push(`/sessions/${session.id}`);
                          }}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          View Session
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault();
                            // Handle share
                          }}
                        >
                          <Share2 className="mr-2 h-4 w-4" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleDelete(session.id, e)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > limit && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            {offset + 1} - {Math.min(offset + limit, data.total)} of {data.total}
          </span>
          <Button
            variant="outline"
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= data.total}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
