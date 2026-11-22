// Plain static Vite host for the read-only renderer fixture. TanStack's app
// router owns arbitrary HTML paths on the main dev server and returns a 404.
import {defineConfig} from 'vite';
import path from 'node:path';
export default defineConfig({
 root:process.cwd(),resolve:{alias:{'@':path.resolve('src')}},
 server:{host:'127.0.0.1',port:4201,strictPort:true},
});
