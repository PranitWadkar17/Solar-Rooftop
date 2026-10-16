import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const srcFramesDir = fileURLToPath(new URL('./framify_frames', import.meta.url));
const destFramesDir = fileURLToPath(new URL('./public/framify_frames', import.meta.url));

// Auto-sync framify_frames to public/framify_frames on server start
try {
  if (fs.existsSync(srcFramesDir)) {
    if (!fs.existsSync(destFramesDir)) {
      fs.mkdirSync(path.dirname(destFramesDir), { recursive: true });
      fs.cpSync(srcFramesDir, destFramesDir, { recursive: true });
      console.log('✅ Synchronized 301 framify_frames to public/framify_frames');
    }
  }
} catch (e) {
  console.warn('Notice: frames sync error:', e);
}

function serveFramifyPlugin(): Plugin {
  return {
    name: 'serve-framify-frames',
    configureServer(server) {
      server.middlewares.use('/framify_frames', (req, res, next) => {
        const cleanUrl = (req.url || '').split('?')[0].replace(/^\//, '');
        let targetPath = path.join(destFramesDir, cleanUrl);
        if (!fs.existsSync(targetPath)) {
          targetPath = path.join(srcFramesDir, cleanUrl);
        }
        if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          fs.createReadStream(targetPath).pipe(res);
          return;
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveFramifyPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
