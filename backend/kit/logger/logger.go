// Package logger — единственный способ получить логгер сервиса.
//
// Формат по умолчанию — JSON: логи читает машина, а не человек в терминале.
package logger

import (
	"fmt"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Config — блок конфигурации логирования (префикс LOG_).
type Config struct {
	Level  string `env:"LEVEL" env-default:"info"`
	Format string `env:"FORMAT" env-default:"json"`
}

type Logger struct {
	zap *zap.Logger
}

func New(cfg Config) (*Logger, error) {
	level, err := zapcore.ParseLevel(cfg.Level)
	if err != nil {
		return nil, fmt.Errorf("parse log level %q: %w", cfg.Level, err)
	}

	zapConfig := zap.NewProductionConfig()
	zapConfig.Level = zap.NewAtomicLevelAt(level)
	zapConfig.EncoderConfig.TimeKey = "time"
	zapConfig.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	switch cfg.Format {
	case "json", "":
		zapConfig.Encoding = "json"
	case "text", "console":
		zapConfig.Encoding = "console"
		zapConfig.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	default:
		return nil, fmt.Errorf("unknown log format %q", cfg.Format)
	}

	built, err := zapConfig.Build()
	if err != nil {
		return nil, fmt.Errorf("build logger: %w", err)
	}

	return &Logger{zap: built}, nil
}

func (l *Logger) Zap() *zap.Logger { return l.zap }

func (l *Logger) Sync() error { return l.zap.Sync() }
