package models

import "time"

type User struct {
	ID           int       `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}

type Service struct {
	ID                 int       `json:"id"`
	Name               string    `json:"name"`
	Description        string    `json:"description"`
	Status             string    `json:"status"`
	Position           int       `json:"position"`
	URL                *string   `json:"url"`
	HeartbeatInterval  int       `json:"heartbeat_interval"`
	RequestTimeout     int       `json:"request_timeout"`
	Retries            int       `json:"retries"`
	IsVisible          bool      `json:"is_visible"`
	Incident           *string   `json:"incident"`
	IncidentPublished  bool      `json:"incident_published"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type Incident struct {
	ID          int              `json:"id"`
	Title       string           `json:"title"`
	Description string           `json:"description"`
	Severity    string           `json:"severity"`
	Status      string           `json:"status"`
	ServiceID   *int             `json:"service_id"`
	IsVisible   bool             `json:"is_visible"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
	ResolvedAt  *time.Time       `json:"resolved_at"`
	Updates     []IncidentUpdate `json:"updates,omitempty"`
}

type IncidentUpdate struct {
	ID         int       `json:"id"`
	IncidentID int       `json:"incident_id"`
	Message    string    `json:"message"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}

type Maintenance struct {
	ID                 int        `json:"id"`
	Title              string     `json:"title"`
	Description        string     `json:"description"`
	Status             string     `json:"status"`
	ScheduledStart     time.Time  `json:"scheduled_start"`
	ScheduledEnd       time.Time  `json:"scheduled_end"`
	ActualStart        *time.Time `json:"actual_start"`
	ActualEnd          *time.Time `json:"actual_end"`
	SendEmail          bool       `json:"send_email"`
	EmailSent          bool       `json:"email_sent"`
	EmailScheduledTime *time.Time `json:"email_scheduled_time"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
	Services           []int      `json:"services,omitempty"`
}

type Monitor struct {
	ID             int        `json:"id"`
	Name           string     `json:"name"`
	URL            string     `json:"url"`
	ServiceID      *int       `json:"service_id"`
	Status         string     `json:"status"`
	LastStatusCode *int       `json:"last_status_code"`
	LastCheck      *time.Time `json:"last_check"`
	LastError      *string    `json:"last_error"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type MonitorCheckRequest struct {
	Name       string `json:"name"`
	URL        string `json:"url"`
	StatusCode int    `json:"status_code"`
	Error      string `json:"error,omitempty"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
}

type StatusResponse struct {
	Status   string    `json:"status"`
	Services []Service `json:"services"`
}

type Subscriber struct {
	ID                int       `json:"id"`
	Email             string    `json:"email"`
	IsActive          bool      `json:"is_active"`
	CreatedAt         time.Time `json:"created_at"`
	UnsubscribeToken  string    `json:"-"`
}

type SubscribeRequest struct {
	Email string `json:"email"`
}
