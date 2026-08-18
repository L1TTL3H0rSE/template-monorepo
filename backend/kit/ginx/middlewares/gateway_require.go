package middlewares

import (
	"github.com/gin-gonic/gin"

	"starter/kit/ginx"
)

// GatewayRequireAuth — единственное место проверки аутентификации во внутреннем
// сервисе. Ставится на группу роутера; в хендлерах не повторяется.
//
// Повторный p.IsAuthenticated() внутри хендлера запрещён: до него запрос не
// доходит, зато он маскирует отсутствие настоящей доменной авторизации.
// Вместо него сервис держит router_test.go, который перебирает все маршруты и
// падает, если маршрут отвечает не 401 без заголовков gateway.
func GatewayRequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		parser := ginx.NewGinxParser(c)
		if !parser.IsAuthenticated() {
			ginx.WriteErrorResponse(c, ginx.Unauthorized)
			return
		}

		c.Next()
	}
}

// GatewayRequireRole проверяет realm-роль из доверенного контекста.
//
// Это НЕ доменная авторизация: роль описывает, кем пользователь является в
// Keycloak, а не что ему разрешено с конкретным объектом. Привилегированное
// действие проверяется владельцем ресурса — см. docs/backend/http.md.
func GatewayRequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		parser := ginx.NewGinxParser(c)
		for _, granted := range parser.UserContext.Roles {
			if granted == role {
				c.Next()
				return
			}
		}

		ginx.WriteErrorResponse(c, ginx.Forbidden)
	}
}
