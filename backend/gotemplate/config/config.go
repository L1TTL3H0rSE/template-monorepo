package config

import (
	"context"

	"starter/kit/adapters/postgres"
	"starter/kit/bootstrap"
	"starter/kit/configloader"
	kithttp "starter/kit/infra/http"
)

// Config сервиса — это встроенный bootstrap.Common плюс доменные блоки.
//
// Каждый блок получает свой env-prefix, поэтому имя переменной выводится из
// структуры: Server.Port -> SERVER_PORT, Database.Host -> DB_HOST. Отдельной
// таблицы соответствий не существует.
type Config struct {
	bootstrap.Common

	Server   kithttp.Config  `env-prefix:"SERVER_"`
	Database postgres.Config `env-prefix:"DB_"`
}

func Load() (*Config, error) {
	cfg := Config{}
	if err := configloader.LoadEnv(context.Background(), "gotemplate", &cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}
