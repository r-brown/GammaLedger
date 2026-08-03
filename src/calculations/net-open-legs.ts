// src/calculations/net-open-legs.ts — collapse a trade's fills into net open
// positions per contract (type|strike|expiration). Dependency-free on purpose:
// structural inputs keep this directly unit-testable with tsx.

export interface NetLegInput {
  type: string
  strike: number | null
  expirationDate: string
  quantity: number
  multiplier: number
  /** 'BUY' | 'SELL' — from getLegOrderDescriptor().action */
  action: string
  /** 'OPEN' | 'CLOSE' — from getLegOrderDescriptor().side */
  side: string
  /** Per-share premium. For STOCK legs with premium 0, pass the strike-stored price. */
  premium: number
}

export interface NetOpenLeg {
  type: 'CALL' | 'PUT' | 'STOCK'
  strike: number | null
  expirationDate: string
  /** Signed contracts/shares: positive long, negative short. */
  netQuantity: number
  multiplier: number
  /** Quantity-weighted average premium of the OPEN fills (per share). */
  avgOpenPremium: number
}

interface Bucket {
  type: 'CALL' | 'PUT' | 'STOCK'
  strike: number | null
  expirationDate: string
  multiplier: number
  net: number
  openQty: number
  openPremiumWeighted: number
}

export function computeNetOpenLegs(legs: NetLegInput[]): NetOpenLeg[] {
    const buckets = new Map<string, Bucket>()

    for (const leg of legs) {
        const type = (leg.type || '').toUpperCase()
        if (type !== 'CALL' && type !== 'PUT' && type !== 'STOCK') continue
        const quantity = Math.abs(Number(leg.quantity) || 0)
        if (!quantity) continue
        const side = (leg.side || '').toUpperCase()
        if (side !== 'OPEN' && side !== 'CLOSE') continue
        const action = (leg.action || '').toUpperCase() === 'SELL' ? 'SELL' : 'BUY'

        const key = `${type}|${leg.strike ?? ''}|${leg.expirationDate ?? ''}`
        let bucket = buckets.get(key)
        if (!bucket) {
            bucket = {
                type, strike: leg.strike ?? null, expirationDate: leg.expirationDate ?? '',
                multiplier: Number(leg.multiplier) || (type === 'STOCK' ? 1 : 100),
                net: 0, openQty: 0, openPremiumWeighted: 0
            }
            buckets.set(key, bucket)
        }

        // BUY adds long exposure; SELL adds short exposure — regardless of
        // open/close labelling the net position is the signed sum.
        const signed = action === 'BUY' ? quantity : -quantity
        bucket.net += signed

        if (side === 'OPEN') {
            const premium = Number(leg.premium) || 0
            bucket.openQty += quantity
            bucket.openPremiumWeighted += premium * quantity
        }
    }

    const result: NetOpenLeg[] = []
    for (const bucket of buckets.values()) {
        if (!bucket.net) continue
        result.push({
            type: bucket.type,
            strike: bucket.strike,
            expirationDate: bucket.expirationDate,
            netQuantity: bucket.net,
            multiplier: bucket.multiplier,
            avgOpenPremium: bucket.openQty > 0 ? bucket.openPremiumWeighted / bucket.openQty : 0
        })
    }
    return result
}

/** Filter helper: drop option legs whose expiration is strictly before `todayISO` (YYYY-MM-DD). */
export function filterUnexpired(legs: NetOpenLeg[], todayISO: string): NetOpenLeg[] {
    return legs.filter(leg => leg.type === 'STOCK' || !leg.expirationDate || leg.expirationDate >= todayISO)
}
