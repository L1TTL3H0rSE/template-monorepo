package ginx

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/form/v4"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"roleplay/kit/errorsx"
)

const userContextKey = "user_context"

var (
	defaultQueryDecoder = form.NewDecoder()
	defaultValidator    = validator.New()
)

// GinxUserContext — доверенный контекст пользователя, собранный middleware
// GatewayUserContext из заголовков X-User-*. Сервис не разбирает JWT сам.
type GinxUserContext struct {
	Authenticated bool
	ID            uuid.UUID
	Roles         []string
	Groups        []string
	Email         string
	Username      string
	FirstName     string
	LastName      string
	Patronymic    string
}

// GinxParser — единая точка разбора запроса: контекст пользователя, path, query
// и заголовки. Ручной c.Param + uuid.Parse в хендлере не используется.
type GinxParser struct {
	ctx *gin.Context

	UserContext *GinxUserContext
}

func WriteGinxContext(c *gin.Context, userContext *GinxUserContext) {
	c.Set(userContextKey, userContext)
}

func NewGinxParser(c *gin.Context) *GinxParser {
	stored, exists := c.Get(userContextKey)
	if !exists {
		stored = &GinxUserContext{Roles: []string{}, Groups: []string{}}
	}

	return &GinxParser{ctx: c, UserContext: stored.(*GinxUserContext)}
}

func (p *GinxParser) GetUserContext() *GinxUserContext { return p.UserContext }

// IsAuthenticated нужен ТОЛЬКО хендлеру, который сам выводит субъекта из
// контекста (например /me). На обычном защищённом маршруте аутентификацию
// проверяет GatewayRequireAuth на группе роутера; повторная проверка в хендлере
// запрещена — см. docs/backend/http.md.
func (p *GinxParser) IsAuthenticated() bool { return p.UserContext.Authenticated }

func (p *GinxParser) GetAuthorizationHeader() string { return p.ctx.GetHeader(HeaderAuthorization) }
func (p *GinxParser) GetRequestIDHeader() string     { return p.ctx.GetHeader(HeaderRequestID) }
func (p *GinxParser) GetUserIDHeader() string        { return p.ctx.GetHeader(HeaderUserID) }

// --- path ---

func (p *GinxParser) GetPathString(key string) (*string, error) {
	value := p.ctx.Param(key)
	if value == "" {
		return nil, errorsx.ErrPathNotFound
	}
	return &value, nil
}

func (p *GinxParser) GetPathUUID(key string) (*uuid.UUID, error) {
	raw, err := p.GetPathString(key)
	if err != nil {
		return nil, err
	}
	parsed, err := uuid.Parse(*raw)
	if err != nil {
		return nil, errorsx.ErrPathInvalid
	}
	return &parsed, nil
}

func (p *GinxParser) GetPathInt(key string) (*int, error) {
	raw, err := p.GetPathString(key)
	if err != nil {
		return nil, err
	}
	parsed, err := strconv.Atoi(*raw)
	if err != nil {
		return nil, errorsx.ErrPathInvalid
	}
	return &parsed, nil
}

// --- query ---

// GetQueryString оставляется для одиночного параметра. Набор из двух и более
// параметров разбирается структурой через ParseQuery.
func (p *GinxParser) GetQueryString(key string) (*string, error) {
	value := p.ctx.Query(key)
	if value == "" {
		return nil, errorsx.ErrQueryNotFound
	}
	return &value, nil
}

func (p *GinxParser) GetQueryInt(key string) (*int, error) {
	raw, err := p.GetQueryString(key)
	if err != nil {
		return nil, err
	}
	parsed, err := strconv.Atoi(*raw)
	if err != nil {
		return nil, errorsx.ErrQueryInvalid
	}
	return &parsed, nil
}

func (p *GinxParser) GetQueryUUID(key string) (*uuid.UUID, error) {
	raw, err := p.GetQueryString(key)
	if err != nil {
		return nil, err
	}
	parsed, err := uuid.Parse(*raw)
	if err != nil {
		return nil, errorsx.ErrQueryInvalid
	}
	return &parsed, nil
}

// ParseQuery разбирает всю query-строку в одну структуру с тегами form и
// validate. Это канонический способ: он держит значения по умолчанию, лимиты и
// валидацию рядом с формой, а не размазывает их по хендлеру.
//
//	type CharacterSearchQuery struct {
//	    Q    string `form:"q"    validate:"omitempty,max=100"`
//	    From int    `form:"from" validate:"gte=0"`
//	    Size int    `form:"size" validate:"gte=1,lte=100"`
//	}
func ParseQuery[T any](c *gin.Context) (*T, error) {
	var target T

	if err := defaultQueryDecoder.Decode(&target, c.Request.URL.Query()); err != nil {
		return nil, errorsx.ErrQueryInvalid
	}
	if err := defaultValidator.Struct(&target); err != nil {
		return nil, errorsx.ErrQueryInvalid
	}

	return &target, nil
}
