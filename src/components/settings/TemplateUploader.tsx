import { useCallback } from 'react';
import { Image as ImageIcon, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { TemplateSettings } from '@/types';

interface TemplateUploaderProps {
  settings: TemplateSettings;
  onSettingsChange: (settings: TemplateSettings) => void;
}

export function TemplateUploader({ settings, onSettingsChange }: TemplateUploaderProps) {
  const updatePosition = useCallback(
    (field: 'patientNamePosition' | 'doctorNamePosition' | 'doctorPhotoPosition', axis: 'x' | 'y' | 'size', value: number) => {
      onSettingsChange({
        ...settings,
        [field]: {
          ...settings[field],
          [axis]: value,
        },
      });
    },
    [settings, onSettingsChange]
  );

  const updateTableSetting = useCallback(
    (field: keyof TemplateSettings, value: number) => {
      onSettingsChange({
        ...settings,
        [field]: value,
      });
    },
    [settings, onSettingsChange]
  );

  return (
    <div className="space-y-6">
      {/* Template Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            PDF Templates
          </CardTitle>
          <CardDescription>
            Default templates are loaded from the /public/templates folder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Template Files:</p>
                <ul className="space-y-1">
                  <li>• <code className="text-xs bg-muted px-1 rounded">TreatmentPlanBlank.pdf</code> - Cover & Treatment pages</li>
                  <li>• <code className="text-xs bg-muted px-1 rounded">essendon-team.pdf</code> - Essendon team page</li>
                  <li>• <code className="text-xs bg-muted px-1 rounded">burwood-team.pdf</code> - Burwood team page</li>
                  <li>• <code className="text-xs bg-muted px-1 rounded">mulgrave-team.pdf</code> - Mulgrave team page</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Text Positioning */}
      <Card>
        <CardHeader>
          <CardTitle>Text Positioning</CardTitle>
          <CardDescription>
            Adjust the X and Y coordinates for text placement on the cover page.
            PDF coordinates start from bottom-left (Y increases upward).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Patient Name Position */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Patient Name</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="patientX" className="text-xs text-muted-foreground">X (horizontal)</Label>
                <Input
                  id="patientX"
                  type="number"
                  value={settings.patientNamePosition.x}
                  onChange={(e) => updatePosition('patientNamePosition', 'x', Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="patientY" className="text-xs text-muted-foreground">Y (from bottom)</Label>
                <Input
                  id="patientY"
                  type="number"
                  value={settings.patientNamePosition.y}
                  onChange={(e) => updatePosition('patientNamePosition', 'y', Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="patientFontSize" className="text-xs text-muted-foreground">Font Size</Label>
                <Input
                  id="patientFontSize"
                  type="number"
                  value={settings.patientNameFontSize}
                  onChange={(e) => updateTableSetting('patientNameFontSize', Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Doctor Name Position */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Doctor Name</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="doctorX" className="text-xs text-muted-foreground">X (horizontal)</Label>
                <Input
                  id="doctorX"
                  type="number"
                  value={settings.doctorNamePosition.x}
                  onChange={(e) => updatePosition('doctorNamePosition', 'x', Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="doctorY" className="text-xs text-muted-foreground">Y (from bottom)</Label>
                <Input
                  id="doctorY"
                  type="number"
                  value={settings.doctorNamePosition.y}
                  onChange={(e) => updatePosition('doctorNamePosition', 'y', Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="doctorFontSize" className="text-xs text-muted-foreground">Font Size</Label>
                <Input
                  id="doctorFontSize"
                  type="number"
                  value={settings.doctorNameFontSize}
                  onChange={(e) => updateTableSetting('doctorNameFontSize', Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Doctor Photo Position */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Doctor Photo Position</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="photoX" className="text-xs text-muted-foreground">X (horizontal)</Label>
                <Input
                  id="photoX"
                  type="number"
                  value={settings.doctorPhotoPosition.x}
                  onChange={(e) => updatePosition('doctorPhotoPosition', 'x', Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="photoY" className="text-xs text-muted-foreground">Y (from bottom)</Label>
                <Input
                  id="photoY"
                  type="number"
                  value={settings.doctorPhotoPosition.y}
                  onChange={(e) => updatePosition('doctorPhotoPosition', 'y', Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="photoSize" className="text-xs text-muted-foreground">Size (diameter)</Label>
                <Input
                  id="photoSize"
                  type="number"
                  value={settings.doctorPhotoPosition.size}
                  onChange={(e) => updatePosition('doctorPhotoPosition', 'size', Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Table Settings</CardTitle>
          <CardDescription>
            Adjust the treatment table positioning and layout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="tableStartY" className="text-xs text-muted-foreground">Table Start Y (from bottom)</Label>
              <Input
                id="tableStartY"
                type="number"
                value={settings.tableStartY}
                onChange={(e) => updateTableSetting('tableStartY', Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tableMarginX" className="text-xs text-muted-foreground">Table Margin X</Label>
              <Input
                id="tableMarginX"
                type="number"
                value={settings.tableMarginX}
                onChange={(e) => updateTableSetting('tableMarginX', Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rowHeight" className="text-xs text-muted-foreground">Row Height</Label>
              <Input
                id="rowHeight"
                type="number"
                value={settings.rowHeight}
                onChange={(e) => updateTableSetting('rowHeight', Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="maxRowsPerPage" className="text-xs text-muted-foreground">Max Rows Per Page</Label>
              <Input
                id="maxRowsPerPage"
                type="number"
                value={settings.maxRowsPerPage}
                onChange={(e) => updateTableSetting('maxRowsPerPage', Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
