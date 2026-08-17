// Package cache — общий кеш сервиса с одним интерфейсом и одной реализацией по
// умолчанию (in-memory с TTL).
//
// Экземпляр создаётся один раз в bootstrap и делится между потребителями через
// Namespaced: rate limiter, кеш справочников и любой другой потребитель живут в
// собственном префиксе одного хранилища, а не заводят своё.
package cache

import (
	"context"
	"errors"
	"sync"
	"time"
)

var ErrNotFound = errors.New("cache: key not found")

type Cache interface {
	Get(ctx context.Context, key string) ([]byte, error)
	Set(ctx context.Context, key string, value []byte, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
}

// Config — блок конфигурации кеша (префикс CACHE_).
type Config struct {
	DefaultTTL      time.Duration `env:"DEFAULT_TTL" env-default:"5m"`
	CleanupInterval time.Duration `env:"CLEANUP_INTERVAL" env-default:"1m"`
}

type entry struct {
	value     []byte
	expiresAt time.Time
}

type memoryCache struct {
	mu         sync.RWMutex
	items      map[string]entry
	defaultTTL time.Duration
}

// NewMemory создаёт in-memory кеш. Просроченные записи удаляются лениво при
// чтении и фоновым проходом раз в cfg.CleanupInterval.
func NewMemory(ctx context.Context, cfg Config) Cache {
	c := &memoryCache{items: make(map[string]entry), defaultTTL: cfg.DefaultTTL}

	if cfg.CleanupInterval > 0 {
		go c.cleanupLoop(ctx, cfg.CleanupInterval)
	}

	return c
}

func (c *memoryCache) Get(_ context.Context, key string) ([]byte, error) {
	c.mu.RLock()
	item, ok := c.items[key]
	c.mu.RUnlock()

	if !ok {
		return nil, ErrNotFound
	}
	if !item.expiresAt.IsZero() && time.Now().After(item.expiresAt) {
		c.mu.Lock()
		delete(c.items, key)
		c.mu.Unlock()
		return nil, ErrNotFound
	}

	return item.value, nil
}

func (c *memoryCache) Set(_ context.Context, key string, value []byte, ttl time.Duration) error {
	if ttl <= 0 {
		ttl = c.defaultTTL
	}

	c.mu.Lock()
	c.items[key] = entry{value: value, expiresAt: time.Now().Add(ttl)}
	c.mu.Unlock()

	return nil
}

func (c *memoryCache) Delete(_ context.Context, key string) error {
	c.mu.Lock()
	delete(c.items, key)
	c.mu.Unlock()

	return nil
}

func (c *memoryCache) cleanupLoop(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			c.mu.Lock()
			for key, item := range c.items {
				if !item.expiresAt.IsZero() && now.After(item.expiresAt) {
					delete(c.items, key)
				}
			}
			c.mu.Unlock()
		}
	}
}

// Namespaced возвращает представление того же кеша с префиксом ключей.
func Namespaced(base Cache, prefix string) Cache {
	return namespaced{base: base, prefix: prefix}
}

type namespaced struct {
	base   Cache
	prefix string
}

func (n namespaced) Get(ctx context.Context, key string) ([]byte, error) {
	return n.base.Get(ctx, n.prefix+key)
}

func (n namespaced) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	return n.base.Set(ctx, n.prefix+key, value, ttl)
}

func (n namespaced) Delete(ctx context.Context, key string) error {
	return n.base.Delete(ctx, n.prefix+key)
}
