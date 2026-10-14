import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const pkg = JSON.parse(readFileSync(here('./package.json'), 'utf8')) as { version: string };

/**
 * Stamps the version into the served HTML.
 *
 * "Is my browser running the build I just deployed?" is otherwise unanswerable
 * without reading response headers, and a stale shell is indistinguishable from
 * a broken deploy. Check it in dev tools, or `curl -s <url> | grep caliper-build`.
 */
function versionStamp(): Plugin {
  return {
    name: 'caliper-version-stamp',
    transformIndexHtml(html) {
      return html.replace('</head>', `  <meta name="caliper-build" content="${pkg.version}" />\n  </head>`);
    },
  };
}

/** Every file under public/ that the offline copy needs, as a site path. */
function publicFiles(dir: string, keep: (path: string) => boolean): string[] {
  const out: string[] = [];
  const walk = (folder: string) => {
    for (const name of readdirSync(folder)) {
      const full = join(folder, name);
      if (statSync(full).isDirectory()) walk(full);
      else {
        const path = `/${relative(dir, full).split('\\').join('/')}`;
        if (keep(path)) out.push(path);
      }
    }
  };
  walk(dir);
  return out;
}

/**
 * Writes dist/sw.js from src/pwa/sw.js with this build's version and the exact
 * list of files it produced. No Workbox: the worker is 76 lines of code, and a
 * generated list is the one part that must never be written by hand.
 */
function serviceWorker(): Plugin {
  return {
    name: 'caliper-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const built = Object.keys(bundle)
        .filter((file) => !file.endsWith('.map') && !file.endsWith('.html'))
        .map((file) => `/${file}`);
      const pages = ['/', '/app/'];
      const extras = publicFiles(here('./public'), (path) =>
        /^\/(manifest\.webmanifest|favicon\.svg|icons\/.+\.png)$/.test(path),
      );
      const precache = [...pages, ...extras, ...built];
      const source = readFileSync(here('./src/pwa/sw.js'), 'utf8')
        .replace('__CALIPER_VERSION__', `${pkg.version}-${Date.now().toString(36)}`)
        .replace('__CALIPER_PRECACHE__', JSON.stringify(precache, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [react(), versionStamp(), serviceWorker()],
  resolve: {
    alias: { '@': here('./src') },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      // Two pages: the website at / and the app at /app/. They share the
      // tokens, the engine and the three.js chunk.
      input: {
        site: here('./index.html'),
        app: here('./app/index.html'),
      },
      output: {
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
