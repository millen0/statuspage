package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"statuspage/models"
	"strconv"

	"github.com/gorilla/mux"
)

type PublicHandler struct {
	DB *sql.DB
}

func (h *PublicHandler) GetHeartbeat(w http.ResponseWriter, r *http.Request) {
	var status string
	var services []models.Service

	rows, err := h.DB.Query("SELECT id, name, description, status, position, url, heartbeat_interval, request_timeout, retries, is_visible, created_at, updated_at FROM services WHERE is_visible = true ORDER BY position")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var s models.Service
		if err := rows.Scan(&s.ID, &s.Name, &s.Description, &s.Status, &s.Position, &s.URL, &s.HeartbeatInterval, &s.RequestTimeout, &s.Retries, &s.IsVisible, &s.CreatedAt, &s.UpdatedAt); err != nil {
			continue
		}
		services = append(services, s)
	}

	// Verificar se há incidents ativos E VISÍVEIS
	var activeIncidents int
	h.DB.QueryRow("SELECT COUNT(*) FROM incidents WHERE status != 'resolved' AND is_visible = true").Scan(&activeIncidents)

	// Status degraded APENAS se houver incidents visíveis
	if activeIncidents > 0 {
		status = "degraded"
	} else {
		status = "operational"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.StatusResponse{
		Status:   status,
		Services: services,
	})
}

func (h *PublicHandler) GetServices(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`
		SELECT s.id, s.name, s.description, s.status, s.position, s.url, 
		       s.heartbeat_interval, s.request_timeout, s.retries, s.is_visible, 
		       s.created_at, s.updated_at,
		       COALESCE(sgm.group_id, 0) as group_id
		FROM services s
		LEFT JOIN service_group_members sgm ON s.id = sgm.service_id
		WHERE s.is_visible = true 
		ORDER BY s.position
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type ServiceWithGroup struct {
		models.Service
		GroupID int `json:"group_id,omitempty"`
	}

	var services []ServiceWithGroup
	for rows.Next() {
		var s ServiceWithGroup
		if err := rows.Scan(&s.ID, &s.Name, &s.Description, &s.Status, &s.Position, &s.URL, 
			&s.HeartbeatInterval, &s.RequestTimeout, &s.Retries, &s.IsVisible, 
			&s.CreatedAt, &s.UpdatedAt, &s.GroupID); err != nil {
			continue
		}
		services = append(services, s)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(services)
}

func (h *PublicHandler) GetIncidents(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`
		SELECT id, title, description, severity, status, service_id, is_visible, created_at, updated_at, resolved_at 
		FROM incidents 
		WHERE is_visible = true
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

		updateRows, _ := h.DB.Query("SELECT id, incident_id, message, status, created_at FROM incident_updates WHERE incident_id = $1 ORDER BY created_at DESC", i.ID)
		for updateRows.Next() {
			var u models.IncidentUpdate
			if err := updateRows.Scan(&u.ID, &u.IncidentID, &u.Message, &u.Status, &u.CreatedAt); err == nil {
				i.Updates = append(i.Updates, u)
			}
		}
		updateRows.Close()

		incidents = append(incidents, i)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(incidents)
}

func (h *PublicHandler) GetMaintenances(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`
		SELECT id, title, description, status, scheduled_start, scheduled_end, actual_start, actual_end, created_at, updated_at 
		FROM maintenances 
		ORDER BY created_at DESC
		LIMIT 10
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

func (h *PublicHandler) Subscribe(w http.ResponseWriter, r *http.Request) {
	var req models.SubscribeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.Email == "" {
		http.Error(w, "Email is required", http.StatusBadRequest)
		return
	}

	token := make([]byte, 32)
	rand.Read(token)
	unsubscribeToken := hex.EncodeToString(token)

	_, err := h.DB.Exec(
		"INSERT INTO subscribers (email, unsubscribe_token) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET is_active = true",
		req.Email, unsubscribeToken,
	)
	if err != nil {
		http.Error(w, "Failed to subscribe", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Successfully subscribed to maintenance notifications"})
}

func (h *PublicHandler) Unsubscribe(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "Token is required", http.StatusBadRequest)
		return
	}

	_, err := h.DB.Exec("UPDATE subscribers SET is_active = false WHERE unsubscribe_token = $1", token)
	if err != nil {
		http.Error(w, "Failed to unsubscribe", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Successfully unsubscribed"})
}

func (h *PublicHandler) GetAllServices(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query("SELECT id, name, description, status, position, url, heartbeat_interval, request_timeout, retries, is_visible, created_at, updated_at FROM services ORDER BY position")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var services []models.Service
	for rows.Next() {
		var s models.Service
		if err := rows.Scan(&s.ID, &s.Name, &s.Description, &s.Status, &s.Position, &s.URL, &s.HeartbeatInterval, &s.RequestTimeout, &s.Retries, &s.IsVisible, &s.CreatedAt, &s.UpdatedAt); err != nil {
			continue
		}
		services = append(services, s)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(services)
}

func (h *PublicHandler) ToggleServiceVisibility(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.Atoi(vars["id"])

	var req struct {
		IsVisible bool `json:"is_visible"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err := h.DB.Exec("UPDATE services SET is_visible = $1 WHERE id = $2", req.IsVisible, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "is_visible": req.IsVisible})
}

func (h *PublicHandler) GetDisplayMode(w http.ResponseWriter, r *http.Request) {
	var displayMode, gridColumns string
	err := h.DB.QueryRow("SELECT value FROM settings WHERE key = 'display_mode'").Scan(&displayMode)
	if err != nil {
		displayMode = "classic"
	}
	err = h.DB.QueryRow("SELECT value FROM settings WHERE key = 'grid_columns'").Scan(&gridColumns)
	if err != nil {
		gridColumns = "2"
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"display_mode": displayMode, "grid_columns": gridColumns})
}

func (h *PublicHandler) GetServiceUptime(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceID := vars["id"]

	rows, err := h.DB.Query(`
		SELECT date, uptime_percentage
		FROM uptime_logs
		WHERE service_id = $1 
		AND date >= CURRENT_DATE - INTERVAL '90 days'
		ORDER BY date ASC
	`, serviceID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type IncidentInfo struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Severity    string `json:"severity"`
		Duration    int    `json:"duration_minutes"`
	}

	type UptimeDay struct {
		Date             string         `json:"date"`
		UptimePercentage float64        `json:"uptime_percentage"`
		Incidents        []IncidentInfo `json:"incidents"`
	}

	var uptimeDays []UptimeDay
	for rows.Next() {
		var day UptimeDay
		if err := rows.Scan(&day.Date, &day.UptimePercentage); err != nil {
			continue
		}

		// Buscar incidentes deste dia para este serviço
		// Extrair apenas YYYY-MM-DD da string de data
		dateOnly := day.Date
		if len(day.Date) > 10 {
			dateOnly = day.Date[:10] // Pega apenas YYYY-MM-DD
		}
		
		incidentRows, incErr := h.DB.Query(`
			SELECT i.title, i.description, i.severity,
				EXTRACT(EPOCH FROM (COALESCE(i.resolved_at, NOW()) - i.created_at))/60 as duration_minutes
			FROM incidents i
			WHERE i.service_id = $1
			AND i.uptime_date = $2
			AND i.is_visible = true
			ORDER BY i.created_at DESC
		`, serviceID, dateOnly)

		if incErr == nil {
			for incidentRows.Next() {
				var incident IncidentInfo
				if err := incidentRows.Scan(&incident.Title, &incident.Description, &incident.Severity, &incident.Duration); err == nil {
					day.Incidents = append(day.Incidents, incident)
				}
			}
			incidentRows.Close()
		}

		// Buscar downtimes automáticos deste dia
		downtimeRows, _ := h.DB.Query(`
			SELECT 
				CASE 
					WHEN status_code >= 500 THEN 'Degraded Performance'
					WHEN status_code = 0 THEN 'Connection Error'
					ELSE 'Service Issue'
				END as title,
				COALESCE(error_message, 'Automatic downtime detected') as description,
				CASE 
					WHEN status_code >= 500 THEN 'minor'
					WHEN status_code = 0 THEN 'major'
					ELSE 'minor'
				END as severity,
				EXTRACT(EPOCH FROM (COALESCE(end_time, NOW()) - start_time))/60 as duration_minutes
			FROM service_downtimes
			WHERE service_id = $1
			AND DATE(start_time) = $2
			ORDER BY start_time DESC
		`, serviceID, day.Date)

		for downtimeRows.Next() {
			var incident IncidentInfo
			if err := downtimeRows.Scan(&incident.Title, &incident.Description, &incident.Severity, &incident.Duration); err == nil {
				day.Incidents = append(day.Incidents, incident)
			}
		}
		downtimeRows.Close()

		if day.Incidents == nil {
			day.Incidents = []IncidentInfo{}
		}

		uptimeDays = append(uptimeDays, day)
	}

	if uptimeDays == nil {
		uptimeDays = []UptimeDay{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(uptimeDays)
}

// GetServiceGroups returns all active service groups with their aggregated status
func (h *PublicHandler) GetServiceGroups(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(`
		SELECT sg.id, sg.name, sg.display_name, sg.description
		FROM service_groups sg
		WHERE sg.is_active = true
		ORDER BY sg.display_name
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type ServiceGroup struct {
		ID          int    `json:"id"`
		Name        string `json:"name"`
		DisplayName string `json:"display_name"`
		Description string `json:"description"`
		Status      string `json:"status"`
	}

	var groups []ServiceGroup
	for rows.Next() {
		var g ServiceGroup
		if err := rows.Scan(&g.ID, &g.Name, &g.DisplayName, &g.Description); err != nil {
			continue
		}

		// Calculate current status based on member services
		var worstStatus string
		err := h.DB.QueryRow(`
			SELECT 
				CASE 
					WHEN COUNT(CASE WHEN s.status = 'outage' THEN 1 END) > 0 THEN 'outage'
					WHEN COUNT(CASE WHEN s.status = 'degraded' THEN 1 END) > 0 THEN 'degraded'
					WHEN COUNT(CASE WHEN s.status = 'maintenance' THEN 1 END) > 0 THEN 'maintenance'
					ELSE 'operational'
				END as worst_status
			FROM services s
			INNER JOIN service_group_members sgm ON s.id = sgm.service_id
			WHERE sgm.group_id = $1
		`, g.ID).Scan(&worstStatus)

		if err != nil {
			g.Status = "operational"
		} else {
			g.Status = worstStatus
		}

		groups = append(groups, g)
	}

	if groups == nil {
		groups = []ServiceGroup{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(groups)
}

// GetServiceGroupUptime returns uptime data for a service group (last 90 days)
func (h *PublicHandler) GetServiceGroupUptime(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	// Virtual service ID for groups is negative
	virtualServiceID := -groupID

	rows, err := h.DB.Query(`
		SELECT date, uptime_percentage 
		FROM uptime_logs 
		WHERE service_id = $1 
		AND date >= CURRENT_DATE - INTERVAL '90 days'
		ORDER BY date ASC
	`, virtualServiceID)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type UptimeDay struct {
		Date             string  `json:"date"`
		UptimePercentage float64 `json:"uptime_percentage"`
	}

	var uptimeDays []UptimeDay
	for rows.Next() {
		var day UptimeDay
		if err := rows.Scan(&day.Date, &day.UptimePercentage); err != nil {
			continue
		}
		uptimeDays = append(uptimeDays, day)
	}

	if uptimeDays == nil {
		uptimeDays = []UptimeDay{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(uptimeDays)
}

// GetServiceGroupMembers returns all services that are members of a group
func (h *PublicHandler) GetServiceGroupMembers(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	rows, err := h.DB.Query(`
		SELECT s.id, s.name, s.description, s.status, s.is_visible
		FROM services s
		INNER JOIN service_group_members sgm ON s.id = sgm.service_id
		WHERE sgm.group_id = $1
		ORDER BY s.name
	`, groupID)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type ServiceMember struct {
		ID          int    `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
		Status      string `json:"status"`
		IsVisible   bool   `json:"is_visible"`
	}

	var members []ServiceMember
	for rows.Next() {
		var m ServiceMember
		if err := rows.Scan(&m.ID, &m.Name, &m.Description, &m.Status, &m.IsVisible); err != nil {
			continue
		}
		members = append(members, m)
	}

	if members == nil {
		members = []ServiceMember{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(members)
}
