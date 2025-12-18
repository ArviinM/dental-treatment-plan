import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { FileDown, Eye, EyeOff, Loader2, Upload, Info, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Toaster, toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PatientInfoForm } from '@/components/forms/PatientInfoForm';
import { TreatmentItemsTable } from '@/components/forms/TreatmentItemsTable';
import { CanvasPreview } from '@/components/preview/CanvasPreview';
import { TemplateUploader } from '@/components/settings/TemplateUploader';
import { generateTreatmentPlanPdf, downloadPdf } from '@/services/pdfGenerator';
import { parseTreatmentPlanPdf } from '@/services/pdfParser';
import { useFeeCalculator } from '@/hooks/useFeeCalculator';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { defaultFeeSchedule, FEE_SCHEDULE_VERSION } from '@/data/default-fee-schedule';
import type { TreatmentItem, Location, FeeItem, TemplateSettings, TreatmentPlanData } from '@/types';
import { DEFAULT_TEMPLATE_SETTINGS, LOCATION_TO_TEAM } from '@/types';

// Local storage key for fee schedule version
const FEE_SCHEDULE_VERSION_KEY = 'dental-fee-schedule-version';

function App() {
  // Patient Info State
  const [patientName, setPatientName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [doctorPhoto, setDoctorPhoto] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState<Location>('essendon');

  // Treatment Items State
  const [items, setItems] = useState<TreatmentItem[]>([
    { 
      id: '1', 
      itemCode: '', 
      description: '', 
      tooth: '', 
      fees: [{ id: 'f1', quantity: 1, unitFee: 0 }] 
    },
  ]);

  // Fee Schedule (stored in localStorage)
  const [feeSchedule, setFeeSchedule] = useLocalStorage<FeeItem[]>(
    'dental-fee-schedule',
    defaultFeeSchedule
  );

  // Track if fee schedule needs update
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  // Check fee schedule version on mount
  useEffect(() => {
    const storedVersion = localStorage.getItem(FEE_SCHEDULE_VERSION_KEY);
    
    // If no version stored, or version is outdated, show the banner
    if (!storedVersion || storedVersion !== FEE_SCHEDULE_VERSION) {
      // Only show banner if there's existing data (user has used the app before)
      const existingData = localStorage.getItem('dental-fee-schedule');
      if (existingData) {
        setShowUpdateBanner(true);
      } else {
        // First time user - just set the version
        localStorage.setItem(FEE_SCHEDULE_VERSION_KEY, FEE_SCHEDULE_VERSION);
      }
    }
  }, []);

  // Handle resetting fee schedule to latest version
  const handleResetFeeSchedule = useCallback(() => {
    setFeeSchedule(defaultFeeSchedule);
    localStorage.setItem(FEE_SCHEDULE_VERSION_KEY, FEE_SCHEDULE_VERSION);
    setShowUpdateBanner(false);
    toast.success('Fee schedule updated to the latest version!', {
      description: `${defaultFeeSchedule.length} item codes loaded with updated descriptions and fees.`,
    });
  }, [setFeeSchedule]);

  // Dismiss the banner without updating
  const handleDismissBanner = useCallback(() => {
    setShowUpdateBanner(false);
  }, []);

  // Template Settings (stored in localStorage)
  const [templateSettings, setTemplateSettings] = useLocalStorage<TemplateSettings>(
    'dental-template-settings-v2',
    DEFAULT_TEMPLATE_SETTINGS
  );

  // Preview toggle
  const [showPreview, setShowPreview] = useState(true);
  
  // PDF generation state
  const [isGenerating, setIsGenerating] = useState(false);
  
  // PDF import state
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate totals
  const { totalAmount, formattedTotal } = useFeeCalculator(items);

  // Check if team page is available for selected location
  const team = LOCATION_TO_TEAM[location];
  const teamLabel = team.charAt(0).toUpperCase() + team.slice(1);

  // Treatment plan data for preview and PDF generation
  const treatmentPlanData: TreatmentPlanData = useMemo(() => ({
    patientName,
    doctorName,
    doctorPhoto: doctorPhoto || undefined,
    date,
    location,
    items,
    totalAmount,
  }), [patientName, doctorName, doctorPhoto, date, location, items, totalAmount]);

  // Generate filename
  const filename = useMemo(() => {
    const sanitizedName = patientName.replace(/[^a-zA-Z0-9]/g, '_') || 'Patient';
    const dateStr = date.replace(/-/g, '');
    return `TreatmentPlan_${sanitizedName}_${dateStr}.pdf`;
  }, [patientName, date]);

  // Handle PDF download
  const handleDownloadPdf = useCallback(async () => {
    setIsGenerating(true);
    try {
      const pdfBytes = await generateTreatmentPlanPdf({
        data: treatmentPlanData,
        settings: templateSettings,
      });
      downloadPdf(pdfBytes, filename);
      toast.success('PDF generated successfully!');
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [treatmentPlanData, templateSettings, filename]);

  // Handle PDF import
  const handleImportPdf = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    toast.loading('Parsing treatment plan...', { id: 'parsing' });

    try {
      const result = await parseTreatmentPlanPdf(file);

      if (!result.success) {
        toast.error(result.errors[0]?.message || 'Failed to parse PDF', { id: 'parsing' });
        return;
      }

      const { data } = result;
      if (!data) {
        toast.error('No data extracted from PDF', { id: 'parsing' });
        return;
      }

      // Update form fields with extracted data
      if (data.patientName) setPatientName(data.patientName);
      if (data.doctorName) setDoctorName(data.doctorName);
      if (data.doctorPhoto) setDoctorPhoto(data.doctorPhoto);
      if (data.location) setLocation(data.location);
      if (data.date) setDate(data.date);
      
      // Update treatment items if found
      if (data.items.length > 0) {
        setItems(data.items);
      }

      // Show success with warnings if any
      if (result.warnings.length > 0) {
        toast.success(
          <div>
            <p className="font-medium">Treatment plan imported!</p>
            <ul className="text-sm mt-1 text-muted-foreground">
              {result.warnings.map((warning, i) => (
                <li key={i}>• {warning}</li>
              ))}
            </ul>
          </div>,
          { id: 'parsing', duration: 5000 }
        );
      } else {
        toast.success('Treatment plan imported successfully!', { id: 'parsing' });
      }
    } catch (error) {
      console.error('Failed to parse PDF:', error);
      toast.error('Failed to parse PDF. Please check the file and try again.', { id: 'parsing' });
    } finally {
      setIsParsing(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2BBFB3]/5 via-white to-[#A5338D]/5">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/brand/logo-favicon.png" 
                alt="SIA Dental" 
                className="h-10 w-10"
              />
      <div>
                <h1 className="text-2xl font-bold">
                  <span className="text-sia-teal">SIA</span>
                  <span className="text-sia-purple">Dental</span>
                </h1>
                <p className="text-sm text-muted-foreground">
                  Treatment Plan Generator
        </p>
      </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Hidden file input for PDF import */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf"
                onChange={handleImportPdf}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing}
              >
                {isParsing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Plan
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Hide Preview
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Show Preview
                  </>
                )}
              </Button>
              <Button onClick={handleDownloadPdf} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4 mr-2" />
                    Download PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Fee Schedule Update Banner */}
      {showUpdateBanner && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 p-2 bg-amber-100 rounded-full">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-amber-800">
                    New Item Codes Available!
                  </p>
                  <p className="text-sm text-amber-700">
                    We've updated the fee schedule with new descriptions and prices. Click "Update Now" to get the latest codes.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDismissBanner}
                  className="text-amber-700 border-amber-300 hover:bg-amber-100"
                >
                  <X className="h-4 w-4 mr-1" />
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  onClick={handleResetFeeSchedule}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Update Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className={`grid gap-8 ${showPreview ? 'lg:grid-cols-2' : ''}`}>
          {/* Form Section */}
          <div className="space-y-6">
            <Tabs defaultValue="generator" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="generator">Generator</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="about">About</TabsTrigger>
              </TabsList>

              <TabsContent value="generator" className="space-y-6 mt-6">
                {/* Patient Info Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Patient & Doctor Information</CardTitle>
                    <CardDescription>
                      Enter the patient details and select the treating doctor and location.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PatientInfoForm
                      patientName={patientName}
                      doctorName={doctorName}
                      doctorPhoto={doctorPhoto}
                      date={date}
                      location={location}
                      onPatientNameChange={setPatientName}
                      onDoctorNameChange={setDoctorName}
                      onDoctorPhotoChange={setDoctorPhoto}
                      onDateChange={setDate}
                      onLocationChange={setLocation}
                    />
                    
                    {/* Team page status */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Team page ({teamLabel}):
                        </span>
                        <span className="text-green-600 font-medium">✓ Ready</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Treatment Items Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Treatment Plan Items</CardTitle>
                    <CardDescription>
                      Add treatment items by typing the item code. Description and fee will auto-fill.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TreatmentItemsTable
                      items={items}
                      feeSchedule={feeSchedule}
                      onItemsChange={setItems}
                      formattedTotal={formattedTotal}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-6 mt-6">
                {/* Template Uploader */}
                <TemplateUploader
                  settings={templateSettings}
                  onSettingsChange={setTemplateSettings}
                />

                {/* Fee Schedule */}
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>Fee Schedule</CardTitle>
                        <CardDescription>
                          Item codes and their default descriptions and fees.
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetFeeSchedule}
                        className="flex-shrink-0"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reset to Default
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Version: {FEE_SCHEDULE_VERSION} • {feeSchedule.length} items
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-background">
                          <tr className="border-b">
                            <th className="text-left py-2 px-2">Code</th>
                            <th className="text-left py-2 px-2">Description</th>
                            <th className="text-right py-2 px-2">Fee</th>
                          </tr>
                        </thead>
                        <tbody>
                          {feeSchedule.map((item) => (
                            <tr key={item.code} className="border-b">
                              <td className="py-2 px-2 font-mono">{item.code}</td>
                              <td className="py-2 px-2 text-muted-foreground">
                                {item.description.length > 60
                                  ? `${item.description.substring(0, 60)}...`
                                  : item.description}
                              </td>
                              <td className="py-2 px-2 text-right">
                                ${item.fee}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="about" className="space-y-6 mt-6">
                <Card className="border-sia-teal/20">
                  <CardHeader className="bg-sia-teal/5">
                    <div className="flex items-center gap-2 mb-1">
                      <Info className="h-5 w-5 text-sia-teal" />
                      <CardTitle>Project Overview</CardTitle>
                    </div>
                    <CardDescription>
                      Learn how the SIA Dental Treatment Plan Generator works.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-8">
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-sia-purple">The Vision</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        A professional, automated tool designed to transform how SIA Dental creates and manages treatment plans. 
                        It moves away from manual data entry toward a smart, "one-click" experience that ensures every patient 
                        receives a beautiful, consistent, and accurate document.
                      </p>
                    </div>

                    <div className="grid gap-6">
                      <div className="space-y-2 p-4 rounded-xl bg-muted/30 border border-muted">
                        <h4 className="font-bold flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sia-teal text-white text-xs">1</span>
                          The "Smart Reader" (PDF Import)
                        </h4>
                        <p className="text-sm text-muted-foreground pl-8">
                          Instead of typing everything from scratch, you can simply upload an old treatment plan. 
                          The tool scanning the PDF, looks for keywords (like doctor names or item codes), 
                          and automatically fills in the form for you.
                        </p>
                      </div>

                      <div className="space-y-2 p-4 rounded-xl bg-muted/30 border border-muted">
                        <h4 className="font-bold flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sia-teal text-white text-xs">2</span>
                          The "Template" System
                        </h4>
                        <p className="text-sm text-muted-foreground pl-8">
                          The tool uses official clinic templates as a foundation. It acts like a high-tech "digital stamp," 
                          placing patient data and treatment rows in exact alignment with the SIA Dental branding.
                        </p>
                      </div>

                      <div className="space-y-2 p-4 rounded-xl bg-muted/30 border border-muted">
                        <h4 className="font-bold flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sia-teal text-white text-xs">3</span>
                          "Auto-Pilot" Dentist Manager
                        </h4>
                        <p className="text-sm text-muted-foreground pl-8">
                          A central brain that stores official dentist profiles. Selecting a name instantly pulls their 
                          high-quality photo and selects the correct clinic location automatically. 
                          It even crops photos into perfect circles with a teal border.
                        </p>
                      </div>

                      <div className="space-y-2 p-4 rounded-xl bg-muted/30 border border-muted">
                        <h4 className="font-bold flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sia-teal text-white text-xs">4</span>
                          Real-Time "Live Preview"
                        </h4>
                        <p className="text-sm text-muted-foreground pl-8">
                          What you see is what you get. As you type or add items, the preview updates instantly 
                          on a digital canvas, ensuring 100% accuracy before you click download.
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-dashed">
                      <blockquote className="italic text-sm text-muted-foreground border-l-4 border-sia-purple pl-4 py-1">
                        "The goal was to turn a manual, time-consuming process into a 10-second task that ensures 
                        every patient gets a consistent, beautiful, and professional treatment plan every single time."
                      </blockquote>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Preview Section */}
          {showPreview && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Live Preview</CardTitle>
                  <CardDescription>
                    Navigate through pages to preview your treatment plan
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CanvasPreview
                    data={treatmentPlanData}
                    settings={templateSettings}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/80 mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>SIA Dental Treatment Plan Generator</p>
        </div>
      </footer>

      {/* Toast notifications */}
      <Toaster 
        position="top-right" 
        richColors 
        closeButton
        toastOptions={{
          style: {
            fontFamily: 'Nunito, sans-serif',
          },
        }}
      />
    </div>
  );
}

export default App;
