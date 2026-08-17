/**
 * Единственная конфигурация Prettier проекта.
 *
 * Форматирование не обсуждается в ревью: его делает инструмент. Локальные
 * `.prettierrc` в пакетах не заводятся — иначе одинаковый код форматируется
 * по-разному в соседних каталогах.
 */
export default {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 80,
  tabWidth: 2,
  endOfLine: "lf",
};
