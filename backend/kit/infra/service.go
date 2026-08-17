package infra

import "context"

// InfrastructureService описывает жизненный цикл инфраструктурного сервиса
// (HTTP-сервер, потребитель очереди, планировщик) с graceful shutdown.
//
// Start блокируется до остановки компонента или отмены контекста.
type InfrastructureService interface {
	Start(ctx context.Context) error
	GracefulShutdown(ctx context.Context) error
}
