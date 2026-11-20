import {defineConfig} from 'vite';

// Isolated, nonproduction development server for frame-by-frame rendering.
// The official TanStack router intentionally returns 404 for arbitrary HTML
// pages; plain Vite can serve the special engine-test HTML safely.
export default defineConfig({
  root:'.',
  plugins:[],
  server:{host:'127.0.0.1',port:4198,strictPort:true},
  optimizeDeps:{include:['three']},
});
