import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path, { resolve } from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import svgr from '@svgr/rollup';

// https://vitejs.dev/config/
export default defineConfig({
    resolve: {
        alias: {
            src: resolve(__dirname, 'src'),
            '@': resolve(__dirname, 'src'),
        },
        dedupe: ['react', 'react-dom'],
    },
    esbuild: {
        loader: 'tsx',
        include: /src\/.*\.tsx?$/,
        exclude: [],
    },
    optimizeDeps: {
        esbuildOptions: {
            plugins: [
                {
                    name: 'load-js-files-as-tsx',
                    setup(build) {
                        build.onLoad(
                            { filter: /src\\.*\.js$/ },
                            async (args) => ({
                                loader: 'tsx',
                                contents: await fs.readFile(args.path, 'utf8'),
                            })
                        );
                    },
                },
            ],
        },
        include: ['pdfjs-dist'],
    },
    plugins: [
        svgr(),
        react(),
        {
            name: 'website-builder-spa-fallback',
            configureServer(server) {
                server.middlewares.use((req, res, next) => {
                    const url = req.url || '';
                    // Rewrite /images/* and /fonts/* to /website-builder/images/* and /website-builder/fonts/*
                    // Jano components use hardcoded paths like "/images/..." without the base prefix
                    if ((url.startsWith('/images/') || url.startsWith('/fonts/')) && !url.startsWith('/website-builder/')) {
                        const rewrittenPath = resolve(__dirname, 'public/website-builder' + url);
                        if (fsSync.existsSync(rewrittenPath)) {
                            req.url = '/website-builder' + url;
                        }
                    }
                    // Serve Jano's index.html for /website-builder sub-routes (not static files)
                    if (url.startsWith('/website-builder') && !url.match(/\.\w+($|\?)/)) {
                        const indexPath = resolve(__dirname, 'public/website-builder/index.html');
                        if (fsSync.existsSync(indexPath)) {
                            res.setHeader('Content-Type', 'text/html');
                            res.end(fsSync.readFileSync(indexPath, 'utf-8'));
                            return;
                        }
                    }
                    next();
                });
            },
        },
    ],
    server: {
        port: 5174,
        host: true,
        proxy: {
            '/freepik-api': {
                target: 'https://api.freepik.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/freepik-api/, ''),
                secure: true,
            },
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-pdfjs': ['pdfjs-dist'],
                    'vendor-excel': ['xlsx'],
                    'vendor-charts': ['apexcharts', 'react-apexcharts'],
                }
            }
        }
    },
    worker: {
        format: 'es'
    }
});