import { types as T, YAML } from "../deps.ts";

export const migration_down_3_3_0_4: T.ExpectedExports.migration = async (
  effects,
  _version,
) => {
  try {
    await effects.createDir({
      volumeId: "main",
      path: "start9",
    });
    const config = await effects.readFile({
      volumeId: "main",
      path: "start9/config.yaml",
    });
    const parsed = YAML.parse(config) as Record<string, unknown>;

    if ("electrum-server" in parsed) {
      const electrumServer = parsed["electrum-server"] as { type?: string };
      delete parsed["electrum-server"];
      parsed["enable-electrs"] = electrumServer?.type === "electrs";
      await effects.writeFile({
        volumeId: "main",
        path: "start9/config.yaml",
        toWrite: YAML.stringify(parsed),
      });
    }
    return { result: { configured: true } };
  } catch {
    return { result: { configured: true } };
  }
};
