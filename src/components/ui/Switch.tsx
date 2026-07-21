import { CgSpinner } from "react-icons/cg";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export default function Switch({
  checked,
  onChange,
  disabled = false,
  loading = false,
  className = "",
}: SwitchProps) {
  const handleToggle = () => {
    if (disabled || loading) return;
    onChange(!checked);
  };

  return (
    <div className="flex items-center">
      {loading ? (
        <CgSpinner className="animate-spin text-slate-400 text-sm" />
      ) : (
        <div
          onClick={handleToggle}
          className={`w-8 h-4 rounded-full p-0.5 transition-all duration-300 select-none ${
            disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-[0.95]"
          } ${
            checked ? "bg-emerald-500 flex justify-end" : "bg-slate-300 dark:bg-slate-700 flex justify-start"
          } ${className}`}
        >
          <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
        </div>
      )}
    </div>
  );
}
