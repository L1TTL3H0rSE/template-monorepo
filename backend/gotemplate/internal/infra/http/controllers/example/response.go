package example

import "roleplay/gotemplate/internal/domain/dtos"

// Файл response.go остаётся в контроллере: это типизированные схемы swagger,
// специфичные для одного HTTP-эндпоинта. Отдельный request.go, наоборот, не
// заводится — HTTP-тело связывается прямо в dtos.*Input / dtos.*Patch.

// ExampleSearchQuery — эталон разбора query: одна структура с form- и
// validate-тегами вместо цепочки p.GetQuery*. Значения по умолчанию и лимиты
// живут рядом с полем.
type ExampleSearchQuery struct {
	Q    string `form:"q"    validate:"omitempty,max=100"`
	From int    `form:"from" validate:"gte=0"`
	Size int    `form:"size" validate:"gte=0,lte=100"`
}

// ExampleSearchResponse — форма ответа поиска.
type ExampleSearchResponse struct {
	Items []dtos.ExampleView `json:"items"`
	Total int64              `json:"total" example:"42"`
	From  int                `json:"from" example:"0"`
	Size  int                `json:"size" example:"20"`
}
