package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// publicRoutes — единственные маршруты, которым аутентификация не нужна.
// Список ведётся вручную: новый публичный маршрут требует осознанной правки.
var publicRoutes = map[string]bool{
	"GET /health": true,
}

// TestEveryAPIRouteRequiresAuth заменяет продублированную в каждом хендлере
// проверку IsAuthenticated: guard живёт на группе роутера, а тест падает, если
// появился маршрут мимо него.
//
// Это ключевой тест шаблона. Он ловит самый дорогой класс ошибки — маршрут,
// который случайно зарегистрировали вне защищённой группы, — и делает это без
// поднятия БД и без единого мока.
func TestEveryAPIRouteRequiresAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Нулевой Deps достаточно: до хендлеров запрос доходить не должен.
	router := NewRouter(Deps{})

	for _, route := range router.Routes() {
		if publicRoutes[route.Method+" "+route.Path] {
			continue
		}

		t.Run(route.Method+" "+route.Path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			// Запрос без доверенных заголовков гейтвея — неаутентифицированный.
			router.ServeHTTP(recorder, httptest.NewRequest(route.Method, concretePath(route.Path), nil))

			if recorder.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d, want %d (маршрут не закрыт GatewayRequireAuth)",
					recorder.Code, http.StatusUnauthorized)
			}
		})
	}
}

// TestPublicRoutesAreReachable — обратная сторона: публичный маршрут обязан
// отвечать без заголовков гейтвея.
func TestPublicRoutesAreReachable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := NewRouter(Deps{})

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/health", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("GET /health status = %d, want %d", recorder.Code, http.StatusOK)
	}
}

// concretePath подставляет значения вместо :param/*wildcard, чтобы попасть в
// маршрут.
func concretePath(pattern string) string {
	segments := strings.Split(pattern, "/")
	for i, segment := range segments {
		switch {
		case strings.HasPrefix(segment, ":"):
			segments[i] = "11111111-1111-1111-1111-111111111111"
		case strings.HasPrefix(segment, "*"):
			segments[i] = "any"
		}
	}

	return strings.Join(segments, "/")
}
