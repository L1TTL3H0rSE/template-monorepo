# BEM и SCSS

## Короткая версия

```text
блок        .button              класс
элемент     .button__label       класс, &__ внутри блока
модификатор [variant="outlined"] HTML-АТРИБУТ, не класс
```

Первые две строки — классический BEM. Третья — сознательное отклонение, и
именно её нужно понять.

## Модификатор — атрибут

### Как это выглядит

```vue
<button
  class="button"
  :color="props.color"
  :size="props.size"
  :variant="props.variant"
>
```

```scss
.button {
  &[variant="outlined"] {
    --button-border: solid 1px var(--button-accent-color);
    --button-background-color: transparent;
  }
}
```

### Почему не `button--outlined`

**1. Значение приходит из props без склейки строк.**

```vue
<!-- атрибуты -->
<button class="button" :variant="props.variant">

<!-- классы: та же информация, вчетверо больше кода -->
<button :class="['button', `button--${props.variant}`, `button--${props.size}`, `button--${props.color}`]">
```

Второй вариант — конкатенация строк в разметке. Опечатка в шаблонной строке не
ловится ничем: класс просто не сработает.

**2. В DevTools видно состояние, а не строку классов.**

```html
<!-- атрибуты: значение каждой оси читается сразу -->
<button class="button" color="primary" size="medium" variant="outlined">

<!-- классы: нужно разбирать глазами -->
<button class="button button--primary button--medium button--outlined">
```

Разница становится заметной, когда осей пять и часть из них булевы.

**3. Множественные оси не комбинируются взрывом.**

Селектор `.button[variant="icon"][size="small"]` читается как «иконочная кнопка
малого размера». Классовый эквивалент `.button--icon.button--small` — то же
самое, но при добавлении третьей оси имена начинают дублировать друг друга
(`button--icon-small-error`).

**4. Булев модификатор становится просто наличием атрибута.**

```vue
<span class="badge" :subtle="props.subtle || undefined">
```

```scss
&[subtle] { /* ... */ }
```

`|| undefined` обязателен: `:subtle="false"` в Vue всё равно отрендерит
`subtle="false"`, и селектор `[subtle]` сработает. `undefined` убирает атрибут
целиком.

### Цена решения

Специфичность `.button[variant="outlined"]` (0,2,0) выше, чем у `.button`
(0,1,0). Это не проблема внутри блока — но означает, что переопределить вариант
снаружи одним классом не получится. Для того и существуют локальные CSS-
переменные (ниже).

Элементы BEM при этом остаются обычными классами: `.button__label`,
`.button__side`. Атрибут описывает **состояние**, класс — **структуру**.

## Локальные CSS-переменные как API блока

Главный приём файла стилей. Блок объявляет переменные, варианты переопределяют
**их**, а не набор правил:

```scss
.button {
  // API стилей блока
  --button-accent-color: var(--primary-main-color);
  --button-text-color: var(--text-light-color);
  --button-background-color: var(--button-accent-color);
  --button-border: none;
  --button-padding: var(--spacing-04) var(--spacing-06);

  // Правила написаны ОДИН раз
  padding: var(--button-padding);
  border: var(--button-border);
  color: var(--button-text-color);
  background-color: var(--button-background-color);

  // Вариант меняет три значения, а не переписывает блок
  &[variant="outlined"] {
    --button-border: solid 1px var(--button-accent-color);
    --button-background-color: transparent;
    --button-text-color: var(--button-accent-color);
  }
}
```

Без переменных каждый вариант повторяет `border`, `color`, `background`, и при
добавлении четвёртого свойства его забывают в одном из вариантов.

Побочная выгода: потребитель может точечно переопределить одну переменную, не
воюя со специфичностью.

## Миксины против повторения

Шесть цветов × три состояния = 18 блоков правил, которые расходятся при первой
правке. Миксин делает это одной строкой на цвет:

```scss
@mixin accent-color-state($color-name, $default-var, $hover-var, $active-var, $text-var: null) {
  &[color="#{$color-name}"] {
    --button-accent-color: var(--#{$default-var});

    @if $text-var {
      --button-text-color: var(--#{$text-var});
    }

    @media (hover: hover) {
      &:hover:not(:disabled) {
        --button-accent-color: var(--#{$hover-var});
      }
    }
    &:active:not(:disabled) {
      --button-accent-color: var(--#{$active-var});
    }
  }
}

@include accent-color-state("primary", "primary-main-color", "primary-hover-color", "primary-active-color");
@include accent-color-state("error",   "error-default-color", "error-hover-color",   "error-active-color");
```

`@media (hover: hover)` — обязательная деталь: без него на тач-устройстве
hover-состояние «залипает» после тапа, и кнопка остаётся подсвеченной.

## Порядок внутри блока

```scss
.block {
  // 1. локальные переменные — API блока
  --block-padding: var(--spacing-06);

  // 2. собственные свойства блока
  display: flex;
  padding: var(--block-padding);

  // 3. вложенные теги
  svg { flex-shrink: 0; }

  // 4. элементы
  &__label { /* ... */ }
  &__side  { /* ... */ }

  // 5. варианты (атрибуты)
  &[variant="outlined"] { /* ... */ }

  // 6. состояния
  &:focus-visible { @include focus-ring; }
  &:disabled { /* ... */ }

  // 7. адаптив
  @media (max-width: $breakpoint-tablet) { /* ... */ }
}
```

Одинаковый порядок во всех файлах означает, что нужное правило ищется по месту в
файле, а не поиском по тексту.

## `scoped`: где нужен, где мешает

| Где | `scoped` | Почему |
|---|---|---|
| `packages/components` | **нет** | Потребитель должен иметь возможность переопределить стиль компонента библиотеки |
| `applications/web` | **да** | Стиль страницы не должен протекать в дизайн-систему |

Без этого разделения либо библиотека нерасширяема, либо стиль одной страницы
меняет вид кнопки во всём приложении.

## SCSS API: доступ без импортов

`src/assets/scss/api.scss` подставляется в **начало каждого блока стилей** —
через `additionalData` в `vite.config.ts` пакета и в `nuxt.config.ts`
приложения. Поэтому в любом SFC сразу доступны `typography()`, `$breakpoint-*`,
`$z-index-*` и `focus-ring()`.

Критически важно, что в `api.scss` попадает **только то, что не порождает CSS**:
переменные, миксины, функции. Если туда добавить `colors.scss`, палитра
продублируется в каждом собранном компоненте.

## Запрещено

| Практика | Почему |
|---|---|
| `color: #6c4bd8` в компоненте | Смена палитры превращается в поиск по всем файлам |
| `padding: 13px` | Мимо шкалы отступов; интерфейс перестаёт быть ритмичным |
| `z-index: 9999` | Числа теряют смысл; слои живут в `variables.scss` |
| `!important` | Признак проигранной войны со специфичностью; решается переменной блока |
| `.a .b .c .d` | Хрупко и медленно; BEM существует, чтобы селектор был плоским |
| Отключение `outline` без замены | Интерфейс становится недоступен с клавиатуры |

## Чек-лист нового компонента

- [ ] Блок — один класс, элементы — `&__`.
- [ ] Оси вариантов — атрибуты, булевы — через `|| undefined`.
- [ ] Изменяемые свойства вынесены в локальные переменные блока.
- [ ] Цвета, отступы, шрифты, тени — только токены.
- [ ] Есть `:focus-visible` и `:disabled`.
- [ ] `@media (hover: hover)` вокруг hover-состояний.
- [ ] Адаптив в конце блока.
- [ ] На каждую ветку стилей есть история в Storybook.
