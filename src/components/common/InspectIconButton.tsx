import { Eye } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

interface InspectIconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  label: string;
  size?: number;
}

export function InspectIconButton({
  className = "",
  label,
  size = 15,
  title,
  type = "button",
  ...buttonProps
}: InspectIconButtonProps) {
  return (
    <button
      {...buttonProps}
      aria-label={label}
      className={className}
      title={title ?? label}
      type={type}
    >
      <Eye size={size} />
    </button>
  );
}
