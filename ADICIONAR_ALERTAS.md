# Como Adicionar Alertas ao Painel de Status

## Resumo
Este guia mostra como adicionar alertas de downtime que não apareceram no tooltip do painel.

## Alerta Adicionado
- **Serviço**: AUTH
- **Data**: 9/03/2026 (2026-03-09)
- **Horário**: 11:18 AM - 11:19 AM
- **Duração**: 1 minuto
- **Status**: operational → outage → operational

## Passos para Atualizar

### 1. Adicionar Novos Alertas
Edite o arquivo `populate-downtime-from-alerts.py` e adicione novos alertas na lista `downtimes`:

```python
downtimes = [
    ('AUTH', '2026-03-09', 1, 'Service Status Changed: operational -> outage -> operational'),
    # Adicione mais alertas aqui
    # ('NOME_SERVICO', 'YYYY-MM-DD', minutos_downtime, 'descrição'),
]
```

### 2. Executar o Script na EC2
```bash
# Conectar na EC2
ssh ec2-user@status.piercloud.com

# Ir para o diretório do projeto
cd /opt/statuspage

# Executar o script para popular os dados
python3 populate-downtime-from-alerts.py --populate

# Verificar se foi adicionado corretamente
python3 populate-downtime-from-alerts.py --verify 2026-03-09
```

### 3. Atualizar o Código (se necessário)
Se você fez alterações no código:

```bash
cd /opt/statuspage
git status
git stash  # Se houver mudanças locais
git pull   # Atualizar código
./deploy-ec2.sh
```

## Verificação
Após executar o script:
1. Acesse https://status.piercloud.com
2. Passe o mouse sobre a barra do dia 9/03/2026 no serviço AUTH
3. O tooltip deve mostrar:
   - Data: 9 Mar 2026
   - Downtime: 1 min
   - Uptime: 99.93%

## Formato de Data
- **Alerta Slack**: 9/03/2026
- **Formato Script**: 2026-03-09 (YYYY-MM-DD)

## Cálculo de Uptime
- 1 minuto de downtime em 1440 minutos (24h) = 99.93% uptime
- 5 minutos = 99.65% uptime
- 30 minutos = 97.92% uptime
- 1 hora = 95.83% uptime
- 2 horas = 91.67% uptime

## Cores no Painel
- 🟢 Verde (99%+): Operational / Minor Issues
- 🟡 Amarelo (95-99%): Degraded Performance
- 🟠 Laranja (50-95%): Partial Outage
- 🔴 Vermelho (<50%): Major Outage

## Troubleshooting

### Serviço não encontrado
Se aparecer "Serviço 'AUTH' não encontrado no banco":
```bash
# Verificar serviços no banco
docker-compose exec postgres psql -U postgres -d statuspage -c "SELECT id, name FROM services;"
```

### Verificar logs de uptime
```bash
# Ver todos os downtimes registrados
python3 populate-downtime-from-alerts.py --verify

# Ver downtime de uma data específica
python3 populate-downtime-from-alerts.py --verify 2026-03-09
```

## Notas Importantes
- O script usa `ON CONFLICT` para não duplicar registros
- Se já existe um registro para a data, ele mantém o MENOR uptime (pior cenário)
- Os dados são atualizados automaticamente no painel a cada 5 minutos
- Não é necessário reiniciar o backend após executar o script
