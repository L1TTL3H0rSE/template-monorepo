package middlewares

import (
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"starter/kit/ginx"
)

// ZapAccessLog пишет одну структурированную строку на запрос.
//
// Используется вместо gin.Default(): встроенный логгер gin дублирует эту запись
// и не является JSON, поэтому NewEngine собирает движок через gin.New().
func ZapAccessLog(log *zap.Logger) gin.HandlerFunc {
	if log == nil {
		log = zap.NewNop()
	}

	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		fields := []zap.Field{
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", c.Writer.Status()),
			zap.Duration("latency", time.Since(start)),
			zap.String("client_ip", c.ClientIP()),
			zap.String("request_id", c.Writer.Header().Get(ginx.HeaderRequestID)),
		}
		if userID := c.GetHeader(ginx.HeaderUserID); userID != "" {
			fields = append(fields, zap.String("user_id", userID))
		}
		if len(c.Errors) > 0 {
			fields = append(fields, zap.String("errors", c.Errors.String()))
		}

		switch {
		case c.Writer.Status() >= 500:
			log.Error("http request", fields...)
		case c.Writer.Status() >= 400:
			log.Warn("http request", fields...)
		default:
			log.Info("http request", fields...)
		}
	}
}
