import { useFormState } from "@starter/shared/forms";
import type { CharacterDraft } from "~/contracts/character";

/**
 * Форма создания персонажа.
 *
 * Композабл, а не стор: состояние формы живёт ровно столько, сколько экран.
 * Вынесенное в глобальный стор, оно показывает недописанный текст при
 * следующем открытии.
 *
 * Правила валидации живут здесь, рядом с доменным контрактом, а не в шаблоне:
 * иначе одно и то же ограничение расходится между формой создания и формой
 * редактирования.
 */
const NAME_MIN = 2;
const NAME_MAX = 60;

export function useCharacterForm(initial?: Partial<CharacterDraft>) {
  const form = useFormState<CharacterDraft>({ name: initial?.name ?? "" });

  function validate(): boolean {
    const name = form.values.name.trim();

    if (name.length < NAME_MIN) {
      form.setErrors({ name: `Минимум ${NAME_MIN} символа` });
      return false;
    }
    if (name.length > NAME_MAX) {
      form.setErrors({ name: `Максимум ${NAME_MAX} символов` });
      return false;
    }

    form.setErrors({});

    return true;
  }

  async function submit(
    handler: (draft: CharacterDraft) => Promise<void>,
  ): Promise<boolean> {
    if (!validate()) return false;

    try {
      return await form.submit(handler);
    } catch (caught) {
      form.setErrors({
        name: caught instanceof Error ? caught.message : "Не удалось сохранить",
      });

      return false;
    }
  }

  return { form, validate, submit, NAME_MIN, NAME_MAX };
}
