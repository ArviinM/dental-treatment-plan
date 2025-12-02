import { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
  doctorPhoto: string | null;
  date: string;
  location: Location;
  onPatientNameChange: (value: string) => void;
  onDoctorNameChange: (value: string) => void;
  onDoctorPhotoChange: (value: string | null) => void;
  onDateChange: (value: string) => void;
  onLocationChange: (value: Location) => void;
}

export function PatientInfoForm({
  patientName,
  doctorName,
  doctorPhoto,
  date,
  location,
  onPatientNameChange,
  onDoctorNameChange,
  onDoctorPhotoChange,
  onDateChange,
  onLocationChange,
}: PatientInfoFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onDoctorPhotoChange(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    onDoctorPhotoChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
          placeholder="e.g. Dr. Esther Chin"
        />
      </div>

      <div className="space-y-2">
        <Label>Doctor Photo</Label>
        <div className="flex items-center gap-4">
          {doctorPhoto ? (
            <div className="relative">
              <img
                src={doctorPhoto}
                alt="Doctor"
                className="w-16 h-16 rounded-full object-cover border-2 border-sia-teal"
              />
              <button
                onClick={handleRemovePhoto}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                title="Remove photo"
              >
                ×
              </button>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              id="doctorPhotoInput"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              {doctorPhoto ? 'Change Photo' : 'Upload Photo'}
            </Button>
          </div>
        </div>
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

      <div className="space-y-2 md:col-span-2">
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

