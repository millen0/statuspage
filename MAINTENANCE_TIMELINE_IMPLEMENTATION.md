# Implementação de Timeline de Maintenances

## ✅ Implementação Completa

Sistema de timeline para maintenances com múltiplos status e updates automáticos, similar ao sistema de incidents.

## Status de Maintenance

1. **Scheduled** - Manutenção agendada
2. **In Progress** - Manutenção em andamento
3. **Completed** - Manutenção concluída

## Estrutura de Dados

### Banco de Dados

#### Tabela Existente: maintenances
```sql
CREATE TABLE maintenances (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'scheduled',
    scheduled_start TIMESTAMP NOT NULL,
    scheduled_end TIMESTAMP NOT NULL,
    actual_start TIMESTAMP,
    actual_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Nova Tabela: maintenance_updates
```sql
CREATE TABLE maintenance_updates (
    id SERIAL PRIMARY KEY,
    maintenance_id INTEGER REFERENCES maintenances(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Migration

Execute a migration para criar a tabela:
```bash
psql -U [user] -d statuspage -f backend/database/migration_maintenance_updates.sql
```

## Backend (✅ Implementado)

### Rotas Disponíveis:

- `GET /api/admin/maintenances` - Lista maintenances com updates
- `POST /api/admin/maintenances` - Cria nova maintenance
- `PUT /api/admin/maintenances/{id}` - Atualiza maintenance
- `DELETE /api/admin/maintenances/{id}` - Deleta maintenance
- `POST /api/admin/maintenances/{id}/updates` - Adiciona update manual

### Modelo de Dados:

```go
type Maintenance struct {
    ID                 int                 `json:"id"`
    Title              string              `json:"title"`
    Description        string              `json:"description"`
    Status             string              `json:"status"`
    ScheduledStart     time.Time           `json:"scheduled_start"`
    ScheduledEnd       time.Time           `json:"scheduled_end"`
    ActualStart        *time.Time          `json:"actual_start"`
    ActualEnd          *time.Time          `json:"actual_end"`
    CreatedAt          time.Time           `json:"created_at"`
    UpdatedAt          time.Time           `json:"updated_at"`
    Updates            []MaintenanceUpdate `json:"updates,omitempty"`
}

type MaintenanceUpdate struct {
    ID            int       `json:"id"`
    MaintenanceID int       `json:"maintenance_id"`
    Message       string    `json:"message"`
    Status        string    `json:"status"`
    CreatedAt     time.Time `json:"created_at"`
}
```

## Updates Automáticos

### Quando o Status Muda:

| Mudança de Status | Ação Automática | Mensagem |
|-------------------|-----------------|----------|
| → **Scheduled** | Cria update | "Maintenance has been scheduled." |
| → **In Progress** | Cria update + atualiza `actual_start` | "Maintenance is currently in progress." |
| → **Completed** | Cria update + atualiza `actual_end` | "Maintenance has been completed." |

### Notificações Slack:

- ✅ Enviadas automaticamente quando status muda
- ✅ Diferentes cores para cada status
- ✅ Inclui título, descrição e horários

## Frontend Public Page (✅ Implementado)

### Página: /maintenance-history

Exibe timeline completa com:

```
Network Maintenance
[completed badge]

Completed - Maintenance has been completed.
Jan 27, 10:00 UTC

Update - We are continuing with the maintenance work.
Jan 27, 08:30 UTC

In Progress - Maintenance is currently in progress.
Jan 27, 08:00 UTC

Scheduled - Scheduled maintenance for network upgrades.
Jan 20, 15:00 UTC
Scheduled Start: Jan 27, 08:00 UTC
Scheduled End: Jan 27, 10:00 UTC
```

### Cores por Status:

- 🔵 **Scheduled** (azul) - Manutenção agendada
- 🟡 **In Progress** (amarelo) - Em andamento
- 🟢 **Completed** (verde) - Concluída
- ⚪ **Update** (cinza) - Atualização de progresso

## Fluxo de Uso

### 1. Admin Cria Maintenance

```json
POST /api/admin/maintenances
{
  "title": "Network Maintenance",
  "description": "Scheduled maintenance for network upgrades.",
  "status": "scheduled",
  "scheduled_start": "2026-01-27T08:00:00Z",
  "scheduled_end": "2026-01-27T10:00:00Z"
}
```

**Timeline mostra:**
```
Scheduled - Scheduled maintenance for network upgrades.
Jan 20, 15:00 UTC
```

### 2. Admin Muda Status para "in_progress"

```json
PUT /api/admin/maintenances/1
{
  "status": "in_progress"
}
```

**Update automático criado:**
- `actual_start` = timestamp atual
- Mensagem: "Maintenance is currently in progress."

**Timeline mostra:**
```
In Progress - Maintenance is currently in progress.
Jan 27, 08:00 UTC

Scheduled - Scheduled maintenance for network upgrades.
Jan 20, 15:00 UTC
```

### 3. Admin Adiciona Update Manual (Opcional)

```json
POST /api/admin/maintenances/1/updates
{
  "message": "We are continuing with the maintenance work.",
  "status": "update"
}
```

**Timeline mostra:**
```
Update - We are continuing with the maintenance work.
Jan 27, 08:30 UTC

In Progress - Maintenance is currently in progress.
Jan 27, 08:00 UTC

Scheduled - Scheduled maintenance for network upgrades.
Jan 20, 15:00 UTC
```

### 4. Admin Muda Status para "completed"

```json
PUT /api/admin/maintenances/1
{
  "status": "completed"
}
```

**Update automático criado:**
- `actual_end` = timestamp atual
- Mensagem: "Maintenance has been completed."

**Timeline mostra:**
```
Completed - Maintenance has been completed.
Jan 27, 10:00 UTC

Update - We are continuing with the maintenance work.
Jan 27, 08:30 UTC

In Progress - Maintenance is currently in progress.
Jan 27, 08:00 UTC

Scheduled - Scheduled maintenance for network upgrades.
Jan 20, 15:00 UTC
```

## Campos Especiais

### actual_start
- ✅ Preenchido automaticamente quando status muda para "in_progress"
- ✅ Registra quando a manutenção realmente começou

### actual_end
- ✅ Preenchido automaticamente quando status muda para "completed"
- ✅ Registra quando a manutenção realmente terminou

### scheduled_start / scheduled_end
- ✅ Definidos na criação
- ✅ Mostram o horário planejado
- ✅ Podem ser diferentes dos horários reais (actual_start/actual_end)

## Comparação: Planejado vs Real

A timeline mostra ambos:

```
Completed - Maintenance has been completed.
Jan 27, 10:15 UTC  ← Horário real (actual_end)

In Progress - Maintenance is currently in progress.
Jan 27, 08:05 UTC  ← Horário real (actual_start)

Scheduled - Scheduled maintenance for network upgrades.
Jan 20, 15:00 UTC
Scheduled Start: Jan 27, 08:00 UTC  ← Horário planejado
Scheduled End: Jan 27, 10:00 UTC    ← Horário planejado
```

## Testando

### 1. Executar Migration

```bash
cd /Users/milleno/Documents/status/statuspage
psql -U postgres -d statuspage -f backend/database/migration_maintenance_updates.sql
```

### 2. Reiniciar Backend

O backend já está compilado com as alterações.

### 3. Testar no Backoffice

1. Acesse https://status.piercloud.com/area/maintenances
2. Crie uma nova maintenance com status "scheduled"
3. Edite e mude para "in_progress"
4. Veja o update automático ser criado
5. Mude para "completed"
6. Veja outro update automático

### 4. Verificar na Página Pública

1. Acesse https://status.piercloud.com/maintenance-history
2. Veja a timeline completa com todos os updates

## Resumo

### ✅ O que está pronto:

1. **Backend**
   - Tabela maintenance_updates criada (precisa executar migration)
   - Modelo MaintenanceUpdate adicionado
   - Handlers atualizados para incluir updates
   - Updates automáticos quando status muda
   - API endpoint para adicionar updates manuais
   - Backend compilado

2. **Frontend Public Page**
   - Página /maintenance-history atualizada
   - Timeline visual completa
   - Cores diferentes por status
   - Exibe horários planejados e reais
   - Build concluído

3. **Funcionalidades**
   - Updates automáticos em mudanças de status
   - Registro de actual_start e actual_end
   - Notificações Slack
   - Timeline ordenada cronologicamente

### ⏳ Próximos Passos (Opcional):

1. **Backoffice UI**
   - Adicionar botão "Add Update" em maintenances
   - Modal para adicionar updates personalizados
   - Visualizar timeline no backoffice

## Arquivos Modificados

- ✅ `backend/models/models.go` - Adicionado MaintenanceUpdate
- ✅ `backend/handlers/admin.go` - Updates automáticos e GetMaintenances
- ✅ `backend/handlers/public.go` - GetMaintenances com updates
- ✅ `backend/main.go` - Nova rota para updates
- ✅ `backend/database/migration_maintenance_updates.sql` - Nova tabela
- ✅ `frontend/public-page/src/pages/MaintenanceHistory.jsx` - Timeline visual
- ✅ Backend compilado
- ✅ Frontend buildado

**Tudo pronto! Só falta executar a migration do banco de dados.**
