// Package postgres — адаптер PostgreSQL: пул pgx и запуск миграций.
//
// Сервис не открывает соединение сам и не носит свою копию строки подключения.
package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5" // драйвер БД для migrate
	_ "github.com/golang-migrate/migrate/v4/source/file"     // драйвер источника миграций
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// Config — блок конфигурации БД (префикс DB_).
type Config struct {
	Host     string `env:"HOST" env-default:"localhost"`
	Port     int    `env:"PORT" env-default:"5432"`
	Name     string `env:"NAME" env-default:"postgres"`
	User     string `env:"USER" env-default:"postgres"`
	Password string `env:"PASSWORD" env-default:"postgres"`
	SSLMode  string `env:"SSL_MODE" env-default:"disable"`

	MaxConns        int32         `env:"MAX_CONNS" env-default:"10"`
	MinConns        int32         `env:"MIN_CONNS" env-default:"2"`
	MaxConnLifetime time.Duration `env:"MAX_CONN_LIFETIME" env-default:"1h"`
}

// DSN собирает строку подключения. Единственное место, где она формируется.
func (c *Config) DSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		c.User, c.Password, c.Host, c.Port, c.Name, c.SSLMode)
}

// MigrationDSN — тот же DSN со схемой pgx5: golang-migrate выбирает драйвер БД
// по схеме URL, и схема postgres увела бы миграции на lib/pq, то есть на второй
// драйвер PostgreSQL в сборке.
func (c *Config) MigrationDSN() string {
	return "pgx5" + strings.TrimPrefix(c.DSN(), "postgres")
}

type Adapter struct {
	cfg  *Config
	log  *zap.Logger
	pool *pgxpool.Pool
}

func NewAdapter(cfg *Config, log *zap.Logger) *Adapter {
	if log == nil {
		log = zap.NewNop()
	}

	return &Adapter{cfg: cfg, log: log}
}

func (a *Adapter) Connect(ctx context.Context) error {
	poolConfig, err := pgxpool.ParseConfig(a.cfg.DSN())
	if err != nil {
		return fmt.Errorf("parse dsn: %w", err)
	}
	poolConfig.MaxConns = a.cfg.MaxConns
	poolConfig.MinConns = a.cfg.MinConns
	poolConfig.MaxConnLifetime = a.cfg.MaxConnLifetime

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return fmt.Errorf("create pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return fmt.Errorf("ping: %w", err)
	}

	a.pool = pool
	a.log.Info("postgres connected",
		zap.String("host", a.cfg.Host), zap.String("database", a.cfg.Name))

	return nil
}

// Pool отдаёт пул для query.New(...). Сервис передаёт его в сгенерированный
// sqlc-слой и больше нигде не держит.
func (a *Adapter) Pool() *pgxpool.Pool { return a.pool }

// RunMigrations применяет миграции из каталога сервиса при старте.
//
// Схемой владеет сервис: чужие таблицы он не мигрирует и не читает. Уже
// применённая миграция не переписывается — новое изменение схемы всегда
// добавляет следующую пару файлов up/down.
func (a *Adapter) RunMigrations(_ context.Context, dir string) error {
	migrator, err := migrate.New("file://"+dir, a.cfg.MigrationDSN())
	if err != nil {
		return fmt.Errorf("migrate init: %w", err)
	}
	defer func() { _, _ = migrator.Close() }()

	if err := migrator.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate up: %w", err)
	}

	a.log.Info("migrations applied", zap.String("dir", dir))

	return nil
}

func (a *Adapter) Close() {
	if a.pool != nil {
		a.pool.Close()
	}
}
