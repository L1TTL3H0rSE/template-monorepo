package main

import (
	"context"
	"os/signal"
	"syscall"

	"roleplay/gotemplate/internal/app"
)

// main держит ровно одну обязанность: связать сигналы ОС с контекстом и отдать
// управление composition root. Вся сборка зависимостей живёт в internal/app.
func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	if err := app.Run(ctx); err != nil {
		panic(err)
	}
}
