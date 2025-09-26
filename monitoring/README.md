# IoT Classroom Monitoring Stack

This directory contains the complete monitoring setup for the IoT Classroom System using Prometheus and Grafana.

## Components

### Prometheus
- **Port**: 9090
- **Purpose**: Metrics collection and alerting
- **Configuration**: `prometheus.yml`
- **Alerts**: `alert.rules.yml`

### Grafana
- **Port**: 3000
- **Purpose**: Visualization and dashboards
- **Admin Credentials**: admin/admin (change in production)
- **Dashboards**: Auto-provisioned from `dashboards/` directory

### Exporters
- **Node Exporter** (9100): System metrics
- **MongoDB Exporter** (9216): Database metrics
- **Redis Exporter** (9121): Cache metrics

## Quick Start

1. **Start Monitoring Stack**:
   ```bash
   docker-compose -f docker-compose.monitoring.yml up -d
   ```

2. **Access Interfaces**:
   - Grafana: http://localhost:3000 (admin/admin)
   - Prometheus: http://localhost:9090

3. **Start Full System**:
   ```bash
   docker-compose up -d
   ```

## Dashboards

### 1. IoT Classroom Analytics Dashboard (`iot-classroom-analytics.json`)
**Comprehensive overview dashboard with:**
- System health status and service availability
- Active IoT device counts and trends
- Real-time power consumption monitoring
- Classroom occupancy analytics
- Device health scores and uptime tracking
- Energy consumption over time (kWh)
- API performance and response times
- System resource utilization (CPU, memory, disk)

### 2. Energy Analytics Dashboard (`energy-analytics.json`)
**Focused on power and energy metrics:**
- Current total power consumption
- 24-hour power usage trends
- Energy consumption in kWh with cost analysis (₹7.5/kWh rate)
- Power usage breakdown by classroom
- Power factor efficiency monitoring
- Daily energy cost estimates
- 24-hour consumption patterns

### 3. Device Health Dashboard (`device-health.json`)
**Device monitoring and diagnostics:**
- Overall device health scores
- Online/offline device status
- Device health by classroom
- Uptime and downtime tracking
- Anomaly detection and severity levels
- Individual device health monitoring
- Occupancy sensor status

### 4. Occupancy Dashboard (`occupancy-dashboard.json`)
**Classroom utilization analytics:**
- Real-time classroom occupancy percentages
- Average occupancy by classroom
- Occupancy sensor health monitoring
- Peak vs average occupancy statistics
- Occupancy level distribution (high/medium/low)
- 24-hour occupancy patterns
- Classroom utilization efficiency

### 5. Classroom Usage Dashboard (`classroom-usage.json`)
**Legacy dashboard with basic metrics:**
- Device ON/OFF counts
- Total power usage in watts

## Metrics Collected

### Application Metrics
- HTTP request duration and status
- Database connection pools
- Cache hit/miss ratios
- AI/ML service performance

### System Metrics
- CPU, memory, disk usage
- Network I/O and errors
- Process information

### IoT-Specific Metrics
- Device online/offline status
- Energy consumption (kWh)
- Power usage (watts)
- Power factor efficiency
- Classroom occupancy (%)
- Device health scores
- Uptime/downtime tracking
- Anomaly counts and severity

## Alerting Rules

### Critical Alerts
- Backend API down
- Database down
- Low disk space (< 10%)

### Warning Alerts
- AI/ML service down
- High CPU/memory usage (>80%)
- API response time > 2s
- Power usage spikes (>1000W)
- Network errors

### Info Alerts
- Device offline (>5 minutes)
- Class schedule disruptions
- Abnormal energy consumption

## React App Integration

The Grafana dashboards are integrated into the React application through the `GrafanaPage` component, which provides:

- **Tabbed Interface**: Overview, Detailed Analytics, and Raw Metrics views
- **Health Monitoring**: Real-time Grafana service status
- **Quick Access**: Direct links to specific dashboards
- **Responsive Design**: Mobile-friendly dashboard viewing

Access via: **Analytics & Monitoring** → **Grafana Analytics**

## Configuration

### Prometheus
Edit `prometheus.yml` to:
- Add new scrape targets
- Modify scrape intervals
- Configure alerting endpoints

### Grafana
- Dashboards auto-provisioned from `grafana-provisioning/dashboards/` directory
- Data source auto-configured for Prometheus
- Additional plugins can be installed via environment variables

### Alerting
Edit `alert.rules.yml` to:
- Add custom alerting rules
- Modify thresholds
- Configure alert labels and annotations

## Production Considerations

1. **Security**:
   - Change default Grafana admin password
   - Configure proper authentication
   - Use HTTPS with certificates
   - Network segmentation

2. **Scalability**:
   - Configure Prometheus federation for multiple regions
   - Use remote write for long-term storage
   - Implement high availability setup

3. **Backup**:
   - Backup Grafana database
   - Backup Prometheus data
   - Export dashboard configurations

## Testing

Run the monitoring test script to verify all components:

**Windows**: `monitoring\test_monitoring.bat`
**Linux/Mac**: `monitoring/test_monitoring.sh`

## Troubleshooting

### Common Issues

1. **Grafana not accessible**:
   - Check if port 3000 is available
   - Verify container is running: `docker ps`
   - Check logs: `docker logs grafana`

2. **No metrics in Prometheus**:
   - Verify target services are running
   - Check network connectivity between containers
   - Review Prometheus configuration syntax

3. **Alerts not firing**:
   - Verify alert rules syntax
   - Check Prometheus alerting configuration
   - Ensure alertmanager is properly configured

4. **Dashboards not loading**:
   - Check Grafana provisioning logs
   - Verify JSON syntax in dashboard files
   - Clear browser cache

### Useful Commands

```bash
# View all running containers
docker ps

# Check container logs
docker logs <container_name>

# Restart monitoring stack
docker-compose -f docker-compose.monitoring.yml restart

# Validate Prometheus configuration
docker run --rm -v $(pwd)/monitoring/prometheus.yml:/tmp/prometheus.yml prom/prometheus --config.check --config.file=/tmp/prometheus.yml

# Access Grafana CLI
docker exec -it grafana grafana-cli admin reset-admin-password <new_password>
```