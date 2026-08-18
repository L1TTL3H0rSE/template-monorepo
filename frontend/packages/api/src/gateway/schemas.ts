import { z } from "zod";

/**
 * Схемы транспортных DTO гейтвея.
 *
 * Почему схема, а не просто `type`: TypeScript проверяет форму на сборке, а
 * данные приходят в рантайме. Бэкенд, отдавший `null` там, где объявлен
 * `string`, с типами упадёт где-то глубоко в компоненте; со схемой — на
 * границе, с внятным сообщением.
 *
 * Правило: схема описывает форму ТРАНСПОРТА (snake_case, как в JSON), а не
 * доменную модель приложения. Перевод в доменную форму делает адаптер.
 */
export const exampleViewSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  created_at: z.string(),
});

export type ExampleViewDto = z.infer<typeof exampleViewSchema>;

export const exampleSearchResponseSchema = z.object({
  items: z.array(exampleViewSchema),
  total: z.number(),
  from: z.number(),
  size: z.number(),
});

export type ExampleSearchResponseDto = z.infer<
  typeof exampleSearchResponseSchema
>;

/**
 * Разбирает ответ схемой и превращает несоответствие в внятную ошибку.
 *
 * Контекст в сообщении обязателен: `Invalid input` без указания эндпоинта не
 * помогает вообще.
 *
 * Параметр — САМА схема, а не её результат. Форма `schema: z.ZodType<T>` в
 * zod 4 больше не выводит `T`: `Output` объявлен ковариантным и участвует в
 * ограничении третьего параметра, из-за чего вывод откатывается к `unknown`, и
 * вызывающий получает `dto` типа `unknown` вместо DTO.
 */
export function parseResponse<S extends z.ZodType>(
  schema: S,
  payload: unknown,
  context: string,
): z.output<S> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new Error(
      `${context}: ответ не соответствует контракту — ${result.error.message}`,
    );
  }

  return result.data;
}
