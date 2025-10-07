'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WaveformVisualizer } from '@/components/dictation/WaveformVisualizer';
import {
  ArrowLeft,
  Edit2,
  Save,
  X,
  Share2,
  Download,
  Trash2,
  Copy,
  Check,
  Loader2,
  FileText,
  Clock,
  User,
  MessageSquare,
  Play,
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

interface Comment {
  id: string;
  text: string;
  user_id: string;
  created_at: string;
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const {
    session,
    segments,
    isLoading,
    error,
    updateSegment,
    updateSession,
    deleteSession,
  } = useSession(sessionId);

  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  // Fetch audio blob
  useState(() => {
    if (session?.audio_url) {
      fetch(session.audio_url)
        .then((res) => res.blob())
        .then(setAudioBlob)
        .catch(console.error);
    }
  });

  /**
   * Handle title edit
   */
  const handleSaveTitle = async () => {
    if (!newTitle.trim()) return;

    try {
      await updateSession({ title: newTitle });
      setEditingTitle(false);
    } catch (error) {
      console.error('Failed to update title:', error);
    }
  };

  /**
   * Handle segment edit
   */
  const handleStartEditSegment = (segmentId: string, text: string) => {
    setEditingSegmentId(segmentId);
    setEditedText(text);
  };

  const handleSaveSegment = async () => {
    if (!editingSegmentId || !editedText.trim()) return;

    try {
      await updateSegment(editingSegmentId, { text: editedText });
      setEditingSegmentId(null);
      setEditedText('');
    } catch (error) {
      console.error('Failed to update segment:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingSegmentId(null);
    setEditedText('');
  };

  /**
   * Handle delete session
   */
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }

    try {
      await deleteSession();
      router.push('/sessions');
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('Failed to delete session');
    }
  };

  /**
   * Generate share link
   */
  const handleGenerateShareLink = () => {
    const link = `${window.location.origin}/sessions/shared/${sessionId}`;
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

  /**
   * Handle export
   */
  const handleExport = async (format: 'txt' | 'docx' | 'pdf') => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/export?format=${format}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${session?.title}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export session');
    }
  };

  /**
   * Handle add comment
   */
  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    // In a real implementation, this would call an API
    const comment: Comment = {
      id: crypto.randomUUID(),
      text: newComment,
      user_id: 'current-user',
      created_at: new Date().toISOString(),
    };

    setComments([...comments, comment]);
    setNewComment('');
  };

  /**
   * Format duration
   */
  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  /**
   * Get speaker color
   */
  const getSpeakerColor = (speaker?: number): string => {
    if (speaker === undefined) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';

    const colors = [
      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    ];

    return colors[speaker % colors.length];
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#00BFA5]" />
      </div>
    );
  }

  // Error state
  if (error || !session) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load session</p>
        <Link href="/sessions">
          <Button className="mt-4" variant="outline">
            Back to Sessions
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Link href="/sessions">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sessions
            </Button>
          </Link>

          {editingTitle ? (
            <div className="flex items-center gap-2 max-w-2xl">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="text-2xl font-bold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
              />
              <Button size="icon" onClick={handleSaveTitle}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={() => setEditingTitle(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {session.title}
              </h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setNewTitle(session.title);
                  setEditingTitle(true);
                }}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          {session.matter && (
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {session.matter.name} • {session.matter.client_name}
            </p>
          )}

          <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(session.duration_ms)}
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {segments?.length || 0} segments
            </div>
            <span>{format(new Date(session.created_at), 'MMMM d, yyyy h:mm a')}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGenerateShareLink}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button variant="outline" onClick={() => handleExport('txt')}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={handleDelete} className="text-red-600">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="transcript" className="space-y-6">
        <TabsList>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
          <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
        </TabsList>

        {/* Transcript Tab */}
        <TabsContent value="transcript" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Full Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {segments?.map((segment: any) => {
                    const isEditing = editingSegmentId === segment.id;

                    return (
                      <div
                        key={segment.id}
                        className="group p-4 rounded-lg border dark:border-gray-700 hover:border-[#00BFA5] transition-colors"
                      >
                        {/* Segment Header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {segment.speaker !== undefined && segment.speaker !== null && (
                              <Badge
                                variant="outline"
                                className={`${getSpeakerColor(segment.speaker)} border-0`}
                              >
                                <User className="h-3 w-3 mr-1" />
                                Speaker {segment.speaker}
                              </Badge>
                            )}

                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="h-3 w-3" />
                              <span>{formatDuration(segment.start_time)}</span>
                            </div>

                            {segment.confidence && (
                              <Badge
                                variant="outline"
                                className={
                                  segment.confidence >= 0.9
                                    ? 'border-green-300 text-green-700'
                                    : segment.confidence >= 0.7
                                    ? 'border-yellow-300 text-yellow-700'
                                    : 'border-red-300 text-red-700'
                                }
                              >
                                {Math.round(segment.confidence * 100)}%
                              </Badge>
                            )}
                          </div>

                          {!isEditing && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleStartEditSegment(segment.id, segment.text)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {/* Segment Text */}
                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editedText}
                              onChange={(e) => setEditedText(e.target.value)}
                              className="w-full min-h-[100px]"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSaveSegment}>
                                <Save className="h-4 w-4 mr-1" />
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                <X className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-base text-gray-900 dark:text-white leading-relaxed">
                            {segment.text}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audio Tab */}
        <TabsContent value="audio">
          <Card>
            <CardHeader>
              <CardTitle>Audio Playback</CardTitle>
            </CardHeader>
            <CardContent>
              <WaveformVisualizer
                audioBlob={audioBlob}
                isRecording={false}
                audioLevel={0}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Session Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Comment */}
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                />
                <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Add Comment
                </Button>
              </div>

              {/* Comments List */}
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-4 rounded-lg border dark:border-gray-700"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-medium">User</span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {comment.text}
                      </p>
                    </div>
                  ))}

                  {comments.length === 0 && (
                    <p className="text-center text-gray-500 py-8">
                      No comments yet. Add the first comment above.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Session</DialogTitle>
            <DialogDescription>
              Anyone with this link can view the transcript
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="share-link">Share Link</Label>
              <div className="flex gap-2">
                <Input id="share-link" value={shareLink} readOnly className="flex-1" />
                <Button variant="outline" onClick={handleCopyLink} className="w-24">
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
