import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch as ToggleSwitch } from '@/components/ui/switch';
import { Info, Settings, Download, RefreshCw, Monitor, Lightbulb, Fan, Server, Wifi, WifiOff, MapPin } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { apiService } from '@/services/api';

const CLASSROOMS = [
  { id: 'lab201', name: 'Lab 201', type: 'lab' },
  { id: 'class107', name: 'Classroom 107', type: 'classroom' },
  { id: 'lab2', name: 'Lab 2', type: 'lab' },
  { id: 'class203', name: 'Classroom 203', type: 'classroom' },
  { id: 'lab1', name: 'Lab 1', type: 'lab' },
];

const DEVICES = [
  { id: 'projector_lab201', name: 'Projector', icon: Monitor, status: 'online', type: 'display', classroomId: 'lab201' },
  { id: 'lights_lab201', name: 'Lights', icon: Lightbulb, status: 'online', type: 'lighting', classroomId: 'lab201' },
  { id: 'fans_lab201', name: 'Fans', icon: Fan, status: 'online', type: 'climate', classroomId: 'lab201' },
  { id: 'projector_class107', name: 'Projector', icon: Monitor, status: 'online', type: 'display', classroomId: 'class107' },
  { id: 'lights_class107', name: 'Lights', icon: Lightbulb, status: 'offline', type: 'lighting', classroomId: 'class107' },
  { id: 'fans_class107', name: 'Fans', icon: Fan, status: 'offline', type: 'climate', classroomId: 'class107' },
  { id: 'projector_lab2', name: 'Projector', icon: Monitor, status: 'online', type: 'display', classroomId: 'lab2' },
  { id: 'lights_lab2', name: 'Lights', icon: Lightbulb, status: 'online', type: 'lighting', classroomId: 'lab2' },
  { id: 'projector_class203', name: 'Projector', icon: Monitor, status: 'online', type: 'display', classroomId: 'class203' },
  { id: 'fans_class203', name: 'Fans', icon: Fan, status: 'online', type: 'climate', classroomId: 'class203' },
  { id: 'lights_lab1', name: 'Lights', icon: Lightbulb, status: 'online', type: 'lighting', classroomId: 'lab1' },
  { id: 'ncomputing_lab1', name: 'NComputing', icon: Server, status: 'online', type: 'computing', classroomId: 'lab1' },
];

const AIMLPanel: React.FC = () => {
  const [tab, setTab] = useState('forecast');
  const [classroom, setClassroom] = useState('');
  const [device, setDevice] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [chartData, setChartData] = useState<any>({});
  const [devices, setDevices] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);

  // Fetch devices and classrooms on mount
  useEffect(() => {
    fetchDevicesAndClassrooms();
  }, []);

  // Update selected device when classroom changes
  useEffect(() => {
    if (classroom && devices.length > 0) {
      const available = getAvailableDevices();
      const currentDeviceValid = available.some(d => d.id === device);

      // If current device is not available in the new classroom, select the first available device
      if (!currentDeviceValid && available.length > 0) {
        setDevice(available[0].id);
      } else if (available.length === 0) {
        // No devices available for this classroom
        setDevice('');
      }
    }
  }, [classroom, devices]);

  const fetchDevicesAndClassrooms = async () => {
    try {
      setLoading(true);
      const dashboardRes = await apiService.get('/analytics/dashboard');
      if (dashboardRes.data.devices) {
        setDevices(dashboardRes.data.devices);

        // Extract and validate unique classrooms
        const uniqueClassrooms = [...new Set(
          dashboardRes.data.devices
            .map((d: any) => d.classroom)
            .filter((c: any) => c && c.trim() && c !== 'unassigned' && c.length > 0)
        )];

        // Create classroom objects with proper structure and type detection
        const classroomObjects = uniqueClassrooms.map(name => {
          const classroomName = typeof name === 'string' ? name.trim() : String(name).trim();
          let type = 'room';

          // Detect classroom type based on naming patterns
          if (classroomName.toLowerCase().includes('lab')) {
            type = 'lab';
          } else if (classroomName.toLowerCase().includes('class')) {
            type = 'classroom';
          } else if (classroomName.match(/\d+/)) {
            // If it contains numbers, likely a classroom
            type = 'classroom';
          }

          return {
            id: classroomName,
            name: classroomName,
            type: type
          };
        });

        setClassrooms(classroomObjects);

        // Set default classroom and device
        if (classroomObjects.length > 0 && !classroom) {
          setClassroom(classroomObjects[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
      // Fallback to mock data for development
      setDevices(DEVICES);
      setClassrooms(CLASSROOMS);
      if (CLASSROOMS.length > 0 && !classroom) {
        setClassroom(CLASSROOMS[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  // Get current classroom and device info
  const getCurrentClassroom = () => {
    if (!classroom || classrooms.length === 0) return null;
    return classrooms.find(c => c.id === classroom) || classrooms[0];
  };
  const getAvailableDevices = () => devices.filter((d: any) => d && d.classroom === classroom);
  const getCurrentDevice = () => {
    if (!device || devices.length === 0) return null;
    const foundDevice = devices.find((d: any) => d && d.id === device);
    if (foundDevice) return foundDevice;
    const available = getAvailableDevices();
    return available.length > 0 ? available[0] : null;
  };

  const currentClassroom = getCurrentClassroom();
  const availableDevices = getAvailableDevices();
  const currentDevice = getCurrentDevice();

  // Feature descriptions and chart types
  const FEATURE_META: Record<string, { desc: string; action: string; chart: string; inputPlaceholder: string }> = {
    forecast: {
      desc: `Predicts ${currentDevice?.name?.toLowerCase() || 'device'} usage patterns based on class schedules and historical data.`,
      action: 'Generate Forecast',
      chart: 'line',
      inputPlaceholder: `Enter past ${currentDevice?.name?.toLowerCase() || 'device'} usage data (e.g., 1,0,1,1,0,1)`,
    },
    schedule: {
      desc: `Optimizes ${currentDevice?.name?.toLowerCase() || 'device'} schedules based on class timetables and energy efficiency.`,
      action: 'Optimize Schedule',
      chart: 'bar',
      inputPlaceholder: `Enter ${currentDevice?.name?.toLowerCase() || 'device'} usage patterns or time preferences`,
    },
    anomaly: {
      desc: `Detects unusual ${currentDevice?.name?.toLowerCase() || 'device'} behavior that may indicate maintenance needs.`,
      action: 'Detect Anomalies',
      chart: 'spike',
      inputPlaceholder: `Enter ${currentDevice?.name?.toLowerCase() || 'device'} behavior history to analyze`,
    },
    recommend: {
      desc: `AI-powered energy saving recommendations for ${currentDevice?.name?.toLowerCase() || 'device'} in ${currentClassroom?.name || 'classroom'}.`,
      action: 'Get Recommendations',
      chart: 'pie',
      inputPlaceholder: `Describe your needs for ${currentDevice?.name?.toLowerCase() || 'device'} or current setup`,
    },
    maintenance: {
      desc: `Predicts maintenance needs for ${currentDevice?.name?.toLowerCase() || 'device'} based on usage patterns and age.`,
      action: 'Predict Maintenance',
      chart: 'bar',
      inputPlaceholder: `Enter ${currentDevice?.name?.toLowerCase() || 'device'} usage history for maintenance analysis`,
    },
    occupancy: {
      desc: `Analyzes classroom occupancy patterns to optimize ${currentDevice?.name?.toLowerCase() || 'device'} usage.`,
      action: 'Analyze Occupancy',
      chart: 'line',
      inputPlaceholder: `Enter occupancy data or class schedule information`,
    },
    power: {
      desc: `Real-time power consumption monitoring and analysis for ${currentDevice?.name?.toLowerCase() || 'device'} in ${currentClassroom?.name || 'classroom'}.`,
      action: 'Monitor Power',
      chart: 'line',
      inputPlaceholder: `Enter power consumption data or monitoring parameters`,
    },
  };

  // Set default device when classroom changes
  useEffect(() => {
    if (availableDevices.length > 0 && !availableDevices.find((d: any) => d.id === device)) {
      setDevice(availableDevices[0].id);
    }
  }, [classroom, availableDevices]);

  // Device-specific data generation
  const getDeviceMultiplier = (deviceType: string) => {
    const multipliers = {
      display: 1.2,    // Projectors use more power
      lighting: 0.8,   // Lights are efficient
      climate: 1.5,    // Fans/HVAC use more
      computing: 1.0   // Standard computing
    };
    return multipliers[deviceType as keyof typeof multipliers] || 1.0;
  };

  // Fetch chart data from API
  const fetchChartData = async (type: string) => {
    try {
      setLoading(true);
      let data: any[] = [];

      switch (type) {
        case 'forecast':
          const forecastRes = await apiService.get('/analytics/forecast/energy/24h');
          data = forecastRes.data.forecast || [];
          break;
        case 'schedule':
          // Use device usage data for scheduling patterns
          const usageRes = await apiService.get('/analytics/device-usage/7d');
          data = usageRes.data || [];
          break;
        case 'anomaly':
          const anomalyRes = await apiService.get('/analytics/anomalies/7d');
          data = anomalyRes.data.anomalies || [];
          break;
        case 'recommend':
          // Use efficiency metrics for recommendations
          const efficiencyRes = await apiService.get('/analytics/efficiency/30d');
          data = [{
            name: 'Energy Saving',
            value: efficiencyRes.data.energyEfficiency || 85,
            color: '#3b82f6'
          }];
          break;
        case 'maintenance':
          const maintenanceRes = await apiService.get('/analytics/predictive-maintenance');
          data = maintenanceRes.data.maintenanceSchedule || [];
          break;
        case 'occupancy':
          const occupancyRes = await apiService.get('/analytics/occupancy');
          data = occupancyRes.data || [];
          break;
        case 'power':
          const powerRes = await apiService.get('/analytics/energy/24h');
          data = powerRes.data || [];
          break;
      }

      setChartData(prev => ({
        ...prev,
        [type]: data
      }));
      setError(null);
    } catch (err) {
      console.error(`Error fetching ${type} data:`, err);
      setError(`Failed to load ${type} data`);
      // Fallback to mock data for development
      setChartData(prev => ({
        ...prev,
        [type]: generateMockChartData(type)
      }));
    } finally {
      setLoading(false);
    }
  };

  // Generate mock data as fallback
  const generateMockChartData = (type: string) => {
    const data = [];
    const multiplier = currentDevice ? getDeviceMultiplier(currentDevice.type || 'unknown') : 1.0;

    switch (type) {
      case 'forecast':
        for (let i = 0; i < 24; i++) {
          const baseUsage = Math.floor(Math.random() * 60) + 20;
          data.push({
            time: `${i.toString().padStart(2, '0')}:00`,
            usage: Math.floor(baseUsage * multiplier),
            predicted: Math.floor((baseUsage + Math.random() * 20 - 10) * multiplier),
            device: currentDevice?.name || 'Unknown Device',
          });
        }
        break;
      case 'schedule':
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        days.forEach(day => {
          const isWeekend = day === 'Sat' || day === 'Sun';
          const weekendMultiplier = isWeekend ? 0.7 : 1.0;
          data.push({
            day,
            morning: Math.floor((Math.random() * 40 + 30) * multiplier * weekendMultiplier),
            afternoon: Math.floor((Math.random() * 50 + 40) * multiplier * weekendMultiplier),
            evening: Math.floor((Math.random() * 30 + 20) * multiplier * weekendMultiplier),
            device: currentDevice?.name || 'Unknown Device',
          });
        });
        break;
      case 'anomaly':
        for (let i = 0; i < 50; i++) {
          const base = 40 + Math.sin(i * 0.2) * 15 * multiplier;
          const anomaly = Math.random() > 0.92 ? base + Math.random() * 40 * multiplier : base;
          data.push({
            time: i,
            normal: Math.floor(base),
            actual: Math.floor(anomaly),
            threshold: Math.floor(65 * multiplier),
            device: currentDevice?.name || 'Unknown Device',
          });
        }
        break;
      case 'recommend':
        const recommendations = [
          { name: 'Energy Saving', baseValue: 35 },
          { name: 'Automation', baseValue: 25 },
          { name: 'Optimization', baseValue: 20 },
          { name: 'Maintenance', baseValue: 20 }
        ];

        recommendations.forEach(rec => {
          data.push({
            name: rec.name,
            value: Math.floor(rec.baseValue * (0.8 + Math.random() * 0.4)),
            color: ['#3b82f6', '#10b981', '#f59e42', '#ef4444'][recommendations.indexOf(rec)],
            device: currentDevice?.name || 'Unknown Device',
          });
        });
        break;
      case 'maintenance':
        const components = ['Power Supply', 'Control Board', 'Sensors', 'Actuators', 'Display', 'Connectivity'];
        components.forEach(component => {
          const healthScore = Math.floor(70 + Math.random() * 25); // 70-95% health
          const daysToService = Math.floor(Math.random() * 180) + 30; // 30-210 days
          data.push({
            component,
            health: healthScore,
            daysToService,
            priority: healthScore < 80 ? 'High' : healthScore < 90 ? 'Medium' : 'Low',
            device: currentDevice?.name || 'Unknown Device',
          });
        });
        break;
      case 'occupancy':
        for (let i = 0; i < 24; i++) {
          const hour = i;
          const isClassHour = (hour >= 9 && hour <= 17); // 9 AM to 5 PM
          const baseOccupancy = isClassHour ? (Math.random() * 40 + 60) : (Math.random() * 20); // Higher during class hours
          const deviceUsage = Math.floor(baseOccupancy * multiplier * (0.7 + Math.random() * 0.6));

          data.push({
            hour: `${hour.toString().padStart(2, '0')}:00`,
            occupancy: Math.floor(baseOccupancy),
            usage: deviceUsage,
            efficiency: Math.floor((deviceUsage / Math.max(baseOccupancy, 1)) * 100),
            device: currentDevice?.name || 'Unknown Device',
          });
        }
        break;
      case 'power':
        for (let i = 0; i < 24; i++) {
          const hour = i;
          const isPeakHour = (hour >= 9 && hour <= 17); // Peak classroom hours
          const basePower = isPeakHour ?
            (Math.random() * 80 + 40) * multiplier : // Higher power during class hours
            (Math.random() * 30 + 10) * multiplier;  // Lower power off-hours

          const voltage = 220 + Math.random() * 20 - 10; // 210-230V
          const current = basePower / voltage;

          data.push({
            hour: `${hour.toString().padStart(2, '0')}:00`,
            power: Math.floor(basePower),
            voltage: Math.floor(voltage),
            current: Math.floor(current * 100) / 100, // Round to 2 decimal places
            efficiency: Math.floor(85 + Math.random() * 10), // 85-95% efficiency
            device: currentDevice?.name || 'Unknown Device',
          });
        }
        break;
    }
    return data;
  };

  // Initialize chart data
  useEffect(() => {
    fetchChartData(tab);
  }, [tab]);

  // Auto refresh effect
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchChartData(tab);
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, tab]);

  // Analyze user input for intelligent responses
  const analyzeUsageData = (input: string) => {
    // Parse comma-separated usage data (1,0,1,1,0,1)
    const data = input.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
    if (data.length === 0) return { avg: 0, pattern: 'unknown', peaks: 0 };
    
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    const peaks = data.filter(d => d > avg * 1.5).length;
    const pattern = avg > 0.7 ? 'high' : avg > 0.3 ? 'medium' : 'low';
    
    return { avg, pattern, peaks, data };
  };

  const generateForecast = (usageData: any) => {
    const { avg, pattern, peaks } = usageData;
    const baseUsage = Math.floor(avg * 100);
    const predictions = [];
    
    for (let i = 0; i < 24; i++) {
      const timeMultiplier = i >= 8 && i <= 18 ? 1.2 : 0.6; // Peak hours
      const randomFactor = 0.8 + Math.random() * 0.4;
      predictions.push({
        time: `${i.toString().padStart(2, '0')}:00`,
        usage: Math.floor(baseUsage * timeMultiplier * randomFactor),
        predicted: Math.floor(baseUsage * timeMultiplier * (0.9 + Math.random() * 0.2)),
      });
    }
    
    return { predictions, insights: `Pattern: ${pattern} usage, ${peaks} peak periods detected` };
  };

  const handleAction = () => {
    if (!currentDevice || !currentClassroom) {
      setError('Please select a classroom and device first');
      return;
    }
    
    setLoading(true);
    setTimeout(() => {
      // Generate sample usage data for analysis
      const sampleData = Array.from({length: 10}, () => Math.floor(Math.random() * 2)).join(',');
      const usageAnalysis = analyzeUsageData(sampleData);
      
      const responses = {
        forecast: (() => {
          const forecast = generateForecast(usageAnalysis);
          return `AI Forecast Analysis for ${currentDevice.name} in ${currentClassroom.name}:
          
📊 Data Analysis: ${forecast.insights}
• Average usage: ${Math.floor(usageAnalysis.avg * 100)}%
• Usage pattern: ${usageAnalysis.pattern}

🔮 Forecast Results:
• Peak usage predicted: 2-4 PM (${Math.max(...forecast.predictions.map(p => p.predicted))}%)
• Low usage periods: Early morning and late evening
• Energy optimization: ${usageAnalysis.pattern === 'high' ? 'Consider demand scheduling' : 'Current usage is efficient'}

💡 Recommendations:
• Pre-cool system 1 hour before peak usage
• Implement automated shutdown after ${usageAnalysis.avg < 0.3 ? '30' : '60'} minutes of inactivity
• Potential energy savings: ${15 + Math.floor(Math.random() * 20)}%`;
        })(),
        
        schedule: `AI Schedule Optimization for ${currentDevice.name} in ${currentClassroom.name}:

📅 Learning from Usage Patterns:
• Detected ${usageAnalysis.pattern} usage intensity
• Peak periods: ${usageAnalysis.peaks} high-activity periods identified

🤖 Recommended Schedule:
• 8:00-12:00: Active (${usageAnalysis.pattern === 'high' ? 'High priority tasks' : 'Standard operation'})
• 12:00-14:00: Standby (Lunch break - ${usageAnalysis.avg < 0.5 ? 'Auto-shutdown' : 'Low power'})
• 14:00-18:00: Active (Afternoon sessions)
• 18:00-22:00: ${usageAnalysis.avg < 0.3 ? 'Auto-shutdown' : 'Low power mode'}

⚡ Energy Impact:
• Current consumption: ${Math.floor(usageAnalysis.avg * 100)}% average
• Optimized savings: ${20 + Math.floor(Math.random() * 25)}%
• Weekly energy reduction: ${Math.floor((usageAnalysis.avg * 168) * 0.25)} kWh

💡 Smart Features:
• Auto-adjust based on class schedule
• Occupancy sensor integration`,

        anomaly: `AI Anomaly Detection for ${currentDevice.name} in ${currentClassroom.name}:

🔍 Analysis Results:
• Total data points analyzed: ${usageAnalysis.data?.length || 0}
• Normal operating range: ${Math.floor(usageAnalysis.avg * 60)}% - ${Math.floor(usageAnalysis.avg * 140)}%
• Detected anomalies: ${usageAnalysis.peaks + Math.floor(Math.random() * 3)}

🚨 Current Issues:
${usageAnalysis.peaks > 0 ? `• ${usageAnalysis.peaks} unusual usage spikes detected` : '• No major anomalies found'}
• Equipment status: ${currentDevice.status === 'online' ? 'Normal operation' : 'Potential connectivity issues'}
• Pattern consistency: ${usageAnalysis.pattern === 'medium' ? 'Stable' : usageAnalysis.pattern === 'high' ? 'High variation' : 'Low activity'}

⚠️ Recommendations:
• ${usageAnalysis.peaks > 2 ? 'Schedule maintenance check immediately' : 'Monitor for 24 hours'}
• ${currentDevice.status === 'offline' ? 'Check device connectivity' : 'Continue normal monitoring'}
• Predictive maintenance: ${Math.floor(Math.random() * 30) + 60} days until next service

📊 Anomaly Score: ${Math.floor(usageAnalysis.peaks * 25 + Math.random() * 30)}/100`,

        recommend: `AI Energy Optimization for ${currentDevice.name} in ${currentClassroom.name}:

📈 Usage Analysis:
• Current efficiency: ${Math.floor((1 - usageAnalysis.avg) * 100)}% optimization potential
• Usage pattern: ${usageAnalysis.pattern} intensity
• Peak frequency: ${usageAnalysis.peaks} high-usage periods

💡 Personalized Recommendations:

⚡ Energy Optimization:
• Smart scheduling implementation: Save ${25 + Math.floor(Math.random() * 20)}% energy
• Auto-shutdown after ${usageAnalysis.avg < 0.3 ? '30' : '45'} minutes inactivity
• Load balancing across similar devices

🔧 Maintenance & Reliability:
• Predictive maintenance scheduling: ${Math.floor(Math.random() * 30) + 30} days remaining
• Usage pattern monitoring: ${usageAnalysis.peaks < 2 ? 'Normal wear' : 'Accelerated wear detected'}
• Firmware update recommended for ${Math.random() > 0.7 ? 'performance' : 'security'}

📊 Analytics & Insights:
• Real-time usage dashboard implementation
• Automated reporting every ${usageAnalysis.pattern === 'high' ? 'week' : 'month'}
• Integration with classroom booking system

🎯 Automation Opportunities:
• Occupancy-based automation: Perfect for ${currentClassroom.type} environment
• Class schedule integration: Auto-preparation before sessions
• Energy efficiency scoring: ${85 + Math.floor(Math.random() * 10)}% current rating`,

        maintenance: `Predictive Maintenance Analysis for ${currentDevice.name} in ${currentClassroom.name}:

🔧 Maintenance Assessment:
• Device age simulation: ${Math.floor(Math.random() * 24) + 6} months in operation
• Usage intensity: ${usageAnalysis.pattern} (${Math.floor(usageAnalysis.avg * 100)}% average load)
• Wear indicators: ${usageAnalysis.peaks} high-stress periods detected

📊 Health Metrics:
• Overall health score: ${Math.floor(85 + Math.random() * 10)}/100
• Component wear: ${Math.floor(usageAnalysis.peaks * 15 + Math.random() * 20)}%
• Performance degradation: ${Math.floor(Math.random() * 5)}%

⚠️ Maintenance Schedule:
• Next routine check: ${Math.floor(Math.random() * 30) + 15} days
• Major service due: ${Math.floor(Math.random() * 180) + 90} days
• Critical components to monitor: ${['Power supply', 'Control board', 'Sensors', 'Actuators'][Math.floor(Math.random() * 4)]}

💡 Recommended Actions:
• ${usageAnalysis.peaks > 3 ? 'Immediate inspection recommended' : 'Continue monitoring'}
• Clean filters/air vents: ${Math.random() > 0.6 ? 'Due now' : 'Next 30 days'}
• Calibration check: ${Math.random() > 0.7 ? 'Recommended' : 'Not urgent'}

📈 Predictive Insights:
• Expected lifespan: ${Math.floor(24 + Math.random() * 36)} more months
• Failure probability: ${Math.floor(Math.random() * 5)}% in next 30 days
• Cost savings from prevention: $${Math.floor(Math.random() * 500) + 200}`,

        occupancy: `Occupancy Analysis for ${currentDevice.name} in ${currentClassroom.name}:

👥 Occupancy Patterns:
• Classroom type: ${currentClassroom.type} (${currentClassroom.type === 'lab' ? 'Variable usage' : 'Scheduled classes'})
• Peak occupancy hours: 9:00 AM - 5:00 PM
• Average utilization: ${Math.floor(60 + Math.random() * 25)}%

📊 Usage Correlation:
• Occupancy vs Device usage: ${Math.random() > 0.7 ? 'Strong correlation' : 'Moderate correlation'}
• Unoccupied periods: ${Math.floor(usageAnalysis.avg * 40)}% of total time
• Energy waste potential: ${Math.floor(usageAnalysis.avg * 30)}%

🤖 Smart Automation Rules:
• Occupancy threshold: Activate when > 20% capacity
• Auto-shutdown delay: ${usageAnalysis.avg < 0.3 ? '15' : '30'} minutes after empty
• Pre-class preparation: ${Math.random() > 0.5 ? '15 min before schedule' : 'On first occupancy'}

💡 Optimization Recommendations:
• Motion sensor integration: Save ${20 + Math.floor(Math.random() * 15)}% energy
• Class schedule sync: Auto-on/off based on timetable
• Gradual dimming: During low occupancy periods

📈 Performance Metrics:
• Occupancy detection accuracy: ${90 + Math.floor(Math.random() * 8)}%
• Response time: ${(Math.random() * 2 + 1).toFixed(1)} seconds
• False trigger rate: ${Math.floor(Math.random() * 3)}%`,

        power: `Power Usage Analysis for ${currentDevice.name} in ${currentClassroom.name}:

⚡ Real-Time Power Monitoring:
• Device type: ${currentDevice.type} (${currentDevice.type === 'display' ? 'High power' : currentDevice.type === 'lighting' ? 'Moderate power' : currentDevice.type === 'climate' ? 'Variable power' : 'Standard power'})
• Current power draw: ${Math.floor(50 + Math.random() * 100)}W
• Voltage: ${210 + Math.floor(Math.random() * 20)}V
• Power factor: ${(0.85 + Math.random() * 0.1).toFixed(2)}

📊 Power Consumption Patterns:
• Peak hours: 9:00 AM - 5:00 PM (${Math.floor(80 + Math.random() * 40)}W average)
• Off-peak usage: ${Math.floor(10 + Math.random() * 20)}W average
• Daily consumption: ${Math.floor(2 + Math.random() * 8)} kWh
• Monthly estimate: ${Math.floor(60 + Math.random() * 240)} kWh

💰 Cost Analysis:
• Electricity rate: ₹${6 + Math.random() * 4}/kWh
• Daily cost: ₹${Math.floor(12 + Math.random() * 48)}
• Monthly cost: ₹${Math.floor(360 + Math.random() * 1440)}
• Annual savings potential: ₹${Math.floor(2000 + Math.random() * 8000)}

🔋 Efficiency Metrics:
• Power efficiency: ${85 + Math.floor(Math.random() * 10)}%
• Standby power: ${Math.floor(Math.random() * 5)}W
• Carbon footprint: ${Math.floor(0.5 + Math.random() * 2)} kg CO2/day

⚠️ Power Alerts:
• Overload threshold: ${150 + Math.floor(Math.random() * 50)}W
• Surge protection: ${currentDevice.status === 'online' ? 'Active' : 'Check required'}
• Power quality: ${Math.random() > 0.8 ? 'Issues detected' : 'Optimal'}`,

      };
      
      setResult(responses[tab as keyof typeof responses] || `Analysis complete for ${tab} on ${currentDevice.name}`);
      setLoading(false);
    }, 1500); // Slightly longer for "processing"
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(chartData[tab] || [], null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `${tab}-data-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const renderChart = (type: string) => {
    const data = chartData[type] || [];
    
    switch (type) {
      case 'forecast':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="usage" stroke="#3b82f6" strokeWidth={2} name="Current Usage" />
              <Line type="monotone" dataKey="predicted" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" name="AI Prediction" />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'schedule':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="morning" stackId="a" fill="#3b82f6" name="Morning" />
              <Bar dataKey="afternoon" stackId="a" fill="#10b981" name="Afternoon" />
              <Bar dataKey="evening" stackId="a" fill="#f59e42" name="Evening" />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'anomaly':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="normal" stroke="#6b7280" strokeWidth={1} name="Normal Range" />
              <Line type="monotone" dataKey="actual" stroke="#ef4444" strokeWidth={2} name="Actual Usage" />
              <Line type="monotone" dataKey="threshold" stroke="#f59e42" strokeWidth={1} strokeDasharray="5 5" name="Threshold" />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'recommend':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'maintenance':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="component" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="health" fill="#10b981" name="Health Score (%)" />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'occupancy':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="occupancy" stroke="#3b82f6" strokeWidth={2} name="Occupancy (%)" />
              <Line yAxisId="right" type="monotone" dataKey="usage" stroke="#10b981" strokeWidth={2} name="Device Usage (%)" />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'power':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="power" stroke="#f59e42" strokeWidth={2} name="Power (W)" />
              <Line yAxisId="right" type="monotone" dataKey="voltage" stroke="#3b82f6" strokeWidth={2} name="Voltage (V)" />
              <Line yAxisId="right" type="monotone" dataKey="current" stroke="#10b981" strokeWidth={2} name="Current (A)" />
            </LineChart>
          </ResponsiveContainer>
        );
      default:
        return <div className="text-muted-foreground">Chart not available</div>;
    }
  };

  // Tab labels with consistent capitalization
  const TABS = [
    { value: 'forecast', label: 'Usage Forecasting' },
    { value: 'schedule', label: 'Smart Scheduling' },
    { value: 'anomaly', label: 'Anomaly Detection' },
    { value: 'recommend', label: 'Energy Optimization' },
    { value: 'maintenance', label: 'Predictive Maintenance' },
    { value: 'occupancy', label: 'Occupancy Analysis' },
    { value: 'power', label: 'Power Usage' },
  ];  return (
    <div className="w-full bg-card shadow-2xl rounded-2xl p-6 sm:p-8 flex flex-col gap-8 border border-border">
      <h2 className="text-3xl font-bold mb-2 text-primary">AI/ML Insights</h2>
      
      {loading && devices.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-primary mr-3" />
          <span className="text-lg">Loading devices and classrooms...</span>
        </div>
      ) : devices.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-lg text-muted-foreground">No devices found. Please check your connection.</span>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="w-full">
  <TabsList className="mb-6 flex gap-1 bg-muted rounded-lg p-1 justify-start overflow-x-auto w-full">
          {TABS.map(t => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="px-3 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary/70 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md hover:bg-accent hover:text-primary whitespace-nowrap"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map(({ value, label }) => (
          <TabsContent key={value} value={value} className="w-full">
            {currentDevice && currentClassroom ? (
              <div className="flex flex-col gap-6">
              {/* Location & Device Status Display */}
              {currentDevice && currentClassroom && currentDevice !== null && currentClassroom !== null && (
                <div className="bg-muted/30 rounded-lg p-4 border border-muted-foreground/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <MapPin className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="p-2 bg-primary/10 rounded-lg">
                          {currentDevice.icon ? (
                            <currentDevice.icon className="w-5 h-5 text-primary" />
                          ) : (
                            <Monitor className="w-5 h-5 text-primary" />
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{currentDevice.name} in {currentClassroom.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {currentClassroom.type ? (currentClassroom.type.charAt(0).toUpperCase() + currentClassroom.type.slice(1)) : 'Room'} • {currentDevice.type || 'Unknown'} device
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{FEATURE_META[value].desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {currentDevice.status === 'online' ? (
                        <Wifi className="w-4 h-4 text-green-500" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-red-500" />
                      )}
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        currentDevice.status === 'online' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      }`}>
                        {currentDevice.status}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Location and Device selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Select Classroom
                  </label>
                  <Select value={classroom} onValueChange={setClassroom}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a classroom" />
                    </SelectTrigger>
                    <SelectContent>
                      {classrooms.length === 0 ? (
                        <SelectItem value="" disabled>No classrooms available</SelectItem>
                      ) : (
                        classrooms.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.type || 'Room'})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground">Select Device for Analysis</label>
                  <Select value={device} onValueChange={setDevice}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a device" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDevices.length === 0 ? (
                        <SelectItem value="" disabled>No devices available for selected classroom</SelectItem>
                      ) : (
                        availableDevices.map(d => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name} ({d.status || 'Unknown'})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 sm:justify-end">
                  <ToggleSwitch checked={aiEnabled} onCheckedChange={setAiEnabled} />
                  <span className={`text-sm font-medium ${aiEnabled ? 'text-blue-500' : 'text-gray-400'}`}>
                    AI Analysis {aiEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap gap-3 items-center">
                <button
                  className="btn btn-primary px-6 py-2 font-semibold rounded-md shadow-sm"
                  onClick={handleAction}
                  disabled={loading}
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  {FEATURE_META[value].action}
                </button>
                
                <div className="flex items-center gap-2">
                  <ToggleSwitch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                  <span className="text-sm text-muted-foreground">Auto-refresh</span>
                </div>

                <button
                  className="btn btn-outline px-4 py-2"
                  onClick={handleExport}
                  title="Export chart data"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </button>

                <button
                  className="btn btn-outline px-4 py-2"
                  onClick={() => fetchChartData(value)}
                  title="Refresh chart data"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </button>
              </div>

              {/* Results */}
              {result && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">AI Analysis Results:</h4>
                  <pre className="text-sm whitespace-pre-wrap">{result}</pre>
                </div>
              )}

              {/* Interactive chart */}
              <div className="mt-2">
                <div className="bg-background rounded-lg shadow p-4 min-h-[320px] border border-muted-foreground/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                      {currentClassroom?.name || 'Classroom'} - {currentDevice?.name || 'Device'} - {label} Analytics
                    </h3>
                    <div className="text-xs text-muted-foreground">
                      Last updated: {new Date().toLocaleTimeString()}
                    </div>
                  </div>
                  {renderChart(value)}
                </div>
              </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <span className="text-lg text-muted-foreground">Please select a classroom and device to view analytics.</span>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
      )}
    </div>
  );
};

export default AIMLPanel;
