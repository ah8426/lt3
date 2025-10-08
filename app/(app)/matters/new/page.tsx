'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateMatter } from '@/hooks/useMatters';
import { useConflicts } from '@/hooks/useConflicts';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Briefcase, ArrowLeft, Loader2, AlertCircle, Shield } from 'lucide-react';
import Link from 'next/link';
import type { CreateMatterInput } from '@/types/matter';
import { JURISDICTIONS, COURT_TYPES } from '@/types/matter';
import { ConflictReport } from '@/components/conflicts/ConflictReport';
import { ConflictCheckResult } from '@/lib/conflicts/conflict-checker';

export default function NewMatterPage() {
  const router = useRouter();
  const createMatter = useCreateMatter();
  const { runConflictCheck } = useConflicts();

  const [formData, setFormData] = useState<CreateMatterInput>({
    name: '',
    clientName: '',
    adverseParty: '',
    jurisdiction: undefined,
    courtType: undefined,
    caseNumber: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflictResult, setConflictResult] = useState<ConflictCheckResult | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [pendingMatterData, setPendingMatterData] = useState<CreateMatterInput | null>(null);

  const handleInputChange = (field: keyof CreateMatterInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Matter name is required';
    }

    if (!formData.clientName.trim()) {
      newErrors.clientName = 'Client name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const data: CreateMatterInput = {
      name: formData.name.trim(),
      clientName: formData.clientName.trim(),
      adverseParty: formData.adverseParty?.trim() || null,
      jurisdiction: formData.jurisdiction || null,
      courtType: formData.courtType || null,
      caseNumber: formData.caseNumber?.trim() || null,
    };

    // Run conflict check before creating matter
    setIsCheckingConflicts(true);
    try {
      const result = await runConflictCheck({
        clientName: data.clientName,
        adverseParties: data.adverseParty ? [data.adverseParty] : [],
        matterDescription: data.name,
        saveResult: true,
      });

      setConflictResult(result);
      setPendingMatterData(data);

      // Block creation if HIGH or CRITICAL conflicts found
      if (result.riskLevel === 'high' || result.riskLevel === 'critical') {
        setShowConflictDialog(true);
        setIsCheckingConflicts(false);
        return;
      }

      // Auto-proceed for LOW, MEDIUM, or NONE
      await createMatterAfterConflictCheck(data);
    } catch (error) {
      console.error('Error checking conflicts:', error);
      // Continue with matter creation even if conflict check fails
      await createMatterAfterConflictCheck(data);
    }
  };

  const createMatterAfterConflictCheck = async (data: CreateMatterInput) => {
    try {
      const result = await createMatter.mutateAsync(data);
      router.push(`/matters/${result.matter.id}`);
    } catch (error) {
      console.error('Error creating matter:', error);
      setErrors({
        submit: 'Failed to create matter. Please try again.',
      });
    } finally {
      setIsCheckingConflicts(false);
    }
  };

  const handleConflictDecision = async (decision: 'proceed' | 'cancel') => {
    if (decision === 'cancel') {
      setShowConflictDialog(false);
      setPendingMatterData(null);
      setConflictResult(null);
      return;
    }

    // User chose to proceed despite conflicts
    if (pendingMatterData) {
      setShowConflictDialog(false);
      await createMatterAfterConflictCheck(pendingMatterData);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <Link href="/matters">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Matters
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Create New Matter
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Add a new legal matter to your practice
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Briefcase className="mr-2 h-5 w-5 text-[#00BFA5]" />
              Matter Information
            </CardTitle>
            <CardDescription>
              Enter the details for this legal matter. Required fields are marked with
              an asterisk (*).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Error Alert */}
            {errors.submit && (
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-red-900 dark:text-red-200">
                    Error creating matter
                  </h4>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {errors.submit}
                  </p>
                </div>
              </div>
            )}

            {/* Matter Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Matter Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Smith v. Jones Contract Dispute"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-600 dark:text-red-400">{errors.name}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                A descriptive name for this matter
              </p>
            </div>

            {/* Client Name */}
            <div className="space-y-2">
              <Label htmlFor="clientName">
                Client Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="clientName"
                placeholder="e.g., John Smith"
                value={formData.clientName}
                onChange={(e) => handleInputChange('clientName', e.target.value)}
                className={errors.clientName ? 'border-red-500' : ''}
              />
              {errors.clientName && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {errors.clientName}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                The name of your client in this matter
              </p>
            </div>

            {/* Adverse Party */}
            <div className="space-y-2">
              <Label htmlFor="adverseParty">Adverse Party</Label>
              <Input
                id="adverseParty"
                placeholder="e.g., Jane Jones"
                value={formData.adverseParty}
                onChange={(e) => handleInputChange('adverseParty', e.target.value)}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                The opposing party (used for conflict checking)
              </p>
            </div>

            {/* Case Number */}
            <div className="space-y-2">
              <Label htmlFor="caseNumber">Case Number</Label>
              <Input
                id="caseNumber"
                placeholder="e.g., 2024-CV-12345"
                value={formData.caseNumber}
                onChange={(e) => handleInputChange('caseNumber', e.target.value)}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                The court case number, if assigned
              </p>
            </div>

            {/* Jurisdiction */}
            <div className="space-y-2">
              <Label htmlFor="jurisdiction">Jurisdiction</Label>
              <Select
                value={formData.jurisdiction || 'none'}
                onValueChange={(value) =>
                  handleInputChange('jurisdiction', value === 'none' ? '' : value)
                }
              >
                <SelectTrigger id="jurisdiction">
                  <SelectValue placeholder="Select jurisdiction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-gray-500">No jurisdiction selected</span>
                  </SelectItem>
                  {Object.entries(JURISDICTIONS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                The legal jurisdiction for this matter
              </p>
            </div>

            {/* Court Type */}
            <div className="space-y-2">
              <Label htmlFor="courtType">Court Type</Label>
              <Select
                value={formData.courtType || 'none'}
                onValueChange={(value) =>
                  handleInputChange('courtType', value === 'none' ? '' : value)
                }
                disabled={!formData.jurisdiction}
              >
                <SelectTrigger id="courtType">
                  <SelectValue placeholder="Select court type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-gray-500">No court type selected</span>
                  </SelectItem>
                  {Object.entries(COURT_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formData.jurisdiction
                  ? 'The type of court handling this matter'
                  : 'Select a jurisdiction first'}
              </p>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-4 pt-6 border-t dark:border-slate-800">
              <Link href="/matters">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                className="bg-[#00BFA5] hover:bg-[#00BFA5]/90"
                disabled={createMatter.isPending || isCheckingConflicts}
              >
                {isCheckingConflicts ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking Conflicts...
                  </>
                ) : createMatter.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Briefcase className="mr-2 h-4 w-4" />
                    Create Matter
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200">
                Automatic Conflict Checking
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                The system automatically performs a comprehensive conflict check when you create a matter.
                This includes checking the client name, adverse parties, and matter description against
                all existing matters. High-risk conflicts will require manual review before proceeding.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conflict Dialog */}
      <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <AlertCircle className="h-6 w-6 text-red-600" />
              Conflicts of Interest Detected
            </DialogTitle>
            <DialogDescription>
              The system has detected potential conflicts of interest. Please review the conflicts
              below and decide how to proceed.
            </DialogDescription>
          </DialogHeader>

          {conflictResult && (
            <div className="py-4">
              <ConflictReport result={conflictResult} />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => handleConflictDecision('cancel')}
            >
              Cancel Matter Creation
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleConflictDecision('proceed')}
            >
              Proceed Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
