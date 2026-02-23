import { defineConfig } from 'vite';
import { resolve }       from 'path';
import fs                from 'fs';

// Copies manifest.json and icons/ into dist/ after each build.
function copyExtensionAssets() {
  return {
    name: 'copy-extension-assets',
    closeBundle() {
      const dist = resolve(__dirname, 'dist');

      fs.copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(dist, 'manifest.json'),
      );

      const iconsOut = resolve(dist, 'icons');
      fs.mkdirSync(iconsOut, { recursive: true });
      for (const f of fs.readdirSync(resolve(__dirname, 'icons'))) {
        fs.copyFileSync(
          resolve(__dirname, 'icons', f),
          resolve(iconsOut, f),
        );
      }
    },
  };
}

export default defineConfig({
  // Treat src/ as the Vite root so HTML entries output to
  // dist/popup/popup.html and dist/settings/settings.html (no src/ prefix).
  root: resolve(__dirname, 'src'),

  build: {
    outDir:      resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup:      resolve(__dirname, 'src/popup/popup.html'),
        settings:   resolve(__dirname, 'src/settings/settings.html'),
        background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        // background.js must be a stable filename (Chrome manifest reference).
        // Everything else goes into assets/ with a content hash.
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },

  plugins: [copyExtensionAssets()],
});
