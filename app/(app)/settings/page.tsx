import { Metadata } from 'next'
import { SettingsLayout } from '@/components/settings/SettingsLayout'

export const metadata: Metadata = {
  title: 'Settings | Law Transcribed',
  description: 'Manage your account settings and preferences',
}

export default function SettingsPage() {
  return <SettingsLayout />
}
