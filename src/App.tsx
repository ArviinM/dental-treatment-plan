import { useState, useMemo } from 'react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { FileDown, Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PatientInfoForm } from '@/components/forms/PatientInfoForm';
import { TreatmentItemsTable } from '@/components/forms/TreatmentItemsTable';
import { TreatmentPlanPDF } from '@/components/pdf/TreatmentPlanPDF';
import { useFeeCalculator } from '@/hooks/useFeeCalculator';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { defaultFeeSchedule } from '@/data/default-fee-schedule';
import type { TreatmentItem, Location, FeeItem } from '@/types';

function App() {
  // Patient Info State
  const [patientName, setPatientName] = useState('');
  const [doctorName, setDoctorName] = useState('');
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

  // Preview toggle
  const [showPreview, setShowPreview] = useState(false);

  // Calculate totals
  const { totalAmount, formattedTotal } = useFeeCalculator(items);

  // Memoize PDF document to prevent unnecessary re-renders
  const pdfDocument = useMemo(
    () => (
      <TreatmentPlanPDF
        patientName={patientName}
        doctorName={doctorName}
        location={location}
        items={items}
        totalAmount={totalAmount}
      />
    ),
    [patientName, doctorName, location, items, totalAmount]
  );

  // Generate filename
  const filename = useMemo(() => {
    const sanitizedName = patientName.replace(/[^a-zA-Z0-9]/g, '_') || 'Patient';
    const dateStr = date.replace(/-/g, '');
    return `TreatmentPlan_${sanitizedName}_${dateStr}.pdf`;
  }, [patientName, date]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                <span className="text-teal-600">Sia</span>
                <span className="text-purple-600">Dental</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Treatment Plan Generator
              </p>
            </div>
            <div className="flex items-center gap-3">
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
              <PDFDownloadLink document={pdfDocument} fileName={filename}>
                {({ loading }) => (
                  <Button disabled={loading}>
                    <FileDown className="h-4 w-4 mr-2" />
                    {loading ? 'Generating...' : 'Download PDF'}
                  </Button>
                )}
              </PDFDownloadLink>
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
                  </CardHeader>
                  <CardContent>
                    <PatientInfoForm
                      patientName={patientName}
                      doctorName={doctorName}
                      date={date}
                      location={location}
                      onPatientNameChange={setPatientName}
                      onDoctorNameChange={setDoctorName}
                      onDateChange={setDate}
                      onLocationChange={setLocation}
                    />
                  </CardContent>
                </Card>

                {/* Treatment Items Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Treatment Plan Items</CardTitle>
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
                <Card>
                  <CardHeader>
                    <CardTitle>Template Settings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Template background upload and positioning settings will be
                      available here once you provide the template images.
                    </p>
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">Coming Soon:</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Upload Cover Page background image</li>
                        <li>• Upload Table Page header/footer image</li>
                        <li>• Configure text positions (X, Y coordinates)</li>
                        <li>• Import/Export Fee Schedule (CSV)</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Fee Schedule</CardTitle>
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
                                {item.description.substring(0, 60)}...
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

          {/* PDF Preview Section */}
          {showPreview && (
            <div className="lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">PDF Preview</CardTitle>
                </CardHeader>
                <CardContent className="h-[calc(100%-4rem)]">
                  <PDFViewer
                    width="100%"
                    height="100%"
                    className="rounded-lg border"
                    showToolbar={false}
                  >
                    {pdfDocument}
                  </PDFViewer>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/80 mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>SiaDental Treatment Plan Generator</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
