'use client';

import { useState } from 'react';
import { useMatters, useMatterStats } from '@/hooks/useMatters';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  FileText,
  Clock,
  DollarSign,
  Users,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import type { MatterFilters, MatterStatus, Jurisdiction, CourtType } from '@/types/matter';
import { MATTER_STATUSES, JURISDICTIONS, COURT_TYPES } from '@/types/matter';

export default function MattersPage() {
  const [filters, setFilters] = useState<MatterFilters>({});
  const [searchInput, setSearchInput] = useState('');

  const { data: matters, isLoading } = useMatters(filters);
  const { stats } = useMatterStats();

  const handleSearch = () => {
    setFilters({ ...filters, search: searchInput });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleFilterChange = (key: keyof MatterFilters, value: string) => {
    setFilters({ ...filters, [key]: value === 'all' ? undefined : value });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Matters</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your cases and client matters
          </p>
        </div>
        <Link href="/matters/new">
          <Button className="bg-[#00BFA5] hover:bg-[#00BFA5]/90">
            <Plus className="mr-2 h-4 w-4" />
            New Matter
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Matters</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSessions}</div>
            <p className="text-xs text-muted-foreground">
              Across all matters
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDocuments}</div>
            <p className="text-xs text-muted-foreground">
              Generated documents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(stats.totalBillableAmount / 100).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Billable amount
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search matters, clients, case numbers..."
                    className="pl-10"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                  />
                </div>
                <Button onClick={handleSearch} variant="outline">
                  Search
                </Button>
              </div>
            </div>

            <Select
              value={filters.status || 'all'}
              onValueChange={(value) => handleFilterChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.jurisdiction || 'all'}
              onValueChange={(value) => handleFilterChange('jurisdiction', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Jurisdictions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jurisdictions</SelectItem>
                {Object.entries(JURISDICTIONS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Matters List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#00BFA5]" />
        </div>
      ) : matters && matters.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {matters.map((matter) => (
            <Link key={matter.id} href={`/matters/${matter.id}`}>
              <Card className="h-full hover:border-[#00BFA5] transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{matter.name}</CardTitle>
                      <CardDescription className="mt-1">
                        <Users className="inline h-3 w-3 mr-1" />
                        {matter.clientName}
                      </CardDescription>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        MATTER_STATUSES[matter.status as MatterStatus].color
                      }`}
                    >
                      {MATTER_STATUSES[matter.status as MatterStatus].label}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {matter.adverseParty && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">vs.</span> {matter.adverseParty}
                    </div>
                  )}

                  {matter.caseNumber && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Case #:</span> {matter.caseNumber}
                    </div>
                  )}

                  {matter.jurisdiction && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Jurisdiction:</span>{' '}
                      {JURISDICTIONS[matter.jurisdiction as Jurisdiction]}
                      {matter.courtType && ` - ${COURT_TYPES[matter.courtType as CourtType]}`}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t dark:border-slate-800">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {matter._count.sessions}
                      </div>
                      <div className="text-xs text-gray-500">Sessions</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {matter._count.documents}
                      </div>
                      <div className="text-xs text-gray-500">Docs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        ${((matter.totalBillableAmount || 0) / 100).toFixed(0)}
                      </div>
                      <div className="text-xs text-gray-500">Billed</div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 pt-2">
                    Updated {format(new Date(matter.updatedAt), 'MMM d, yyyy')}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                No matters found
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Get started by creating a new matter.
              </p>
              <Link href="/matters/new">
                <Button className="mt-4 bg-[#00BFA5] hover:bg-[#00BFA5]/90">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Matter
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
