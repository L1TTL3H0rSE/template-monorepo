package ginx

import (
	"errors"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"starter/kit/errorsx"
)

// WriteDomainError переводит категорию доменной ошибки (errorsx.Err*) в
// стандартный HTTP-ответ.
//
// Это единственный способ отдать доменную ошибку наружу. Сервис не заводит
// собственную таблицу «ошибка -> статус» и собственный internal/infra/httperr:
// категории живут в одном месте, поэтому один и тот же сценарий даёт один и тот
// же статус во всех сервисах.
//
// Ошибка вне известных категорий — 500 с generic телом и причиной в логе.
func WriteDomainError(c *gin.Context, log *zap.Logger, err error) {
	switch {
	case errors.Is(err, errorsx.ErrNotFound):
		WriteErrorResponse(c, NotFound)
	case errors.Is(err, errorsx.ErrValidation):
		WriteErrorResponse(c, BadRequest)
	case errors.Is(err, errorsx.ErrConflict):
		WriteErrorResponse(c, Conflict)
	case errors.Is(err, errorsx.ErrForbidden):
		WriteErrorResponse(c, Forbidden)
	case errors.Is(err, errorsx.ErrRateLimited):
		WriteErrorResponse(c, TooManyRequests)
	case errors.Is(err, errorsx.ErrUnavailable):
		WriteErrorResponse(c, ServiceUnavailable)
	default:
		WriteInternalErrorWithErr(c, log, "unhandled domain error", err)
	}
}
