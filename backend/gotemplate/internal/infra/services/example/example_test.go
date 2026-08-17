package example

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"roleplay/gotemplate/internal/domain/dtos"
	"roleplay/gotemplate/internal/query"
	"roleplay/kit/errorsx"
)

// fakeQuerier — тестовый шов сервиса. Он реализует сгенерированный
// query.Querier, поэтому отдельный рукописный store-интерфейс не нужен, а
// компилятор сам ловит расхождение фейка с реальным контрактом БД.
type fakeQuerier struct {
	query.Querier // не реализованные в тесте методы паникуют — это намеренно

	example    query.Example
	getErr     error
	updateErr  error
	deleteErr  error
	deletedIDs []uuid.UUID
}

func (f *fakeQuerier) GetExample(_ context.Context, _ uuid.UUID) (query.Example, error) {
	if f.getErr != nil {
		return query.Example{}, f.getErr
	}

	return f.example, nil
}

func (f *fakeQuerier) UpdateExampleName(_ context.Context, arg query.UpdateExampleNameParams) (query.Example, error) {
	if f.updateErr != nil {
		return query.Example{}, f.updateErr
	}
	f.example.Name = arg.Name

	return f.example, nil
}

func (f *fakeQuerier) DeleteExample(_ context.Context, id uuid.UUID) error {
	f.deletedIDs = append(f.deletedIDs, id)

	return f.deleteErr
}

func TestGetByIDReturnsView(t *testing.T) {
	id := uuid.New()
	created := time.Now().UTC()
	svc := New(&fakeQuerier{example: query.Example{ID: id, Name: "Alice", CreatedAt: created}}, nil)

	view, err := svc.GetByID(context.Background(), id)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if view.ID != id.String() || view.Name != "Alice" || !view.CreatedAt.Equal(created) {
		t.Fatalf("view = %+v, want id=%s name=Alice", view, id)
	}
}

// Ключевое поведение слоя: pgx.ErrNoRows превращается в доменную категорию,
// которую транспорт переведёт в 404. Если этот перевод потерять, сервис начнёт
// отдавать 500 на обычное «не найдено».
func TestGetByIDMapsNoRowsToNotFound(t *testing.T) {
	svc := New(&fakeQuerier{getErr: pgx.ErrNoRows}, nil)

	_, err := svc.GetByID(context.Background(), uuid.New())
	if !errors.Is(err, errorsx.ErrNotFound) {
		t.Fatalf("err = %v, want errorsx.ErrNotFound", err)
	}
}

func TestGetByIDPropagatesUnknownError(t *testing.T) {
	sentinel := errors.New("connection reset")
	svc := New(&fakeQuerier{getErr: sentinel}, nil)

	_, err := svc.GetByID(context.Background(), uuid.New())
	if !errors.Is(err, sentinel) {
		t.Fatalf("err = %v, want %v", err, sentinel)
	}
	if errors.Is(err, errorsx.ErrNotFound) {
		t.Fatal("неизвестная ошибка БД не должна становиться 404")
	}
}

// Пустой patch — ошибка валидации, а не молчаливый no-op: иначе клиент получает
// 200 на запрос, который ничего не сделал.
func TestUpdateRejectsEmptyPatch(t *testing.T) {
	svc := New(&fakeQuerier{}, nil)

	_, err := svc.Update(context.Background(), uuid.New(), dtos.ExamplePatch{})
	if !errors.Is(err, errorsx.ErrValidation) {
		t.Fatalf("err = %v, want errorsx.ErrValidation", err)
	}
}

func TestUpdateMapsNoRowsToNotFound(t *testing.T) {
	name := "Bob"
	svc := New(&fakeQuerier{updateErr: pgx.ErrNoRows}, nil)

	_, err := svc.Update(context.Background(), uuid.New(), dtos.ExamplePatch{Name: &name})
	if !errors.Is(err, errorsx.ErrNotFound) {
		t.Fatalf("err = %v, want errorsx.ErrNotFound", err)
	}
}

func TestDeletePassesID(t *testing.T) {
	fake := &fakeQuerier{}
	svc := New(fake, nil)
	id := uuid.New()

	if err := svc.Delete(context.Background(), id); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if len(fake.deletedIDs) != 1 || fake.deletedIDs[0] != id {
		t.Fatalf("deletedIDs = %v, want [%s]", fake.deletedIDs, id)
	}
}
