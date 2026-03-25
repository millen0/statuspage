# Manutenção de Fevereiro 2026 - Implementação Completa

## ✅ O que foi feito

### 1. Banco de Dados
- ✅ Criada tabela `maintenance_updates` 
- ✅ Adicionada coluna `maintenance_id` na tabela `incidents`
- ✅ Inserida manutenção "Platform Maintenance - February 14-15, 2026" com status `completed`
- ✅ Criados 3 updates na timeline:
  - **Scheduled** (10 Feb, 10:00 UTC)
  - **In Progress** (14 Feb, 00:00 UTC)  
  - **Completed** (15 Feb, 18:30 UTC)
- ✅ Vinculados incidentes #3 e #4 à manutenção (maintenance_id = 1)

### 2. Backend (Go)
- ✅ Atualizado modelo `Incident` com campo `MaintenanceID`
- ✅ Atualizado `handlers/admin.go` para incluir `maintenance_id` nas queries
- ✅ Atualizado `handlers/public.go` para incluir `maintenance_id` nas queries de uptime
- ✅ API agora retorna `maintenance_id` nos incidentes

### 3. Frontend (React)
- ✅ Atualizado `UptimeTooltip.jsx` para mostrar mensagem de manutenção
- ✅ Quando um incidente tem `maintenance_id`, o tooltip mostra:
  - Ícone de ferramenta (wrench) em azul
  - Texto: "Occurred during scheduled maintenance"
- ✅ Mantido ícone vermelho na barra de uptime (apenas tooltip alterado)

## 🎯 Resultado

Ao passar o mouse nos dias 14 e 15 de fevereiro na barra de uptime:

```
┌─────────────────────────────────────┐
│ 14 Feb 2026                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ LIA Service Outage                  │
│ Service experiencing issues...      │
│ ✕ Major                             │
│ 🔧 Occurred during scheduled        │
│    maintenance                      │
└─────────────────────────────────────┘
```

## 📦 Deploy

Execute no servidor:

```bash
cd /opt/statuspage
./deploy-maintenance-tooltip.sh
```

Ou manualmente:

```bash
# Backend
cd backend
go build -o statuspage
sudo systemctl restart statuspage-backend

# Frontend
cd frontend/public-page
npm run build
# Copiar build para nginx
```

## 🔍 Verificação

1. Acesse: https://status.piercloud.com
2. Localize os serviços LIA e Lighthouse-Backend
3. Passe o mouse sobre os dias 14 e 15 de fevereiro na barra de uptime
4. Verifique se aparece a mensagem "Occurred during scheduled maintenance"

## 📊 Dados Vinculados

| Incident ID | Service | Date | Maintenance ID |
|-------------|---------|------|----------------|
| 4 | LIA | 2026-02-14 | 1 |
| 3 | Lighthouse-Backend | 2026-02-15 | 1 |

## 🌐 URLs

- Status Page: https://status.piercloud.com
- Maintenances: https://status.piercloud.com/area/maintenances
- History: https://status.piercloud.com/maintenance-history
