import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['tests/unit/**/*.{test,spec}.js', 'tests/integration/**/*.{test,spec}.js'],
        alias: {
            '@': path.resolve(__dirname, './front_end')
        }
    },
});
