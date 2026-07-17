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
            globals: {
                'react': 'React',
                'react-dom': 'ReactDOM',
                'react-dom/client': 'ReactDOM',
            },
            // Some transitive deps (WalletConnect/Reown adapters, pulled in via
            // @solana/wallet-adapter-wallets) use dynamic import(). IIFE format
            // can't code-split, so inline everything into the single output file
            // instead — which is what a drop-in <script> widget needs anyway.
            inlineDynamicImports: true,
        },
        {
            file: 'dist/fluxpay.esm.js',
            format: 'esm',
            inlineDynamicImports: true,
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
            Buffer: ['buffer', 'Buffer'],
        }),
        postcss({ inject: true }),
        replace({
            preventAssignment: true,
            'process.env.NODE_ENV': JSON.stringify('production'),
            'process.browser': JSON.stringify(true),
            'process.version': JSON.stringify(''),
            'typeof process': JSON.stringify('undefined'),
        }),
        // emitDeclarationOnly is false in tsconfig, so this also writes
        // dist/.tsbuild/*.d.ts as a side effect, consumed by rollup.dts.config.js
        typescript({ tsconfig: './tsconfig.json' }),
        terser(),
    ],
}