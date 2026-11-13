import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// --- file:// 더블클릭 실행을 위해 JS와 CSS를 index.html 안에 넣는다. 그림은 public/assets 에서 상대 경로로 읽는다 ---
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2018',
    outDir: 'dist',
    emptyOutDir: true,
  },
})
