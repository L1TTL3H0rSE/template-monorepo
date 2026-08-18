package http

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"

	"starter/kit/infra"
	kithttp "starter/kit/infra/http"
)

// @title       Starter gotemplate API
// @version     1.0
// @description Эталонный микросервис шаблона.

// @host     localhost:8080
// @BasePath /

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Токен проверяет API-гейтвей. Во внутренний сервис приходит уже
// доверенный контекст пользователя в заголовках X-User-*.

// HTTPService реализует infra.InfrastructureService, поэтому подключается к
// runtime.Runtime без адаптера в сервисе.
type HTTPService struct {
	address string
	server  *http.Server
}

func NewServer(cfg *kithttp.Config, deps Deps) infra.InfrastructureService {
	address := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)

	return &HTTPService{
		address: address,
		server: &http.Server{
			Addr:         address,
			ReadTimeout:  cfg.ReadTimeout,
			WriteTimeout: cfg.WriteTimeout,
			IdleTimeout:  cfg.IdleTimeout,
			Handler:      NewRouter(deps),
		},
	}
}

func (s *HTTPService) Start(_ context.Context) error {
	// Listen отдельно от Serve: ошибка занятого порта должна упасть на старте,
	// а не остаться внутри горутины.
	listener, err := net.Listen("tcp", s.address)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", s.address, err)
	}

	if err := s.server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}

	return nil
}

func (s *HTTPService) GracefulShutdown(ctx context.Context) error {
	return s.server.Shutdown(ctx)
}
