import { NavLink } from "react-router";
import { LayoutDashboard, Users, UserCheck, GraduationCap, ClipboardList, BookOpen, DollarSign, Building, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const navItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
  { icon: Building, label: "Schools", href: "/dashboard/schools" },
  { icon: Users, label: "Students", href: "/dashboard/students" },
  { icon: UserCheck, label: "Teachers", href: "/dashboard/teachers" },
  { icon: GraduationCap, label: "Classes", href: "/dashboard/classes" },
  { icon: ClipboardList, label: "Grades", href: "/dashboard/grades" },
  { icon: BookOpen, label: "Library", href: "/dashboard/library" },
  { icon: DollarSign, label: "Finance", href: "/dashboard/finance" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

export function Sidebar() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r bg-card hidden md:flex">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-primary">DigiMedal</h2>
      </div>
      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === "/dashboard"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
