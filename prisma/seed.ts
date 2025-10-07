import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Seed Subscription Plans
  const plans = [
    {
      name: 'Free',
      slug: 'free',
      description: 'Trial/evaluation tier with basic features',
      priceMonthly: 0,
      priceYearly: 0,
      stripePriceIdMonthly: null,
      stripePriceIdYearly: null,
      maxSessions: 2,
      maxStorageGB: 1,
      maxAIRequests: 10,
      maxMatters: 5,
      maxUsers: 1,
      features: {
        transcriptionMinutesPerMonth: 30,
        documentGenerationPerMonth: 0,
        auditLogging: 'basic',
        auditLogRetentionDays: 30,
        versionControl: true,
        timestampVerification: false,
        redactionTools: false,
        speakerDiarization: false,
        conflictChecking: false,
        autoBackup: false,
        offlineMode: false,
        voiceCommands: false,
        citationChecking: false,
        billableTimeTracking: true,
        documentGeneration: false,
        prioritySupport: false,
        customBranding: false,
        apiAccess: false,
        ssoIntegration: false,
      },
      isActive: true,
      sortOrder: 1,
    },
    {
      name: 'Starter',
      slug: 'starter',
      description: 'Perfect for solo practitioners with occasional use',
      priceMonthly: 2900, // $29.00
      priceYearly: 29000, // $290.00 (17% discount)
      stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || null,
      stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY || null,
      maxSessions: 25,
      maxStorageGB: 25,
      maxAIRequests: 500,
      maxMatters: 50,
      maxUsers: 1,
      features: {
        transcriptionMinutesPerMonth: 500,
        documentGenerationPerMonth: 10,
        auditLogging: 'full',
        auditLogRetentionDays: 365,
        versionControl: true,
        timestampVerification: true,
        redactionTools: true,
        speakerDiarization: true,
        conflictChecking: false,
        autoBackup: 'daily',
        offlineMode: false,
        voiceCommands: false,
        citationChecking: 'basic',
        billableTimeTracking: true,
        documentGeneration: true,
        prioritySupport: false,
        customBranding: false,
        apiAccess: false,
        ssoIntegration: false,
      },
      isActive: true,
      sortOrder: 2,
    },
    {
      name: 'Professional',
      slug: 'professional',
      description: 'For active solo practitioners and small firms',
      priceMonthly: 9900, // $99.00
      priceYearly: 99000, // $990.00 (17% discount)
      stripePriceIdMonthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY || null,
      stripePriceIdYearly: process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY || null,
      maxSessions: -1, // Unlimited
      maxStorageGB: 100,
      maxAIRequests: 2000,
      maxMatters: -1, // Unlimited
      maxUsers: 3,
      features: {
        transcriptionMinutesPerMonth: 2000,
        documentGenerationPerMonth: 100,
        auditLogging: 'full',
        auditLogRetentionDays: 365,
        versionControl: true,
        timestampVerification: true,
        redactionTools: true,
        speakerDiarization: true,
        conflictChecking: true,
        autoBackup: 'hourly',
        offlineMode: true,
        voiceCommands: true,
        citationChecking: 'advanced',
        billableTimeTracking: true,
        documentGeneration: true,
        prioritySupport: true,
        customBranding: false,
        apiAccess: false,
        ssoIntegration: false,
      },
      isActive: true,
      sortOrder: 3,
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      description: 'For law firms and corporate legal departments',
      priceMonthly: 29900, // $299.00
      priceYearly: 299000, // $2,990.00 (17% discount)
      stripePriceIdMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || null,
      stripePriceIdYearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || null,
      maxSessions: -1, // Unlimited
      maxStorageGB: 1000,
      maxAIRequests: -1, // Unlimited
      maxMatters: -1, // Unlimited
      maxUsers: -1, // Unlimited
      features: {
        transcriptionMinutesPerMonth: -1, // Unlimited
        documentGenerationPerMonth: -1, // Unlimited
        auditLogging: 'full',
        auditLogRetentionDays: -1, // Unlimited
        versionControl: true,
        timestampVerification: true,
        redactionTools: true,
        speakerDiarization: true,
        conflictChecking: true,
        autoBackup: 'realtime',
        offlineMode: true,
        voiceCommands: true,
        citationChecking: 'advanced',
        billableTimeTracking: true,
        documentGeneration: true,
        prioritySupport: true,
        customBranding: true,
        apiAccess: true,
        ssoIntegration: true,
        dedicatedAccountManager: true,
        phoneSupport: true,
        sla: '99.9%',
        customIntegrations: true,
        whiteLabel: true,
        advancedAnalytics: true,
      },
      isActive: true,
      sortOrder: 4,
    },
  ]

  console.log('📋 Creating subscription plans...')
  for (const plan of plans) {
    const created = await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    })
    console.log(`✓ Created plan: ${created.name} ($${created.priceMonthly / 100}/month)`)
  }

  // Seed Feature Flags (for gradual rollout of new features)
  console.log('\n🚩 Creating feature flags...')
  const featureFlags = [
    {
      name: 'offline_mode',
      description: 'Enable offline mode for mobile and web apps',
      isEnabled: false,
      rolloutPercent: 0,
      enabledForUsers: [],
      metadata: { betaFeature: true },
    },
    {
      name: 'voice_commands',
      description: 'Enable voice command interface',
      isEnabled: false,
      rolloutPercent: 0,
      enabledForUsers: [],
      metadata: { betaFeature: true },
    },
    {
      name: 'advanced_citation_checking',
      description: 'Enable AI-powered citation verification',
      isEnabled: true,
      rolloutPercent: 100,
      enabledForUsers: [],
      metadata: { stableFeature: true },
    },
    {
      name: 'conflict_checking',
      description: 'Enable automated conflict of interest checking',
      isEnabled: true,
      rolloutPercent: 100,
      enabledForUsers: [],
      metadata: { stableFeature: true },
    },
    {
      name: 'realtime_collaboration',
      description: 'Enable real-time collaborative editing',
      isEnabled: false,
      rolloutPercent: 0,
      enabledForUsers: [],
      metadata: { experimentalFeature: true },
    },
  ]

  for (const flag of featureFlags) {
    const created = await prisma.featureFlag.upsert({
      where: { name: flag.name },
      update: flag,
      create: flag,
    })
    console.log(`✓ Created feature flag: ${created.name} (${created.isEnabled ? 'enabled' : 'disabled'})`)
  }

  console.log('\n✅ Seeding completed successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error seeding database:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
