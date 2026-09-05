import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { NotFoundError } from "../../domain/errors.js";

/** Never expose the episode directory itself: it contains answer keys and private study files. */
export async function resolveListeningAsset(root, components, kind) {
  const missing = () => new NotFoundError(`LISTENING_${kind}_NOT_FOUND`, `Listening episode ${kind.toLowerCase()} was not found.`);
  if (!root || components.some((part) => typeof part !== "string" || !part || part === "." || part === ".." || /[/\\\0]/u.test(part))) throw missing();
  try {
    const canonicalRoot = await realpath(root);
    let candidate = canonicalRoot;
    for (const part of components) {
      candidate = path.join(candidate, part);
      if ((await lstat(candidate)).isSymbolicLink()) throw missing();
    }
    const canonicalFile = await realpath(candidate);
    if (!canonicalFile.startsWith(`${canonicalRoot}${path.sep}`) || !(await lstat(canonicalFile)).isFile()) throw missing();
    return canonicalFile;
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") throw missing();
    throw error;
  }
}
