import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TRANSCRIPTS_DIR = path.join(__dirname, '..', 'transcripts')

/**
 * Session manager with JSONL transcript storage
 */
export default class SessionManager {
  constructor() {
    this.sessions = new Map()
    this.ensureTranscriptsDir()
  }

  ensureTranscriptsDir() {
    if (!fs.existsSync(TRANSCRIPTS_DIR)) {
      fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true })
    }
  }

  /**
   * Get or create a session by key
   * @param {string} key - Session key
   * @returns {Object} Session state
   */
  getSession(key) {
    if (!this.sessions.has(key)) {
      this.sessions.set(key, {
        key,
        lastRunId: null,
        lastActivity: Date.now(),
        transcript: []
      })
    }
    const session = this.sessions.get(key)
    session.lastActivity = Date.now()
    return session
  }

  /**
   * Generate filename for a session's transcript
   * @param {string} key - Session key
   * @returns {string} Filename
   */
  getTranscriptFilename(key) {
    // Sanitize key for filesystem
    const sanitized = key.replace(/[^a-zA-Z0-9_-]/g, '_')
    return path.join(TRANSCRIPTS_DIR, `${sanitized}.jsonl`)
  }

  /**
   * Append an entry to the session transcript
   * @param {string} key - Session key
   * @param {Object} entry - Entry to append (role, content, timestamp)
   */
  appendTranscript(key, entry) {
    const session = this.getSession(key)
    const timestampedEntry = {
      ...entry,
      timestamp: entry.timestamp || Date.now()
    }

    // Add to in-memory transcript
    session.transcript.push(timestampedEntry)

    // Append to JSONL file
    const filename = this.getTranscriptFilename(key)
    const line = JSON.stringify(timestampedEntry) + '\n'
    fs.appendFileSync(filename, line, 'utf-8')
  }

  /**
   * Get recent transcript entries for context
   * @param {string} key - Session key
   * @param {number} limit - Max entries to return (default 50)
   * @returns {Array} Recent transcript entries
   */
  getTranscript(key, limit = 50) {
    const session = this.getSession(key)

    // If in-memory transcript is empty, try loading from file
    if (session.transcript.length === 0) {
      const filename = this.getTranscriptFilename(key)
      if (fs.existsSync(filename)) {
        try {
          const content = fs.readFileSync(filename, 'utf-8')
          const lines = content.trim().split('\n').filter(Boolean)
          session.transcript = lines.map(line => JSON.parse(line))
        } catch (err) {
          console.error(`Error loading transcript for ${key}:`, err)
        }
      }
    }

    // Return last N entries
    return session.transcript.slice(-limit)
  }

  /**
   * Set the last run ID for a session
   * @param {string} key - Session key
   * @param {string} runId - Run ID
   */
  setLastRunId(key, runId) {
    const session = this.getSession(key)
    session.lastRunId = runId
  }

  /**
   * Get the last run ID for a session
   * @param {string} key - Session key
   * @returns {string|null} Last run ID
   */
  getLastRunId(key) {
    const session = this.getSession(key)
    return session.lastRunId
  }
}
