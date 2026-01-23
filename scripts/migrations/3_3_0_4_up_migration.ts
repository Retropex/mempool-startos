import { types as T, YAML } from "../deps.ts";

export const migration_up_3_3_0_4: T.ExpectedExports.migration = async (
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

    if ("enable-electrs" in parsed) {
      const enableElectrs = parsed["enable-electrs"];
      delete parsed["enable-electrs"];
      parsed["electrum-server"] = {
        type: enableElectrs ? "electrs" : "none",
      };
      await effects.writeFile({
        volumeId: "main",
        path: "start9/config.yaml",
        toWrite: YAML.stringify(parsed),
      });
    }
    return { result: { configured: true } };
  } catch {
    return { result: { configured: false } };
  }
};
