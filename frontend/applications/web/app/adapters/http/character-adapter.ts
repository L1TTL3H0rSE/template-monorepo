import type { ApiClient } from "@roleplay/api/core";
import {
  exampleSearchResponseSchema,
  exampleViewSchema,
  parseResponse,
  type ExampleViewDto,
} from "@roleplay/api/gateway";
import type {
  Character,
  CharacterApi,
  CharacterDraft,
  CharacterPage,
  CharacterSearch,
  RequestContext,
} from "~/contracts/character";

/**
 * HTTP-реализация порта CharacterApi.
 *
 * Адаптер — единственное место перевода транспортной формы в доменную:
 * snake_case -> camelCase, строка ISO -> Date, отсутствующее поле -> значение
 * по умолчанию. Если этот перевод растекается по компонентам, каждый из них
 * начинает знать про формат бэкенда.
 */
export class HttpCharacterAdapter implements CharacterApi {
  constructor(private readonly client: ApiClient) {}

  async search(
    params: CharacterSearch,
    context?: RequestContext,
  ): Promise<CharacterPage> {
    const payload = await this.client.get<unknown>("example", {
      query: { q: params.query, from: params.offset, size: params.limit },
      // Сигнал доходит до fetch. Ни страница, ни стор не касаются ApiClient
      // напрямую — отмена проходит через порт.
      signal: context?.signal,
    });
    const dto = parseResponse(
      exampleSearchResponseSchema,
      payload,
      "GET /example",
    );

    return {
      items: dto.items.map(toCharacter),
      total: dto.total,
    };
  }

  async getById(id: string): Promise<Character> {
    const payload = await this.client.get<unknown>(`example/${id}`);

    return toCharacter(
      parseResponse(exampleViewSchema, payload, `GET /example/${id}`),
    );
  }

  async create(draft: CharacterDraft): Promise<Character> {
    const payload = await this.client.post<unknown>("example", {
      name: draft.name,
    });

    return toCharacter(
      parseResponse(exampleViewSchema, payload, "POST /example"),
    );
  }

  async rename(id: string, name: string): Promise<Character> {
    const payload = await this.client.patch<unknown>(`example/${id}`, { name });

    return toCharacter(
      parseResponse(exampleViewSchema, payload, `PATCH /example/${id}`),
    );
  }

  async remove(id: string): Promise<void> {
    await this.client.delete<void>(`example/${id}`);
  }
}

/** Единственная точка перевода DTO -> доменная модель. */
function toCharacter(dto: ExampleViewDto): Character {
  return {
    id: dto.id,
    name: dto.name,
    // Бэкенд ещё не отдаёт статус: значение по умолчанию задаётся здесь, а не
    // в шаблоне. Когда поле появится в контракте, правка будет ровно одна.
    status: "published",
    createdAt: new Date(dto.created_at),
  };
}
