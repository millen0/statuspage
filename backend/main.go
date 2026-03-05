package main

import (
	"log"
	"net/http"
	"statuspage/config"
	"statuspage/database"
	"statuspage/handlers"
	"statuspage/middleware"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
)

func main() {
	// Load .env file
	godotenv.Load()
	
	cfg := config.Load()

	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	r := mux.NewRouter()

	publicHandler := &handlers.PublicHandler{DB: db}
	authHandler := &handlers.AuthHandler{DB: db, JWTSecret: cfg.JWTSecret}
	adminHandler := &handlers.AdminHandler{DB: db}
	monitorHandler := &handlers.MonitorHandler{DB: db}

	// Public routes
	r.HandleFunc("/api/status-page/heartbeat/app", publicHandler.GetHeartbeat).Methods("GET")
	r.HandleFunc("/api/public/services", publicHandler.GetServices).Methods("GET")
	r.HandleFunc("/api/public/incidents", publicHandler.GetIncidents).Methods("GET")
	r.HandleFunc("/api/public/maintenances", publicHandler.GetMaintenances).Methods("GET")
	r.HandleFunc("/api/public/subscribe", publicHandler.Subscribe).Methods("POST")
	r.HandleFunc("/api/public/unsubscribe", publicHandler.Unsubscribe).Methods("GET")
	r.HandleFunc("/api/public/display-mode", publicHandler.GetDisplayMode).Methods("GET")

	// Area routes (hidden page)
	r.HandleFunc("/api/area/services", publicHandler.GetAllServices).Methods("GET")
	r.HandleFunc("/api/area/services/{id}/visibility", publicHandler.ToggleServiceVisibility).Methods("PATCH")

	// Auth routes
	r.HandleFunc("/api/auth/login", authHandler.Login).Methods("POST")

	// Monitor routes (public for script to report)
	r.HandleFunc("/api/monitors/report", monitorHandler.ReportMonitorCheck).Methods("POST")
	r.HandleFunc("/api/monitors", monitorHandler.GetMonitors).Methods("GET")

	// Admin routes (protected)
	admin := r.PathPrefix("/api/admin").Subrouter()
	admin.Use(middleware.AuthMiddleware(cfg.JWTSecret))

	admin.HandleFunc("/services", adminHandler.GetServices).Methods("GET")
	admin.HandleFunc("/services", adminHandler.CreateService).Methods("POST")
	admin.HandleFunc("/services/{id}", adminHandler.UpdateService).Methods("PUT")
	admin.HandleFunc("/services/{id}", adminHandler.DeleteService).Methods("DELETE")
	admin.HandleFunc("/services/{id}/visibility", adminHandler.ToggleServiceVisibility).Methods("PATCH")
	admin.HandleFunc("/services/{id}/publish-incident", adminHandler.PublishServiceIncident).Methods("POST")
	admin.HandleFunc("/services/{id}/unpublish-incident", adminHandler.UnpublishServiceIncident).Methods("POST")

	admin.HandleFunc("/incidents", adminHandler.GetIncidents).Methods("GET")
	admin.HandleFunc("/incidents", adminHandler.CreateIncident).Methods("POST")
	admin.HandleFunc("/incidents/{id}", adminHandler.UpdateIncident).Methods("PUT")
	admin.HandleFunc("/incidents/{id}", adminHandler.DeleteIncident).Methods("DELETE")
	admin.HandleFunc("/incidents/{id}/updates", adminHandler.AddIncidentUpdate).Methods("POST")
	admin.HandleFunc("/incidents/{id}/visibility", adminHandler.ToggleIncidentVisibility).Methods("PATCH")

	admin.HandleFunc("/maintenances", adminHandler.GetMaintenances).Methods("GET")
	admin.HandleFunc("/maintenances", adminHandler.CreateMaintenance).Methods("POST")
	admin.HandleFunc("/maintenances/{id}", adminHandler.UpdateMaintenance).Methods("PUT")
	admin.HandleFunc("/maintenances/{id}", adminHandler.DeleteMaintenance).Methods("DELETE")

	admin.HandleFunc("/subscribers", adminHandler.GetSubscribers).Methods("GET")
	admin.HandleFunc("/subscribers/{id}", adminHandler.DeleteSubscriber).Methods("DELETE")
	admin.HandleFunc("/subscribers/download", adminHandler.DownloadSubscribers).Methods("GET")

	admin.HandleFunc("/settings/display-mode", adminHandler.UpdateDisplayMode).Methods("PUT")

	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})

	handler := c.Handler(r)

	log.Printf("Server starting on port %s", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, handler))
}
