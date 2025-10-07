'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Play,
  Pause,
  Square,
  Save,
  Download,
  Share2,
  FileText,
  FileType,
  FileCode,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';

interface SessionControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSave: () => void;
  onExport: (format: 'txt' | 'docx' | 'pdf') => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  canSave: boolean;
}

export function SessionControls({
  isRecording,
  isPaused,
  onStart,
  onPause,
  onResume,
  onStop,
  onSave,
  onExport,
  saveStatus,
  canSave,
}: SessionControlsProps) {
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);

  /**
   * Generate share link
   */
  const handleGenerateShareLink = () => {
    // In a real implementation, this would create a shareable link
    const link = `${window.location.origin}/sessions/shared/${crypto.randomUUID()}`;
    setShareLink(link);
    setShowShareDialog(true);
  };

  /**
   * Copy share link
   */
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Primary Recording Controls */}
      <div className="flex items-center justify-center gap-4">
        {!isRecording ? (
          <Button
            size="lg"
            onClick={onStart}
            className="bg-[#00BFA5] hover:bg-[#00BFA5]/90 w-full sm:w-auto"
          >
            <Play className="mr-2 h-5 w-5" />
            Start Recording
          </Button>
        ) : (
          <>
            {isPaused ? (
              <Button
                size="lg"
                onClick={onResume}
                className="bg-[#00BFA5] hover:bg-[#00BFA5]/90"
              >
                <Play className="mr-2 h-5 w-5" />
                Resume
              </Button>
            ) : (
              <Button size="lg" variant="outline" onClick={onPause}>
                <Pause className="mr-2 h-5 w-5" />
                Pause
              </Button>
            )}

            <Button size="lg" variant="destructive" onClick={onStop}>
              <Square className="mr-2 h-5 w-5" />
              Stop
            </Button>
          </>
        )}
      </div>

      {/* Secondary Actions */}
      <div className="flex items-center gap-2">
        {/* Save Button */}
        <Button
          variant="outline"
          onClick={onSave}
          disabled={!canSave || saveStatus === 'saving'}
          className="flex-1"
        >
          {saveStatus === 'saving' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save
            </>
          )}
        </Button>

        {/* Export Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={!canSave} className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => onExport('txt')}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Export as Text (.txt)</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport('docx')}>
              <FileType className="mr-2 h-4 w-4" />
              <span>Export as Word (.docx)</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport('pdf')}>
              <FileCode className="mr-2 h-4 w-4" />
              <span>Export as PDF (.pdf)</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Download className="mr-2 h-4 w-4" />
              <span>Download Audio</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Share Button */}
        <Button
          variant="outline"
          onClick={handleGenerateShareLink}
          disabled={!canSave}
          className="flex-1"
        >
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>
      </div>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Session</DialogTitle>
            <DialogDescription>
              Anyone with this link will be able to view the transcript
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="share-link">Share Link</Label>
              <div className="flex gap-2">
                <Input
                  id="share-link"
                  value={shareLink}
                  readOnly
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleCopyLink}
                  className="w-24"
                >
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                💡 <strong>Tip:</strong> Share links expire after 7 days for security.
                You can manage permissions in session settings.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
