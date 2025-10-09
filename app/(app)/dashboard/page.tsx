'use client';

import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Mic,
  FileText,
  Briefcase,
  Clock,
  TrendingUp,
  HardDrive,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-gray-200 dark:bg-slate-800 animate-pulse rounded" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-slate-800 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const displayName = user?.user_metadata?.full_name ||
                      user?.user_metadata?.name ||
                      user?.email?.split('@')[0] ||
                      'there';

  // Mock stats - replace with actual data from your backend
  const stats = [
    {
      title: 'Sessions This Month',
      value: '24',
      change: '+12% from last month',
      icon: Clock,
      color: 'text-[#00BFA5]',
      bgColor: 'bg-[#00BFA5]/10',
    },
    {
      title: 'Total Sessions',
      value: '156',
      change: 'All time',
      icon: FileText,
      color: 'text-[#1E3A8A]',
      bgColor: 'bg-[#1E3A8A]/10',
    },
    {
      title: 'Active Matters',
      value: '8',
      change: '3 updated today',
      icon: Briefcase,
      color: 'text-purple-600',
      bgColor: 'bg-purple-600/10',
    },
    {
      title: 'Storage Used',
      value: '2.4 GB',
      change: 'of 10 GB',
      icon: HardDrive,
      color: 'text-orange-600',
      bgColor: 'bg-orange-600/10',
    },
  ];

  // Mock recent sessions - replace with actual data
  const recentSessions = [
    {
      id: 1,
      title: 'Client Meeting Notes - Smith v. Johnson',
      matter: 'Smith v. Johnson',
      duration: '15:30',
      date: '2 hours ago',
      status: 'completed',
    },
    {
      id: 2,
      title: 'Deposition Preparation',
      matter: 'Wilson Estate',
      duration: '22:45',
      date: 'Yesterday',
      status: 'completed',
    },
    {
      id: 3,
      title: 'Case Strategy Discussion',
      matter: 'Thompson LLC',
      duration: '18:20',
      date: '2 days ago',
      status: 'completed',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Welcome back, {displayName}!
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Here&apos;s what&apos;s happening with your legal dictation today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-gray-200 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {stat.title}
              </CardTitle>
              <div className={`${stat.bgColor} p-2 rounded-lg`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stat.value}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="border-gray-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Quick Actions</CardTitle>
          <CardDescription>Get started with common tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Link href="/dictation">
              <Button
                className="w-full h-24 bg-gradient-to-br from-[#00BFA5] to-[#00BFA5]/80 hover:from-[#00BFA5]/90 hover:to-[#00BFA5]/70 text-white"
                size="lg"
              >
                <div className="flex flex-col items-center gap-2">
                  <Mic className="h-6 w-6" />
                  <span>New Session</span>
                </div>
              </Button>
            </Link>
            <Link href="/matters">
              <Button
                variant="outline"
                className="w-full h-24 border-2 hover:border-[#00BFA5] hover:text-[#00BFA5]"
                size="lg"
              >
                <div className="flex flex-col items-center gap-2">
                  <Briefcase className="h-6 w-6" />
                  <span>View Matters</span>
                </div>
              </Button>
            </Link>
            <Link href="/sessions">
              <Button
                variant="outline"
                className="w-full h-24 border-2 hover:border-[#00BFA5] hover:text-[#00BFA5]"
                size="lg"
              >
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-6 w-6" />
                  <span>All Sessions</span>
                </div>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <Card className="border-gray-200 dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-gray-900 dark:text-white">Recent Sessions</CardTitle>
            <CardDescription>Your latest dictation sessions</CardDescription>
          </div>
          <Link href="/sessions">
            <Button variant="ghost" size="sm" className="text-[#00BFA5] hover:text-[#00BFA5]/80">
              View all
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-slate-800 hover:border-[#00BFA5] dark:hover:border-[#00BFA5] transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-[#00BFA5]/10 p-3 rounded-lg">
                    <FileText className="h-5 w-5 text-[#00BFA5]" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {session.title}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {session.matter} • {session.duration}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {session.date}
                  </p>
                  <div className="mt-1">
                    <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:text-green-400">
                      {session.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tips & Updates */}
      <Card className="border-gray-200 dark:border-slate-800 bg-gradient-to-br from-[#00BFA5]/5 to-[#1E3A8A]/5">
        <CardHeader>
          <CardTitle className="flex items-center text-gray-900 dark:text-white">
            <TrendingUp className="mr-2 h-5 w-5 text-[#00BFA5]" />
            Pro Tip
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 dark:text-gray-300">
            Use voice commands like &quot;new paragraph&quot; or &quot;insert comma&quot; to format your dictation in real-time.
            This saves time during transcription review.
          </p>
          <Link href="/help">
            <Button variant="link" className="mt-2 p-0 text-[#00BFA5] hover:text-[#00BFA5]/80">
              Learn more about voice commands
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
