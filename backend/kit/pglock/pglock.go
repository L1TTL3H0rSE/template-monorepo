// Package pglock — распределённые блокировки на advisory locks PostgreSQL.
//
// Зачем это в kit, а не в каждом сервисе: фоновая задача (reconciler, крон,
// повторная обработка очереди) почти всегда запускается больше чем в одном
// экземпляре — реплики сервиса, перезапуск во время работы, ручной прогон
// рядом с автоматическим. Без блокировки два экземпляра одновременно читают
// «просроченные» записи и обрабатывают их дважды.
//
// Advisory lock выбран потому, что он не требует ни отдельной таблицы, ни
// внешнего сервиса: блокировка живёт в той же БД, которой сервис уже владеет.
package pglock

import (
	"context"
	"fmt"
	"hash/fnv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Key превращает человекочитаемое имя в int64, которого требует
// pg_advisory_lock.
//
// Хеш, а не счётчик в конфиге: имя блокировки должно читаться в коде
// («characters:reconcile»), а не быть магическим числом, которое кто-то
// однажды переиспользует для другой задачи.
func Key(name string) int64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(name))

	return int64(h.Sum64())
}

// TryWithinTx выполняет fn внутри транзакции под advisory-блокировкой.
//
// Возвращает acquired=false, если блокировку держит кто-то другой. Это НЕ
// ошибка: для фоновой задачи «уже выполняется в соседней реплике» — штатный
// исход, и вызывающий просто пропускает тик.
//
// Используется xact-вариант (pg_try_advisory_xact_lock): блокировка снимается
// вместе с транзакцией — и при commit, и при rollback, и при падении процесса.
// Сессионный pg_advisory_lock требует явного unlock, и забытый unlock блокирует
// задачу до перезапуска сервиса.
//
// Ожидания нет: try-вариант возвращает управление сразу. Блокирующий вариант
// в фоновой задаче копит очередь из воркеров, которые проснутся все разом.
func TryWithinTx(
	ctx context.Context,
	pool *pgxpool.Pool,
	name string,
	fn func(ctx context.Context, tx pgx.Tx) error,
) (acquired bool, err error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("begin: %w", err)
	}
	defer func() {
		// Rollback после успешного Commit возвращает ErrTxClosed — это
		// ожидаемо и не является ошибкой сценария.
		_ = tx.Rollback(ctx)
	}()

	var locked bool
	if err := tx.QueryRow(ctx, "SELECT pg_try_advisory_xact_lock($1)", Key(name)).Scan(&locked); err != nil {
		return false, fmt.Errorf("acquire advisory lock %q: %w", name, err)
	}
	if !locked {
		return false, nil
	}

	if err := fn(ctx, tx); err != nil {
		return true, err
	}
	if err := tx.Commit(ctx); err != nil {
		return true, fmt.Errorf("commit: %w", err)
	}

	return true, nil
}
