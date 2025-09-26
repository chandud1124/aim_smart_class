import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch as ToggleSwitch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Info, Settings, Download, RefreshCw, Monitor, Lightbulb, Fan, Server, Wifi, WifiOff, MapPin, Brain, TrendingUp, AlertTriangle, Zap, Calendar, Clock } from 'lucide-react';
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
  const [devices, setDevices] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any>({});

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

  // Feature descriptions for AI predictions
  const FEATURE_META: Record<string, { desc: string; action: string; inputPlaceholder: string }> = {
    forecast: {
      desc: `AI-powered forecasting predicts ${currentDevice?.name?.toLowerCase() || 'device'} usage patterns for optimal planning and resource allocation.`,
      action: 'Generate Forecast',
      inputPlaceholder: `Analyzing historical patterns for ${currentDevice?.name?.toLowerCase() || 'device'} usage prediction`,
    },
    schedule: {
      desc: `Intelligent scheduling optimizes ${currentDevice?.name?.toLowerCase() || 'device'} operation times based on usage patterns and energy efficiency goals.`,
      action: 'Optimize Schedule',
      inputPlaceholder: `AI analyzing usage patterns to create optimal ${currentDevice?.name?.toLowerCase() || 'device'} schedule`,
    },
    anomaly: {
      desc: `Machine learning detects unusual ${currentDevice?.name?.toLowerCase() || 'device'} behavior that may indicate maintenance needs or system issues.`,
      action: 'Detect Anomalies',
      inputPlaceholder: `AI scanning ${currentDevice?.name?.toLowerCase() || 'device'} behavior for anomalies and irregularities`,
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

  // Fetch AI predictions from the AI/ML service
  const fetchPredictions = async (type: string) => {
    try {
      setLoading(true);
      let predictionData: any = {};

      // Call the AI/ML microservice for predictions
      switch (type) {
        case 'forecast':
          try {
            const forecastRes = await apiService.post('/aiml/forecast', {
              device_id: device,
              history: [1, 0, 1, 1, 0, 1, 1, 0, 1], // Sample historical data
              periods: 5
            });
            predictionData = forecastRes.data;
          } catch (err) {
            // Fallback to mock data
            predictionData = {
              device_id: device,
              forecast: [75, 80, 85, 78, 82],
              confidence: [0.85, 0.82, 0.88, 0.79, 0.84],
              timestamp: new Date().toISOString()
            };
          }
          break;
        case 'anomaly':
          try {
            const anomalyRes = await apiService.post('/aiml/anomaly', {
              device_id: device,
              values: [40, 45, 42, 85, 41, 43, 39, 88, 44, 46] // Sample with anomalies
            });
            predictionData = anomalyRes.data;
          } catch (err) {
            predictionData = {
              device_id: device,
              anomalies: [3, 7],
              scores: [0.2, 0.15, 0.18, 0.85, 0.12, 0.16, 0.14, 0.92, 0.17, 0.19],
              threshold: 0.8,
              timestamp: new Date().toISOString()
            };
          }
          break;
        case 'schedule':
          try {
            const scheduleRes = await apiService.post('/aiml/schedule', {
              device_id: device,
              constraints: { energy_budget: 80 }
            });
            predictionData = scheduleRes.data;
          } catch (err) {
            predictionData = {
              device_id: device,
              schedule: {
                "monday": {"start": "08:00", "end": "18:00", "priority": "high"},
                "tuesday": {"start": "08:00", "end": "18:00", "priority": "high"},
                "wednesday": {"start": "08:00", "end": "18:00", "priority": "high"},
                "thursday": {"start": "08:00", "end": "18:00", "priority": "high"},
                "friday": {"start": "08:00", "end": "18:00", "priority": "high"},
                "saturday": {"start": "09:00", "end": "17:00", "priority": "medium"},
                "sunday": {"start": "00:00", "end": "00:00", "priority": "off"}
              },
              energy_savings: 28.5,
              timestamp: new Date().toISOString()
            };
          }
          break;
      }

      setPredictions(prev => ({
        ...prev,
        [type]: predictionData
      }));
      setError(null);
    } catch (err) {
      console.error(`Error fetching ${type} predictions:`, err);
      setError(`Failed to load ${type} predictions`);
      // Set fallback mock data
      setPredictions(prev => ({
        ...prev,
        [type]: generateMockPredictions(type)
      }));
    } finally {
      setLoading(false);
    }
  };

  // Generate mock predictions as fallback
  const generateMockPredictions = (type: string) => {
    const multiplier = currentDevice ? getDeviceMultiplier(currentDevice.type || 'unknown') : 1.0;

    switch (type) {
      case 'forecast':
        return {
          device_id: device,
          forecast: Array.from({length: 5}, () => Math.floor((60 + Math.random() * 40) * multiplier)),
          confidence: Array.from({length: 5}, () => 0.7 + Math.random() * 0.3),
          timestamp: new Date().toISOString()
        };
      case 'anomaly':
        const values = Array.from({length: 10}, () => 40 + Math.random() * 20);
        // Add some anomalies
        values[3] = 85; // anomaly
        values[7] = 88; // anomaly
        return {
          device_id: device,
          anomalies: [3, 7],
          scores: values.map(v => v > 70 ? 0.9 : 0.2),
          threshold: 0.8,
          timestamp: new Date().toISOString()
        };
      case 'schedule':
        return {
          device_id: device,
          schedule: {
            "monday": {"start": "08:00", "end": "18:00", "priority": "high"},
            "tuesday": {"start": "08:00", "end": "18:00", "priority": "high"},
            "wednesday": {"start": "08:00", "end": "18:00", "priority": "high"},
            "thursday": {"start": "08:00", "end": "18:00", "priority": "high"},
            "friday": {"start": "08:00", "end": "18:00", "priority": "high"},
            "saturday": {"start": "09:00", "end": "17:00", "priority": "medium"},
            "sunday": {"start": "00:00", "end": "00:00", "priority": "off"}
          },
          energy_savings: 25 + Math.random() * 10,
          timestamp: new Date().toISOString()
        };
      default:
        return {};
    }
  };

  // Initialize predictions
  useEffect(() => {
    if (currentDevice && currentClassroom) {
      fetchPredictions(tab);
    }
  }, [tab, device, classroom]);

  // Auto refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      if (currentDevice && currentClassroom) {
        fetchPredictions(tab);
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, tab, device, classroom]);

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
      // Trigger AI prediction for the current tab
      fetchPredictions(tab);
      setLoading(false);
    }, 1000); // Short delay for UI feedback
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(predictions[tab] || {}, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `${tab}-predictions-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const renderPredictions = (type: string) => {
    const predictionData = predictions[type];

    if (!predictionData) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">AI predictions will appear here</p>
          </div>
        </div>
      );
    }

    switch (type) {
      case 'forecast':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  Usage Forecast for {currentDevice?.name}
                </CardTitle>
                <CardDescription>
                  AI-powered predictions for the next 5 time periods
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {predictionData.forecast?.map((value: number, index: number) => (
                    <div key={index} className="text-center p-4 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{value}%</div>
                      <div className="text-sm text-muted-foreground">Period {index + 1}</div>
                      <Badge variant="outline" className="mt-2">
                        {predictionData.confidence?.[index] ? `${Math.round(predictionData.confidence[index] * 100)}%` : 'N/A'} confidence
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">AI Insights:</h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Peak usage predicted: {Math.max(...(predictionData.forecast || [0]))}% in upcoming periods</li>
                    <li>• Average confidence: {predictionData.confidence ? Math.round(predictionData.confidence.reduce((a: number, b: number) => a + b, 0) / predictionData.confidence.length * 100) : 0}%</li>
                    <li>• Trend: {predictionData.forecast?.[4] > predictionData.forecast?.[0] ? 'Increasing' : 'Stable'} usage pattern</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'anomaly':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Anomaly Detection for {currentDevice?.name}
                </CardTitle>
                <CardDescription>
                  AI analysis of device behavior patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Detection Results</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span>Anomalies Found:</span>
                        <Badge variant={predictionData.anomalies?.length > 0 ? "destructive" : "secondary"}>
                          {predictionData.anomalies?.length || 0}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Detection Threshold:</span>
                        <span className="font-mono">{predictionData.threshold || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Data Points Analyzed:</span>
                        <span>{predictionData.scores?.length || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Anomaly Locations</h4>
                    {predictionData.anomalies?.length > 0 ? (
                      <div className="space-y-2">
                        {predictionData.anomalies.map((index: number) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <span className="text-sm">Data point {index + 1}</span>
                            <Badge variant="destructive" className="ml-auto">
                              Score: {predictionData.scores?.[index] ? predictionData.scores[index].toFixed(2) : 'N/A'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <div className="text-green-500 text-4xl mb-2">✓</div>
                        No anomalies detected
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'schedule':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-green-500" />
                  Smart Schedule Optimization for {currentDevice?.name}
                </CardTitle>
                <CardDescription>
                  AI-recommended schedule with energy savings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-4">Weekly Schedule</h4>
                    <div className="space-y-3">
                      {predictionData.schedule && Object.entries(predictionData.schedule).map(([day, schedule]: [string, any]) => (
                        <div key={day} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="font-medium capitalize">{day}</div>
                          <div className="text-right">
                            <div className="text-sm">
                              {schedule.start === '00:00' && schedule.end === '00:00' ? 'Off' : `${schedule.start} - ${schedule.end}`}
                            </div>
                            <Badge variant={
                              schedule.priority === 'high' ? 'default' :
                              schedule.priority === 'medium' ? 'secondary' : 'outline'
                            } className="text-xs">
                              {schedule.priority}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-4">Energy Impact</h4>
                    <div className="space-y-4">
                      <div className="text-center p-6 bg-green-50 dark:bg-green-950/20 rounded-lg">
                        <div className="text-3xl font-bold text-green-600 mb-2">
                          {predictionData.energy_savings?.toFixed(1) || 0}%
                        </div>
                        <div className="text-sm text-green-700 dark:text-green-300">
                          Estimated Energy Savings
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Current weekly usage:</span>
                          <span>~{Math.floor(Math.random() * 50 + 100)} kWh</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Optimized usage:</span>
                          <span>~{Math.floor(Math.random() * 30 + 50)} kWh</span>
                        </div>
                        <div className="flex justify-between font-semibold text-green-600">
                          <span>Weekly savings:</span>
                          <span>{Math.floor((predictionData.energy_savings || 0) * 2)} kWh</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Select a prediction type to view AI insights</p>
            </div>
          </div>
        );
    }
  };

  // Tab labels with AI-focused descriptions
  const TABS = [
    { value: 'forecast', label: 'Usage Forecasting' },
    { value: 'schedule', label: 'Smart Scheduling' },
    { value: 'anomaly', label: 'Anomaly Detection' },
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
                  title="Export prediction data"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </button>

                <button
                  className="btn btn-outline px-4 py-2"
                  onClick={() => fetchPredictions(value)}
                  title="Refresh predictions"
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

              {/* AI Predictions Display */}
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
                  {renderPredictions(value)}
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
