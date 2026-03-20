#!/usr/bin/env python3
"""
Sistema Automático de Tracking de Downtime
Monitora serviços e registra downtimes automaticamente na tabela uptime_logs
"""

import os
import sys
import json
import time
import psycopg2
from datetime import datetime, date, timedelta
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv('backend/.env')

# Arquivo de estado para tracking de downtimes
DOWNTIME_STATE_FILE = 'downtime-state.json'

def get_db_connection():
    """Conecta ao banco de dados"""
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
        return None

def load_downtime_state():
    """Carrega estado de downtimes em andamento"""
    try:
        if os.path.exists(DOWNTIME_STATE_FILE):
            with open(DOWNTIME_STATE_FILE, 'r') as f:
                return json.load(f)
    except:
        pass
    return {}

def save_downtime_state(state):
    """Salva estado de downtimes em andamento"""
    try:
        with open(DOWNTIME_STATE_FILE, 'w') as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        print(f"⚠️  Erro ao salvar estado: {e}")

def get_service_id_by_name(conn, service_name):
    """Busca service_id pelo nome"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id FROM services WHERE name ILIKE %s LIMIT 1",
            (f"%{service_name}%",)
        )
        result = cur.fetchone()
        return result['id'] if result else None

def calculate_daily_uptime(conn, service_id, target_date):
    """
    Calcula o uptime de um serviço para uma data específica
    baseado nos downtimes registrados
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Buscar todos os downtimes do dia
        cur.execute("""
            SELECT 
                started_at,
                ended_at,
                EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) / 60 as duration_minutes
            FROM service_downtimes
            WHERE service_id = %s
            AND DATE(started_at) = %s
        """, (service_id, target_date))
        
        downtimes = cur.fetchall()
        
        if not downtimes:
            return 100.0
        
        # Somar total de minutos de downtime
        total_downtime_minutes = sum(d['duration_minutes'] for d in downtimes)
        
        # Calcular uptime percentage
        total_minutes_in_day = 1440  # 24 horas
        uptime_minutes = max(0, total_minutes_in_day - total_downtime_minutes)
        uptime_percentage = (uptime_minutes / total_minutes_in_day) * 100
        
        return round(uptime_percentage, 2)

def update_uptime_log(conn, service_id, target_date, uptime_percentage):
    """Atualiza ou insere registro de uptime para o dia"""
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO uptime_logs (service_id, date, uptime_percentage)
            VALUES (%s, %s, %s)
            ON CONFLICT (service_id, date) 
            DO UPDATE SET 
                uptime_percentage = LEAST(uptime_logs.uptime_percentage, EXCLUDED.uptime_percentage),
                created_at = CURRENT_TIMESTAMP
        """, (service_id, target_date, uptime_percentage))
    conn.commit()

def start_downtime(conn, service_id, service_name, error_message):
    """Registra início de um downtime"""
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO service_downtimes (service_id, started_at, error_message, status)
            VALUES (%s, NOW(), %s, 'ongoing')
            RETURNING id
        """, (service_id, error_message))
        downtime_id = cur.fetchone()[0]
    conn.commit()
    
    print(f"🔴 Downtime iniciado: {service_name} (ID: {downtime_id})")
    return downtime_id

def end_downtime(conn, downtime_id, service_id, service_name):
    """Finaliza um downtime e atualiza uptime do dia"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Finalizar downtime
        cur.execute("""
            UPDATE service_downtimes
            SET ended_at = NOW(), status = 'resolved'
            WHERE id = %s
            RETURNING started_at, ended_at
        """, (downtime_id,))
        
        downtime = cur.fetchone()
        if not downtime:
            return
        
        conn.commit()
        
        # Calcular duração
        duration = downtime['ended_at'] - downtime['started_at']
        duration_minutes = duration.total_seconds() / 60
        
        print(f"🟢 Downtime finalizado: {service_name} (Duração: {duration_minutes:.1f} min)")
        
        # Atualizar uptime do dia
        target_date = downtime['started_at'].date()
        uptime_percentage = calculate_daily_uptime(conn, service_id, target_date)
        update_uptime_log(conn, service_id, target_date, uptime_percentage)
        
        print(f"📊 Uptime atualizado para {target_date}: {uptime_percentage}%")

def process_monitor_status(service_name, is_down, error_message=None):
    """
    Processa status do monitor e atualiza downtimes
    
    Args:
        service_name: Nome do serviço
        is_down: True se o serviço está down
        error_message: Mensagem de erro (se houver)
    """
    conn = get_db_connection()
    if not conn:
        return
    
    try:
        # Buscar service_id
        service_id = get_service_id_by_name(conn, service_name)
        if not service_id:
            print(f"⚠️  Serviço '{service_name}' não encontrado no banco")
            return
        
        # Carregar estado atual
        state = load_downtime_state()
        service_key = str(service_id)
        
        if is_down:
            # Serviço está DOWN
            if service_key not in state:
                # Iniciar novo downtime
                downtime_id = start_downtime(conn, service_id, service_name, error_message or "Service unavailable")
                state[service_key] = {
                    'downtime_id': downtime_id,
                    'service_name': service_name,
                    'started_at': datetime.now().isoformat()
                }
                save_downtime_state(state)
        else:
            # Serviço está UP
            if service_key in state:
                # Finalizar downtime em andamento
                downtime_id = state[service_key]['downtime_id']
                end_downtime(conn, downtime_id, service_id, service_name)
                del state[service_key]
                save_downtime_state(state)
    
    finally:
        conn.close()

def create_downtime_table():
    """Cria tabela de downtimes se não existir"""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS service_downtimes (
                    id SERIAL PRIMARY KEY,
                    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
                    started_at TIMESTAMP NOT NULL,
                    ended_at TIMESTAMP,
                    error_message TEXT,
                    status VARCHAR(20) DEFAULT 'ongoing',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_service_downtimes_service_date 
                ON service_downtimes(service_id, started_at);
                
                CREATE INDEX IF NOT EXISTS idx_service_downtimes_status 
                ON service_downtimes(status);
            """)
        conn.commit()
        print("✅ Tabela service_downtimes criada/verificada")
        return True
    except Exception as e:
        print(f"❌ Erro ao criar tabela: {e}")
        return False
    finally:
        conn.close()

def recalculate_uptime_for_date(target_date_str):
    """Recalcula uptime para uma data específica (útil para correções)"""
    conn = get_db_connection()
    if not conn:
        return
    
    try:
        target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Buscar todos os serviços que tiveram downtime nesta data
            cur.execute("""
                SELECT DISTINCT service_id
                FROM service_downtimes
                WHERE DATE(started_at) = %s
            """, (target_date,))
            
            services = cur.fetchall()
            
            print(f"\n🔄 Recalculando uptime para {target_date}...")
            
            for service in services:
                service_id = service['service_id']
                uptime_percentage = calculate_daily_uptime(conn, service_id, target_date)
                update_uptime_log(conn, service_id, target_date, uptime_percentage)
                
                # Buscar nome do serviço
                cur.execute("SELECT name FROM services WHERE id = %s", (service_id,))
                service_name = cur.fetchone()['name']
                
                print(f"  ✅ {service_name}: {uptime_percentage}%")
            
            print(f"\n✨ Recálculo concluído para {len(services)} serviços")
    
    finally:
        conn.close()

def show_ongoing_downtimes():
    """Mostra downtimes em andamento"""
    conn = get_db_connection()
    if not conn:
        return
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    sd.id,
                    s.name as service_name,
                    sd.started_at,
                    sd.error_message,
                    EXTRACT(EPOCH FROM (NOW() - sd.started_at)) / 60 as duration_minutes
                FROM service_downtimes sd
                JOIN services s ON s.id = sd.service_id
                WHERE sd.status = 'ongoing'
                ORDER BY sd.started_at DESC
            """)
            
            downtimes = cur.fetchall()
            
            if downtimes:
                print("\n🔴 Downtimes em andamento:")
                print("-" * 80)
                for dt in downtimes:
                    print(f"ID: {dt['id']} | {dt['service_name']}")
                    print(f"  Iniciado: {dt['started_at']}")
                    print(f"  Duração: {dt['duration_minutes']:.1f} minutos")
                    print(f"  Erro: {dt['error_message']}")
                    print()
            else:
                print("\n✅ Nenhum downtime em andamento")
    
    finally:
        conn.close()

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Sistema de Tracking de Downtime')
    parser.add_argument('--setup', action='store_true', help='Criar tabela de downtimes')
    parser.add_argument('--down', nargs=2, metavar=('SERVICE', 'ERROR'), help='Registrar downtime')
    parser.add_argument('--up', metavar='SERVICE', help='Registrar recovery')
    parser.add_argument('--recalculate', metavar='DATE', help='Recalcular uptime para data (YYYY-MM-DD)')
    parser.add_argument('--status', action='store_true', help='Mostrar downtimes em andamento')
    
    args = parser.parse_args()
    
    if args.setup:
        create_downtime_table()
    elif args.down:
        service_name, error = args.down
        process_monitor_status(service_name, True, error)
    elif args.up:
        process_monitor_status(args.up, False)
    elif args.recalculate:
        recalculate_uptime_for_date(args.recalculate)
    elif args.status:
        show_ongoing_downtimes()
    else:
        parser.print_help()
