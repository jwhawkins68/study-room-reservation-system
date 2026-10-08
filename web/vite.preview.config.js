import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained HTML file on sample data, for sharing a clickable preview.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist-preview' },
});
