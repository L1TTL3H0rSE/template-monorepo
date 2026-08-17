# @roleplay/eslint-config

Общие flat-конфигурации ESLint. Один источник правил на весь workspace.

| Экспорт | Для чего |
|---|---|
| `@roleplay/eslint-config` / `/vue` | Vue-пакеты |
| `@roleplay/eslint-config/nuxt` | Nuxt-приложения |
| `@roleplay/eslint-config/storybook` | Пакет с историями |
| `@roleplay/eslint-config/prettier` | Настройки Prettier |

Использование в пакете:

```js
// eslint.config.mjs
import config from "@roleplay/eslint-config/storybook";

export default config;
```

Правило: локальный `eslint.config.mjs` подключает общий конфиг и НЕ переопределяет
правила «под себя». Исключение оформляется как правка этого пакета с причиной —
иначе договорённость расходится между каталогами молча.
