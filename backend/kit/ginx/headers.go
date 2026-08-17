package ginx

// Заголовки, которыми пользуется middleware kit.
//
// X-User-* выставляет gateway ПОСЛЕ проверки токена и удаления Authorization.
// Внутренний сервис доверяет им и не проверяет bearer-токен самостоятельно —
// см. docs/backend/http.md.
const (
	HeaderAuthorization = "Authorization"

	HeaderRequestID          = "X-Request-ID"
	HeaderGatewayRequest     = "X-Gateway-Request"
	HeaderGatewayRateLimited = "X-Gateway-RateLimit-Applied"

	HeaderUserID         = "X-User-ID"
	HeaderUserRoles      = "X-User-Roles"
	HeaderUserGroups     = "X-User-Groups"
	HeaderUserEmail      = "X-User-Email"
	HeaderUserUsername   = "X-User-Username"
	HeaderUserFirstName  = "X-User-First-Name"
	HeaderUserLastName   = "X-User-Last-Name"
	HeaderUserPatronymic = "X-User-Patronymic"

	HeaderRateLimitLimit     = "X-RateLimit-Limit"
	HeaderRateLimitRemaining = "X-RateLimit-Remaining"
	HeaderRateLimitReset     = "X-RateLimit-Reset"
	HeaderRetryAfter         = "Retry-After"
)
