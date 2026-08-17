# @roleplay/components

Дизайн-система: визуальные примитивы, SCSS-токены и витрина Storybook.

Пакет публикует собранный `dist`, а не `src`. Приложение-потребитель читает
`dist/index.js` и `dist/style.css`, поэтому **правка в `src` становится видимой
только после сборки пакета и перезапуска потребителя**. Это самая частая причина
«я поменял, но ничего не изменилось».

## Команды

```bash
pnpm dev              # Storybook на http://localhost:6006
pnpm dev:host         # Storybook на 0.0.0.0:6006
pnpm generate         # брейкпоинты + барель компонентов
pnpm build            # production-сборка + декларации
pnpm build:local      # то же без минификации
pnpm build-storybook  # статическая витрина в storybook-static/
pnpm test             # тесты, включая guard публичной поверхности
pnpm typecheck
pnpm lint
```

## Границы

- Компонент **не знает про роутер и HTTP**. Ссылка приходит через
  `linkComponent` в опциях плагина, данные — через props.
- Компонент **не ходит в стор приложения**. Собственные сторы пакета
  (`stores/modals`) обслуживают только UI-механику.
- Внутренний хелпер живёт в `src/internal` или рядом с единственным
  потребителем. В `src/index.ts` он не попадает.

## Генерируемые файлы

Правятся только через источник:

| Файл | Источник |
|---|---|
| `src/assets/scss/_breakpoints.scss` | `src/breakpoints.json` |
| `src/utils/_breakpoints.ts` | `src/breakpoints.json` |
| `src/components/index.ts` | содержимое `src/components/*.vue` |

## Публичная поверхность

`test/public-surface.test.ts` сравнивает экспорты `src/index.ts` с reviewed
allowlist и падает в обе стороны: и когда экспорт исчез, и когда появился
незаявленный. Новый публичный API — осознанная правка списка.

## Стили

Правила BEM, работа с токенами и причины решений разобраны в
[`docs/frontend/scss-bem.md`](../../../docs/frontend/scss-bem.md) и
[`docs/frontend/design-tokens.md`](../../../docs/frontend/design-tokens.md).

Коротко:

- блок — класс (`.button`), элемент — `&__element`, **модификатор — HTML-атрибут**
  (`[variant="outlined"]`), а не класс `button--outlined`;
- цвет, отступ, шрифт, тень и z-index берутся из токенов; литералов в компоненте
  нет;
- варианты переопределяют локальные CSS-переменные блока, а не копируют правила.

## Отладка stale-сборки

```js
document.documentElement.dataset.roleplayComponentsBuild;
```

Значение равно отпечатку `src` на момент сборки. Если оно не совпадает с
ожидаемым — потребитель загрузил старый бандл, и искать ошибку в текущем
исходнике бессмысленно.
