package ginx

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// ErrorResponse — единственная форма ответа с ошибкой во всех сервисах.
// @Description Стандартная структура ответа при возникновении ошибки
type ErrorResponse struct {
	Error   bool    `json:"error" example:"true"`
	Message *string `json:"message" example:"Произошла ошибка"`
	Code    *string `json:"code,omitempty" example:"ERROR_CODE"`
	Details *string `json:"details,omitempty" example:"Дополнительные детали ошибки"`
}

// SuccessResponse — единственная форма успешного ответа с телом.
// @Description Стандартная структура успешного ответа с данными
type SuccessResponse[T any] struct {
	Error   bool   `json:"error" example:"false"`
	Message string `json:"message,omitempty" example:"Операция выполнена успешно"`
	Data    *T     `json:"data"`
}

// PaginatedResponse — форма ответа со страницей данных.
// @Description Стандартная структура ответа с пагинированными данными
type PaginatedResponse[T any] struct {
	Error   bool   `json:"error" example:"false"`
	Message string `json:"message,omitempty" example:"Данные получены успешно"`
	Data    T      `json:"data"`
	Meta    Meta   `json:"meta"`
}

// Meta — метаинформация страницы.
type Meta struct {
	Page       int   `json:"page" example:"1"`
	PerPage    int   `json:"per_page" example:"20"`
	Total      int64 `json:"total" example:"100"`
	TotalPages int   `json:"total_pages" example:"5"`
}

func NewErrorResponse(message string) ErrorResponse {
	return ErrorResponse{Error: true, Message: &message}
}

func NewErrorResponseWithCode(message, code string) ErrorResponse {
	return ErrorResponse{Error: true, Message: &message, Code: &code}
}

func NewErrorResponseWithDetails(message, code, details string) ErrorResponse {
	return ErrorResponse{Error: true, Message: &message, Code: &code, Details: &details}
}

func NewSuccessResponse[T any](data *T) SuccessResponse[T] {
	return SuccessResponse[T]{Error: false, Data: data}
}

func NewSuccessResponseWithMessage[T any](data *T, message string) SuccessResponse[T] {
	return SuccessResponse[T]{Error: false, Message: message, Data: data}
}

func NewPaginatedResponse[T any](data T, page, perPage int, total int64) PaginatedResponse[T] {
	totalPages := 0
	if perPage > 0 {
		totalPages = int(total) / perPage
		if int(total)%perPage > 0 {
			totalPages++
		}
	}

	return PaginatedResponse[T]{
		Error: false,
		Data:  data,
		Meta:  Meta{Page: page, PerPage: perPage, Total: total, TotalPages: totalPages},
	}
}

func WriteSuccessResponse[T any](c *gin.Context, data *T) {
	c.JSON(http.StatusOK, NewSuccessResponse(data))
}

func WriteSuccessResponseCreated[T any](c *gin.Context, data *T) {
	c.JSON(http.StatusCreated, NewSuccessResponse(data))
}

func WriteSuccessResponseWithStatusCode[T any](c *gin.Context, data *T, statusCode int) {
	c.JSON(statusCode, NewSuccessResponse(data))
}

func WritePaginatedResponse[T any](c *gin.Context, data T, page, perPage int, total int64) {
	c.JSON(http.StatusOK, NewPaginatedResponse(data, page, perPage, total))
}

// WriteOK — успешный ответ без тела data (200).
func WriteOK(c *gin.Context) {
	c.JSON(http.StatusOK, NewSuccessResponse[any](nil))
}

// WriteCreated — успешный ответ без тела data (201).
func WriteCreated(c *gin.Context) {
	c.JSON(http.StatusCreated, NewSuccessResponse[any](nil))
}

func WriteNoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// WriteErrorResponse отдаёт готовый GinxError и прерывает цепочку middleware.
func WriteErrorResponse(c *gin.Context, e *GinxError) {
	c.JSON(e.StatusCode, e.Response)
	c.Abort()
}
