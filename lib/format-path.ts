// Pure path-display helpers. Browser-safe; no os/fs imports.

/**
 * Replace the leading home-directory segment of `absPath` with `~`.
 *
 * Example: `tildify("/home/user/code/hazev2", "/home/user")` → `"~/code/hazev2"`.
 *
 * The match is purely textual on the leading segment + path separator. We
 * intentionally avoid importing `os` or `path` so the same helper can run in
 * client components and server routes alike. Callers are expected to pass the
 * canonical home directory (typically from `os.homedir()` on the server, or
 * from a hydrated value pushed down to the client).
 *
 * If `homeDir` is empty, undefined, or `absPath` doesn't start with it, the
 * original `absPath` is returned unchanged. Trailing slashes on `homeDir` are
 * tolerated.
 */
export function tildify(
  absPath: string,
  homeDir: string | null | undefined
): string {
  if (!homeDir) return absPath;
  // Normalize the home prefix: strip any trailing slash so the boundary
  // check below sees a clean directory separator.
  const home = homeDir.endsWith("/") ? homeDir.slice(0, -1) : homeDir;
  if (!home) return absPath;
  if (absPath === home) return "~";
  if (absPath.startsWith(home + "/")) {
    return "~" + absPath.slice(home.length);
  }
  return absPath;
}
