import dts from 'rollup-plugin-dts'

// Run AFTER rollup.config.js (see package.json "build" script).
// Reads the per-file .d.ts output that the typescript() plugin in
// rollup.config.js wrote to dist/.tsbuild/, and bundles it into the
// single dist/types/index.d.ts referenced by package.json "types".
export default {
    input: 'dist/.tsbuild/index.d.ts',
    output: [{ file: 'dist/types/index.d.ts', format: 'es' }],
    plugins: [dts()],
}
