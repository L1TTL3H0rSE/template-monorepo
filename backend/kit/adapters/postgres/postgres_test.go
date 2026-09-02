package postgres

import (
	"os"
	"strings"
	"testing"

	"github.com/ilyakaznacheev/cleanenv"
)

// Блок конфигурации в той же форме, в какой его встраивает сервис.
type envConfig struct {
	Database Config `env-prefix:"DB_"`
}

func load(t *testing.T) (*envConfig, error) {
	t.Helper()

	cfg := &envConfig{}

	return cfg, cleanenv.ReadEnv(cfg)
}

// Имя базы обязано быть задано: `postgres` — действующая служебная база
// кластера, и умолчание увело бы миграции и записи туда молча и успешно.
//
// Проверка держится на обеих сторонах: без DB_NAME загрузка падает, с ним —
// проходит. Без первой половины тест был бы зелёным и при возвращённом
// умолчании, то есть не проверял бы ничего.
func TestNameIsRequired(t *testing.T) {
	t.Setenv("DB_NAME", "placeholder")
	os.Unsetenv("DB_NAME")

	if _, err := load(t); err == nil {
		t.Fatal("конфигурация без DB_NAME загрузилась: сервис ушёл бы в служебную базу postgres")
	}

	t.Setenv("DB_NAME", "service")

	cfg, err := load(t)
	if err != nil {
		t.Fatalf("конфигурация с DB_NAME не загрузилась: %v", err)
	}
	if cfg.Database.Name != "service" {
		t.Fatalf("Name = %q, ожидалось service", cfg.Database.Name)
	}
}

// Адрес и порт умолчания сохраняют: они полезны локально и не приводят к
// молчаливой записи не туда — недоступный хост виден сразу.
func TestHostAndPortKeepDefaults(t *testing.T) {
	t.Setenv("DB_NAME", "service")

	cfg, err := load(t)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if cfg.Database.Host != "localhost" || cfg.Database.Port != 5432 {
		t.Fatalf("умолчания потеряны: %s:%d", cfg.Database.Host, cfg.Database.Port)
	}
}

// golang-migrate выбирает драйвер БД по схеме URL. Схема postgres увела бы
// миграции на lib/pq — второй драйвер PostgreSQL рядом с pgx рантайма.
func TestMigrationDSNUsesPGX5(t *testing.T) {
	cfg := &Config{Host: "localhost", Port: 5432, Name: "service", User: "u", Password: "p", SSLMode: "disable"}

	if got := cfg.MigrationDSN(); !strings.HasPrefix(got, "pgx5://") {
		t.Fatalf("MigrationDSN = %q, ожидался префикс pgx5://", got)
	}
	if strings.TrimPrefix(cfg.MigrationDSN(), "pgx5") != strings.TrimPrefix(cfg.DSN(), "postgres") {
		t.Fatal("MigrationDSN разошёлся с DSN: адрес миграций и рантайма обязан совпадать")
	}
}
