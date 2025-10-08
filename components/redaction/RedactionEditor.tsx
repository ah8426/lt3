'use client'

import { useState } from 'react'
import { PIIType, getRedactionLabel } from '@/lib/redaction/pii-detector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Shield, X } from 'lucide-react'

export interface RedactionEditorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (params: {
    originalText: string
    redactedText: string
    piiType: PIIType
    startOffset: number
    endOffset: number
    reason?: string
    legalBasis?: string
    accessControl?: string[]
  }) => Promise<void>
  selectedText?: string
  startOffset?: number
  endOffset?: number
  suggestedType?: PIIType
}

const PII_TYPE_OPTIONS = [
  { value: PIIType.SSN, label: 'Social Security Number' },
  { value: PIIType.CREDIT_CARD, label: 'Credit Card' },
  { value: PIIType.BANK_ACCOUNT, label: 'Bank Account' },
  { value: PIIType.EMAIL, label: 'Email Address' },
  { value: PIIType.PHONE, label: 'Phone Number' },
  { value: PIIType.ADDRESS, label: 'Physical Address' },
  { value: PIIType.NAME, label: 'Name' },
  { value: PIIType.DATE_OF_BIRTH, label: 'Date of Birth' },
  { value: PIIType.DRIVER_LICENSE, label: 'Driver\'s License' },
  { value: PIIType.PASSPORT, label: 'Passport Number' },
  { value: PIIType.IP_ADDRESS, label: 'IP Address' },
  { value: PIIType.CUSTOM, label: 'Custom/Other' },
]

const LEGAL_BASIS_OPTIONS = [
  'HIPAA - Protected Health Information',
  'GDPR - Personal Data Protection',
  'CCPA - California Consumer Privacy',
  'FERPA - Education Records',
  'Attorney-Client Privilege',
  'Work Product Doctrine',
  'Trade Secret',
  'Court Order/Protective Order',
  'Other',
]

export function RedactionEditor({
  isOpen,
  onClose,
  onSave,
  selectedText = '',
  startOffset = 0,
  endOffset = 0,
  suggestedType,
}: RedactionEditorProps) {
  const [originalText, setOriginalText] = useState(selectedText)
  const [piiType, setPiiType] = useState<PIIType>(suggestedType || PIIType.CUSTOM)
  const [customRedactedText, setCustomRedactedText] = useState('')
  const [useCustomText, setUseCustomText] = useState(false)
  const [reason, setReason] = useState('')
  const [legalBasis, setLegalBasis] = useState('')
  const [accessControlEmails, setAccessControlEmails] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const defaultRedactedText = `[REDACTED: ${getRedactionLabel(piiType)}]`
  const redactedText = useCustomText && customRedactedText
    ? customRedactedText
    : defaultRedactedText

  const handleSave = async () => {
    if (!originalText.trim()) {
      return
    }

    setIsSaving(true)
    try {
      // Parse access control emails
      const accessControl = accessControlEmails
        .split(',')
        .map((email) => email.trim())
        .filter((email) => email.length > 0)

      await onSave({
        originalText,
        redactedText,
        piiType,
        startOffset,
        endOffset,
        reason: reason.trim() || undefined,
        legalBasis: legalBasis || undefined,
        accessControl: accessControl.length > 0 ? accessControl : undefined,
      })

      // Reset form
      setOriginalText('')
      setPiiType(PIIType.CUSTOM)
      setCustomRedactedText('')
      setUseCustomText(false)
      setReason('')
      setLegalBasis('')
      setAccessControlEmails('')
      onClose()
    } catch (error) {
      console.error('Failed to save redaction:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    if (!isSaving) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Create Redaction
          </DialogTitle>
          <DialogDescription>
            Redact sensitive information from the transcript. Original text will be encrypted and
            stored securely.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Original Text */}
          <div className="space-y-2">
            <Label htmlFor="original-text">Original Text *</Label>
            <Textarea
              id="original-text"
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              placeholder="Enter the text to redact..."
              rows={3}
              required
            />
            <p className="text-xs text-muted-foreground">
              This text will be encrypted and only accessible to authorized users.
            </p>
          </div>

          {/* PII Type */}
          <div className="space-y-2">
            <Label htmlFor="pii-type">Type of Information *</Label>
            <Select value={piiType} onValueChange={(value) => setPiiType(value as PIIType)}>
              <SelectTrigger id="pii-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PII_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Redacted Text Preview */}
          <div className="space-y-2">
            <Label>Redacted Text Preview</Label>
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md border">
              <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
                {redactedText}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="use-custom"
                checked={useCustomText}
                onChange={(e) => setUseCustomText(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="use-custom" className="font-normal cursor-pointer">
                Use custom replacement text
              </Label>
            </div>
            {useCustomText && (
              <Input
                value={customRedactedText}
                onChange={(e) => setCustomRedactedText(e.target.value)}
                placeholder="Enter custom redacted text..."
              />
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Redaction</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this content is being redacted..."
              rows={2}
            />
          </div>

          {/* Legal Basis */}
          <div className="space-y-2">
            <Label htmlFor="legal-basis">Legal Basis</Label>
            <Select value={legalBasis} onValueChange={setLegalBasis}>
              <SelectTrigger id="legal-basis">
                <SelectValue placeholder="Select legal basis (optional)" />
              </SelectTrigger>
              <SelectContent>
                {LEGAL_BASIS_OPTIONS.map((basis) => (
                  <SelectItem key={basis} value={basis}>
                    {basis}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Access Control */}
          <div className="space-y-2">
            <Label htmlFor="access-control">Who Can Unredact (Access Control)</Label>
            <Input
              id="access-control"
              value={accessControlEmails}
              onChange={(e) => setAccessControlEmails(e.target.value)}
              placeholder="Enter user IDs or emails, separated by commas..."
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to allow only yourself to unredact. Add user IDs or emails separated by
              commas to grant additional access.
            </p>
          </div>

          {/* Summary */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Redaction Summary
            </h4>
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Original text will be:</span> Encrypted
                and stored securely
              </p>
              <p>
                <span className="text-muted-foreground">Displayed as:</span>{' '}
                <Badge variant="outline">{redactedText}</Badge>
              </p>
              <p>
                <span className="text-muted-foreground">Access:</span>{' '}
                {accessControlEmails ? `Restricted to specified users` : 'Only you'}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!originalText.trim() || isSaving}
            className="bg-red-600 hover:bg-red-700"
          >
            {isSaving ? 'Creating Redaction...' : 'Create Redaction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
