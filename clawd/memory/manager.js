import fs from 'fs'
import path from 'path'
import os from 'os'

const WORKSPACE = process.env.CLAWD_WORKSPACE || path.join(os.homedir(), 'clawd')
const MEMORY_DIR = path.join(WORKSPACE, 'memory')

/**
 * Memory Manager for Clawd
 * Handles daily logs and curated long-term memory
 */
export default class MemoryManager {
  constructor() {
    this.workspace = WORKSPACE
    this.memoryDir = MEMORY_DIR
    this.ensureDirectories()
  }

  ensureDirectories() {
    if (!fs.existsSync(this.workspace)) {
      fs.mkdirSync(this.workspace, { recursive: true })
    }
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true })
    }
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  getToday() {
    return new Date().toISOString().split('T')[0]
  }

  /**
   * Get yesterday's date in YYYY-MM-DD format
   */
  getYesterday() {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }

  /**
   * Get path to daily memory file
   */
  getDailyPath(date) {
    return path.join(this.memoryDir, `${date}.md`)
  }

  /**
   * Get path to curated memory file
   */
  getMemoryPath() {
    return path.join(this.workspace, 'MEMORY.md')
  }

  /**
   * Read a file safely
   */
  readFile(filepath) {
    try {
      if (fs.existsSync(filepath)) {
        return fs.readFileSync(filepath, 'utf-8')
      }
    } catch (err) {
      console.error(`[Memory] Failed to read ${filepath}:`, err.message)
    }
    return null
  }

  /**
   * Write to a file
   */
  writeFile(filepath, content) {
    try {
      fs.writeFileSync(filepath, content, 'utf-8')
      return true
    } catch (err) {
      console.error(`[Memory] Failed to write ${filepath}:`, err.message)
      return false
    }
  }

  /**
   * Append to a file
   */
  appendFile(filepath, content) {
    try {
      fs.appendFileSync(filepath, content, 'utf-8')
      return true
    } catch (err) {
      console.error(`[Memory] Failed to append to ${filepath}:`, err.message)
      return false
    }
  }

  /**
   * Read today's daily memory
   */
  readTodayMemory() {
    return this.readFile(this.getDailyPath(this.getToday()))
  }

  /**
   * Read yesterday's daily memory
   */
  readYesterdayMemory() {
    return this.readFile(this.getDailyPath(this.getYesterday()))
  }

  /**
   * Read curated long-term memory
   */
  readLongTermMemory() {
    return this.readFile(this.getMemoryPath())
  }

  /**
   * Append to today's daily memory
   */
  appendToDailyMemory(content) {
    const filepath = this.getDailyPath(this.getToday())
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false })
    const entry = `\n## ${timestamp}\n${content}\n`
    return this.appendFile(filepath, entry)
  }

  /**
   * Append to curated long-term memory
   */
  appendToLongTermMemory(content) {
    const filepath = this.getMemoryPath()
    const timestamp = new Date().toISOString().split('T')[0]
    const entry = `\n## ${timestamp}\n${content}\n`
    return this.appendFile(filepath, entry)
  }

  /**
   * Get all memory context for session start
   */
  getMemoryContext() {
    const parts = []

    const longTerm = this.readLongTermMemory()
    if (longTerm) {
      parts.push(`## Long-Term Memory (MEMORY.md)\n${longTerm}`)
    }

    const yesterday = this.readYesterdayMemory()
    if (yesterday) {
      parts.push(`## Yesterday's Notes (${this.getYesterday()})\n${yesterday}`)
    }

    const today = this.readTodayMemory()
    if (today) {
      parts.push(`## Today's Notes (${this.getToday()})\n${today}`)
    }

    return parts.join('\n\n---\n\n')
  }

  /**
   * List all daily memory files
   */
  listDailyFiles() {
    try {
      return fs.readdirSync(this.memoryDir)
        .filter(f => f.endsWith('.md'))
        .sort()
        .reverse()
    } catch (err) {
      return []
    }
  }

  /**
   * Search memory files for a query (simple text search)
   */
  searchMemory(query) {
    const results = []
    const queryLower = query.toLowerCase()

    // Search long-term memory
    const longTerm = this.readLongTermMemory()
    if (longTerm && longTerm.toLowerCase().includes(queryLower)) {
      results.push({
        file: 'MEMORY.md',
        matches: this.extractMatches(longTerm, query)
      })
    }

    // Search daily files
    for (const file of this.listDailyFiles().slice(0, 30)) { // Last 30 days
      const content = this.readFile(path.join(this.memoryDir, file))
      if (content && content.toLowerCase().includes(queryLower)) {
        results.push({
          file: `memory/${file}`,
          matches: this.extractMatches(content, query)
        })
      }
    }

    return results
  }

  /**
   * Extract matching lines from content
   */
  extractMatches(content, query) {
    const lines = content.split('\n')
    const queryLower = query.toLowerCase()
    const matches = []

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(queryLower)) {
        // Include context (line before and after)
        const start = Math.max(0, i - 1)
        const end = Math.min(lines.length, i + 2)
        matches.push({
          line: i + 1,
          context: lines.slice(start, end).join('\n')
        })
      }
    }

    return matches.slice(0, 5) // Limit to 5 matches per file
  }
}
