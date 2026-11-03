import { T } from '@start9labs/start-sdk'
import type { Action } from '@start9labs/start-sdk/base/lib/actions/setupActions'
import { autoconfig as _autoconfig } from 'bitcoin-core-startos/startos/actions/config/autoconfig'
import { configJson } from './file-models/mempool-config.json'
import { storeJson } from './file-models/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import { settled } from './utils'

const autoconfig = _autoconfig as unknown as Action<
  'autoconfig',
  (typeof _autoconfig)['_INPUT']
>

export const setDependencies = sdk.setupDependencies(async ({ effects }) => {
  await sdk.action.createTask(effects, 'bitcoind', autoconfig, 'critical', {
    input: {
      kind: 'partial',
      value: {
        prune: 0,
        txindex: true,
      },
    },
    when: { condition: 'input-not-matches', once: false },
    reason: i18n('Mempool requires an archival node and transaction indexing'),
  })

  let currentDeps = {} as Record<
    | 'bitcoind'
    | 'lnd'
    | 'lightning-fork'
    | 'c-lightning'
    | 'fulcrum'
    | 'electrs',
    T.DependencyRequirement
  >

  const lnData = await settled(() =>
    configJson.read((c) => c.LIGHTNING).const(effects),
  )
  const electrumHost = await settled(() =>
    configJson.read((c) => c.ELECTRUM.HOST).const(effects),
  )
  const lndPackage =
    (await settled(() =>
      storeJson.read((s) => s.lightningPackage).const(effects),
    )) ?? 'lnd'

  if (lnData && lnData.ENABLED) {
    if (lnData.BACKEND === 'lnd' && lndPackage === 'lightning-fork') {
      currentDeps['lightning-fork'] = {
        id: 'lightning-fork',
        kind: 'running',
        versionRange: '>=0.21.3-beta.16:0',
        healthChecks: ['lnd', 'sync-progress'],
      }
    } else if (lnData.BACKEND === 'lnd') {
      currentDeps.lnd = {
        id: 'lnd',
        kind: 'running',
        versionRange: '>=0.20.1-beta:2',
        healthChecks: ['lnd', 'sync-progress'],
      }
    }

    if (lnData.BACKEND === 'cln') {
      currentDeps['c-lightning'] = {
        id: 'c-lightning',
        kind: 'running',
        versionRange: '>=25.12.1:8',
        healthChecks: ['lightningd', 'check-synced'],
      }
    }
  }

  if (electrumHost === 'fulcrum.startos') {
    currentDeps.fulcrum = {
      id: 'fulcrum',
      kind: 'running',
      versionRange: '>=#blake:2.1.2:0',
      healthChecks: ['primary', 'sync-progress'],
    }
  } else if (electrumHost === 'electrs.startos') {
    currentDeps.electrs = {
      id: 'electrs',
      kind: 'running',
      versionRange: '>=0.11.1:3',
      healthChecks: ['electrs', 'sync'],
    }
  }

  return {
    ...currentDeps,
    bitcoind: {
      kind: 'running',
      versionRange: '>=#knots:29.4.1:7',
      healthChecks: ['bitcoind', 'sync-progress'],
    },
  }
})
