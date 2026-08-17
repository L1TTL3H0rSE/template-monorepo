// Package errorsx хранит категории доменных ошибок, общие для всех сервисов.
//
// Сервис не заводит свой параллельный набор ошибок и свой internal/httperr.
// Собственную ошибку он оборачивает в нужную категорию:
//
//	var ErrCharacterNotFound = fmt.Errorf("%w: character", errorsx.ErrNotFound)
//
// После этого errors.Is работает и по конкретной ошибке, и по категории, а
// транспорт переводит категорию в HTTP-статус одним вызовом
// ginx.WriteDomainError.
package errorsx

import (
	"errors"
	"fmt"
)

var (
	ErrNotFound    = errors.New("not found")
	ErrValidation  = errors.New("validation failed")
	ErrConflict    = errors.New("conflict")
	ErrForbidden   = errors.New("forbidden")
	ErrUnavailable = errors.New("service unavailable")
	ErrRateLimited = errors.New("rate limited")
)

// Ошибки разбора запроса. Их возвращает ginx.GinxParser; транспорт переводит их
// в 400, потому что все они входят в категорию ErrValidation.
var (
	ErrQueryNotFound  = fmt.Errorf("%w: query parameter not found", ErrValidation)
	ErrQueryInvalid   = fmt.Errorf("%w: query parameter invalid", ErrValidation)
	ErrPathNotFound   = fmt.Errorf("%w: path parameter not found", ErrValidation)
	ErrPathInvalid    = fmt.Errorf("%w: path parameter invalid", ErrValidation)
	ErrHeaderNotFound = fmt.Errorf("%w: header not found", ErrValidation)
)
