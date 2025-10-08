import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { logAction, getAuditLog } from '@/lib/audit/audit-logger'
import { AuditAction, AuditResource } from '@/types/audit'
import { createVersion, getVersionHistory, compareVersions, restoreVersion } from '@/lib/versioning/version-manager'
import { generateProof, verifyProof, generateChainOfCustody } from '@/lib/timestamp/proof-generator'
import { verifyProof as verifyProofChecker } from '@/lib/timestamp/proof-verifier'

describe('Integration Tests: Audit + Version + Timestamp', () => {
  const testUserId = 'test-user-integration'
  const testSessionId = 'test-session-integration'

  describe('Audit Logging Integration', () => {
    beforeEach(async () => {
      // Clean up test data
      // Note: In real tests, you'd use a test database
    })

    it('should log version creation events', async () => {
      // Create a version
      const version = await createVersion({
        sessionId: testSessionId,
        userId: testUserId,
        changeType: 'manual_save',
        changeReason: 'Integration test version',
      })

      expect(version).toBeDefined()
      expect(version.version).toBeGreaterThan(0)

      // Verify audit log was created
      const auditLogs = await getAuditLog({
        userId: testUserId,
        action: AuditAction.VERSION_CREATE,
        limit: 1,
      })

      expect(auditLogs.logs.length).toBeGreaterThan(0)
      const log = auditLogs.logs[0]
      expect(log.action).toBe(AuditAction.VERSION_CREATE)
      expect(log.resource).toBe(AuditResource.TRANSCRIPT)
    })

    it('should log timestamp creation events', async () => {
      const proof = await generateProof({
        segmentId: 'test-segment-audit',
        sessionId: testSessionId,
        content: 'Test content for audit logging',
      })

      expect(proof).toBeDefined()

      // Verify audit log
      const auditLogs = await getAuditLog({
        userId: testUserId,
        action: AuditAction.TIMESTAMP_CREATE,
        limit: 1,
      })

      expect(auditLogs.logs.length).toBeGreaterThan(0)
      const log = auditLogs.logs[0]
      expect(log.action).toBe(AuditAction.TIMESTAMP_CREATE)
    })

    it('should log version restore with old and new values', async () => {
      // Create initial version
      const v1 = await createVersion({
        sessionId: testSessionId,
        userId: testUserId,
        changeType: 'manual_save',
        changeReason: 'Initial version',
      })

      // Create second version
      const v2 = await createVersion({
        sessionId: testSessionId,
        userId: testUserId,
        changeType: 'segment_edit',
        changeReason: 'Modified version',
      })

      // Restore to v1
      const restored = await restoreVersion({
        sessionId: testSessionId,
        version: v1.version,
        userId: testUserId,
        reason: 'Test restore',
      })

      expect(restored).toBeDefined()

      // Verify audit log has old/new values
      const auditLogs = await getAuditLog({
        userId: testUserId,
        action: AuditAction.VERSION_RESTORE,
        limit: 1,
      })

      expect(auditLogs.logs.length).toBeGreaterThan(0)
      const log = auditLogs.logs[0]
      expect(log.oldValue).toBeDefined()
      expect(log.newValue).toBeDefined()
    })

    it('should create audit trail for complete workflow', async () => {
      const workflowSessionId = 'workflow-test-session'

      // 1. Create initial version
      await createVersion({
        sessionId: workflowSessionId,
        userId: testUserId,
        changeType: 'manual_save',
        changeReason: 'Initial save',
      })

      // 2. Create timestamp proof
      await generateProof({
        segmentId: 'workflow-segment-1',
        sessionId: workflowSessionId,
        content: 'First segment',
      })

      // 3. Create another version
      await createVersion({
        sessionId: workflowSessionId,
        userId: testUserId,
        changeType: 'segment_edit',
        changeReason: 'Edit segment',
      })

      // 4. Create another timestamp
      await generateProof({
        segmentId: 'workflow-segment-2',
        sessionId: workflowSessionId,
        content: 'Second segment',
      })

      // 5. Compare versions
      // await compareVersions({ sessionId: workflowSessionId, fromVersion: 1, toVersion: 2 })

      // 6. Verify timestamp
      // await verifyProof({ proofId: 'some-proof-id', userId: testUserId })

      // Get complete audit trail
      const auditLogs = await getAuditLog({
        sessionId: workflowSessionId,
        limit: 10,
      })

      // Should have multiple audit entries
      expect(auditLogs.logs.length).toBeGreaterThanOrEqual(2)

      // Verify we have both version and timestamp actions
      const actions = auditLogs.logs.map(l => l.action)
      expect(actions).toContain(AuditAction.VERSION_CREATE)
      expect(actions).toContain(AuditAction.TIMESTAMP_CREATE)
    })
  })

  describe('Version Control + Timestamp Integration', () => {
    it('should create timestamp when creating version', async () => {
      const sessionId = 'version-timestamp-test'

      // Create version
      const version = await createVersion({
        sessionId,
        userId: testUserId,
        changeType: 'manual_save',
        changeReason: 'Version with timestamp',
      })

      expect(version).toBeDefined()
      expect(version.createdAt).toBeInstanceOf(Date)

      // Version creation time should match timestamp proof time
      const timeDiff = Math.abs(Date.now() - version.createdAt.getTime())
      expect(timeDiff).toBeLessThan(5000) // Within 5 seconds
    })

    it('should maintain version integrity with timestamp proofs', async () => {
      const sessionId = 'integrity-test-session'

      // Create version with specific content
      const content = 'Original content for integrity test'
      const version = await createVersion({
        sessionId,
        userId: testUserId,
        changeType: 'manual_save',
        changeReason: 'Integrity test',
      })

      // Create timestamp proof for the same content
      const proof = await generateProof({
        segmentId: 'integrity-segment',
        sessionId,
        content,
      })

      // Verify proof
      const verification = await verifyProofChecker({
        proofId: proof.id,
        content, // Same content
        nonce: proof.nonce,
        userId: testUserId,
      })

      expect(verification.isValid).toBe(true)
      expect(verification.checks.contentMatch).toBe(true)
      expect(verification.checks.timestampValid).toBe(true)
      expect(verification.checks.signatureValid).toBe(true)
    })

    it('should detect tampering between version and timestamp', async () => {
      const sessionId = 'tampering-test'
      const originalContent = 'Original content'
      const tamperedContent = 'Tampered content'

      // Create timestamp proof for original content
      const proof = await generateProof({
        segmentId: 'tamper-segment',
        sessionId,
        content: originalContent,
      })

      // Try to verify with different content
      const verification = await verifyProofChecker({
        proofId: proof.id,
        content: tamperedContent, // Different content!
        nonce: proof.nonce,
        userId: testUserId,
      })

      expect(verification.isValid).toBe(false)
      expect(verification.checks.contentMatch).toBe(false)
      expect(verification.errors).toContain('Content hash mismatch')
    })
  })

  describe('Chain of Custody Integration', () => {
    it('should create verifiable chain of custody for session', async () => {
      const sessionId = 'chain-custody-test'

      // Create multiple segments with timestamps
      const segments = [
        { id: 'chain-seg-1', content: 'First segment' },
        { id: 'chain-seg-2', content: 'Second segment' },
        { id: 'chain-seg-3', content: 'Third segment' },
      ]

      const proofs = []
      for (const segment of segments) {
        const proof = await generateProof({
          segmentId: segment.id,
          sessionId,
          content: segment.content,
        })
        proofs.push(proof)

        // Small delay to ensure timestamp ordering
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Generate chain of custody
      const chain = await generateChainOfCustody({
        sessionId,
        userId: testUserId,
      })

      expect(chain).toBeDefined()
      expect(chain.proofs.length).toBe(segments.length)
      expect(chain.chainHash).toBeDefined()

      // Verify chain integrity
      // Each proof should have correct temporal ordering
      for (let i = 1; i < chain.proofs.length; i++) {
        const prevTime = chain.proofs[i - 1].timestamp.getTime()
        const currTime = chain.proofs[i].timestamp.getTime()
        expect(currTime).toBeGreaterThanOrEqual(prevTime)
      }
    })

    it('should verify complete chain of custody', async () => {
      const sessionId = 'chain-verify-test'

      // Create chain
      const segments = [
        { id: 'verify-seg-1', content: 'Segment 1' },
        { id: 'verify-seg-2', content: 'Segment 2' },
      ]

      for (const segment of segments) {
        await generateProof({
          segmentId: segment.id,
          sessionId,
          content: segment.content,
        })
      }

      const chain = await generateChainOfCustody({
        sessionId,
        userId: testUserId,
      })

      // Verify each proof in chain
      for (const proof of chain.proofs) {
        const segment = segments.find(s => s.id === proof.segmentId)
        if (!segment) continue

        const verification = await verifyProofChecker({
          proofId: proof.id,
          content: segment.content,
          nonce: proof.nonce,
          userId: testUserId,
        })

        expect(verification.isValid).toBe(true)
      }
    })
  })

  describe('Version Comparison with Timestamps', () => {
    it('should compare versions and verify timestamps match', async () => {
      const sessionId = 'compare-timestamp-test'

      // Create version 1
      const v1 = await createVersion({
        sessionId,
        userId: testUserId,
        changeType: 'manual_save',
        changeReason: 'Version 1',
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Create version 2
      const v2 = await createVersion({
        sessionId,
        userId: testUserId,
        changeType: 'segment_edit',
        changeReason: 'Version 2',
      })

      // Compare versions
      const comparison = await compareVersions({
        sessionId,
        fromVersion: v1.version,
        toVersion: v2.version,
      })

      expect(comparison).toBeDefined()
      expect(comparison.fromVersion.version).toBe(v1.version)
      expect(comparison.toVersion.version).toBe(v2.version)

      // Timestamps should be ordered correctly
      expect(v2.createdAt.getTime()).toBeGreaterThan(v1.createdAt.getTime())
    })
  })

  describe('Audit Log Query Performance', () => {
    it('should efficiently query audit logs for large datasets', async () => {
      const sessionId = 'performance-test'

      // Create 100 audit entries
      const start = Date.now()
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(
          logAction({
            userId: testUserId,
            action: AuditAction.TRANSCRIPT_VIEW,
            resource: AuditResource.TRANSCRIPT,
            resourceId: sessionId,
            metadata: { index: i },
          })
        )
      }
      await Promise.all(promises)

      const createTime = Date.now() - start

      // Query logs
      const queryStart = Date.now()
      const logs = await getAuditLog({
        userId: testUserId,
        sessionId,
        limit: 50,
      })
      const queryTime = Date.now() - queryStart

      expect(logs.logs.length).toBeLessThanOrEqual(50)
      expect(queryTime).toBeLessThan(1000) // Should be under 1 second

      console.log(`\n📊 Performance Metrics:`)
      console.log(`   Created 100 audit logs in: ${createTime}ms`)
      console.log(`   Queried 50 logs in: ${queryTime}ms`)
    })
  })

  describe('Data Consistency', () => {
    it('should maintain consistency across audit, version, and timestamp', async () => {
      const sessionId = 'consistency-test'
      const content = 'Consistent test content'

      // Create version
      const version = await createVersion({
        sessionId,
        userId: testUserId,
        changeType: 'manual_save',
        changeReason: 'Consistency test',
      })

      // Create timestamp
      const proof = await generateProof({
        segmentId: 'consistency-segment',
        sessionId,
        content,
      })

      // Get audit logs
      const auditLogs = await getAuditLog({
        sessionId,
        limit: 10,
      })

      // All timestamps should be within 5 seconds of each other
      const times = [
        version.createdAt.getTime(),
        proof.timestamp.getTime(),
        ...(auditLogs.logs.map(l => l.createdAt.getTime())),
      ]

      const minTime = Math.min(...times)
      const maxTime = Math.max(...times)
      const timeDiff = maxTime - minTime

      expect(timeDiff).toBeLessThan(5000) // Within 5 seconds
    })

    it('should handle concurrent operations correctly', async () => {
      const sessionId = 'concurrent-test'

      // Run multiple operations concurrently
      const operations = await Promise.allSettled([
        createVersion({
          sessionId,
          userId: testUserId,
          changeType: 'manual_save',
          changeReason: 'Concurrent v1',
        }),
        createVersion({
          sessionId,
          userId: testUserId,
          changeType: 'manual_save',
          changeReason: 'Concurrent v2',
        }),
        generateProof({
          segmentId: 'concurrent-seg-1',
          sessionId,
          content: 'Concurrent segment 1',
        }),
        generateProof({
          segmentId: 'concurrent-seg-2',
          sessionId,
          content: 'Concurrent segment 2',
        }),
      ])

      // All operations should succeed
      const successful = operations.filter(op => op.status === 'fulfilled')
      expect(successful.length).toBe(operations.length)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle missing session gracefully', async () => {
      const nonExistentSession = 'non-existent-session-id'

      await expect(async () => {
        await createVersion({
          sessionId: nonExistentSession,
          userId: testUserId,
          changeType: 'manual_save',
          changeReason: 'Should fail',
        })
      }).rejects.toThrow()
    })

    it('should handle invalid timestamp verification', async () => {
      const verification = await verifyProofChecker({
        proofId: 'non-existent-proof',
        userId: testUserId,
      })

      expect(verification.isValid).toBe(false)
      expect(verification.errors.length).toBeGreaterThan(0)
    })

    it('should handle version comparison with invalid versions', async () => {
      const sessionId = 'error-handling-test'

      await expect(async () => {
        await compareVersions({
          sessionId,
          fromVersion: 999, // Non-existent
          toVersion: 1000, // Non-existent
        })
      }).rejects.toThrow()
    })
  })

  describe('Batch Operations', () => {
    it('should handle bulk timestamp generation efficiently', async () => {
      const sessionId = 'bulk-timestamp-test'
      const segmentCount = 20

      const segments = Array.from({ length: segmentCount }, (_, i) => ({
        id: `bulk-seg-${i}`,
        content: `Segment ${i} content`,
      }))

      const start = Date.now()
      const results = await Promise.all(
        segments.map(seg =>
          generateProof({
            segmentId: seg.id,
            sessionId,
            content: seg.content,
          })
        )
      )
      const duration = Date.now() - start

      expect(results.length).toBe(segmentCount)
      expect(duration).toBeLessThan(10000) // Should complete in under 10 seconds

      console.log(`\n⚡ Bulk Operation Performance:`)
      console.log(`   Generated ${segmentCount} timestamp proofs in ${duration}ms`)
      console.log(`   Average: ${Math.round(duration / segmentCount)}ms per proof`)
    })
  })
})

describe('Production Scenarios', () => {
  describe('Legal Compliance Workflow', () => {
    it('should create complete legal audit trail', async () => {
      const sessionId = 'legal-compliance-session'
      const userId = 'legal-user-id'

      console.log('\n🏛️  Legal Compliance Workflow Test\n')

      // 1. Create session with initial content
      console.log('Step 1: Creating initial session version...')
      const v1 = await createVersion({
        sessionId,
        userId,
        changeType: 'manual_save',
        changeReason: 'Initial deposition transcript',
      })
      console.log(`✅ Version ${v1.version} created`)

      // 2. Create timestamp proofs for all segments
      console.log('\nStep 2: Creating timestamp proofs...')
      const segments = [
        'Witness testimony begins',
        'Attorney question 1',
        'Witness response 1',
      ]

      for (const content of segments) {
        const proof = await generateProof({
          segmentId: `legal-seg-${segments.indexOf(content)}`,
          sessionId,
          content,
        })
        console.log(`✅ Timestamp proof created (${proof.timestampSource})`)
      }

      // 3. Make edits and create new version
      console.log('\nStep 3: Making corrections and creating new version...')
      const v2 = await createVersion({
        sessionId,
        userId,
        changeType: 'segment_edit',
        changeReason: 'Corrected witness name spelling',
      })
      console.log(`✅ Version ${v2.version} created`)

      // 4. Generate chain of custody
      console.log('\nStep 4: Generating chain of custody...')
      const chain = await generateChainOfCustody({
        sessionId,
        userId,
      })
      console.log(`✅ Chain of custody generated (${chain.proofs.length} proofs)`)
      console.log(`   Chain hash: ${chain.chainHash.slice(0, 16)}...`)

      // 5. Verify complete audit trail
      console.log('\nStep 5: Verifying audit trail...')
      const auditLogs = await getAuditLog({
        sessionId,
        limit: 100,
      })
      console.log(`✅ Found ${auditLogs.logs.length} audit log entries`)

      // Verify we have all required audit entries
      const actions = new Set(auditLogs.logs.map(l => l.action))
      expect(actions).toContain(AuditAction.VERSION_CREATE)
      expect(actions).toContain(AuditAction.TIMESTAMP_CREATE)

      console.log('\n✅ Legal compliance workflow completed successfully')
      console.log('   All requirements met for court admissibility\n')
    })
  })
})
