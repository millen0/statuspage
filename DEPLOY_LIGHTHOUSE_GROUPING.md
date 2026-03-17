# 🚀 Deploy - Agrupamento LIGHTHOUSE

## 📋 O que será feito

Este deploy implementa o agrupamento de serviços no modo uptime. Os seguintes serviços serão agrupados sob o nome **LIGHTHOUSE**:

- LOGIN
- WEBSOCKET
- LAKE
- LIGHTHOUSE-BACKEND
- DATA
- NLB - KONG
- AUTH

**Importante:** Alguns desses serviços podem estar ocultos (`is_visible = false`), mas continuarão sendo monitorados. O grupo LIGHTHOUSE mostrará o uptime agregado de todos eles.

## 🔧 Arquivos Criados/Modificados

### Novos Arquivos:
1. `backend/database/migration_service_groups.sql` - Tabelas de agrupamento
2. `update-group-uptime.py` - Script para calcular uptime agregado
3. `deploy-lighthouse-grouping.sh` - Script de deploy automatizado
4. `DEPLOY_LIGHTHOUSE_GROUPING.md` - Este guia

### Arquivos Modificados:
1. `backend/handlers/admin.go` - Removido link de manutenções do email
2. `send-scheduled-maintenance-emails.py` - Removido link de manutenções
3. `test-maintenance-email.py` - Removido link de manutenções
4. `frontend/backoffice/src/pages/Maintenances.jsx` - Ajuste de timezone para SP

## 📦 Passo 1: Commit e Push

```bash
cd /Users/milleno/Documents/status/statuspage

# Verificar arquivos modificados
git status

# Adicionar todos os arquivos
git add .

# Commit
git commit -m "feat: Implementa agrupamento LIGHTHOUSE para uptime agregado

- Adiciona tabelas service_groups e service_group_members
- Cria script update-group-uptime.py para calcular uptime agregado
- Agrupa serviços: LOGIN, WEBSOCKET, LAKE, LIGHTHOUSE-BACKEND, DATA, NLB-KONG, AUTH
- Serviços ocultos continuam sendo monitorados no grupo
- Remove link de manutenções dos emails
- Ajusta timezone do formulário de manutenção para horário de SP"

# Push para o repositório
git push origin main
```

## 🚀 Passo 2: Deploy na EC2

### 2.1 Conectar na EC2
```bash
ssh ubuntu@<IP_DA_EC2>
```

### 2.2 Atualizar código
```bash
cd /opt/statuspage

# Pull das últimas alterações
git pull origin main

# Verificar se os arquivos foram atualizados
ls -la backend/database/migration_service_groups.sql
ls -la update-group-uptime.py
ls -la deploy-lighthouse-grouping.sh
```

### 2.3 Executar deploy automatizado
```bash
cd /opt/statuspage
bash deploy-lighthouse-grouping.sh
```

O script vai:
1. ✅ Aplicar migrations no banco
2. ✅ Verificar serviços que serão agrupados
3. ✅ Recompilar backend Go
4. ✅ Reiniciar backend
5. ✅ Calcular uptime inicial do grupo
6. ✅ Configurar cron job para atualização diária
7. ✅ Verificar status final

## 🔍 Passo 3: Verificação

### 3.1 Verificar grupo criado
```bash
cd /opt/statuspage
source backend/.env

PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
    sg.display_name,
    COUNT(sgm.service_id) as total_services
FROM service_groups sg
LEFT JOIN service_group_members sgm ON sg.id = sgm.group_id
WHERE sg.name = 'lighthouse'
GROUP BY sg.display_name;
"
```

Deve mostrar:
```
 display_name | total_services 
--------------+----------------
 LIGHTHOUSE   |              7
```

### 3.2 Verificar serviços membros
```bash
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT s.name, s.is_visible, s.status
FROM services s
INNER JOIN service_group_members sgm ON s.id = sgm.service_id
INNER JOIN service_groups sg ON sgm.group_id = sg.id
WHERE sg.name = 'lighthouse'
ORDER BY s.name;
"
```

### 3.3 Verificar uptime calculado
```bash
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT date, status, uptime_percentage
FROM service_uptime_logs
WHERE service_id < 0
ORDER BY date DESC
LIMIT 10;
"
```

### 3.4 Verificar cron job
```bash
crontab -l | grep group-uptime
```

Deve mostrar:
```
55 23 * * * cd /opt/statuspage && /usr/bin/python3 update-group-uptime.py >> /var/log/statuspage/group-uptime.log 2>&1
```

### 3.5 Testar script manualmente
```bash
cd /opt/statuspage
python3 update-group-uptime.py
```

### 3.6 Verificar logs
```bash
# Logs do backend
sudo journalctl -u statuspage-backend -f

# Logs do script de uptime
tail -f /var/log/statuspage/group-uptime.log
```

## 🌐 Passo 4: Verificar na Página Pública

1. Acesse: https://statuspage.piercloud.io/
2. Verifique se o card **LIGHTHOUSE** aparece no modo uptime
3. Verifique se os 90 dias de uptime estão sendo exibidos
4. Passe o mouse sobre as barras para ver os detalhes de cada dia

## 🔧 Troubleshooting

### Problema: Grupo não aparece na página
**Solução:**
```bash
# Verificar se o grupo está ativo
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT * FROM service_groups WHERE name = 'lighthouse';
"

# Verificar se tem membros
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT COUNT(*) FROM service_group_members WHERE group_id = (SELECT id FROM service_groups WHERE name = 'lighthouse');
"
```

### Problema: Nomes de serviços não correspondem
**Solução:**
```bash
# Listar todos os serviços
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT id, name FROM services ORDER BY name;
"

# Ajustar manualmente os membros do grupo
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
DELETE FROM service_group_members WHERE group_id = (SELECT id FROM service_groups WHERE name = 'lighthouse');

INSERT INTO service_group_members (group_id, service_id)
SELECT 
    (SELECT id FROM service_groups WHERE name = 'lighthouse'),
    s.id
FROM services s
WHERE s.name IN ('NOME_CORRETO_1', 'NOME_CORRETO_2', ...)
ON CONFLICT DO NOTHING;
"
```

### Problema: Uptime não está sendo calculado
**Solução:**
```bash
# Executar manualmente com debug
cd /opt/statuspage
python3 -u update-group-uptime.py

# Verificar se os serviços têm dados de uptime
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT s.name, COUNT(sul.id) as uptime_logs
FROM services s
LEFT JOIN service_uptime_logs sul ON s.id = sul.service_id
WHERE s.name IN ('LOGIN', 'WEBSOCKET', 'LAKE', 'LIGHTHOUSE-BACKEND', 'DATA', 'NLB - KONG', 'AUTH')
GROUP BY s.name;
"
```

## 📊 Como Funciona

1. **Monitoramento Individual**: Cada serviço continua sendo monitorado individualmente
2. **Cálculo Agregado**: O script `update-group-uptime.py` roda diariamente às 23:55
3. **Lógica de Agregação**:
   - Se QUALQUER serviço do grupo tiver problema, o grupo mostra problema
   - O uptime é a média dos uptimes individuais
   - Se algum serviço está em outage, o uptime do grupo é limitado a 50%
4. **Exibição**: O grupo LIGHTHOUSE aparece como um card único no modo uptime
5. **Serviços Ocultos**: Continuam sendo monitorados e afetam o uptime do grupo

## 🎯 Resultado Esperado

Na página pública, você verá:
- Um card chamado **LIGHTHOUSE**
- 90 barras representando os últimos 90 dias
- Barras verdes = 100% uptime
- Barras amarelas = degraded (97-99%)
- Barras vermelhas = outage (<50%)
- Percentual de uptime geral dos últimos 90 dias

## 📝 Notas Importantes

- O script roda automaticamente todos os dias às 23:55
- Serviços ocultos (`is_visible = false`) continuam sendo monitorados
- O uptime do grupo reflete o pior cenário entre os serviços membros
- Você pode adicionar/remover serviços do grupo editando a tabela `service_group_members`

## 🆘 Suporte

Se encontrar problemas:
1. Verifique os logs: `sudo journalctl -u statuspage-backend -f`
2. Execute o script manualmente: `python3 update-group-uptime.py`
3. Verifique o banco de dados com as queries acima
4. Compartilhe os logs para análise
