# 🔍 Troubleshooting - Emails de Manutenção

## Problema
Emails de manutenção não estão sendo recebidos (nem no spam)

## Passos para Diagnosticar

### 1. Na EC2, execute o script de verificação:
```bash
cd /opt/statuspage
bash check-email-logs.sh
```

Isso vai mostrar:
- ✅ Se o backend está rodando
- 📋 Logs de email
- ⚙️ Configurações SMTP
- 📊 Últimas manutenções criadas
- ⏰ Cron jobs configurados

### 2. Execute o teste de email:
```bash
cd /opt/statuspage
python3 test-maintenance-email.py
```

Este script vai:
- Verificar todas as configurações
- Carregar o template
- Enviar um email de teste
- Mostrar erros detalhados se houver

### 3. Verificar pontos comuns:

#### A) Email está marcado para enviar?
Quando você cria a manutenção, precisa marcar o checkbox:
- ☑️ "Send email notification to subscribers"

#### B) Horário de envio
- Se você deixou o campo "Email Send Time" **vazio** → envia imediatamente
- Se você preencheu → envia apenas quando chegar o horário

#### C) Email já foi enviado?
O sistema marca `email_sent = true` após enviar. Se você editar a manutenção, ele NÃO reenvia.

#### D) Tem subscribers ativos?
```sql
SELECT COUNT(*) FROM subscribers WHERE is_active = true;
```

### 4. Verificar logs do backend em tempo real:
```bash
# Se estiver usando systemd:
sudo journalctl -u statuspage-backend -f | grep EMAIL

# Ou se tiver arquivo de log:
tail -f /var/log/statuspage/backend.log | grep EMAIL
```

### 5. Forçar reenvio de email (se necessário):
```sql
-- Conectar no banco
psql -h <DB_HOST> -U <DB_USER> -d statuspage

-- Marcar como não enviado
UPDATE maintenances 
SET email_sent = false 
WHERE id = <ID_DA_MANUTENCAO>;

-- Verificar
SELECT id, title, send_email, email_sent FROM maintenances ORDER BY created_at DESC LIMIT 5;
```

Depois, o cron job vai enviar na próxima execução (a cada 5 minutos).

### 6. Testar SMTP manualmente:
```bash
cd /opt/statuspage
python3 << EOF
import smtplib
import ssl
from email.mime.text import MIMEText
import os
from dotenv import load_dotenv

load_dotenv('backend/.env')

SMTP_HOST = os.getenv('SMTP_HOST')
SMTP_PORT = int(os.getenv('SMTP_PORT', 587))
SMTP_USER = os.getenv('SMTP_USERNAME')
SMTP_PASS = os.getenv('SMTP_PASSWORD')
FROM_EMAIL = os.getenv('SES_FROM_EMAIL')

print(f"Testando: {SMTP_HOST}:{SMTP_PORT}")
print(f"User: {SMTP_USER}")
print(f"From: {FROM_EMAIL}")

context = ssl.create_default_context()
with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
    server.set_debuglevel(1)
    server.starttls(context=context)
    server.login(SMTP_USER, SMTP_PASS)
    
    msg = MIMEText("Teste de email", 'plain')
    msg['Subject'] = "Teste SMTP"
    msg['From'] = FROM_EMAIL
    msg['To'] = "SEU_EMAIL_AQUI@example.com"
    
    server.send_message(msg)
    print("✅ Email enviado!")
EOF
```

## Checklist Rápido

- [ ] Backend está rodando?
- [ ] Configurações SMTP estão corretas no .env?
- [ ] Template existe em `/opt/statuspage/templates/email_maintenance_template.html`?
- [ ] Tem subscribers ativos no banco?
- [ ] Manutenção foi criada com `send_email = true`?
- [ ] Email ainda não foi enviado (`email_sent = false`)?
- [ ] Horário de envio já passou (ou está vazio)?
- [ ] Cron job está configurado? (`crontab -l`)

## Arquivos Importantes

- **Backend**: `/opt/statuspage/backend/statuspage`
- **Template**: `/opt/statuspage/templates/email_maintenance_template.html`
- **Env**: `/opt/statuspage/backend/.env`
- **Cron**: `crontab -l` (deve ter `send-scheduled-maintenance-emails.py`)
- **Logs**: `/var/log/statuspage/` ou `journalctl -u statuspage-backend`

## Comandos Úteis

```bash
# Ver status do backend
systemctl status statuspage-backend

# Reiniciar backend
sudo systemctl restart statuspage-backend

# Ver logs em tempo real
sudo journalctl -u statuspage-backend -f

# Executar script de email manualmente
cd /opt/statuspage
python3 send-scheduled-maintenance-emails.py

# Ver cron jobs
crontab -l

# Testar conexão SMTP
telnet email-smtp.us-east-1.amazonaws.com 587
```

## Próximos Passos

1. Execute `check-email-logs.sh` na EC2
2. Execute `test-maintenance-email.py` na EC2
3. Compartilhe a saída dos scripts para análise
4. Verifique se o email de teste chegou
