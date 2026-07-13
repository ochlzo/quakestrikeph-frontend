import { readFile, writeFile } from "node:fs/promises";

// ponytail: Drizzle Kit 0.31.10 doubles quoted identity sequence names; remove after upgrading it.
const path = new URL("../drizzle/schema.ts", import.meta.url);
const schema = await readFile(path, "utf8");

await writeFile(path, schema.replaceAll(/name: ""([^"]+)""/g, 'name: "$1"'));
