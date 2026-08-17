package middlewares

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"roleplay/kit/ginx"
)

// GatewayUserContext собирает доверенный контекст пользователя из заголовков
// X-User-*, которые выставляет gateway после проверки токена.
//
// Middleware ничего не запрещает: неаутентифицированный запрос просто получает
// пустой контекст. Закрывает маршрут GatewayRequireAuth.
func GatewayUserContext() gin.HandlerFunc {
	return func(c *gin.Context) {
		userContext := &ginx.GinxUserContext{Roles: []string{}, Groups: []string{}}

		if rawID := c.GetHeader(ginx.HeaderUserID); rawID != "" {
			if parsed, err := uuid.Parse(rawID); err == nil {
				userContext.Authenticated = true
				userContext.ID = parsed
			}
		}

		userContext.Roles = splitHeaderList(c.GetHeader(ginx.HeaderUserRoles))
		userContext.Groups = splitHeaderList(c.GetHeader(ginx.HeaderUserGroups))
		userContext.Email = c.GetHeader(ginx.HeaderUserEmail)
		userContext.Username = c.GetHeader(ginx.HeaderUserUsername)
		userContext.FirstName = c.GetHeader(ginx.HeaderUserFirstName)
		userContext.LastName = c.GetHeader(ginx.HeaderUserLastName)
		userContext.Patronymic = c.GetHeader(ginx.HeaderUserPatronymic)

		ginx.WriteGinxContext(c, userContext)
		c.Next()
	}
}

func splitHeaderList(raw string) []string {
	if raw == "" {
		return []string{}
	}

	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			result = append(result, trimmed)
		}
	}

	return result
}
