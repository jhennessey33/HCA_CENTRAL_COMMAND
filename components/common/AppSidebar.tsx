import HcaLogo from "@/components/common/HcaLogo";
import PinkThemeSnake from "@/components/arcade/snake-game";

function NavItem({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <a
      href={href}
      className={`block rounded-2xl px-3 py-2.5 text-sm transition ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </a>
  );
}

export default function AppSidebar({ activePage }: { activePage: string }) {
  const navItems = [
    { href: "/trade-calculator", label: "Trade Calculator" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/", label: "Home / Positions" },
    { href: "/watchlist", label: "Watchlist" },
    { href: "/alerts", label: "Alerts" },
    { href: "/meetings", label: "Meetings" },

    { href: "/comments", label: "Comments" },
    { href: "/trades", label: "Trades" },
    { href: "/past-positions", label: "Past Positions" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white p-4">
      <div className="mb-6 flex items-center gap-3 px-2 py-2">
        <HcaLogo />
        <div>
          <h1 className="font-semibold leading-tight">HCA Central Command</h1>
          <p className="text-xs text-slate-500">Portfolio operations hub</p>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            active={item.href === activePage}
          />
        ))}
      </nav>
      <PinkThemeSnake />
    </aside>
  );
}
