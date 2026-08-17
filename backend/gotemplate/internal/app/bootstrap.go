package app

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"roleplay/gotemplate/config"
	"roleplay/gotemplate/internal/query"
	"roleplay/kit/adapters/postgres"
	"roleplay/kit/bootstrap"
	"roleplay/kit/pglock"
)

// seedNames — корневые данные, без которых стенд неработоспособен.
//
// Здесь перечисляется МИНИМУМ: то, на что опирается сама система (корневая
// роль, системное подразделение, служебная учётка). Демонстрационные данные
// для скриншотов сюда не входят — они живут в отдельном наборе фикстур и не
// должны попадать в production.
var seedNames = []string{
	"Root example",
}

// Bootstrap засевает корневые данные сервиса и завершается.
//
// Три обязательных свойства, каждое из которых проверяется на практике первым
// же повторным запуском:
//
//  1. Идемпотентность. Повторный запуск не создаёт дубликатов и не падает.
//  2. Завершаемость. Команда не поднимает HTTP и не остаётся висеть: в compose
//     она выполняется как init-контейнер до старта сервиса.
//  3. Обход проверки доступа. Запись идёт напрямую через слой хранилища —
//     именно это разрывает циклическую зависимость прав.
//
// Взаимное исключение — через advisory lock: при подъёме нескольких реплик
// одновременно засев выполнит ровно одна, остальные корректно выйдут.
func Bootstrap(ctx context.Context) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("config: %w", err)
	}

	foundations, err := bootstrap.Init(ctx, "gotemplate-bootstrap", cfg.Common)
	if err != nil {
		return err
	}
	log := foundations.Zap()

	pg := postgres.NewAdapter(&cfg.Database, log)
	if err := pg.Connect(ctx); err != nil {
		return fmt.Errorf("postgres: %w", err)
	}
	defer pg.Close()

	// Миграции применяются и здесь: bootstrap может выполняться раньше, чем
	// поднялся сам сервис, и обязан работать на чистой БД.
	if err := pg.RunMigrations(ctx, "migrations"); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}

	acquired, err := pglock.TryWithinTx(ctx, pg.Pool(), "gotemplate:bootstrap",
		func(ctx context.Context, tx pgx.Tx) error {
			return seed(ctx, query.New(tx), log)
		})
	if err != nil {
		return fmt.Errorf("seed: %w", err)
	}
	if !acquired {
		// Не ошибка: засев выполняет соседняя реплика. Выходим с нулевым
		// кодом, иначе подъём стенда упадёт на гонке, которой нет.
		log.Info("bootstrap skipped: lock held by another instance")
		return nil
	}

	log.Info("bootstrap complete")

	return nil
}

// seed выполняет засев внутри уже открытой транзакции.
//
// Проверка «есть ли уже» и вставка живут в ОДНОЙ транзакции под блокировкой:
// без этого два параллельных запуска оба увидят пустую выборку и оба вставят.
func seed(ctx context.Context, q query.Querier, log *zap.Logger) error {
	for _, name := range seedNames {
		existing, err := q.CountExamplesByName(ctx, name)
		if err != nil {
			return fmt.Errorf("count %q: %w", name, err)
		}
		if existing > 0 {
			log.Debug("seed entry already present", zap.String("name", name))
			continue
		}

		row, err := q.CreateExample(ctx, name)
		if err != nil {
			return fmt.Errorf("create %q: %w", name, err)
		}
		log.Info("seed entry created",
			zap.String("name", name), zap.String("id", row.ID.String()))
	}

	return nil
}
