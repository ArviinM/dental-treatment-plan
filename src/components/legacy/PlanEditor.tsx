'use client';

/**
 * The original single-page generator, lifted out of App.tsx unchanged.
 *
 * This screen is FROZEN. Ericka's team has habits built around it, so its
 * layout, tabs, preview and buttons stay exactly as they are. New capability
 * belongs on new pages (/plans/new), never in here.
 *
 * Two things were adjusted when it moved under the dashboard shell, both to
 * avoid rendering twice: the brand block (the nav shows it now) and the
 * <Toaster> (the root layout owns it).
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { FileDown, Eye, EyeOff, Loader2, Upload, Info, AlertTriangle, BookOpen, MousePointerClick, Search, Settings, Download, FileText , Pencil } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PatientInfoForm } from '@/components/forms/PatientInfoForm';
import { TreatmentItemsTable } from '@/components/forms/TreatmentItemsTable';
import { CanvasPreview } from '@/components/preview/CanvasPreview';
import { TemplateUploader } from '@/components/settings/TemplateUploader';
import { renderTreatmentPlanPdf, downloadPdf } from '@/lib/pdf/client';
import { parseTreatmentPlanPdf } from '@/services/pdfParser';
import { useFeeCalculator } from '@/hooks/useFeeCalculator';
import { saveTemplateSettings } from '@/app/(app)/admin/templates/actions';
import type { Dentist } from '@/data/dentists';
import type { TreatmentItem, Location, FeeItem, TemplateSettings, TreatmentPlanData } from '@/types';
import { DEFAULT_TEMPLATE_SETTINGS, LOCATION_TO_TEAM } from '@/types';

type PlanEditorProps = {
  /** The shared fee schedule. Was a bundled array until Phase 3. */
  feeSchedule: FeeItem[];
  /** The dentist directory. Was src/data/dentists.ts until Phase 3. */
  dentists: Dentist[];
  /** Shared text positions and table metrics, from the database. */
  initialTemplateSettings: TemplateSettings;
  /**
   * Whether this person may save Settings for everyone. These used to live in
   * each browser's localStorage; shared, one person's tweak would change every
   * plan, so persisting is admin-only. Staff can still adjust and preview.
   */
  canSaveSettings: boolean;
};

export function PlanEditor({
  feeSchedule,
  dentists,
  initialTemplateSettings,
  canSaveSettings,
}: PlanEditorProps) {
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
      phase: 1,
      visitNo: 1,
      itemCode: '', 
      times: 1,
      description: '', 
      tooth: '', 
      fees: [{ id: 'f1', quantity: 1, unitFee: 0 }] 
    },
  ]);

  // The "your fee schedule is out of date" banner is gone: there is one shared
  // schedule now, so a per-browser copy can no longer fall behind.

  // Template settings: seeded from the database, edited locally so the preview
  // stays instant, and written back only by someone allowed to.
  const [templateSettings, setTemplateSettingsState] =
    useState<TemplateSettings>(initialTemplateSettings);

  // These are number inputs, so a change fires on every keystroke. Saving each
  // one would mean a round trip to Sydney per digit and a history entry per
  // digit too, so the write is debounced until typing stops.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTemplateSettings = useCallback(
    (next: TemplateSettings) => {
      // The preview moves immediately; only persistence waits.
      setTemplateSettingsState(next);
      if (!canSaveSettings) return;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveTemplateSettings(next).then((result) => {
          if (!result.ok) toast.error(result.error ?? 'Could not save those settings.');
        });
      }, 800);
    },
    [canSaveSettings]
  );

  const handleResetAll = useCallback(() => {
    setTemplateSettings(DEFAULT_TEMPLATE_SETTINGS);
    toast.success('Settings reset to defaults', {
      description: canSaveSettings
        ? 'Text positions and table settings are back to how they started.'
        : 'Reset for you. Ask an admin to save it for everyone.',
    });
  }, [setTemplateSettings, canSaveSettings]);

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
      const pdfBytes = await renderTreatmentPlanPdf(treatmentPlanData, templateSettings);
      downloadPdf(pdfBytes, filename);

      const sizeMB = pdfBytes.length / (1024 * 1024);
      if (sizeMB > 5) {
        toast.warning(
          <div>
            <p className="font-medium">PDF is {sizeMB.toFixed(1)} MB — may be too large to email</p>
            <p className="text-sm mt-1">
              Most email providers cap attachments at 5 MB. You can compress it for free at{' '}
              <a
                href="https://www.ilovepdf.com/compress_pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                ilovepdf.com
              </a>
              {' '}before sending.
            </p>
          </div>,
          { duration: 10000 }
        );
      } else {
        toast.success('PDF generated successfully!');
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to generate PDF. Please try again.'
      );
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
    <>
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-14 lg:top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {/* Same wording as the sidebar and the home page. One action,
                  one name, the whole way through. */}
              <h1 className="text-2xl font-bold text-sia-dark">Make a plan</h1>
              <p className="text-sm text-muted-foreground">
                Fill in the patient and treatment details, then download the PDF.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
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

      {/* The fee-schedule update banner is gone: one shared schedule means a
          per-browser copy can no longer fall behind. */}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className={`grid gap-8 ${showPreview ? 'lg:grid-cols-2' : ''}`}>
          {/* Form Section */}
          <div className="space-y-6">
            <Tabs defaultValue="generator" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="generator">Generator</TabsTrigger>
                <TabsTrigger value="tutorial">Tutorial</TabsTrigger>
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
                  dentists={dentists}
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

              <TabsContent value="tutorial" className="space-y-6 mt-6">
                <Card className="border-sia-purple/20">
                  <CardHeader className="bg-sia-purple/5">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="h-5 w-5 text-sia-purple" />
                      <CardTitle>How to Use This Tool</CardTitle>
                    </div>
                    <CardDescription>
                      Follow these simple steps to create a professional treatment plan in seconds.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    {/* Quick Start */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-sia-teal flex items-center gap-2">
                        <MousePointerClick className="h-5 w-5" />
                        Quick Start Guide
                      </h3>
                      
                      <div className="grid gap-4">
                        <div className="flex gap-4 p-4 rounded-xl bg-gradient-to-r from-sia-teal/5 to-transparent border border-sia-teal/20">
                          <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-sia-teal text-white font-bold">
                            1
                          </div>
                          <div>
                            <h4 className="font-semibold">Select a Doctor</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Choose the treating doctor from the dropdown. Their photo and default location will be automatically filled in.
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-4 p-4 rounded-xl bg-gradient-to-r from-sia-teal/5 to-transparent border border-sia-teal/20">
                          <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-sia-teal text-white font-bold">
                            2
                          </div>
                          <div>
                            <h4 className="font-semibold">Enter Patient Name & Date</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Type the patient's full name and select the treatment plan date.
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-4 p-4 rounded-xl bg-gradient-to-r from-sia-teal/5 to-transparent border border-sia-teal/20">
                          <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-sia-teal text-white font-bold">
                            3
                          </div>
                          <div>
                            <h4 className="font-semibold">Add Treatment Items</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Set the <strong>Phase</strong> and <strong>Visit No</strong> to organize treatments by appointment. Type an item code (e.g., "011", "114", "521") - the description and fee will auto-fill. Items are grouped with subtotals for each phase/visit.
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-4 p-4 rounded-xl bg-gradient-to-r from-sia-teal/5 to-transparent border border-sia-teal/20">
                          <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-sia-teal text-white font-bold">
                            4
                          </div>
                          <div>
                            <h4 className="font-semibold">Download PDF</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Click the <strong>"Download PDF"</strong> button in the top-right corner. Your professional treatment plan is ready!
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-dashed" />

                    {/* Tips & Tricks */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-sia-purple flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Tips & Tricks
                      </h3>

                      <div className="grid gap-3">
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          <FileText className="h-5 w-5 text-sia-teal flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-sm">Import Existing Plans</p>
                            <p className="text-xs text-muted-foreground">
                              Click "Import Plan" to upload an existing PDF. The tool will automatically extract patient info and treatment items.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          <Search className="h-5 w-5 text-sia-teal flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-sm">Search Item Codes</p>
                            <p className="text-xs text-muted-foreground">
                              Start typing in the Item Code field to search. You can search by code number or description keywords.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          <Eye className="h-5 w-5 text-sia-teal flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-sm">Live Preview</p>
                            <p className="text-xs text-muted-foreground">
                              Watch the preview update in real-time as you type. Use the page navigation arrows to see all pages.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          <Settings className="h-5 w-5 text-sia-teal flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-sm">Multiple Fees per Item</p>
                            <p className="text-xs text-muted-foreground">
                              Click the "+" button next to fees to add multiple fee entries for the same treatment item.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          <FileText className="h-5 w-5 text-sia-teal flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-sm">Phase & Visit Grouping</p>
                            <p className="text-xs text-muted-foreground">
                              Use Phase and Visit No to organize treatments by appointment. The PDF will automatically show subtotals for each phase/visit combination.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-dashed" />

                    {/* Troubleshooting */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-amber-600 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Troubleshooting
                      </h3>

                      <div className="space-y-3">
                        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50">
                          <p className="font-medium text-sm text-amber-800">Item codes not showing or outdated?</p>
                          <p className="text-xs text-amber-700 mt-1">
                            Go to the <strong>Settings</strong> tab and click <strong>"Reset to Default"</strong> in the Fee Schedule section, or use <strong>"Reset All"</strong> to restore everything to defaults.
                          </p>
                        </div>

                        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50">
                          <p className="font-medium text-sm text-amber-800">PDF generation failing or settings corrupted?</p>
                          <p className="text-xs text-amber-700 mt-1">
                            Go to <strong>Settings</strong> and click <strong>"Reset All (Settings + Item Codes)"</strong> to restore all settings to their default values. This fixes most issues.
                          </p>
                        </div>

                        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50">
                          <p className="font-medium text-sm text-amber-800">Doctor photo not appearing?</p>
                          <p className="text-xs text-amber-700 mt-1">
                            Select a doctor from the dropdown list. If using a custom name, you can upload a photo manually by clicking the photo area.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Keyboard Shortcuts */}
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Quick Reference
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <span className="text-muted-foreground">Add new row</span>
                          <span className="font-mono bg-background px-2 py-0.5 rounded border">+ Button</span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <span className="text-muted-foreground">Delete row</span>
                          <span className="font-mono bg-background px-2 py-0.5 rounded border">🗑️ Button</span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <span className="text-muted-foreground">Search codes</span>
                          <span className="font-mono bg-background px-2 py-0.5 rounded border">Type in field</span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <span className="text-muted-foreground">Toggle preview</span>
                          <span className="font-mono bg-background px-2 py-0.5 rounded border">👁️ Button</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-6 mt-6">
                {/* Template Uploader */}
                <TemplateUploader
                  settings={templateSettings}
                  onSettingsChange={setTemplateSettings}
                  onResetAll={handleResetAll}
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
                      <Button variant="outline" size="sm" asChild className="flex-shrink-0">
                        <a href="/fees">
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit fees
                        </a>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {feeSchedule.length} items · shared with everyone
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-background">
                          <tr className="border-b">
                            <th className="text-left py-2 px-2">Code</th>
                            <th className="text-left py-2 px-2">Item Name</th>
                            <th className="text-left py-2 px-2">Description</th>
                            <th className="text-right py-2 px-2">Fee</th>
                          </tr>
                        </thead>
                        <tbody>
                          {feeSchedule.map((item) => (
                            <tr key={item.code} className="border-b">
                              <td className="py-2 px-2 font-mono">{item.code}</td>
                              <td className="py-2 px-2 font-medium">{item.name}</td>
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
                        receives a beautiful, consistent, and accurate document with treatments organized by phase and visit.
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

                      <div className="space-y-2 p-4 rounded-xl bg-muted/30 border border-muted">
                        <h4 className="font-bold flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sia-teal text-white text-xs">5</span>
                          Phase & Visit Organization
                        </h4>
                        <p className="text-sm text-muted-foreground pl-8">
                          Treatment items are organized by Phase and Visit numbers, matching the clinic's workflow. 
                          The table displays: Phase | Visit | Item | Times | Description | Tooth | Fee | Amount, 
                          with automatic subtotals calculated for each phase/visit combination.
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-dashed space-y-4">
                      <blockquote className="italic text-sm text-muted-foreground border-l-4 border-sia-purple pl-4 py-1">
                        "The goal was to turn a manual, time-consuming process into a 10-second task that ensures 
                        every patient gets a consistent, beautiful, and professional treatment plan every single time."
                      </blockquote>
                      
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p className="font-medium">Table Columns:</p>
                        <p>Phase | Visit No | Item | Times | Description | Tooth | Fee | Amount</p>
                        <p className="mt-2 font-medium">Features:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          <li>Import existing treatment plans via PDF</li>
                          <li>Auto-fill item descriptions and fees from item codes</li>
                          <li>Organize by Phase and Visit with automatic subtotals</li>
                          <li>Real-time preview with page navigation</li>
                          <li>Professional PDF generation with clinic branding</li>
                        </ul>
                      </div>
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

    </>
  );
}
