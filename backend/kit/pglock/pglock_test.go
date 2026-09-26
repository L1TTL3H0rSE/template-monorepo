package pglock

import "testing"

func TestKeyIsStable(t *testing.T) {
	// Ключ обязан быть стабильным между сборками и платформами: иначе после
	// деплоя новая реплика возьмёт «другую» блокировку и начнёт работать
	// параллельно со старой.
	const want int64 = 7593344862336838203
	if got := Key("characters:reconcile"); got != want {
		t.Fatalf("ключ изменился: got %d, want %d", got, want)
	}
}

func TestKeyDistinguishesNames(t *testing.T) {
	if Key("characters:reconcile") == Key("campaigns:reconcile") {
		t.Fatal("разные имена не должны давать один ключ")
	}
}
