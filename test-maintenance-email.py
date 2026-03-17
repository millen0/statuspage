#!/usr/bin/python3
"""
Script para testar envio de email de manutenção
Execute na EC2: python3 test-maintenance-email.py
"""
import psycopg2
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import ssl
from datetime import datetime, timedelta
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
print("🧪 TESTE DE EMAIL DE MANUTENÇÃO")
print("="*70)

# 1. Verificar configurações SMTP
print("\n1️⃣ Verificando configurações SMTP...")
print(f"   SMTP_HOST: {SMTP_HOST}")
print(f"   SMTP_PORT: {SMTP_PORT}")
print(f"   SMTP_USER: {SMTP_USER}")
print(f"   FROM_EMAIL: {FROM_EMAIL}")
print(f"   SMTP_PASS: {'✅ Configurado' if SMTP_PASS else '❌ Não configurado'}")

if not all([SMTP_HOST, SMTP_USER, SMTP_PASS, FROM_EMAIL]):
    print("\n❌ ERRO: Configurações SMTP incompletas!")
    exit(1)

# 2. Verificar template
print("\n2️⃣ Verificando template...")
template_path = 'templates/email_maintenance_template.html'
if not os.path.exists(template_path):
    template_path = '/opt/statuspage/templates/email_maintenance_template.html'

if not os.path.exists(template_path):
    print(f"   ❌ Template não encontrado em: {template_path}")
    exit(1)

try:
    with open(template_path, 'r', encoding='utf-8') as f:
        template = f.read()
    
    if '{{MAINTENANCE_CONTENT}}' not in template:
        print("   ❌ Template não contém o placeholder {{MAINTENANCE_CONTENT}}")
        exit(1)
    
    print(f"   ✅ Template carregado: {template_path}")
    print(f"   ✅ Tamanho: {len(template)} bytes")
except Exception as e:
    print(f"   ❌ Erro ao carregar template: {e}")
    exit(1)

# 3. Verificar subscribers
print("\n3️⃣ Verificando subscribers...")
try:
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    cur.execute("SELECT COUNT(*) FROM subscribers WHERE is_active = true")
    count = cur.fetchone()[0]
    print(f"   ✅ Subscribers ativos: {count}")
    
    if count == 0:
        print("   ⚠️  Nenhum subscriber ativo encontrado!")
        cur.close()
        conn.close()
        exit(1)
    
    cur.execute("SELECT email FROM subscribers WHERE is_active = true LIMIT 3")
    emails = [row[0] for row in cur.fetchall()]
    print(f"   📧 Exemplos: {', '.join(emails)}")
    
except Exception as e:
    print(f"   ❌ Erro ao conectar no banco: {e}")
    exit(1)

# 4. Verificar última manutenção criada
print("\n4️⃣ Verificando última manutenção...")
try:
    cur.execute("""
        SELECT id, title, description, scheduled_start, scheduled_end, 
               send_email, email_sent, email_scheduled_time
        FROM maintenances 
        ORDER BY created_at DESC 
        LIMIT 1
    """)
    
    maint = cur.fetchone()
    if not maint:
        print("   ⚠️  Nenhuma manutenção encontrada")
        cur.close()
        conn.close()
        exit(1)
    
    maint_id, title, desc, start, end, send_email, email_sent, scheduled_time = maint
    
    print(f"   ID: {maint_id}")
    print(f"   Título: {title}")
    print(f"   Send Email: {send_email}")
    print(f"   Email Sent: {email_sent}")
    print(f"   Email Scheduled Time: {scheduled_time}")
    print(f"   Scheduled Start: {start}")
    print(f"   Scheduled End: {end}")
    
    # Converter para São Paulo
    start_sp = (start - timedelta(hours=3)).strftime('%d/%m/%Y %H:%M')
    end_sp = (end - timedelta(hours=3)).strftime('%d/%m/%Y %H:%M')
    
    print(f"   Início (SP): {start_sp}")
    print(f"   Fim (SP): {end_sp}")
    
except Exception as e:
    print(f"   ❌ Erro: {e}")
    cur.close()
    conn.close()
    exit(1)

# 5. Testar envio de email
print("\n5️⃣ Testando envio de email...")
print("   Deseja enviar um email de teste? (s/n): ", end='')
resposta = input().strip().lower()

if resposta != 's':
    print("   ⏭️  Teste de envio cancelado")
    cur.close()
    conn.close()
    exit(0)

# Preparar conteúdo
maintenance_content = f"""<p style="line-height: inherit; margin: 0px;">
    <strong>Prezados clientes e parceiros,</strong><br><br>
    A Pier Cloud informa que realizará uma <strong>manutenção programada</strong> conforme detalhes abaixo:<br><br>
    <strong>{title}</strong><br><br>
    {desc}<br><br>
    <strong>Início (São Paulo):</strong> {start_sp}<br>
    <strong>Término (São Paulo):</strong> {end_sp}<br><br>
    Para mais informações, acesse: <a href="https://statuspage.piercloud.io/area/maintenances" style="color: rgb(0, 104, 165);">https://statuspage.piercloud.io/area/maintenances</a>
</p>"""

html_body = template.replace('{{MAINTENANCE_CONTENT}}', maintenance_content)

# Pegar primeiro subscriber
cur.execute("SELECT email FROM subscribers WHERE is_active = true LIMIT 1")
test_email = cur.fetchone()[0]

print(f"   📧 Enviando para: {test_email}")

try:
    context = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.set_debuglevel(1)  # Mostrar debug
        server.starttls(context=context)
        server.login(SMTP_USER, SMTP_PASS)
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = "Informe Plataforma Pier Cloud: Manutenção Programada"
        msg['From'] = FROM_EMAIL
        msg['To'] = test_email
        
        msg.attach(MIMEText(html_body, 'html'))
        server.send_message(msg)
        
        print(f"\n   ✅ Email enviado com sucesso para {test_email}!")
        print(f"   📬 Verifique a caixa de entrada (e spam)")
        
except Exception as e:
    print(f"\n   ❌ Erro ao enviar email: {e}")
    import traceback
    traceback.print_exc()

cur.close()
conn.close()

print("\n" + "="*70)
print("✅ Teste concluído!")
print("="*70 + "\n")
