package ginx

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Машиночитаемые коды ошибок API. Клиент ветвится по Code, а не по тексту.
const (
	ErrCodeInternal       = "INTERNAL_ERROR"
	ErrCodeUnauthorized   = "UNAUTHORIZED"
	ErrCodeForbidden      = "FORBIDDEN"
	ErrCodeBadRequest     = "BAD_REQUEST"
	ErrCodeNotFound       = "NOT_FOUND"
	ErrCodeConflict       = "CONFLICT"
	ErrCodeUnavailable    = "SERVICE_UNAVAILABLE"
	ErrCodeTooManyRequest = "TOO_MANY_REQUESTS"
)

const (
	ErrMsgInternal        = "Internal server error"
	ErrMsgUnauthorized    = "Unauthorized"
	ErrMsgForbidden       = "Forbidden"
	ErrMsgBadRequest      = "Bad request"
	ErrMsgNotFound        = "Not found"
	ErrMsgConflict        = "Conflict"
	ErrMsgUnavailable     = "Service unavailable"
	ErrMsgTooManyRequests = "Too many requests"
)

// GinxError — готовая пара «HTTP-статус + тело ответа».
type GinxError struct {
	StatusCode int
	Response   ErrorResponse
}

func NewGinxError(statusCode int, response ErrorResponse) *GinxError {
	return &GinxError{StatusCode: statusCode, Response: response}
}

// Канонический набор ответов. Сервис не создаёт свои копии этих значений.
var (
	InternalServerError = NewGinxError(http.StatusInternalServerError, NewErrorResponseWithCode(ErrMsgInternal, ErrCodeInternal))
	Unauthorized        = NewGinxError(http.StatusUnauthorized, NewErrorResponseWithCode(ErrMsgUnauthorized, ErrCodeUnauthorized))
	Forbidden           = NewGinxError(http.StatusForbidden, NewErrorResponseWithCode(ErrMsgForbidden, ErrCodeForbidden))
	BadRequest          = NewGinxError(http.StatusBadRequest, NewErrorResponseWithCode(ErrMsgBadRequest, ErrCodeBadRequest))
	NotFound            = NewGinxError(http.StatusNotFound, NewErrorResponseWithCode(ErrMsgNotFound, ErrCodeNotFound))
	Conflict            = NewGinxError(http.StatusConflict, NewErrorResponseWithCode(ErrMsgConflict, ErrCodeConflict))
	ServiceUnavailable  = NewGinxError(http.StatusServiceUnavailable, NewErrorResponseWithCode(ErrMsgUnavailable, ErrCodeUnavailable))
	TooManyRequests     = NewGinxError(http.StatusTooManyRequests, NewErrorResponseWithCode(ErrMsgTooManyRequests, ErrCodeTooManyRequest))
)

// WriteInternalErrorWithErr отдаёт клиенту generic 500, а причину оставляет в
// логе: текст внутренней ошибки наружу не уходит.
func WriteInternalErrorWithErr(c *gin.Context, log *zap.Logger, message string, err error) {
	if log != nil {
		log.Error(message,
			zap.Error(err),
			zap.String("path", c.FullPath()),
			zap.String("request_id", c.GetHeader(HeaderRequestID)),
		)
	}
	WriteErrorResponse(c, InternalServerError)
}
