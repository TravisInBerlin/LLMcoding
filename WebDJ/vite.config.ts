import { defineConfig } from 'vite';

const normalizeBase = (raw: string | undefined): string => {
  if (!raw) return '/';
  if (raw === '/') return '/';
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
};

export default defineConfig({
  base: normalizeBase(process.env.VITE_BASE_PATH),
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
