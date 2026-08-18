# @starter/eslint-config

Общие flat-конфигурации ESLint. Один источник правил на весь workspace.

| Экспорт | Для чего |
|---|---|
| `@starter/eslint-config` / `/vue` | Vue-пакеты |
| `@starter/eslint-config/nuxt` | Nuxt-приложения |
| `@starter/eslint-config/storybook` | Пакет с историями |
| `@starter/eslint-config/prettier` | Настройки Prettier |

Использование в пакете:

```js
// eslint.config.mjs
import config from "@starter/eslint-config/storybook";

export default config;
```

Правило: локальный `eslint.config.mjs` подключает общий конфиг и НЕ переопределяет
правила «под себя». Исключение оформляется как правка этого пакета с причиной —
иначе договорённость расходится между каталогами молча.
