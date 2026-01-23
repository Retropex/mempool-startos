import { compat, types as T } from "../deps.ts";

interface CustomConfig extends T.Config {
  lightning?: {
    type?: string;
  };
  "electrum-server"?: {
    type?: string;
  };
}
// deno-lint-ignore require-await
export const setConfig: T.ExpectedExports.setConfig = async (
  effects: T.Effects,
  newConfig: CustomConfig
) => {
  const electrumType = newConfig?.["electrum-server"]?.type;
  const depsElectrs: { [key: string]: string[] } = electrumType === "electrs" ? { electrs: ["synced"] } : {};
  const depsFulcrum: { [key: string]: string[] } = electrumType === "fulcrum" ? { fulcrum: ["synced"] } : {};

  // add two const depsLnd and depsCln for the new lightning type string in getConfig
  const depsLnd: { [key: string]: string[] } = newConfig?.lightning?.type === "lnd"  ? {lnd: []} : {};
  const depsCln: { [key: string]: string[] } = newConfig?.lightning?.type === "cln"  ? {"c-lightning": []} : {};
    
  return compat.setConfig(effects, newConfig, {
    ...depsElectrs,
    ...depsFulcrum,
    ...depsLnd,
    ...depsCln,
  });
};
