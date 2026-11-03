import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

const shape = z.object({
  // Which package serves Mempool's `lnd` backend. Lightning Fork is an LND
  // build with the LND package's layout (REST port, volume, TLS certificate
  // and read-only macaroon), so mempool-config.json says `lnd` for both and
  // this records which package to depend on, mount and reach. Absent on
  // installs that predate it, which reads as the LND package.
  lightningPackage: z.enum(['lnd', 'lightning-fork']).catch('lnd'),
})

export const storeJson = FileHelper.json(
  {
    base: sdk.volumes.main,
    subpath: '/store.json',
  },
  shape,
)
