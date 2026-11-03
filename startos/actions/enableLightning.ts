import { configJson } from '../file-models/mempool-config.json'
import { storeJson } from '../file-models/store.json'
import { sdk } from '../sdk'
import { clnMountpoint, lndCertPath, lndMacaroonPath } from '../utils'
import { i18n } from '../i18n'
const { InputSpec, Value } = sdk

export const lightningInputSpec = InputSpec.of({
  lightning: Value.select({
    name: i18n('Lightning Node'),
    description: i18n('Select the internal node implementation'),
    default: 'none',
    values: {
      lnd: i18n('LND'),
      'lightning-fork': i18n('Lightning Fork'),
      cln: i18n('Core Lightning'),
      none: i18n('None'),
    },
  }),
})

export const matchLightningInputSpec = lightningInputSpec.validator
export type LightningInputSpec = typeof lightningInputSpec._TYPE

export const enableLightning = sdk.Action.withInput(
  'enable-lightning',

  {
    name: i18n('Enable Lightning'),
    description: i18n(
      'Use this setting to select the Lightning node used to serve network data to the Lightning tab in Mempool',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  },

  // form input specification
  lightningInputSpec,

  // optionally pre-fill the input form
  async ({ effects }) => {
    const config = await configJson.read().const(effects)
    if (!config) throw new Error('Config file not found')
    const lndPackage = await storeJson
      .read((s) => s.lightningPackage)
      .const(effects)

    const lightning: LightningInputSpec['lightning'] = !config.LIGHTNING.ENABLED
      ? 'none'
      : config.LIGHTNING.BACKEND === 'lnd' && lndPackage === 'lightning-fork'
        ? 'lightning-fork'
        : config.LIGHTNING.BACKEND
    return { lightning }
  },

  // the execution function
  async ({ effects, input }) => {
    switch (input.lightning) {
      case 'lnd':
      case 'lightning-fork':
        // Both are `lnd` to Mempool; which package it is decides the
        // dependency, the mount and the REST URL (init/watchLightning).
        await storeJson.merge(effects, { lightningPackage: input.lightning })
        await configJson.merge(effects, {
          LIGHTNING: { ENABLED: true, BACKEND: 'lnd' },
          LND: {
            TLS_CERT_PATH: lndCertPath,
            MACAROON_PATH: lndMacaroonPath,
          },
        })
        break
      case 'cln':
        await configJson.merge(effects, {
          LIGHTNING: { ENABLED: true, BACKEND: 'cln' },
          CLIGHTNING: { SOCKET: `${clnMountpoint}/lightning-rpc` },
        })
        break
      default:
        await configJson.merge(effects, {
          LIGHTNING: { ENABLED: false },
        })
        break
    }
  },
)
