// Package runtime — небольшой оркестратор жизненного цикла сервиса.
//
// Runtime владеет набором долгоживущих Component (стартуют в порядке
// регистрации, останавливаются в обратном) и Closer'ов только на закрытие
// (закрываются в обратном порядке после остановки всех компонентов).
//
// Run блокируется до отмены контекста или первой ошибки компонента, затем
// выполняет graceful shutdown в обратном порядке и агрегирует все ошибки через
// errors.Join.
package runtime

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Component — долгоживущая единица работы с graceful shutdown.
type Component interface {
	Name() string
	// Start блокируется до выхода компонента или отмены ctx. Runtime запускает
	// каждый Start в своей горутине; ненулевой возврат роняет весь Runtime.
	Start(ctx context.Context) error
	// Stop вызывается в обратном порядке регистрации.
	Stop(ctx context.Context) error
}

// Closer — ресурс без фазы старта (пул БД, соединение с брокером, трассировка).
type Closer interface {
	Name() string
	Close(ctx context.Context) error
}

type Runtime struct {
	log             *zap.Logger
	components      []Component
	closers         []Closer
	shutdownTimeout time.Duration
}

type Option func(*Runtime)

// WithShutdownTimeout ограничивает фазу graceful shutdown. По умолчанию 30s.
func WithShutdownTimeout(d time.Duration) Option {
	return func(r *Runtime) {
		if d > 0 {
			r.shutdownTimeout = d
		}
	}
}

func WithLogger(l *zap.Logger) Option {
	return func(r *Runtime) {
		if l != nil {
			r.log = l
		}
	}
}

func New(opts ...Option) *Runtime {
	r := &Runtime{log: zap.NewNop(), shutdownTimeout: 30 * time.Second}
	for _, opt := range opts {
		opt(r)
	}

	return r
}

func (r *Runtime) Add(c Component) *Runtime {
	if c != nil {
		r.components = append(r.components, c)
	}

	return r
}

func (r *Runtime) AddCloser(c Closer) *Runtime {
	if c != nil {
		r.closers = append(r.closers, c)
	}

	return r
}

// Run стартует все компоненты и блокируется до отмены ctx или первой ошибки.
func (r *Runtime) Run(ctx context.Context) error {
	runCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	failures := make(chan error, len(r.components))
	var wg sync.WaitGroup

	for _, component := range r.components {
		wg.Add(1)
		go func(c Component) {
			defer wg.Done()

			r.log.Info("component starting", zap.String("component", c.Name()))
			if err := c.Start(runCtx); err != nil {
				failures <- fmt.Errorf("component %s: %w", c.Name(), err)
				cancel()
			}
		}(component)
	}

	<-runCtx.Done()
	r.log.Info("shutdown initiated")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.WithoutCancel(ctx), r.shutdownTimeout)
	defer shutdownCancel()

	errs := make([]error, 0, len(r.components)+len(r.closers))

	for i := len(r.components) - 1; i >= 0; i-- {
		component := r.components[i]
		if err := component.Stop(shutdownCtx); err != nil {
			errs = append(errs, fmt.Errorf("stop %s: %w", component.Name(), err))
		}
	}

	wg.Wait()
	close(failures)
	for err := range failures {
		errs = append(errs, err)
	}

	for i := len(r.closers) - 1; i >= 0; i-- {
		closer := r.closers[i]
		if err := closer.Close(shutdownCtx); err != nil {
			errs = append(errs, fmt.Errorf("close %s: %w", closer.Name(), err))
		}
	}

	r.log.Info("shutdown complete")

	return errors.Join(errs...)
}
