package handlers

import (
	"bytes"
	"crypto/tls"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/smtp"
	"os"
	"statuspage/models"
	"strconv"
	"time"

	"github.com/gorilla/mux"
)

func sendMaintenanceEmails(db *sql.DB, maintenance models.Maintenance) {
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := os.Getenv("SMTP_PORT")
	smtpUser := os.Getenv("SMTP_USERNAME")
	smtpPass := os.Getenv("SMTP_PASSWORD")
	fromEmail := os.Getenv("SES_FROM_EMAIL")
	
	log.Printf("[EMAIL] Starting maintenance email send - SMTP: %s:%s, From: %s", smtpHost, smtpPort, fromEmail)
	
	if smtpHost == "" || smtpUser == "" || smtpPass == "" || fromEmail == "" {
		log.Printf("[EMAIL] Missing SMTP configuration")
		return
	}

	rows, err := db.Query("SELECT email, unsubscribe_token FROM subscribers WHERE is_active = true")
	if err != nil {
		log.Printf("[EMAIL] Error querying subscribers: %v", err)
		return
	}
	defer rows.Close()

	startSP := maintenance.ScheduledStart.Add(-3 * time.Hour)
	endSP := maintenance.ScheduledEnd.Add(-3 * time.Hour)

	subject := fmt.Sprintf("Scheduled Maintenance: %s", maintenance.Title)

	auth := smtp.PlainAuth("", smtpUser, smtpPass, smtpHost)
	
	sentCount := 0
	for rows.Next() {
		var email, token string
		if err := rows.Scan(&email, &token); err != nil {
			log.Printf("[EMAIL] Error scanning row: %v", err)
			continue
		}

		unsubscribeURL := fmt.Sprintf("https://statuspage.piercloud.io/api/public/unsubscribe?token=%s", token)
		htmlBody := fmt.Sprintf(`<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
	<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
		<h2 style="color: #2563eb;">Scheduled Maintenance Notification</h2>
		<div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
			<h3 style="margin-top: 0;">%s</h3>
			<p>%s</p>
			<p><strong>Start (São Paulo):</strong> %s</p>
			<p><strong>End (São Paulo):</strong> %s</p>
		</div>
		<p style="color: #666; font-size: 12px; margin-top: 30px;">
			You are receiving this email because you subscribed to maintenance notifications.<br>
			<a href="%s" style="color: #999; text-decoration: none;">Unsubscribe from notifications</a>
		</p>
	</div>
</body>
</html>`, maintenance.Title, maintenance.Description, startSP.Format("02/01/2006 15:04"), endSP.Format("02/01/2006 15:04"), unsubscribeURL)
		msg := []byte(fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
			fromEmail, email, subject, htmlBody))

		conn, err := smtp.Dial(smtpHost + ":" + smtpPort)
		if err != nil {
			log.Printf("[EMAIL] Error connecting to SMTP for %s: %v", email, err)
			continue
		}

		tlsConfig := &tls.Config{ServerName: smtpHost}
		if err = conn.StartTLS(tlsConfig); err != nil {
			log.Printf("[EMAIL] Error starting TLS for %s: %v", email, err)
			conn.Close()
			continue
		}

		if err = conn.Auth(auth); err != nil {
			log.Printf("[EMAIL] Error authenticating for %s: %v", email, err)
			conn.Close()
			continue
		}

		if err = conn.Mail(fromEmail); err != nil {
			log.Printf("[EMAIL] Error setting sender for %s: %v", email, err)
			conn.Close()
			continue
		}

		if err = conn.Rcpt(email); err != nil {
			log.Printf("[EMAIL] Error setting recipient %s: %v", email, err)
			conn.Close()
			continue
		}

		w, err := conn.Data()
		if err != nil {
			log.Printf("[EMAIL] Error getting data writer for %s: %v", email, err)
			conn.Close()
			continue
		}

		_, err = w.Write(msg)
		if err != nil {
			log.Printf("[EMAIL] Error writing message for %s: %v", email, err)
			w.Close()
			conn.Close()
			continue
		}

		w.Close()
		conn.Quit()
		sentCount++
		log.Printf("[EMAIL] Successfully sent to %s", email)
	}
	log.Printf("[EMAIL] Finished sending emails. Total sent: %d", sentCount)
}

var SLACK_WEBHOOK = os.Getenv("SLACK_WEBHOOK")

type AdminHandler struct {
	DB *sql.DB
}

func sendSlackIncidentAlert(incident models.Incident, serviceName string) {
	webhook := os.Getenv("SLACK_WEBHOOK")
	if webhook == "" {
		return
	}
	
	color := "warning"
	if incident.Severity == "critical" {
		color = "danger"
	} else if incident.Severity == "minor" || incident.Severity == "info" {
		color = "#439FE0"
	}

	payload := map[string]interface{}{
		"attachments": []map[string]interface{}{
			{
				"color": color,
				"title": "🚨 New Incident: " + incident.Title,
				"fields": []map[string]interface{}{
					{"title": "Severity", "value": incident.Severity, "short": true},
					{"title": "Status", "value": incident.Status, "short": true},
					{"title": "Service", "value": serviceName, "short": true},
					{"title": "Description", "value": incident.Description, "short": false},
				},
			},
		},
	}

	jsonData, _ := json.Marshal(payload)
	http.Post(webhook, "application/json", bytes.NewBuffer(jsonData))
}

func sendSlackIncidentUpdate(incidentTitle, updateMessage, status string) {
	webhook := os.Getenv("SLACK_WEBHOOK")
	if webhook == "" {
		return
	}
	
	color := "good"
	if status == "resolved" {
		color = "good"
	} else if status == "monitoring" {
		color = "warning"
	}

	payload := map[string]interface{}{
		"attachments": []map[string]interface{}{
			{
				"color": color,
				"title": "📝 Incident Update: " + incidentTitle,
				"fields": []map[string]interface{}{
					{"title": "Status", "value": status, "short": true},
					{"title": "Update", "value": updateMessage, "short": false},
				},
			},
		},
	}

	jsonData, _ := json.Marshal(payload)
	http.Post(webhook, "application/json", bytes.NewBuffer(jsonData))
}

func sendSlackMaintenanceAlert(maintenance models.Maintenance, isCompleted bool) {
	webhook := os.Getenv("SLACK_WEBHOOK")
	if webhook == "" {
		return
	}
	
	color := "#439FE0"
	title := "🔧 Scheduled Maintenance: " + maintenance.Title
	
	if isCompleted {
		color = "good"
		title = "✅ Maintenance Completed: " + maintenance.Title
	} else if maintenance.Status == "in_progress" {
		color = "warning"
		title = "🚧 Maintenance Started: " + maintenance.Title
	}

	// Subtrair 3 horas para São Paulo (UTC-3)
	startSP := maintenance.ScheduledStart.Add(-3 * time.Hour)
	endSP := maintenance.ScheduledEnd.Add(-3 * time.Hour)

	payload := map[string]interface{}{
		"attachments": []map[string]interface{}{
			{
				"color": color,
				"title": title,
				"fields": []map[string]interface{}{
					{"title": "Status", "value": maintenance.Status, "short": true},
					{"title": "Start (SP)", "value": startSP.Format("02/01/2006 15:04"), "short": true},
					{"title": "End (SP)", "value": endSP.Format("02/01/2006 15:04"), "short": true},
					{"title": "Description", "value": maintenance.Description, "short": false},
				},
			},
		},
	}

	jsonData, _ := json.Marshal(payload)
	http.Post(webhook, "application/json", bytes.NewBuffer(jsonData))
}

// Services
func (h *AdminHandler) GetServices(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`
		SELECT id, name, description, status, position, url, heartbeat_interval, request_timeout, retries, 
		       COALESCE(is_visible, true) as is_visible,
		       incident, incident_published,
		       created_at, updated_at 
		FROM services 
		ORDER BY position
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var services []models.Service
	for rows.Next() {
		var s models.Service
		if err := rows.Scan(&s.ID, &s.Name, &s.Description, &s.Status, &s.Position, &s.URL, &s.HeartbeatInterval, &s.RequestTimeout, &s.Retries, &s.IsVisible, &s.Incident, &s.IncidentPublished, &s.CreatedAt, &s.UpdatedAt); err != nil {
			continue
		}
		services = append(services, s)
	}

	if services == nil {
		services = []models.Service{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(services)
}

func (h *AdminHandler) CreateService(w http.ResponseWriter, r *http.Request) {
	var s models.Service
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if s.HeartbeatInterval == 0 {
		s.HeartbeatInterval = 60
	}
	if s.RequestTimeout == 0 {
		s.RequestTimeout = 120
	}
	if s.Retries == 0 {
		s.Retries = 5
	}

	err := h.DB.QueryRow(
		"INSERT INTO services (name, description, status, position, url, heartbeat_interval, request_timeout, retries, is_visible, incident, incident_published) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, created_at, updated_at",
		s.Name, s.Description, s.Status, s.Position, s.URL, s.HeartbeatInterval, s.RequestTimeout, s.Retries, true, s.Incident, s.IncidentPublished,
	).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if s.Incident != nil && *s.Incident != "" && s.IncidentPublished {
		_, _ = h.DB.Exec(
			"INSERT INTO incidents (title, description, severity, status, service_id, is_visible) VALUES ($1, $2, $3, $4, $5, $6)",
			s.Name+" Incident", *s.Incident, "major", "investigating", s.ID, true,
		)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

func sendSlackServiceStatusChange(serviceName, oldStatus, newStatus string) {
	webhook := os.Getenv("SLACK_WEBHOOK")
	if webhook == "" {
		return
	}

	color := "good"
	title := "✅ Service Restored: " + serviceName

	if newStatus == "operational" && oldStatus != "operational" {
		color = "good"
		title = "✅ Service Restored: " + serviceName
	} else if newStatus == "degraded" {
		color = "warning"
		title = "⚠️ Service Degraded: " + serviceName
	} else if newStatus == "outage" {
		color = "danger"
		title = "🔴 Service Outage: " + serviceName
	} else if newStatus == "maintenance" {
		color = "#439FE0"
		title = "🔧 Service Under Maintenance: " + serviceName
	}

	payload := map[string]interface{}{
		"attachments": []map[string]interface{}{
			{
				"color": color,
				"title": title,
				"fields": []map[string]interface{}{
					{"title": "Previous Status", "value": oldStatus, "short": true},
					{"title": "Current Status", "value": newStatus, "short": true},
					{"title": "Service", "value": serviceName, "short": true},
					{"title": "Time", "value": time.Now().Add(-3 * time.Hour).Format("02/01/2006 15:04"), "short": true},
				},
			},
		},
	}

	jsonData, _ := json.Marshal(payload)
	http.Post(webhook, "application/json", bytes.NewBuffer(jsonData))
}

func (h *AdminHandler) UpdateService(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])

	var s models.Service
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var oldStatus, oldName string
	h.DB.QueryRow("SELECT status, name FROM services WHERE id = $1", id).Scan(&oldStatus, &oldName)

	_, err := h.DB.Exec(
		"UPDATE services SET name=$1, description=$2, status=$3, position=$4, url=$5, heartbeat_interval=$6, request_timeout=$7, retries=$8, is_visible=$9, incident=$10, incident_published=$11, updated_at=$12 WHERE id=$13",
		s.Name, s.Description, s.Status, s.Position, s.URL, s.HeartbeatInterval, s.RequestTimeout, s.Retries, s.IsVisible, s.Incident, s.IncidentPublished, time.Now(), id,
	)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if s.Incident != nil && *s.Incident != "" && s.IncidentPublished {
		_, _ = h.DB.Exec(
			"INSERT INTO incidents (title, description, severity, status, service_id, is_visible) VALUES ($1, $2, $3, $4, $5, $6)",
			s.Name+" Incident", *s.Incident, "major", "investigating", id, true,
		)
	}

	if oldStatus != s.Status {
		sendSlackServiceStatusChange(s.Name, oldStatus, s.Status)
	}

	s.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

func (h *AdminHandler) DeleteService(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	_, err := h.DB.Exec("DELETE FROM services WHERE id=$1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminHandler) ToggleServiceVisibility(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])

	var req struct {
		IsVisible bool `json:"is_visible"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err := h.DB.Exec("UPDATE services SET is_visible = $1, updated_at = $2 WHERE id = $3", req.IsVisible, time.Now(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "is_visible": req.IsVisible})
}

func (h *AdminHandler) PublishServiceIncident(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])

	var serviceName, incident sql.NullString
	err := h.DB.QueryRow("SELECT name, incident FROM services WHERE id = $1", id).Scan(&serviceName, &incident)
	if err != nil {
		http.Error(w, "Service not found", http.StatusBadRequest)
		return
	}

	incidentDesc := incident.String
	if !incident.Valid || incidentDesc == "" {
		incidentDesc = "Service experiencing issues"
	}

	_, err = h.DB.Exec("INSERT INTO incidents (title, description, severity, status, service_id, is_visible) VALUES ($1, $2, $3, $4, $5, $6)",
		serviceName.String+" Incident", incidentDesc, "major", "investigating", id, true)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	_, _ = h.DB.Exec("UPDATE services SET incident_published = true WHERE id = $1", id)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

func (h *AdminHandler) UnpublishServiceIncident(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])

	_, err := h.DB.Exec("DELETE FROM incidents WHERE service_id = $1 AND status != 'resolved'", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	_, _ = h.DB.Exec("UPDATE services SET incident_published = false WHERE id = $1", id)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

// Incidents
func (h *AdminHandler) GetIncidents(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`
		SELECT id, title, description, severity, status, service_id, is_visible, created_at, updated_at, resolved_at 
		FROM incidents 
		ORDER BY created_at DESC
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var incidents []models.Incident
	for rows.Next() {
		var i models.Incident
		if err := rows.Scan(&i.ID, &i.Title, &i.Description, &i.Severity, &i.Status, &i.ServiceID, &i.IsVisible, &i.CreatedAt, &i.UpdatedAt, &i.ResolvedAt); err != nil {
			continue
		}
		incidents = append(incidents, i)
	}

	if incidents == nil {
		incidents = []models.Incident{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(incidents)
}

func (h *AdminHandler) CreateIncident(w http.ResponseWriter, r *http.Request) {
	var i models.Incident
	if err := json.NewDecoder(r.Body).Decode(&i); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	err := h.DB.QueryRow(
		"INSERT INTO incidents (title, description, severity, status, service_id, is_visible) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at, updated_at",
		i.Title, i.Description, i.Severity, i.Status, i.ServiceID, false,
	).Scan(&i.ID, &i.CreatedAt, &i.UpdatedAt)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	i.IsVisible = false

	// Buscar nome do serviço
	var serviceName string
	if i.ServiceID != nil {
		h.DB.QueryRow("SELECT name FROM services WHERE id = $1", *i.ServiceID).Scan(&serviceName)
	} else {
		serviceName = "All Services"
	}

	// Enviar alerta ao Slack
	sendSlackIncidentAlert(i, serviceName)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(i)
}

func (h *AdminHandler) UpdateIncident(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])

	var i models.Incident
	if err := json.NewDecoder(r.Body).Decode(&i); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Buscar status anterior
	var oldStatus string
	h.DB.QueryRow("SELECT status FROM incidents WHERE id = $1", id).Scan(&oldStatus)

	_, err := h.DB.Exec(
		"UPDATE incidents SET title=$1, description=$2, severity=$3, status=$4, service_id=$5, is_visible=$6, updated_at=$7 WHERE id=$8",
		i.Title, i.Description, i.Severity, i.Status, i.ServiceID, i.IsVisible, time.Now(), id,
	)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Se o status mudou, enviar notificação
	if oldStatus != i.Status {
		sendSlackIncidentUpdate(i.Title, "Status changed from "+oldStatus+" to "+i.Status, i.Status)
	}

	i.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(i)
}

func (h *AdminHandler) DeleteIncident(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	_, err := h.DB.Exec("DELETE FROM incidents WHERE id=$1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminHandler) AddIncidentUpdate(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	incidentID, _ := strconv.Atoi(vars["id"])

	var u models.IncidentUpdate
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	err := h.DB.QueryRow(
		"INSERT INTO incident_updates (incident_id, message, status) VALUES ($1, $2, $3) RETURNING id, created_at",
		incidentID, u.Message, u.Status,
	).Scan(&u.ID, &u.CreatedAt)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Buscar título do incidente
	var incidentTitle string
	h.DB.QueryRow("SELECT title FROM incidents WHERE id = $1", incidentID).Scan(&incidentTitle)

	// Enviar update ao Slack
	sendSlackIncidentUpdate(incidentTitle, u.Message, u.Status)

	u.IncidentID = incidentID
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(u)
}

// Maintenances
func (h *AdminHandler) GetMaintenances(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`
		SELECT id, title, description, status, scheduled_start, scheduled_end, actual_start, actual_end, created_at, updated_at 
		FROM maintenances 
		ORDER BY created_at DESC
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var maintenances []models.Maintenance
	for rows.Next() {
		var m models.Maintenance
		if err := rows.Scan(&m.ID, &m.Title, &m.Description, &m.Status, &m.ScheduledStart, &m.ScheduledEnd, &m.ActualStart, &m.ActualEnd, &m.CreatedAt, &m.UpdatedAt); err != nil {
			continue
		}
		maintenances = append(maintenances, m)
	}

	if maintenances == nil {
		maintenances = []models.Maintenance{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(maintenances)
}

func (h *AdminHandler) CreateMaintenance(w http.ResponseWriter, r *http.Request) {
	var m models.Maintenance
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	err := h.DB.QueryRow(
		"INSERT INTO maintenances (title, description, status, scheduled_start, scheduled_end) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at, updated_at",
		m.Title, m.Description, m.Status, m.ScheduledStart, m.ScheduledEnd,
	).Scan(&m.ID, &m.CreatedAt, &m.UpdatedAt)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Enviar alerta ao Slack
	sendSlackMaintenanceAlert(m, false)

	// Enviar emails para subscribers
	go sendMaintenanceEmails(h.DB, m)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(m)
}

func (h *AdminHandler) UpdateMaintenance(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])

	var m models.Maintenance
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Buscar status anterior
	var oldStatus string
	h.DB.QueryRow("SELECT status FROM maintenances WHERE id = $1", id).Scan(&oldStatus)

	_, err := h.DB.Exec(
		"UPDATE maintenances SET title=$1, description=$2, status=$3, scheduled_start=$4, scheduled_end=$5, updated_at=$6 WHERE id=$7",
		m.Title, m.Description, m.Status, m.ScheduledStart, m.ScheduledEnd, time.Now(), id,
	)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Se mudou para completed, enviar notificação
	if oldStatus != "completed" && m.Status == "completed" {
		sendSlackMaintenanceAlert(m, true)
	} else if oldStatus == "scheduled" && m.Status == "in_progress" {
		// Notificar quando começa
		sendSlackMaintenanceAlert(m, false)
	}

	m.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(m)
}

func (h *AdminHandler) DeleteMaintenance(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	_, err := h.DB.Exec("DELETE FROM maintenances WHERE id=$1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Subscribers
func (h *AdminHandler) GetSubscribers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query("SELECT id, email, is_active, created_at FROM subscribers ORDER BY created_at DESC")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var subscribers []models.Subscriber
	for rows.Next() {
		var s models.Subscriber
		if err := rows.Scan(&s.ID, &s.Email, &s.IsActive, &s.CreatedAt); err != nil {
			continue
		}
		subscribers = append(subscribers, s)
	}

	if subscribers == nil {
		subscribers = []models.Subscriber{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(subscribers)
}

func (h *AdminHandler) DeleteSubscriber(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	_, err := h.DB.Exec("DELETE FROM subscribers WHERE id=$1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminHandler) DownloadSubscribers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query("SELECT email, is_active, created_at FROM subscribers ORDER BY created_at DESC")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=subscribers.csv")

	w.Write([]byte("Email,Status,Subscribed At\n"))

	for rows.Next() {
		var email string
		var isActive bool
		var createdAt time.Time
		if err := rows.Scan(&email, &isActive, &createdAt); err != nil {
			continue
		}
		status := "Active"
		if !isActive {
			status = "Unsubscribed"
		}
		w.Write([]byte(fmt.Sprintf("%s,%s,%s\n", email, status, createdAt.Format("2006-01-02 15:04:05"))))
	}
}

// Toggle Incident Visibility
func (h *AdminHandler) ToggleIncidentVisibility(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])

	var req struct {
		IsVisible bool `json:"is_visible"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err := h.DB.Exec("UPDATE incidents SET is_visible = $1, updated_at = $2 WHERE id = $3", req.IsVisible, time.Now(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "is_visible": req.IsVisible})
}

// Settings
func (h *AdminHandler) UpdateDisplayMode(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DisplayMode string `json:"display_mode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.DisplayMode != "classic" && req.DisplayMode != "uptime" {
		http.Error(w, "Invalid display_mode. Must be 'classic' or 'uptime'", http.StatusBadRequest)
		return
	}

	_, err := h.DB.Exec("INSERT INTO settings (key, value, updated_at) VALUES ('display_mode', $1, $2) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = $2", req.DisplayMode, time.Now())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"display_mode": req.DisplayMode})
}
