"use client";

import { useEffect, useState } from "react";

export default function LocalDateTime({
  value,
  className,
}: {
  value: string | Date | null | undefined;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState("—");

  useEffect(() => {
    if (!value) {
      setDisplayValue("—");
      return;
    }

    setDisplayValue(
      new Intl.DateTimeFormat("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value)),
    );
  }, [value]);

  return <span className={className}>{displayValue}</span>;
}
