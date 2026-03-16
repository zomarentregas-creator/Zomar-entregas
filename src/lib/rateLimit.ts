class RateLimiter {
  private requests: Map<string, { count: number; timestamp: number }> = new Map()
  
  constructor(private limit: number = 3, private windowMs: number = 60000) {}

  canProceed(key: string): boolean {
    const now = Date.now()
    const record = this.requests.get(key)
    
    if (!record) {
      this.requests.set(key, { count: 1, timestamp: now })
      return true
    }
    
    if (now - record.timestamp > this.windowMs) {
      this.requests.set(key, { count: 1, timestamp: now })
      return true
    }
    
    if (record.count < this.limit) {
      record.count++
      return true
    }
    
    return false
  }
  
  getTimeUntilReset(key: string): number {
    const record = this.requests.get(key)
    if (!record) return 0
    
    const elapsed = Date.now() - record.timestamp
    return Math.max(0, this.windowMs - elapsed)
  }
}

export const authLimiter = new RateLimiter(3, 60000) // 3 tentativas por minuto