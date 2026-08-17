// Package configloader читает конфигурацию сервиса из переменных окружения.
//
// Единственный источник — env. Файл `.env` подхватывается только для локальной
// разработки и никогда не коммитится; в контейнере значения приходят из
// compose/секретов. Значения по умолчанию живут в тегах структуры рядом с
// полем, а не в отдельной таблице.
package configloader

import (
	"context"
	"fmt"
	"os"

	"github.com/ilyakaznacheev/cleanenv"
	"github.com/joho/godotenv"
)

// LoadEnv заполняет cfg из окружения. Порядок: `.env` (если существует, без
// перезаписи уже заданных переменных), затем сами переменные окружения.
func LoadEnv(_ context.Context, serviceName string, cfg any) error {
	for _, candidate := range []string{".env", "../.env"} {
		if _, err := os.Stat(candidate); err == nil {
			// godotenv.Load не перезаписывает уже установленные переменные:
			// окружение контейнера всегда сильнее локального файла.
			if err := godotenv.Load(candidate); err != nil {
				return fmt.Errorf("%s: load %s: %w", serviceName, candidate, err)
			}
			break
		}
	}

	if err := cleanenv.ReadEnv(cfg); err != nil {
		return fmt.Errorf("%s: read env: %w", serviceName, err)
	}

	return nil
}
