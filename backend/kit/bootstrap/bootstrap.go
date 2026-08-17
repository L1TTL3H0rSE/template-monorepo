// Package bootstrap строит примитивы, нужные каждому сервису — логгер, кеш,
// rate limiter — из одного встроенного блока конфигурации.
//
// Это заменяет 40 строк одинаковой обвязки, скопированных в app.go каждого
// сервиса. Новый общий примитив добавляется сюда, а не в отдельный сервис.
package bootstrap

import (
	"context"
	"fmt"

	"go.uber.org/zap"

	"roleplay/kit/cache"
	"roleplay/kit/logger"
	"roleplay/kit/ratelimiter"
	"roleplay/kit/runtime"
)

// Common — блоки конфигурации, общие для всех сервисов. Встраивается в Config
// сервиса, чтобы загрузчик заполнил их из стандартных префиксов.
type Common struct {
	Logging   logger.Config      `env-prefix:"LOG_"`
	Cache     cache.Config       `env-prefix:"CACHE_"`
	RateLimit ratelimiter.Config `env-prefix:"RATELIMIT_"`
}

// Foundations — построенные общие примитивы. RateLimiter равен nil, когда
// лимитер выключен конфигурацией.
type Foundations struct {
	Logger      *logger.Logger
	Cache       cache.Cache
	RateLimiter ratelimiter.RateLimiter
}

// Init строит logger -> cache -> rate limiter (опционально).
func Init(ctx context.Context, serviceName string, cfg Common) (*Foundations, error) {
	log, err := logger.New(cfg.Logging)
	if err != nil {
		return nil, fmt.Errorf("logger: %w", err)
	}
	log.Zap().Info("initializing service", zap.String("service", serviceName))

	sharedCache := cache.NewMemory(ctx, cfg.Cache)

	var limiter ratelimiter.RateLimiter
	if cfg.RateLimit.Enabled {
		limiter, err = ratelimiter.New(cache.Namespaced(sharedCache, "ratelimit:"), cfg.RateLimit)
		if err != nil {
			return nil, fmt.Errorf("ratelimiter: %w", err)
		}
	}

	return &Foundations{Logger: log, Cache: sharedCache, RateLimiter: limiter}, nil
}

// Zap — сокращение для доступа к *zap.Logger.
func (f *Foundations) Zap() *zap.Logger { return f.Logger.Zap() }

// RegisterClosers регистрирует закрытие общих ресурсов. Вызывается ДО добавления
// closers самого сервиса (БД, соединение с брокером): при обратном порядке
// закрытия ресурсы сервиса закроются первыми, общие — последними.
func (f *Foundations) RegisterClosers(rt *runtime.Runtime) {
	rt.AddCloser(runtime.CloserFunc("logger", func(context.Context) error {
		// Sync на stderr возвращает ошибку на части платформ; она не значима
		// для завершения процесса.
		_ = f.Logger.Sync()
		return nil
	}))
}
