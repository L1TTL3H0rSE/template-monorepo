package postgres

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/ilyakaznacheev/cleanenv"
)

// Блок конфигурации в той же форме, в какой его встраивает сервис.
type envConfig struct {
	Database Config `env-prefix:"DB_"`
}

// load повторяет путь загрузки сервиса: теги заполняются из окружения, затем
// значения проверяются. Именно эта пара и есть контракт, а не одни теги.
func load(t *testing.T) (*envConfig, error) {
	t.Helper()

	cfg := &envConfig{}
	if err := cleanenv.ReadEnv(cfg); err != nil {
		return cfg, err
	}

	return cfg, cfg.Database.Validate()
}

// Имя базы обязано быть задано ЗНАЧИМЫМ: `postgres` — действующая служебная
// база кластера, и всё, что не даёт явного имени, увело бы миграции и записи
// туда молча и успешно.
//
// Пустая строка проверяется отдельно от отсутствия переменной намеренно:
// `env-required` эти два случая различает и второй пропускает, поэтому тегом
// инвариант не выражается.
func TestNameMustBeMeaningful(t *testing.T) {
	// Регистрирует восстановление окружения; значение снимается ниже.
	t.Setenv("DB_NAME", "placeholder")

	for _, tc := range []struct {
		name  string
		value string
		unset bool
	}{
		{name: "переменной нет", unset: true},
		{name: "пустая строка", value: ""},
		{name: "только пробелы", value: "   "},
		{name: "табуляция и перевод строки", value: "\t\n"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if tc.unset {
				os.Unsetenv("DB_NAME")
			} else {
				t.Setenv("DB_NAME", tc.value)
			}

			if _, err := load(t); err == nil {
				t.Fatal("конфигурация загрузилась: сервис ушёл бы в служебную базу postgres")
			}
		})
	}

	t.Run("настоящее имя проходит", func(t *testing.T) {
		t.Setenv("DB_NAME", "service")

		cfg, err := load(t)
		if err != nil {
			t.Fatalf("конфигурация с DB_NAME не загрузилась: %v", err)
		}
		if cfg.Database.Name != "service" {
			t.Fatalf("Name = %q, ожидалось service", cfg.Database.Name)
		}
	})
}

// Каждая публичная операция, самостоятельно пересекающая границу БД, обязана
// проверять инвариант САМА.
//
// Порядок вызовов гарантией не является: RunMigrations публичен, и команде,
// которой нужны только миграции, пул не нужен — Connect она не вызовет. Если
// проверка живёт лишь в Connect, общий адаптер по-прежнему разрешает тот самый
// молчаливый уход в служебную базу postgres, ради которого её и добавляли.
//
// Живая БД не нужна: красный ответ приходит раньше сетевых действий. Каталог
// миграций существует намеренно — иначе тест был бы зелёным из-за отсутствия
// файлов, а не из-за проверки имени.
func TestPublicOperationsRejectEmptyName(t *testing.T) {
	dir := t.TempDir()

	operations := []struct {
		name string
		run  func(*Adapter) error
	}{
		{"Connect", func(a *Adapter) error { return a.Connect(context.Background()) }},
		{"RunMigrations", func(a *Adapter) error { return a.RunMigrations(context.Background(), dir) }},
	}

	for _, operation := range operations {
		for _, name := range []string{"", "   ", "\t\n"} {
			t.Run(fmt.Sprintf("%s/%q", operation.name, name), func(t *testing.T) {
				adapter := NewAdapter(&Config{Host: "localhost", Port: 5432, Name: name}, nil)

				err := operation.run(adapter)
				if err == nil {
					t.Fatalf("%s принял конфигурацию без имени базы", operation.name)
				}
				if !strings.Contains(err.Error(), "DB_NAME") {
					t.Fatalf("ошибка не называет причину: %v", err)
				}
			})
		}
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
