import { useState, useMemo, useCallback, useRef } from 'react';
import { FileDown, Eye, EyeOff, Loader2, Upload } from 'lucide-react';
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
import { defaultFeeSchedule } from '@/data/default-fee-schedule';
import type { TreatmentItem, Location, FeeItem, TemplateSettings, TreatmentPlanData } from '@/types';
import { DEFAULT_TEMPLATE_SETTINGS, LOCATION_TO_TEAM } from '@/types';

function App() {
  // Patient Info State
  const [patientName, setPatientName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [doctorPhoto, setDoctorPhoto] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState<Location>('essendon');

  // Treatment Items State
  const [items, setItems] = useState<TreatmentItem[]>([
    { id: '1', itemCode: '', description: '', tooth: '', fee: 0 },
  ]);

  // Fee Schedule (stored in localStorage)
  const [feeSchedule] = useLocalStorage<FeeItem[]>(
    'dental-fee-schedule',
    defaultFeeSchedule
  );

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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className={`grid gap-8 ${showPreview ? 'lg:grid-cols-2' : ''}`}>
          {/* Form Section */}
          <div className="space-y-6">
            <Tabs defaultValue="generator" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="generator">Generator</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
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
                    <CardTitle>Fee Schedule</CardTitle>
                    <CardDescription>
                      Item codes and their default descriptions and fees.
                    </CardDescription>
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
