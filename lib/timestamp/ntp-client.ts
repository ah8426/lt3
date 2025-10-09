/**
 * NTP Client for fetching trusted timestamps
 * Uses multiple NTP servers with fallback for reliability
 */

import dgram from 'dgram'

// NTP server pool (NIST and pool.ntp.org)
const NTP_SERVERS = [
  'time.nist.gov',
  'time-a-g.nist.gov',
  'time-b-g.nist.gov',
  'pool.ntp.org',
  '0.pool.ntp.org',
  '1.pool.ntp.org',
]

const NTP_PORT = 123
const NTP_PACKET_SIZE = 48
const NTP_EPOCH_OFFSET = 2208988800 // Seconds from 1900 to 1970

export interface NTPResponse {
  timestamp: Date
  serverTime: number
  localTime: number
  offset: number
  roundTripDelay: number
  server: string
}

/**
 * Create NTP request packet
 */
function createNTPPacket(): Buffer {
  const packet = Buffer.alloc(NTP_PACKET_SIZE)

  // Set LI (Leap Indicator), Version, and Mode
  // LI = 0 (no warning), VN = 3 (NTP version), Mode = 3 (client)
  packet[0] = 0x1b

  return packet
}

/**
 * Parse NTP response packet
 */
function parseNTPResponse(packet: Buffer, requestTime: number, responseTime: number): {
  serverTime: number
  offset: number
  roundTripDelay: number
} {
  // Extract transmit timestamp (bytes 40-43 for seconds, 44-47 for fractions)
  const secondsBuffer = packet.readUInt32BE(40)
  const fractionBuffer = packet.readUInt32BE(44)

  // Convert NTP timestamp to Unix timestamp
  const ntpSeconds = secondsBuffer - NTP_EPOCH_OFFSET
  const ntpFraction = (fractionBuffer * 1000) / 0x100000000
  const serverTime = ntpSeconds * 1000 + ntpFraction

  // Calculate offset and round trip delay
  const t1 = requestTime
  const t2 = serverTime
  const t3 = serverTime // Assume server processes instantly
  const t4 = responseTime

  const offset = ((t2 - t1) + (t3 - t4)) / 2
  const roundTripDelay = (t4 - t1) - (t3 - t2)

  return { serverTime, offset, roundTripDelay }
}

/**
 * Fetch time from a single NTP server
 */
async function fetchFromServer(server: string): Promise<NTPResponse> {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket('udp4')

    const timeout = setTimeout(() => {
      client.close()
      reject(new Error(`NTP request timeout for ${server}`))
    }, 5000) // 5 second timeout

    const packet = createNTPPacket()
    const requestTime = Date.now()

    client.send(packet, 0, packet.length, NTP_PORT, server, (err: any) => {
      if (err) {
        clearTimeout(timeout)
        client.close()
        reject(err)
      }
    })

    client.on('message', (msg: Buffer) => {
      const responseTime = Date.now()
      clearTimeout(timeout)
      client.close()

      try {
        const { serverTime, offset, roundTripDelay } = parseNTPResponse(
          msg,
          requestTime,
          responseTime
        )

        resolve({
          timestamp: new Date(serverTime),
          serverTime,
          localTime: responseTime,
          offset,
          roundTripDelay,
          server,
        })
      } catch (error) {
        reject(error)
      }
    })

    client.on('error', (err: any) => {
      clearTimeout(timeout)
      client.close()
      reject(err)
    })
  })
}

/**
 * Get NTP time with fallback to multiple servers
 */
export async function getNTPTime(): Promise<NTPResponse> {
  const errors: Error[] = []

  // Try each server in sequence until one succeeds
  for (const server of NTP_SERVERS) {
    try {
      const response = await fetchFromServer(server)

      // Validate response
      if (Math.abs(response.offset) > 10000) {
        throw new Error(`Time offset too large: ${response.offset}ms`)
      }

      if (response.roundTripDelay > 1000) {
        throw new Error(`Round trip delay too large: ${response.roundTripDelay}ms`)
      }

      return response
    } catch (error) {
      errors.push(error as Error)
      continue
    }
  }

  // All servers failed
  throw new Error(
    `Failed to get NTP time from all servers. Errors: ${errors
      .map((e) => e.message)
      .join(', ')}`
  )
}

/**
 * Get NTP time with local fallback (for development/testing)
 */
export async function getTrustedTime(): Promise<{
  timestamp: Date
  source: 'ntp' | 'local'
  serverInfo?: NTPResponse
}> {
  try {
    const ntpResponse = await getNTPTime()
    return {
      timestamp: ntpResponse.timestamp,
      source: 'ntp',
      serverInfo: ntpResponse,
    }
  } catch (error) {
    console.error('NTP time fetch failed, using local time:', error)

    // Fallback to local time with warning
    return {
      timestamp: new Date(),
      source: 'local',
    }
  }
}

/**
 * Verify time is within acceptable bounds
 */
export function verifyTimeInBounds(
  timestamp: Date,
  minDate?: Date,
  maxDate?: Date
): boolean {
  const time = timestamp.getTime()

  if (minDate && time < minDate.getTime()) {
    return false
  }

  if (maxDate && time > maxDate.getTime()) {
    return false
  }

  // Sanity check: not in the future by more than 1 hour
  const oneHourFromNow = Date.now() + 60 * 60 * 1000
  if (time > oneHourFromNow) {
    return false
  }

  // Sanity check: not before 2020
  const year2020 = new Date('2020-01-01').getTime()
  if (time < year2020) {
    return false
  }

  return true
}

/**
 * Get multiple NTP samples for increased accuracy
 */
export async function getNTPTimeSamples(count: number = 3): Promise<{
  timestamp: Date
  accuracy: number
  samples: NTPResponse[]
}> {
  const samples: NTPResponse[] = []

  for (let i = 0; i < count; i++) {
    try {
      const sample = await getNTPTime()
      samples.push(sample)
    } catch (error) {
      console.error(`NTP sample ${i + 1} failed:`, error)
    }
  }

  if (samples.length === 0) {
    throw new Error('Failed to get any NTP samples')
  }

  // Calculate average timestamp
  const avgTime = samples.reduce((sum, s) => sum + s.serverTime, 0) / samples.length

  // Calculate standard deviation for accuracy metric
  const variance =
    samples.reduce((sum, s) => sum + Math.pow(s.serverTime - avgTime, 2), 0) /
    samples.length
  const stdDev = Math.sqrt(variance)

  return {
    timestamp: new Date(avgTime),
    accuracy: stdDev,
    samples,
  }
}
