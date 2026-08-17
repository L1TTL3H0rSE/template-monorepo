import { ApiClient } from "@roleplay/api/core";
import type { WebApi } from "~/contracts/character";
import { HttpCharacterAdapter } from "~/adapters/http/character-adapter";
import { MockCharacterAdapter } from "~/adapters/mock/character-adapter";

/**
 * Фабрика API приложения — единственное место, где выбирается реализация
 * порта.
 *
 * Выше этой функции слово «mock» не встречается: страница и стор знают только
 * тип `WebApi`. Поэтому смена провайдера — это переменная окружения, а не
 * ветвление в компонентах.
 */
let instance: WebApi | undefined;

export function useApi(): WebApi {
  instance ??= createApi();

  return instance;
}

function createApi(): WebApi {
  const config = useRuntimeConfig();

  if (config.public.apiProvider === "mock") {
    return { characters: new MockCharacterAdapter() };
  }

  const client = new ApiClient(
    config.public.apiBaseUrl as string,
    () =>
      // Здесь подключается провайдер токена (Keycloak, cookie-сессия и т.п.).
      // Клиент не знает, откуда берётся токен, — он только просит его перед
      // запросом.
      null,
  );

  return { characters: new HttpCharacterAdapter(client) };
}
