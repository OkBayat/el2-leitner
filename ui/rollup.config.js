import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'src/material-web.js',
  output: {
    file: 'dist/material-web.js',
    format: 'es',
    sourcemap: false
  },
  plugins: [nodeResolve()],
  treeshake: true
};
