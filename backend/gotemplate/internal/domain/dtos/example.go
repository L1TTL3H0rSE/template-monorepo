package dtos

import "time"

// ExampleView — форма ответа API.
type ExampleView struct {
	ID        string    `json:"id" example:"11111111-1111-1111-1111-111111111111"`
	Name      string    `json:"name" example:"Example"`
	CreatedAt time.Time `json:"created_at"`
}

// ExampleInput — форма создания. Связывается напрямую и с HTTP-телом, и с
// внутренним вызовом; отдельный request.go в контроллере не заводится.
type ExampleInput struct {
	Name string `json:"name" binding:"required,min=1,max=200" example:"Example"`
}

// ExamplePatch — форма частичного обновления. Указатель отличает «поле не
// передано» от «поле сброшено».
type ExamplePatch struct {
	Name *string `json:"name" binding:"omitempty,min=1,max=200" example:"Example"`
}
