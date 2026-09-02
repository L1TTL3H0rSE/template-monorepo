//go:build mage

// Magefile сервиса — единственный список канонических команд.
//
// Правило: команду, которую разработчик или CI выполняет больше одного раза,
// нельзя оставлять в README текстом. Она живёт здесь, поэтому её нельзя забыть
// обновить вместе с кодом.
package main

import (
	"context"
	"fmt"

	"github.com/magefile/mage/mg"
	"github.com/magefile/mage/sh"

	"starter/kit/adapters/postgres"
	"starter/kit/configloader"
)

type (
	Build    mg.Namespace
	Database mg.Namespace
	Generate mg.Namespace
	Dev      mg.Namespace
	Format   mg.Namespace
)

// migrationConfig — конфигурация миграций: только блок БД.
//
// Это НЕ вторая конфигурация базы: тип, префикс переменных и сборка адреса —
// те же самые, из kit. Отличается только ширина: миграциям не нужны порт
// HTTP-сервера, лимитер, кеш и логирование, и падать из-за них они не должны.
type migrationConfig struct {
	Database postgres.Config `env-prefix:"DB_"`
}

// dbURL берёт адрес миграций из тех же переменных DB_*, что и приложение.
//
// Второй строки подключения в сервисе нет намеренно: захардкоженный DSN
// расходится с окружением молча, а `postgres` — действующая служебная база
// кластера, в которую миграции применились бы успешно и не туда.
//
// Схема — из kit: golang-migrate выбирает драйвер БД по схеме URL, и postgres
// увёл бы миграции на lib/pq, второй драйвер PostgreSQL рядом с pgx рантайма
// (MEM-006). CLI migrate ставится с тем же тегом — см. Dev.Setup.
func dbURL() (string, error) {
	cfg := migrationConfig{}
	if err := configloader.LoadEnv(context.Background(), "gotemplate", &cfg); err != nil {
		return "", err
	}

	// Пустое имя базы прошло бы загрузку и увело бы миграции в служебную базу.
	if err := cfg.Database.Validate(); err != nil {
		return "", err
	}

	return cfg.Database.MigrationDSN(), nil
}

// App собирает бинарь сервиса.
func (Build) App() error {
	fmt.Println("building application...")

	return sh.Run("go", "build", "-o", "bin/app", "./cmd/app")
}

// Test прогоняет все тесты модуля.
func Test() error {
	return sh.Run("go", "test", "./...")
}

// Lint — статический анализ.
func Lint() error {
	return sh.Run("go", "vet", "./...")
}

// Up применяет миграции.
func (Database) Up() error {
	url, err := dbURL()
	if err != nil {
		return err
	}

	return sh.Run("migrate", "-path", "migrations", "-database", url, "up")
}

// Down откатывает миграции.
func (Database) Down() error {
	url, err := dbURL()
	if err != nil {
		return err
	}

	return sh.Run("migrate", "-path", "migrations", "-database", url, "down")
}

// Create создаёт пару файлов новой миграции.
//
// Применённая миграция не переписывается: изменение схемы всегда добавляет
// следующую пару up/down.
func (Database) Create(name string) error {
	if name == "" {
		return fmt.Errorf("укажите имя: mage database:create <name>")
	}

	return sh.Run("migrate", "create", "-ext", "sql", "-dir", "migrations", "-seq", name)
}

// Sqlc перегенерирует internal/query из SQL и миграций.
func (Generate) Sqlc() error {
	fmt.Println("generating sqlc code...")

	return sh.Run("sqlc", "generate", "-f", "sqlc/sqlc.yaml")
}

// Swag перегенерирует Swagger-документацию из аннотаций хендлеров.
func (Generate) Swag() error {
	fmt.Println("generating swagger docs...")

	return sh.Run("swag", "init", "-g", "internal/infra/http/http.go", "-o", "docs", "--parseDependency")
}

// All перегенерирует весь производный код.
func (Generate) All() error {
	mg.Deps(Generate.Sqlc, Generate.Swag)

	return nil
}

// Setup ставит инструменты разработки.
//
// У migrate указан build tag: CLI golang-migrate собирает драйверы БД по
// тегам, и установка без них даёт бинарь, который на любой схеме URL
// отвечает «unknown driver ... (forgotten import?)». Тег pgx5 — тот же
// драйвер, что и в рантайме kit: иначе миграции и приложение работают
// через разные драйверы PostgreSQL.
func (Dev) Setup() error {
	type tool struct {
		pkg  string
		tags string
	}

	tools := []tool{
		{pkg: "github.com/sqlc-dev/sqlc/cmd/sqlc@latest"},
		{pkg: "github.com/golang-migrate/migrate/v4/cmd/migrate@latest", tags: "pgx5"},
		{pkg: "github.com/swaggo/swag/cmd/swag@latest"},
	}

	for _, t := range tools {
		fmt.Printf("installing %s...\n", t.pkg)

		args := []string{"install"}
		if t.tags != "" {
			args = append(args, "-tags", t.tags)
		}

		if err := sh.Run("go", append(args, t.pkg)...); err != nil {
			return fmt.Errorf("install %s: %w", t.pkg, err)
		}
	}

	return nil
}

// Code форматирует исходники.
func (Format) Code() error {
	return sh.Run("go", "fmt", "./...")
}
