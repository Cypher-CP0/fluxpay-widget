import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'
import peerDepsExternal from 'rollup-plugin-peer-deps-external'
import json from '@rollup/plugin-json'
import postcss from 'rollup-plugin-postcss'
import inject from '@rollup/plugin-inject'

export default {
    input: 'src/index.tsx',
    output: [
        {
            file: 'dist/fluxpay.js',
            format: 'iife',
            name: 'FluxPay',
            globals: {},
        },
        {
            file: 'dist/fluxpay.esm.js',
            format: 'esm',
        },
    ],
    plugins: [
        peerDepsExternal(),
        json(),
        resolve({
            browser: true,
            preferBuiltins: false,
        }),
        commonjs(),
        inject({
            Buffer: ['buffer', 'Buffer'],  // polyfill Buffer globally
        }),
        postcss({ inject: true }),
        replace({
            preventAssignment: true,
            'process.env.NODE_ENV': JSON.stringify('production'),
            'process.env.SOLANA_NETWORK': JSON.stringify('devnet'),
            'process.browser': JSON.stringify(true),
            'process.version': JSON.stringify(''),
            'typeof process': JSON.stringify('undefined'),
        }),
        typescript({ tsconfig: './tsconfig.json' }),
        terser(),
    ],
}