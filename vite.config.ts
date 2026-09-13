import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

/**
 * Копирует архив отчётов агентов в сборку: ссылки главы «Источники» работают
 * и в `vite preview`/на статике (в dev файлы отдаются из корня проекта).
 */
function copyAgentsArchive() {
  return {
    name: 'copy-agents-archive',
    apply: 'build' as const,
    closeBundle() {
      const from = join(rootDir, 'docs', 'agents');
      const to = join(rootDir, 'dist', 'docs', 'agents');
      if (!existsSync(from)) return;
      mkdirSync(to, { recursive: true });
      cpSync(from, to, { recursive: true });
    },
  };
}

// Reality — «Это вода»: dev-сервер на :1836, статическая сборка в dist
export default defineConfig({
  plugins: [react(), copyAgentsArchive()],
  base: './',
  server: {
    port: 1836,
    strictPort: true,
  },
  preview: {
    port: 1836,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
