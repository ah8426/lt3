'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMatter, useUpdateMatter, useDeleteMatter } from '@/hooks/useMatters';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Briefcase,
  Users,
  FileText,
  Clock,
  DollarSign,
  Edit,
  Archive,
  Loader2,
  Play,
  Pause,
  CheckCircle,
  Calendar,
  MapPin,
  Scale,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import type { MatterStatus, Jurisdiction, CourtType } from '@/types/matter';
import { MATTER_STATUSES, JURISDICTIONS, COURT_TYPES } from '@/types/matter';

export default function MatterDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const matterId = params.id as string;

  const { data: matterData, isLoading } = useMatter(matterId);
  const updateMatter = useUpdateMatter();
  const deleteMatter = useDeleteMatter();

  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  const matter = matterData?.matter;

  const handleArchive = async () => {
    try {
      await deleteMatter.mutateAsync(matterId);
      router.push('/matters');
    } catch (error) {
      console.error('Error archiving matter:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#00BFA5]" />
      </div>
    );
  }

  if (!matter) {
    return (
      <div className="text-center py-12">
        <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
          Matter not found
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          The matter you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Link href="/matters">
          <Button className="mt-4 bg-[#00BFA5] hover:bg-[#00BFA5]/90">
            Back to Matters
          </Button>
        </Link>
      </div>
    );
  }

  const billingStats = matter.billingStats || {
    totalAmount: 0,
    totalBillableSeconds: 0,
    totalDurationSeconds: 0,
    count: 0,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {matter.name}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                MATTER_STATUSES[matter.status as MatterStatus].color
              }`}
            >
              {MATTER_STATUSES[matter.status as MatterStatus].label}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Users className="h-4 w-4" />
            <span>{matter.clientName}</span>
            {matter.adverseParty && (
              <>
                <span className="text-gray-400">•</span>
                <span className="font-medium">vs.</span>
                <span>{matter.adverseParty}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/matters/${matterId}/edit`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => setShowArchiveDialog(true)}
            disabled={matter.status === 'archived'}
          >
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{matter._count.sessions}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round(billingStats.totalDurationSeconds / 3600)} hours total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{matter._count.documents}</div>
            <p className="text-xs text-muted-foreground">Generated documents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Billable Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(billingStats.totalBillableSeconds / 3600)}h
            </div>
            <p className="text-xs text-muted-foreground">
              {billingStats.count} entries
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
              ${(billingStats.totalAmount / 100).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Billable amount</p>
          </CardContent>
        </Card>
      </div>

      {/* Matter Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Matter Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {matter.caseNumber && (
              <div className="flex items-start">
                <Scale className="mr-3 h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Case Number
                  </p>
                  <p className="text-base text-gray-900 dark:text-white">
                    {matter.caseNumber}
                  </p>
                </div>
              </div>
            )}

            {matter.jurisdiction && (
              <div className="flex items-start">
                <MapPin className="mr-3 h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Jurisdiction
                  </p>
                  <p className="text-base text-gray-900 dark:text-white">
                    {JURISDICTIONS[matter.jurisdiction as Jurisdiction]}
                    {matter.courtType &&
                      ` - ${COURT_TYPES[matter.courtType as CourtType]}`}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start">
              <Calendar className="mr-3 h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Created
                </p>
                <p className="text-base text-gray-900 dark:text-white">
                  {format(new Date(matter.createdAt), 'MMMM d, yyyy')}
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <Calendar className="mr-3 h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Last Updated
                </p>
                <p className="text-base text-gray-900 dark:text-white">
                  {format(new Date(matter.updatedAt), 'MMMM d, yyyy')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href={`/sessions/new?matterId=${matterId}`}>
              <Button className="w-full bg-[#00BFA5] hover:bg-[#00BFA5]/90">
                <Play className="mr-2 h-4 w-4" />
                Start New Session
              </Button>
            </Link>
            <Link href={`/documents/new?matterId=${matterId}`}>
              <Button variant="outline" className="w-full">
                <FileText className="mr-2 h-4 w-4" />
                Generate Document
              </Button>
            </Link>
            <Link href={`/billing?matterId=${matterId}`}>
              <Button variant="outline" className="w-full">
                <DollarSign className="mr-2 h-4 w-4" />
                View Billing
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sessions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="conflicts">Conflict Checks</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          {matter.sessions && matter.sessions.length > 0 ? (
            <div className="space-y-4">
              {matter.sessions.map((session: {
                id: string;
                title: string;
                status: string;
                startedAt: string;
                endedAt: string | null;
                durationMs: number | null;
              }) => (
                <Link key={session.id} href={`/sessions/${session.id}`}>
                  <Card className="hover:border-[#00BFA5] transition-colors cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {session.title}
                          </h3>
                          <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <Calendar className="mr-1 h-3 w-3" />
                              {format(new Date(session.startedAt), 'MMM d, yyyy')}
                            </span>
                            {session.durationMs && (
                              <span className="flex items-center">
                                <Clock className="mr-1 h-3 w-3" />
                                {Math.round(session.durationMs / 60000)} min
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {session.status === 'recording' && (
                            <span className="flex items-center text-sm text-red-600">
                              <Pause className="mr-1 h-4 w-4" />
                              Recording
                            </span>
                          )}
                          {session.status === 'completed' && (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {matter._count.sessions > 10 && (
                <Link href={`/sessions?matterId=${matterId}`}>
                  <Button variant="outline" className="w-full">
                    View All Sessions ({matter._count.sessions})
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                  No sessions yet
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Start your first session for this matter.
                </p>
                <Link href={`/sessions/new?matterId=${matterId}`}>
                  <Button className="mt-4 bg-[#00BFA5] hover:bg-[#00BFA5]/90">
                    <Play className="mr-2 h-4 w-4" />
                    Start Session
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          {matter.documents && matter.documents.length > 0 ? (
            <div className="space-y-4">
              {matter.documents.map((document: {
                id: string;
                title: string;
                format: string;
                createdAt: string;
              }) => (
                <Link key={document.id} href={`/documents/${document.id}`}>
                  <Card className="hover:border-[#00BFA5] transition-colors cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {document.title}
                          </h3>
                          <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <Calendar className="mr-1 h-3 w-3" />
                              {format(new Date(document.createdAt), 'MMM d, yyyy')}
                            </span>
                            <span className="uppercase">{document.format}</span>
                          </div>
                        </div>
                        <FileText className="h-5 w-5 text-gray-400" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {matter._count.documents > 10 && (
                <Link href={`/documents?matterId=${matterId}`}>
                  <Button variant="outline" className="w-full">
                    View All Documents ({matter._count.documents})
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                  No documents yet
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Generate your first document for this matter.
                </p>
                <Link href={`/documents/new?matterId=${matterId}`}>
                  <Button className="mt-4 bg-[#00BFA5] hover:bg-[#00BFA5]/90">
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Document
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          {matter.billableTime && matter.billableTime.length > 0 ? (
            <div className="space-y-4">
              {matter.billableTime.map((entry: {
                id: string;
                description: string | null;
                createdAt: string;
                billableSeconds: number;
                amount: number;
              }) => (
                <Card key={entry.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {entry.description || 'Billable time entry'}
                        </h3>
                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Calendar className="mr-1 h-3 w-3" />
                            {format(new Date(entry.createdAt), 'MMM d, yyyy')}
                          </span>
                          <span className="flex items-center">
                            <Clock className="mr-1 h-3 w-3" />
                            {Math.round(entry.billableSeconds / 60)} min
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          ${(entry.amount / 100).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Card className="bg-gray-50 dark:bg-gray-900">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Total Billable Amount
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {billingStats.count} entries •{' '}
                        {Math.round(billingStats.totalBillableSeconds / 3600)} hours
                      </p>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${(billingStats.totalAmount / 100).toFixed(2)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                  No billing entries yet
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Billable time will be tracked automatically during sessions.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="conflicts" className="space-y-4">
          {matter.conflictChecks && matter.conflictChecks.length > 0 ? (
            <div className="space-y-4">
              {matter.conflictChecks.map((check: {
                id: string;
                clientName: string | null;
                riskLevel: string;
                totalMatches: number;
                recommendation: string;
                summary: string;
                createdAt: string;
              }) => (
                <Card key={check.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {check.clientName || 'Conflict Check'}
                        </h3>
                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Calendar className="mr-1 h-3 w-3" />
                            {format(new Date(check.createdAt), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                      <div>
                        {check.totalMatches > 0 ? (
                          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            {check.totalMatches} Conflict{check.totalMatches > 1 ? 's' : ''} Found
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            No Conflicts
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Scale className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                  No conflict checks yet
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Conflict checks are performed when adding adverse parties.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Archive Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Matter</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive &quot;{matter.name}&quot;? This will not delete
              any data, but the matter will be moved to archived status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className="bg-red-600 hover:bg-red-700"
            >
              Archive Matter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
