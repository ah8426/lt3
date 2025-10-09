import { useState, useEffect } from 'react'

export interface BackupSettings {
  autoBackupEnabled?: boolean
  frequency?: string
  includeAudioFiles?: boolean
  includeDocuments?: boolean
  retentionDays?: number
  maxBackups?: number
  encryptBackups?: boolean
}

export interface Settings {
  backup?: BackupSettings
  [key: string]: any
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Load settings from localStorage or API
    const loadSettings = () => {
      try {
        const stored = localStorage.getItem('user_settings')
        if (stored) {
          setSettings(JSON.parse(stored))
        } else {
          setSettings({})
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
        setSettings({})
      }
    }

    loadSettings()
  }, [])

  const updateSettings = async (newSettings: Partial<Settings>) => {
    setIsLoading(true)
    try {
      const updated = { ...settings, ...newSettings }
      localStorage.setItem('user_settings', JSON.stringify(updated))
      setSettings(updated)
    } catch (error) {
      console.error('Failed to update settings:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return {
    settings,
    updateSettings,
    isLoading,
  }
}
