package pglock

import "testing"

func TestKeyIsStable(t *testing.T) {
	// Ключ обязан быть стабильным между сборками и платформами: иначе после
	// деплоя новая реплика возьмёт «другую» блокировку и начнёт работать
	// параллельно со старой.
	if Key("characters:reconcile") != Key("characters:reconcile") {
		t.Fatal("одно имя должно давать один ключ")
	}
}

func TestKeyDistinguishesNames(t *testing.T) {
	if Key("characters:reconcile") == Key("campaigns:reconcile") {
		t.Fatal("разные имена не должны давать один ключ")
	}
}
