import { fileURLToPath } from "node:url";
/** Source and built config modules have the same depth; credentials never depend on Web's cwd. */
export const appDataDirectory = fileURLToPath(
  new URL("../../../../.local/", import.meta.url),
);
