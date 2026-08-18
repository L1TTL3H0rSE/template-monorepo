package runtime

import (
	"context"

	"starter/kit/infra"
)

// InfraComponent адаптирует infra.InfrastructureService (Start /
// GracefulShutdown) в Component, поэтому HTTP- и очередная инфраструктура
// сервиса подключаются к Runtime без изменений.
func InfraComponent(name string, svc infra.InfrastructureService) Component {
	return infraComponent{name: name, svc: svc}
}

type infraComponent struct {
	name string
	svc  infra.InfrastructureService
}

func (c infraComponent) Name() string                    { return c.name }
func (c infraComponent) Start(ctx context.Context) error { return c.svc.Start(ctx) }
func (c infraComponent) Stop(ctx context.Context) error  { return c.svc.GracefulShutdown(ctx) }

// FuncComponent адаптирует пару start/stop для единиц, которые не реализуют
// InfrastructureService. nil-start блокируется до отмены контекста.
func FuncComponent(name string, start, stop func(context.Context) error) Component {
	return funcComponent{name: name, start: start, stop: stop}
}

type funcComponent struct {
	name  string
	start func(context.Context) error
	stop  func(context.Context) error
}

func (c funcComponent) Name() string { return c.name }

func (c funcComponent) Start(ctx context.Context) error {
	if c.start == nil {
		<-ctx.Done()
		return nil
	}

	return c.start(ctx)
}

func (c funcComponent) Stop(ctx context.Context) error {
	if c.stop == nil {
		return nil
	}

	return c.stop(ctx)
}

// CloserFunc адаптирует функцию закрытия в Closer.
func CloserFunc(name string, fn func(context.Context) error) Closer {
	return closerFunc{name: name, fn: fn}
}

type closerFunc struct {
	name string
	fn   func(context.Context) error
}

func (c closerFunc) Name() string { return c.name }

func (c closerFunc) Close(ctx context.Context) error {
	if c.fn == nil {
		return nil
	}

	return c.fn(ctx)
}
