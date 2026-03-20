# Sistema Automático de Tracking de Downtime

Sistema que captura automaticamente downtimes dos serviços e atualiza o histórico de uptime em tempo real.

## 🎯 Funcionalidades

- ✅ **Tracking Automático**: Registra início e fim de downtimes automaticamente
- ✅ **Cálculo de Uptime**: Calcula uptime diário baseado em downtimes reais
- ✅ **Integração com Monitor**: Funciona junto com o sistema de monitoramento existente
- ✅ **Histórico Persistente**: Mantém histórico de 90 dias no tooltip
- ✅ **Alertas Slack**: Continua enviando alertas quando configurado

## 📋 Arquitetura

```
Monitor → Detecta Down/Up → auto-track-downtime.py → Registra em service_downtimes
                                                    ↓
                                              Calcula Uptime Diário
                                                    ↓
                                              Atualiza uptime_logs
                                                    ↓
                                              Frontend exibe no tooltip
```

## 🚀 Setup Inicial

### 1. Criar Tabela de Downtimes

```bash
cd /opt/statuspage
python3 auto-track-downtime.py --setup
```

Isso cria a tabela `service_downtimes`:
- `id`: ID do downtime
- `service_id`: Referência ao serviço
- `started_at`: Quando o downtime começou
- `ended_at`: Quando o downtime terminou (NULL se ainda em andamento)
- `error_message`: Mensagem de erro
- `status`: 'ongoing' ou 'resolved'

### 2. Substituir Monitor Atual

```bash
# Backup do monitor atual
cp monitor.py monitor.py.backup

# Usar novo monitor com tracking
cp monitor-with-tracking.py monitor.py

# Ou criar link simbólico
ln -sf monitor-with-tracking.py monitor.py
```

### 3. Configurar Cron (se ainda não estiver)

```bash
# Editar crontab
crontab -e

# Adicionar (executa a cada minuto)
* * * * * cd /opt/statuspage && python3 monitor.py >> monitor.log 2>&1
```

## 📊 Como Funciona

### Quando um Serviço Cai

1. Monitor detecta falha após N retries
2. `auto-track-downtime.py --down SERVICE_NAME "Error message"` é chamado
3. Registro é criado em `service_downtimes` com `status='ongoing'`
4. Estado é salvo em `downtime-state.json`

### Quando um Serviço Recupera

1. Monitor detecta que serviço voltou
2. `auto-track-downtime.py --up SERVICE_NAME` é chamado
3. Registro em `service_downtimes` é atualizado com `ended_at` e `status='resolved'`
4. **Uptime do dia é recalculado automaticamente**
5. Registro é atualizado em `uptime_logs`

### Cálculo de Uptime

```python
# Exemplo: Serviço ficou down por 2 horas (120 minutos)
total_minutes = 1440  # 24 horas
downtime_minutes = 120
uptime_minutes = 1440 - 120 = 1320
uptime_percentage = (1320 / 1440) * 100 = 91.67%
```

## 🛠️ Comandos Úteis

### Ver Downtimes em Andamento

```bash
python3 auto-track-downtime.py --status
```

### Registrar Downtime Manualmente

```bash
# Marcar serviço como down
python3 auto-track-downtime.py --down "lighthouse-backend" "Request failed with status code 503"

# Marcar serviço como up
python3 auto-track-downtime.py --up "lighthouse-backend"
```

### Recalcular Uptime de um Dia

```bash
# Útil para corrigir dados históricos
python3 auto-track-downtime.py --recalculate 2025-02-15
```

### Ver Logs do Monitor

```bash
tail -f /opt/statuspage/monitor.log
```

### Verificar Uptime Logs no Banco

```bash
cd /opt/statuspage
source backend/.env

PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
    s.name,
    ul.date,
    ul.uptime_percentage
FROM uptime_logs ul
JOIN services s ON s.id = ul.service_id
WHERE ul.uptime_percentage < 100
ORDER BY ul.date DESC
LIMIT 20;
"
```

## 🔧 Troubleshooting

### Downtime não está sendo registrado

1. Verificar se tabela existe:
```bash
python3 auto-track-downtime.py --setup
```

2. Verificar permissões do arquivo:
```bash
chmod +x auto-track-downtime.py
chmod +x monitor-with-tracking.py
```

3. Verificar logs:
```bash
tail -50 monitor.log
```

### Uptime não aparece no frontend

1. Verificar se dados estão no banco:
```bash
python3 populate-downtime-from-alerts.py --verify 2025-02-15
```

2. Limpar cache do navegador (Ctrl+Shift+R)

3. Verificar se a data está dentro dos últimos 90 dias

### Recalcular Histórico Completo

```bash
# Para cada dia com downtime
for date in 2025-02-15 2025-02-16 2025-02-17; do
    python3 auto-track-downtime.py --recalculate $date
done
```

## 📈 Exemplo de Uso Completo

### Cenário: Lighthouse-Backend ficou down no dia 15/02/2025

```bash
# 1. Setup inicial (apenas uma vez)
python3 auto-track-downtime.py --setup

# 2. Popular downtime histórico (se já passou)
python3 populate-downtime-from-alerts.py --populate

# 3. Verificar se foi registrado
python3 auto-track-downtime.py --recalculate 2025-02-15

# 4. Ver no frontend
# Acesse https://status.piercloud.com/
# Passe o mouse sobre a barra do dia 15/02/2025
# Tooltip mostrará o downtime
```

## 🎨 Cores no Tooltip

- 🔴 **Vermelho**: Uptime < 50% (Major Outage)
- 🟡 **Amarelo**: Uptime 50-98.99% (Degraded Performance)
- 🟢 **Verde**: Uptime ≥ 99% (Operational)

## 📝 Notas Importantes

1. **Merge Automático**: Sistema sempre mantém o MENOR uptime (pior cenário)
2. **Histórico de 90 dias**: Frontend mostra últimos 91 dias
3. **Cache no Frontend**: Preserva histórico durante navegação
4. **Precisão**: Uptime é calculado com precisão de minutos
5. **Timezone**: Todos os timestamps são em UTC

## 🔄 Migração de Dados Antigos

Se você tem alertas antigos do Slack e quer popular o histórico:

1. Edite `populate-downtime-from-alerts.py`
2. Adicione os downtimes na lista
3. Execute: `python3 populate-downtime-from-alerts.py --populate`

## 🚨 Alertas

O sistema continua enviando alertas para o Slack quando configurado:
- 🔴 Alerta quando serviço cai
- 🟢 Alerta quando serviço recupera
- ⚠️ Alerta para status codes inesperados
