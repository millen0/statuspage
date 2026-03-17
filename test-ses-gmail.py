#!/usr/bin/python3
"""
Script para verificar SES e enviar email de teste para Gmail
"""
import psycopg2
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import ssl
from dotenv import load_dotenv

load_dotenv('/opt/statuspage/backend/.env')
load_dotenv('backend/.env')

DB_CONFIG = {
    'host': os.getenv('DB_HOST', '127.0.0.1'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres'),
    'database': os.getenv('DB_NAME', 'statuspage')
}

SMTP_HOST = os.getenv('SMTP_HOST')
SMTP_PORT = int(os.getenv('SMTP_PORT', 587))
SMTP_USER = os.getenv('SMTP_USERNAME')
SMTP_PASS = os.getenv('SMTP_PASSWORD')
FROM_EMAIL = os.getenv('SES_FROM_EMAIL')

print("="*70)
print("🔍 DIAGNÓSTICO DE EMAIL - AWS SES")
print("="*70)

# Verificar subscribers
print("\n📧 Subscribers cadastrados:")
conn = psycopg2.connect(**DB_CONFIG)
cur = conn.cursor()
cur.execute("SELECT email, is_active FROM subscribers ORDER BY created_at")
for email, is_active in cur.fetchall():
    status = "✅ Ativo" if is_active else "❌ Inativo"
    print(f"   {email} - {status}")

print("\n" + "="*70)
print("⚠️  IMPORTANTE: AWS SES - Modo Sandbox")
print("="*70)
print("""
Se sua conta AWS SES está em SANDBOX MODE, você só pode enviar emails para:
1. Endereços de email VERIFICADOS no SES
2. Domínios VERIFICADOS no SES

Para verificar:
1. Acesse: https://console.aws.amazon.com/ses/
2. Vá em "Account Dashboard"
3. Verifique se está em "Sandbox" ou "Production"

Se estiver em SANDBOX:
- Você precisa VERIFICAR cada email que vai receber
- OU solicitar saída do sandbox (Production Access)

Para verificar um email:
1. No SES Console, vá em "Verified identities"
2. Clique em "Create identity"
3. Escolha "Email address"
4. Digite: millenomatos@gmail.com
5. Clique em "Create identity"
6. Verifique o email no Gmail e clique no link de confirmação
""")

print("\n" + "="*70)
print("🧪 TESTE: Enviar email para millenomatos@gmail.com")
print("="*70)

template_path = 'templates/email_maintenance_template.html'
if not os.path.exists(template_path):
    template_path = '/opt/statuspage/templates/email_maintenance_template.html'

with open(template_path, 'r', encoding='utf-8') as f:
    template = f.read()

maintenance_content = """<p style="line-height: inherit; margin: 0px;">
    <strong>Prezados clientes e parceiros,</strong><br><br>
    Este é um <strong>EMAIL DE TESTE</strong> do sistema de manutenção.<br><br>
    <strong>Teste de Envio</strong><br><br>
    Se você recebeu este email, o sistema está funcionando corretamente!<br><br>
    <strong>Data/Hora:</strong> Agora<br><br>
</p>"""

html_body = template.replace('{{MAINTENANCE_CONTENT}}', maintenance_content)

test_email = "millenomatos@gmail.com"
print(f"\n📧 Tentando enviar para: {test_email}")

try:
    context = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls(context=context)
        server.login(SMTP_USER, SMTP_PASS)
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = "TESTE - Informe Plataforma Pier Cloud"
        msg['From'] = FROM_EMAIL
        msg['To'] = test_email
        
        msg.attach(MIMEText(html_body, 'html'))
        result = server.send_message(msg)
        
        print(f"\n✅ Email enviado com sucesso!")
        print(f"📬 Verifique:")
        print(f"   1. Caixa de entrada do Gmail")
        print(f"   2. Pasta de SPAM")
        print(f"   3. Pasta de Promoções")
        print(f"   4. Aguarde alguns minutos (pode demorar)")
        
except smtplib.SMTPRecipientsRefused as e:
    print(f"\n❌ ERRO: Email rejeitado pelo SES!")
    print(f"   Detalhes: {e}")
    print(f"\n⚠️  SOLUÇÃO:")
    print(f"   Sua conta SES está em SANDBOX MODE")
    print(f"   Você precisa VERIFICAR o email: {test_email}")
    print(f"   Ou solicitar Production Access no AWS SES")
    
except Exception as e:
    print(f"\n❌ Erro ao enviar: {e}")
    import traceback
    traceback.print_exc()

cur.close()
conn.close()

print("\n" + "="*70)
print("📋 PRÓXIMOS PASSOS")
print("="*70)
print("""
1. Verifique se o email chegou no Gmail (inbox ou spam)

2. Se NÃO chegou, verifique o SES:
   aws ses get-account-sending-enabled --region us-east-1
   aws ses get-send-quota --region us-east-1

3. Para sair do Sandbox (Production Access):
   - Acesse: https://console.aws.amazon.com/ses/
   - Clique em "Account Dashboard"
   - Clique em "Request production access"
   - Preencha o formulário explicando o uso

4. Enquanto estiver em Sandbox, VERIFIQUE cada email:
   - No SES Console > Verified identities > Create identity
   - Adicione: millenomatos@gmail.com
   - Confirme no Gmail

5. Verificar logs do SES:
   - CloudWatch Logs
   - SES > Sending Statistics
""")

print("\n" + "="*70 + "\n")
