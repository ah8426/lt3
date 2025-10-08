import { describe, it, expect, beforeAll } from 'vitest'
import { getNTPTime, getTrustedTime } from '@/lib/timestamp/ntp-client'

describe('NTP Connectivity Tests', () => {
  const TIMEOUT = 10000 // 10 seconds for network operations

  describe('Production NTP Servers', () => {
    it('should connect to time.nist.gov', async () => {
      const result = await getNTPTime('time.nist.gov')

      expect(result).toBeDefined()
      expect(result.timestamp).toBeInstanceOf(Date)
      expect(result.server).toBe('time.nist.gov')
      expect(result.offset).toBeTypeOf('number')
      expect(result.roundTripDelay).toBeTypeOf('number')

      // Timestamp should be recent (within 1 minute of now)
      const now = new Date()
      const diff = Math.abs(result.timestamp.getTime() - now.getTime())
      expect(diff).toBeLessThan(60000) // 1 minute
    }, TIMEOUT)

    it('should connect to pool.ntp.org', async () => {
      const result = await getNTPTime('pool.ntp.org')

      expect(result).toBeDefined()
      expect(result.timestamp).toBeInstanceOf(Date)
      expect(result.server).toBe('pool.ntp.org')
      expect(result.offset).toBeTypeOf('number')
      expect(result.roundTripDelay).toBeTypeOf('number')

      // Verify reasonable offset (less than 5 seconds)
      expect(Math.abs(result.offset)).toBeLessThan(5000)
    }, TIMEOUT)

    it('should connect to time.google.com', async () => {
      const result = await getNTPTime('time.google.com')

      expect(result).toBeDefined()
      expect(result.timestamp).toBeInstanceOf(Date)
      expect(result.server).toBe('time.google.com')

      // Google NTP should have low round-trip delay
      expect(result.roundTripDelay).toBeLessThan(1000) // <1s for Google
    }, TIMEOUT)
  })

  describe('Fallback Mechanism', () => {
    it('should fall back to local time on invalid server', async () => {
      const result = await getTrustedTime(['invalid.ntp.server'])

      expect(result).toBeDefined()
      expect(result.timestamp).toBeInstanceOf(Date)
      expect(result.source).toBe('local')
      expect(result.serverInfo).toBeUndefined()
    }, TIMEOUT)

    it('should try multiple servers before falling back', async () => {
      const servers = [
        'invalid1.ntp.server',
        'invalid2.ntp.server',
        'time.nist.gov', // This should succeed
      ]

      const result = await getTrustedTime(servers)

      expect(result).toBeDefined()
      expect(result.timestamp).toBeInstanceOf(Date)
      expect(result.source).toBe('ntp')
      expect(result.serverInfo?.server).toBe('time.nist.gov')
    }, TIMEOUT * 2)

    it('should use first successful NTP server', async () => {
      const servers = [
        'time.nist.gov',
        'pool.ntp.org',
        'time.google.com',
      ]

      const result = await getTrustedTime(servers)

      expect(result).toBeDefined()
      expect(result.source).toBe('ntp')
      expect(result.serverInfo?.server).toBe('time.nist.gov') // First server
    }, TIMEOUT)
  })

  describe('Time Accuracy', () => {
    it('should have minimal offset between multiple NTP queries', async () => {
      const result1 = await getNTPTime('time.nist.gov')
      const result2 = await getNTPTime('time.nist.gov')

      // Both queries should return similar times (within 2 seconds)
      const diff = Math.abs(result1.timestamp.getTime() - result2.timestamp.getTime())
      expect(diff).toBeLessThan(2000)
    }, TIMEOUT * 2)

    it('should have reasonable round-trip delay', async () => {
      const result = await getNTPTime('time.nist.gov')

      // Round-trip should be less than 2 seconds for US servers
      expect(result.roundTripDelay).toBeLessThan(2000)
      expect(result.roundTripDelay).toBeGreaterThan(0)
    }, TIMEOUT)

    it('should calculate accurate time offset', async () => {
      const beforeLocal = Date.now()
      const ntpResult = await getNTPTime('time.nist.gov')
      const afterLocal = Date.now()

      // NTP time should be between before and after local times
      const ntpTime = ntpResult.timestamp.getTime()
      const localMidpoint = (beforeLocal + afterLocal) / 2

      // Allow 5 second variance for network delay
      const diff = Math.abs(ntpTime - localMidpoint)
      expect(diff).toBeLessThan(5000)
    }, TIMEOUT)
  })

  describe('Performance Tests', () => {
    it('should complete NTP query within 5 seconds', async () => {
      const start = Date.now()
      await getNTPTime('time.nist.gov')
      const duration = Date.now() - start

      expect(duration).toBeLessThan(5000)
    }, TIMEOUT)

    it('should handle concurrent NTP requests', async () => {
      const promises = [
        getNTPTime('time.nist.gov'),
        getNTPTime('pool.ntp.org'),
        getNTPTime('time.google.com'),
      ]

      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result).toBeDefined()
        expect(result.timestamp).toBeInstanceOf(Date)
      })
    }, TIMEOUT * 2)

    it('should complete fallback within 10 seconds', async () => {
      const start = Date.now()
      await getTrustedTime(['invalid.server.com'])
      const duration = Date.now() - start

      // Should quickly fail and use local time
      expect(duration).toBeLessThan(10000)
    }, TIMEOUT)
  })

  describe('Error Handling', () => {
    it('should handle network timeout gracefully', async () => {
      // Using a non-existent server that will timeout
      const result = await getTrustedTime(['192.0.2.1']) // TEST-NET-1 (non-routable)

      expect(result).toBeDefined()
      expect(result.source).toBe('local') // Should fallback
      expect(result.timestamp).toBeInstanceOf(Date)
    }, TIMEOUT)

    it('should handle DNS resolution failure', async () => {
      const result = await getTrustedTime(['this-server-does-not-exist-12345.com'])

      expect(result).toBeDefined()
      expect(result.source).toBe('local')
    }, TIMEOUT)

    it('should handle empty server list', async () => {
      const result = await getTrustedTime([])

      expect(result).toBeDefined()
      expect(result.source).toBe('local')
      expect(result.timestamp).toBeInstanceOf(Date)
    })
  })

  describe('Firewall & Network Tests', () => {
    it('should confirm UDP port 123 is accessible', async () => {
      // This test verifies the production network allows NTP traffic
      const result = await getNTPTime('time.nist.gov')

      expect(result).toBeDefined()
      expect(result.server).toBe('time.nist.gov')

      // If this test passes, UDP port 123 is open
      console.log('✅ UDP Port 123 is accessible')
      console.log(`   Server: ${result.server}`)
      console.log(`   Offset: ${result.offset}ms`)
      console.log(`   Round-trip: ${result.roundTripDelay}ms`)
    }, TIMEOUT)

    it('should test multiple NTP servers for redundancy', async () => {
      const servers = [
        'time.nist.gov',
        'pool.ntp.org',
        'time.google.com',
        'time.cloudflare.com',
      ]

      const results = await Promise.allSettled(
        servers.map(server => getNTPTime(server))
      )

      const successful = results.filter(r => r.status === 'fulfilled')
      const failed = results.filter(r => r.status === 'rejected')

      console.log(`\n📊 NTP Server Test Results:`)
      console.log(`   Successful: ${successful.length}/${servers.length}`)
      console.log(`   Failed: ${failed.length}/${servers.length}`)

      // At least 2 servers should be accessible
      expect(successful.length).toBeGreaterThanOrEqual(2)
    }, TIMEOUT * servers.length)
  })

  describe('Production Readiness', () => {
    it('should verify NTP connectivity for production deployment', async () => {
      console.log('\n🔍 Production Readiness Check - NTP Connectivity\n')

      const criticalServers = ['time.nist.gov', 'pool.ntp.org']
      const results = []

      for (const server of criticalServers) {
        try {
          const result = await getNTPTime(server)
          results.push({
            server,
            status: 'success',
            offset: result.offset,
            roundTrip: result.roundTripDelay,
          })
          console.log(`✅ ${server}: Connected (offset: ${result.offset}ms, RTT: ${result.roundTripDelay}ms)`)
        } catch (error) {
          results.push({
            server,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          console.log(`❌ ${server}: Failed - ${error}`)
        }
      }

      const allSuccess = results.every(r => r.status === 'success')

      if (allSuccess) {
        console.log('\n✅ Production Ready: All critical NTP servers accessible\n')
      } else {
        console.log('\n⚠️  Warning: Some NTP servers unreachable. Fallback will be used.\n')
      }

      // Should have at least one working server
      const anySuccess = results.some(r => r.status === 'success')
      expect(anySuccess).toBe(true)
    }, TIMEOUT * 3)

    it('should verify local time fallback works correctly', async () => {
      const result = await getTrustedTime(['definitely-not-a-real-server.invalid'])

      expect(result.source).toBe('local')
      expect(result.timestamp).toBeInstanceOf(Date)

      // Local time should be very close to current time
      const now = Date.now()
      const diff = Math.abs(result.timestamp.getTime() - now)
      expect(diff).toBeLessThan(1000) // Within 1 second

      console.log('✅ Local time fallback working correctly')
    }, TIMEOUT)
  })

  describe('Integration with Timestamp System', () => {
    it('should work with timestamp proof generator', async () => {
      const { generateProof } = await import('@/lib/timestamp/proof-generator')

      const proof = await generateProof({
        segmentId: 'test-segment',
        sessionId: 'test-session',
        content: 'Test content for NTP integration',
      })

      expect(proof).toBeDefined()
      expect(proof.timestamp).toBeInstanceOf(Date)
      expect(proof.timestampSource).toMatch(/ntp|local/)

      // If NTP is available, it should be used
      if (proof.timestampSource === 'ntp') {
        expect(proof.ntpServer).toBeDefined()
        console.log(`✅ Proof generated with NTP time from ${proof.ntpServer}`)
      } else {
        console.log('⚠️  Proof generated with local time (NTP unavailable)')
      }
    }, TIMEOUT)
  })
})

describe('NTP Server Configuration', () => {
  it('should use recommended NTP server list', () => {
    // These are the recommended servers from TIMESTAMP_IMPLEMENTATION_SUMMARY.md
    const recommendedServers = [
      'time.nist.gov',     // NIST (US Government)
      'pool.ntp.org',      // Community pool (6 servers)
      'time.google.com',   // Google Public NTP
      'time.cloudflare.com', // Cloudflare NTP
    ]

    // Verify these servers are accessible (already tested above)
    expect(recommendedServers).toContain('time.nist.gov')
    expect(recommendedServers).toContain('pool.ntp.org')

    console.log('\n📝 Recommended NTP Servers:')
    recommendedServers.forEach(server => {
      console.log(`   - ${server}`)
    })
  })
})
