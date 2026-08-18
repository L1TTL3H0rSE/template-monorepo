/**
 * Доменные типы и ПОРТ приложения.
 *
 * Это единственное место, которое знает и транспорт, и UI. Компоненты
 * импортируют типы отсюда и никогда — из `@starter/api`: иначе snake_case
 * бэкенда протекает в шаблоны, и переименование поля в БД становится правкой
 * тридцати файлов.
 *
 * Интерфейс объявлен рядом с ПОТРЕБИТЕЛЕМ (приложением), а не рядом с
 * реализацией (адаптером) — тот же принцип, что и в Go-сервисах.
 */

export type CharacterStatus = "draft" | "published" | "archived";

/** Доменная модель. camelCase, готовые типы, никаких `| null` без причины. */
export type Character = {
  id: string;
  name: string;
  status: CharacterStatus;
  createdAt: Date;
};

export type CharacterDraft = {
  name: string;
};

export type CharacterPage = {
  items: Character[];
  total: number;
};

export type CharacterSearch = {
  query?: string;
  limit: number;
  offset: number;
};

/**
 * Контекст запроса на уровне ПРИЛОЖЕНИЯ.
 *
 * `AbortSignal` — веб-стандарт, а не деталь конкретного транспорта, поэтому он
 * может стоять в контракте домена. Ничего специфичного для HTTP (заголовки,
 * коды, URL) сюда не попадает: это сломало бы границу порта.
 */
export type RequestContext = {
  signal?: AbortSignal;
};

/**
 * Порт домена «персонажи».
 *
 * Реализаций две — HTTP и mock, — и обе обязаны удовлетворять этому типу.
 * Именно поэтому переключение провайдера в `nuxt.config` не требует правок в
 * страницах и сторах.
 *
 * Контекст запроса принимает только `search`: у него есть доказанный
 * потребитель — интерактивный поиск, где параметры меняются быстрее, чем
 * приходит ответ. Остальные методы получат его тогда, когда появится
 * потребитель, а не ради симметрии.
 */
export interface CharacterApi {
  search(
    params: CharacterSearch,
    context?: RequestContext,
  ): Promise<CharacterPage>;
  getById(id: string): Promise<Character>;
  create(draft: CharacterDraft): Promise<Character>;
  rename(id: string, name: string): Promise<Character>;
  remove(id: string): Promise<void>;
}

/** Совокупный API приложения. Новый домен добавляет сюда своё поле. */
export interface WebApi {
  characters: CharacterApi;
}
