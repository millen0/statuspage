# Implementação de Timeline de Incidents

## Visão Geral

Sistema de timeline de incidents similar ao Cloudflare Status, com múltiplos status e updates editáveis.

## Status do Incident

1. **Investigating** - Investigando o problema
2. **Identified** - Problema identificado
3. **Monitoring** - Monitorando a solução
4. **Resolved** - Problema resolvido

## Estrutura de Dados

### Banco de Dados (JÁ IMPLEMENTADO)

```sql
CREATE TABLE incidents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'investigating',
    service_id INTEGER REFERENCES services(id),
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE TABLE incident_updates (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Backend (JÁ IMPLEMENTADO)

#### Rotas Disponíveis:

- `GET /api/admin/incidents` - Lista todos os incidents com seus updates
- `POST /api/admin/incidents` - Cria um novo incident
- `PUT /api/admin/incidents/{id}` - Atualiza um incident
- `DELETE /api/admin/incidents/{id}` - Deleta um incident
- `POST /api/admin/incidents/{id}/updates` - Adiciona um update ao incident
- `PATCH /api/admin/incidents/{id}/visibility` - Toggle visibilidade

#### Modelo de Dados:

```go
type Incident struct {
    ID          int              `json:"id"`
    Title       string           `json:"title"`
    Description string           `json:"description"`
    Severity    string           `json:"severity"`
    Status      string           `json:"status"`
    ServiceID   *int             `json:"service_id"`
    IsVisible   bool             `json:"is_visible"`
    CreatedAt   time.Time        `json:"created_at"`
    UpdatedAt   time.Time        `json:"updated_at"`
    ResolvedAt  *time.Time       `json:"resolved_at"`
    Updates     []IncidentUpdate `json:"updates,omitempty"`
}

type IncidentUpdate struct {
    ID         int       `json:"id"`
    IncidentID int       `json:"incident_id"`
    Message    string    `json:"message"`
    Status     string    `json:"status"`
    CreatedAt  time.Time `json:"created_at"`
}
```

## Frontend - Backoffice

### 1. Atualizar a Página de Incidents

Arquivo: `/frontend/backoffice/src/pages/Incidents.jsx`

#### Mudanças Necessárias:

1. **Adicionar botão "Add Update" em cada incident**
2. **Criar modal para adicionar updates**
3. **Exibir timeline de updates**
4. **Atualizar formulário de criação/edição**

#### Exemplo de Timeline UI:

```jsx
<div className="timeline">
  {/* Resolved */}
  <div className="timeline-item resolved">
    <div className="timeline-marker"></div>
    <div className="timeline-content">
      <div className="timeline-header">
        <span className="status-badge resolved">Resolved</span>
        <span className="timestamp">Mar 21, 08:45 UTC</span>
      </div>
      <p>This incident has been resolved.</p>
    </div>
  </div>

  {/* Updates */}
  {incident.updates.map(update => (
    <div key={update.id} className="timeline-item update">
      <div className="timeline-marker"></div>
      <div className="timeline-content">
        <div className="timeline-header">
          <span className="status-badge update">Update</span>
          <span className="timestamp">{formatDate(update.created_at)}</span>
        </div>
        <p>{update.message}</p>
      </div>
    </div>
  ))}

  {/* Identified */}
  <div className="timeline-item identified">
    <div className="timeline-marker"></div>
    <div className="timeline-content">
      <div className="timeline-header">
        <span className="status-badge identified">Identified</span>
        <span className="timestamp">Mar 20, 11:21 UTC</span>
      </div>
      <p>The issue has been identified and a fix is being implemented.</p>
    </div>
  </div>

  {/* Investigating */}
  <div className="timeline-item investigating">
    <div className="timeline-marker"></div>
    <div className="timeline-content">
      <div className="timeline-header">
        <span className="status-badge investigating">Investigating</span>
        <span className="timestamp">{formatDate(incident.created_at)}</span>
      </div>
      <p>{incident.description}</p>
    </div>
  </div>
</div>
```

### 2. Componente de Timeline

Criar: `/frontend/backoffice/src/components/IncidentTimeline.jsx`

```jsx
import React from 'react';

export default function IncidentTimeline({ incident, onAddUpdate }) {
  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved': return 'bg-green-500';
      case 'monitoring': return 'bg-blue-500';
      case 'identified': return 'bg-yellow-500';
      case 'investigating': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-4">
      {/* Botão para adicionar update */}
      <button
        onClick={onAddUpdate}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Add Update
      </button>

      {/* Timeline */}
      <div className="relative border-l-2 border-gray-300 pl-6 space-y-6">
        {/* Status atual do incident */}
        <div className="relative">
          <div className={`absolute -left-8 w-4 h-4 rounded-full ${getStatusColor(incident.status)}`}></div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex justify-between items-start mb-2">
              <span className={`px-3 py-1 rounded text-sm font-medium text-white ${getStatusColor(incident.status)}`}>
                {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
              </span>
              <span className="text-sm text-gray-500">
                {formatDate(incident.updated_at)}
              </span>
            </div>
            <p className="text-gray-700">{incident.description}</p>
          </div>
        </div>

        {/* Updates */}
        {incident.updates && incident.updates.map((update) => (
          <div key={update.id} className="relative">
            <div className={`absolute -left-8 w-4 h-4 rounded-full ${getStatusColor(update.status)}`}></div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-start mb-2">
                <span className="px-3 py-1 rounded text-sm font-medium bg-gray-200 text-gray-700">
                  Update
                </span>
                <span className="text-sm text-gray-500">
                  {formatDate(update.created_at)}
                </span>
              </div>
              <p className="text-gray-700">{update.message}</p>
            </div>
          </div>
        ))}

        {/* Criação do incident */}
        <div className="relative">
          <div className="absolute -left-8 w-4 h-4 rounded-full bg-gray-400"></div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex justify-between items-start mb-2">
              <span className="px-3 py-1 rounded text-sm font-medium bg-gray-200 text-gray-700">
                Created
              </span>
              <span className="text-sm text-gray-500">
                {formatDate(incident.created_at)}
              </span>
            </div>
            <p className="text-gray-700">Incident created: {incident.title}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 3. Modal para Adicionar Update

Criar: `/frontend/backoffice/src/components/AddUpdateModal.jsx`

```jsx
import React, { useState } from 'react';

export default function AddUpdateModal({ incident, onClose, onSave }) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('update');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`/api/admin/incidents/${incident.id}/updates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ message, status })
      });

      if (response.ok) {
        onSave();
        onClose();
      }
    } catch (error) {
      console.error('Error adding update:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Add Incident Update</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              required
            >
              <option value="investigating">Investigating</option>
              <option value="identified">Identified</option>
              <option value="monitoring">Monitoring</option>
              <option value="resolved">Resolved</option>
              <option value="update">Update</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              rows="4"
              required
              placeholder="We are continuing to work on a fix for this issue..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### 4. Atualizar Página de Incidents

Modificar: `/frontend/backoffice/src/pages/Incidents.jsx`

Adicionar:
- Import dos novos componentes
- Estado para controlar modal de update
- Função para adicionar update
- Renderizar timeline em vez de lista simples

## Frontend - Public Page

### Atualizar IncidentTimeline.jsx

Arquivo: `/frontend/public-page/src/components/IncidentTimeline.jsx`

Modificar para exibir a timeline completa com todos os updates.

## Exemplo de Uso

### 1. Criar Incident

```json
POST /api/admin/incidents
{
  "title": "Network Performance Issues in Jakarta",
  "description": "Cloudflare is investigating issues with Network Performance for customers in the Jakarta area",
  "severity": "major",
  "status": "investigating",
  "service_id": 1,
  "is_visible": true
}
```

### 2. Adicionar Update

```json
POST /api/admin/incidents/1/updates
{
  "message": "The issue has been identified and a fix is being implemented.",
  "status": "identified"
}
```

### 3. Adicionar Mais Updates

```json
POST /api/admin/incidents/1/updates
{
  "message": "We are continuing to work on a fix for this issue.",
  "status": "update"
}
```

### 4. Resolver Incident

```json
PUT /api/admin/incidents/1
{
  "status": "resolved"
}

POST /api/admin/incidents/1/updates
{
  "message": "This incident has been resolved.",
  "status": "resolved"
}
```

## Próximos Passos

1. ✅ Backend implementado
2. ⏳ Criar componentes de timeline no backoffice
3. ⏳ Atualizar página de incidents no backoffice
4. ⏳ Atualizar página pública para exibir timeline
5. ⏳ Adicionar estilos CSS para timeline
6. ⏳ Testar fluxo completo

## Notas

- O backend já está pronto e compilado
- Os updates são ordenados por data (mais recente primeiro)
- Cada update pode ter um status diferente
- O status do incident principal é atualizado separadamente
- Notificações Slack são enviadas automaticamente para novos incidents e updates
