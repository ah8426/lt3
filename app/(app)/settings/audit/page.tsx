'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';
import {
  Shield,
  Download,
  Loader2,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import { AuditLog, AuditAction, AuditResource, AuditLogResponse } from '@/types/audit';

const ACTION_LABELS: Record<AuditAction, string> = {
  [AuditAction.LOGIN]: 'Login',
  [AuditAction.LOGOUT]: 'Logout',
  [AuditAction.LOGIN_FAILED]: 'Login Failed',
  [AuditAction.SESSION_CREATE]: 'Session Created',
  [AuditAction.SESSION_UPDATE]: 'Session Updated',
  [AuditAction.SESSION_DELETE]: 'Session Deleted',
  [AuditAction.SESSION_ARCHIVE]: 'Session Archived',
  [AuditAction.TRANSCRIPT_CREATE]: 'Transcript Created',
  [AuditAction.TRANSCRIPT_UPDATE]: 'Transcript Updated',
  [AuditAction.TRANSCRIPT_DELETE]: 'Transcript Deleted',
  [AuditAction.TRANSCRIPT_EDIT]: 'Transcript Edited',
  [AuditAction.API_KEY_CREATE]: 'API Key Created',
  [AuditAction.API_KEY_UPDATE]: 'API Key Updated',
  [AuditAction.API_KEY_DELETE]: 'API Key Deleted',
  [AuditAction.API_KEY_TEST]: 'API Key Tested',
  [AuditAction.SETTINGS_UPDATE]: 'Settings Updated',
  [AuditAction.PREFERENCE_UPDATE]: 'Preference Updated',
  [AuditAction.SHARE_LINK_CREATE]: 'Share Link Created',
  [AuditAction.SHARE_LINK_DELETE]: 'Share Link Deleted',
  [AuditAction.DOCUMENT_EXPORT]: 'Document Exported',
  [AuditAction.SEGMENT_CREATE]: 'Segment Created',
  [AuditAction.SEGMENT_UPDATE]: 'Segment Updated',
  [AuditAction.SEGMENT_DELETE]: 'Segment Deleted',
  [AuditAction.SEGMENT_MERGE]: 'Segments Merged',
  [AuditAction.SEGMENT_SPLIT]: 'Segment Split',
  [AuditAction.VERSION_CREATE]: 'Version Created',
  [AuditAction.VERSION_RESTORE]: 'Version Restored',
  [AuditAction.VERSION_COMPARE]: 'Version Compared',
  [AuditAction.TIMESTAMP_CREATE]: 'Timestamp Created',
  [AuditAction.TIMESTAMP_VERIFY]: 'Timestamp Verified',
  [AuditAction.TIMESTAMP_EXPORT]: 'Timestamp Exported',
  [AuditAction.SPEAKER_CREATE]: 'Speaker Created',
  [AuditAction.SPEAKER_UPDATE]: 'Speaker Updated',
  [AuditAction.SPEAKER_DELETE]: 'Speaker Deleted',
  [AuditAction.SPEAKER_MERGE]: 'Speakers Merged',
  [AuditAction.REDACTION_CREATE]: 'Redaction Created',
  [AuditAction.REDACTION_UPDATE]: 'Redaction Updated',
  [AuditAction.REDACTION_DELETE]: 'Redaction Deleted',
  [AuditAction.REDACTION_UNREDACT]: 'Redaction Removed',
  [AuditAction.PII_DETECT]: 'PII Detected',
  [AuditAction.TRANSCRIPT_VIEW]: 'Transcript Viewed',
  [AuditAction.SESSION_VIEW]: 'Session Viewed',
};

const RESOURCE_LABELS: Record<AuditResource, string> = {
  [AuditResource.USER]: 'User',
  [AuditResource.SESSION]: 'Session',
  [AuditResource.TRANSCRIPT]: 'Transcript',
  [AuditResource.SEGMENT]: 'Segment',
  [AuditResource.API_KEY]: 'API Key',
  [AuditResource.SETTINGS]: 'Settings',
  [AuditResource.SHARE_LINK]: 'Share Link',
  [AuditResource.DOCUMENT]: 'Document',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const columns: ColumnDef<AuditLog>[] = [
    {
      accessorKey: 'timestamp',
      header: 'Timestamp',
      cell: ({ row }) => (
        <div className="text-sm">
          {format(new Date(row.original.timestamp), 'MMM d, yyyy HH:mm:ss')}
        </div>
      ),
    },
    {
      accessorKey: 'action',
      header: 'Action',
      cell: ({ row }) => (
        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
          {ACTION_LABELS[row.original.action] || row.original.action}
        </span>
      ),
    },
    {
      accessorKey: 'resource',
      header: 'Resource',
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {RESOURCE_LABELS[row.original.resource] || row.original.resource}
        </span>
      ),
    },
    {
      accessorKey: 'resourceId',
      header: 'Resource ID',
      cell: ({ row }) => (
        <code className="text-xs bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">
          {row.original.resourceId?.substring(0, 8) || 'N/A'}
        </code>
      ),
    },
    {
      accessorKey: 'ipAddress',
      header: 'IP Address',
      cell: ({ row }) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {row.original.ipAddress || 'N/A'}
        </span>
      ),
    },
    {
      accessorKey: 'location',
      header: 'Location',
      cell: ({ row }) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {row.original.location || 'N/A'}
        </span>
      ),
    },
    {
      accessorKey: 'metadata',
      header: 'Details',
      cell: ({ row }) => {
        const metadata = row.original.metadata;
        if (!metadata || Object.keys(metadata).length === 0) return <span className="text-xs text-gray-400">—</span>;

        return (
          <div className="text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate" title={JSON.stringify(metadata, null, 2)}>
            {Object.entries(metadata).map(([key, value]) => (
              <span key={key} className="mr-2">
                <strong>{key}:</strong> {String(value)}
              </span>
            ))}
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: logs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  });

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (actionFilter !== 'all') params.append('action', actionFilter);
      if (resourceFilter !== 'all') params.append('resource', resourceFilter);
      if (startDate) params.append('startDate', new Date(startDate).toISOString());
      if (endDate) params.append('endDate', new Date(endDate).toISOString());

      const response = await fetch(`/api/audit?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const data: AuditLogResponse = await response.json();
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, resourceFilter, startDate, endDate]);

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Action', 'Resource', 'Resource ID', 'IP Address', 'Location', 'Details'];
    const csvData = logs.map((log) => [
      format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
      ACTION_LABELS[log.action] || log.action,
      RESOURCE_LABELS[log.resource] || log.resource,
      log.resourceId || '',
      log.ipAddress || '',
      log.location || '',
      JSON.stringify(log.metadata || {}),
    ]);

    const csv = [headers, ...csvData].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Audit Logs</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          View and monitor all actions performed in your account
        </p>
      </div>

      {/* Security Notice */}
      <Alert className="border-[#00BFA5]/20 bg-[#00BFA5]/5">
        <Shield className="h-4 w-4 text-[#00BFA5]" />
        <AlertDescription className="text-sm">
          Audit logs are read-only and cannot be edited or deleted. Logs are retained according to your retention policy.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter audit logs by action, resource, or date range</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="action-filter">Action</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger id="action-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {Object.entries(ACTION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resource-filter">Resource</Label>
              <Select value={resourceFilter} onValueChange={setResourceFilter}>
                <SelectTrigger id="resource-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resources</SelectItem>
                  {Object.entries(RESOURCE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setActionFilter('all');
                setResourceFilter('all');
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
            >
              Clear Filters
            </Button>
            <Button variant="outline" onClick={exportToCSV} disabled={logs.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export to CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            Showing {logs.length} of {total} total entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center min-h-96">
              <Loader2 className="h-8 w-8 animate-spin text-[#00BFA5]" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-96 text-gray-500">
              <Info className="h-12 w-12 mb-4 text-gray-400" />
              <p className="text-lg font-medium">No audit logs found</p>
              <p className="text-sm">Try adjusting your filters or date range</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
