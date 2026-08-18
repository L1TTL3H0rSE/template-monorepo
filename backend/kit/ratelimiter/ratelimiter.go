// Package ratelimiter — token bucket поверх общего kit/cache.
//
// Реализация намеренно одна: разные алгоритмы в разных сервисах дают разное
// поведение на одном и том же публичном API. Хранилище приходит извне, поэтому
// замена in-memory кеша на распределённый не меняет вызывающий код.
package ratelimiter

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"starter/kit/cache"
)

// Config — блок конфигурации лимитера (префикс RATELIMIT_).
type Config struct {
	Enabled bool          `env:"ENABLED" env-default:"true"`
	Rate    int           `env:"RATE" env-default:"100"`
	Period  time.Duration `env:"PERIOD" env-default:"1m"`
	Burst   int           `env:"BURST" env-default:"20"`
}

// Result — решение лимитера и данные для заголовков X-RateLimit-*.
type Result struct {
	Allowed   bool
	Limit     int
	Remaining int
	ResetAt   time.Time
}

type RateLimiter interface {
	Allow(ctx context.Context, key string) (Result, error)
}

type bucketState struct {
	Tokens    float64   `json:"tokens"`
	UpdatedAt time.Time `json:"updated_at"`
}

type tokenBucket struct {
	store cache.Cache
	cfg   Config

	// Кеш общий, поэтому read-modify-write состояния бакета защищается здесь.
	mu sync.Mutex
}

func New(store cache.Cache, cfg Config) (RateLimiter, error) {
	if store == nil {
		return nil, errors.New("ratelimiter: store is required")
	}
	if cfg.Rate <= 0 || cfg.Period <= 0 {
		return nil, errors.New("ratelimiter: rate and period must be positive")
	}
	if cfg.Burst <= 0 {
		cfg.Burst = cfg.Rate
	}

	return &tokenBucket{store: store, cfg: cfg}, nil
}

func (t *tokenBucket) Allow(ctx context.Context, key string) (Result, error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := time.Now()
	capacity := float64(t.cfg.Burst)
	refillPerSecond := float64(t.cfg.Rate) / t.cfg.Period.Seconds()

	state := bucketState{Tokens: capacity, UpdatedAt: now}
	raw, err := t.store.Get(ctx, key)
	switch {
	case err == nil:
		if unmarshalErr := json.Unmarshal(raw, &state); unmarshalErr != nil {
			state = bucketState{Tokens: capacity, UpdatedAt: now}
		}
		elapsed := now.Sub(state.UpdatedAt).Seconds()
		state.Tokens = min(capacity, state.Tokens+elapsed*refillPerSecond)
	case errors.Is(err, cache.ErrNotFound):
		// Первое обращение ключа: полный бакет.
	default:
		return Result{}, err
	}

	result := Result{
		Allowed: state.Tokens >= 1,
		Limit:   t.cfg.Burst,
		ResetAt: now.Add(time.Duration(float64(time.Second) * (capacity - state.Tokens) / refillPerSecond)),
	}
	if result.Allowed {
		state.Tokens--
	}
	result.Remaining = int(state.Tokens)

	state.UpdatedAt = now
	encoded, err := json.Marshal(state)
	if err != nil {
		return Result{}, err
	}
	if err := t.store.Set(ctx, key, encoded, t.cfg.Period*2); err != nil {
		return Result{}, err
	}

	return result, nil
}
