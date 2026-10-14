/**
 * Cheap capability probe — creates a context, then hands it straight back.
 * Lives outside React so the website can ask the same question without
 * loading a component library to do it.
 */
export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return false;
    // Releasing eagerly keeps the probe from holding one of the browser's
    // limited live contexts for the rest of the session.
    (gl.getExtension('WEBGL_lose_context') as WEBGL_lose_context | null)?.loseContext();
    return true;
  } catch {
    return false;
  }
}
