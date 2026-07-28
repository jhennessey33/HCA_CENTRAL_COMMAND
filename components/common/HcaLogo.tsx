import { useEffect, useState } from "react";

export default function HcaLogo() {
  const [isPink, setIsPink] = useState(false);

  useEffect(() => {
    const htmlElement = document.documentElement;

    const updateLogo = () => {
      setIsPink(htmlElement.classList.contains("hca-pink-theme"));
    };

    // Set the correct logo when the component first loads.
    updateLogo();

    // Watch the <html> element for class changes.
    const observer = new MutationObserver(updateLogo);

    observer.observe(htmlElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden">
      <img
        src={isPink ? "/assets/pink-icon.png" : "/assets/icon2.png"}
        alt="HCA Logo"
        width={40}
        height={40}
        className="block h-10 w-10 object-contain"
      />
    </div>
  );
}
