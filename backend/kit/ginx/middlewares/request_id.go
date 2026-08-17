package middlewares

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"roleplay/kit/ginx"
)

// RequestID гарантирует наличие X-Request-ID у каждого запроса и возвращает его
// в ответе. Идентификатор, пришедший от gateway, сохраняется: он связывает
// запись во всех сервисах, через которые прошёл один пользовательский запрос.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader(ginx.HeaderRequestID)
		if requestID == "" {
			requestID = uuid.NewString()
			c.Request.Header.Set(ginx.HeaderRequestID, requestID)
		}

		c.Writer.Header().Set(ginx.HeaderRequestID, requestID)
		c.Next()
	}
}
