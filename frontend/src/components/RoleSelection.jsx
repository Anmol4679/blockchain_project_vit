import React from 'react';
import {
  Stethoscope,
  Building2,
  HeartHandshake,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  Lock,
  FileText,
  Award,
  Key,
  Users,
  CheckCircle2,
  HardDrive
} from 'lucide-react';

export default function RoleSelection({ onSelectRole, selectedRole, onContinue }) {
  const roles = [
    {
      id: 'patient',
      title: 'Patient',
      subtitle: 'Personal Health Records & Decryption',
      badge: 'Secure Access',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: HeartHandshake,
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      accentBorder: 'hover:border-emerald-400 group-hover:border-emerald-300',
      selectedRing: 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/20',
      description: 'Access, view, and decrypt medical records securely shared with you by doctors and healthcare institutions.',
      features: [
        'Access records in "Shared With Me"',
        'Client-side zero-knowledge decryption',
        'Verify certificate authenticity'
      ],
      defaultTab: 'shared'
    },
    {
      id: 'doctor',
      title: 'Doctor',
      subtitle: 'Clinical Practice & Certificate Authority',
      badge: 'Full Clinical Access',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: Stethoscope,
      iconBg: 'bg-blue-50 text-blue-600 border-blue-100',
      accentBorder: 'hover:border-blue-400 group-hover:border-blue-300',
      selectedRing: 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/20',
      description: 'Encrypt and upload diagnostic reports, grant cryptographic access to patients/specialists, and issue blockchain certificates.',
      features: [
        'Upload & encrypt medical records (AES-256)',
        'Manage access permissions & re-wrap keys',
        'Issue tamper-proof certificates on-chain'
      ],
      defaultTab: 'upload'
    },
    {
      id: 'medicalStaff',
      title: 'Medical Staff',
      subtitle: 'Hospital Operations & Record Archives',
      badge: 'Records & Archive',
      badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
      icon: Building2,
      iconBg: 'bg-teal-50 text-teal-600 border-teal-100',
      accentBorder: 'hover:border-teal-400 group-hover:border-teal-300',
      selectedRing: 'ring-2 ring-teal-500 border-teal-500 bg-teal-50/20',
      description: 'Upload patient records, maintain hospital archives, manage access delegation, and verify document integrity.',
      features: [
        'Upload & pin records to IPFS',
        'Manage hospital document access',
        'Verify document hash on Ethereum ledger'
      ],
      defaultTab: 'upload'
    },
    {
      id: 'admin',
      title: 'Administrator',
      subtitle: 'System Governance & Access Control',
      badge: 'System Governance',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      icon: ShieldAlert,
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      accentBorder: 'hover:border-indigo-400 group-hover:border-indigo-300',
      selectedRing: 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/20',
      description: 'Administer smart contract access control, onboard doctors & staff, and oversee decentralized ledger security.',
      features: [
        'Onboard & revoke healthcare practitioner roles',
        'Administer BlockDriveAccessControl contract',
        'Ledger auditing & system access controls'
      ],
      defaultTab: 'admin'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-900">
      {/* Top Brand Bar */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-white rounded-md transition-transform duration-150 hover:scale-105">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900 tracking-tight">BlockDrive</span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-slate-100 text-slate-600 rounded border border-slate-200">
                  Role Portal
                </span>
              </div>
              <p className="text-xs text-slate-500">Decentralized Healthcare Access Control System</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline font-medium text-slate-700">ECDH & Smart Contract RBAC Active</span>
          </div>
        </div>
      </header>

      {/* Main Content: Role Selection */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 w-full flex-1 flex flex-col justify-center">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 mb-1">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Select Your Healthcare Identity</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Choose Your Account Role
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Select your role to access your dedicated authentication gateway and specialized dashboard.
          </p>
        </div>

        {/* 4 Role Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {roles.map((r) => {
            const Icon = r.icon;
            const isSelected = selectedRole === r.id;

            return (
              <div
                key={r.id}
                onClick={() => onSelectRole(r.id)}
                className={`group bg-white rounded-xl border p-5 cursor-pointer flex flex-col justify-between transition-all duration-200 interactive-lift shadow-xs ${
                  isSelected
                    ? r.selectedRing
                    : `border-slate-200 hover:border-slate-300 ${r.accentBorder}`
                }`}
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-lg border ${r.iconBg} transition-transform duration-200 group-hover:scale-105`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${r.badgeClass}`}>
                      {r.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-slate-900">
                      {r.title}
                    </h3>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                      {r.subtitle}
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed mt-2.5">
                      {r.description}
                    </p>
                  </div>

                  {/* Role Capabilities */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-100">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Permissions
                    </span>
                    {r.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5 group-hover:text-slate-700" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Select Button */}
                <div className="pt-5 mt-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRole(r.id);
                      if (onContinue) onContinue(r.id);
                    }}
                    className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700'
                    }`}
                  >
                    <span>{isSelected ? 'Continue as ' + r.title : 'Select ' + r.title}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Global Action Footer */}
        {selectedRole && (
          <div className="mt-8 text-center animate-fade-in">
            <button
              onClick={() => onContinue(selectedRole)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-sm font-semibold rounded-lg shadow-sm transition-all duration-150 interactive-lift cursor-pointer"
            >
              <span>Proceed to {roles.find(r => r.id === selectedRole)?.title} Login</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        BlockDrive Healthcare Network • Cryptographic Role-Based Access Control Architecture
      </footer>
    </div>
  );
}
