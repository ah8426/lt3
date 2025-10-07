'use client'

import { useSegmentHistory } from '@/hooks/useSession'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Clock, User, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

interface SegmentEditHistoryProps {
  segmentId: string
}

interface EditHistory {
  id: string
  previous_text: string
  new_text: string
  edited_by: string
  created_at: string
  profiles?: {
    email: string
    full_name?: string
  }
}

export function SegmentEditHistory({ segmentId }: SegmentEditHistoryProps) {
  const { data, isLoading, error } = useSegmentHistory(segmentId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-destructive">Failed to load edit history</p>
      </div>
    )
  }

  const history = (data?.history || []) as EditHistory[]

  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">No edit history</p>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Edit History</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {history.map((edit, index) => (
              <div
                key={edit.id}
                className="border rounded-lg p-4 space-y-3 dark:border-gray-700"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {edit.profiles?.full_name || edit.profiles?.email || 'Unknown User'}
                    </span>
                    {index === 0 && (
                      <Badge variant="outline" className="text-xs">
                        Latest
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{format(new Date(edit.created_at), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                </div>

                {/* Changes */}
                <div className="space-y-2">
                  {/* Previous text */}
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Previous</div>
                    <div className="p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                      <p className="text-sm text-red-900 dark:text-red-100 line-through">
                        {edit.previous_text}
                      </p>
                    </div>
                  </div>

                  {/* New text */}
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">New</div>
                    <div className="p-2 rounded bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                      <p className="text-sm text-green-900 dark:text-green-100">
                        {edit.new_text}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
