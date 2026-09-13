# Entity Relationship Diagram

この図は完成時のデータモデル案である。カラム定義とビジネスルールは、実装を進めながら本書と要件資料へ段階的に追記する。

```mermaid
erDiagram
    User ||--o{ Project : owns
    User ||--o{ ProjectMember : joins
    Project ||--o{ ProjectMember : has
    Project ||--o{ Task : has
    User ||--o{ Task : reports
    User ||--o{ Task : assigned
    Task ||--o{ Comment : has
    User ||--o{ Comment : writes
    Task ||--o{ TaskHistory : records
    User ||--o{ TaskHistory : performs

    User {
        string id PK
        string email UK
        string name
        string avatar_url "nullable"
        datetime created_at
        datetime updated_at
    }

    Project {
        string id PK
        string owner_id FK
        string name
        string key UK
        string description "nullable"
        boolean is_archived
        datetime created_at
        datetime updated_at
    }

    ProjectMember {
        string id PK
        string project_id FK
        string user_id FK
        enum role "owner | manager | member | viewer"
        datetime joined_at
    }

    Task {
        string id PK
        string project_id FK
        int number
        string parent_task_id FK "nullable, self-reference"
        string reporter_id FK
        string assignee_id FK "nullable"
        string title
        string description "nullable"
        enum status "todo | in_progress | in_review | done | closed"
        enum priority "low | normal | high | urgent"
        date start_date "nullable"
        date due_date "nullable"
        decimal estimated_hours "decimal(10,2), nullable"
        datetime completed_at "nullable"
        datetime created_at
        datetime updated_at
    }

    Comment {
        string id PK
        string task_id FK
        string author_id FK
        string body
        datetime deleted_at "nullable"
        datetime created_at
        datetime updated_at
    }

    TaskHistory {
        string id PK
        string task_id FK
        string actor_id FK
        enum action "created | updated | commented | assigned | status_changed"
        json changes "nullable"
        datetime created_at
    }
```

## 補足制約

- `Task.parent_task_id` は `Task.id` を参照する自己参照FKである
- Mermaid上では可読性を優先し、TaskからTaskへの自己参照線を省略している
- `ProjectMember` は `(project_id, user_id)` の組み合わせで一意とする
- `Task` は `(project_id, number)` の組み合わせで一意とする
