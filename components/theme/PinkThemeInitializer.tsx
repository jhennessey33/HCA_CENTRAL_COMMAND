"use client";

import { useEffect } from "react";

export default function PinkThemeInitializer() {
  useEffect(() => {
    const storedTheme = window.localStorage.getItem("hca-dashboard-theme");
    const isPinkMode = storedTheme === "pink";

    document.documentElement.classList.toggle("hca-pink-theme", isPinkMode);
  }, []);

  return null;
}
