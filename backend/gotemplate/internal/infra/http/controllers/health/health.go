package health

import (
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"starter/kit/ginx"
)

type Handler struct {
	log *zap.Logger
}

func NewHandler(log *zap.Logger) *Handler {
	if log == nil {
		log = zap.NewNop()
	}

	return &Handler{log: log}
}

// HealthResponse — форма ответа проверки состояния.
type HealthResponse struct {
	Status  string `json:"status" example:"ok"`
	Service string `json:"service" example:"gotemplate"`
}

// Health — публичный маршрут: он объявлен в publicRoutes теста роутера, поэтому
// добавление сюда авторизации сломает тест намеренно.
//
// @Summary  Проверка состояния сервиса
// @Tags     health
// @Produce  json
// @Success  200 {object} ginx.SuccessResponse[health.HealthResponse]
// @Router   /health [get]
func (h *Handler) Health(c *gin.Context) {
	ginx.WriteSuccessResponse(c, &HealthResponse{Status: "ok", Service: "gotemplate"})
}
