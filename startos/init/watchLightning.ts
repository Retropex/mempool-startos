import { configJson } from '../file-models/mempool-config.json'
import { storeJson } from '../file-models/store.json'
import { sdk } from '../sdk'
import { lndRestUrl, settled } from '../utils'

/**
 * Points `LND.REST_API_URL` at the selected LND package (LND or Lightning
 * Fork) by its container IP. Re-runs when Lightning is switched or the
 * package's IP changes; main reads the config as a const, so the backend then
 * restarts with the new URL. Nothing is written while the package has no
 * container: the dependency is unmet then and the backend is not started.
 */
export const watchLightning = sdk.setupOnInit(async (effects) => {
  const lightning = await settled(() =>
    configJson.read((c) => c.LIGHTNING).const(effects),
  )
  if (!lightning?.ENABLED || lightning.BACKEND !== 'lnd') return

  const lndPackage =
    (await settled(() =>
      storeJson.read((s) => s.lightningPackage).const(effects),
    )) ?? 'lnd'
  const url = await lndRestUrl(effects, lndPackage)
  if (!url) return

  await configJson.merge(effects, { LND: { REST_API_URL: url } })
})
