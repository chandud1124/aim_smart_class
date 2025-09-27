import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch as UiSwitch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Device } from '@/types';
import { deviceAPI } from '@/services/api';
import { Copy, Check, Eye, EyeOff, Shield, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

const switchTypes = ['relay', 'light', 'fan', 'outlet', 'projector', 'ac'] as const;
const blocks = ['A', 'B', 'C', 'D'];
const floors = ['0', '1', '2', '3', '4', '5'];

// GPIO Pin status types
interface GpioPinInfo {
  pin: number;
  safe: boolean;
  status: 'safe' | 'problematic' | 'reserved' | 'invalid';
  reason: string;
  used: boolean;
  available: boolean;
  category: string;
  inputOnly?: boolean;
  recommendedFor?: string[];
  alternativePins?: number[];
}

interface GpioValidationResult {
  valid: boolean;
  errors: Array<{ type: string; switch?: number; pin: number; message: string; alternatives?: number[] }>;
  warnings: Array<{ type: string; switch?: number; pin: number; message: string; alternatives?: number[] }>;
}

// Update validation to be more flexible with GPIO pins
const switchSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  gpio: z.number().min(0).max(39),
  relayGpio: z.number().min(0).max(39),
  type: z.enum(switchTypes),
  icon: z.string().optional(),
  state: z.boolean().default(false),
  manualSwitchEnabled: z.boolean().default(false),
  manualSwitchGpio: z.number().min(0, { message: 'Required when manual is enabled' }).max(39).optional(),
  manualMode: z.enum(['maintained', 'momentary']).default('maintained'),
  manualActiveLow: z.boolean().default(true),
  usePir: z.boolean().default(false),
  dontAutoOff: z.boolean().default(false)
}).refine(s => !s.manualSwitchEnabled || s.manualSwitchGpio !== undefined, {
  message: 'Choose a manual switch GPIO when manual is enabled',
  path: ['manualSwitchGpio']
});

const formSchema = z.object({
  name: z.string().min(1, 'Required'),
  macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC'),
  ipAddress: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'Invalid IP').refine(v => v.split('.').every(o => +o >= 0 && +o <= 255), 'Octets 0-255'),
  location: z.string().min(1),
  classroom: z.string().optional(),
  pirEnabled: z.boolean().default(false),
  pirGpio: z.number().min(0).max(39).optional(),
  pirAutoOffDelay: z.number().min(0).default(30),
  switches: z.array(switchSchema).min(1).max(8).refine(sw => {
    const prim = sw.map(s => s.gpio);
    const man = sw.filter(s => s.manualSwitchEnabled && s.manualSwitchGpio !== undefined).map(s => s.manualSwitchGpio as number);
    const all = [...prim, ...man];
    return new Set(all).size === all.length;
  }, { message: 'GPIO pins (including manual) must be unique' })
});

type FormValues = z.infer<typeof formSchema>;
interface Props { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (d: FormValues) => void; initialData?: Device }

const parseLocation = (loc?: string) => {
  if (!loc) return { block: 'A', floor: '0' };
  const b = loc.match(/Block\s+([A-Z])/i)?.[1]?.toUpperCase() || 'A';
  const f = loc.match(/Floor\s+(\d+)/i)?.[1] || '0';
  return { block: b, floor: f };
};

export const DeviceConfigDialog: React.FC<Props> = ({ open, onOpenChange, onSubmit, initialData }) => {
  const locParts = parseLocation(initialData?.location);
  const [block, setBlock] = useState(locParts.block);
  const [floor, setFloor] = useState(locParts.floor);
  const [gpioInfo, setGpioInfo] = useState<GpioPinInfo[]>([]);
  const [gpioValidation, setGpioValidation] = useState<GpioValidationResult | null>(null);
  const [loadingGpio, setLoadingGpio] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
      name: initialData.name,
      macAddress: initialData.macAddress,
      ipAddress: initialData.ipAddress,
      location: initialData.location || `Block ${locParts.block} Floor ${locParts.floor}`,
      classroom: initialData.classroom || '',
      pirEnabled: initialData.pirEnabled || false,
      pirGpio: initialData.pirGpio,
      pirAutoOffDelay: initialData.pirAutoOffDelay || 30,
  switches: initialData.switches.map((sw: import('@/types').Switch) => ({
    id: sw.id,
    relayGpio: sw.gpio ?? sw.relayGpio ?? 0,
        name: sw.name,
        gpio: sw.relayGpio ?? sw.gpio ?? 0,
        type: sw.type || 'relay',
        icon: sw.icon,
        state: !!sw.state,
        manualSwitchEnabled: sw.manualSwitchEnabled || false,
        manualSwitchGpio: sw.manualSwitchGpio,
        manualMode: sw.manualMode || 'maintained',
        manualActiveLow: sw.manualActiveLow !== undefined ? sw.manualActiveLow : true,
        usePir: sw.usePir || false,
        dontAutoOff: sw.dontAutoOff || false
      }))
    } : {
      name: '', macAddress: '', ipAddress: '', location: `Block ${locParts.block} Floor ${locParts.floor}`, classroom: '', pirEnabled: false, pirGpio: undefined, pirAutoOffDelay: 30,
  switches: [{ id: `switch-${Date.now()}-0`, name: '', gpio: 0, relayGpio: 0, type: 'relay', icon: 'lightbulb', state: false, manualSwitchEnabled: false, manualMode: 'maintained', manualActiveLow: true, usePir: false, dontAutoOff: false }]
    }
  });
  // When switching between devices, reset the form with new defaults so fields are populated
  useEffect(() => {
    if (initialData && open) {
      const lp = parseLocation(initialData.location);
      setBlock(lp.block); setFloor(lp.floor);
      fetchGpioInfo(); // Fetch GPIO info when dialog opens with existing device
      form.reset({
        name: initialData.name,
        macAddress: initialData.macAddress,
        ipAddress: initialData.ipAddress,
        location: initialData.location || `Block ${lp.block} Floor ${lp.floor}`,
        classroom: initialData.classroom || '',
        pirEnabled: initialData.pirEnabled || false,
        pirGpio: initialData.pirGpio,
        pirAutoOffDelay: initialData.pirAutoOffDelay || 30,
    switches: initialData.switches.map((sw: import('@/types').Switch) => ({
    id: sw.id,
          name: sw.name,
          gpio: sw.relayGpio ?? sw.gpio ?? 0,
          relayGpio: sw.gpio ?? sw.relayGpio ?? 0,
          type: sw.type || 'relay',
          icon: sw.icon,
          state: !!sw.state,
          manualSwitchEnabled: sw.manualSwitchEnabled || false,
          manualSwitchGpio: sw.manualSwitchGpio,
          manualMode: sw.manualMode || 'maintained',
          manualActiveLow: sw.manualActiveLow !== undefined ? sw.manualActiveLow : true,
          usePir: sw.usePir || false,
          dontAutoOff: sw.dontAutoOff || false
        }))
      });
    } else if (!initialData && open) {
      const lp = parseLocation(undefined);
      fetchGpioInfo(); // Fetch GPIO info when creating new device
      form.reset({
        name: '', macAddress: '', ipAddress: '', location: `Block ${lp.block} Floor ${lp.floor}`, classroom: '', pirEnabled: false, pirGpio: undefined, pirAutoOffDelay: 30,
  switches: [{ id: `switch-${Date.now()}-0`, name: '', gpio: 0, relayGpio: 0, type: 'relay', icon: 'lightbulb', state: false, manualSwitchEnabled: false, manualMode: 'maintained', manualActiveLow: true, usePir: false, dontAutoOff: false }]
      });
    }
  }, [initialData, open]);
  useEffect(() => { form.setValue('location', `Block ${block} Floor ${floor}`); }, [block, floor]);

  // Keep gpio and relayGpio synchronized for each switch
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (name && name.includes('gpio') && !name.includes('manual') && !name.includes('pir') && type === 'change') {
        const pathParts = name.split('.');
        if (pathParts.length === 3 && pathParts[1] === 'switches') {
          const switchIndex = parseInt(pathParts[2]);
          const gpioValue = form.getValues(`switches.${switchIndex}.gpio`);
          if (gpioValue !== undefined) {
            form.setValue(`switches.${switchIndex}.relayGpio`, gpioValue, { shouldValidate: false });
          }
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Secret reveal state
  const [secretPin, setSecretPin] = useState('');
  const [secretLoading, setSecretLoading] = useState(false);
  const [secretValue, setSecretValue] = useState<string | null>(null);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [secretVisible, setSecretVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const deviceId = initialData?.id;

  // Fetch GPIO pin information
  const fetchGpioInfo = async () => {
    try {
      setLoadingGpio(true);
      const response = await deviceAPI.getGpioPinInfo(deviceId);
      setGpioInfo(response.data.data.pins);
    } catch (error) {
      console.error('Failed to fetch GPIO info:', error);
    } finally {
      setLoadingGpio(false);
    }
  };

  // Validate GPIO configuration
  const validateGpioConfig = async (config: { switches: import('@/types').Switch[]; pirEnabled: boolean; pirGpio?: number }) => {
    try {
      const response = await deviceAPI.validateGpioConfig(config);
      setGpioValidation(response.data.data);
      return response.data.data;
    } catch (error) {
      console.error('GPIO validation failed:', error);
      return null;
    }
  };

  const fetchSecret = async () => {
    if (!deviceId) { setSecretError('No device ID'); return; }
    setSecretLoading(true); setSecretError(null); setCopied(false);
    try {
      const resp = await deviceAPI.getDeviceWithSecret(deviceId, secretPin || undefined);
      // Try multiple possible locations for the secret
      const s = resp.data?.deviceSecret || resp.data?.data?.deviceSecret || resp.data?.data?.device?.deviceSecret;
      if (!s) {
        console.error('Secret not found in response:', resp.data);
        setSecretError('Secret not returned from server');
        return;
      }
      setSecretValue(s);
      setSecretVisible(true);
    } catch (e: unknown) {
      let message = 'Failed to fetch secret';
      if (e && typeof e === 'object' && 'response' in e) {
        const error = e as { response?: { status?: number; data?: unknown } };
        if (error.response?.status === 403) {
          message = 'Access denied - admin privileges required or invalid PIN';
        } else if (error.response?.status === 404) {
          message = 'Device not found';
        } else if (error.response?.data && typeof error.response.data === 'object' && 'message' in error.response.data) {
          message = String((error.response.data as { message: unknown }).message);
        }
      }
      setSecretError(message);
    } finally { setSecretLoading(false); }
  };

  const copySecret = async () => {
    if (!secretValue) return;
    try {
      await navigator.clipboard.writeText(secretValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      // Optionally log error for debugging
      // console.error('Clipboard copy failed', e);
    }
  };
  const submit = async (data: FormValues) => {
    // Ensure every switch has a string id before validation and submission
    const switchesWithId = data.switches.map(sw => ({
      id: typeof sw.id === 'string' && sw.id.length > 0 ? sw.id : `switch-${Date.now()}-${Math.floor(Math.random()*10000)}`,
      name: sw.name || 'Unnamed Switch',
      type: sw.type || 'relay',
      gpio: sw.gpio ?? sw.relayGpio ?? 0,
      relayGpio: sw.gpio ?? sw.relayGpio ?? 0,
      state: sw.state ?? false,
      manualSwitchEnabled: sw.manualSwitchEnabled ?? false,
      manualSwitchGpio: sw.manualSwitchGpio,
      manualMode: sw.manualMode || 'maintained',
      manualActiveLow: sw.manualActiveLow !== undefined ? sw.manualActiveLow : true,
      usePir: sw.usePir ?? false,
      dontAutoOff: sw.dontAutoOff ?? false,
      icon: sw.icon
    }));

    // Validate GPIO configuration before submitting
    const validation = await validateGpioConfig({
      switches: switchesWithId,
      pirEnabled: data.pirEnabled,
      pirGpio: data.pirGpio
    });

    if (validation && !validation.valid) {
      // Show validation errors
      setGpioValidation(validation);
      return;
    }

    onSubmit({ ...data, switches: switchesWithId });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Device' : 'Add New Device'}</DialogTitle>
          <DialogDescription>{initialData ? 'Update device configuration' : 'Enter device details and at least one switch.'}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
            <div className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Device Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="macAddress" render={({ field }) => (<FormItem><FormLabel>MAC Address</FormLabel><FormControl><Input {...field} placeholder="00:11:22:33:44:55" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="ipAddress" render={({ field }) => (<FormItem><FormLabel>IP Address</FormLabel><FormControl><Input {...field} placeholder="192.168.1.100" /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormItem><FormLabel>Block</FormLabel><Select value={block || ''} onValueChange={v => setBlock(v)}><FormControl><SelectTrigger><SelectValue placeholder="Block" /></SelectTrigger></FormControl><SelectContent>{blocks.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></FormItem>
                <FormItem><FormLabel>Floor</FormLabel><Select value={floor || ''} onValueChange={v => setFloor(v)}><FormControl><SelectTrigger><SelectValue placeholder="Floor" /></SelectTrigger></FormControl><SelectContent>{floors.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></FormItem>
              </div>
              <input type="hidden" {...form.register('location')} />
              <FormField control={form.control} name="classroom" render={({ field }) => (<FormItem><FormLabel>Classroom (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <Separator />
            {initialData && (
              <div className="space-y-3 p-4 border rounded-md">
                <div className="flex items-center gap-2 text-sm font-medium"><Shield className="h-4 w-4" /> Device Secret</div>
                <p className="text-xs text-muted-foreground">Enter admin PIN to generate/reveal the device secret. Keep it confidential.</p>
                <div className="flex items-center gap-2">
                  <Input placeholder="PIN" type="password" value={secretPin} onChange={e => setSecretPin(e.target.value)} className="max-w-[140px]" />
                  <Button type="button" variant="outline" size="sm" disabled={secretLoading} onClick={fetchSecret}>{secretLoading ? 'Loading...' : (secretValue ? 'Regenerate' : 'Reveal')}</Button>
                  {secretValue && (
                    <Button type="button" variant="outline" size="icon" onClick={() => setSecretVisible(v => !v)}>
                      {secretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  )}
                  {secretValue && (
                    <Button type="button" variant="outline" size="icon" onClick={copySecret}>
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
                {secretValue && (
                  <div className="text-xs font-mono break-all bg-muted p-2 rounded border select-all">
                    {secretVisible ? secretValue : secretValue.replace(/.(?=.{6})/g, '•')}
                  </div>
                )}
                {secretError && <div className="text-xs text-red-500">{secretError}</div>}
              </div>
            )}
            <Separator />
            <div className="space-y-4">
              <FormField control={form.control} name="pirEnabled" render={({ field }) => (<FormItem className="flex items-center gap-2"><FormControl><UiSwitch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">Enable PIR Sensor</FormLabel></FormItem>)} />
              {form.watch('pirEnabled') && (
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="pirGpio" render={({ field }) => {
                    // Recommended pins for PIR sensors: 34, 35, 36, 39 (primary), 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33 (secondary)
                    const recommendedPirPins = [34, 35, 36, 39, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33];
                    const availablePins = gpioInfo.filter(p => p.safe && recommendedPirPins.includes(p.pin));
                    const list = [...availablePins];

                    // If current pin is not in recommended list, add it to the list so user can see it but with warning
                    if (field.value !== undefined && !list.find(p => p.pin === field.value)) {
                      const currentPin = gpioInfo.find(p => p.pin === field.value);
                      if (currentPin) list.push(currentPin);
                    }
                    list.sort((a, b) => a.pin - b.pin);

                    const getPinStatusIcon = (pin: GpioPinInfo) => {
                      if (pin.status === 'safe') return <CheckCircle className="w-4 h-4 text-success" />;
                      if (pin.status === 'problematic') return <AlertTriangle className="w-4 h-4 text-warning" />;
                      return <XCircle className="w-4 h-4 text-danger" />;
                    };

                    const getPinStatusDot = (pin: GpioPinInfo) => {
                      const dotClass = "w-2 h-2 rounded-full flex-shrink-0";
                      if (pin.status === 'safe') return <div className={`${dotClass} bg-success`} />;
                      if (pin.status === 'problematic') return <div className={`${dotClass} bg-warning`} />;
                      return <div className={`${dotClass} bg-danger`} />;
                    };

                    const getPinStatusColor = (pin: GpioPinInfo) => {
                      if (pin.status === 'safe') return 'text-foreground hover:bg-accent';
                      if (pin.status === 'problematic') return 'text-foreground hover:bg-accent';
                      return 'text-foreground hover:bg-accent';
                    };

                    const getPirPinRecommendation = (pin: GpioPinInfo) => {
                      const primaryPirPins = [34, 35, 36, 39];
                      const secondaryPirPins = [16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33];
                      if (primaryPirPins.includes(pin.pin)) return 'Primary (Recommended)';
                      if (secondaryPirPins.includes(pin.pin)) return 'Secondary (Alternative)';
                      return 'Not Recommended';
                    };

                    return (
                      <FormItem>
                        <FormLabel>PIR GPIO (Motion Sensor)</FormLabel>
                        <Select value={field.value !== undefined ? String(field.value) : ''} onValueChange={v => field.onChange(v === '' ? undefined : Number(v))}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select recommended GPIO pin for PIR sensor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-64">
                            <SelectItem value="">Select</SelectItem>
                            {list.map(pin => (
                              <SelectItem
                                key={pin.pin}
                                value={String(pin.pin)}
                                className={getPinStatusColor(pin)}
                                disabled={pin.status !== 'safe'}
                              >
                                <div className="flex items-center gap-2">
                                  {getPinStatusDot(pin)}
                                  {getPinStatusIcon(pin)}
                                  <span>GPIO {pin.pin}</span>
                                  {pin.status === 'safe' && (
                                    <Badge variant="outline" className="text-xs bg-success/50 text-white border-success/70">
                                      {getPirPinRecommendation(pin)}
                                    </Badge>
                                  )}
                                  {pin.status === 'problematic' && (
                                    <Badge variant="outline" className="text-xs bg-warning/50 text-white border-warning/70">
                                      Problematic
                                    </Badge>
                                  )}
                                  {pin.status === 'reserved' && (
                                    <Badge variant="outline" className="text-xs bg-danger/50 text-white border-danger/70">
                                      Reserved
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {field.value !== undefined && gpioInfo.find(p => p.pin === field.value)?.status === 'problematic' && (
                          <Alert className="mt-2 border-warning/70 bg-warning/20">
                            <AlertTriangle className="h-4 w-4 text-warning" />
                            <AlertDescription className="text-foreground">
                              <strong>Warning:</strong> {gpioInfo.find(p => p.pin === field.value)?.reason}
                              {gpioInfo.find(p => p.pin === field.value)?.alternativePins && (
                                <div className="mt-2">
                                  <strong>Recommended PIR pins:</strong> GPIO {gpioInfo.find(p => p.pin === field.value)?.alternativePins?.join(', ')}
                                </div>
                              )}
                            </AlertDescription>
                          </Alert>
                        )}
                        {field.value !== undefined && gpioInfo.find(p => p.pin === field.value)?.status === 'reserved' && (
                          <Alert className="mt-2 border-danger/70 bg-danger/20">
                            <XCircle className="h-4 w-4 text-danger" />
                            <AlertDescription className="text-foreground">
                              <strong>Warning:</strong> This pin is reserved and may cause system instability.
                              {gpioInfo.find(p => p.pin === field.value)?.alternativePins && (
                                <div className="mt-2">
                                  <strong>Use recommended PIR pins:</strong> GPIO {gpioInfo.find(p => p.pin === field.value)?.alternativePins?.join(', ')}
                                </div>
                              )}
                            </AlertDescription>
                          </Alert>
                        )}
                        {!recommendedPirPins.includes(field.value) && gpioInfo.find(p => p.pin === field.value)?.status === 'safe' && (
                          <Alert className="mt-2 border-success/70 bg-success/20">
                            <Info className="h-4 w-4 text-success" />
                            <AlertDescription className="text-foreground">
                              <strong>Note:</strong> This pin is safe but not recommended for PIR sensor.
                              <div className="mt-2">
                                <strong>Recommended PIR pins:</strong> GPIO 34, 35, 36, 39 (Primary) or 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33 (Secondary)
                              </div>
                            </AlertDescription>
                          </Alert>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }} />
                  <FormField control={form.control} name="pirAutoOffDelay" render={({ field }) => (<FormItem><FormLabel>Auto-off Delay (s)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value || 0))} /></FormControl><FormMessage /></FormItem>)} />
                </div>
              )}
            </div>
            <Separator />
            <div className="space-y-4">
                            <div className="flex items-start gap-3 p-4 bg-card border border-border rounded-md">
                <Info className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <strong>GPIO Pin Safety:</strong> Only safe GPIO pins are available for selection. These pins are recommended for reliable ESP32 operation and avoid boot issues or system instability.
                  <div className="mt-2 flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span className="text-xs">Safe pins (recommended)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <span className="text-xs">Problematic pins (avoid)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <XCircle className="h-4 w-4 text-danger" />
                      <span className="text-xs">Reserved pins (system use)</span>
                    </div>
                  </div>
                </div>
              </div>
              {form.watch('switches')?.map((_, idx) => {
                const switches = form.watch('switches') || [];
                const usedPins = new Set(switches.flatMap((s, i) => { const arr = [s.gpio]; if (s.manualSwitchEnabled && s.manualSwitchGpio !== undefined) arr.push(s.manualSwitchGpio); return i === idx ? [] : arr; }));
                return (
                  <div key={idx} className="grid gap-4 p-4 border rounded-md">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">Switch {idx + 1}</h4>
                      {idx > 0 && <Button type="button" variant="destructive" size="sm" onClick={() => { const sw = [...switches]; sw.splice(idx, 1); form.setValue('switches', sw); }}>Remove</Button>}
                    </div>
                    {/* Hidden id field to preserve existing switch identity */}
                    {switches[idx]?.id && <input type="hidden" value={switches[idx].id} {...form.register(`switches.${idx}.id` as const)} />}
                    <FormField control={form.control} name={`switches.${idx}.name`} render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} placeholder="Light" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name={`switches.${idx}.type`} render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} value={field.value || 'relay'}><FormControl><SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger></FormControl><SelectContent>{switchTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name={`switches.${idx}.gpio`} render={({ field }) => {
                      const switches = form.watch('switches') || [];
                      const usedPins = new Set(switches.flatMap((s, i) => i === idx ? [] : [s.gpio]));
                      // Only show pins recommended for relay switches
                      const recommendedRelayPins = [16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33];
                      const availablePins = gpioInfo.filter(p =>
                        p.safe &&
                        recommendedRelayPins.includes(p.pin) &&
                        !usedPins.has(p.pin)
                      );
                      const list = [...availablePins];

                      // If current pin is not in recommended list, add it to the list so user can see it but with warning
                      if (field.value !== undefined && !list.find(p => p.pin === field.value)) {
                        const currentPin = gpioInfo.find(p => p.pin === field.value);
                        if (currentPin) list.push(currentPin);
                      }
                      list.sort((a, b) => a.pin - b.pin);

                      const getPinStatusIcon = (pin: GpioPinInfo) => {
                        if (pin.status === 'safe') return <CheckCircle className="w-4 h-4 text-success" />;
                        if (pin.status === 'problematic') return <AlertTriangle className="w-4 h-4 text-warning" />;
                        return <XCircle className="w-4 h-4 text-danger" />;
                      };

                      const getPinStatusDot = (pin: GpioPinInfo) => {
                        const dotClass = "w-2 h-2 rounded-full flex-shrink-0";
                        if (pin.status === 'safe') return <div className={`${dotClass} bg-success`} />;
                        if (pin.status === 'problematic') return <div className={`${dotClass} bg-warning`} />;
                        return <div className={`${dotClass} bg-danger`} />;
                      };

                      const getPinStatusColor = (pin: GpioPinInfo) => {
                        if (pin.status === 'safe') return 'text-foreground hover:bg-accent';
                        if (pin.status === 'problematic') return 'text-foreground hover:bg-accent';
                        return 'text-foreground hover:bg-accent';
                      };

                      const getPinRecommendation = (pin: GpioPinInfo) => {
                        const primaryRelayPins = [16, 17, 18, 19, 21, 22];
                        const secondaryRelayPins = [23, 25, 26, 27, 32, 33];
                        if (primaryRelayPins.includes(pin.pin)) return 'Primary (Recommended)';
                        if (secondaryRelayPins.includes(pin.pin)) return 'Secondary (Alternative)';
                        return 'Not Recommended';
                      };

                      return (
                        <FormItem>
                          <FormLabel>GPIO Pin (Relay Control)</FormLabel>
                          <Select value={String(field.value)} onValueChange={v => field.onChange(Number(v))}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select recommended GPIO pin for relay" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-64">
                              {list.map(pin => (
                                <SelectItem
                                  key={pin.pin}
                                  value={String(pin.pin)}
                                  className={getPinStatusColor(pin)}
                                  disabled={pin.status !== 'safe'}
                                >
                                  <div className="flex items-center gap-2">
                                    {getPinStatusDot(pin)}
                                    {getPinStatusIcon(pin)}
                                    <span>GPIO {pin.pin}</span>
                                    {pin.status === 'safe' && (
                                      <Badge variant="outline" className="text-xs bg-success/50 text-white border-success/70">
                                        {getPinRecommendation(pin)}
                                      </Badge>
                                    )}
                                    {pin.status === 'problematic' && (
                                      <Badge variant="outline" className="text-xs bg-warning/50 text-white border-warning/70">
                                        Problematic
                                      </Badge>
                                    )}
                                    {pin.status === 'reserved' && (
                                      <Badge variant="outline" className="text-xs bg-danger/50 text-white border-danger/70">
                                        Reserved
                                      </Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {gpioInfo.find(p => p.pin === field.value)?.status === 'problematic' && (
                            <Alert className="mt-2 border-warning/70 bg-warning/20">
                              <AlertTriangle className="h-4 w-4 text-warning" />
                              <AlertDescription className="text-foreground">
                                <strong>Warning:</strong> {gpioInfo.find(p => p.pin === field.value)?.reason}
                                {gpioInfo.find(p => p.pin === field.value)?.alternativePins && (
                                  <div className="mt-2">
                                    <strong>Recommended relay pins:</strong> GPIO {gpioInfo.find(p => p.pin === field.value)?.alternativePins?.join(', ')}
                                  </div>
                                )}
                              </AlertDescription>
                            </Alert>
                          )}
                          {gpioInfo.find(p => p.pin === field.value)?.status === 'reserved' && (
                            <Alert className="mt-2 border-danger/70 bg-danger/20">
                              <XCircle className="h-4 w-4 text-danger" />
                              <AlertDescription className="text-foreground">
                                <strong>Warning:</strong> This pin is reserved and may cause system instability.
                                {gpioInfo.find(p => p.pin === field.value)?.alternativePins && (
                                  <div className="mt-2">
                                    <strong>Use recommended relay pins:</strong> GPIO {gpioInfo.find(p => p.pin === field.value)?.alternativePins?.join(', ')}
                                  </div>
                                )}
                              </AlertDescription>
                            </Alert>
                          )}
                          {!recommendedRelayPins.includes(field.value) && gpioInfo.find(p => p.pin === field.value)?.status === 'safe' && (
                            <Alert className="mt-2 border-success/70 bg-success/20">
                              <Info className="h-4 w-4 text-success" />
                              <AlertDescription className="text-foreground">
                                <strong>Note:</strong> This pin is safe but not recommended for relay control.
                                <div className="mt-2">
                                  <strong>Recommended relay pins:</strong> GPIO 16, 17, 18, 19, 21, 22 (Primary) or 23, 25, 26, 27, 32, 33 (Secondary)
                                </div>
                              </AlertDescription>
                            </Alert>
                          )}
                          <FormMessage />
                        </FormItem>
                      );
                    }} />
                    <FormField control={form.control} name={`switches.${idx}.manualSwitchEnabled`} render={({ field }) => (<FormItem className="flex items-center gap-2"><FormControl><UiSwitch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">Manual Switch</FormLabel></FormItem>)} />
                    {form.watch(`switches.${idx}.manualSwitchEnabled`) && (
                      <>
                        <FormField control={form.control} name={`switches.${idx}.manualSwitchGpio`} render={({ field }) => {
                          const all = form.watch('switches') || [];
                          const used = new Set(all.flatMap((s, i) => { const arr = [s.gpio]; if (s.manualSwitchEnabled && s.manualSwitchGpio !== undefined) arr.push(s.manualSwitchGpio); return i === idx ? [s.gpio] : arr; }));
                          // Only show pins recommended for manual switches
                          const recommendedManualPins = [16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33];
                          const availablePins = gpioInfo.filter(p =>
                            p.safe &&
                            recommendedManualPins.includes(p.pin) &&
                            !used.has(p.pin)
                          );
                          const avail = [...availablePins];

                          // If current pin is not in recommended list, add it to the list so user can see it but with warning
                          if (field.value !== undefined && !avail.find(p => p.pin === field.value)) {
                            const currentPin = gpioInfo.find(p => p.pin === field.value);
                            if (currentPin) avail.push(currentPin);
                          }
                          avail.sort((a, b) => a.pin - b.pin);

                          const getPinStatusIcon = (pin: GpioPinInfo) => {
                            if (pin.status === 'safe') return <CheckCircle className="w-4 h-4 text-success" />;
                            if (pin.status === 'problematic') return <AlertTriangle className="w-4 h-4 text-warning" />;
                            return <XCircle className="w-4 h-4 text-danger" />;
                          };

                          const getPinStatusDot = (pin: GpioPinInfo) => {
                            const dotClass = "w-2 h-2 rounded-full flex-shrink-0";
                            if (pin.status === 'safe') return <div className={`${dotClass} bg-success`} />;
                            if (pin.status === 'problematic') return <div className={`${dotClass} bg-warning`} />;
                            return <div className={`${dotClass} bg-danger`} />;
                          };

                          const getPinStatusColor = (pin: GpioPinInfo) => {
                            if (pin.status === 'safe') return 'text-foreground hover:bg-accent';
                            if (pin.status === 'problematic') return 'text-foreground hover:bg-accent';
                            return 'text-foreground hover:bg-accent';
                          };

                          const getPinRecommendation = (pin: GpioPinInfo) => {
                            const primaryManualPins = [23, 25, 26, 27, 32, 33];
                            const secondaryManualPins = [16, 17, 18, 19, 21, 22];
                            if (primaryManualPins.includes(pin.pin)) return 'Primary (Recommended)';
                            if (secondaryManualPins.includes(pin.pin)) return 'Secondary (Alternative)';
                            return 'Not Recommended';
                          };

                          const NONE = '__none__';
                          const currentVal = field.value === undefined ? NONE : String(field.value);
                          return (
                            <FormItem>
                              <FormLabel>Manual Switch GPIO</FormLabel>
                              <Select value={currentVal} onValueChange={v => field.onChange(v === NONE ? undefined : Number(v))}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select recommended GPIO pin for manual switch" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="max-h-64">
                                  <SelectItem key={NONE} value={NONE}>Select</SelectItem>
                                  {avail.map(pin => (
                                    <SelectItem
                                      key={String(pin.pin)}
                                      value={String(pin.pin)}
                                      className={getPinStatusColor(pin)}
                                      disabled={pin.status !== 'safe'}
                                    >
                                      <div className="flex items-center gap-2">
                                        {getPinStatusDot(pin)}
                                        {getPinStatusIcon(pin)}
                                        <span>GPIO {pin.pin}</span>
                                        {pin.status === 'safe' && (
                                          <Badge variant="outline" className="text-xs bg-success/50 text-white border-success/70">
                                            {getPinRecommendation(pin)}
                                          </Badge>
                                        )}
                                        {pin.status === 'problematic' && (
                                          <Badge variant="outline" className="text-xs bg-warning/50 text-white border-warning/70">
                                            Problematic
                                          </Badge>
                                        )}
                                        {pin.status === 'reserved' && (
                                          <Badge variant="outline" className="text-xs bg-danger/50 text-white border-danger/70">
                                            Reserved
                                          </Badge>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {field.value !== undefined && gpioInfo.find(p => p.pin === field.value)?.status === 'problematic' && (
                                <Alert className="mt-2 border-warning/70 bg-warning/20">
                                  <AlertTriangle className="h-4 w-4 text-warning" />
                                  <AlertDescription className="text-foreground">
                                    <strong>Warning:</strong> {gpioInfo.find(p => p.pin === field.value)?.reason}
                                    {gpioInfo.find(p => p.pin === field.value)?.alternativePins && (
                                      <div className="mt-2">
                                        <strong>Recommended manual switch pins:</strong> GPIO {gpioInfo.find(p => p.pin === field.value)?.alternativePins?.join(', ')}
                                      </div>
                                    )}
                                  </AlertDescription>
                                </Alert>
                              )}
                              {field.value !== undefined && gpioInfo.find(p => p.pin === field.value)?.status === 'reserved' && (
                                <Alert className="mt-2 border-danger/70 bg-danger/20">
                                  <XCircle className="h-4 w-4 text-danger" />
                                  <AlertDescription className="text-foreground">
                                    <strong>Warning:</strong> This pin is reserved and may cause system instability.
                                    {gpioInfo.find(p => p.pin === field.value)?.alternativePins && (
                                      <div className="mt-2">
                                        <strong>Use recommended manual switch pins:</strong> GPIO {gpioInfo.find(p => p.pin === field.value)?.alternativePins?.join(', ')}
                                      </div>
                                    )}
                                  </AlertDescription>
                                </Alert>
                              )}
                              {field.value !== undefined && !recommendedManualPins.includes(field.value) && gpioInfo.find(p => p.pin === field.value)?.status === 'safe' && (
                                <Alert className="mt-2 border-success/70 bg-success/20">
                                  <Info className="h-4 w-4 text-success" />
                                  <AlertDescription className="text-foreground">
                                    <strong>Note:</strong> This pin is safe but not recommended for manual switches.
                                    <div className="mt-2">
                                      <strong>Recommended manual switch pins:</strong> GPIO 23, 25, 26, 27, 32, 33 (Primary) or 16, 17, 18, 19, 21, 22 (Secondary)
                                    </div>
                                  </AlertDescription>
                                </Alert>
                              )}
                              <FormMessage />
                            </FormItem>
                          );
                        }} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name={`switches.${idx}.manualMode`} render={({ field }) => (<FormItem><FormLabel>Manual Mode</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Mode" /></SelectTrigger></FormControl><SelectContent><SelectItem value="maintained">Maintained</SelectItem><SelectItem value="momentary">Momentary</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name={`switches.${idx}.manualActiveLow`} render={({ field }) => (<FormItem className="flex items-center gap-2"><FormControl><UiSwitch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">Active Low</FormLabel></FormItem>)} />
                        </div>
                      </>
                    )}
                    <Separator />
                    <div className="space-y-3">
                      <h5 className="text-sm font-medium">PIR Configuration</h5>
                      <FormField control={form.control} name={`switches.${idx}.usePir`} render={({ field }) => (<FormItem className="flex items-center gap-2"><FormControl><UiSwitch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">Respond to PIR motion</FormLabel></FormItem>)} />
                      <FormField control={form.control} name={`switches.${idx}.dontAutoOff`} render={({ field }) => (<FormItem className="flex items-center gap-2"><FormControl><UiSwitch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">Don't auto-off (manual override)</FormLabel></FormItem>)} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={idx === 0} onClick={() => {
                        const swArr = [...form.getValues('switches')];
                        if (idx > 0) { const tmp = swArr[idx - 1]; swArr[idx - 1] = swArr[idx]; swArr[idx] = tmp; form.setValue('switches', swArr); }
                      }}>Up</Button>
                      <Button type="button" variant="outline" size="sm" disabled={idx === switches.length - 1} onClick={() => {
                        const swArr = [...form.getValues('switches')];
                        if (idx < swArr.length - 1) { const tmp = swArr[idx + 1]; swArr[idx + 1] = swArr[idx]; swArr[idx] = tmp; form.setValue('switches', swArr); }
                      }}>Down</Button>
                    </div>
                  </div>
                );
              })}
              <Button type="button" variant="outline" onClick={() => { const sw = form.getValues('switches') || []; form.setValue('switches', [...sw, { id: `switch-${Date.now()}-${Math.floor(Math.random()*10000)}`, name: '', gpio: 0, relayGpio: 0, type: 'relay', icon: 'lightbulb', state: false, manualSwitchEnabled: false, manualMode: 'maintained', manualActiveLow: true, usePir: false, dontAutoOff: false }]); }}>Add Switch</Button>
              {/* Added manualMode/manualActiveLow defaults when adding a new switch */}
              {/* NOTE: Above Add Switch handler updated to include them if needed */}
            </div>
            <DialogFooter className="sticky bottom-0 bg-transparent py-4 z-10"><Button type="submit" className="w-full">Save</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
