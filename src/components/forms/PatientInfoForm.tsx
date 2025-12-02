import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Location } from '@/types';
import { LOCATIONS } from '@/types';

interface PatientInfoFormProps {
  patientName: string;
  doctorName: string;
  date: string;
  location: Location;
  onPatientNameChange: (value: string) => void;
  onDoctorNameChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onLocationChange: (value: Location) => void;
}

export function PatientInfoForm({
  patientName,
  doctorName,
  date,
  location,
  onPatientNameChange,
  onDoctorNameChange,
  onDateChange,
  onLocationChange,
}: PatientInfoFormProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="patientName">Patient Name</Label>
        <Input
          id="patientName"
          value={patientName}
          onChange={(e) => onPatientNameChange(e.target.value)}
          placeholder="e.g. Jane Panting"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="doctorName">Doctor / Dentist Name</Label>
        <Input
          id="doctorName"
          value={doctorName}
          onChange={(e) => onDoctorNameChange(e.target.value)}
          placeholder="e.g. Dr Safaa Idris"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Select value={location} onValueChange={(v) => onLocationChange(v as Location)}>
          <SelectTrigger id="location">
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(LOCATIONS).map(([key, loc]) => (
              <SelectItem key={key} value={key}>
                {loc.name} - {loc.address}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

