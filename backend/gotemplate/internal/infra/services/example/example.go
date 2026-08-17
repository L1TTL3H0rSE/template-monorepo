// Package example — эталонный сценарный слой: единственный слой между
// транспортом и sqlc.
//
// Repository и domain/models не заводятся, пока не появится второй источник
// данных, кеш, внешний адаптер или доказанное расхождение доменной формы со
// строкой БД. Сервис держит сгенерированный query.Querier — он же является
// тестовым швом.
package example

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"roleplay/gotemplate/internal/domain/dtos"
	"roleplay/gotemplate/internal/query"
	"roleplay/kit/errorsx"
)

type Service struct {
	q   query.Querier
	log *zap.Logger
}

// New принимает интерфейс, сгенерированный sqlc. Рукописный store-интерфейс не
// нужен: подмена в тестах делается фейком того же Querier.
func New(q query.Querier, log *zap.Logger) *Service {
	if log == nil {
		log = zap.NewNop()
	}

	return &Service{q: q, log: log}
}

// GetByID — эталон чтения: пустая выборка становится доменной категорией
// errorsx.ErrNotFound, которую транспорт переводит в 404 одним вызовом
// ginx.WriteDomainError. Своя таблица ошибок сервису не нужна.
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*dtos.ExampleView, error) {
	row, err := s.q.GetExample(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: example %s", errorsx.ErrNotFound, id)
		}
		return nil, err
	}

	return toView(row), nil
}

// SearchResult — страница выдачи. Пагинацию считает БД, а не срез в памяти:
// фильтрация и сортировка остаются за границей хранилища.
type SearchResult struct {
	Items []dtos.ExampleView
	Total int64
}

func (s *Service) Search(ctx context.Context, search *string, limit, offset int) (*SearchResult, error) {
	rows, err := s.q.ListExamples(ctx, query.ListExamplesParams{
		Search:     search,
		PageSize:   limit,
		PageOffset: offset,
	})
	if err != nil {
		return nil, err
	}

	total, err := s.q.CountExamples(ctx, search)
	if err != nil {
		return nil, err
	}

	items := make([]dtos.ExampleView, 0, len(rows))
	for _, row := range rows {
		items = append(items, *toView(row))
	}

	return &SearchResult{Items: items, Total: total}, nil
}

func (s *Service) Create(ctx context.Context, input dtos.ExampleInput) (*dtos.ExampleView, error) {
	row, err := s.q.CreateExample(ctx, input.Name)
	if err != nil {
		return nil, err
	}
	s.log.Info("example created", zap.String("example_id", row.ID.String()))

	return toView(row), nil
}

// Update — эталон частичного обновления: пустой patch является ошибкой
// валидации, а не молчаливым no-op.
func (s *Service) Update(ctx context.Context, id uuid.UUID, patch dtos.ExamplePatch) (*dtos.ExampleView, error) {
	if patch.Name == nil {
		return nil, fmt.Errorf("%w: empty patch", errorsx.ErrValidation)
	}

	row, err := s.q.UpdateExampleName(ctx, query.UpdateExampleNameParams{ID: id, Name: *patch.Name})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: example %s", errorsx.ErrNotFound, id)
		}
		return nil, err
	}

	return toView(row), nil
}

func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	return s.q.DeleteExample(ctx, id)
}

// toView — единственное место маппинга строки БД в форму ответа.
func toView(row query.Example) *dtos.ExampleView {
	return &dtos.ExampleView{
		ID:        row.ID.String(),
		Name:      row.Name,
		CreatedAt: row.CreatedAt,
	}
}
