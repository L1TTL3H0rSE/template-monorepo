package middlewares

import (
	"fmt"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"starter/kit/ginx"
	"starter/kit/ratelimiter"
)

// RateLimit ограничивает запросы после успешной аутентификации.
//
// Ключ — UUID пользователя из доверенного контекста, иначе IP. Если общий лимит
// уже применил gateway (X-Gateway-RateLimit-Applied), сервис не расходует тот
// же лимит повторно и не добавляет дублирующие заголовки X-RateLimit-*.
//
// Ошибка хранилища лимитера обрабатывается fail-open: запрос проходит, в лог
// уходит предупреждение. Отказ в обслуживании из-за сбоя вспомогательного
// хранилища дороже, чем разовое превышение лимита.
func RateLimit(limiter ratelimiter.RateLimiter, log *zap.Logger) gin.HandlerFunc {
	if log == nil {
		log = zap.NewNop()
	}

	return func(c *gin.Context) {
		if limiter == nil || c.GetHeader(ginx.HeaderGatewayRateLimited) == "true" {
			c.Next()
			return
		}

		parser := ginx.NewGinxParser(c)
		key := "ip:" + c.ClientIP()
		if parser.IsAuthenticated() {
			key = "user:" + parser.UserContext.ID.String()
		}

		result, err := limiter.Allow(c.Request.Context(), key)
		if err != nil {
			log.Warn("rate limiter unavailable, allowing request",
				zap.String("key", key), zap.Error(err))
			c.Next()
			return
		}

		c.Writer.Header().Set(ginx.HeaderRateLimitLimit, strconv.Itoa(result.Limit))
		c.Writer.Header().Set(ginx.HeaderRateLimitRemaining, strconv.Itoa(result.Remaining))
		c.Writer.Header().Set(ginx.HeaderRateLimitReset, strconv.FormatInt(result.ResetAt.Unix(), 10))

		if !result.Allowed {
			retryAfter := time.Until(result.ResetAt)
			if retryAfter > 0 {
				c.Writer.Header().Set(ginx.HeaderRetryAfter,
					fmt.Sprintf("%d", int(retryAfter.Seconds())+1))
			}
			ginx.WriteErrorResponse(c, ginx.TooManyRequests)
			return
		}

		c.Next()
	}
}
