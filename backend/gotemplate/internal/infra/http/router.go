package http

import (
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	examplectrl "starter/gotemplate/internal/infra/http/controllers/example"
	healthctrl "starter/gotemplate/internal/infra/http/controllers/health"
	examplesvc "starter/gotemplate/internal/infra/services/example"
	"starter/kit/ginx/middlewares"
	kithttp "starter/kit/infra/http"
	"starter/kit/ratelimiter"
)

// Deps — явный список зависимостей роутера. Хендлеры не достают ничего из
// глобального состояния: всё, что им нужно, перечислено здесь и приходит из
// composition root.
type Deps struct {
	Logger      *zap.Logger
	RateLimiter ratelimiter.RateLimiter
	Example     *examplesvc.Service
}

func NewRouter(deps Deps) *gin.Engine {
	router := kithttp.NewEngine(kithttp.RouterOptions{Logger: deps.Logger})

	exampleHandler := examplectrl.NewHandler(deps.Example, deps.Logger)
	healthHandler := healthctrl.NewHandler(deps.Logger)

	// Публичные маршруты. Их список продублирован в router_test.go: новый
	// публичный маршрут требует осознанного изменения теста.
	router.GET("/health", healthHandler.Health)

	// GatewayRequireAuth — единственное место проверки аутентификации.
	// В хендлерах она не повторяется, а router_test.go падает, если появился
	// маршрут мимо этой группы.
	api := router.Group("/api/v1")
	api.Use(middlewares.GatewayRequireAuth())
	if deps.RateLimiter != nil {
		api.Use(middlewares.RateLimit(deps.RateLimiter, deps.Logger))
	}
	{
		api.GET("/example", exampleHandler.Search)
		api.POST("/example", exampleHandler.Create)
		api.GET("/example/:id", exampleHandler.GetByID)
		api.PATCH("/example/:id", exampleHandler.Update)
		api.DELETE("/example/:id", exampleHandler.Delete)
	}

	return router
}
