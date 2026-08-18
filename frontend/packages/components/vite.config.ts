import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { UserConfig } from "vite";
import vue from "@vitejs/plugin-vue";

/**
 * Отпечаток сборки: хеш содержимого src.
 *
 * Он попадает в бандл и в `data-components-build-fingerprint` на <html>, поэтому
 * при отладке видно, свежий ли бандл загрузил потребитель. Иначе «правка не
 * применилась» и «правка неверна» выглядят одинаково.
 */
function computeBuildFingerprint(
  dir = resolve(import.meta.dirname, "src"),
): string {
  const hash = createHash("sha256");

  const walk = (current: string) => {
    for (const entry of readdirSync(current).sort()) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else {
        hash.update(entry).update(readFileSync(full));
      }
    }
  };
  walk(dir);

  return hash.digest("hex").slice(0, 12);
}

const config: UserConfig = {
  define: {
    __COMPONENTS_BUILD_FINGERPRINT__: JSON.stringify(computeBuildFingerprint()),
  },

  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },

  css: {
    preprocessorOptions: {
      scss: {
        // SCSS API пакета подставляется в начало каждого блока стилей: миксин
        // typography() и $breakpoint-* доступны без импорта в каждом SFC.
        additionalData: `@use "@/assets/scss/api.scss" as *;`,
      },
    },
  },

  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      formats: ["es"],
      // Имя выходного файла обязано совпадать с index.js: src/index.ts —
      // одновременно точка входа пакета и барель, на который ссылаются
      // внутренние чанки. Другое имя даёт битую ссылку в собранном бандле.
      fileName: () => "index.js",
      // Имя CSS-файла задаётся явно: по умолчанию Vite называет его по имени
      // пакета, и экспорт "./styles" в package.json пришлось бы менять при
      // каждом переименовании пакета.
      cssFileName: "style",
    },
    rollupOptions: {
      // Внешними считаются любые bare-импорты: vue, pinia, @vueuse/core.
      // Их предоставляет приложение-потребитель. Если бандлить их сюда,
      // production-сборка приложения получит два экземпляра Vue и упадёт на
      // дублирующихся top-level идентификаторах.
      //
      // isAbsolute обязателен: точка входа приходит абсолютным путём, и на
      // Windows он начинается с буквы диска — без этой проверки Rollup
      // объявляет внешним сам entry и падает с «Entry module cannot be
      // external».
      external: (source) =>
        !(
          isAbsolute(source) ||
          source.startsWith(".") ||
          source.startsWith("/") ||
          source.startsWith("@/") ||
          source.startsWith("\0") ||
          source.startsWith("virtual:")
        ),
    },
  },

  plugins: [vue()],
};

export default config;
