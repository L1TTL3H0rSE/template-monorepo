package example

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"roleplay/gotemplate/internal/domain/dtos"
	examplesvc "roleplay/gotemplate/internal/infra/services/example"
	"roleplay/kit/ginx"
)

const defaultPageSize = 20

// service — локальный контракт хендлера. Интерфейс объявлен рядом с
// ПОТРЕБИТЕЛЕМ, а не рядом с реализацией, и существует только потому, что у
// него есть потребитель: на нём держатся тесты хендлера. Общего пакета ports в
// шаблоне нет.
type service interface {
	GetByID(ctx context.Context, id uuid.UUID) (*dtos.ExampleView, error)
	Search(ctx context.Context, search *string, limit, offset int) (*examplesvc.SearchResult, error)
	Create(ctx context.Context, input dtos.ExampleInput) (*dtos.ExampleView, error)
	Update(ctx context.Context, id uuid.UUID, patch dtos.ExamplePatch) (*dtos.ExampleView, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

type Handler struct {
	svc service
	log *zap.Logger
}

func NewHandler(svc service, log *zap.Logger) *Handler {
	if log == nil {
		log = zap.NewNop()
	}

	return &Handler{svc: svc, log: log}
}

// GetByID возвращает пример по ID.
//
// Аутентификацию проверяет middlewares.GatewayRequireAuth на группе роутера —
// повторять её здесь нельзя: до хендлера запрос не дойдёт, а лишняя проверка
// маскирует отсутствие настоящей доменной авторизации.
//
// @Summary      Получить пример по ID
// @Tags         example
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "UUID примера"
// @Success      200  {object} ginx.SuccessResponse[dtos.ExampleView]
// @Failure      400  {object} ginx.ErrorResponse
// @Failure      404  {object} ginx.ErrorResponse
// @Router       /api/v1/example/{id} [get]
func (h *Handler) GetByID(c *gin.Context) {
	p := ginx.NewGinxParser(c)

	id, err := p.GetPathUUID("id")
	if err != nil {
		ginx.WriteErrorResponse(c, ginx.BadRequest)
		return
	}

	view, err := h.svc.GetByID(c.Request.Context(), *id)
	if err != nil {
		// Категория ошибки уже несёт статус — своей таблицы errmap не нужно.
		ginx.WriteDomainError(c, h.log, err)
		return
	}

	ginx.WriteSuccessResponse(c, view)
}

// Search ищет примеры.
//
// @Summary      Поиск примеров
// @Tags         example
// @Produce      json
// @Security     BearerAuth
// @Param        q    query string false "Строка поиска"
// @Param        from query int    false "Смещение"
// @Param        size query int    false "Размер страницы"
// @Success      200  {object} ginx.SuccessResponse[example.ExampleSearchResponse]
// @Failure      400  {object} ginx.ErrorResponse
// @Router       /api/v1/example [get]
func (h *Handler) Search(c *gin.Context) {
	q, err := ginx.ParseQuery[ExampleSearchQuery](c)
	if err != nil {
		ginx.WriteErrorResponse(c, ginx.BadRequest)
		return
	}
	if q.Size == 0 {
		q.Size = defaultPageSize
	}

	var search *string
	if q.Q != "" {
		search = &q.Q
	}

	result, err := h.svc.Search(c.Request.Context(), search, q.Size, q.From)
	if err != nil {
		ginx.WriteDomainError(c, h.log, err)
		return
	}

	ginx.WriteSuccessResponse(c, &ExampleSearchResponse{
		Items: result.Items,
		Total: result.Total,
		From:  q.From,
		Size:  q.Size,
	})
}

// Create создаёт пример.
//
// @Summary      Создать пример
// @Tags         example
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        payload body     dtos.ExampleInput true "Тело запроса"
// @Success      201     {object} ginx.SuccessResponse[dtos.ExampleView]
// @Failure      400     {object} ginx.ErrorResponse
// @Router       /api/v1/example [post]
func (h *Handler) Create(c *gin.Context) {
	// Тело связывается прямо в dtos.ExampleInput: отдельная request-структура
	// в контроллере не заводится.
	var input dtos.ExampleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		ginx.WriteErrorResponse(c, ginx.BadRequest)
		return
	}

	view, err := h.svc.Create(c.Request.Context(), input)
	if err != nil {
		ginx.WriteDomainError(c, h.log, err)
		return
	}

	ginx.WriteSuccessResponseCreated(c, view)
}

// Update частично обновляет пример.
//
// @Summary      Обновить пример
// @Tags         example
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id      path     string             true "UUID примера"
// @Param        payload body     dtos.ExamplePatch  true "Тело запроса"
// @Success      200     {object} ginx.SuccessResponse[dtos.ExampleView]
// @Failure      400     {object} ginx.ErrorResponse
// @Failure      404     {object} ginx.ErrorResponse
// @Router       /api/v1/example/{id} [patch]
func (h *Handler) Update(c *gin.Context) {
	p := ginx.NewGinxParser(c)

	id, err := p.GetPathUUID("id")
	if err != nil {
		ginx.WriteErrorResponse(c, ginx.BadRequest)
		return
	}

	var patch dtos.ExamplePatch
	if err := c.ShouldBindJSON(&patch); err != nil {
		ginx.WriteErrorResponse(c, ginx.BadRequest)
		return
	}

	view, err := h.svc.Update(c.Request.Context(), *id, patch)
	if err != nil {
		ginx.WriteDomainError(c, h.log, err)
		return
	}

	ginx.WriteSuccessResponse(c, view)
}

// Delete удаляет пример.
//
// @Summary      Удалить пример
// @Tags         example
// @Produce      json
// @Security     BearerAuth
// @Param        id path string true "UUID примера"
// @Success      204
// @Failure      400 {object} ginx.ErrorResponse
// @Router       /api/v1/example/{id} [delete]
func (h *Handler) Delete(c *gin.Context) {
	p := ginx.NewGinxParser(c)

	id, err := p.GetPathUUID("id")
	if err != nil {
		ginx.WriteErrorResponse(c, ginx.BadRequest)
		return
	}

	if err := h.svc.Delete(c.Request.Context(), *id); err != nil {
		ginx.WriteDomainError(c, h.log, err)
		return
	}

	ginx.WriteNoContent(c)
}
