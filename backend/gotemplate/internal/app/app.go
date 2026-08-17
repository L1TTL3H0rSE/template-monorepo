package app

import (
	"context"
	"fmt"

	"roleplay/gotemplate/config"
	httpinfra "roleplay/gotemplate/internal/infra/http"
	examplesvc "roleplay/gotemplate/internal/infra/services/example"
	"roleplay/gotemplate/internal/query"
	"roleplay/kit/adapters/postgres"
	"roleplay/kit/bootstrap"
	"roleplay/kit/runtime"
)

// Run — composition root сервиса и единственное место, где создаются
// зависимости: загрузить конфигурацию, построить общие примитивы, связать
// доменные зависимости, затем блокироваться до отмены контекста и остановить
// всё в обратном порядке.
//
// Ни один другой пакет не вызывает конструкторы соседних слоёв: хендлер не
// создаёт сервис, сервис не открывает соединение с БД.
func Run(ctx context.Context) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("config: %w", err)
	}

	foundations, err := bootstrap.Init(ctx, "gotemplate", cfg.Common)
	if err != nil {
		return err
	}
	log := foundations.Zap()

	pg := postgres.NewAdapter(&cfg.Database, log)
	if err := pg.Connect(ctx); err != nil {
		return fmt.Errorf("postgres: %w", err)
	}
	if err := pg.RunMigrations(ctx, "migrations"); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}

	// Сервис получает сгенерированный query.Querier напрямую: он же является
	// тестовым швом, поэтому рукописный repository/store не нужен.
	exampleService := examplesvc.New(query.New(pg.Pool()), log)

	httpServer := httpinfra.NewServer(&cfg.Server, httpinfra.Deps{
		Logger:      log,
		RateLimiter: foundations.RateLimiter,
		Example:     exampleService,
	})

	rt := runtime.New(runtime.WithLogger(log))
	rt.Add(runtime.InfraComponent("http", httpServer))

	// Порядок важен: общие closers регистрируются первыми, ресурсы сервиса —
	// после них, поэтому при обратном закрытии пул БД уходит раньше логгера.
	foundations.RegisterClosers(rt)
	rt.AddCloser(runtime.CloserFunc("postgres", func(context.Context) error {
		pg.Close()
		return nil
	}))

	return rt.Run(ctx)
}
