# Deployment Instructions - EC2 Updates

## Changes Made

### 1. Frontend Fixes
- Fixed ServiceList component to properly display services without groups
- Updated `.env.production` with correct API URL
- Removed timezone references (SP timezone) and standardized to UTC

### 2. Nginx Configuration
- Added proper API proxy routes (`/api/`)
- Fixed routing for public and admin endpoints
- Configuration file: `nginx-statuspage.conf`

### 3. Cron Job Setup
- Created `setup-uptime-cron.sh` to configure hourly uptime updates
- Script runs `update-daily-uptime.py` every hour to sync service status with uptime logs

### 4. Database Settings
- Display mode set to "uptime" 
- Grid columns set to 1

## Deployment Steps

### On EC2:

```bash
# 1. Pull latest code
cd /opt/statuspage
git pull

# 2. Update Nginx configuration
sudo cp nginx-statuspage.conf /etc/nginx/sites-enabled/statuspage
sudo nginx -t
sudo systemctl reload nginx

# 3. Setup cron job
./setup-uptime-cron.sh

# 4. Run full deployment
./deploy-ec2.sh
```

## Verification

After deployment, verify:

1. **Public page**: https://status.piercloud.com/
   - Should show uptime mode with bars
   - Service groups should be expandable
   - Standalone services should appear as cards

2. **Backoffice**: https://status.piercloud.com/area/
   - Login should work
   - All admin functions operational

3. **API endpoints**:
   ```bash
   curl https://status.piercloud.com/api/public/display-mode
   curl https://status.piercloud.com/api/public/services
   curl https://status.piercloud.com/api/public/service-groups
   ```

4. **Cron job**:
   ```bash
   crontab -l | grep uptime
   tail -f /var/log/uptime-update.log
   ```

## Rollback

If issues occur:
```bash
cd /opt/statuspage
git reset --hard HEAD~1
./deploy-ec2.sh
```
