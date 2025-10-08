'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

interface Speaker {
  id: string
  sessionId: string
  speakerNumber: number
  name?: string
  role?: string
  organization?: string
  color?: string
  createdAt: Date
  updatedAt: Date
}

interface SpeakerEditorProps {
  speaker: Speaker
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<Speaker>) => Promise<void>
  mergeSpeakers?: Speaker[]
  onMerge?: (targetSpeakerId: string) => Promise<void>
}

const ROLES = [
  { value: 'attorney', label: 'Attorney' },
  { value: 'client', label: 'Client' },
  { value: 'witness', label: 'Witness' },
  { value: 'expert', label: 'Expert' },
  { value: 'judge', label: 'Judge' },
  { value: 'court_reporter', label: 'Court Reporter' },
  { value: 'interpreter', label: 'Interpreter' },
  { value: 'other', label: 'Other' },
]

const SPEAKER_COLORS = [
  { value: '#3B82F6', label: 'Blue' },
  { value: '#10B981', label: 'Green' },
  { value: '#F59E0B', label: 'Amber' },
  { value: '#EF4444', label: 'Red' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#14B8A6', label: 'Teal' },
  { value: '#F97316', label: 'Orange' },
  { value: '#6366F1', label: 'Indigo' },
  { value: '#84CC16', label: 'Lime' },
]

export function SpeakerEditor({
  speaker,
  isOpen,
  onClose,
  onSave,
  mergeSpeakers,
  onMerge,
}: SpeakerEditorProps) {
  const [name, setName] = useState(speaker.name || '')
  const [role, setRole] = useState(speaker.role || '')
  const [organization, setOrganization] = useState(speaker.organization || '')
  const [color, setColor] = useState(speaker.color || '#3B82F6')
  const [mergeTarget, setMergeTarget] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when speaker changes
  useEffect(() => {
    setName(speaker.name || '')
    setRole(speaker.role || '')
    setOrganization(speaker.organization || '')
    setColor(speaker.color || '#3B82F6')
    setMergeTarget('')
    setError(null)
  }, [speaker])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      await onSave({
        name: name.trim() || undefined,
        role: role || undefined,
        organization: organization.trim() || undefined,
        color,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save speaker')
    } finally {
      setIsSaving(false)
    }
  }

  const handleMerge = async () => {
    if (!mergeTarget || !onMerge) return

    setIsSaving(true)
    setError(null)

    try {
      await onMerge(mergeTarget)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge speakers')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Speaker Details</DialogTitle>
          <DialogDescription>
            Update speaker information for Speaker {speaker.speakerNumber + 1}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Speaker ${speaker.speakerNumber + 1}`}
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Organization */}
          <div className="space-y-2">
            <Label htmlFor="organization">Organization</Label>
            <Input
              id="organization"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="Law firm, company, etc."
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Display Color</Label>
            <div className="grid grid-cols-5 gap-2">
              {SPEAKER_COLORS.map((c) => (
                <button
                  key={c.value}
                  className={`w-full h-10 rounded-md border-2 transition-all hover:scale-110 ${
                    color === c.value ? 'ring-2 ring-offset-2 ring-primary' : ''
                  }`}
                  style={{
                    backgroundColor: c.value,
                    borderColor: color === c.value ? c.value : 'transparent',
                  }}
                  onClick={() => setColor(c.value)}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Merge Section */}
          {mergeSpeakers && mergeSpeakers.length > 0 && onMerge && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or merge with another speaker
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Merge Into</Label>
                <Select value={mergeTarget} onValueChange={setMergeTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select speaker to merge with" />
                  </SelectTrigger>
                  <SelectContent>
                    {mergeSpeakers
                      .filter((s) => s.id !== speaker.id)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: s.color }}
                            />
                            {s.name || `Speaker ${s.speakerNumber + 1}`}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {mergeTarget && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      This will reassign all segments from this speaker to the selected speaker.
                      This action cannot be undone.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          {mergeTarget ? (
            <Button onClick={handleMerge} disabled={isSaving}>
              {isSaving ? 'Merging...' : 'Merge Speakers'}
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
