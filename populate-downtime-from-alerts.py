#!/usr/bin/env python3
"""
Script para popular histórico de uptime baseado em alertas de downtime
Uso: python3 populate-downtime-from-alerts.py
"""

import os
import sys
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor

# Configuração do banco de dados (lê do .env)
def get_db_connection():
    """Conecta ao banco de dados usando variáveis de ambiente"""
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5432'),
            database=os.getenv('DB_NAME', 'statuspage'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', '')
        )
        return conn
    except Exception as e:
        print(f"❌ Erro ao conectar ao banco: {e}")
        sys.exit(1)

def get_service_id(conn, service_name):
    """Busca o ID do serviço pelo nome"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id FROM services WHERE name ILIKE %s LIMIT 1",
            (f"%{service_name}%",)
        )
        result = cur.fetchone()
        return result['id'] if result else None

def calculate_uptime_percentage(downtime_minutes, total_minutes=1440):
    """
    Calcula a porcentagem de uptime
    Args:
        downtime_minutes: minutos de indisponibilidade
        total_minutes: total de minutos no dia (padrão: 1440 = 24h)
    Returns:
        float: porcentagem de uptime (0-100)
    """
    uptime_minutes = total_minutes - downtime_minutes
    return round((uptime_minutes / total_minutes) * 100, 2)

def insert_uptime_log(conn, service_id, date, uptime_percentage):
    """Insere ou atualiza registro de uptime"""
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO uptime_logs (service_id, date, uptime_percentage)
            VALUES (%s, %s, %s)
            ON CONFLICT (service_id, date) 
            DO UPDATE SET 
                uptime_percentage = LEAST(uptime_logs.uptime_percentage, EXCLUDED.uptime_percentage),
                created_at = CURRENT_TIMESTAMP
        """, (service_id, date, uptime_percentage))
    conn.commit()

def populate_downtime_history():
    """Popula histórico de downtime baseado em alertas conhecidos"""
    
    # Definir os downtimes conhecidos
    # Formato: (service_name, date, downtime_minutes, description)
    downtimes = [
        ('lighthouse-backend', '2025-02-15', 120, 'Request failed with status code 503'),
        # Adicione mais downtimes aqui conforme necessário
        # ('outro-servico', '2025-02-15', 30, 'Descrição do problema'),
    ]
    
    conn = get_db_connection()
    
    print("🔄 Populando histórico de downtime...")
    print()
    
    for service_name, date_str, downtime_minutes, description in downtimes:
        # Buscar service_id
        service_id = get_service_id(conn, service_name)
        
        if not service_id:
            print(f"⚠️  Serviço '{service_name}' não encontrado no banco")
            continue
        
        # Calcular uptime percentage
        uptime_percentage = calculate_uptime_percentage(downtime_minutes)
        
        # Inserir no banco
        insert_uptime_log(conn, service_id, date_str, uptime_percentage)
        
        print(f"✅ {service_name} ({date_str})")
        print(f"   Downtime: {downtime_minutes} minutos")
        print(f"   Uptime: {uptime_percentage}%")
        print(f"   Motivo: {description}")
        print()
    
    conn.close()
    print("✨ Histórico atualizado com sucesso!")

def verify_uptime_logs(date_str=None):
    """Verifica os logs de uptime para uma data específica"""
    conn = get_db_connection()
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        if date_str:
            cur.execute("""
                SELECT 
                    s.name,
                    ul.date,
                    ul.uptime_percentage,
                    ul.created_at
                FROM uptime_logs ul
                JOIN services s ON s.id = ul.service_id
                WHERE ul.date = %s
                ORDER BY s.name
            """, (date_str,))
        else:
            cur.execute("""
                SELECT 
                    s.name,
                    ul.date,
                    ul.uptime_percentage,
                    ul.created_at
                FROM uptime_logs ul
                JOIN services s ON s.id = ul.service_id
                WHERE ul.uptime_percentage < 100
                ORDER BY ul.date DESC, s.name
                LIMIT 20
            """)
        
        results = cur.fetchall()
        
        if results:
            print("\n📊 Logs de uptime encontrados:")
            print("-" * 80)
            for row in results:
                status = "🔴" if row['uptime_percentage'] < 50 else "🟡" if row['uptime_percentage'] < 99 else "🟢"
                print(f"{status} {row['name']:30} | {row['date']} | {row['uptime_percentage']:6.2f}%")
        else:
            print("\n✅ Nenhum downtime registrado")
    
    conn.close()

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Gerenciar histórico de uptime')
    parser.add_argument('--populate', action='store_true', help='Popular histórico de downtime')
    parser.add_argument('--verify', nargs='?', const=True, help='Verificar logs (opcional: data YYYY-MM-DD)')
    
    args = parser.parse_args()
    
    if args.populate:
        populate_downtime_history()
    elif args.verify:
        date_str = args.verify if isinstance(args.verify, str) else None
        verify_uptime_logs(date_str)
    else:
        parser.print_help()
