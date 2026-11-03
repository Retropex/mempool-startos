import { T, utils } from '@start9labs/start-sdk'
import { restPort } from 'lnd-startos/startos/interfaces'
import { sdk } from './sdk'

export const randomPassword = {
  charset: 'a-z,A-Z,1-9',
  len: 22,
}

export function getDbPassword(): string {
  return utils.getDefaultString(randomPassword)
}

export const uiPort = 8080
export const apiPort = 8999
export const dbPort = 3306
export const btcMountpoint = '/mnt/bitcoind'
export const lndMountpoint = '/mnt/lnd'
export const clnMountpoint = '/mnt/cln'

export const lndCertPath = `${lndMountpoint}/tls.cert`
export const lndMacaroonPath = `${lndMountpoint}/data/chain/bitcoin/mainnet/readonly.macaroon`

/** The packages that can serve Mempool's `lnd` backend. */
export type LndPackage = 'lnd' | 'lightning-fork'

/**
 * The REST URL of the selected LND package, by its container IP.
 *
 * Not `<package>.startos`: that name resolves, but the package's TLS
 * certificate does not include it, so Mempool's REST client rejects the
 * connection (ERR_TLS_CERT_ALTNAME_INVALID). The certificate does include
 * the container IP. Read as a const, so a new IP rewrites the URL. `null`
 * while the package has no container.
 */
export async function lndRestUrl(
  effects: T.Effects,
  packageId: LndPackage,
): Promise<string | null> {
  const ip = await sdk
    .getContainerIp(effects, { packageId })
    .const()
    .catch(() => null)
  return ip ? `https://${ip}:${restPort}` : null
}

/**
 * A `.const` read of a file an action may be writing at that moment.
 *
 * FileHelper writes in place and its watcher wakes on the truncate, so a
 * re-run can read the file empty or half written. The read then throws, and
 * a `.const` that throws never registers its watch, so nothing re-runs until
 * the container restarts. Enable Lightning writes store.json and then
 * mempool-config.json, and the re-run the first write starts can read the
 * second mid-write. A parse failure is read again shortly; anything else is
 * thrown as before.
 */
export async function settled<A>(read: () => Promise<A>): Promise<A> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await read()
    } catch (e) {
      if ((e as Error)?.name !== 'SyntaxError' || attempt >= 20) throw e
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
}

// Performance profile presets. POLL_RATE_MS is the main-loop period;
// MEMPOOL_BLOCKS_AMOUNT is the depth of the Rust GBT projection. Both
// scale backend CPU roughly linearly. Single source of truth — referenced
// by the file model defaults, the migration, and the action.
export type PerformanceProfile = 'low-cpu' | 'balanced' | 'responsive'

export const PROFILES: Record<
  PerformanceProfile,
  { POLL_RATE_MS: number; MEMPOOL_BLOCKS_AMOUNT: number }
> = {
  'low-cpu': { POLL_RATE_MS: 8000, MEMPOOL_BLOCKS_AMOUNT: 4 },
  balanced: { POLL_RATE_MS: 4000, MEMPOOL_BLOCKS_AMOUNT: 6 },
  responsive: { POLL_RATE_MS: 2000, MEMPOOL_BLOCKS_AMOUNT: 8 },
}

export const DEFAULT_PROFILE: PerformanceProfile = 'low-cpu'
