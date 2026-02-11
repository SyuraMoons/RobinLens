import type { Trade } from './goldsky'

export interface TechnicalMetrics {
  priceChange1h: number
  priceChange24h: number
  tradeVelocity: number
  trendDirection: 'up' | 'down' | 'flat'
}

export function calculateTechnicalMetrics(
  trades: Trade[],
  ageHours: number,
): TechnicalMetrics {
  const now = Math.floor(Date.now() / 1000)

  // Price change calculations
  const currentPrice = trades.length > 0 ? parseFloat(trades[0].priceEth) : 0

  const oneHourAgo = now - 3600
  const oneDayAgo = now - 86400

  const priceAt1h = findPriceAt(trades, oneHourAgo) ?? currentPrice
  const priceAt24h = findPriceAt(trades, oneDayAgo) ?? currentPrice

  const priceChange1h = priceAt1h > 0 ? (currentPrice - priceAt1h) / priceAt1h : 0
  const priceChange24h = priceAt24h > 0 ? (currentPrice - priceAt24h) / priceAt24h : 0

  // Trade velocity: trades in last hour vs average hourly rate
  const lastHourTrades = trades.filter((t) => parseInt(t.timestamp) > oneHourAgo).length
  const avgHourlyTrades = ageHours > 0 ? trades.length / ageHours : 0
  const tradeVelocity = avgHourlyTrades > 0 ? lastHourTrades / avgHourlyTrades : 0

  // Trend direction from last 10 trades
  const recentTrades = trades.slice(0, 10)
  const trendDirection = detectTrend(recentTrades)

  return { priceChange1h, priceChange24h, tradeVelocity, trendDirection }
}

function findPriceAt(trades: Trade[], targetTimestamp: number): number | null {
  // Find the trade closest to (but after) the target timestamp
  for (let i = 0; i < trades.length; i++) {
    if (parseInt(trades[i].timestamp) <= targetTimestamp) {
      return parseFloat(trades[i].priceEth)
    }
  }
  // If all trades are after the target, return the oldest trade price
  return trades.length > 0 ? parseFloat(trades[trades.length - 1].priceEth) : null
}

function detectTrend(trades: Trade[]): 'up' | 'down' | 'flat' {
  if (trades.length < 3) return 'flat'

  const prices = trades.map((t) => parseFloat(t.priceEth))
  const newest = prices[0]
  const oldest = prices[prices.length - 1]

  if (oldest === 0) return 'flat'

  const change = (newest - oldest) / oldest
  if (change > 0.05) return 'up'
  if (change < -0.05) return 'down'
  return 'flat'
}
