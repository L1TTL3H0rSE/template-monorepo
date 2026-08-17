package example

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"roleplay/gotemplate/internal/domain/dtos"
	examplesvc "roleplay/gotemplate/internal/infra/services/example"
	"roleplay/kit/errorsx"
)

// stubService реализует локальный интерфейс service. Ради него интерфейс и
// существует: без потребителя он был бы лишним слоем.
type stubService struct {
	view *dtos.ExampleView
	err  error
}

func (s *stubService) GetByID(context.Context, uuid.UUID) (*dtos.ExampleView, error) {
	return s.view, s.err
}

func (s *stubService) Search(context.Context, *string, int, int) (*examplesvc.SearchResult, error) {
	return &examplesvc.SearchResult{Items: []dtos.ExampleView{}, Total: 0}, s.err
}

func (s *stubService) Create(context.Context, dtos.ExampleInput) (*dtos.ExampleView, error) {
	return s.view, s.err
}

func (s *stubService) Update(context.Context, uuid.UUID, dtos.ExamplePatch) (*dtos.ExampleView, error) {
	return s.view, s.err
}

func (s *stubService) Delete(context.Context, uuid.UUID) error { return s.err }

func newTestRouter(svc service) *gin.Engine {
	gin.SetMode(gin.TestMode)
	handler := NewHandler(svc, nil)

	router := gin.New()
	router.GET("/example", handler.Search)
	router.GET("/example/:id", handler.GetByID)
	router.PATCH("/example/:id", handler.Update)

	return router
}

func TestGetByIDRejectsMalformedUUID(t *testing.T) {
	router := newTestRouter(&stubService{})

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/example/not-a-uuid", nil))

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusBadRequest)
	}
}

// Проверка сквозного контракта: категория доменной ошибки превращается в статус
// без участия хендлера. Ломается — значит кто-то завёл свою таблицу ошибок.
func TestDomainErrorCategoriesMapToStatuses(t *testing.T) {
	cases := []struct {
		err    error
		status int
	}{
		{fmt.Errorf("%w: example", errorsx.ErrNotFound), http.StatusNotFound},
		{fmt.Errorf("%w: bad", errorsx.ErrValidation), http.StatusBadRequest},
		{fmt.Errorf("%w: taken", errorsx.ErrConflict), http.StatusConflict},
		{fmt.Errorf("%w: nope", errorsx.ErrForbidden), http.StatusForbidden},
	}

	for _, testCase := range cases {
		router := newTestRouter(&stubService{err: testCase.err})

		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(
			http.MethodGet, "/example/11111111-1111-1111-1111-111111111111", nil))

		if recorder.Code != testCase.status {
			t.Fatalf("err %v -> status %d, want %d", testCase.err, recorder.Code, testCase.status)
		}
	}
}

func TestSearchRejectsOversizedPage(t *testing.T) {
	router := newTestRouter(&stubService{})

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/example?size=1000", nil))

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d (validate:lte=100 не применился)",
			recorder.Code, http.StatusBadRequest)
	}
}

func TestSearchAppliesDefaultPageSize(t *testing.T) {
	router := newTestRouter(&stubService{})

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/example", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}

	var response struct {
		Data ExampleSearchResponse `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if response.Data.Size != defaultPageSize {
		t.Fatalf("size = %d, want %d", response.Data.Size, defaultPageSize)
	}
}
