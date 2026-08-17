// Package permissions владеет публичным контрактом авторизации сервиса.
//
// Правило владения: actions, resource types, namespaces и role keys объявляет
// ТОТ сервис, которому принадлежат данные. Потребитель импортирует эти
// константы отсюда и не копирует строки к себе — иначе переименование действия
// у владельца молча расходится с проверкой у потребителя.
//
// Пакет лежит в pkg/, а не в internal/, именно потому, что он предназначен для
// импорта другими сервисами.
package permissions

// ServiceCode — идентификатор владельца в каталоге разрешений.
const ServiceCode = "gotemplate"

// Actions — что можно делать. Имя строится как <ресурс>.<действие>.
const (
	ActionExampleRead   = "example.read"
	ActionExampleManage = "example.manage"
)

// ResourceTypes — над чем совершается действие.
const (
	ResourceTypeExample = "gotemplate.example"
)

// Namespaces — область, в которой выдаётся назначение. Namespace чужого домена
// импортируется из pkg/permissions его владельца.
const (
	NamespaceControl = "gotemplate.control"
	ObjectMain       = "main"
)

// Roles — предопределённые наборы действий.
const (
	RoleExampleManager = "example.manager"
)

// Permission — описание одного действия для каталога.
type Permission struct {
	Key             string
	Name            string
	Description     string
	ResourceType    string
	AccessSemantics string
}

// Catalog возвращает полный каталог разрешений сервиса.
//
// Он регистрируется при старте (см. internal/app) и является единственным
// источником списка действий: UI администрирования, проверки и документация
// читают его, а не свои копии.
func Catalog() []Permission {
	return []Permission{
		{
			Key:             ActionExampleRead,
			Name:            "Просмотр примеров",
			ResourceType:    ResourceTypeExample,
			AccessSemantics: "ASSIGNMENT",
		},
		{
			Key:             ActionExampleManage,
			Name:            "Управление примерами",
			Description:     "Создание, редактирование и удаление примеров",
			ResourceType:    ResourceTypeExample,
			AccessSemantics: "ASSIGNMENT",
		},
	}
}
