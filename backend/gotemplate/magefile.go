//go:build mage

// Magefile сервиса — единственный список канонических команд.
//
// Правило: команду, которую разработчик или CI выполняет больше одного раза,
// нельзя оставлять в README текстом. Она живёт здесь, поэтому её нельзя забыть
// обновить вместе с кодом.
package main

import (
	"fmt"
	"os"

	"github.com/magefile/mage/mg"
	"github.com/magefile/mage/sh"
)

type (
	Build    mg.Namespace
	Database mg.Namespace
	Generate mg.Namespace
	Dev      mg.Namespace
	Format   mg.Namespace
)

// dbURL берётся из окружения, чтобы локальные миграции шли в ту же БД, что и
// приложение. Хардкод строки подключения — источник расхождений.
func dbURL() string {
	if url := os.Getenv("MIGRATE_DATABASE_URL"); url != "" {
		return url
	}

	return "postgres://postgres:postgres@localhost:5432/gotemplate?sslmode=disable"
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
	return sh.Run("migrate", "-path", "migrations", "-database", dbURL(), "up")
}

// Down откатывает миграции.
func (Database) Down() error {
	return sh.Run("migrate", "-path", "migrations", "-database", dbURL(), "down")
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
func (Dev) Setup() error {
	tools := []string{
		"github.com/sqlc-dev/sqlc/cmd/sqlc@latest",
		"github.com/golang-migrate/migrate/v4/cmd/migrate@latest",
		"github.com/swaggo/swag/cmd/swag@latest",
	}

	for _, tool := range tools {
		fmt.Printf("installing %s...\n", tool)
		if err := sh.Run("go", "install", tool); err != nil {
			return fmt.Errorf("install %s: %w", tool, err)
		}
	}

	return nil
}

// Code форматирует исходники.
func (Format) Code() error {
	return sh.Run("go", "fmt", "./...")
}
