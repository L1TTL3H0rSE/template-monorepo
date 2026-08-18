package http

import (
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"starter/kit/ginx/middlewares"
)

// RouterOptions настраивает стандартный движок gin.
type RouterOptions struct {
	// Logger получает одну структурированную строку на запрос. nil — no-op.
	Logger *zap.Logger
	// TraceMiddleware вставляется сразу после Recovery, если задан. Так kit не
	// зависит от конкретной библиотеки трассировки, но владеет порядком
	// middleware.
	TraceMiddleware gin.HandlerFunc
}

// NewEngine возвращает gin.Engine со стандартной цепочкой middleware:
//
//	Recovery -> [trace] -> RequestID -> ZapAccessLog -> GatewayUserContext
//
// Используется gin.New(), а не gin.Default(): дефолтный логгер gin дублирует
// ZapAccessLog и не является JSON.
//
// Аутентификацию и rate limit движок НЕ включает: они ставятся вызывающим на
// конкретную группу маршрутов, потому что публичные маршруты (/health, /docs)
// существуют в каждом сервисе.
func NewEngine(opts RouterOptions) *gin.Engine {
	log := opts.Logger
	if log == nil {
		log = zap.NewNop()
	}

	engine := gin.New()
	engine.Use(gin.Recovery())
	if opts.TraceMiddleware != nil {
		engine.Use(opts.TraceMiddleware)
	}
	engine.Use(middlewares.RequestID())
	engine.Use(middlewares.ZapAccessLog(log))
	engine.Use(middlewares.GatewayUserContext())

	return engine
}
